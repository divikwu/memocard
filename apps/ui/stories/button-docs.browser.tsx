import { afterEach, expect, test, vi } from "vitest";
import { userEvent as browserUser } from "vitest/browser";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { fn, userEvent } from "storybook/test";
import { buttonDocsStories, renderButtonDocs } from "../.storybook/button-docs.fixture";
import { StorybookTheme } from "../.storybook/preview";
import "../.storybook/preview.css";

let unmountDocs: (() => void) | undefined;
let container: HTMLElement | undefined;
afterEach(() => { unmountDocs?.(); unmountDocs = undefined; cleanup(); container?.remove(); container = undefined; });

test("Button navigation keeps basic development stories and tests its Docs-only examples", () => {
  expect(Object.entries(buttonDocsStories).filter(([, story]) => story.tags.includes("dev")).map(([name]) => name).sort())
    .toEqual(["Default", "KeyboardAndDisabled", "Sizes", "Variants"]);
  for (const name of ["Overview", "Examples", "Properties", "Anatomy", "States", "Loading", "Actions"] as const) {
    expect(buttonDocsStories[name].tags).not.toContain("dev");
    expect(buttonDocsStories[name].tags).toContain("test");
  }
});

test("the entire Docs canvas follows theme changes in all three tabs", async () => {
  container = document.createElement("main");
  document.body.append(container);
  const rendered = await renderButtonDocs(container);
  unmountDocs = rendered;
  const docs = within(container);
  const wrapper = container.querySelector<HTMLElement>(".sbdocs-wrapper")!;
  const title = docs.getByRole("heading", { name: "Button", level: 1 });
  const lightBackground = getComputedStyle(wrapper).backgroundColor;
  const lightText = getComputedStyle(title).color;
  rendered.updateGlobals({ theme: "dark", palette: "mono", radius: "lg" });
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
  for (const name of ["Overview", "Properties", "Accessibility"]) {
    await userEvent.click(docs.getByRole("tab", { name }));
    expect(getComputedStyle(wrapper).backgroundColor).not.toBe(lightBackground);
    expect(getComputedStyle(wrapper).backgroundColor).toBe(getComputedStyle(document.body).backgroundColor);
    expect(getComputedStyle(title).color).not.toBe(lightText);
  }
  rendered.updateGlobals({ theme: "light", palette: "mono", radius: "lg" });
  await waitFor(() => {
    expect(document.documentElement).toHaveClass("light");
    expect(getComputedStyle(wrapper).backgroundColor).toBe(lightBackground);
    expect(getComputedStyle(title).color).toBe(lightText);
  });
});

test("toolbar appearance updates preserve Canvas parameters, clicks and code view", async () => {
  const Properties = buttonDocsStories.Properties;
  const { container, rerender } = render(<StorybookTheme globals={{ theme: "light" }}><Properties /></StorybookTheme>);
  const canvas = within(container);
  const input = canvas.getByLabelText("children");
  await userEvent.clear(input);
  await userEvent.type(input, "保留主题参数");
  await userEvent.click(canvas.getByRole("button", { name: "保留主题参数" }));
  await userEvent.click(canvas.getByRole("button", { name: "切换预览与代码" }));
  for (const theme of ["dark", "light"]) {
    rerender(<StorybookTheme globals={{ theme, palette: "blue", radius: "sm" }}><Properties /></StorybookTheme>);
    await waitFor(() => expect(document.documentElement).toHaveClass(theme));
    expect(document.documentElement.dataset.palette).toBe("blue");
    expect(document.documentElement.dataset.radius).toBe("sm");
    expect(canvas.getByLabelText("children")).toBe(input);
    expect(input).toHaveValue("保留主题参数");
    expect(canvas.getByText("演示点击：1 次")).toBeVisible();
    expect(canvas.getByRole("button", { name: "切换预览与代码" })).toHaveAttribute("aria-pressed", "true");
  }
});

test("Docs renderer globals refresh keeps the selected tab and mounted Properties state", async () => {
  container = document.createElement("main");
  document.body.append(container);
  const rendered = await renderButtonDocs(container);
  unmountDocs = rendered;
  const docs = within(container);
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  const frame = docs.getByRole("tabpanel", { name: "Properties" }).querySelector("iframe")!;
  const body = frame.contentDocument!.body;
  const input = await within(body).findByLabelText("children");
  await userEvent.clear(input);
  await userEvent.type(input, "主题后保留");
  await userEvent.click(within(body).getByRole("button", { name: "主题后保留" }));
  await userEvent.click(within(body).getByRole("button", { name: "切换预览与代码" }));
  for (const theme of ["dark", "light"]) {
    rendered.updateGlobals({ theme });
    await rendered.rerender();
    expect(docs.getByRole("tab", { name: "Properties" })).toHaveAttribute("aria-selected", "true");
    expect(docs.getByRole("tabpanel", { name: "Properties" }).querySelector("iframe")).toBe(frame);
    expect(frame.contentDocument!.body).toBe(body);
    expect(input).toHaveValue("主题后保留");
    expect(within(body).getByText("演示点击：1 次")).toBeVisible();
    expect(within(body).getByRole("button", { name: "切换预览与代码" })).toHaveAttribute("aria-pressed", "true");
  }
});

test("real Button Docs tabs preserve the Properties iframe, row controls, feedback and code view", async () => {
  container = document.createElement("main");
  document.body.append(container);
  unmountDocs = await renderButtonDocs(container);
  const docs = within(container);
  const overview = docs.getByRole("tab", { name: "Overview" });
  const properties = docs.getByRole("tab", { name: "Properties" });
  const accessibility = docs.getByRole("tab", { name: "Accessibility" });
  expect(within(docs.getByRole("tablist", { name: "Button 文档" })).getAllByRole("tab")).toHaveLength(3);
  expect(overview).toHaveAttribute("aria-selected", "true");
  await userEvent.click(properties);
  const panel = docs.getByRole("tabpanel", { name: "Properties" });
  const frame = panel.querySelector<HTMLIFrameElement>("iframe");
  expect(frame).not.toBeNull();
  const content = frame!.contentDocument!;
  await waitFor(() => expect(within(content.body).getByLabelText("children")).toBeVisible(), { container: content.body });
  const controls = within(content.body);
  const choose = async (name: string, value: string) => {
    await userEvent.click(controls.getByRole("combobox", { name }));
    // Fixture stories are React portals; Base UI portals use the fixture's document.
    await userEvent.click(await within(document.body).findByRole("option", { name: value }));
  };
  const children = controls.getByLabelText("children");
  const codeToggle = controls.getByRole("button", { name: "切换预览与代码" });
  const code = content.getElementById(codeToggle.getAttribute("aria-controls")!)!;
  expect(code).not.toBeVisible();
  await userEvent.clear(children);
  await userEvent.type(children, "保留参数");
  await choose("variant", "outline");
  await choose("size", "lg");
  await choose("type", "submit");
  await userEvent.type(controls.getByLabelText("aria-label"), "保留参数（详情）");
  const previewButton = controls.getByRole("button", { name: "保留参数（详情）" });
  await userEvent.click(previewButton);
  await userEvent.click(controls.getByRole("switch", { name: "disabled" }));
  await userEvent.click(codeToggle);
  await waitFor(() => {
    const source = code.querySelector("pre");
    expect(source).not.toBeNull();
    expect(source).toHaveTextContent('variant="outline"');
  }, { container: code });
  await userEvent.click(accessibility);
  await waitFor(() => expect(panel).toHaveAttribute("hidden"));
  expect(panel).toHaveAttribute("inert");
  expect(getComputedStyle(panel).display).toBe("none");
  expect(frame).not.toBeVisible();
  expect(frame!.isConnected).toBe(true);
  expect(frame!.contentDocument).toBe(content);
  // A focus boundary after Properties makes native Tab skipping observable.
  const nextFocus = document.createElement("button");
  nextFocus.textContent = "测试焦点边界";
  panel.after(nextFocus);
  await browserUser.keyboard("{Tab}");
  expect(nextFocus).toHaveFocus();
  nextFocus.remove();
  await userEvent.click(accessibility);
  await userEvent.keyboard("{ArrowLeft}");
  expect(properties).toHaveFocus();
  expect(properties).toHaveAttribute("aria-selected", "true");
  expect(panel.querySelector("iframe")).toBe(frame);
  expect(frame!.contentDocument).toBe(content);
  expect(controls.getByLabelText("children")).toBe(children);
  expect(children).toHaveValue("保留参数");
  expect(controls.getByLabelText("variant")).toHaveTextContent("outline");
  expect(controls.getByLabelText("size")).toHaveTextContent("lg");
  expect(controls.getByLabelText("type")).toHaveTextContent("submit");
  expect(controls.getByLabelText("aria-label")).toHaveValue("保留参数（详情）");
  expect(controls.getByRole("switch", { name: "disabled" })).toBeChecked();
  expect(previewButton).toBeDisabled();
  expect(controls.getByText("演示点击：1 次")).toBeVisible();
  expect(codeToggle).toHaveAttribute("aria-pressed", "true");
  expect(code).toBeVisible();
  expect(code.querySelector("pre")).toHaveTextContent('size="lg"');
  expect(code.querySelector("pre")).toHaveTextContent('type="submit"');
  expect(code.querySelector("pre")).toHaveTextContent("disabled");
  expect(code.querySelector("pre")).toHaveTextContent('aria-label={"保留参数（详情）"}');
  await userEvent.click(controls.getByRole("button", { name: "Reset" }));
  expect(children).toHaveValue("保存");
  expect(controls.getByLabelText("variant")).toHaveTextContent("default");
  expect(controls.getByLabelText("size")).toHaveTextContent("default");
  expect(controls.getByLabelText("type")).toHaveTextContent("button");
  expect(controls.getByRole("switch", { name: "disabled" })).not.toBeChecked();
  expect(controls.getByText("演示点击：0 次")).toBeVisible();
  await userEvent.click(overview);
  await userEvent.click(properties);
  expect(panel.querySelector("iframe")).toBe(frame);
  expect(children).toHaveValue("保存");
  expect(controls.getByText("演示点击：0 次")).toBeVisible();
});

test("example detail tabs switch independently with keyboard support and resize their iframe", async () => {
  container = document.createElement("main");
  document.body.append(container);
  unmountDocs = await renderButtonDocs(container);
  const docs = within(container);
  const frame = container.querySelector<HTMLIFrameElement>('iframe[title="Examples"]')!;
  const content = frame.contentDocument!;
  const examples = within(content.body);
  await waitFor(() => expect(examples.getAllByRole("tablist", { name: "示例详情" })).toHaveLength(4), { container: content.body });
  await content.fonts.ready;
  expect(examples.getAllByRole("link", { name: "在 Canvas 中打开" })).toHaveLength(4);
  expect(content.querySelector(".component-docs-standalone")).toBeNull();
  const lists = examples.getAllByRole("tablist", { name: "示例详情" });
  const first = within(lists[0].closest<HTMLElement>('[data-slot="tabs"]')!);
  const second = within(lists[1].closest<HTMLElement>('[data-slot="tabs"]')!);
  const preview = examples.getByRole("button", { name: "搜索笔记" });
  const height = frame.clientHeight;
  expect(first.getByRole("tab", { name: "描述" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(first.getByRole("tab", { name: "描述" }));
  await browserUser.keyboard("{ArrowRight}");
  expect(first.getByRole("tab", { name: "Code" })).toHaveFocus();
  const code = first.getByRole("tabpanel", { name: "Code" });
  await waitFor(() => expect(code.querySelector("pre")).toHaveTextContent('import { ArrowRight, Search }'), { container: content.body });
  await waitFor(() => expect(frame.clientHeight).toBeGreaterThan(height));
  expect(second.getByRole("tab", { name: "描述" })).toHaveAttribute("aria-selected", "true");
  expect(docs.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  expect(examples.getByRole("button", { name: "搜索笔记" })).toBe(preview);
  await browserUser.keyboard("{ArrowLeft}");
  expect(first.getByRole("tab", { name: "描述" })).toHaveFocus();
  expect(code).not.toBeVisible();
  expect(first.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
  await waitFor(() => expect(frame.clientHeight).toBe(height));
});

test("composed gallery stories hide controls that their fixed render does not consume", () => {
  expect(buttonDocsStories.Variants.parameters.controls.exclude).toEqual(expect.arrayContaining(["variant", "children"]));
  expect(buttonDocsStories.Sizes.parameters.controls.exclude).toEqual(expect.arrayContaining(["size", "children", "aria-label"]));
  expect(buttonDocsStories.KeyboardAndDisabled.parameters.controls.disable).toBe(true);
  expect(buttonDocsStories.Default.parameters.controls?.disable).not.toBe(true);
  for (const story of [buttonDocsStories.KeyboardAndDisabled, buttonDocsStories.Examples, buttonDocsStories.Properties, buttonDocsStories.Loading, buttonDocsStories.Actions]) {
    expect(story.play).toBeUndefined();
  }
});

test("Accessibility links resolve directly to the color stories", async () => {
  container = document.createElement("main");
  document.body.append(container);
  unmountDocs = await renderButtonDocs(container);
  const docs = within(container);
  await userEvent.click(docs.getByRole("tab", { name: "Accessibility" }));
  for (const [name, story] of [["Foundations Colors 默认", "foundations-colors--default"], ["Blue Slate", "foundations-colors--blue-slate"]]) {
    const link = docs.getByRole<HTMLAnchorElement>("link", { name });
    expect(new URL(link.href).searchParams.get("path")).toBe(`/story/${story}`);
  }
});

test("KeyboardAndDisabled interactions run independently of the initial Canvas presentation", async () => {
  const { container: canvasElement } = render(<buttonDocsStories.KeyboardAndDisabled />);
  const args = buttonDocsStories.KeyboardAndDisabled.args;

  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: "保存" }));
  await expect(canvas.getByRole("button", { name: "保存" })).toHaveFocus();
  await userEvent.keyboard("{Enter} ");
  await expect(args.onClick).toHaveBeenCalledTimes(3);
  await userEvent.tab();
  await expect(canvas.getByRole("button", { name: "下一项" })).toHaveFocus();
  await expect(canvas.getByRole("button", { name: "不可用" })).toBeDisabled();
  await userEvent.keyboard("{Enter}");
  await expect(args.onClick).toHaveBeenCalledTimes(3);
});

test("Examples interactions run independently of the initial Canvas presentation", async () => {
  const { container: canvasElement } = render(<buttonDocsStories.Examples />);
  await act(async () => { await vi.dynamicImportSettled(); });
  expect([...canvasElement.querySelectorAll("pre")].some(source => source.textContent?.includes("链接目标：此示例中的按钮用法。"))).toBe(true);

  const canvas = within(canvasElement);
  expect(canvas.queryByRole("link", { name: "在 Canvas 中打开" })).not.toBeInTheDocument();
  const action = canvas.getByRole("button", { name: "搜索笔记" });
  await expect(action.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(canvas.getByRole("button", { name: "导出笔记" })).toBeDisabled();
  const link = canvas.getByRole("link", { name: "查看用法" });
  await expect(link).toHaveAttribute("href", "#button-link-target");
  await expect(link).toHaveAttribute("target", "_self");
  await userEvent.click(action);
  link.focus();
  await expect(link).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect(canvasElement.querySelector("#button-link-target")).toHaveFocus();
});

test("Properties interactions run independently of the initial Canvas presentation", async () => {
  const { container: canvasElement } = render(<buttonDocsStories.Properties />);

  const canvas = within(canvasElement);
  const preview = within(canvas.getByRole("form", { name: "实时按钮预览" }));
  const body = within(canvasElement.ownerDocument.body);
  const choose = async (name: string, value: string) => {
    await userEvent.click(canvas.getByRole("combobox", { name }));
    await userEvent.click(await body.findByRole("option", { name: value }));
  };
  const caption = '收藏 "项目" {草稿} <笔记>';
  const codeToggle = canvas.getByRole("button", { name: "切换预览与代码" });
  const codePanel = canvasElement.ownerDocument.getElementById(codeToggle.getAttribute("aria-controls")!)!;
  await expect(codeToggle).toHaveAttribute("aria-pressed", "false");
  await expect(codePanel).not.toBeVisible();
  await userEvent.clear(canvas.getByLabelText("children"));
  await userEvent.type(canvas.getByLabelText("children"), '收藏 "项目" {{草稿} <笔记>');
  await choose("variant", "outline");
  await choose("size", "lg");
  await choose("type", "submit");
  const button = preview.getByRole("button", { name: caption });
  await expect(button).toHaveAttribute("data-variant", "outline");
  await expect(button).toHaveAttribute("data-size", "lg");
  await expect(button).toHaveAttribute("type", "submit");
  await userEvent.click(button);
  await expect(canvas.getByText("演示点击：1 次")).toBeVisible();
  await userEvent.click(canvas.getByRole("switch", { name: "disabled" }));
  await expect(button).toBeDisabled();
  button.click();
  await expect(canvas.getByText("演示点击：1 次")).toBeVisible();
  await expect(canvas.getByRole("table", { name: "Button API" })).toBeVisible();
  await expect(canvas.getAllByRole("row")).toHaveLength(9);
  await userEvent.click(codeToggle);
  await waitFor(() => expect(codePanel.querySelector("pre")).toHaveTextContent('variant="outline"'));
  const code = codePanel.querySelector("pre");
  await expect(code).toHaveTextContent(`{${JSON.stringify(caption)}}`);
  await expect(code).toHaveTextContent('variant="outline"');
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const writeText = fn<(text: string) => Promise<void>>(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    const copy = await canvas.findByRole("button", { name: /^Copy$/ });
    await userEvent.click(copy);
    await expect(writeText).toHaveBeenCalledWith(code?.textContent);
    await expect(await canvas.findByRole("button", { name: /^Copied!$/ })).toBeVisible();
  } finally {
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
  await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
  await expect(codeToggle).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(codeToggle);
  const reset = preview.getByRole("button", { name: "保存" });
  await expect(reset).toBeEnabled();
  await expect(reset).toHaveAttribute("data-variant", "default");
  await expect(reset).toHaveAttribute("data-size", "default");
  await expect(reset).toHaveAttribute("type", "button");
  await expect(canvas.getByText("演示点击：0 次")).toBeVisible();
  await choose("size", "icon-sm");
  await userEvent.type(canvas.getByLabelText("aria-label"), '搜索 "标签" <项目>');
  await expect(preview.getByRole("button", { name: '搜索 "标签" <项目>' })).toHaveAttribute("data-size", "icon-sm");
  await expect(code).toHaveTextContent(`aria-label={${JSON.stringify('搜索 "标签" <项目>')}}`);
  await expect(code).toHaveTextContent('import { Search } from "lucide-react"');
  await choose("type", "reset");
  await userEvent.click(preview.getByRole("button", { name: '搜索 "标签" <项目>' }));
  await expect(canvas.getByText("演示点击：1 次")).toBeVisible();
  await expect(preview.getByRole("button", { name: '搜索 "标签" <项目>' })).toHaveAttribute("data-size", "icon-sm");
});

test("Loading interactions run independently of the initial Canvas presentation", async () => {
  const { container: canvasElement } = render(<buttonDocsStories.Loading />);

  const canvas = within(canvasElement);
  expect(canvas.getByText("尚未保存。")).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "保存更改" }));
  const saving = canvas.getByRole("button", { name: "保存中…" });
  await expect(saving).toBeDisabled();
  await expect(saving).toHaveAttribute("aria-busy", "true");
  await expect(await canvas.findByText("已保存（演示）。")).toBeVisible();
  await expect(canvas.getByRole("button", { name: "保存更改" })).toBeEnabled();
});

test("Actions interactions run independently of the initial Canvas presentation", async () => {
  const { container: canvasElement } = render(<buttonDocsStories.Actions />);

  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole("button", { name: "删除笔记" });
  await userEvent.click(trigger);
  const dialog = await page.findByRole("dialog", { name: "确认删除笔记？" });
  await userEvent.click(within(dialog).getByRole("button", { name: "取消删除" }));
  await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  await userEvent.click(trigger);
  await userEvent.click(within(await page.findByRole("dialog")).getByRole("button", { name: "确认删除" }));
  await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});
