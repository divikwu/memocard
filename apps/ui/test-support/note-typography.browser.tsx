import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { createPortal } from "react-dom";
import { page, userEvent } from "vitest/browser";
import type { Editor } from "@tiptap/react";
import { AllSelection } from "@tiptap/pm/state";
import { BlockRangeSelection } from "../src/rich-block-selection";
import { richBlockBody } from "../src/rich-block-frame";
import { resolveTypography } from "../src/features/typography/TypographyProvider";
import { defaults } from "../src/features/typography/preferences";
import { NoteMarkdown } from "../ui/business/NoteMarkdown";
import { RichMarkdownEditor } from "../ui/business/RichMarkdownEditor";
import { EmojiPicker } from "../ui/business/tag-navigation-editor";
import { blockSpacingBody } from "../ui-state-fixtures/block-spacing";
import { setStorybookBrowserAssets } from "./bridge";
import "../.storybook/preview.css";
import "../ui/business/Editor.css";
import "../ui/business/sidebar.css";
import "../ui/web/web-typography.css";
import "../ui/web/web-app.css";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-small-text");
  document.documentElement.removeAttribute("data-web-typography");
  document.documentElement.removeAttribute("data-ui-input-modality");
});

function typography(size: string, flow = "16px", leading = "1.5") {
  document.documentElement.toggleAttribute("data-small-text", size === "14");
  for (const [key, value] of Object.entries(resolveTypography({ ...defaults, size, flow, leading }))) document.documentElement.style.setProperty(key, value);
}

async function editorFixture(body: string) {
  const view = render(<div className="ui-note-editor" style={{ padding: 32 }}><RichMarkdownEditor value={body} notePath="notes/rhythm.md" disabled={false} autoFocus={false} onChange={vi.fn()} onSave={vi.fn()} onError={vi.fn()} /></div>);
  const field = await view.findByRole("textbox", { name: "笔记内容" });
  return { ...view, field, editor: (field as HTMLElement & { editor: Editor }).editor };
}

async function outlineFixture(body: string, web = true) {
  await page.viewport(1024, 900);
  const onChange = vi.fn();
  const view = render(<div className="ui-theme web-app" data-web-client={web || undefined}><main className="web-app-main" style={{ position: "relative", height: 600 }}><div className="note-page-scroll" style={{ height: 600, overflowY: "auto", scrollPaddingTop: 64, padding: "80px 80px 32px" }}><div className="ui-note-editor"><RichMarkdownEditor value={body} notePath="notes/outline.md" disabled={false} autoFocus={false} onChange={onChange} onSave={vi.fn()} onError={vi.fn()} /></div></div></main></div>);
  const field = await view.findByRole("textbox", { name: "笔记内容" });
  return { ...view, field, onChange, editor: (field as HTMLElement & { editor: Editor }).editor, scroller: view.container.querySelector<HTMLElement>(".note-page-scroll")! };
}

test("floating note outline follows heading edits, duplicate titles, and its two-heading threshold", async () => {
  const { editor, queryByRole, findByRole } = await outlineFixture("## One\n\nBody");
  expect(queryByRole("button", { name: "打开笔记目录" })).toBeNull();
  act(() => { editor.commands.setContent("<h2>Same</h2><p>Body</p><h3>Same</h3><h4></h4>"); });
  const trigger = await findByRole("button", { name: "打开笔记目录" });
  await userEvent.hover(trigger);
  const nav = await findByRole("navigation", { name: "笔记目录" });
  expect(within(nav).getAllByRole("button", { name: "Same" })).toHaveLength(2);
  const links = within(nav).getAllByRole("button", { name: "Same" });
  expect(getComputedStyle(nav.closest('[data-slot="popover-content"]')!).borderRadius).toBe("12px");
  for (const link of links) {
    expect(getComputedStyle(link).height).toBe("32px");
    expect(getComputedStyle(link).fontWeight).toBe(link.hasAttribute("aria-current") ? "600" : "400");
  }
  expect(links[1].getBoundingClientRect().left).toBeGreaterThan(links[0].getBoundingClientRect().left);
  act(() => { editor.commands.setContent("<h2>Renamed</h2><p>Body</p><h3>Second</h3>"); });
  await waitFor(() => expect(within(nav).getByRole("button", { name: "Renamed" })).toBeTruthy());
  act(() => { editor.commands.setContent("<h2>Only</h2><p>Body</p>"); });
  await waitFor(() => expect(queryByRole("button", { name: "打开笔记目录" })).toBeNull());
  expect(queryByRole("navigation", { name: "笔记目录" })).toBeNull();
});

test("floating note outline jumps into folded chapters and tracks scrolling without editing the note", async () => {
  const paragraphs = Array.from({ length: 18 }, (_, index) => `Paragraph ${index + 1} with enough content to give this chapter its own scroll position.`).join("\n\n");
  const { editor, field, onChange, scroller, findByRole } = await outlineFixture(`## Parent\n\n${paragraphs}\n\n### Child\n\n${paragraphs}\n\n## End\n\n${paragraphs}`);
  scroller.style.paddingTop = "80.25px";
  const original = editor.state.doc;
  onChange.mockClear();
  await userEvent.click(await findByRole("button", { name: "收起“Parent”章节" }));
  expect(field.querySelector("h3")?.hasAttribute("hidden")).toBe(true);
  await userEvent.hover(await findByRole("button", { name: "打开笔记目录" }));
  const nav = await findByRole("navigation", { name: "笔记目录" });
  await userEvent.click(within(nav).getByRole("button", { name: "Child" }));
  await waitFor(() => expect(field.querySelector("h3")?.hasAttribute("hidden")).toBe(false));
  await waitFor(() => expect(within(nav).getByRole("button", { name: "Child" }).getAttribute("aria-current")).toBe("location"));
  expect(scroller.scrollTop).toBeGreaterThan(0);
  const flash = document.querySelector<HTMLElement>(".ui-note-outline-highlight")!;
  expect(flash.hidden).toBe(false);
  act(() => { editor.commands.setNodeSelection(editor.state.selection.$from.before(1)); });
  await waitFor(() => {
    const selected = field.closest(".rich-editor")!.querySelector<SVGPathElement>(".rich-block-highlights > path")!;
    const jumped = flash.querySelector<SVGPathElement>("path")!;
    expect(selected).not.toBeNull();
    const a = selected.getBoundingClientRect(), b = jumped.getBoundingClientRect();
    for (const edge of ["left", "top", "width", "height"] as const) expect(b[edge]).toBeCloseTo(a[edge], 1);
    expect(jumped.getTotalLength()).toBeCloseTo(selected.getTotalLength(), 1);
    expect(getComputedStyle(jumped).fill).toBe(getComputedStyle(selected).fill);
    expect(getComputedStyle(flash).opacity).toBe("1");
  });
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
  await waitFor(() => expect(within(nav).getByRole("button", { name: "End" }).getAttribute("aria-current")).toBe("location"));
  expect(editor.state.doc.eq(original)).toBe(true);
  expect(editor.can().undo()).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
});

test("floating note outline preserves an explicit near-end jump until reading resumes", async () => {
  const intro = Array.from({ length: 18 }, () => "A paragraph that makes this document taller than its scroll surface.").join("\n\n");
  const { scroller, findByRole } = await outlineFixture(`## Start\n\n${intro}\n\n## Requested\n\nShort section.\n\n## Last\n\nShort end.`);
  await userEvent.hover(await findByRole("button", { name: "打开笔记目录" }));
  const nav = await findByRole("navigation", { name: "笔记目录" });
  await userEvent.click(within(nav).getByRole("button", { name: "Requested" }));
  await act(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
  expect(scroller.scrollTop).toBeCloseTo(scroller.scrollHeight - scroller.clientHeight, 0);
  expect(within(nav).getByRole("button", { name: "Requested" }).getAttribute("aria-current")).toBe("location");
  // A wheel gesture at the bottom resumes reading even when the scroll offset cannot change.
  fireEvent.wheel(scroller, { deltaY: 100 });
  await waitFor(() => expect(within(nav).getByRole("button", { name: "Last" }).getAttribute("aria-current")).toBe("location"));
  scroller.scrollTo({ top: 0, behavior: "instant" });
  await waitFor(() => expect(within(nav).getByRole("button", { name: "Start" }).getAttribute("aria-current")).toBe("location"));
});

test("floating note outline reveals the current item when a long menu opens or the chapter changes", async () => {
  const body = Array.from({ length: 60 }, (_, index) => `## Chapter ${index + 1}\n\nThis chapter has a body paragraph.`).join("\n\n");
  const { container, scroller, findByRole, queryByRole } = await outlineFixture(body);
  const trigger = await findByRole("button", { name: "打开笔记目录" });
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
  await waitFor(() => expect(container.querySelector(".ui-note-outline-marks > span:last-child")?.hasAttribute("data-active")).toBe(true));
  const beforeOpen = scroller.scrollTop;
  await userEvent.hover(trigger);
  const nav = await findByRole("navigation", { name: "笔记目录" });
  await waitFor(() => {
    const target = within(nav).getByRole("button", { name: "Chapter 60" }).getBoundingClientRect();
    const bounds = nav.getBoundingClientRect();
    expect(target.top).toBeGreaterThanOrEqual(bounds.top - 1);
    expect(target.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
  });
  expect(scroller.scrollTop).toBe(beforeOpen);
  scroller.scrollTo({ top: 0, behavior: "instant" });
  await waitFor(() => {
    const first = within(nav).getByRole("button", { name: "Chapter 1" });
    expect(first.getAttribute("aria-current")).toBe("location");
    expect(first.getBoundingClientRect().top).toBeGreaterThanOrEqual(nav.getBoundingClientRect().top - 1);
  });
  await userEvent.hover(document.body, { position: { x: 4, y: 4 } });
  await waitFor(() => expect(queryByRole("navigation", { name: "笔记目录" })).toBeNull());
  await userEvent.hover(trigger);
  const reopened = await findByRole("navigation", { name: "笔记目录" });
  await waitFor(() => expect(within(reopened).getByRole("button", { name: "Chapter 1" }).getBoundingClientRect().bottom).toBeLessThanOrEqual(reopened.getBoundingClientRect().bottom + 1));
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
  const last = within(reopened).getByRole("button", { name: "Chapter 60" });
  await waitFor(() => expect(last.getAttribute("aria-current")).toBe("location"));
  last.focus();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(queryByRole("navigation", { name: "笔记目录" })).toBeNull());
  expect(document.activeElement).toBe(trigger);
  await userEvent.keyboard("{Enter}");
  const keyboardMenu = await findByRole("navigation", { name: "笔记目录" });
  await waitFor(() => expect(document.activeElement).toBe(within(keyboardMenu).getByRole("button", { name: "Chapter 60" })));
});

test("floating note outline supports keyboard dismissal and stays out of mobile and native layouts", async () => {
  const fixture = await outlineFixture("## First\n\nBody\n\n### Second\n\nBody");
  const trigger = await fixture.findByRole("button", { name: "打开笔记目录" });
  await userEvent.hover(trigger);
  await fixture.findByRole("navigation", { name: "笔记目录" });
  await userEvent.hover(document.body, { position: { x: 4, y: 4 } });
  await waitFor(() => expect(fixture.queryByRole("navigation", { name: "笔记目录" })).toBeNull());
  await userEvent.keyboard("{Tab}");
  trigger.focus();
  const nav = await fixture.findByRole("navigation", { name: "笔记目录" });
  await userEvent.tab();
  expect(nav.contains(document.activeElement)).toBe(true);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(fixture.queryByRole("navigation", { name: "笔记目录" })).toBeNull());
  expect(document.activeElement).toBe(trigger);
  await page.viewport(390, 844);
  await waitFor(() => expect(fixture.queryByRole("button", { name: "打开笔记目录" })).toBeNull());
  fixture.unmount();
  const native = await outlineFixture("## First\n\nBody\n\n### Second\n\nBody", false);
  expect(native.queryByRole("button", { name: "打开笔记目录" })).toBeNull();
});

test("embedded emoji picker retains the sidebar separator and spacing", () => {
  const { container } = render(<EmojiPicker selected="" disabled={false} onSelect={vi.fn()} />);
  const section = container.querySelector<HTMLElement>(".ui-sidebar-emoji-picker")!;
  expect(getComputedStyle(section).borderTopWidth).toBe("1px");
  expect(getComputedStyle(section).paddingTop).toBe("12px");
});

test("portaled search preview keeps compact typography when note preferences change", () => {
  document.documentElement.setAttribute("data-web-typography", "");
  render(createPortal(<div className="ui-note-search-preview-content"><NoteMarkdown body={"intro\n\n# Heading\n\nfirst\n\nsecond"} /></div>, document.body));
  const root = document.querySelector<HTMLElement>(".ui-note-search-preview-content .ui-note-markdown")!;
  const [first, second] = Array.from(root.querySelectorAll("p")).slice(1);
  for (const size of ["14", "16"]) for (const flow of ["16px", "2em"]) for (const leading of ["1.5", "1.9"]) {
    typography(size, flow, leading);
    expect(getComputedStyle(root).fontSize).toBe("14px");
    expect(parseFloat(getComputedStyle(root).lineHeight)).toBeCloseTo(23.3338, 2);
    expect(second.getBoundingClientRect().top - first.getBoundingClientRect().bottom).toBeCloseTo(11.9, 1);
    expect(getComputedStyle(root.querySelector("h1")!).fontSize).toBe("24.5px");
  }
});

test("search preview reserves space for individual captions inside an image row", async () => {
  await page.viewport(1024, 900);
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 1;
  const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
  const restoreAssets = setStorybookBrowserAssets({ "assets/search-caption.png": png });
  try {
    const image = '<img src="../assets/search-caption.png" width="240" height="120" alt="Sample">';
    const captioned = image.replace(' alt=', ' data-image-caption="Search caption" alt=');
    const { container } = render(<div className="ui-note-search-preview-content" style={{ width: 320 }}><NoteMarkdown notePath="notes/search.md" body={`<figure data-image-columns="50,50">${captioned}${image}</figure>\n\nNext paragraph`} /></div>);
    const figure = container.querySelector("figure")!;
    for (const image of figure.querySelectorAll("img")) await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true));
    const caption = within(figure).getByText("Search caption").getBoundingClientRect();
    const imageBox = figure.querySelector("img")!.getBoundingClientRect();
    expect(caption.top - imageBox.bottom).toBeCloseTo(8, 1);
    expect(caption.bottom).toBeLessThanOrEqual(figure.getBoundingClientRect().bottom);
    expect(caption.bottom).toBeLessThan(within(container).getByText("Next paragraph").getBoundingClientRect().top);
  } finally { restoreAssets(); }
});

test("editor keyboard exit hint stays screen-reader-only while editing", async () => {
  typography("16");
  for (const width of [320, 390, 1024]) {
    await page.viewport(width, 900);
    const { field, unmount } = await editorFixture("Plain text");
    await userEvent.click(field);
    const hint = document.getElementById(field.getAttribute("aria-describedby")!)!;
    expect(hint.textContent).toContain("Esc 后按 Tab / Shift+Tab 离开正文");
    expect(hint.getBoundingClientRect().width).toBe(1);
    expect(hint.getBoundingClientRect().height).toBe(1);
    expect(getComputedStyle(hint).clipPath).toBe("inset(50%)");
    unmount();
  }
});

for (const size of ["14", "16"]) test(`heading fold stays visible across the gutter and block grip at ${size}px`, async () => {
  typography(size);
  const { container, field, editor, findByRole } = await outlineFixture("## Heading\n\nSection body\n\n## Next\n\nOther body");
  const fold = await findByRole("button", { name: "收起“Heading”章节" });
  const nextFold = await findByRole("button", { name: "收起“Next”章节" });
  const heading = field.querySelector("h2")!, original = editor.state.doc;
  const bounds = container.getBoundingClientRect();
  const foldBox = fold.getBoundingClientRect(), headingBox = heading.getBoundingClientRect();
  const y = foldBox.top + foldBox.height / 2 - bounds.top;
  for (let x = headingBox.left + 30; x >= foldBox.left + foldBox.width / 2; x -= 2) {
    await userEvent.hover(container, { position: { x: x - bounds.left, y } });
    expect(getComputedStyle(fold).opacity, `pointer at ${x}`).toBe("1");
    expect(getComputedStyle(nextFold).opacity).toBe("0");
  }
  const grip = await findByRole("button", { name: "内容块操作" });
  const gripBox = grip.getBoundingClientRect();
  expect(document.elementFromPoint(gripBox.left + gripBox.width / 2, gripBox.top + gripBox.height / 2)?.closest("button")).toBe(grip);
  await userEvent.click(fold);
  await waitFor(() => expect(fold.getAttribute("aria-expanded")).toBe("false"));
  const other = field.querySelector("h2:last-of-type")!;
  await userEvent.hover(other);
  expect(getComputedStyle(fold).opacity).toBe("0");
  await userEvent.hover(heading);
  expect(getComputedStyle(fold).opacity).toBe("1");
  await userEvent.click(fold);
  await userEvent.hover(other);
  expect(getComputedStyle(fold).opacity).toBe("0");
  document.documentElement.setAttribute("data-ui-input-modality", "keyboard");
  fold.focus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(fold.getAttribute("aria-expanded")).toBe("false"));
  expect(getComputedStyle(fold).opacity).toBe("1");
  expect(editor.state.doc.eq(original)).toBe(true);
});

test("heading fold hover survives conversion and undo at the same position", async () => {
  await page.viewport(1024, 900);
  const { field, editor, findByRole } = await editorFixture("## Heading\n\nBody");
  const original = editor.state.doc;
  const fold = await findByRole("button", { name: "收起“Heading”章节" });
  const grip = await findByRole("button", { name: "内容块操作" });
  await userEvent.hover(field.querySelector("h2")!);
  await userEvent.hover(grip);
  expect(getComputedStyle(fold).opacity).toBe("1");
  act(() => { editor.commands.setTextSelection(1); editor.commands.setParagraph(); });
  await waitFor(() => expect(field.querySelector(".rich-heading-fold")).toBeNull());
  act(() => { editor.commands.undo(); });
  const restored = await findByRole("button", { name: "收起“Heading”章节" });
  await waitFor(() => expect(getComputedStyle(restored).opacity).toBe("1"));
  await userEvent.hover(field.querySelector("h2")!);
  await userEvent.hover(grip);
  expect(getComputedStyle(restored).opacity).toBe("1");
  expect(editor.state.doc.eq(original)).toBe(true);
});

test("heading fold hover survives external content replacement at the same position", async () => {
  await page.viewport(1024, 900);
  const props = { notePath: "notes/replacement.md", disabled: false, autoFocus: false, onChange: vi.fn(), onSave: vi.fn(), onError: vi.fn() };
  const content = (value: string) => <div className="ui-note-editor" style={{ padding: 32 }}><RichMarkdownEditor {...props} value={value} /></div>;
  const view = render(content("## Old\n\nBody"));
  const field = await view.findByRole("textbox", { name: "笔记内容" });
  const old = await view.findByRole("button", { name: "收起“Old”章节" });
  const grip = view.getByRole("button", { name: "内容块操作" });
  await userEvent.hover(field.querySelector("h2")!);
  await userEvent.hover(grip);
  expect(getComputedStyle(old).opacity).toBe("1");
  view.rerender(content("## New\n\nBody"));
  const fold = await view.findByRole("button", { name: "收起“New”章节" });
  await waitFor(() => expect(getComputedStyle(fold).opacity).toBe("1"));
  await userEvent.hover(field.querySelector("h2")!);
  await userEvent.hover(grip);
  expect(getComputedStyle(fold).opacity).toBe("1");
  await userEvent.hover(field.querySelector("p")!);
  expect(getComputedStyle(fold).opacity).toBe("0");
  expect(props.onChange).not.toHaveBeenCalled();
});

for (const size of ["14", "16"]) for (const tail of ["```txt\ncode\n```", "> quote", "- first\n- second"]) {
  test(`folded heading spacing ignores hidden ${tail.split("\n")[0]} blocks at ${size}px`, async () => {
    typography(size);
    const { field, findByRole, editor } = await editorFixture(`## A\n\n### Nested\n\n${tail}\n\n## B\n\nend`);
    const original = editor.state.doc;
    fireEvent.click(await findByRole("button", { name: "收起“A”章节" }));
    await waitFor(() => expect(field.querySelector(".rich-folded-content")).not.toBeNull());
    const [a, b] = Array.from(field.querySelectorAll("h2"));
    expect(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom).toBeCloseTo(4, 1);
    expect(visibleBlock(b).top - visibleBlock(a).bottom).toBeCloseTo(36, 1);
    expect(editor.state.doc.eq(original)).toBe(true);
    fireEvent.click(await findByRole("button", { name: "展开“A”章节" }));
    await waitFor(() => expect(field.querySelector(".rich-folded-content")).toBeNull());
    expect(editor.state.doc.eq(original)).toBe(true);
  });
}

const relativeGaps: Record<string, Record<string, number>> = {
  "14": { "1em": 14, "1.25em": 18, "2em": 28 },
  "16": { "1em": 16, "1.25em": 20, "2em": 32 },
};

test("saved relative paragraph spacing follows root font size in reading and editing", async () => {
  for (const rootSize of [16, 20]) for (const size of ["14", "16"]) for (const [flow, referenceGap] of Object.entries(relativeGaps[size])) {
    document.documentElement.style.fontSize = `${rootSize}px`;
    typography(size, flow);
    const reader = render(<NoteMarkdown body={"first\n\nsecond\n\n# Heading\n\nafter"} />);
    const { field, unmount, editor } = await editorFixture("first\n\nsecond\n\n# Heading\n\nafter");
    const original = editor.state.doc;
    const bodySize = rootSize * Number(size) / 16, gap = referenceGap * rootSize / 16;
    for (const [root, editing] of [[reader.container.querySelector(".ui-note-markdown")!, false], [field, true]] as const) {
      const [a, b, after] = Array.from(root.querySelectorAll("p"));
      expect(parseFloat(getComputedStyle(a).fontSize)).toBe(bodySize);
      const textGap = editing ? gap + rootSize : gap;
      expect(visibleBlock(b).top - visibleBlock(a).bottom).toBeCloseTo(textGap, 1);
      expect(visibleBlock(after).top - visibleBlock(root.querySelector("h1")!).bottom).toBeCloseTo(textGap, 1);
      if (editing) {
        const textLeft = a.getBoundingClientRect().left + parseFloat(getComputedStyle(a).paddingLeft);
        expect(textLeft - root.getBoundingClientRect().left).toBeCloseTo(rootSize / 2, 1);
      }
    }
    expect(editor.state.doc.eq(original)).toBe(true);
    unmount(); reader.unmount();
  }
});

for (const size of ["14", "16"]) test(`paragraphs keep the same padding around H1 at ${size}px`, async () => {
  typography(size);
  const { field } = await editorFixture("First\n\nSecond\n\nBefore H1\n\n# Heading\n\nBody");
  const [first, second, beforeH1, heading, afterH1] = Array.from(field.children) as HTMLElement[];
  for (const paragraph of [first, second, beforeH1, afterH1]) {
    expect(getComputedStyle(paragraph).padding).toBe("6px");
    expect(getComputedStyle(paragraph.firstElementChild!).padding).toBe("2px");
  }
  for (const [previous, next] of [[first, second], [second, beforeH1], [beforeH1, heading], [heading, afterH1]]) {
    expect(next.getBoundingClientRect().top - previous.getBoundingClientRect().bottom).toBe(4);
    expect(visibleBlock(next).top - visibleBlock(previous).bottom).toBe(next === heading ? 40 : 20);
  }
});

for (const size of ["14", "16"]) test(`headings and paragraphs use the same selection bounds in every mode at ${size}px`, async () => {
  typography(size);
  const { field, editor } = await editorFixture("Intro\n\n## Heading\n\nBody\n\nNext\n\n> Quote");
  const heading = field.querySelector("h2")!;
  const body = heading.nextElementSibling as HTMLElement;
  const next = body.nextElementSibling as HTMLElement;
  expect(body.matches(".rich-paragraph-block")).toBe(true);
  expect(field.querySelector("blockquote .rich-paragraph-block")).toBeNull();
  expect(getComputedStyle(heading).paddingBottom).toBe("6px");
  expect(getComputedStyle(heading.querySelector(".rich-heading-text")!).padding).toBe("2px");
  expect(getComputedStyle(body.querySelector(":scope > p")!).padding).toBe("2px");
  expect(getComputedStyle(next).padding).toBe("6px");
  expect(visibleBlock(body).top - visibleBlock(heading).bottom).toBe(20);
  expect(visibleBlock(next).top - visibleBlock(body).bottom).toBe(20);

  const path = () => field.closest(".rich-editor")!.querySelector<SVGPathElement>(".rich-block-highlights > path");
  const { doc } = editor.state;
  const headingPos = doc.child(0).nodeSize;
  let pos = headingPos;
  const singlePaths: string[] = [];
  for (const [index, block] of [heading, body, next].entries()) {
    editor.commands.setNodeSelection(pos);
    const frame = block.getBoundingClientRect();
    await waitFor(() => {
      expect(path()?.getBoundingClientRect().top).toBeCloseTo(frame.top, 1);
      expect(path()?.getBoundingClientRect().bottom).toBeCloseTo(frame.bottom, 1);
    });
    singlePaths.push(path()!.getAttribute("d")!);
    pos += doc.child(index + 1).nodeSize;
  }
  editor.view.dispatch(editor.state.tr.setSelection(BlockRangeSelection.between(doc, headingPos, pos)));
  await waitFor(() => expect(path()?.getAttribute("d")?.match(/M[^M]+/g)).toEqual(singlePaths));
  editor.commands.selectAll();
  await waitFor(() => {
    const paths = path()?.getAttribute("d")?.match(/M[^M]+/g);
    expect(paths).toHaveLength(doc.childCount);
    expect(paths?.slice(1, 4)).toEqual(singlePaths);
    expect(getComputedStyle(path()!.ownerSVGElement!).mixBlendMode).toBe("darken");
  });
});

for (const size of ["14", "16"]) for (const rootSize of [16, 20]) {
  test(`even note type and block metrics retain root scaling: size ${size}, root ${rootSize}`, async () => {
    document.documentElement.style.fontSize = `${rootSize}px`;
    const source = '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n\nbody and `inline`\n\n1. ordered\n\n- [ ] task\n\n> quote one\n>\n> quote two\n\n<aside data-callout="gray" data-callout-icon="💡"><p>callout</p><p>second line</p></aside>\n\n```txt\ncode\n```\n\n| A | B |\n| --- | --- |\n| a | b |\n\n---\n\n<figure><figcaption>caption</figcaption></figure>\n\n[^x]: footnote';
    const reading = render(<NoteMarkdown body={source} />);
    const { field, editor } = await editorFixture(source);
    const original = editor.state.doc;
    const reader = reading.container.querySelector<HTMLElement>(".ui-note-markdown")!;
    const scale = rootSize / 16;
    const small = size === "14";
    const headings = small ? [[26, 34], [22, 28], [18, 24], [16, 24]] : [[32, 40], [26, 34], [22, 28], [18, 24]];
    const lines = small ? [22, 24, 26, 28] : [24, 26, 28, 30];
    for (const [index, leading] of ["1.5", "1.6", "1.75", "1.9"].entries()) {
      typography(size, "16px", leading);
      for (const [root, editing] of [[reader, false], [field, true]] as const) {
        expect(parseFloat(getComputedStyle(root).fontSize)).toBe(Number(size) * scale);
        expect(parseFloat(getComputedStyle(root).lineHeight)).toBeCloseTo(lines[index] * scale, 3);
        for (let level = 1; level <= 6; level++) {
          const style = getComputedStyle(root.querySelector(`h${level}`)!);
          const metrics = headings[level - 1] ?? [Number(size), lines[index]];
          expect(parseFloat(style.fontSize)).toBe(metrics[0] * scale);
          expect(parseFloat(style.lineHeight)).toBeCloseTo(metrics[1] * scale, 3);
        }
        const tableElement = root.querySelector("table")!;
        const code = getComputedStyle(root.querySelector("pre")!), table = getComputedStyle(tableElement);
        const inline = getComputedStyle(root.querySelector("p code")!), header = getComputedStyle(root.querySelector("th")!), cell = getComputedStyle(root.querySelector("td")!);
        const check = getComputedStyle(root.querySelector('input[type="checkbox"]')!);
        expect(parseFloat(inline.fontSize)).toBe((Number(size) - 2) * scale);
        expect(parseFloat(inline.lineHeight)).toBe((lines[index] - 4) * scale);
        expect(parseFloat(inline.paddingBlockStart)).toBe(2 * scale);
        expect(parseFloat(inline.paddingInlineStart)).toBe(4 * scale);
        expect(inline.borderRadius).toBe("4px");
        expect(parseFloat(code.fontSize)).toBe((small ? 12 : 14) * scale);
        expect(parseFloat(code.lineHeight)).toBe((small ? 18 : 20) * scale);
        expect(code.padding).toBe(`${12 * scale}px`);
        expect(code.borderRadius).toBe("4px");
        expect(parseFloat(table.fontSize)).toBe(14 * scale);
        expect(header.fontSize).toBe(table.fontSize);
        expect(cell.fontSize).toBe(table.fontSize);
        expect(parseFloat(table.lineHeight)).toBe(20 * scale);
        expect(table.borderBlockEndWidth).toBe(editing ? "0px" : "1px");
        if (editing) {
          expect(table.borderBlockStartWidth).toBe("1px");
          expect(getComputedStyle(tableElement, "::after").borderBlockEndWidth).toBe("1px");
        }
        expect(header.padding).toBe(`${8 * scale}px ${12 * scale}px`);
        expect(cell.padding).toBe(header.padding);
        expect(cell.borderBlockStartWidth).toBe("0px");
        for (const row of tableElement.rows) expect(row.getBoundingClientRect().height).toBe(36 * scale + 1);
        expect(tableElement.getBoundingClientRect().height).toBe(tableElement.rows.length * (36 * scale + 1) + 1);
        const divider = getComputedStyle(tableElement.rows[1].cells[0], "::before");
        expect(divider.borderBlockStartWidth).toBe("1px");
        expect(divider.borderBlockStartStyle).toBe("solid");
        expect(getComputedStyle(tableElement.rows[0].cells[0], "::before").content).toBe("none");
        const [quoteOne, quoteTwo] = root.querySelectorAll("blockquote p");
        expect(getComputedStyle(quoteOne).fontSize).toBe(`${14 * scale}px`);
        expect(getComputedStyle(quoteOne.closest("blockquote")!).paddingInlineStart).toBe(`${12 * scale}px`);
        expect(quoteTwo.getBoundingClientRect().top - quoteOne.getBoundingClientRect().bottom).toBe(small ? 8 * scale : 16);
        const callout = root.querySelector("aside")!;
        const [calloutFirst, calloutLast] = callout.querySelectorAll("p");
        expect(getComputedStyle(calloutFirst).fontSize).toBe(`${14 * scale}px`);
        const bounds = callout.getBoundingClientRect();
        expect(getComputedStyle(callout).paddingInlineEnd).toBe(`${12 * scale}px`);
        expect(calloutFirst.getBoundingClientRect().top - bounds.top).toBe(12 * scale);
        expect(bounds.bottom - calloutLast.getBoundingClientRect().bottom).toBe(12 * scale);
        expect(getComputedStyle(root.querySelector("ol")!).paddingInlineStart).toBe(`${(editing ? 26 : 24) * scale}px`);
        expect(check.width).toBe(`${16 * scale}px`);
        expect(check.borderTopWidth).toBe("1px");
        expect(check.borderRadius).toBe("4px");
        expect(getComputedStyle(root.querySelector("hr")!).borderBlockStartWidth).toBe("1px");
        expect(parseFloat(getComputedStyle(root.querySelector("figcaption")!).lineHeight)).toBe(20 * scale);
      }
      const icon = field.querySelector<HTMLElement>(".rich-callout-icon")!, text = field.querySelector<HTMLElement>(".rich-callout-content > p")!;
      const a = icon.getBoundingClientRect(), b = text.getBoundingClientRect();
      expect(a.width).toBe(24 * scale);
      expect(a.height).toBe(24 * scale);
      expect(a.left - icon.closest("aside")!.getBoundingClientRect().left).toBe(12 * scale);
      expect(getComputedStyle(icon).borderRadius).toBe("4px");
      expect(a.top + a.height / 2).toBeCloseTo(b.top + b.height / 2, 1);
      expect(editor.state.doc.eq(original)).toBe(true);
    }
  });
}

function visibleBlock(block: HTMLElement) {
  const body = richBlockBody(block);
  if (body.matches("ul,ol")) {
    const items = body.querySelectorAll<HTMLElement>(":scope > li");
    const first = items[0], last = items[items.length - 1];
    return { top: first.getBoundingClientRect().top + parseFloat(getComputedStyle(first).paddingTop), bottom: last.getBoundingClientRect().bottom - parseFloat(getComputedStyle(last).paddingBottom) };
  }
  const target = body.querySelector<HTMLElement>("table") ?? body;
  const rect = target.getBoundingClientRect(), style = getComputedStyle(target);
  const text = target.matches("p, h1, h2, h3, h4, h5, h6, .rich-heading-text");
  return { top: rect.top + (text ? parseFloat(style.paddingTop) : 0), bottom: rect.bottom - (text ? parseFloat(style.paddingBottom) : 0) };
}

test("resizing image columns keeps the note scrolled away from the existing caret", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 1;
  const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
  const restoreAssets = setStorybookBrowserAssets({ "assets/resize.png": png });
  try {
    const image = '<img src="../assets/resize.png" width="240" height="120" alt="Sample">';
    const paragraphs = "Paragraph\n\n".repeat(24);
    const captioned = image.replace(' alt=', ' data-image-caption="Image caption" alt=');
    const { field, editor, scroller, findByRole } = await outlineFixture(`${paragraphs}<figure data-image-columns="50,50">${captioned}${captioned}</figure>\n\n${paragraphs}`);
    const figure = field.querySelector("figure")!;
    const handle = await findByRole("separator", { name: "调整第 1、2 列宽度" });
    await Promise.all([...figure.querySelectorAll("img")].map(img => img.decode()));
    await userEvent.click(field.querySelector("p")!);
    const selection = editor.state.selection;
    handle.scrollIntoView({ block: "center" });
    const scrollTop = scroller.scrollTop;
    expect(scrollTop).toBeGreaterThan(600);
    await userEvent.hover(figure.querySelectorAll("img")[1]);
    const grip = field.closest(".rich-editor")!.querySelector(".block-controls button")!;
    const frame = figure.closest(".rich-image-row")!.getBoundingClientRect();
    const divider = handle.getBoundingClientRect(), gripBox = grip.getBoundingClientRect();
    expect(frame.left - gripBox.right).toBeCloseTo(2, 1);
    const [left, right] = [...figure.querySelectorAll("img")].map(image => image.getBoundingClientRect());
    const y = gripBox.y + gripBox.height / 2;
    expect(divider.left).toBeCloseTo(left.right, 1);
    expect(divider.right).toBeCloseTo(right.left, 1);
    expect(divider.bottom).toBeCloseTo(Math.min(left.bottom, right.bottom), 1);
    expect(document.elementFromPoint(divider.x + divider.width / 2, y)).toBe(handle);
    expect(document.elementFromPoint(right.left + 2, y)).toBe(figure.querySelectorAll("img")[1]);
    await userEvent.dragAndDrop(handle, figure, { targetPosition: { x: figure.clientWidth * .6, y: figure.clientHeight / 2 } });
    expect(figure.getAttribute("data-image-columns")).not.toBe("50,50");
    expect(editor.state.selection.eq(selection)).toBe(true);
    expect(scroller.scrollTop).toBeCloseTo(scrollTop, 0);
  } finally { restoreAssets(); }
});

test("small note rows grow with wrapped text and single images sit 8px above their captions", async () => {
  await page.viewport(390, 900);
  typography("14");
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 1;
  const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
  const restoreAssets = setStorybookBrowserAssets({ "assets/spacing-wide.png": png });
  try {
    const figure = '<figure><img src="../assets/spacing-wide.png" width="240" height="120" alt="Sample"><figcaption>Single image caption</figcaption></figure>';
    const longText = "排版样本用于检查同一个表格单元格自然换行后是否撑开行高。".repeat(5);
    const images = `${figure}\n\n${figure.replace(' width="240" height="120"', "").replace("Sample", "Full width")}`;
    const reader = render(<NoteMarkdown body={images} notePath="notes/rhythm.md" />);
    const { field } = await editorFixture(`${images}\n\n| A | B |\n| --- | --- |\n| Short | Short |\n| ${longText} | Short |`);
    const [, shortRow, wrappedRow] = field.querySelector("table")!.rows;
    const wrappedText = wrappedRow.cells[0].querySelector("p")!.getBoundingClientRect().height;
    expect(shortRow.getBoundingClientRect().height).toBe(37);
    expect(wrappedText).toBeGreaterThan(20);
    expect(wrappedRow.getBoundingClientRect().height).toBe(wrappedText + 17);

    for (const size of ["14", "16"]) {
      typography(size);
      for (const root of [reader.container, field]) {
        for (const figure of root.querySelectorAll("figure")) {
          const image = figure.querySelector("img")!, caption = figure.querySelector("figcaption")!;
          await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true));
          expect(caption.getBoundingClientRect().top - image.getBoundingClientRect().bottom).toBeCloseTo(8, 1);
          expect(image.getBoundingClientRect().width).toBeCloseTo(image.alt === "Sample" ? 240 : figure.getBoundingClientRect().width, 1);
        }
      }
    }
  } finally { restoreAssets(); }
});

for (const size of ["14", "16"]) for (const width of [390, 1024]) {
  test(`block controls share the selected frame gap: size ${size}, width ${width}`, async () => {
    await page.viewport(width, 900);
    typography(size);
    const canvas = document.createElement("canvas");
    canvas.width = 2; canvas.height = 1;
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
    const restoreAssets = setStorybookBrowserAssets({ "assets/spacing-wide.png": png, "assets/spacing-detail.png": png });
    try {
      const captionedImage = '<figure><img src="../assets/spacing-wide.png" width="240" height="120" alt="单张带说明的图片"><figcaption>图片说明</figcaption></figure>';
      const { field, editor, container, getByAltText } = await editorFixture(`${blockSpacingBody}\n\n${captionedImage}`);
      // Keep a previous test's pointer from retargeting the grip while this test scrolls.
      await userEvent.hover(container, { position: { x: 1, y: 1 } });
      await waitFor(() => expect(field.querySelectorAll("table")).toHaveLength(5));
      const diagram = await within(field).findByRole("img", { name: "Mermaid 图表" });
      await waitFor(() => expect(diagram.shadowRoot?.querySelector("svg")).toBeTruthy());
      expect(getComputedStyle(field.querySelector(".note-mermaid-source pre")!).padding).toBe("12px");
      expect(getComputedStyle(diagram.closest(".note-diagram-scroll")!).padding).toBe("12px");
      for (const image of field.querySelectorAll<HTMLImageElement>("img")) await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true));
      const original = editor.state.doc, seen = new Set<string>(), positions: number[] = [];
      original.descendants((node, pos) => {
        if (!node.isBlock || node.type.name === "paragraph" && original.resolve(pos).depth !== 0 || ["tableRow", "tableHeader", "tableCell"].includes(node.type.name)) return;
        const variant = node.type.name === "heading" ? node.attrs.level : node.type.name === "codeBlock" ? node.attrs.language : original.resolve(pos).depth;
        const key = `${node.type.name}:${variant}`;
        if (!seen.has(key)) { seen.add(key); positions.push(pos); }
      });
      expect(positions.length).toBeGreaterThan(25);
      const root = field.closest<HTMLElement>(".rich-editor")!, grip = root.querySelector<HTMLElement>(".block-controls button")!;
      expect(getComputedStyle(root).paddingInline).toBe("0px");
      let paragraphFill: string | undefined;
      for (const pos of positions) {
        const element = editor.view.nodeDOM(pos) as HTMLElement;
        element.scrollIntoView({ block: "center" });
        editor.commands.setNodeSelection(pos);
        await waitFor(() => {
          const path = root.querySelector<SVGPathElement>(".rich-block-highlights > path")!;
          expect(path).not.toBeNull();
          paragraphFill ??= getComputedStyle(path).fill;
          expect(getComputedStyle(path).fill).toBe(paragraphFill);
          const node = original.nodeAt(pos)!, gripBox = grip.getBoundingClientRect(), selected = path.getBoundingClientRect();
          const columnRow = node.type.name === "image" || node.type.name === "wikiImage" ? element.closest("figure[data-image-columns]")?.closest(".rich-image-row") : null;
          const controlFrame = columnRow?.getBoundingClientRect() ?? selected;
          expect(controlFrame.left - gripBox.right, `${node.type.name} gap`).toBeCloseTo(2, 1);
          if (node.isTextblock && !node.type.spec.code || ["listItem", "taskItem"].includes(node.type.name)) {
            const body = richBlockBody(element), style = getComputedStyle(body);
            const firstLineCenter = body.getBoundingClientRect().top + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2;
            expect(gripBox.top + gripBox.height / 2, `${node.type.name} first line`).toBeCloseTo(firstLineCenter, 0);
          } else {
            expect(gripBox.top - controlFrame.top, `${node.type.name} top inset`).toBeCloseTo(Math.min(8, (controlFrame.height - gripBox.height) / 2), 0);
          }
          expect(getComputedStyle(element).borderRadius, original.nodeAt(pos)!.type.name + " " + element.className).toBe("4px");
          expect(path.getAttribute("d")?.match(/A4 4 0 0 1/g)).toHaveLength(4);
          if (element.parentElement === field) {
            const style = getComputedStyle(element);
            expect(style.paddingInline).toBe("6px");
            expect(style.paddingBottom).toBe("6px");
            if (!element.matches("h1, h2, h3, h4")) expect(style.paddingTop).toBe("6px");
            const inner = element.firstElementChild!;
            expect(getComputedStyle(inner).paddingInlineEnd).toBe("2px");
            expect(inner.getBoundingClientRect().left - element.getBoundingClientRect().left).toBeCloseTo(6, 1);
            const frame = element.getBoundingClientRect();
            expect(selected.left).toBeCloseTo(frame.left, 1);
            expect(selected.right).toBeCloseTo(frame.right, 1);
            expect(selected.top).toBeCloseTo(frame.top, 1);
            expect(selected.bottom).toBeCloseTo(frame.bottom, 1);
          }
          if (element.matches(".rich-paragraph-block, h1, h2, h3, h4, h5, h6")) {
            const frame = element.getBoundingClientRect(), selected = path.getBoundingClientRect(), column = field.getBoundingClientRect();
            for (const edge of ["left", "right"] as const) {
              expect(frame[edge]).toBeCloseTo(column[edge], 1);
              expect(selected[edge]).toBeCloseTo(frame[edge], 1);
            }
            const text = richBlockBody(element);
            const style = getComputedStyle(text);
            expect(style.padding).toBe("2px");
            const gripBox = grip.getBoundingClientRect();
            expect(gripBox.top + gripBox.height / 2).toBeCloseTo(text.getBoundingClientRect().top + parseFloat(style.paddingTop) + parseFloat(style.lineHeight) / 2, 1);
          }
        });
        if (width >= 768 && element.matches(".rich-foldable-heading")) {
          await waitFor(() => {
            const fold = element.querySelector<HTMLElement>(".rich-heading-fold");
            expect(fold).not.toBeNull();
            expect(grip.getBoundingClientRect().left - fold!.getBoundingClientRect().right).toBeCloseTo(2, 1);
            expect(getComputedStyle(fold!).color).toBe(getComputedStyle(grip).color);
          });
        }
      }
      if (width >= 768) {
        for (const selection of [new AllSelection(original), BlockRangeSelection.between(original, 0, original.content.size)]) {
          editor.view.dispatch(editor.state.tr.setSelection(selection));
          for (const text of ["第一项：检查列表标记与文字的距离", "第二级第一项", "第一步：收集信息", "嵌套步骤一", "未完成任务", "已完成的子任务"]) {
            const item = within(field).getByText(text, { exact: true });
            const frame = item.closest(".rich-selected-block")!;
            expect(frame.parentElement).toBe(field);
            await userEvent.hover(item);
            const bounds = frame.getBoundingClientRect(), control = grip.getBoundingClientRect();
            expect(bounds.left - control.right, `${text} gap`).toBeCloseTo(2, 1);
            const line = item.getBoundingClientRect().top + parseFloat(getComputedStyle(item).lineHeight) / 2;
            expect(control.top + control.height / 2, `${text} first line`).toBeCloseTo(line, 0);
          }
          for (const alt of ["单张带说明的图片", "并排左图", "并排右图"]) {
            const image = getByAltText(alt), frame = image.closest(".rich-image-row")!;
            await userEvent.hover(image);
            const bounds = frame.getBoundingClientRect(), control = grip.getBoundingClientRect();
            expect(bounds.left - control.right, `${alt} gap`).toBeCloseTo(2, 1);
            expect(control.top - bounds.top, `${alt} top inset`).toBeCloseTo(8, 1);
          }
        }
      }
      expect(editor.state.doc.eq(original)).toBe(true);
    } finally { restoreAssets(); }
  });
}

const adjacentBlocks = "start\n\n- first\n- second\n\n1. ordered\n2. next\n\n- [ ] task\n- [x] done\n\n> quote\n\n<aside data-callout=\"gray\"><p>callout</p></aside>\n\n```txt\ncode\n```\n\n| A | B |\n| --- | --- |\n| a | b |\n\n---\n\nend";

for (const size of ["14", "16"]) test(`list markers share the checkbox column and first-line center at ${size}px`, async () => {
  await page.viewport(390, 900);
  document.documentElement.style.fontSize = "20px";
  typography(size);
  const long = "wrapped bullet ".repeat(12).trim();
  const { field } = await editorFixture(`- ${long}\n  - nested bullet\n\n9. ordered\n   1. nested ordered\n10. next\n\n- [ ] task\n  - [x] nested task`);
  const lists = within(field);
  const bullet = lists.getByText(long);
  expect(bullet.getBoundingClientRect().height).toBeGreaterThan(parseFloat(getComputedStyle(bullet).lineHeight));
  expect(field.querySelector("ol")?.start).toBe(9);
  for (const [task, ...markers] of [["task", long, "ordered", "next"], ["nested task", "nested bullet", "nested ordered"]]) {
    const taskText = lists.getByText(task, { exact: true });
    const checkbox = taskText.closest("li")!.querySelector("input")!.getBoundingClientRect();
    expect(checkbox.top + checkbox.height / 2).toBeCloseTo(taskText.getBoundingClientRect().top + parseFloat(getComputedStyle(taskText).lineHeight) / 2, 1);
    for (const label of markers) {
      const text = lists.getByText(label, { exact: true });
      const item = text.closest("li")!;
      const box = item.getBoundingClientRect(), marker = getComputedStyle(item, "::before");
      expect(box.left + parseFloat(marker.left) + parseFloat(marker.width) / 2, label).toBeCloseTo(checkbox.left + checkbox.width / 2, 1);
      expect(box.top + parseFloat(marker.top), label).toBeCloseTo(text.getBoundingClientRect().top + parseFloat(getComputedStyle(text).lineHeight) / 2, 1);
    }
  }
});

for (const rootSize of [16, 20]) for (const size of ["14", "16"]) for (const flow of ["16px", "1em", "1.25em", "2em"]) for (const width of [390, 1024]) {
  test(`adjacent blocks and list items share visible gaps: root ${rootSize}, size ${size}, flow ${flow}, width ${width}`, async () => {
    await page.viewport(width, 900);
    document.documentElement.style.fontSize = `${rootSize}px`;
    typography(size, flow);
    const reading = render(<NoteMarkdown body={adjacentBlocks} />);
    const { field, editor } = await editorFixture(adjacentBlocks);
    const original = editor.state.doc;
    const reader = reading.container.querySelector<HTMLElement>(".ui-note-markdown")!;
    const readBlocks = Array.from(reader.children) as HTMLElement[], editBlocks = Array.from(field.children) as HTMLElement[];
    const gap = flow === "16px" ? 16 : relativeGaps[size][flow] * rootSize / 16;
    expect(editBlocks).toHaveLength(readBlocks.length);
    for (let i = 1; i < editBlocks.length; i++) {
      const label = `${editBlocks[i - 1].tagName} → ${editBlocks[i].tagName}`;
      const listTransition = readBlocks[i - 1].matches("ul, ol") && readBlocks[i].matches("ul, ol");
      const expectedGap = size === "14" && listTransition ? rootSize / 2 : gap;
      expect(visibleBlock(readBlocks[i]).top - visibleBlock(readBlocks[i - 1]).bottom, `reading ${label}`).toBeCloseTo(expectedGap, 1);
      expect(editBlocks[i].getBoundingClientRect().top - editBlocks[i - 1].getBoundingClientRect().bottom, `editing ${label}`).toBeCloseTo(flow === "16px" ? rootSize / 4 : gap, 1);
    }
    for (const root of [reader, field]) for (const list of root.querySelectorAll<HTMLElement>(":scope > :is(ul, ol), :scope > .rich-block-frame > :is(ul, ol)")) {
      const [a, b] = Array.from(list.children) as HTMLElement[];
      const gap = b.getBoundingClientRect().top + parseFloat(getComputedStyle(b).paddingTop) - (a.getBoundingClientRect().bottom - parseFloat(getComputedStyle(a).paddingBottom));
      expect(gap).toBeCloseTo(6, 1);
    }
    for (const item of field.querySelectorAll("li")) expect(getComputedStyle(item).padding).toBe(`${rootSize / 8}px`);
    for (const block of editBlocks) {
      expect(getComputedStyle(block).paddingInline).toBe(`${rootSize * 3 / 8}px`);
      expect(getComputedStyle(block).margin).toBe("0px");
    }
    expect(editor.state.doc.eq(original)).toBe(true);
  });
}

for (const size of ["14", "16"]) for (const width of [390, 1024]) for (const multi of [false, true]) {
  test(`native list drag preserves content and undo: size ${size}, width ${width}, multi ${multi}`, async () => {
    await page.viewport(width, 900);
    typography(size, "1em");
    const { field, editor } = await editorFixture("- bullet\n\n1. ordered\n\n- [ ] task\n\n| A | B |\n| --- | --- |\n| a | b |\n\ndestination");
    const original = editor.state.doc, count = multi ? 2 : 1;
    const nodes = Array.from({ length: original.childCount }, (_, index) => original.child(index));
    const end = nodes.slice(0, count).reduce((sum, node) => sum + node.nodeSize, 0);
    if (multi) editor.view.dispatch(editor.state.tr.setSelection(BlockRangeSelection.between(original, 0, end)));
    else editor.commands.setNodeSelection(0);
    const target = Array.from(field.children).at(-1) as HTMLElement;
    await userEvent.dragAndDrop(page.getByRole("button", { name: "内容块操作" }), target, { targetPosition: { x: 20, y: target.getBoundingClientRect().height - 3 } });
    await waitFor(() => expect(editor.state.doc.eq(original)).toBe(false));
    expect(editor.state.doc.toJSON().content).toEqual([...nodes.slice(count), ...nodes.slice(0, count)].map(node => node.toJSON()));
    editor.commands.undo();
    expect(editor.state.doc.eq(original)).toBe(true);
  });
}

for (const size of ["14", "16"]) for (const width of [390, 1024]) {
  test(`iconless callout has one gutter control and retains icon editing: size ${size}, width ${width}`, async () => {
    await page.viewport(width, 900);
    typography(size);
    const { field, editor, queryByRole, findByRole } = await editorFixture('<aside data-callout="gray"><p><strong>无图标提示块</strong></p><p>提示正文</p></aside>\n\ndestination');
    const original = editor.state.doc, callout = field.querySelector<HTMLElement>("aside")!;
    const before = { padding: getComputedStyle(callout).padding, width: callout.getBoundingClientRect().width, height: callout.getBoundingClientRect().height };
    await userEvent.hover(callout);
    expect(queryByRole("button", { name: "添加标注图标" })).toBeNull();
    const grip = page.getByRole("button", { name: "内容块操作" });
    await userEvent.click(grip);
    const item = page.getByRole("menuitem", { name: "编辑图标" });
    await userEvent.click(item);
    const input = await findByRole("textbox", { name: "搜索 Emoji" });
    await waitFor(() => expect(document.activeElement).toBe(input));
    const popup = await findByRole("dialog", { name: "编辑标注图标" });
    const section = popup.querySelector<HTMLElement>(".ui-sidebar-emoji-picker")!;
    expect(getComputedStyle(section).borderTopWidth).toBe("0px");
    expect(getComputedStyle(section).paddingTop).toBe("0px");
    if (width >= 768) {
      expect(getComputedStyle(popup).padding).toBe("12px");
      expect(getComputedStyle(popup).borderRadius).toBe("12px");
      document.documentElement.style.setProperty("--radius-element", "4px");
      await waitFor(() => expect(getComputedStyle(popup).borderRadius).toBe("6px"));
      document.documentElement.style.removeProperty("--radius-element");
      await waitFor(() => expect(getComputedStyle(popup).borderRadius).toBe("12px"));
    }
    const picker = popup.getBoundingClientRect();
    expect(picker.width).toBeGreaterThan(0);
    expect(picker.left).toBeGreaterThanOrEqual(0);
    expect(picker.right).toBeLessThanOrEqual(width);
    await userEvent.fill(input, "🧭");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(callout.getAttribute("data-callout-icon")).toBe("🧭"));
    const icon = await findByRole("button", { name: "更改标注图标" });
    const iconRect = icon.getBoundingClientRect(), gripRect = field.closest(".rich-editor")!.querySelector(".block-controls button")!.getBoundingClientRect();
    expect(Math.min(iconRect.right, gripRect.right) - Math.max(iconRect.left, gripRect.left)).toBeLessThanOrEqual(0);
    await userEvent.click(icon);
    await findByRole("textbox", { name: "搜索 Emoji" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(queryByRole("dialog", { name: "编辑标注图标" })).toBeNull());
    editor.commands.undo();
    expect(editor.state.doc.eq(original)).toBe(true);
    expect(queryByRole("button", { name: "添加标注图标" })).toBeNull();
    expect({ padding: getComputedStyle(callout).padding, width: callout.getBoundingClientRect().width, height: callout.getBoundingClientRect().height }).toEqual(before);
    const target = Array.from(field.children).at(-1) as HTMLElement;
    await userEvent.dragAndDrop(grip, target, { targetPosition: { x: 20, y: target.getBoundingClientRect().height - 3 } });
    await waitFor(() => expect(editor.state.doc.eq(original)).toBe(false));
    expect(editor.state.doc.lastChild!.type.name).toBe("aside");
    editor.commands.undo();
    expect(editor.state.doc.eq(original)).toBe(true);
  });
}
