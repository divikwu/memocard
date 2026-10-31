import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createPortal } from "react-dom";
import { page, userEvent } from "vitest/browser";
import type { Editor } from "@tiptap/react";
import { BlockRangeSelection } from "../src/rich-block-selection";
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

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-web-typography");
  document.documentElement.removeAttribute("data-ui-input-modality");
});

function typography(size: string, flow = "16px", leading = "1.5") {
  for (const [key, value] of Object.entries(resolveTypography({ ...defaults, size, flow, leading }))) document.documentElement.style.setProperty(key, value);
}

async function editorFixture(body: string) {
  const view = render(<div className="ui-note-editor" style={{ padding: 32 }}><RichMarkdownEditor value={body} notePath="notes/rhythm.md" disabled={false} autoFocus={false} onChange={vi.fn()} onSave={vi.fn()} onError={vi.fn()} /></div>);
  const field = await view.findByRole("textbox", { name: "笔记内容" });
  return { ...view, field, editor: (field as HTMLElement & { editor: Editor }).editor };
}

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

test("editor keyboard exit hint fits below the content on narrow screens", async () => {
  typography("16");
  for (const width of [320, 390, 1024]) {
    await page.viewport(width, 900);
    const { field, container, unmount } = await editorFixture("Plain text");
    await userEvent.click(field);
    const hint = container.querySelector<HTMLElement>(".rich-keyboard-hint")!;
    expect(getComputedStyle(hint).opacity).toBe("1");
    expect(hint.getBoundingClientRect().top).toBeGreaterThanOrEqual(field.getBoundingClientRect().bottom);
    expect(hint.getBoundingClientRect().right).toBeLessThanOrEqual(width);
    expect(hint.scrollHeight).toBeLessThanOrEqual(hint.clientHeight + 1);
    unmount();
  }
});

for (const size of ["14", "16"]) test(`heading fold stays visible across the gutter and block grip at ${size}px`, async () => {
  await page.viewport(1024, 900);
  typography(size);
  const { container, field, editor, findByRole } = await editorFixture("## Heading\n\nSection body\n\n## Next\n\nOther body");
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
    const visibleBottom = a.getBoundingClientRect().bottom - parseFloat(getComputedStyle(a).paddingBottom);
    const visibleTop = b.getBoundingClientRect().top + parseFloat(getComputedStyle(b).paddingTop);
    expect(visibleTop - visibleBottom).toBeCloseTo(36, 1);
    expect(editor.state.doc.eq(original)).toBe(true);
    fireEvent.click(await findByRole("button", { name: "展开“A”章节" }));
    await waitFor(() => expect(field.querySelector(".rich-folded-content")).toBeNull());
    expect(editor.state.doc.eq(original)).toBe(true);
  });
}

test("saved relative paragraph spacing follows root font size in reading and editing", async () => {
  for (const rootSize of [16, 20]) for (const size of ["14", "16"]) for (const [flow, factor] of [["1em", 1], ["1.25em", 1.25], ["2em", 2]] as const) {
    document.documentElement.style.fontSize = `${rootSize}px`;
    typography(size, flow);
    const reader = render(<NoteMarkdown body={"first\n\nsecond\n\n# Heading\n\nafter"} />);
    const { field, unmount, editor } = await editorFixture("first\n\nsecond\n\n# Heading\n\nafter");
    const original = editor.state.doc;
    const bodySize = rootSize * Number(size) / 16;
    for (const [root, editing] of [[reader.container.querySelector(".ui-note-markdown")!, false], [field, true]] as const) {
      const [a, b, after] = Array.from(root.querySelectorAll("p"));
      const inset = editing ? parseFloat(getComputedStyle(a).paddingBottom) + parseFloat(getComputedStyle(b).paddingTop) : 0;
      expect(parseFloat(getComputedStyle(a).fontSize)).toBe(bodySize);
      expect(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom + inset).toBeCloseTo(bodySize * factor, 1);
      expect(after.getBoundingClientRect().top - root.querySelector("h1")!.getBoundingClientRect().bottom + inset).toBeCloseTo(bodySize * factor, 1);
      if (editing) expect(getComputedStyle(a).paddingBlock).toBe(`${rootSize * 6 / 16}px`);
    }
    expect(editor.state.doc.eq(original)).toBe(true);
    unmount(); reader.unmount();
  }
});

for (const size of ["14", "16"]) for (const rootSize of [16, 20]) {
  test(`even note type metrics retain root scaling: size ${size}, root ${rootSize}`, async () => {
    document.documentElement.style.fontSize = `${rootSize}px`;
    const source = '# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6\n\nbody\n\n<aside data-callout="gray" data-callout-icon="💡"><p>callout</p></aside>\n\n```txt\ncode\n```\n\n| A | B |\n| --- | --- |\n| a | b |\n\n<figure><figcaption>caption</figcaption></figure>\n\n[^x]: footnote';
    const reading = render(<NoteMarkdown body={source} />);
    const { field, editor } = await editorFixture(source);
    const original = editor.state.doc;
    const reader = reading.container.querySelector<HTMLElement>(".ui-note-markdown")!;
    const scale = rootSize / 16;
    const headings = size === "14" ? [[26, 34], [22, 28], [18, 24]] : [[30, 40], [24, 32], [20, 26]];
    const lines = size === "14" ? [22, 24, 26, 28] : [24, 26, 28, 30];
    for (const [index, leading] of ["1.5", "1.6", "1.75", "1.9"].entries()) {
      typography(size, "16px", leading);
      for (const [root, editing] of [[reader, false], [field, true]] as const) {
        expect(parseFloat(getComputedStyle(root).fontSize)).toBe(Number(size) * scale);
        expect(parseFloat(getComputedStyle(root).lineHeight)).toBeCloseTo(lines[index] * scale, 3);
        for (let level = 1; level <= 6; level++) {
          const style = getComputedStyle(root.querySelector(`h${level}`)!);
          const metrics = level <= 3 ? headings[level - 1] : [Number(size), lines[index]];
          expect(parseFloat(style.fontSize)).toBe(metrics[0] * scale);
          expect(parseFloat(style.lineHeight)).toBeCloseTo(metrics[1] * scale, 3);
        }
        const code = getComputedStyle(root.querySelector("pre")!), table = getComputedStyle(root.querySelector("table")!);
        expect(parseFloat(code.fontSize)).toBe(14 * scale);
        expect(parseFloat(code.lineHeight)).toBe(20 * scale);
        expect(parseFloat(table.fontSize)).toBe((editing ? 14 : 16) * scale);
        expect(parseFloat(table.lineHeight)).toBe((editing ? 22 : 24) * scale);
        expect(parseFloat(getComputedStyle(root.querySelector("figcaption")!).lineHeight)).toBe(20 * scale);
      }
      const icon = field.querySelector<HTMLElement>(".rich-callout-icon")!, text = field.querySelector<HTMLElement>(".rich-callout-content > p")!;
      const a = icon.getBoundingClientRect(), b = text.getBoundingClientRect();
      expect(a.top + a.height / 2).toBeCloseTo(b.top + b.height / 2, 1);
      expect(editor.state.doc.eq(original)).toBe(true);
    }
  });
}

function visibleBlock(block: HTMLElement) {
  if (block.matches("ul,ol")) {
    const items = block.querySelectorAll<HTMLElement>(":scope > li");
    const first = items[0], last = items[items.length - 1];
    return { top: first.getBoundingClientRect().top + parseFloat(getComputedStyle(first).paddingTop), bottom: last.getBoundingClientRect().bottom - parseFloat(getComputedStyle(last).paddingBottom) };
  }
  const target = block.querySelector<HTMLElement>("table, pre") ?? block;
  const rect = target.getBoundingClientRect(), style = getComputedStyle(target);
  return { top: rect.top + (target.matches("p") ? parseFloat(style.paddingTop) : 0), bottom: rect.bottom - (target.matches("p") ? parseFloat(style.paddingBottom) : 0) };
}

for (const size of ["14", "16"]) for (const width of [390, 1024]) {
  test(`block controls share the selected frame gap: size ${size}, width ${width}`, async () => {
    await page.viewport(width, 900);
    typography(size);
    const canvas = document.createElement("canvas");
    canvas.width = 2; canvas.height = 1;
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
    const restoreAssets = setStorybookBrowserAssets({ "assets/spacing-wide.png": png, "assets/spacing-detail.png": png });
    try {
      const { field, editor, container } = await editorFixture(blockSpacingBody);
      // Keep a previous test's pointer from retargeting the grip while this test scrolls.
      await userEvent.hover(container, { position: { x: 1, y: 1 } });
      await waitFor(() => expect(field.querySelectorAll("table")).toHaveLength(5));
      for (const image of field.querySelectorAll<HTMLImageElement>("img")) await waitFor(() => expect(image.complete && image.naturalWidth > 0).toBe(true));
      const original = editor.state.doc, seen = new Set<string>(), positions: number[] = [];
      original.descendants((node, pos) => {
        if (!node.isBlock || node.type.name === "paragraph" && original.resolve(pos).depth !== 0 || ["tableRow", "tableHeader", "tableCell"].includes(node.type.name)) return;
        const key = `${node.type.name}:${node.type.name === "heading" ? node.attrs.level : original.resolve(pos).depth}`;
        if (!seen.has(key)) { seen.add(key); positions.push(pos); }
      });
      expect(positions.length).toBeGreaterThan(25);
      const root = field.closest<HTMLElement>(".rich-editor")!, grip = root.querySelector<HTMLElement>(".block-controls button")!;
      for (const pos of positions) {
        const element = editor.view.nodeDOM(pos) as HTMLElement;
        element.scrollIntoView({ block: "center" });
        editor.commands.setNodeSelection(pos);
        await waitFor(() => {
          const path = root.querySelector<SVGPathElement>(".rich-block-highlights > path")!;
          expect(path).not.toBeNull();
          expect(root.getBoundingClientRect().left + path.getBBox().x - grip.getBoundingClientRect().right, `${original.nodeAt(pos)!.type.name} gap`).toBeCloseTo(2, 1);
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
      expect(editor.state.doc.eq(original)).toBe(true);
    } finally { restoreAssets(); }
  });
}

const adjacentBlocks = "start\n\n- first\n- second\n\n1. ordered\n2. next\n\n- [ ] task\n- [x] done\n\n> quote\n\n<aside data-callout=\"gray\"><p>callout</p></aside>\n\n```txt\ncode\n```\n\n| A | B |\n| --- | --- |\n| a | b |\n\n---\n\nend";

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
    const gap = flow === "16px" ? 16 : parseFloat(flow) * Number(size) * rootSize / 16;
    expect(editBlocks).toHaveLength(readBlocks.length);
    for (let i = 1; i < editBlocks.length; i++) {
      const label = `${editBlocks[i - 1].tagName} → ${editBlocks[i].tagName}`;
      expect(visibleBlock(readBlocks[i]).top - visibleBlock(readBlocks[i - 1]).bottom, `reading ${label}`).toBeCloseTo(gap, 1);
      expect(visibleBlock(editBlocks[i]).top - visibleBlock(editBlocks[i - 1]).bottom, `editing ${label}`).toBeCloseTo(gap, 1);
    }
    for (const root of [reader, field]) for (const list of root.querySelectorAll<HTMLElement>(":scope > ul, :scope > ol")) {
      const [a, b] = Array.from(list.children) as HTMLElement[];
      const gap = b.getBoundingClientRect().top + parseFloat(getComputedStyle(b).paddingTop) - (a.getBoundingClientRect().bottom - parseFloat(getComputedStyle(a).paddingBottom));
      expect(gap).toBeCloseTo(6, 1);
    }
    for (const item of field.querySelectorAll("li")) expect(getComputedStyle(item).paddingBlock).toBe(`${rootSize / 8}px`);
    for (const list of field.querySelectorAll(":scope > ul, :scope > ol")) expect(getComputedStyle(list).paddingBlock).toBe(`${rootSize * 6 / 16}px`);
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
      expect(getComputedStyle(popup).borderRadius).toBe("20px");
      document.documentElement.style.setProperty("--radius-element", "4px");
      await waitFor(() => expect(getComputedStyle(popup).borderRadius).toBe("10px"));
      document.documentElement.style.removeProperty("--radius-element");
      await waitFor(() => expect(getComputedStyle(popup).borderRadius).toBe("20px"));
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
