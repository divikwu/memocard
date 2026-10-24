import { afterEach, expect, test, vi } from "vitest";
import { userEvent as browserUser } from "vitest/browser";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { composeStories, setProjectAnnotations, type ReactRenderer } from "@storybook/react-vite";
import { useOf, type StoryProps } from "@storybook/addon-docs/blocks";
import { DocsContext, StoryStore, mockChannel } from "storybook/preview-api";
import { GLOBALS_UPDATED } from "storybook/internal/core-events";
import type { GlobalsUpdatedPayload } from "storybook/internal/types";
import { userEvent } from "storybook/test";
import { ButtonStoryFrame as StoryFrame } from "../.storybook/button-docs.fixture";
import { componentDocsRenderer } from "../.storybook/component-docs-renderer";
import { ComponentDocsExample, ComponentDocsProperties } from "../.storybook/component-docs-template";
import { Button } from "../src/components/ui/button";
import preview, { StorybookTheme } from "../.storybook/preview";
import * as templateStories from "./component-docs-template.stories";
import { colorPixel, contrastRatio } from "./foundation-color-contrast";

const projectAnnotations = setProjectAnnotations({});
const { Example } = composeStories(templateStories);

// Use the real Docs page and its story; only substitute iframe loading with
// the existing isolated browser fixture, as in the Button Docs regressions.
function FixtureStory({ of, height }: StoryProps) {
  const { story } = useOf(of ?? "story", ["story"]);
  return <StoryFrame title={story.name} layout={story.parameters.layout} height={height} autoHeight centered><Example /></StoryFrame>;
}

async function renderTemplateDocs(element: HTMLElement) {
  const importPath = "./stories/component-docs-template.stories.tsx";
  const entries = { [Example.id]: { id: Example.id, title: templateStories.default.title, name: Example.storyName, type: "story" as const, subtype: "story" as const, importPath } };
  const store = new StoryStore<ReactRenderer>({ v: 5, entries }, async () => templateStories, projectAnnotations);
  const csf = store.processCSFFileWithCache(templateStories, importPath, templateStories.default.title);
  const channel = mockChannel();
  const context = new DocsContext(channel, store, () => { throw new Error("The fixture must not load Storybook iframes."); }, [csf]);
  context.attachCSFFile(csf);
  const renderer = await componentDocsRenderer();
  const parameters = { ...templateStories.default.parameters.docs, container: preview.parameters!.docs.container, components: { Story: FixtureStory } };
  await act(async () => { await renderer.render(context, parameters, element); await vi.dynamicImportSettled(); });
  return {
    unmount: () => act(() => renderer.unmount(element)),
    updateGlobals: (theme: string) => act(() => channel.emit(GLOBALS_UPDATED, { globals: { theme }, userGlobals: { theme }, storyGlobals: {}, initialGlobals: {} } satisfies GlobalsUpdatedPayload)),
    rerender: () => act(async () => { await renderer.render(context, parameters, element); }),
  };
}

let container: HTMLElement;
let unmountDocs: (() => void) | undefined;
afterEach(() => { unmountDocs?.(); unmountDocs = undefined; cleanup(); container?.remove(); });

test.each(["light", "dark"])("preview headers reserve space for absolute code buttons and wrap long titles in %s", async theme => {
  expect([320, 390]).toContain(window.innerWidth);
  const title = "ComponentDocumentationPreviewWithAnExtremelyLongUnbrokenEnglishTitle — 中英文预览标题";
  const reset = vi.fn();
  const rendered = render(<StorybookTheme globals={{ theme, palette: "mono", radius: "lg" }}><div className="component-docs">
    <ComponentDocsExample title={title} story="components-button--default" code={'<Button>保存</Button>'} description="操作说明"><Button>保存</Button></ComponentDocsExample>
    <ComponentDocsProperties name={title} preview={<Button>预览操作</Button>} code={'<Button>预览操作</Button>'} parameters={[]} onReset={reset} />
  </div></StorybookTheme>);
  await act(async () => { await document.fonts.ready; await vi.dynamicImportSettled(); });
  const cards = rendered.container.querySelectorAll<HTMLElement>(".component-docs-example, .component-docs-properties-preview");
  expect(cards).toHaveLength(2);
  for (const card of cards) {
    const header = card.querySelector<HTMLElement>(".component-docs-preview-header")!;
    expect(header).not.toBeNull();
    const label = header.querySelector<HTMLElement>(".component-docs-preview-title")!;
    const toggle = within(header).getByRole("button", { name: "切换预览与代码" });
    const bounds = header.getBoundingClientRect();
    const text = label.getBoundingClientRect();
    const action = toggle.getBoundingClientRect();
    expect(getComputedStyle(header).position).toBe("relative");
    expect(getComputedStyle(label).position).toBe("static");
    expect(getComputedStyle(label).fontFamily).toBe(getComputedStyle(toggle).fontFamily);
    expect(getComputedStyle(label).fontSize).toBe("14px");
    expect(getComputedStyle(toggle).position).toBe("absolute");
    expect(action.top - bounds.top).toBe(8);
    expect(bounds.right - action.right).toBe(8);
    expect(action.left - text.right).toBeGreaterThanOrEqual(16);
    expect(text.height).toBeGreaterThan(parseFloat(getComputedStyle(label).lineHeight));
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 1);
    expect(text.bottom).toBeLessThanOrEqual(bounds.bottom);
    expect(header.nextElementSibling!.getBoundingClientRect().top).toBeGreaterThanOrEqual(bounds.bottom);
    expect(toggle).toHaveAttribute("data-variant", "ghost");
    expect(toggle).toHaveAttribute("data-size", "icon-sm");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    const code = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(code).toBeVisible();
    expect(code.querySelector("pre")).toHaveTextContent("<Button>");
    expect(within(code).getByRole("button", { name: "Copy" })).toBeVisible();
    if (card.matches(".component-docs-example")) {
      expect(within(card).getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
      await userEvent.click(within(card).getByRole("tab", { name: "描述" }));
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      await waitFor(() => expect(code).not.toBeVisible());
      expect(within(card).getByRole("button", { name: "保存" })).toBeVisible();
    } else {
      expect(within(card).queryByRole("button", { name: "预览操作" })).not.toBeInTheDocument();
      await userEvent.click(toggle);
    }
    await browserUser.click(toggle);
    await browserUser.keyboard("{Enter}");
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
  }
  await userEvent.click(within(rendered.container).getByRole("button", { name: "Reset" }));
  expect(reset).toHaveBeenCalledOnce();
});

test.each(["light", "dark"])("long English titles fit all template tabs with system fonts and section spacing in %s", async theme => {
  const width = window.innerWidth;
  expect([320, 390]).toContain(width);
  container = document.createElement("main");
  document.body.append(container);
  const rendered = await renderTemplateDocs(container);
  unmountDocs = rendered.unmount;
  rendered.updateGlobals(theme);
  const docs = within(container);
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  await document.fonts.ready;
  const panel = docs.getByRole("tabpanel", { name: "Properties" });
  const input = docs.getByRole("textbox", { name: "文档标题（name）" });
  const reset = docs.getByRole("button", { name: "恢复默认标题" });
  const bodyFont = getComputedStyle(container.querySelector("p")!).fontFamily;
  const tabs = container.querySelector(".component-docs-tab-list")!;
  expect(getComputedStyle(tabs).columnGap).toBe("12px");
  expect(getComputedStyle(tabs).rowGap).toBe("4px");
  expect(getComputedStyle(tabs).padding).toBe("3px");
  expect(getComputedStyle(tabs).height).toBe("32px");
  for (const tab of within(tabs as HTMLElement).getAllByRole("tab")) {
    expect(getComputedStyle(tab).fontWeight).toBe("500");
    expect(getComputedStyle(tab).paddingInlineStart).toBe("2px");
    expect(getComputedStyle(tab).paddingInlineEnd).toBe("2px");
    expect(getComputedStyle(tab).paddingBlockStart).toBe("2px");
  }
  for (const control of panel.querySelectorAll("label, input, button")) {
    if (control.getBoundingClientRect().width === 0) continue;
    expect.soft(getComputedStyle(control).fontFamily).toBe(bodyFont);
  }
  const parametersHeading = docs.getByRole("heading", { name: "模板参数" });
  const summary = panel.querySelector(".component-docs-properties-summary")!;
  expect.soft(parametersHeading.getBoundingClientRect().top - summary.getBoundingClientRect().bottom).toBe(40);
  expect(getComputedStyle(docs.getByRole("heading", { name: "参数演示" })).marginTop).toBe("0px");

  const longTitle = "ComponentDocumentationTemplate";
  await userEvent.clear(input);
  await userEvent.type(input, longTitle);
  await document.fonts.ready;
  const title = docs.getByRole("heading", { name: longTitle, level: 1 });
  const expectPageFits = () => {
    expect.soft(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
    expect.soft(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1);
    expect.soft(title.getBoundingClientRect().height).toBeGreaterThan(parseFloat(getComputedStyle(title).lineHeight));
    expect(title).toHaveTextContent(longTitle);
  };
  expectPageFits();
  for (const name of ["Overview", "Accessibility", "Properties"]) {
    await userEvent.click(docs.getByRole("tab", { name }));
    await waitFor(() => expect(docs.getByRole("tabpanel", { name })).toBeVisible());
    expectPageFits();
    if (name === "Overview") {
      const practices = docs.getByRole("table", { name: "最佳实践" });
      expect(within(practices).getAllByRole("rowheader", { name: "推荐" })).toHaveLength(3);
      expect(within(practices).getAllByRole("rowheader", { name: "避免" })).toHaveLength(2);
      const wrapper = practices.parentElement!;
      const heading = docs.getByRole("heading", { name: "最佳实践" });
      expect(getComputedStyle(heading).marginTop).toBe("40px");
      expect(wrapper.getBoundingClientRect().top - heading.getBoundingClientRect().bottom).toBe(16);
      expect(docs.getByRole("heading", { name: "接入模板" }).getBoundingClientRect().top - wrapper.getBoundingClientRect().bottom).toBe(40);
      expect(wrapper.scrollWidth).toBeLessThanOrEqual(wrapper.clientWidth + 1);
      expect(getComputedStyle(wrapper).borderTopWidth).toBe("1px");
      expect(getComputedStyle(wrapper).borderRadius).toBe(getComputedStyle(container.querySelector(".component-docs-example")!).borderRadius);
      expect(getComputedStyle(practices).color).toBe(getComputedStyle(title).color);
      for (const cell of practices.querySelectorAll("td")) {
        expect(getComputedStyle(cell).fontSize).toBe("14px");
        expect(getComputedStyle(cell).fontFamily).toBe(bodyFont);
        expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth + 1);
      }
      const code = within(practices).getByText("ComponentDocumentationBestPractices", { selector: "code" });
      expect(getComputedStyle(code).fontSize).toBe("14px");
      expect(code.getClientRects().length).toBeGreaterThan(1);
      for (const badge of practices.querySelectorAll('[data-slot="badge"]')) {
        expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(badge.closest("th")!.getBoundingClientRect().right);
        expect(getComputedStyle(badge).fontSize).toBe("12px");
      }
    }
    if (name === "Accessibility") {
      expect(getComputedStyle(docs.getByRole("heading", { name: "模板交互约定" })).marginTop).toBe("0px");
      expect(getComputedStyle(docs.getByRole("heading", { name: "填写组件说明" })).marginTop).toBe("40px");
    }
  }
  rendered.updateGlobals(theme === "light" ? "dark" : "light");
  await rendered.rerender();
  expect(docs.getByRole("tab", { name: "Properties" })).toHaveAttribute("aria-selected", "true");
  expect(input).toHaveValue(longTitle);
  expectPageFits();
  await userEvent.click(reset);
  expect(input).toHaveValue("通用组件文档模板");
  expect(docs.getByRole("heading", { name: "通用组件文档模板", level: 1 })).toBeVisible();
});

test.each(["light", "dark"])("shared template Properties preserve editing, code, reset and state on the narrow %s page", async theme => {
  const width = window.innerWidth;
  expect([320, 390]).toContain(width);
  container = document.createElement("main");
  document.body.append(container);
  const rendered = await renderTemplateDocs(container);
  unmountDocs = rendered.unmount;
  rendered.updateGlobals(theme);
  const docs = within(container);
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  const panel = docs.getByRole("tabpanel", { name: "Properties" });
  const module = within(panel).getByRole("region", { name: "ComponentDocsTemplate 参数演示" });
  expect(module.querySelector(".component-docs-preview-title")).toHaveTextContent("ComponentDocsTemplate");
  const controls = within(module);
  const input = controls.getByRole("textbox", { name: "文档标题（name）" });
  const value = 'Template "标题" <状态>';
  await userEvent.clear(input);
  await userEvent.type(input, value);
  const toggle = controls.getByRole("button", { name: "切换预览与代码" });
  await userEvent.click(toggle);
  const code = controls.getByRole("region", { name: "ComponentDocsTemplate 代码" }).querySelector("pre")!;
  expect(code).toHaveTextContent(`name={${JSON.stringify(value)}}`);
  expect(input).not.toBeVisible();
  expect(controls.queryByRole("textbox")).not.toBeInTheDocument();
  expect(controls.getAllByRole("row")).toHaveLength(5);
  const table = controls.getByRole("region", { name: "ComponentDocsTemplate 参数表" });
  expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
  expect(table.getBoundingClientRect().right).toBeLessThanOrEqual(width);
  const preview = module.querySelector(".component-docs-properties-preview")!;
  const source = code.closest(".component-docs-source")!;
  expect(getComputedStyle(source).borderTopWidth).toBe("0px");
  expect(getComputedStyle(source).borderRadius).toBe("0px");
  expect(getComputedStyle(table).borderTopWidth).toBe("1px");
  expect(getComputedStyle(table).borderRadius).toBe(getComputedStyle(preview).borderRadius);
  expect(getComputedStyle(table).borderTopColor).toBe(getComputedStyle(preview).borderTopColor);
  expect(module.querySelector(".component-docs-properties-caption")!.getBoundingClientRect().bottom).toBeLessThanOrEqual(table.getBoundingClientRect().top);
  expect(panel.querySelectorAll(".component-docs-properties")).toHaveLength(1);
  await userEvent.click(docs.getByRole("tab", { name: "Overview" }));
  expect(module).not.toBeVisible();
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  rendered.updateGlobals(theme === "light" ? "dark" : "light");
  await rendered.rerender();
  expect(within(docs.getByRole("tabpanel", { name: "Properties" })).getByRole("region", { name: "ComponentDocsTemplate 参数演示" })).toBe(module);
  expect(input).toHaveValue(value);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(code).toHaveTextContent(`name={${JSON.stringify(value)}}`);
  await userEvent.click(controls.getByRole("button", { name: "恢复默认标题" }));
  expect(input).toHaveValue("通用组件文档模板");
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(code).toHaveTextContent('name={"通用组件文档模板"}');
  await userEvent.click(toggle);
  expect(input).toBeVisible();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
});

test.each(["light", "dark"])("template title presets use Select and stay in sync across tabs, themes and reset in %s", async theme => {
  container = document.createElement("main");
  document.body.append(container);
  const rendered = await renderTemplateDocs(container);
  unmountDocs = rendered.unmount;
  rendered.updateGlobals(theme);
  const docs = within(container);
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  const select = docs.getByRole("combobox", { name: /^name$/ });
  const input = docs.getByRole("textbox", { name: "文档标题（name）" });
  expect(select.getBoundingClientRect().width).toBeGreaterThanOrEqual(120);
  expect(select).toHaveTextContent("默认标题");
  await userEvent.click(select);
  const popup = await within(document.body).findByRole("listbox");
  const bounds = popup.getBoundingClientRect();
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
  await waitFor(() => expect(within(popup).getByRole("option", { name: "默认标题" })).toHaveFocus());
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await waitFor(() => expect(select).toHaveTextContent("Button"));
  await waitFor(() => expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument());
  await waitFor(() => expect(select).toHaveFocus());
  expect(input).toHaveValue("Button");
  expect(docs.getByRole("heading", { level: 1, name: "Button" })).toBeVisible();
  await userEvent.click(docs.getByRole("button", { name: "切换预览与代码" }));
  const code = docs.getByRole("region", { name: "ComponentDocsTemplate 代码" }).querySelector("pre")!;
  expect(code).toHaveTextContent('name={"Button"}');
  await userEvent.click(docs.getByRole("tab", { name: "Accessibility" }));
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  rendered.updateGlobals(theme === "light" ? "dark" : "light");
  await rendered.rerender();
  expect(select).toHaveTextContent("Button");
  expect(input).toHaveValue("Button");
  expect(code).toHaveTextContent('name={"Button"}');
  await userEvent.click(docs.getByRole("button", { name: "恢复默认标题" }));
  expect(select).toHaveTextContent("默认标题");
  expect(code).toHaveTextContent('name={"通用组件文档模板"}');
  await userEvent.click(docs.getByRole("button", { name: "切换预览与代码" }));
  await userEvent.clear(input);
  expect(input).toHaveValue("");
  await userEvent.type(input, "自定义标题");
  expect(input).toHaveValue("自定义标题");
  expect(select).toHaveTextContent("自定义标题");
  await userEvent.click(select);
  const customPopup = await within(document.body).findByRole("listbox");
  await waitFor(() => expect(within(customPopup).getByRole("option", { name: "自定义标题" })).toHaveFocus());
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(within(document.body).queryByRole("listbox")).not.toBeInTheDocument());
  expect(select).toHaveFocus();
  expect(input).toHaveValue("自定义标题");
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
});

test.each(["light", "dark"])("code cards keep rounded corners, full-width scrolling and a separate copy toolbar in %s", async theme => {
  const width = window.innerWidth;
  expect([320, 390]).toContain(width);
  container = document.createElement("main");
  document.body.append(container);
  const rendered = await renderTemplateDocs(container);
  unmountDocs = rendered.unmount;
  rendered.updateGlobals(theme);
  const docs = within(container);
  const panel = docs.getByRole("tabpanel", { name: "Overview" });
  const example = docs.getByRole("region", { name: "示例 — 操作表单" });
  expect(example.querySelector(".component-docs-preview-title")).toHaveTextContent("示例 — 操作表单");
  await userEvent.click(within(example).getByRole("button", { name: "切换预览与代码" }));
  expect(within(example).getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
  const sources = panel.querySelectorAll<HTMLElement>(".docblock-source");
  expect(sources).toHaveLength(2);
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    for (const block of sources) {
      const source = block.closest<HTMLElement>(".component-docs-source") ?? block;
      const pre = source.querySelector("pre")!;
      const background = colorPixel(getComputedStyle(source).backgroundColor);
      const tokenColors = new Set([...pre.querySelectorAll(".token")].map(token => getComputedStyle(token).color));
      expect(tokenColors.size).toBeGreaterThan(0);
      for (const color of tokenColors) expect.soft(contrastRatio(colorPixel(color), background), `${theme} syntax color ${color}`).toBeGreaterThanOrEqual(4.5);
      const copy = within(source).getByRole("button", { name: /^Copy$/ });
      expect(within(source).getAllByRole("button")).toHaveLength(1);
      expect.soft(copy).toHaveAttribute("data-slot", "button");
      expect.soft(copy).toHaveAttribute("data-variant", "ghost");
      expect.soft(copy).toHaveAttribute("data-size", "sm");
      const scroller = source.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]")!;
      await browserUser.click(scroller);
      expect.soft(scroller.matches(":focus-visible")).toBe(false);
      expect.soft(getComputedStyle(scroller).outlineStyle).toBe("none");
      const bounds = source.getBoundingClientRect();
      const viewport = scroller.getBoundingClientRect();
      const card = source.closest(".component-docs-example") ?? source;
      expect.soft(copy.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewport.top);
      expect.soft(Math.abs(viewport.left - bounds.left)).toBeLessThanOrEqual(1);
      expect.soft(Math.abs(bounds.right - viewport.right)).toBeLessThanOrEqual(1);
      expect.soft(getComputedStyle(card).borderTopLeftRadius).toBe(getComputedStyle(example).borderTopLeftRadius);
      expect.soft(parseFloat(getComputedStyle(card).borderTopLeftRadius)).toBeGreaterThan(0);
      expect.soft(getComputedStyle(source).overflow).toBe("hidden");
      expect.soft(getComputedStyle(source).borderTopColor).toBe(getComputedStyle(example).borderTopColor);
      expect.soft(getComputedStyle(source).backgroundColor).toBe(getComputedStyle(example.querySelector(".component-docs-example-details")!).backgroundColor);
      expect.soft(getComputedStyle(scroller).overflow).toBe("auto");
      expect.soft(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
      expect.soft(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
      expect(scroller).toHaveAttribute("tabindex", "0");
      expect.soft(["auto", "scroll"]).not.toContain(getComputedStyle(pre).overflow);
      for (let parent = scroller.parentElement; parent && parent !== source; parent = parent.parentElement) {
        expect.soft(["auto", "scroll"]).not.toContain(getComputedStyle(parent).overflowY);
        expect.soft(["auto", "scroll"]).not.toContain(getComputedStyle(parent).overflowX);
      }
      const toolbarOffset = copy.getBoundingClientRect().top - source.getBoundingClientRect().top;
      scroller.scrollTo({ top: scroller.scrollHeight, left: scroller.scrollWidth, behavior: "instant" });
      expect(scroller.scrollTop).toBeGreaterThan(0);
      expect(scroller.scrollLeft).toBeGreaterThan(0);
      expect(copy.getBoundingClientRect().top - source.getBoundingClientRect().top).toBe(toolbarOffset);
      await userEvent.click(copy);
      expect(writeText).toHaveBeenLastCalledWith(pre.textContent);
      expect(within(source).getByRole("button", { name: /^Copied!$/ })).toBeVisible();
      await browserUser.keyboard("{Tab}");
      expect(scroller).toHaveFocus();
      expect(scroller.matches(":focus-visible")).toBe(true);
      expect(getComputedStyle(scroller).outlineStyle).toBe("solid");
      expect(getComputedStyle(scroller).outlineWidth).toBe("2px");
      scroller.scrollTop = 0;
      await browserUser.keyboard("{PageDown}");
      await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));
      writeText.mockRejectedValueOnce(new Error("Clipboard permission denied"));
      await userEvent.click(within(source).getByRole("button"));
      expect(await within(source).findByRole("button", { name: /^Copy failed$/ })).toBeVisible();
      expect.soft(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
    }
  } finally {
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
