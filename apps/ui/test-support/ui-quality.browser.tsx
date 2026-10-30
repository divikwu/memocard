import { afterEach, expect, inject, test } from "vitest";
import type { NoteProperties as Properties, PropertyLayout } from "@memocard/contracts";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { commands, page, server, userEvent } from "vitest/browser";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { InputFocusFixture } from "./input-focus-fixture";
import { ComponentDocs } from "../ui/ComponentDocs";
import { ComponentDocsExample } from "../ui/ComponentDocsTemplate";
import { componentDocs, type ComponentKey } from "../ui/component-docs.data";
import { Button } from "../ui/components/button";
import { ActionGroup, MobileActionGroupProvider } from "../ui/components/action-group";
import { Slider } from "../ui/components/slider";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/components/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../ui/components/dropdown-menu";
import { WebSettings } from "../ui/web/WebSettings";
import { App, type AppViewState } from "../src/App";
import { WebAppearanceProvider } from "../ui/web/WebAppearance";
import { preloadWebEditor, renderWebApp } from "../ui/web/WebAppView";
import { createWorkspaceFixture } from "../ui/web/workspace-fixture";
import propertyStoryMeta, { LayoutStress } from "../ui/stories/business-note-properties.stories";
import { Card } from "../ui/components/card";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../ui/components/popover";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui/components/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/components/dialog";
import { NoteProperties } from "../ui/business/NoteProperties";
import { NoteCollection } from "../ui/business/NoteCollection";
import { NoteSearchDialog } from "../ui/business/NoteSearchDialog";
import { QuickCapture } from "../ui/business/QuickCapture";
import { PropertyConfirmationPopup } from "../ui/business/property-confirmation";
import { MermaidContent, NoteMarkdown, VaultImage } from "../ui/business/NoteMarkdown";
import { RichMarkdownEditor } from "../ui/business/RichMarkdownEditor";
import { PreviewModeProvider } from "../ui/preview-mode";
import { loadPreviewFonts } from "../ui/preview-fonts";
import { useNoteImage } from "../src/use-note-image";
import { setStorybookBrowserAssets, setStorybookRequestHandler } from "./bridge";
import { editorNote } from "./editor-note";
import { createSearchFixture } from "./note-search.fixtures";
import "../.storybook/preview.css";
import "../ui/preview-appearance.css";
import "../ui/business/NoteCollection.css";

const emptyPropertyLayout = (): PropertyLayout => ({order: [], visibility: {}, contentHash: "0".repeat(64)});
const propertyLayoutStatus = () => ({vaultId: "ui-property-layout", capabilities: ["getPropertyLayout", "setPropertyLayout"]});

function propertyLayoutFixture(vaultId: string, beforeSave?: () => Promise<void>) {
  let revision = 0;
  let layout: PropertyLayout = {order: ["property:other-note"], visibility: {"property:other-note": "hidden"}, contentHash: "0".repeat(64)};
  const writes: Record<string, unknown>[] = [];
  const release = setStorybookRequestHandler(async (operation, params) => {
    if (operation === "getStatus") return {vaultId, capabilities: ["getPropertyLayout", "setPropertyLayout"]};
    if (operation === "getPropertyLabels") return {labels: {}, contentHash: "labels"};
    if (operation === "getPropertyLayout") return structuredClone(layout);
    if (operation === "listTags") return {tags: [{name: "设计"}]};
    if (operation === "setPropertyLayout") {
      if (params.baseHash !== layout.contentHash) throw new Error("属性布局已更改。");
      writes.push(structuredClone(params));
      await beforeSave?.();
      layout = {order: [...params.order as string[]], visibility: {...params.visibility as PropertyLayout["visibility"]}, contentHash: (++revision).toString(16).padStart(64, "0")};
      return structuredClone(layout);
    }
    throw new Error(`Unexpected layout operation: ${operation}`);
  });
  return {release, writes, layout: () => structuredClone(layout)};
}

const preferenceProperties: Properties = {
  contentHash: editorNote.contentHash, writable: true,
  tagProperty: {name: "tags", type: "list", value: ["设计"], editable: true},
  properties: [
    {name: "摘要", type: "text", value: "较长的说明应换行，名称保持在第一行。".repeat(8), editable: true},
    {name: "零值", type: "number", value: "0", editable: true},
    {name: "未完成", type: "checkbox", value: false, editable: true},
    {name: "空值", type: "text", value: "", editable: true},
  ],
};

afterEach(async () => {
  cleanup();
  await commands.setReducedMotion("no-preference");
  await commands.setForcedColors("none");
  await commands.setFontsOffline(false);
  document.documentElement.removeAttribute("data-ui-appearance");
  document.documentElement.removeAttribute("data-ui-theme");
  document.documentElement.removeAttribute("style");
});

// Canvas resolves computed oklch/system colors and composites alpha as painted.
function paintedContrast(foreground: string, background: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2; canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = background; context.fillRect(0, 0, 2, 1);
  context.fillStyle = foreground; context.fillRect(0, 0, 1, 1);
  const data = context.getImageData(0, 0, 2, 1).data;
  const luminance = (offset: number) => [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const value = data[offset + index] / 255;
    return sum + weight * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  }, 0);
  const a = luminance(0), b = luminance(4);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function expectKeyboardOutline(element: Element, mode: "light" | "dark") {
  const style = getComputedStyle(element);
  expect(style.outlineStyle).toBe("solid");
  expect(style.outlineWidth).toBe("2px");
  expect(style.outlineOffset).toBe("2px");
  const swatch = document.createElement("span");
  swatch.style.color = `var(--color-blue-${mode === "light" ? "600" : "400"})`;
  document.body.append(swatch);
  try { expect(style.outlineColor).toBe(getComputedStyle(swatch).color); }
  finally { swatch.remove(); }
}

function expectUnclippedOutline(element: Element) {
  const bounds = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const outset = parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const clip = getComputedStyle(parent), rect = parent.getBoundingClientRect();
    if (/(hidden|clip|auto|scroll)/.test(clip.overflowX)) {
      expect(bounds.left - outset, `${parent.className} left: element=${bounds.left}, outline=${outset}, clip=${rect.left}`).toBeGreaterThanOrEqual(rect.left - 0.5);
      expect(bounds.right + outset, `${parent.className} right: element=${bounds.right}, outline=${outset}, clip=${rect.right}`).toBeLessThanOrEqual(rect.right + 0.5);
    }
    if (/(hidden|clip|auto|scroll)/.test(clip.overflowY)) {
      expect(bounds.top - outset, `${parent.className} top: element=${bounds.top}, outline=${outset}, clip=${rect.top}`).toBeGreaterThanOrEqual(rect.top - 0.5);
      expect(bounds.bottom + outset, `${parent.className} bottom: element=${bounds.bottom}, outline=${outset}, clip=${rect.bottom}`).toBeLessThanOrEqual(rect.bottom + 0.5);
    }
  }
}

// The fixed touch project registers only the shared list flow below.
if (!inject("uiQualityTouch")) {
for (const [kind, block] of [
  ["table", `| A | B |\n| --- | --- |\n| ${"wide-table-cell".repeat(30)} | value |\n| second | row |`],
  ["code", `\`\`\`txt\n${"wide-code-line".repeat(30)}\n\`\`\``],
] as const) test(`compact card ${kind} preview stays at the start during native Tab navigation`, async () => {
  await page.viewport(1024, 900);
  const body = `${Array.from({ length: 6 }, (_, index) => `预览段落 ${index + 1}。`).join("\n\n")}\n\n${block}`;
  const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4" style={{ width: 384 }}>
    <NoteCollection notes={[{ ...editorNote, body, tags: ["检查"] }]} query="" onQueryChange={() => {}} searchPlaceholder="搜索" searchDisabled={false} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
  </main></PreviewModeProvider>);
  const canvas = within(view.container);
  await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
  await canvas.findByText("预览段落 1。");
  const open = canvas.getByRole("button", { name: `打开 ${editorNote.title}` });
  const preview = open.closest(".ui-note-card")!.querySelector<HTMLElement>(".ui-note-preview")!;
  const wide = preview.querySelector<HTMLElement>(kind === "table" ? ".typeset-scroll" : "pre")!;
  expect(wide.scrollWidth).toBeGreaterThan(wide.clientWidth);
  const containers = [preview, ...preview.querySelectorAll<HTMLElement>(".note-preview, .note-preview > div, .ui-note-markdown, .typeset-scroll, pre")];
  const scrollPositions = () => containers.map(element => [element.scrollLeft, element.scrollTop]);
  const before = scrollPositions();
  const tag = canvas.getByRole("button", { name: "筛选标签 检查" });
  open.focus();
  for (const [keys, target] of [
    [server.browser === "webkit" ? "{Alt>}{Tab}{/Alt}" : "{Tab}", tag],
    [server.browser === "webkit" ? "{Alt>}{Shift>}{Tab}{/Shift}{/Alt}" : "{Shift>}{Tab}{/Shift}", open],
  ] as const) {
    await userEvent.keyboard(keys);
    expect(scrollPositions()).toEqual(before);
    expect(document.activeElement).toBe(target);
    if (target === tag) {
      await Promise.all(tag.getAnimations().map(animation => animation.finished));
      expectKeyboardOutline(tag, "light");
      expectUnclippedOutline(tag);
    }
  }
});

for (const width of [390, 1280]) test(`search preview remains stationary and excludes body from native Tab navigation at ${width}px`, async () => {
  await page.viewport(width, 900);
  const fixture = createSearchFixture("normal");
  fixture.notes[0].body = `[参考链接](https://example.com)\n\n${"预览正文。\n\n".repeat(24)}\n\n| A | B |\n| --- | --- |\n| ${"wide-search-cell".repeat(30)} | value |\n\n\`\`\`txt\n${"wide-search-code".repeat(30)}\n\`\`\``;
  const release = setStorybookRequestHandler(fixture.request);
  try {
    render(<PreviewModeProvider mode="light"><NoteSearchDialog open available vaultName="预览检查库" returnFocus={{ current: null }} onOpenChange={() => {}} onOpenNote={() => {}} /></PreviewModeProvider>);
    const dialog = await within(document.body).findByRole("dialog", { name: "搜索笔记" });
    const search = within(dialog);
    await search.findByRole("option", { name: fixture.notes[0].title! });
    const preview = dialog.querySelector<HTMLElement>(".ui-note-search-preview-content")!;
    const containers = [preview, ...preview.querySelectorAll<HTMLElement>("div,pre")];
    const scrollPositions = () => containers.map(element => [element.scrollLeft, element.scrollTop]);
    const before = scrollPositions();
    if (width >= 1024) expect(preview.scrollHeight).toBeGreaterThan(preview.clientHeight);
    else expect(getComputedStyle(preview.closest("aside")!).display).toBe("none");
    search.getByRole("combobox", { name: "搜索笔记" }).focus();
    for (const keys of [
      server.browser === "webkit" ? "{Alt>}{Tab}{/Alt}" : "{Tab}",
      server.browser === "webkit" ? "{Alt>}{Shift>}{Tab}{/Shift}{/Alt}" : "{Shift>}{Tab}{/Shift}",
    ]) for (let step = 0; step < 6; step++) {
      await userEvent.keyboard(keys);
      expect(document.activeElement?.closest("[inert]")).toBeNull();
      expect(scrollPositions()).toEqual(before);
    }
  } finally { release(); }
});

test("reading table retains native keyboard focus and horizontal scrolling", async () => {
  const view = render(<main className="ui-theme p-4" style={{ width: 384 }}>
    <button>正文起点</button>
    <NoteMarkdown body={`| A | B |\n| --- | --- |\n| ${"wide-reading-cell".repeat(30)} | value |`} />
  </main>);
  within(view.container).getByRole("button", { name: "正文起点" }).focus();
  await userEvent.keyboard(server.browser === "webkit" ? "{Alt>}{Tab}{/Alt}" : "{Tab}");
  const table = within(view.container).getByRole("region", { name: "表格，可横向滚动" });
  expect(document.activeElement).toBe(table);
  await userEvent.keyboard("{ArrowRight}");
  await waitFor(() => expect(table.scrollLeft).toBeGreaterThan(0));
});

for (const mode of ["light", "dark"] as const) {
  for (const kind of ["accordion", "source", "settings"] as const) test(`outward focus is not clipped for ${kind} in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const settings = { status: { connected: true, vaultName: "测试库", coverage: {} }, sidebar: {}, capabilities: new Set(), unsupportedBrowser: true } as unknown as AppViewState;
    const view = render(<PreviewModeProvider mode={mode}><main className="grid gap-6 p-6">
      <Button>开始检查</Button>
      {kind === "accordion" ? <Accordion><AccordionItem value="a"><AccordionTrigger>展开说明</AccordionTrigger><AccordionContent>说明内容</AccordionContent></AccordionItem></Accordion>
        : kind === "source" ? <div className="ui-component-docs"><ComponentDocsExample title="代码说明" code="const current = true;" story="ui-input--example" description="组件说明">组件预览</ComponentDocsExample></div>
          : <WebSettings state={settings} />}
    </main></PreviewModeProvider>);
    const canvas = within(view.container);
    if (kind === "source") {
      await userEvent.click(canvas.getByRole("button", { name: "切换预览说明与代码" }));
      canvas.getByRole("button", { name: "复制代码" }).focus();
    } else canvas.getByRole("button", { name: "开始检查" }).focus();
    await userEvent.tab();
    const target = kind === "accordion" ? canvas.getByRole("button", { name: "展开说明" })
      : kind === "source" ? canvas.getByLabelText("组件用法代码") : canvas.getByText("本机文件状态").closest("summary")!;
    await expect.element(target).toHaveFocus();
    const surface = kind === "source" ? target.closest(".ui-docs-source")! : target;
    expectKeyboardOutline(surface, mode);
    expectUnclippedOutline(surface);
    if (kind === "settings") {
      const card = getComputedStyle(target.closest('[data-slot="card"]')!);
      expect(parseFloat(getComputedStyle(target).borderBottomLeftRadius)).toBeCloseTo(parseFloat(card.borderBottomLeftRadius) - parseFloat(card.borderLeftWidth), 3);
    }
    if (kind === "source") {
      expect(getComputedStyle(surface).borderBottomLeftRadius).toBe(getComputedStyle(surface.closest(".ui-docs-example")!).borderBottomLeftRadius);
      expect(canvas.getByRole("link", { name: "在 Canvas 中打开" }).getBoundingClientRect().height).toBeGreaterThanOrEqual(canvas.getByRole("button", { name: "切换预览说明与代码" }).getBoundingClientRect().height);
      await userEvent.click(target);
      expect(getComputedStyle(surface).outlineStyle).toBe("none");
      await userEvent.keyboard("{ArrowDown}");
      expectKeyboardOutline(surface, mode);
    }
  });

  for (const labels of [
    ["单行输入", "密码", "多行输入", "复合输入", "复合多行"],
    ["搜索选择", "多选输入", "编辑器搜索", "富文本输入", "无效输入"],
  ]) test(`all editable controls distinguish pointer and keyboard navigation in ${mode} (${labels[0]})`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><InputFocusFixture mode={mode} /></PreviewModeProvider>);
    const canvas = within(view.container);
    for (const label of labels) {
      const field = canvas.getByLabelText(label, { exact: true });
      const surface = field.closest('[data-slot="input-group"], [data-slot="combobox-chips"]') ?? field;
      await userEvent.click(field);
      expect(getComputedStyle(surface).outlineStyle, label + " pointer").toBe("none");
      const invalidShadow = getComputedStyle(field).boxShadow;
      await userEvent.keyboard("a");
      expect(getComputedStyle(surface).outlineStyle, label + " editing").toBe("none");
      if (label === "无效输入") {
        expect(field.getAttribute("aria-invalid")).toBe("true");
        expect(getComputedStyle(field).boxShadow).toBe(invalidShadow);
        expect(invalidShadow).not.toBe("none");
      }
      await userEvent.tab();
      await userEvent.tab({ shift: true });
      expect(document.activeElement, label + " keyboard target").toBe(field);
      expectKeyboardOutline(surface, mode);
      if (surface !== field) expect(getComputedStyle(field).outlineStyle, label + " single ring").toBe("none");
      await userEvent.click(field);
      expect(getComputedStyle(surface).outlineStyle, label + " pointer again").toBe("none");
      await userEvent.keyboard("{Escape}");
    }
  });

  test(`select and portalled autofocus follow the opening method in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><InputFocusFixture mode={mode} /></PreviewModeProvider>);
    const canvas = within(view.container);
    for (const label of ["原生选择", "选择器", "设置选择器"]) {
      const select = canvas.getByLabelText(label, { exact: true });
      await userEvent.click(select);
      expect(getComputedStyle(select).outlineStyle, label + " pointer").toBe("none");
      // Base UI opens pointer-triggered selects on the next animation frame.
      const menu = select.getAttribute("data-slot") === "select-trigger" ? await within(document.body).findByRole("listbox") : null;
      if (menu) {
        await expect.element(menu).toBeVisible();
        await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
        expect(getComputedStyle(document.activeElement!).outlineStyle, label + " pointer popup").toBe("none");
      }
      await userEvent.keyboard("{Escape}");
      // Base UI hides its retained portal after exit animations, then restores focus.
      if (menu) {
        await waitFor(() => expect(select.getAttribute("aria-expanded")).toBe("false"));
        const popup = menu.closest<HTMLElement>('[data-slot="select-content"]')!;
        await Promise.all(popup.getAnimations().map(animation => animation.finished));
        await expect.element(menu).not.toBeVisible();
        await expect.element(select).toHaveFocus();
      }
      await userEvent.tab();
      await userEvent.tab({ shift: true });
      expect(document.activeElement).toBe(select);
      expectKeyboardOutline(select, mode);
      if (select.getAttribute("data-slot") === "select-trigger") {
        await userEvent.keyboard("{ArrowDown}");
        const keyboardMenu = await within(document.body).findByRole("listbox");
        await waitFor(() => expect(keyboardMenu.contains(document.activeElement)).toBe(true));
        expectKeyboardOutline(document.activeElement!, mode);
      }
      await userEvent.keyboard("{Escape}");
      if (select.getAttribute("data-slot") === "select-trigger") await waitFor(() => expect(select.getAttribute("aria-expanded")).toBe("false"));
    }
    view.unmount();
    const dialogView = render(<PreviewModeProvider mode={mode}><InputFocusFixture mode={mode} /></PreviewModeProvider>);
    const trigger = within(dialogView.container).getByRole("button", { name: "打开自动聚焦输入" });
    for (const keyboard of [false, true]) {
      trigger.focus();
      if (keyboard) await userEvent.keyboard("{Enter}");
      else await userEvent.click(trigger);
      const input = await within(document.body).findByRole("textbox", { name: "弹窗输入" });
      await waitFor(() => expect(document.activeElement).toBe(input));
      expect(getComputedStyle(input).outlineStyle).toBe(keyboard ? "solid" : "none");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(input.isConnected).toBe(false));
      expect(document.activeElement).toBe(trigger);
    }
  });

  test(`buttons, links, selection controls and disclosures share keyboard-only blue focus in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><InputFocusFixture mode={mode} /></PreviewModeProvider>);
    const canvas = within(view.container);
    const controls = [
      canvas.getByRole("button", { name: "键盘导航起点" }), canvas.getByRole("button", { name: "原生按钮" }),
      canvas.getByRole("link", { name: "示例链接" }), canvas.getByRole("checkbox", { name: "复选框" }),
      canvas.getByRole("checkbox", { name: "卡片复选框" }),
      canvas.getByRole("switch", { name: "开关" }), canvas.getByRole("radio", { name: "第一个单选项" }),
      canvas.getByRole("button", { name: "切换按钮" }), await canvas.findByRole("slider", { name: "调整值" }),
      canvas.getByRole("tab", { name: "第一个标签" }), canvas.getByRole("button", { name: "折叠控件" }),
      canvas.getByText("原生折叠"),
    ];
    for (const control of controls) {
      const surface = control.closest('[data-slot="slider-thumb"], [data-slot="field-label"]:has(>[data-slot="field"])') ?? control;
      const slider = surface.matches('[data-slot="slider-thumb"]');
      await userEvent.click(slider ? surface : control);
      expect(getComputedStyle(surface).outlineStyle, control.outerHTML).toBe("none");
      if (slider) {
        control.focus();
        const previous = Number(control.getAttribute("aria-valuenow"));
        await userEvent.keyboard("{ArrowRight}");
        expect(Number(control.getAttribute("aria-valuenow"))).toBeGreaterThan(previous);
      }
      else { await userEvent.tab(); await userEvent.tab({ shift: true }); }
      expect(document.activeElement).toBe(control);
      expectKeyboardOutline(surface, mode);
      if (surface !== control) expect(getComputedStyle(control).outlineStyle).toBe("none");
      await userEvent.click(slider ? surface : control);
      expect(getComputedStyle(surface).outlineStyle).toBe("none");
      if (surface.matches('[data-slot="field-label"]')) {
        await userEvent.keyboard(" ");
        expectKeyboardOutline(surface, mode);
        expect(getComputedStyle(control).outlineStyle).toBe("none");
      }
    }
    const trigger = canvas.getByRole("button", { name: "打开菜单" });
    for (const keyboard of [false, true]) {
      if (keyboard) { trigger.focus(); await userEvent.keyboard("{Enter}"); }
      else await userEvent.click(trigger);
      const item = await within(document.body).findByRole("menuitem", { name: "菜单选项" });
      await userEvent.keyboard("{ArrowDown}");
      await waitFor(() => expect(document.activeElement).toBe(item));
      expectKeyboardOutline(item, mode);
      await userEvent.keyboard("{Escape}");
      await expect.element(trigger).toHaveFocus();
    }
  });

  test(`pointer menu hover does not borrow previous keyboard focus in ${mode}`, async () => {
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><DropdownMenu><DropdownMenuTrigger render={<Button />}>悬停菜单</DropdownMenuTrigger><DropdownMenuContent className="ui-theme" data-ui-theme={mode}><DropdownMenuItem>第一项</DropdownMenuItem><DropdownMenuItem>第二项</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PreviewModeProvider>);
    within(view.container).getByRole("button", { name: "悬停菜单" }).focus();
    await userEvent.keyboard("{Enter}");
    const first = await within(document.body).findByRole("menuitem", { name: "第一项" });
    const second = within(document.body).getByRole("menuitem", { name: "第二项" });
    await expect.element(first).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect.element(second).toHaveFocus();
    expectKeyboardOutline(second, mode);
    await userEvent.hover(first);
    expect(first.matches(":hover")).toBe(true);
    expect(getComputedStyle(first).outlineStyle).toBe("none");
  });

  test(`product card and capture keyboard focus stays visible independently of elevation in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme bg-body p-8" data-ui-theme={mode}>
      <NoteCollection notes={[{ ...editorNote, tags: ["检查"] }]} query="" onQueryChange={() => {}} searchPlaceholder="搜索" searchDisabled={false} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
      <Button>键盘焦点起点</Button>
      <QuickCapture vaultId="shadow-focus-test" rootNotes tags={[]} disabled={false} canImage={false} handle={{ current: null }} onRecorded={() => {}} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container);
    await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
    const open = canvas.getByRole("button", { name: `打开 ${editorNote.title}` });
    const card = open.closest(".ui-note-card")!;
    const restingShadow = getComputedStyle(card).boxShadow;
    canvas.getByRole("button", { name: "新建" }).focus();
    if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}");
    else await userEvent.tab();
    expect(open.matches(":focus-visible"), document.activeElement?.outerHTML).toBe(true);
    const background = getComputedStyle(view.container.querySelector("main")!).backgroundColor;
    expect(paintedContrast(getComputedStyle(card).outlineColor, background)).toBeGreaterThanOrEqual(3);
    expect(getComputedStyle(card).outlineStyle).toBe("solid");
    expect(getComputedStyle(card).boxShadow).toBe(restingShadow);
    expect(getComputedStyle(card).transform).toBe("none");
    await userEvent.hover(card);
    await waitFor(() => expect(getComputedStyle(card).boxShadow).not.toBe(restingShadow));
    await userEvent.unhover(card);
    await waitFor(() => expect(getComputedStyle(card).boxShadow).toBe(restingShadow));
    if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}");
    else await userEvent.tab();
    const tag = canvas.getByRole("button", { name: "筛选标签 检查" });
    expect(document.activeElement).toBe(tag);
    expectKeyboardOutline(tag, mode);
    expect(getComputedStyle(card).outlineStyle).toBe("none");
    const field = await canvas.findByRole("textbox", { name: "快速输入内容" });
    const group = field.closest('[data-slot="input-group"]')!;
    const restingCaptureShadow = getComputedStyle(group).boxShadow;
    expect(getComputedStyle(group).borderTopColor).toBe("rgba(0, 0, 0, 0)");
    canvas.getByRole("button", { name: "键盘焦点起点" }).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(field);
    await waitFor(() => expect(getComputedStyle(group).outlineStyle).toBe("solid"));
    await userEvent.click(field);
    expect(getComputedStyle(group).outlineStyle).toBe("none");
    expect(getComputedStyle(group).boxShadow).not.toBe(restingCaptureShadow);
    await userEvent.type(field, "Pointer draft");
    expect(getComputedStyle(group).outlineStyle).toBe("none");
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(field.matches(":focus-visible")).toBe(true);
    await waitFor(() => expect(getComputedStyle(group).outlineStyle).toBe("solid"));
    expect(paintedContrast(getComputedStyle(group).outlineColor, background)).toBeGreaterThanOrEqual(3);
    expect(getComputedStyle(group).boxShadow).not.toBe(restingCaptureShadow);
    await userEvent.click(field);
    expect(getComputedStyle(group).outlineStyle).toBe("none");
    expect(field.textContent).toBe("Pointer draft");
    await userEvent.click(canvas.getByRole("button", { name: "新建" }));
    await waitFor(() => expect(getComputedStyle(group).boxShadow).toBe(restingCaptureShadow));
  });

  test(`collection layout changes preserve borderless cards and surface controls in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><main className="web-app ui-theme bg-body p-8" data-ui-theme={mode}>
      <span className="hidden bg-surface" data-testid="expected-surface" />
      <NoteCollection home={{ tab: "recent", pinnedCount: 1, onTabChange: () => {} }} notes={[editorNote]} query="" onQueryChange={() => {}} searchPlaceholder="搜索" searchDisabled={false} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container);
    await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
    const card = canvas.getByRole("button", { name: `打开 ${editorNote.title}` }).closest(".ui-note-card")!;
    expect(getComputedStyle(card).borderTopWidth).toBe("0px");
    await userEvent.click(canvas.getByRole("button", { name: "列表布局" }));
    expect(getComputedStyle(card).borderTopWidth).toBe("0px");
    await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
    expect(card.matches(":hover")).toBe(false);
    expect(getComputedStyle(card).borderTopWidth).toBe("0px");
    const surface = getComputedStyle(canvas.getByTestId("expected-surface")).backgroundColor;
    await waitFor(() => expect(getComputedStyle(canvas.getByRole("button", { name: "卡片布局" })).backgroundColor).toBe(surface));
    await page.viewport(390, 844);
    await waitFor(() => expect(getComputedStyle(canvas.getByRole("tab", { name: "最近更新" })).backgroundColor).toBe(surface));
  });

  test(`mobile capture distinguishes pointer and keyboard focus in ${mode}`, async () => {
    await page.viewport(390, 844);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode}>
      <QuickCapture vaultId={`mobile-focus-${mode}`} rootNotes docked tags={[]} disabled={false} canImage={false} handle={{ current: null }} onRecorded={() => {}} />
    </main></PreviewModeProvider>);
    await userEvent.click(within(view.container).getByRole("button", { name: "打开快速记录" }));
    const field = await within(document.body).findByRole("textbox", { name: "快速输入内容" });
    const group = field.closest('[data-slot="input-group"]')!;
    await expect.element(field).toHaveFocus();
    expect(getComputedStyle(group).outlineStyle).toBe("none");
    expect(getComputedStyle(group).boxShadow).toBe("none");
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(field);
    expect(getComputedStyle(group).outlineStyle).toBe("solid");
    await userEvent.click(field);
    expect(getComputedStyle(group).outlineStyle).toBe("none");
    await userEvent.click(within(document.body).getByRole("button", { name: "收起快速记录" }));
  });

  // WebKit emulates the media query but not forced-color painting.
  test.skipIf(server.browser === "webkit")(`forced colors preserves popup borders and keyboard focus without shadows in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    await commands.setForcedColors("active");
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme bg-body p-8" data-ui-theme={mode}>
      <NoteCollection notes={[editorNote]} query="" onQueryChange={() => {}} searchPlaceholder="搜索" searchDisabled={false} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
      <Card data-testid="forced-raised-card">高对比浮起卡片</Card>
      <QuickCapture vaultId="shadow-forced-colors-test" rootNotes tags={[]} disabled={false} canImage={false} handle={{ current: null }} onRecorded={() => {}} />
      <Popover><PopoverTrigger render={<Button />}>打开高对比浮层</PopoverTrigger>
        <PopoverContent className="ui-theme" data-ui-theme={mode}><PopoverTitle>高对比浮层</PopoverTitle><Button>前一项</Button><Button>焦点项</Button></PopoverContent>
      </Popover>
    </main></PreviewModeProvider>);
    await userEvent.click(within(view.container).getByRole("button", { name: "卡片布局" }));
    const card = within(view.container).getByRole("button", { name: `打开 ${editorNote.title}` }).closest(".ui-note-card")!;
    await userEvent.hover(card);
    const field = within(view.container).getByRole("textbox", { name: "快速输入内容" });
    for (const surface of [card, within(view.container).getByTestId("forced-raised-card"), field.closest('[data-slot="input-group"]')!]) {
      const style = getComputedStyle(surface);
      expect(style.boxShadow).toBe("none");
      expect(style.borderTopStyle).toBe("solid");
      expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
      expect(paintedContrast(style.borderTopColor, style.backgroundColor)).toBeGreaterThanOrEqual(3);
    }
    await userEvent.click(field);
    const captureGroup = field.closest('[data-slot="input-group"]')!;
    expect(getComputedStyle(captureGroup).outlineStyle).toBe("none");
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(getComputedStyle(captureGroup).outlineStyle).toBe("solid");
    expect(paintedContrast(getComputedStyle(captureGroup).outlineColor, getComputedStyle(captureGroup).backgroundColor)).toBeGreaterThanOrEqual(3);
    await userEvent.click(within(view.container).getByRole("button", { name: "打开高对比浮层" }));
    const popup = await within(document.body).findByRole("dialog", { name: "高对比浮层" });
    const style = getComputedStyle(popup);
    expect(style.boxShadow).toBe("none");
    expect(style.borderTopStyle).toBe("solid");
    expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
    expect(paintedContrast(style.borderTopColor, style.backgroundColor)).toBeGreaterThanOrEqual(3);
    await userEvent.click(within(popup).getByRole("button", { name: "前一项" }));
    await userEvent.tab();
    const focused = within(popup).getByRole("button", { name: "焦点项" });
    expect(focused.matches(":focus-visible")).toBe(true);
    expect(getComputedStyle(focused).outlineStyle).toBe("solid");
    expect(paintedContrast(getComputedStyle(focused).outlineColor, style.backgroundColor)).toBeGreaterThanOrEqual(3);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(popup.isConnected).toBe(false));
    expect(within(view.container).getByRole("button", { name: "打开高对比浮层" })).toBe(document.activeElement);
  });

  test(`nested floating surfaces reuse high elevation and restore focus in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme bg-body" data-ui-theme={mode}>
      <Dialog><DialogTrigger render={<Button />}>打开外层</DialogTrigger><DialogContent><DialogHeader><DialogTitle>外层对话框</DialogTitle><DialogDescription>验证内外浮层可以使用同一投影等级。</DialogDescription></DialogHeader>
        <Popover><PopoverTrigger render={<Button />}>打开内层</PopoverTrigger><PopoverContent><PopoverTitle>内层浮层</PopoverTitle><Button>内部操作</Button></PopoverContent></Popover>
      </DialogContent></Dialog>
    </main></PreviewModeProvider>);
    const outerTrigger = within(view.container).getByRole("button", { name: "打开外层" });
    await userEvent.click(outerTrigger);
    const outer = await within(document.body).findByRole("dialog", { name: "外层对话框" });
    const innerTrigger = within(outer).getByRole("button", { name: "打开内层" });
    await userEvent.click(innerTrigger);
    const inner = await within(document.body).findByRole("dialog", { name: "内层浮层" });
    await expect.element(within(inner).getByRole("button", { name: "内部操作" })).toHaveFocus();
    expect(outer.classList.contains("shadow-high")).toBe(true);
    expect(inner.classList.contains("shadow-high")).toBe(true);
    expect(getComputedStyle(inner).boxShadow).toBe(getComputedStyle(outer).boxShadow);
    const bounds = inner.getBoundingClientRect();
    expect(inner.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2))).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(inner.isConnected).toBe(false));
    expect(outer.isConnected).toBe(true);
    await expect.element(innerTrigger).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(outer.isConnected).toBe(false));
    await expect.element(outerTrigger).toHaveFocus();
  });

  for (const elevation of ["shadow-low", "shadow-none", "shadow-flat", "shadow-document"]) {
    test(`floating boundaries survive ${elevation} in ${mode}`, async () => {
      await page.viewport(1024, 900);
      await commands.setReducedMotion("reduce");
      const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode}>
        <div data-testid="default-surface" className="surface-floating border shadow-high" />
        <div data-testid="target-surface" className={`surface-floating border ${elevation}`} />
        <Popover defaultOpen><PopoverTrigger render={<Button />}>打开阴影测试</PopoverTrigger>
          <PopoverContent className={`ui-theme ${elevation}`} data-ui-theme={mode} data-testid="overridden-popover"><PopoverTitle>浮层投影覆盖</PopoverTitle></PopoverContent>
        </Popover>
      </main></PreviewModeProvider>);
      const popup = await within(document.body).findByTestId("overridden-popover");
      const baseline = getComputedStyle(within(view.container).getByTestId("default-surface"));
      const target = getComputedStyle(within(view.container).getByTestId("target-surface"));
      await waitFor(() => {
        const actual = getComputedStyle(popup);
        expect(actual.borderTopColor).toBe(target.borderTopColor);
        if (elevation !== "shadow-none" && elevation !== "shadow-flat") expect(actual.borderTopColor).toBe("rgba(0, 0, 0, 0)");
        else expect(actual.borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
        expect(actual.borderTopWidth).toBe("1px");
        expect(actual.boxShadow).toBe(target.boxShadow);
        expect(actual.getPropertyValue("--tw-inset-shadow")).toBe(baseline.getPropertyValue("--tw-inset-shadow"));
        expect(popup.classList.contains("surface-floating")).toBe(true);
        expect(popup.classList.contains("shadow-high")).toBe(false);
      });
      if (mode === "dark") expect(getComputedStyle(popup).boxShadow).toContain("1px inset");
    });
  }

  for (const effect of ["shadow", "scale", "combined"] as const) for (const width of [375, 1024]) test(`independent card ${effect} preserves pointer and motion rules at ${width}px in ${mode}`, async () => {
    await page.viewport(width, 900);
    const shadowEnabled = effect !== "scale";
    const scaleEnabled = effect !== "shadow";
    const classes = [shadowEnabled && "ui-card-hover-shadow", scaleEnabled && "ui-card-hover-scale"].filter(Boolean).join(" ");
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode}>
      <Button>焦点起点</Button>
      <Card className={`ui-note-card ${classes}`} data-note-openable="true" data-testid="hover-card"><Button>打开笔记</Button></Card>
      <a href="#preview-card" className={classes} data-testid="preview-card"><Card>预览入口</Card></a>
    </main></PreviewModeProvider>);
    const canvas = within(view.container);
    const card = canvas.getByTestId("hover-card");
    const restingShadow = getComputedStyle(card).boxShadow;
    const wrapper = canvas.getByTestId("preview-card");
    for (const [trigger, surface] of [[card, card], [wrapper, wrapper.querySelector('[data-slot="card"]')!]]) {
      const restingSurfaceShadow = getComputedStyle(surface).boxShadow;
      await userEvent.hover(trigger);
      await Promise.all(surface.getAnimations().map(animation => animation.finished));
      await waitFor(() => {
        const actual = getComputedStyle(surface);
        expect(actual.transform).toBe(width >= 768 && scaleEnabled ? "matrix(1.02, 0, 0, 1.02, 0, 0)" : "none");
        if (width >= 768) expect(actual.transitionDuration.split(",").every(value => parseFloat(value) === 0.6)).toBe(true);
        if (width >= 768 && shadowEnabled) {
          expect(actual.boxShadow).not.toBe(restingSurfaceShadow);
          expect(actual.boxShadow).not.toContain("0px 0px 0px 1px");
          expect(actual.borderTopColor).toBe("rgba(0, 0, 0, 0)");
        }
        else expect(actual.boxShadow).toBe(restingSurfaceShadow);
      });
      await userEvent.unhover(trigger);
      await Promise.all(surface.getAnimations().map(animation => animation.finished));
      await waitFor(() => {
        expect(getComputedStyle(surface).boxShadow).toBe(restingSurfaceShadow);
        const transform = getComputedStyle(surface).transform;
        expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
      });
    }
    await userEvent.click(canvas.getByRole("button", { name: "焦点起点" }));
    await userEvent.tab();
    expect(canvas.getByRole("button", { name: "打开笔记" }).matches(":focus-visible")).toBe(true);
    expect(getComputedStyle(card).boxShadow).toBe(restingShadow);
    expect(getComputedStyle(card).transform).toBe("none");
    await userEvent.hover(card);
    await commands.setReducedMotion("reduce");
    await waitFor(() => {
      expect(getComputedStyle(card).transform).toBe("none");
      expect(parseFloat(getComputedStyle(card).transitionDuration)).toBe(0);
      if (width >= 768 && shadowEnabled) expect(getComputedStyle(card).boxShadow).not.toBe(restingShadow);
      else expect(getComputedStyle(card).boxShadow).toBe(restingShadow);
    });
  });
}

test("animated property confirmation reaches the viewport edge after opening completes", async () => {
  await page.viewport(320, 900);
  await commands.setReducedMotion("no-preference");
  let finishOpening = () => {};
  const opened = new Promise<void>(resolve => { finishOpening = resolve; });
  const view = render(<PreviewModeProvider mode="light"><AlertDialog.Root onOpenChangeComplete={open => { if (open) finishOpening(); }}>
    <AlertDialog.Trigger render={<Button />}>打开属性确认</AlertDialog.Trigger>
    <AlertDialog.Portal><AlertDialog.Backdrop className="note-property-backdrop bg-overlay" />
      <PropertyConfirmationPopup className="note-property-confirm surface-floating shadow-high" style={{ transitionDuration: "1.5s" }}>
        <AlertDialog.Title>删除属性？</AlertDialog.Title><AlertDialog.Description>验证普通入场动画结束后的布局。</AlertDialog.Description>
        <AlertDialog.Close render={<Button />}>取消</AlertDialog.Close>
      </PropertyConfirmationPopup>
    </AlertDialog.Portal>
  </AlertDialog.Root></PreviewModeProvider>);
  await userEvent.click(within(view.container).getByRole("button", { name: "打开属性确认" }));
  const popup = await within(document.body).findByRole("alertdialog");
  expect(parseFloat(getComputedStyle(popup).transitionDuration)).toBe(1.5);
  await opened;
  expect(popup.hasAttribute("data-starting-style")).toBe(false);
  expect(Math.abs(popup.getBoundingClientRect().bottom - innerHeight)).toBeLessThan(1);
}, 10_000);

for (const width of [320, 1024]) for (const type of ["select", "multiSelect"] as const) {
  test(`property option creation is first with many matches for ${type} at ${width}px`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const changes: unknown[] = [];
    const release = setStorybookRequestHandler(operation => operation === "getStatus" ? propertyLayoutStatus() : operation === "getPropertyLayout" ? emptyPropertyLayout() : {labels: {}, contentHash: "labels"});
    const options = Array.from({length: 30}, (_, index) => ({name: `area${index}`, color: "default" as const}));
    const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4">
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async change => { changes.push(change); }} savedProperties={{contentHash: editorNote.contentHash, writable: true, properties: [{name: "状态", type, value: type === "select" ? "" : [], options, editable: true}], tagProperty: {name: "tags", type: "list", value: [], editable: true}}} />
    </main></PreviewModeProvider>);
    try {
      await userEvent.click(await within(view.container).findByRole("button", {name: "编辑属性 状态"}));
      const popup = await within(document.body).findByRole("dialog", {name: "编辑属性 状态"});
      await userEvent.type(within(popup).getByRole("combobox", {name: "搜索或创建选项"}), "a");
      const create = await within(popup).findByRole("option", {name: "创建选项 a"});
      const list = within(popup).getByRole("listbox", {name: "可选选项"});
      expect(create.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom);
      expect(within(list).getAllByRole("option")[0]).toBe(create);
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(changes).toContainEqual(expect.objectContaining({name: "状态", type, value: type === "select" ? "a" : ["a"], definition: true})));
    } finally { release(); }
  });
}

for (const width of [320, 1024]) {
  test(`virtual tag rows measure wrapped names without overlap at ${width}px`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const tags = Array.from({length: 200}, (_, index) => ({name: `area/${String(index).padStart(3,'0')}/${'长标签名称'.repeat(index % 3 === 0 || index === 199 ? 12 : 1)}`}));
    const release = setStorybookRequestHandler(operation => operation === "getStatus" ? propertyLayoutStatus() : operation === "getPropertyLayout" ? emptyPropertyLayout() : operation === "listTags" ? {tags} : {labels:{},contentHash:"labels"});
    const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4"><NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async () => {}} savedProperties={{contentHash:editorNote.contentHash,writable:true,properties:[],tagProperty:{name:"tags",type:"list",value:[],editable:true}}} /></main></PreviewModeProvider>);
    try {
      await userEvent.click(await within(view.container).findByRole("button", {name:"编辑标签"}));
      const popup = await within(document.body).findByRole("dialog", {name:"编辑标签"});
      const list = within(popup).getByRole("listbox", {name:"可选属性标签"});
      const search = within(popup).getByRole("combobox", {name:"搜索或新建属性标签"});
      await within(list).findByRole("option", {name:`属性标签 ${tags[0].name}`});
      await userEvent.type(search,"a");
      await userEvent.keyboard("{End}");
      const last = await within(list).findByRole("option", {name:`属性标签 ${tags[199].name}`});
      await waitFor(() => {
        expect(last.getBoundingClientRect().top).toBeGreaterThanOrEqual(list.getBoundingClientRect().top - 1);
        expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom + 1);
      });
      const visible = within(list).getAllByRole("option");
      for (let index = 1; index < visible.length; index++) expect(visible[index].getBoundingClientRect().top).toBeGreaterThanOrEqual(visible[index-1].getBoundingClientRect().bottom - 1);
      expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    } finally { release(); }
  });
  test(`large tag lists mount a bounded window and retain keyboard and menu editing at ${width}px`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const changes: unknown[] = [];
    const tags = Array.from({length: 2000}, (_, index) => ({name: `area/tag${String(index).padStart(4, '0')}`}));
    const release = setStorybookRequestHandler(operation => operation === "getStatus" ? propertyLayoutStatus() : operation === "getPropertyLayout" ? emptyPropertyLayout() : operation === "listTags" ? {tags} : {labels: {}, contentHash: "labels"});
    const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4">
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async change => { changes.push(change); }} savedProperties={{contentHash: editorNote.contentHash, writable: true, properties: [], tagProperty: {name: "tags", type: "list", value: [], editable: true}}} />
    </main></PreviewModeProvider>);
    try {
      await userEvent.click(await within(view.container).findByRole("button", {name: "编辑标签"}));
      const popup = await within(document.body).findByRole("dialog", {name: "编辑标签"});
      const search = within(popup).getByRole("combobox", {name: "搜索或新建属性标签"});
      let list = within(popup).getByRole("listbox", {name: "可选属性标签"});
      await within(list).findByRole("option", {name: "属性标签 area/tag0000"});
      expect(within(list).getAllByRole("option").length).toBeLessThan(40);
      await userEvent.type(search, "a");
      await within(list).findByRole("option", {name: "新建标签 a"});
      await userEvent.keyboard("{ArrowDown>20}");
      const twentieth = await within(list).findByRole("option", {name: "属性标签 area/tag0019"});
      await waitFor(() => expect(search.getAttribute("aria-activedescendant")).toBe(twentieth.id));
      await userEvent.keyboard("{End}");
      const last = await within(list).findByRole("option", {name: "属性标签 area/tag1999"});
      await waitFor(() => expect(search.getAttribute("aria-activedescendant")).toBe(last.id));
      expect(last.getAttribute("aria-setsize")).toBe("2001");
      expect(last.getAttribute("aria-posinset")).toBe("2001");
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(changes).toContainEqual({name: "tags", type: "list", value: ["area/tag1999"]}));
      await userEvent.click(within(popup).getByRole("button", {name: "移除属性标签 area/tag1999"}));
      await userEvent.clear(search);
      await userEvent.type(search, "area/tag1999");
      list = within(popup).getByRole("listbox", {name: "可选属性标签"});
      await within(list).findByRole("option", {name: "属性标签 area/tag1999"});
      expect(within(list).getAllByRole("option")).toHaveLength(1);
      await userEvent.clear(search);
      list = within(popup).getByRole("listbox", {name: "可选属性标签"});
      await within(list).findByRole("option", {name: "属性标签 area/tag0000"});
      await userEvent.click(within(popup).getByRole("button", {name: "设置标签颜色 area/tag0000"}));
      const menu = await within(document.body).findByRole("menu", {name: "标签颜色 area/tag0000"});
      list.scrollTop = list.scrollHeight;
      list.dispatchEvent(new Event("scroll"));
      await within(list).findByRole("option", {name: "属性标签 area/tag1999"});
      expect(menu.isConnected).toBe(true);
      expect(within(list).getAllByRole("option").length).toBeLessThan(40);
      await userEvent.keyboard("{Escape}");
      await userEvent.type(search, "a");
      const create = await within(list).findByRole("option", {name: "新建标签 a"});
      await waitFor(() => expect(create.getBoundingClientRect().top).toBeGreaterThanOrEqual(list.getBoundingClientRect().top));
      expect(create.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom);
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(changes).toContainEqual({name: "tags", type: "list", value: ["a"]}));
    } finally { release(); }
  });
}

for (const width of [320, 1024]) for (const theme of ["light", "dark"] as const) {
  test(`single-letter tag creation is first with many matches at ${width}px in ${theme}`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const changes: unknown[] = [];
    const release = setStorybookRequestHandler(operation => operation === "getStatus" ? propertyLayoutStatus() : operation === "getPropertyLayout" ? emptyPropertyLayout() : operation === "listTags" ? { tags: Array.from({length: 30}, (_, index) => ({name: `area/tag${index}`})) } : {labels: {}, contentHash: "labels"});
    const view = render(<PreviewModeProvider mode={theme}><main className="ui-theme p-4" data-ui-theme={theme}>
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async change => { changes.push(change); }} savedProperties={{contentHash: editorNote.contentHash, writable: true, properties: [], tagProperty: {name: "tags", type: "list", value: [], editable: true}}} />
    </main></PreviewModeProvider>);
    try {
      await userEvent.click(await within(view.container).findByRole("button", {name: "编辑标签"}));
      const popup = await within(document.body).findByRole("dialog", {name: "编辑标签"});
      await userEvent.type(within(popup).getByRole("combobox", {name: "搜索或新建属性标签"}), "a");
      const create = await within(popup).findByRole("option", {name: "新建标签 a"});
      const list = within(popup).getByRole("listbox", {name: "可选属性标签"});
      expect(within(list).getAllByRole("option")[0]).toBe(create);
      expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
      expect(list.scrollTop).toBe(0);
      expect(create.getBoundingClientRect().top).toBeGreaterThanOrEqual(list.getBoundingClientRect().top);
      expect(create.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom);
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(changes).toContainEqual({name: "tags", type: "list", value: ["a"]}));
    } finally { release(); }
  });
}

for (const width of [320, 1024]) for (const theme of ["light", "dark"] as const) {
  test(`property editing and confirmation surfaces stay consistent at ${width}px in ${theme}`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const changes: unknown[] = [];
    const release = setStorybookRequestHandler(operation => {
      if (operation === "getStatus") return propertyLayoutStatus();
      if (operation === "getPropertyLayout") return emptyPropertyLayout();
      if (operation === "getPropertyLabels") return { labels: {}, contentHash: "labels" };
      if (operation === "listTags") return { tags: [{ name: "开发" }] };
      throw new Error(`Unexpected property operation: ${operation}`);
    });
    const view = render(<PreviewModeProvider mode={theme}><main className="ui-theme" data-ui-theme={theme}>
      <div data-testid="floating-reference" className="surface-floating shadow-high border" />
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async change => { changes.push(change); }} onChangeTag={async (from, to) => { changes.push({ from, to }); }} savedProperties={{
        contentHash: editorNote.contentHash, writable: true,
        tagProperty: { name: "tags", type: "list", value: ["设计"], editable: true },
        properties: [
          { name: "摘要", type: "text", value: "保留原值", editable: true },
          { name: "得分", type: "number", value: "8.5", editable: true },
          { name: "领域", type: "multiSelect", value: ["设计"], options: [{ name: "设计", color: "blue" }], editable: true },
        ],
      }} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container), body = within(document.body);
    try {
      for (const name of ["摘要", "得分"]) {
        await userEvent.click(canvas.getByRole("button", { name: `编辑属性 ${name}` }));
        const input = await body.findByRole("textbox", { name: "属性值" });
        const style = getComputedStyle(input.closest("form")!);
        expect(style.boxShadow).toBe("none");
        expect(style.outlineStyle).toBe("solid");
        await userEvent.keyboard("{Escape}");
      }
      const checkConfirmation = async () => {
        const popup = await body.findByRole("alertdialog");
        const reference = getComputedStyle(canvas.getByTestId("floating-reference"));
        await waitFor(() => {
          const style = getComputedStyle(popup), rect = popup.getBoundingClientRect();
          expect(style.boxShadow).toBe(reference.boxShadow);
          expect(style.borderTopColor).toBe(reference.borderTopColor);
          expect(style.borderTopWidth).toBe("1px");
          expect(rect.left).toBeGreaterThanOrEqual(-1);
          expect(rect.right).toBeLessThanOrEqual(width + 1);
          if (width < 768) expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThan(1);
        });
        if (width < 768) expect(popup.dataset.side).toBe("bottom");
        await userEvent.click(within(popup).getByRole("button", { name: "取消" }));
        await waitFor(() => expect(body.queryByRole("alertdialog")).toBeNull());
      };
      await userEvent.click(canvas.getByRole("button", { name: "属性菜单 摘要" }));
      await userEvent.click(await body.findByRole("menuitem", { name: "删除属性" }));
      await checkConfirmation();
      await userEvent.click(canvas.getByRole("button", { name: "属性菜单 摘要" }));
      const types = await body.findByRole("menuitem", { name: /^类型/ });
      await userEvent.click(types);
      await userEvent.click(await body.findByRole("menuitemradio", { name: "多选" }));
      await checkConfirmation();
      for (const kind of ["选项", "标签"]) {
        await userEvent.click(canvas.getByRole("button", { name: kind === "选项" ? "编辑属性 领域" : "编辑标签" }));
        await userEvent.click(await body.findByRole("button", { name: `管理${kind} ${kind === "选项" ? "设计" : "开发"}` }));
        await userEvent.click(await body.findByRole("menuitem", { name: `删除${kind}` }));
        await checkConfirmation();
        await userEvent.keyboard("{Escape}");
        await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
      }
      expect(changes).toEqual([]);
    } finally {
      release();
    }
  }, 20_000);

  test(`property ordering and visibility persist without editing note data at ${width}px in ${theme}`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const fixture = propertyLayoutFixture(`layout-${width}-${theme}`), changes: unknown[] = [];
    const widget = () => <PreviewModeProvider mode={theme}><main className="ui-theme p-4" data-ui-theme={theme}>
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={preferenceProperties} onApply={async change => { changes.push(change); }} />
    </main></PreviewModeProvider>;
    let view = render(widget());
    const body = within(document.body);
    const names = () => within(view.container).getAllByRole("button", {name: /^属性菜单 /}).map(button => button.getAttribute("aria-label")!.replace("属性菜单 ", ""));
    const visibility = async (name: string, choice: string) => {
      await userEvent.click(within(view.container).getByRole("button", {name: `属性菜单 ${name}`}));
      await userEvent.click(await body.findByRole("menuitem", {name: /^属性可见性/}));
      await userEvent.click(await body.findByRole("menuitemradio", {name: choice}));
      await waitFor(() => expect(body.queryByRole("menuitemradio", {name: choice})).toBeNull());
    };
    try {
      let canvas = within(view.container);
      const summary = await canvas.findByRole("button", {name: "编辑属性 摘要"});
      expect(summary.closest(".note-property-row")!.getBoundingClientRect().height).toBeGreaterThan(canvas.getByRole("button", {name: "编辑属性 零值"}).closest(".note-property-row")!.getBoundingClientRect().height);
      await userEvent.click(canvas.getByRole("button", {name: "属性菜单 摘要"}));
      const move = await body.findByRole("menuitem", {name: "下移"});
      move.focus();
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(names().indexOf("零值")).toBeLessThan(names().indexOf("摘要")));
      await visibility("空值", "为空时隐藏");
      await waitFor(() => expect(canvas.queryByRole("button", {name: "属性菜单 空值"})).toBeNull());
      await visibility("零值", "为空时隐藏");
      expect(canvas.getByRole("button", {name: "编辑属性 零值"})).toHaveProperty("textContent", "0");
      await visibility("未完成", "为空时隐藏");
      expect(canvas.getByRole("checkbox", {name: "切换属性 未完成"}).getAttribute("aria-checked")).toBe("false");
      await visibility("摘要", "始终隐藏");
      await waitFor(() => expect(canvas.queryByRole("button", {name: "属性菜单 摘要"})).toBeNull());
      const hidden = await canvas.findByRole("button", {name: "更多属性"});
      await waitFor(() => expect(document.activeElement).toBe(hidden));
      await userEvent.click(hidden);
      await canvas.findByRole("button", {name: "属性菜单 空值"});
      await visibility("摘要", "始终显示");
      await userEvent.click(await canvas.findByRole("button", {name: "收起"}));
      await waitFor(() => expect(canvas.queryByRole("button", {name: "属性菜单 空值"})).toBeNull());
      expect(fixture.layout().visibility["property:other-note"]).toBe("hidden");
      expect(fixture.layout().order).toContain("property:other-note");
      expect(changes).toEqual([]);
      expect(fixture.writes.length).toBeGreaterThan(0);
      view.unmount();
      view = render(widget());
      canvas = within(view.container);
      await canvas.findByRole("button", {name: "更多属性"});
      await waitFor(() => expect(canvas.queryByRole("button", {name: "属性菜单 空值"})).toBeNull());
      expect(canvas.getByRole("button", {name: "编辑属性 摘要"})).toBeTruthy();
      expect(names().indexOf("零值")).toBeLessThan(names().indexOf("摘要"));
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
      expect(changes).toEqual([]);
    } finally { fixture.release(); }
  }, 25_000);

  test(`component Docs remain usable at ${width}px in ${theme}`, async () => {
    await page.viewport(width, 900);
    for (const component of Object.keys(componentDocs) as ComponentKey[]) {
      const view = render(<PreviewModeProvider mode={theme}><ComponentDocs component={component} /></PreviewModeProvider>);
      for (const tab of ["Overview", "Properties", "Accessibility"]) {
        await userEvent.click(within(view.container).getByRole("tab", { name: tab }));
        await waitFor(() => {
          expect(document.documentElement.scrollWidth, `${component} ${tab} page overflow`).toBeLessThanOrEqual(width + 1);
          const panel = within(view.container).getByRole("tabpanel", { name: tab });
          expect(panel.getBoundingClientRect().width).toBeGreaterThan(0);
        });
      }
      view.unmount();
    }
  }, 60_000);
}

test("property Story carrier aligns title, description and controls across breakpoints", async () => {
  await page.viewport(320, 900);
  await commands.setReducedMotion("reduce");
  const release = propertyStoryMeta.beforeEach();
  const PropertyStory = propertyStoryMeta.component;
  const view = render(<PreviewModeProvider mode="light"><PropertyStory {...propertyStoryMeta.args} {...LayoutStress.args} /></PreviewModeProvider>);
  try {
    const canvas = within(view.container);
    const title = canvas.getByRole("heading", {name: "笔记属性"});
    const description = canvas.getByText("标签、文本、数字、选择、日期、复选框和图片共用原业务逻辑。此示例仅修改内存数据。");
    await canvas.findByRole("button", {name: "更多属性"});
    await document.fonts.ready;
    for (const width of [320, 390, 640, 767, 768, 820, 1024, 1180, 1440]) {
      await page.viewport(width, 900);
      const checkAlignment = () => {
        const start = title.getBoundingClientRect().left + parseFloat(getComputedStyle(title).paddingLeft);
        expect(description.getBoundingClientRect().left, `${width}px description`).toBeCloseTo(start, 1);
        const names = view.container.querySelectorAll<HTMLElement>(".note-property-name-cell");
        expect(names.length).toBeGreaterThan(4);
        for (const name of names) expect(name.querySelector("svg")!.getBoundingClientRect().left, `${width}px ${name.textContent}`).toBeCloseTo(start, 1);
        const toggle = canvas.getByRole("button", {name: /^(更多属性|收起)$/});
        expect(toggle.querySelector("svg")!.getBoundingClientRect().left, `${width}px toggle`).toBeCloseTo(start, 1);
        const add = canvas.queryByRole("button", {name: "添加属性"});
        if (add) expect(add.querySelector("svg")!.getBoundingClientRect().left, `${width}px add`).toBeCloseTo(start, 1);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
      };
      await waitFor(checkAlignment);
      await userEvent.click(canvas.getByRole("button", {name: "更多属性"}));
      await waitFor(checkAlignment);
      await userEvent.click(canvas.getByRole("button", {name: "收起"}));
      await waitFor(checkAlignment);
    }
  } finally { view.unmount(); release(); }
}, 30_000);

for (const mode of ["light", "dark"] as const) for (const width of [390, 1024]) {
  test(`raised controls and floating surfaces keep one boundary at ${width}px in ${mode}`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme p-4" data-ui-theme={mode}>
      <div data-testid="border-reference" className="border border-border" />
      <div data-testid="floating-reference" className="surface-floating border shadow-high" />
      <InputFocusFixture mode={mode} />
      <MobileActionGroupProvider enabled={width < 768}><Slider defaultValue={[50]} aria-label="Web边缘滑块" /></MobileActionGroupProvider>
      <Popover><PopoverTrigger render={<Button />}>打开边缘浮层</PopoverTrigger><PopoverContent><PopoverTitle>边缘浮层</PopoverTitle></PopoverContent></Popover>
      <Sheet><SheetTrigger render={<Button />}>打开底部边缘</SheetTrigger><SheetContent side="bottom" swipeToClose showCloseButton={false}>
        <SheetHeader><SheetTitle>底部边缘</SheetTitle><SheetDescription>关闭按钮和浮层各保留自身边缘。</SheetDescription><SheetCloseButton /></SheetHeader>
      </SheetContent></Sheet>
    </main></PreviewModeProvider>);
    const canvas = within(view.container), body = within(document.body);
    const slider = await canvas.findByRole("slider", {name: "调整值"}), thumb = slider.closest('[data-slot="slider-thumb"]')!;
    const sliderStyle = getComputedStyle(thumb);
    expect.soft(sliderStyle.borderTopColor, "provider-free slider boundary").toBe(getComputedStyle(canvas.getByTestId("border-reference")).borderTopColor);
    const webThumb = canvas.getByRole("slider", {name: "Web边缘滑块"}).closest('[data-slot="slider-thumb"]')!;
    expect(getComputedStyle(webThumb).borderTopColor, "Web slider boundary").toBe(width < 768 ? "rgba(0, 0, 0, 0)" : getComputedStyle(canvas.getByTestId("border-reference")).borderTopColor);
    expect(sliderStyle.boxShadow).not.toBe("none");
    slider.focus();
    const previous = Number(slider.getAttribute("aria-valuenow"));
    await userEvent.keyboard("{ArrowRight}");
    expect(Number(slider.getAttribute("aria-valuenow"))).toBeGreaterThan(previous);
    expectKeyboardOutline(thumb, mode);
    const checkFloating = (surface: HTMLElement) => {
      const style = getComputedStyle(surface);
      expect(style.borderTopColor).toBe("rgba(0, 0, 0, 0)");
      expect(style.boxShadow).toBe(getComputedStyle(canvas.getByTestId("floating-reference")).boxShadow);
      expect(style.boxShadow).not.toBe("none");
    };
    const sheetTrigger = canvas.getByRole("button", {name: "打开底部边缘"});
    await userEvent.click(sheetTrigger);
    const sheet = await body.findByRole("dialog", {name: "底部边缘"});
    checkFloating(sheet);
    const close = within(sheet).getByRole("button", {name: "关闭"}), closeStyle = getComputedStyle(close);
    expect.soft(closeStyle.borderTopColor, "provider-free sheet close boundary").toBe(width < 768 ? getComputedStyle(canvas.getByTestId("border-reference")).borderTopColor : "rgba(0, 0, 0, 0)");
    expect(close.getBoundingClientRect().width).toBe(width < 768 ? 36 : 32);
    if (width < 768) expect(closeStyle.boxShadow).not.toBe("none");
    else expect(closeStyle.boxShadow).toBe("none");
    await userEvent.click(close);
    await waitFor(() => expect(sheet.isConnected).toBe(false));
    expect(document.activeElement).toBe(sheetTrigger);
    const triggers = [
      canvas.getByRole("button", {name: "打开边缘浮层"}), canvas.getByRole("button", {name: "打开菜单"}),
      canvas.getByRole("button", {name: "打开自动聚焦输入"}), canvas.getByLabelText("选择器", {exact: true}), canvas.getByLabelText("搜索选择", {exact: true}),
    ];
    const slots = ["popover-content", "dropdown-menu-content", "dialog-content", "select-content", "combobox-content"];
    for (const [index, trigger] of triggers.entries()) {
      await userEvent.click(trigger);
      if (index === 4) await userEvent.keyboard("{ArrowDown}");
      const surface = await waitFor(() => {
        const element = document.querySelector<HTMLElement>(`[data-slot="${slots[index]}"]`);
        expect(element).not.toBeNull();
        return element!;
      });
      await expect.element(surface).toBeVisible();
      checkFloating(surface);
      await userEvent.keyboard("{Escape}");
      await expect.element(surface).not.toBeVisible();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    }
  }, 25_000);
}

for (const mode of ["light", "dark"] as const) test.skipIf(server.browser === "webkit")(`mobile raised controls retain visible boundaries in forced colors in ${mode}`, async () => {
  await page.viewport(390, 900);
  await commands.setReducedMotion("reduce");
  await commands.setForcedColors("active");
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode}>
    <InputFocusFixture mode={mode} />
    <MobileActionGroupProvider enabled><Slider defaultValue={[50]} aria-label="Web高对比滑块" /></MobileActionGroupProvider>
    <Sheet><SheetTrigger render={<Button />}>打开高对比底部面板</SheetTrigger><SheetContent side="bottom" swipeToClose showCloseButton={false}>
      <SheetHeader><SheetTitle>高对比底部面板</SheetTitle><SheetDescription>系统边缘替代阴影。</SheetDescription><SheetCloseButton /></SheetHeader>
    </SheetContent></Sheet>
  </main></PreviewModeProvider>);
  const canvas = within(view.container), body = within(document.body);
  for (const name of ["调整值", "Web高对比滑块"]) {
    const slider = await canvas.findByRole("slider", {name}), thumb = slider.closest('[data-slot="slider-thumb"]')!;
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    for (const property of ["borderTopColor", "outlineColor"] as const) expect(paintedContrast(getComputedStyle(thumb)[property], getComputedStyle(thumb).backgroundColor)).toBeGreaterThanOrEqual(3);
    expect(getComputedStyle(thumb).boxShadow).toBe("none");
    expect(getComputedStyle(thumb).outlineStyle).toBe("solid");
  }
  const trigger = canvas.getByRole("button", {name: "打开高对比底部面板"});
  await userEvent.click(trigger);
  const sheet = await body.findByRole("dialog", {name: "高对比底部面板"});
  const close = within(sheet).getByRole("button", {name: "关闭"});
  await userEvent.tab();
  await waitFor(() => expect(document.activeElement).toBe(close));
  const style = getComputedStyle(close);
  expect(style.boxShadow).toBe("none");
  expect(style.outlineStyle).toBe("solid");
  for (const property of ["borderTopColor", "outlineColor"] as const) expect(paintedContrast(style[property], style.backgroundColor), `${property}: ${style[property]} on ${style.backgroundColor}; outline: ${style.outlineColor}`).toBeGreaterThanOrEqual(3);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(sheet.isConnected).toBe(false));
  expect(document.activeElement).toBe(trigger);
});

for (const mode of ["light", "dark"] as const) test(`ActionGroup shares one surface for single and multiple keyboard actions in ${mode}`, async () => {
  await page.viewport(390, 900);
  await commands.setReducedMotion("reduce");
  const clicks: string[] = [];
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme flex flex-col items-start gap-4 p-8" data-ui-theme={mode}>
    <div data-testid="group-shadow" className="bg-surface shadow-control" />
    <div data-testid="no-shadow" className="shadow-none" />
    <Button>操作起点</Button>
    <ActionGroup aria-label="单个操作"><Button variant="ghost" size="icon" aria-label="单个按钮" onClick={() => clicks.push("single")}>+</Button></ActionGroup>
    <ActionGroup aria-label="多个操作"><Button variant="ghost" size="icon" aria-label="第一个按钮" onClick={() => clicks.push("first")}>+</Button><Button variant="ghost" size="icon" disabled aria-label="禁用按钮" onClick={() => clicks.push("disabled")}>−</Button><Button variant="ghost" size="icon" aria-label="最后按钮" onClick={() => clicks.push("last")}>×</Button></ActionGroup>
  </main></PreviewModeProvider>);
  const canvas = within(view.container);
  for (const width of [390, 1024]) {
    await page.viewport(width, 900);
    for (const [label, count] of [["单个操作", 1], ["多个操作", 3]] as const) {
      const group = canvas.getByLabelText(label), rect = group.getBoundingClientRect(), style = getComputedStyle(group);
      expect(group.getAttribute("data-slot")).toBe("action-group");
      expect(group.hasAttribute("data-mobile-actions")).toBe(false);
      expect(rect.height).toBe(40);
      expect(rect.width).toBe(count * 36 + 4);
      expect(style.padding).toBe("2px");
      expect(style.gap).toBe("0px");
      expect(style.boxShadow).toBe(getComputedStyle(canvas.getByTestId("group-shadow")).boxShadow);
      expect(style.backgroundColor).toBe(getComputedStyle(canvas.getByTestId("group-shadow")).backgroundColor);
      for (const button of group.querySelectorAll("button")) {
        expect(button.getBoundingClientRect().width).toBe(36);
        expect(button.getBoundingClientRect().height).toBe(36);
        expect(getComputedStyle(button).borderTopColor).toBe("rgba(0, 0, 0, 0)");
        expect(["none", getComputedStyle(canvas.getByTestId("no-shadow")).boxShadow]).toContain(getComputedStyle(button).boxShadow);
      }
    }
  }
  canvas.getByRole("button", {name: "操作起点"}).focus();
  for (const label of ["单个按钮", "第一个按钮", "最后按钮"]) {
    if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}");
    else await userEvent.tab();
    const button = canvas.getByRole("button", {name: label});
    expect(document.activeElement).toBe(button);
    expectKeyboardOutline(button, mode);
    expectUnclippedOutline(button);
    await userEvent.keyboard("{Enter}");
  }
  const disabled = canvas.getByRole("button", {name: "禁用按钮"});
  expect(disabled).toHaveProperty("disabled", true);
  disabled.click();
  expect(clicks).toEqual(["single", "first", "last"]);
});

for (const mode of ["light", "dark"] as const) test(`Web ActionGroup sizes share pointer, disabled and keyboard feedback in ${mode}`, async () => {
  await page.viewport(390, 900);
  await commands.setReducedMotion("reduce");
  const calls: string[] = [];
  const view = render(<PreviewModeProvider mode={mode}><MobileActionGroupProvider enabled><main className="ui-theme flex flex-col items-start gap-4 p-8" data-ui-theme={mode}>
    <div data-testid="hover-reference" className="bg-overlay-hover" />
    <div data-testid="frame-reference" className="bg-surface shadow-control" />
    <div data-testid="page-reference" className="bg-body" />
    <Button>交互起点</Button>
    {(["default", "lg"] as const).map(size => <div key={size} className="flex gap-4">
      <ActionGroup size={size} aria-label={`${size} 单个操作`}><Button variant="ghost" size="icon" aria-label={`${size} 单个按钮`} onClick={() => calls.push(`${size}-single`)}>+</Button></ActionGroup>
      <ActionGroup size={size} aria-label={`${size} 多个操作`}><Button variant="ghost" size="icon" aria-label={`${size} 首个按钮`} onClick={() => calls.push(`${size}-first`)}>+</Button><Button variant="ghost" size="icon" disabled aria-label={`${size} 禁用按钮`} onClick={() => calls.push("disabled")}>−</Button></ActionGroup>
    </div>)}
    <Sheet onOpenChange={open => calls.push(`sheet-${open}`)}><SheetTrigger render={<Button />}>打开交互面板</SheetTrigger><SheetContent side="bottom" swipeToClose showCloseButton={false}><SheetHeader><SheetTitle>交互面板</SheetTitle><SheetDescription>真实关闭动作。</SheetDescription><SheetCloseButton /></SheetHeader></SheetContent></Sheet>
    <Dialog onOpenChange={open => calls.push(`dialog-${open}`)}><DialogTrigger render={<Button />}>打开交互对话框</DialogTrigger><DialogContent><DialogHeader><DialogTitle>交互对话框</DialogTitle><DialogDescription>默认关闭动作。</DialogDescription></DialogHeader></DialogContent></Dialog>
  </main></MobileActionGroupProvider></PreviewModeProvider>);
  const canvas = within(view.container), body = within(document.body);
  const hoverColor = getComputedStyle(canvas.getByTestId("hover-reference")).backgroundColor;
  const press = async (button: HTMLElement) => {
    await userEvent.hover(button);
    await waitFor(() => expect(getComputedStyle(button).backgroundColor).toBe(hoverColor));
    const before = button.getBoundingClientRect(), group = button.closest<HTMLElement>('[data-slot="action-group"]')!;
    const groupBox = group.getBoundingClientRect(), shadow = getComputedStyle(group).boxShadow, count = calls.length;
    const click = Promise.resolve(userEvent.click(button, {delay: 400}));
    try {
      await waitFor(() => expect(button.matches(":active")).toBe(true));
      expect(getComputedStyle(button).backgroundColor).toBe(hoverColor);
      expect(button.getBoundingClientRect().top).toBeCloseTo(before.top, 1);
      expect(getComputedStyle(button).outlineStyle).toBe("none");
      expect(group.getBoundingClientRect().height).toBe(groupBox.height);
      expect(getComputedStyle(group).boxShadow).toBe(shadow);
      expect(calls).toHaveLength(count);
    } finally { await click; }
    expect(calls).toHaveLength(count + 1);
  };
  for (const size of ["default", "lg"] as const) {
    const inner = size === "lg" ? 44 : 36, outer = inner + 4;
    for (const label of ["单个", "多个"]) {
      const group = canvas.getByRole("group", {name: `${size} ${label}操作`});
      expect(group.getBoundingClientRect().height).toBe(outer);
      expect(group.getBoundingClientRect().width).toBe((label === "单个" ? 1 : 2) * inner + 4);
      expect(getComputedStyle(group).backgroundColor).toBe(getComputedStyle(canvas.getByTestId("frame-reference")).backgroundColor);
      expect(getComputedStyle(group).boxShadow).toBe(getComputedStyle(canvas.getByTestId("frame-reference")).boxShadow);
      expect(getComputedStyle(group).backgroundColor).not.toBe(getComputedStyle(canvas.getByTestId("page-reference")).backgroundColor);
      for (const button of group.querySelectorAll("button")) { expect(button.getBoundingClientRect().width).toBe(inner); expect(button.getBoundingClientRect().height).toBe(inner); }
    }
    await press(canvas.getByRole("button", {name: `${size} 单个按钮`}));
    await press(canvas.getByRole("button", {name: `${size} 首个按钮`}));
    const disabled = canvas.getByRole("button", {name: `${size} 禁用按钮`}), count = calls.length;
    await userEvent.click(disabled, {force: true});
    disabled.click();
    expect(calls).toHaveLength(count);
    expect(getComputedStyle(disabled).opacity).toBe("0.5");
    expect(disabled.matches(":active")).toBe(false);
    expect(document.activeElement).not.toBe(disabled);
  }
  canvas.getByRole("button", {name: "交互起点"}).focus();
  for (const name of ["default 单个按钮", "default 首个按钮", "lg 单个按钮", "lg 首个按钮"]) {
    if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}");
    else await userEvent.tab();
    const button = canvas.getByRole("button", {name});
    expect(document.activeElement).toBe(button);
    expectKeyboardOutline(button, mode);
    expectUnclippedOutline(button);
  }
  for (const label of ["交互面板", "交互对话框"]) {
    const trigger = canvas.getByRole("button", {name: `打开${label}`});
    await userEvent.click(trigger);
    const popup = await body.findByRole("dialog", {name: label}), close = within(popup).getByRole("button", {name: "关闭"});
    await waitFor(() => expect(close.getBoundingClientRect().width).toBe(36));
    close.focus();
    await userEvent.keyboard("{ArrowRight}");
    expectKeyboardOutline(close, mode);
    expectUnclippedOutline(close);
    await press(close);
    await waitFor(() => { expect(popup.isConnected).toBe(false); expect(document.activeElement).toBe(trigger); });
  }
}, 20_000);

for (const mode of ["light", "dark"] as const) test(`mobile Web action groups cross portals while desktop and provider-free controls keep their baseline in ${mode}`, async () => {
  await commands.setReducedMotion("reduce");
  const pixels = document.createElement("canvas");
  pixels.width = 16; pixels.height = 8;
  pixels.getContext("2d")!.fillRect(0, 0, 16, 8);
  const blob = await new Promise<Blob>(resolve => pixels.toBlob(value => resolve(value!), "image/png"));
  const releaseAssets = setStorybookBrowserAssets({"assets/actions.png": blob});
  try {
    for (const scenario of [{name: "Web mobile", width: 390, provider: true}, {name: "Web desktop", width: 1024, provider: true}, {name: "without provider", width: 390, provider: false}]) {
      await page.viewport(scenario.width, 900);
      const grouped = scenario.provider && scenario.width < 768;
      const changes: string[] = [], errors: string[] = [];
      let editor: import("@tiptap/react").Editor | null = null;
      const content = <main className="ui-theme grid gap-4 p-4" data-ui-theme={mode}>
        <div data-testid="group-shadow" className="bg-surface shadow-control" /><div data-testid="no-shadow" className="shadow-none" /><div data-testid="page-color" className="bg-body" />
        <div data-testid="group-token-shadow" style={{boxShadow: "var(--shadow-control)"}} />
        <QuickCapture vaultId={`actions-disabled-${scenario.name}-${mode}`} rootNotes docked tags={[]} disabled canImage={false} handle={{current: null}} onRecorded={() => errors.push("disabled capture recorded")} />
        <Sheet><SheetTrigger render={<Button />}>打开自定义面板</SheetTrigger><SheetContent side="bottom" swipeToClose showCloseButton={false}><SheetHeader><SheetTitle>自定义面板</SheetTitle><SheetDescription>真实自定义关闭控件。</SheetDescription><SheetCloseButton /></SheetHeader></SheetContent></Sheet>
        <Sheet><SheetTrigger render={<Button />}>打开默认面板</SheetTrigger><SheetContent><SheetHeader><SheetTitle>默认面板</SheetTitle><SheetDescription>真实默认关闭控件。</SheetDescription></SheetHeader></SheetContent></Sheet>
        <Sheet><SheetTrigger render={<Button />}>打开禁用面板</SheetTrigger><SheetContent side="bottom" swipeToClose showCloseButton={false}><SheetHeader><SheetTitle>禁用面板</SheetTitle><SheetDescription>禁用关闭按钮保留其语义。</SheetDescription><SheetCloseButton disabled /></SheetHeader></SheetContent></Sheet>
        <Dialog><DialogTrigger render={<Button />}>打开默认对话框</DialogTrigger><DialogContent><DialogHeader><DialogTitle>默认对话框</DialogTitle><DialogDescription>真实默认对话框关闭控件。</DialogDescription></DialogHeader></DialogContent></Dialog>
        <VaultImage source="memocard-asset://vault/assets/actions.png" alt="内存封面" width={80} height={40} />
        <MermaidContent source={"graph LR\nA[开始] --> B[结束]"}><pre>graph LR A--&gt;B</pre></MermaidContent>
        <RichMarkdownEditor value={"说明文字\n\n![编辑封面](memocard-asset://vault/assets/actions.png)"} notePath="notes/actions.md" disabled={false} autoFocus={false} onChange={value => changes.push(value)} onSave={() => {}} onError={error => errors.push(error)} onEditorReady={value => { editor = value; }} />
      </main>;
      const view = render(<PreviewModeProvider mode={mode}>{scenario.provider ? <MobileActionGroupProvider enabled={scenario.width < 768}>{content}</MobileActionGroupProvider> : content}</PreviewModeProvider>);
      const canvas = within(view.container), body = within(document.body);
      const checkFrame = (group: HTMLElement) => {
        const style = getComputedStyle(group);
        expect([getComputedStyle(canvas.getByTestId("group-shadow")).boxShadow, getComputedStyle(canvas.getByTestId("group-token-shadow")).boxShadow]).toContain(style.boxShadow);
        expect(style.backgroundColor).toBe(getComputedStyle(canvas.getByTestId("group-shadow")).backgroundColor);
        expect(style.borderTopWidth).toBe("0px");
        expect(style.backgroundColor).not.toBe(getComputedStyle(canvas.getByTestId("page-color")).backgroundColor);
      };
      const checkClose = (close: HTMLElement, previousSize: number) => {
        const group = close.closest<HTMLElement>('[data-slot="action-group"]');
        expect(close.getBoundingClientRect().width, `${scenario.name} close`).toBe(grouped ? 36 : previousSize);
        expect(close.getBoundingClientRect().height).toBe(grouped ? 36 : previousSize);
        if (!grouped) { expect(group).toBeNull(); return; }
        expect(group).not.toBeNull();
        expect(group!.getBoundingClientRect().width).toBe(40);
        expect(group!.getBoundingClientRect().height).toBe(40);
        expect(getComputedStyle(group!).padding).toBe("2px");
        checkFrame(group!);
        for (const element of [group!, close]) for (const edge of ["border-top", "border-right", "border-bottom", "border-left"]) {
          const style = getComputedStyle(element);
          if (parseFloat(style.getPropertyValue(`${edge}-width`)) > 0 && style.getPropertyValue(`${edge}-style`) !== "none") expect(style.getPropertyValue(`${edge}-color`)).toBe("rgba(0, 0, 0, 0)");
        }
        expect(getComputedStyle(close).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(["none", getComputedStyle(canvas.getByTestId("no-shadow")).boxShadow]).toContain(getComputedStyle(close).boxShadow);
      };
      try {
        const capture = canvas.getByRole("button", {name: "打开快速记录"});
        const captureGroup = capture.closest<HTMLElement>('[data-slot="action-group"]');
        expect(capture).toHaveProperty("disabled", true);
        expect(captureGroup !== null).toBe(grouped);
        if (grouped) {
          expect(captureGroup!.getBoundingClientRect().height).toBe(48);
          expect(capture.getBoundingClientRect().height).toBe(44);
          expect(getComputedStyle(captureGroup!).opacity).toBe("1");
          expect(getComputedStyle(capture).opacity).toBe("0.5");
          checkFrame(captureGroup!);
          expect(["none", getComputedStyle(canvas.getByTestId("no-shadow")).boxShadow]).toContain(getComputedStyle(capture).boxShadow);
        }
        await userEvent.click(capture, {force: true});
        capture.click();
        expect(body.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).not.toBe(capture);
        expect(errors).toEqual([]);
        for (const label of ["自定义面板", "默认面板", "禁用面板", "默认对话框"]) {
          const trigger = canvas.getByRole("button", {name: `打开${label}`});
          await userEvent.click(trigger);
          const popup = await body.findByRole("dialog", {name: label});
          const close = within(popup).getByRole("button", {name: "关闭"});
          await waitFor(() => checkClose(close, label === "自定义面板" || label === "禁用面板" ? scenario.width < 768 ? 36 : 32 : 32));
          if (grouped && (label === "默认面板" || label === "默认对话框")) {
            expect(within(popup).getByRole("heading", {name: label}).getBoundingClientRect().right).toBeLessThanOrEqual(close.closest('[data-slot="action-group"]')!.getBoundingClientRect().left);
          }
          if (label === "禁用面板") {
            expect(close).toHaveProperty("disabled", true);
            close.click();
            expect(popup.isConnected).toBe(true);
            await userEvent.keyboard("{Escape}");
          } else await userEvent.click(close);
          await waitFor(() => { expect(popup.isConnected).toBe(false); expect(document.activeElement).toBe(trigger); });
        }
        const imageTrigger = canvas.getByRole("button", {name: "查看大图 内存封面"});
        await waitFor(() => expect(imageTrigger.getAttribute("data-image-state")).toBe("loaded"));
        imageTrigger.focus();
        await userEvent.keyboard("{Enter}");
        const imageViewer = await body.findByRole("dialog", {name: "内存封面"});
        const imageClose = within(imageViewer).getByRole("button", {name: "关闭图片"});
        await waitFor(() => checkClose(imageClose, 44));
        await userEvent.click(imageClose);
        await waitFor(() => { expect(imageViewer.isConnected).toBe(false); expect(document.activeElement).toBe(imageTrigger); });
        const tablist = canvas.getByRole("tablist", {name: "Mermaid 显示模式"});
        await userEvent.hover(tablist.closest(".ui-note-mermaid")!);
        const tabs = within(tablist).getAllByRole("tab");
        const toolbarGroup = tabs[0].closest<HTMLElement>('[data-slot="action-group"]');
        if (grouped) {
          expect(toolbarGroup).not.toBeNull();
          expect(toolbarGroup!.getBoundingClientRect().width).toBe(112);
          expect(toolbarGroup!.getBoundingClientRect().height).toBe(40);
          checkFrame(toolbarGroup!);
          for (const tab of tabs) { expect(tab.getBoundingClientRect().width).toBe(36); expect(tab.getBoundingClientRect().height).toBe(36); }
        } else { expect(toolbarGroup).toBeNull(); expect(tablist.getBoundingClientRect().height).toBe(36); }
        tabs[0].focus();
        await userEvent.keyboard("{ArrowRight}");
        expect(tabs[1].getAttribute("aria-selected")).toBe("true");
        await userEvent.keyboard("{End}");
        expect(tabs[2].getAttribute("aria-selected")).toBe("true");
        const enlarge = await canvas.findByRole("button", {name: "放大 Mermaid 图表"}, {timeout: 10_000});
        enlarge.focus();
        await userEvent.keyboard("{Enter}");
        const diagramViewer = await body.findByRole("dialog", {name: "Mermaid 图表"});
        const diagramClose = within(diagramViewer).getByRole("button", {name: "关闭图表"});
        await waitFor(() => checkClose(diagramClose, 44));
        await userEvent.click(diagramClose);
        await waitFor(() => { expect(diagramViewer.isConnected).toBe(false); expect(document.activeElement).toBe(enlarge); });
        const imageLayout = await canvas.findByRole("button", {name: "图片布局 编辑封面"});
        await userEvent.hover(imageLayout.closest(".rich-image")!);
        const imageTools = imageLayout.closest<HTMLElement>(".rich-image-tools")!;
        await waitFor(() => expect(getComputedStyle(imageTools).opacity).toBe("1"));
        expect(imageTools.getAttribute("data-slot")).toBe(grouped ? "action-group" : null);
        expect(imageLayout.getBoundingClientRect().width).toBe(grouped ? 36 : scenario.width < 768 ? 44 : 28);
        expect(imageLayout.getBoundingClientRect().height).toBe(grouped ? 36 : scenario.width < 768 ? 44 : 28);
        if (grouped) {
          expect(imageTools.getBoundingClientRect().width).toBe(40);
          expect(imageTools.getBoundingClientRect().height).toBe(40);
          expect(getComputedStyle(imageTools).padding).toBe("2px");
          checkFrame(imageTools);
        }
        imageLayout.focus();
        await userEvent.keyboard("{Enter}");
        const imageMenu = await body.findByRole("menu", {name: "图片布局"});
        expect(within(imageMenu).getByRole("menuitem", {name: "等宽排列"}).getAttribute("aria-disabled")).toBe("true");
        await userEvent.keyboard("{Escape}");
        await waitFor(() => { expect(body.queryByRole("menu", {name: "图片布局"})).toBeNull(); expect(document.activeElement).toBe(imageLayout); });
        expect(changes).toEqual([]);
        expect(errors).toEqual([]);
        await waitFor(() => expect(editor).not.toBeNull());
        editor!.chain().focus().setTextSelection({from: 1, to: 3}).run();
        const format = await body.findByRole("toolbar", {name: "文字格式"});
        await expect.element(format).toBeVisible();
        expect(format.getAttribute("data-slot")).toBe(grouped ? "action-group" : null);
        if (grouped) {
          expect(format.getBoundingClientRect().height).toBe(40);
          expect(getComputedStyle(format).padding).toBe("2px");
          checkFrame(format);
          for (const button of format.querySelectorAll("button")) { expect(button.getBoundingClientRect().width).toBe(36); expect(button.getBoundingClientRect().height).toBe(36); }
        }
        const bold = within(format).getByRole("button", {name: "粗体"});
        await userEvent.click(bold);
        await waitFor(() => expect(bold.getAttribute("aria-pressed")).toBe("true"));
        expect(changes.at(-1)).toContain("**说明**");
        editor!.chain().focus().setTextSelection({from: 1, to: 5}).run();
        await waitFor(() => expect(bold.getAttribute("aria-pressed")).toBe("mixed"));
        const mixed = getComputedStyle(bold);
        expect(mixed.boxShadow).toContain("-2px");
        expect(mixed.boxShadow).toContain("inset");
        const mixedBackground = mixed.backgroundColor;
        await userEvent.hover(bold);
        expect(getComputedStyle(bold).backgroundColor).toBe(mixedBackground);
        expect(getComputedStyle(bold).boxShadow).toContain("-2px");
        bold.focus();
        await userEvent.keyboard("{ArrowRight}");
        const italic = within(format).getByRole("button", {name: "斜体"});
        expect(document.activeElement).toBe(italic);
        expectKeyboardOutline(italic, mode);
        await userEvent.keyboard("{Escape}");
        await waitFor(() => expect(getComputedStyle(format).visibility).toBe("hidden"));
        expect(document.activeElement).toBe(editor!.view.dom);
      } finally { view.unmount(); }
    }
  } finally { releaseAssets(); }
}, 35_000);
}

for (const mode of ["light", "dark"] as const) test(`Web list rows keep transparent rest, independent tags and pointer feedback in ${mode}`, async () => {
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({theme: mode}));
  history.replaceState(null, "", "#/");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  const opened: string[] = [], selected: string[] = [];
  let canOpen = true, current: AppViewState | undefined;
  const renderState = (state: AppViewState) => {
    current = state;
    return renderWebApp({...state, capture: null, collection: {...state.collection, canOpen: canOpen && state.collection.canOpen, onOpen: id => opened.push(id), onSelectTag: tag => selected.push(tag)}});
  };
  const app = () => <WebAppearanceProvider><App renderView={renderState} /></WebAppearanceProvider>;
  const view = render(app());
  try {
    const scenarios = inject("uiQualityTouch") ? [{width: 390, touch: true}] : [{width: 1440, touch: false}, {width: 390, touch: false}];
    for (const scenario of scenarios) {
      await page.viewport(scenario.width, 900);
      await waitFor(() => {
        expect(matchMedia("(hover: none)").matches).toBe(scenario.touch);
        expect(matchMedia("(pointer: coarse)").matches).toBe(scenario.touch);
      });
      canOpen = true;
      view.rerender(app());
      const canvas = within(view.container);
      await waitFor(() => expect(view.container.querySelectorAll('.web-app-header [data-slot="action-group"]')).toHaveLength(scenario.width < 768 ? 2 : 0));
      const list = await canvas.findByRole("list", {name: "笔记列表"});
      expect(list.getAttribute("data-layout")).toBe("list");
      const open = within(list).getAllByRole("button", {name: /^打开 /})[0];
      await waitFor(() => expect(open).toHaveProperty("disabled", false));
      const card = open.closest<HTMLElement>(".ui-note-list-card")!;
      const root = card.closest<HTMLElement>(".web-app")!;
      expect(root.getAttribute("data-web-client")).toBe("true");
      const reference = document.createElement("div");
      reference.style.backgroundColor = "var(--color-overlay-hover)";
      root.append(reference);
      try {
        const outside = canvas.getByRole("button", {name: "页面操作"});
        await userEvent.hover(outside);
        expect(getComputedStyle(card).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        await userEvent.hover(open);
        expect(card.matches(":hover")).toBe(true);
        const overlay = getComputedStyle(reference).backgroundColor;
        await waitFor(() => expect(getComputedStyle(card).backgroundColor).toBe(scenario.touch ? "rgba(0, 0, 0, 0)" : overlay));
        const before = opened.length, bounds = card.getBoundingClientRect();
        const click = Promise.resolve(userEvent.click(open, {delay: 400}));
        try {
          await waitFor(() => expect(open.matches(":active")).toBe(true));
          expect(getComputedStyle(card).backgroundColor).toBe(overlay);
          expect(card.getBoundingClientRect().top).toBeCloseTo(bounds.top, 1);
          expect(opened).toHaveLength(before);
        } finally { await click; }
        expect(opened).toHaveLength(before + 1);
        if (scenario.touch) expect(card.matches(":hover")).toBe(true);
        await waitFor(() => expect(getComputedStyle(card).backgroundColor).toBe(scenario.touch ? "rgba(0, 0, 0, 0)" : overlay));
        await userEvent.hover(outside);
        open.focus();
        if (server.browser === "webkit") {
          await userEvent.keyboard("{Alt>}{Tab}{/Alt}");
          expect(document.activeElement).not.toBe(open);
          await userEvent.keyboard("{Alt>}{Shift>}{Tab}{/Shift}{/Alt}");
        } else {
          await userEvent.tab();
          expect(document.activeElement).not.toBe(open);
          await userEvent.tab({shift: true});
        }
        expect(document.activeElement).toBe(open);
        expect(open.matches(":focus-visible")).toBe(true);
        expectKeyboardOutline(card, mode);
        expectUnclippedOutline(card);
        expect(getComputedStyle(card).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        await userEvent.keyboard("{Enter}");
        expect(opened).toHaveLength(before + 2);
        open.blur();
        await userEvent.hover(outside);
        canOpen = false;
        view.rerender(app());
        expect(open).toHaveProperty("disabled", true);
        await userEvent.hover(open);
        expect(getComputedStyle(card).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        await userEvent.click(open, {force: true});
        open.click();
        expect(opened).toHaveLength(before + 2);
        if (scenario.width === 1440) {
          const tag = within(card).getAllByRole("button", {name: /^筛选标签 /})[0];
          const tagCount = selected.length;
          await userEvent.click(tag);
          expect(selected).toHaveLength(tagCount + 1);
          expect(opened).toHaveLength(before + 2);
          expect(getComputedStyle(card).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        }
      } finally { reference.remove(); }
    }
    view.unmount();
    const native = render(<PreviewModeProvider mode={mode}><main className="ui-theme p-4" data-ui-theme={mode}><NoteCollection {...current!.collection} canOpen={false} /><div data-testid="card-color" className="bg-card" /></main></PreviewModeProvider>);
    const nativeCard = native.container.querySelector<HTMLElement>(".ui-note-list-card")!;
    expect(nativeCard.closest("[data-web-client]")).toBeNull();
    expect(getComputedStyle(nativeCard).backgroundColor).toBe(getComputedStyle(within(native.container).getByTestId("card-color")).backgroundColor);
    expect(getComputedStyle(nativeCard).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/");
  }
});

if (!inject("uiQualityTouch")) {
test("Web home and all-notes collections share responsive widths", async () => {
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard:home-layout", "cards");
  localStorage.setItem("memocard:note-layout", "cards");
  history.replaceState(null, "", "#/home");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  let current: AppViewState | undefined;
  const view = render(<WebAppearanceProvider><App renderView={state => { current = state; return renderWebApp(state); }} /></WebAppearanceProvider>);
  const widths = [320, 390, 767, 768, 1024, 1440, 1560, 1920];
  const measurements = new Map<string, {left: number; width: number; itemWidth: number; columns: string; tags: string; date: string}>();
  try {
    const canvas = within(view.container);
    for (const layout of ["cards", "list"] as const) {
      for (const route of ["home", "notes"] as const) {
        await act(async () => { await current!.onNavigate(route); });
        await page.viewport(1920, 700);
        await canvas.findByRole("list", {name: "笔记列表"});
        await userEvent.click(canvas.getByRole("button", {name: layout === "cards" ? "卡片布局" : "列表布局"}));
        for (const width of widths) {
          await page.viewport(width, 700);
          await waitFor(() => expect(current!.isMobile).toBe(width < 768));
          const list = canvas.getByRole("list", {name: "笔记列表"});
          await waitFor(() => expect(list.closest(".ui-note-results")).toHaveAttribute("aria-busy", "false"));
          expect(list.getAttribute("data-layout")).toBe(layout);
          const bounds = list.getBoundingClientRect();
          const item = list.querySelector<HTMLElement>(".ui-note-card")!;
          const sample = {
            left: bounds.left, width: bounds.width, itemWidth: item.getBoundingClientRect().width,
            columns: getComputedStyle(list).gridTemplateColumns,
            tags: getComputedStyle(item.querySelector(".ui-note-tags")!).display,
            date: getComputedStyle(item.querySelector("time")!).display,
          };
          if (route === "home") measurements.set(`${layout}-${width}`, sample);
          else {
            const home = measurements.get(`${layout}-${width}`)!;
            for (const dimension of ["left", "width", "itemWidth"] as const) expect(sample[dimension], `${layout} ${width}px ${dimension}`).toBeCloseTo(home[dimension], 1);
            expect(sample.columns, `${layout} ${width}px columns`).toBe(home.columns);
            expect(sample.tags, `${layout} ${width}px tags`).toBe(home.tags);
            expect(sample.date, `${layout} ${width}px date`).toBe(home.date);
          }
          if (route === "home" && width >= 768) {
            await waitFor(() => expect(view.container.querySelector(".web-page-content > .ui-quick-capture")).not.toBeNull());
            const capture = view.container.querySelector<HTMLElement>(".web-page-content > .ui-quick-capture")!.getBoundingClientRect();
            expect(capture.width).toBeCloseTo(Math.min(bounds.width, 768), 1);
            expect(capture.left + capture.width / 2).toBeCloseTo(bounds.left + bounds.width / 2, 1);
          }
          expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth + 1);
          expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
        }
      }
    }
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/");
  }
}, 30_000);

for (const mode of ["light", "dark"] as const) test(`Web header preserves mobile touch targets, spacing and desktop appearance in ${mode}`, async () => {
  await page.viewport(320, 900);
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({theme: mode}));
  const fixture = await createWorkspaceFixture();
  const note = fixture.snapshot().notes[0];
  const longTag = "用于检查移动页头的较长标签名称".repeat(4);
  await fixture.request("updateNoteProperty", {id: note.id, name: "tags", type: "list", value: [longTag]});
  const noteWrites = () => fixture.calls.filter(operation => operation === "saveNote" || operation === "updateNoteProperty").length;
  const initialWrites = noteWrites();
  history.replaceState(null, "", `#/notes/${note.id}`);
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  const controlShadow = document.createElement("div");
  controlShadow.className = "ui-theme shadow-control";
  controlShadow.dataset.uiTheme = mode;
  controlShadow.style.backgroundColor = "var(--color-background-surface)";
  view.container.append(controlShadow);
  const noShadow = document.createElement("div");
  noShadow.className = "ui-theme shadow-none";
  noShadow.dataset.uiTheme = mode;
  view.container.append(noShadow);
  const hoverReference = document.createElement("div");
  hoverReference.className = "ui-theme bg-overlay-hover";
  hoverReference.dataset.uiTheme = mode;
  view.container.append(hoverReference);
  try {
    const canvas = within(view.container), body = within(document.body);
    const title = await canvas.findByRole("textbox", {name: "页面标题"});
    const header = view.container.querySelector<HTMLElement>(".web-app-header")!;
    const controls = within(header);
    await waitFor(() => expect(controls.getByRole("button", {name: "固定到主页"})).toHaveProperty("disabled", false));
    for (const width of [320, 390, 673, 767, 768, 1024, 1440]) {
      await page.viewport(width, 900);
      await userEvent.hover(title);
      await waitFor(() => expect(header.querySelectorAll('[data-slot="action-group"]')).toHaveLength(width < 768 ? 2 : 0));
      const actionGroup = header.querySelector<HTMLElement>(".web-header-actions")!;
      const back = controls.getByRole("button", {name: /^返回/});
      const more = controls.getByRole("button", {name: "页面操作"});
      const pin = controls.getByRole("button", {name: "固定到主页"});
      await waitFor(() => {
        const bounds = header.getBoundingClientRect();
        for (const button of [back, pin, more]) {
          const rect = button.getBoundingClientRect(), style = getComputedStyle(button);
          expect(rect.width, `${width}px ${button.ariaLabel} width`).toBeCloseTo(36, 1);
          expect(rect.height, `${width}px ${button.ariaLabel} height`).toBeCloseTo(36, 1);
          expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
          expect(rect.right).toBeLessThanOrEqual(bounds.right);
          expect(rect.top).toBeGreaterThanOrEqual(bounds.top);
          expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom);
          expect(style.borderTopColor, `${width}px ${button.ariaLabel} border`).toBe("rgba(0, 0, 0, 0)");
          expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
          expect(["none", getComputedStyle(noShadow).boxShadow]).toContain(style.boxShadow);
        }
        if (width < 768) {
          const groups = [back.closest<HTMLElement>('[data-slot="action-group"]'), pin.closest<HTMLElement>('[data-slot="action-group"]')];
          for (const [index, group] of groups.entries()) {
            expect(group).not.toBeNull();
            const groupStyle = getComputedStyle(group!), rect = group!.getBoundingClientRect();
            expect(rect.height).toBe(40);
            expect(rect.width).toBe(index === 0 ? 40 : 76);
            expect(groupStyle.padding).toBe("2px");
            expect(groupStyle.boxShadow).toBe(getComputedStyle(controlShadow).boxShadow);
            expect(groupStyle.borderTopWidth).toBe("0px");
            expect(groupStyle.backgroundColor).toBe(getComputedStyle(controlShadow).backgroundColor);
            expect(groupStyle.backgroundColor).not.toBe(getComputedStyle(header.closest(".web-app")!).backgroundColor);
            expect(parseFloat(groupStyle.borderTopLeftRadius)).toBeGreaterThanOrEqual(rect.height / 2);
          }
        } else {
          const groupStyle = getComputedStyle(actionGroup);
          expect(["none", getComputedStyle(noShadow).boxShadow]).toContain(groupStyle.boxShadow);
          expect(groupStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
          for (const button of [back, pin, more]) expect(button.closest('[data-slot="action-group"]')).toBeNull();
        }
        expect(pin.getBoundingClientRect().left).toBeGreaterThanOrEqual(back.getBoundingClientRect().right);
        expect(more.getBoundingClientRect().left - pin.getBoundingClientRect().right, `${width}px action gap`).toBeCloseTo(width < 768 ? 0 : 8, 1);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
      });
      await userEvent.click(pin);
      await waitFor(() => expect(controls.getByRole("button", {name: "取消固定"}).getAttribute("aria-pressed")).toBe("true"));
      await userEvent.click(pin);
      await waitFor(() => expect(controls.getByRole("button", {name: "固定到主页"}).getAttribute("aria-pressed")).toBe("false"));
      await userEvent.click(more);
      const menu = await body.findByRole("menu");
      expect(within(menu).getByRole("menuitem", {name: "移入回收站"})).toBeTruthy();
      const menuBox = menu.getBoundingClientRect();
      expect(menuBox.left).toBeGreaterThanOrEqual(0);
      expect(menuBox.right).toBeLessThanOrEqual(width);
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(body.queryByRole("menu")).toBeNull();
        expect(document.activeElement).toBe(more);
        expectUnclippedOutline(more);
      });
    }
    await page.viewport(673, 900);
    await waitFor(() => expect(header.querySelectorAll('[data-slot="action-group"]')).toHaveLength(2));
    await userEvent.click(controls.getByRole("button", {name: /^返回/}));
    await waitFor(() => expect(canvas.queryByRole("textbox", {name: "页面标题"})).toBeNull());
    const collectionTitle = await within(header).findByRole("button", {name: "视图选项 所有笔记"});
    await waitFor(() => {
      const rect = collectionTitle.getBoundingClientRect();
      expect(rect.left + rect.width / 2).toBeCloseTo(673 / 2, 1);
    });
    await userEvent.click(canvas.getByRole("button", {name: `筛选标签 ${longTag}`}));
    const tagTitle = await within(header).findByRole("button", {name: `标签操作 ${longTag}`});
    for (const width of [320, 390, 673, 767]) {
      await page.viewport(width, 900);
      await waitFor(() => {
        const rect = tagTitle.getBoundingClientRect();
        expect(rect.left + rect.width / 2, `${width}px long title center`).toBeCloseTo(width / 2, 1);
        expect(rect.right).toBeLessThanOrEqual(controls.getByRole("button", {name: "页面操作"}).getBoundingClientRect().left);
        expect(rect.left).toBeGreaterThanOrEqual(header.getBoundingClientRect().left);
        for (const label of ["页面导航", "页面操作组"]) {
          const group = within(header).getByRole("group", {name: label});
          expect(group.getBoundingClientRect().width).toBe(40);
          expect(group.getBoundingClientRect().height).toBe(40);
          expect(within(group).getByRole("button").getBoundingClientRect().width).toBe(36);
        }
      });
    }
    const search = canvas.getByRole("button", {name: "搜索全部笔记"});
    const searchGroup = search.closest<HTMLElement>('[data-slot="action-group"]')!;
    expect(searchGroup.getBoundingClientRect().width).toBe(48);
    expect(searchGroup.getBoundingClientRect().height).toBe(48);
    expect(search.getBoundingClientRect().width).toBe(44);
    expect(search.getBoundingClientRect().height).toBe(44);
    const capture = canvas.getByRole("button", {name: "打开快速记录"});
    const captureGroup = capture.closest<HTMLElement>('[data-slot="action-group"]') ?? capture;
    await userEvent.hover(capture);
    await waitFor(() => expect(getComputedStyle(captureGroup).backgroundColor).toBe(getComputedStyle(controlShadow).backgroundColor));
    await userEvent.hover(tagTitle);
    expect(captureGroup.getAttribute("data-slot")).toBe("action-group");
    for (const control of [search, capture]) {
      const glyph = control.querySelector("svg")!.getBoundingClientRect();
      expect(glyph.width).toBe(20);
      expect(glyph.height).toBe(20);
    }
    expect(captureGroup.getBoundingClientRect().height).toBe(48);
    expect(capture.getBoundingClientRect().height).toBe(44);
    expect(captureGroup.getBoundingClientRect().top).toBeCloseTo(searchGroup.getBoundingClientRect().top, 1);
    expect(getComputedStyle(captureGroup).boxShadow).toBe(getComputedStyle(searchGroup).boxShadow);
    for (const surface of [captureGroup, searchGroup]) {
      const style = getComputedStyle(surface);
      expect(style.backgroundColor).toBe(getComputedStyle(controlShadow).backgroundColor);
      expect(style.boxShadow).toBe(getComputedStyle(controlShadow).boxShadow);
      for (const edge of ["border-top", "border-right", "border-bottom", "border-left"]) if (parseFloat(style.getPropertyValue(`${edge}-width`)) > 0 && style.getPropertyValue(`${edge}-style`) !== "none") expect(style.getPropertyValue(`${edge}-color`)).toBe("rgba(0, 0, 0, 0)");
    }
    expect(getComputedStyle(captureGroup).borderTopWidth).toBe("0px");
    expect(getComputedStyle(captureGroup).opacity).toBe("1");
    expect(getComputedStyle(searchGroup).borderTopWidth).toBe("0px");
    expect(["none", getComputedStyle(noShadow).boxShadow]).toContain(getComputedStyle(search).boxShadow);
    expect(getComputedStyle(capture).borderTopColor).toBe("rgba(0, 0, 0, 0)");
    expect(["none", getComputedStyle(noShadow).boxShadow]).toContain(getComputedStyle(capture).boxShadow);
    for (const [button, group] of [[search, searchGroup], [capture, captureGroup]]) {
      button.focus();
      await userEvent.keyboard("{ArrowRight}");
      expectKeyboardOutline(button, mode);
      expectUnclippedOutline(button);
      const style = getComputedStyle(button), rect = button.getBoundingClientRect(), frame = group.getBoundingClientRect();
      const outset = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
      expect(rect.top - outset).toBeCloseTo(frame.top - 2, 1);
      expect(rect.bottom + outset).toBeCloseTo(frame.bottom + 2, 1);
    }
    expect(getComputedStyle(searchGroup).flexGrow).toBe("0");
    const pressFooter = async (control: HTMLElement) => {
      await userEvent.hover(control);
      const hoverColor = getComputedStyle(hoverReference).backgroundColor;
      await waitFor(() => expect(getComputedStyle(control).backgroundColor).toBe(hoverColor));
      const before = control.getBoundingClientRect(), shadow = getComputedStyle(control).boxShadow;
      const click = Promise.resolve(userEvent.click(control, {delay: 400}));
      try {
        await waitFor(() => expect(control.matches(":active")).toBe(true));
        expect(control.getBoundingClientRect().top).toBeCloseTo(before.top, 1);
        expect(getComputedStyle(control).backgroundColor).toBe(hoverColor);
        expect(getComputedStyle(control).boxShadow).toBe(shadow);
        expect(getComputedStyle(control).outlineStyle).toBe("none");
        expect(body.queryByRole("dialog")).toBeNull();
      } finally { await click; }
    };
    await pressFooter(search);
    const searchDialog = await within(document.body).findByRole("dialog", {name: "搜索笔记"});
    expect(search.isConnected).toBe(true);
    expect(search.closest("footer")).toHaveProperty("hidden", true);
    const exitSearch = within(searchDialog).getByRole("button", {name: "退出搜索"});
    await waitFor(() => expect(exitSearch.getBoundingClientRect().width).toBe(36));
    const exitGroup = exitSearch.closest('[data-slot="action-group"]')!;
    expect(exitGroup.getBoundingClientRect().height).toBe(40);
    expect(getComputedStyle(exitGroup).backgroundColor).toBe(getComputedStyle(controlShadow).backgroundColor);
    expect(getComputedStyle(exitGroup).boxShadow).toBe(getComputedStyle(controlShadow).boxShadow);
    expect(getComputedStyle(exitGroup).borderTopWidth).toBe("0px");
    await userEvent.click(exitSearch);
    await waitFor(() => {
      expect(searchDialog.isConnected).toBe(false);
      expect(canvas.getByRole("button", {name: "搜索全部笔记"})).toBe(search);
      expect(document.activeElement).toBe(search);
    });
    await pressFooter(capture);
    const captureField = await body.findByRole("textbox", {name: "快速输入内容"});
    const captureDialog = captureField.closest('[role="dialog"]')!;
    const closeCapture = within(captureDialog as HTMLElement).getByRole("button", {name: "收起快速记录"});
    const captureCloseGroup = closeCapture.closest('[data-slot="action-group"]')!;
    await waitFor(() => expect(closeCapture.getBoundingClientRect().width).toBe(36));
    expect(captureCloseGroup.getBoundingClientRect().height).toBe(40);
    expect(getComputedStyle(captureCloseGroup).backgroundColor).toBe(getComputedStyle(controlShadow).backgroundColor);
    expect(getComputedStyle(captureCloseGroup).boxShadow).toBe(getComputedStyle(controlShadow).boxShadow);
    expect(getComputedStyle(captureCloseGroup).borderTopWidth).toBe("0px");
    await userEvent.click(closeCapture);
    await waitFor(() => { expect(captureDialog.isConnected).toBe(false); expect(document.activeElement).toBe(capture); });
    expect(noteWrites()).toBe(initialWrites);
    await userEvent.click(controls.getByRole("button", {name: "页面操作"}));
    await userEvent.click(await within(document.body).findByRole("menuitem", {name: "新建笔记"}));
    await canvas.findByRole("textbox", {name: "页面标题"});
    await waitFor(() => expect(controls.getByRole("button", {name: "固定到主页"})).toHaveProperty("disabled", true));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    for (const width of [390, 1024]) {
      await page.viewport(width, 900);
      await waitFor(() => expect(header.querySelectorAll('[data-slot="action-group"]')).toHaveLength(width < 768 ? 2 : 0));
      const disabledPin = controls.getByRole("button", {name: "固定到主页"});
      const more = controls.getByRole("button", {name: "页面操作"});
      more.focus();
      if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Shift>}{Tab}{/Shift}{/Alt}");
      else await userEvent.tab({shift: true});
      const tooltipTrigger = disabledPin.closest<HTMLElement>(".web-pin-tooltip-trigger")!;
      await waitFor(() => expect(document.activeElement).toBe(tooltipTrigger));
      expectKeyboardOutline(tooltipTrigger, mode);
      expectUnclippedOutline(tooltipTrigger);
      expect(getComputedStyle(disabledPin).opacity).toBe("0.5");
      const hint = await within(document.body).findByText("保存笔记后可固定到主页");
      expect(hint.closest('[data-slot="tooltip-content"]')).not.toBeNull();
      await expect.element(hint).toBeVisible();
      disabledPin.click();
      expect(disabledPin.getAttribute("aria-pressed")).toBe("false");
    }
  } finally {
    view.unmount(); release();
    history.replaceState(null, "", previousHash || "#/notes");
  }
}, 30_000);

test("Web detail aligns title, properties and body across breakpoints", async () => {
  await page.viewport(320, 900);
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  const fixture = await createWorkspaceFixture();
  const note = fixture.snapshot().notes[0];
  await fixture.request("updateNoteProperty", {id: note.id, name: "tags", type: "list", value: ["生活/咖啡", ...Array.from({length: 14}, (_, index) => `布局标签${index}`), "unbroken_".repeat(20)]});
  await fixture.request("updateNoteProperty", {id: note.id, name: "阶段", type: "multiSelect", value: ["进行中", "完成"]});
  history.replaceState(null, "", `#/notes/${note.id}`);
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    const title = await canvas.findByRole("textbox", {name: "页面标题"});
    const body = await canvas.findByRole("textbox", {name: "笔记内容"});
    await canvas.findByRole("button", {name: "属性菜单 阶段"});
    await document.fonts.ready;
    for (const width of [320, 390, 640, 767, 768, 820, 1024, 1180, 1440]) {
      await page.viewport(width, 900);
      const checkLayout = () => {
        const titleBox = title.getBoundingClientRect(), titleStyle = getComputedStyle(title);
        const start = titleBox.left + parseFloat(titleStyle.paddingLeft);
        const end = titleBox.right - parseFloat(titleStyle.paddingRight);
        if (width < 768) {
          expect(start).toBeCloseTo(16, 1);
          expect(width - end).toBeCloseTo(16, 1);
        }
        expect(body.getBoundingClientRect().left, `${width}px body start`).toBeCloseTo(start, 1);
        expect(body.getBoundingClientRect().right, `${width}px body end`).toBeCloseTo(end, 1);
        const rows = Array.from(view.container.querySelectorAll<HTMLElement>(".note-property-row[data-property-key]"));
        expect(rows.length).toBeGreaterThan(4);
        for (const row of rows) {
          const name = row.querySelector("dt")!, value = row.querySelector("dd")!;
          const a = name.getBoundingClientRect(), b = value.getBoundingClientRect();
          if (width < 768) expect(a.width, row.dataset.propertyKey).toBeCloseTo(120, 1);
          expect(b.left - a.right, row.dataset.propertyKey).toBeCloseTo(8, 1);
          expect(b.top, row.dataset.propertyKey).toBeCloseTo(a.top, 1);
          expect(name.querySelector("svg")!.getBoundingClientRect().left, `${width}px ${row.dataset.propertyKey}`).toBeCloseTo(start, 1);
          const content = value.querySelector<HTMLElement>(".note-property-edit, .note-property-value") ?? value;
          expect(content.getBoundingClientRect().right - parseFloat(getComputedStyle(content).paddingRight)).toBeCloseTo(end, 1);
        }
        const toggle = canvas.getByRole("button", {name: /^(更多属性|收起)$/});
        expect(toggle.querySelector("svg")!.getBoundingClientRect().left).toBeCloseTo(start, 1);
        const add = canvas.queryByRole("button", {name: "添加属性"});
        if (add) expect(add.querySelector("svg")!.getBoundingClientRect().left).toBeCloseTo(start, 1);
        for (const pill of view.container.querySelectorAll<HTMLElement>(".note-properties .note-tag-pill")) {
          expect(pill.scrollWidth).toBeLessThanOrEqual(pill.clientWidth + 1);
          expect(pill.scrollHeight).toBeLessThanOrEqual(pill.clientHeight + 1);
        }
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
        const scroll = view.container.querySelector<HTMLElement>(".web-app-scroll")!;
        const overflow = Array.from(scroll.querySelectorAll<HTMLElement>("*")).filter(element => element.getBoundingClientRect().right > width + 1).map(element => `${element.tagName}.${element.className}: ${element.getBoundingClientRect().right}`);
        expect(scroll.scrollWidth, overflow.join("\n")).toBeLessThanOrEqual(scroll.clientWidth + 1);
      };
      await waitFor(checkLayout);
      await userEvent.click(canvas.getByRole("button", {name: "更多属性"}));
      await waitFor(checkLayout);
      await userEvent.click(canvas.getByRole("button", {name: "收起"}));
      await waitFor(checkLayout);
      await userEvent.hover(body.querySelector("li")!);
      await waitFor(() => expect(view.container.querySelector<HTMLElement>(".block-controls")!.style.left).not.toBe(""));
      canvas.getByRole("button", {name: "更多属性"}).focus();
      if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}");
      else await userEvent.tab();
      const grip = canvas.getByRole("button", {name: "内容块操作"});
      await waitFor(() => {
        expect(document.activeElement).toBe(grip);
        expect(grip.matches(":focus-visible")).toBe(true);
        expect(getComputedStyle(grip).opacity).toBe("1");
        expectUnclippedOutline(grip);
      });
      // The color helper writes a temporary swatch: keep it outside waitFor so a
      // failed bounds assertion cannot retrigger its own MutationObserver forever.
      expectKeyboardOutline(grip, "light");
    }
  } finally {
    view.unmount(); release();
    history.replaceState(null, "", previousHash || "#/notes");
  }
}, 30_000);

test("pointer blur save keeps the next value clickable when an empty property hides", async () => {
  await page.viewport(390, 900);
  await commands.setReducedMotion("reduce");
  const fixture = propertyLayoutFixture("layout-pointer-blur"), changes: unknown[] = [];
  let properties: Properties = {...preferenceProperties, properties: preferenceProperties.properties.map(property => property.name === "摘要" ? {...property, value: "初值"} : property)};
  const widget = () => <PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={properties} onApply={async change => {
      changes.push(change);
      properties = {...properties, properties: properties.properties.map(property => property.name === change.name ? {...property, value: change.value ?? ""} : property)};
      view.rerender(widget());
    }} />
  </main></PreviewModeProvider>;
  const view = render(widget());
  try {
    const canvas = within(view.container), body = within(document.body);
    await userEvent.click(await canvas.findByRole("button", {name: "属性菜单 摘要"}));
    await userEvent.click(await body.findByRole("menuitem", {name: /^属性可见性/}));
    await userEvent.click(await body.findByRole("menuitemradio", {name: "为空时隐藏"}));
    await waitFor(() => expect(body.queryByRole("menuitemradio", {name: "为空时隐藏"})).toBeNull());
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 摘要"}));
    await userEvent.clear(await canvas.findByRole("textbox", {name: "属性值"}));
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 零值"}), {delay: 250});
    const next = await canvas.findByRole("textbox", {name: "属性值"});
    expect(next).toHaveProperty("value", "0");
    expect(document.activeElement).toBe(next);
    expect(canvas.queryByRole("button", {name: "编辑属性 摘要"})).toBeNull();
    expect(changes).toEqual([{name: "摘要", type: "text", value: ""}]);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(canvas.getByRole("button", {name: "编辑属性 零值"})));
  } finally { fixture.release(); }
}, 15_000);

test("inline property editing preserves multiline geometry, resizes and returns keyboard focus", async () => {
  await commands.setReducedMotion("reduce");
  const fixture = propertyLayoutFixture("layout-inline-edit"), changes: unknown[] = [];
  const original = `第一行：属性值保持首行对齐。\n第二行：保留显式换行。\n${"UnbrokenValueToken".repeat(18)}`;
  let properties: Properties = {...preferenceProperties, properties: preferenceProperties.properties.map(property => property.name === "摘要" ? {...property, value: original} : property)};
  const widget = () => <PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={properties} onApply={async change => {
      changes.push(change);
      properties = {...properties, properties: properties.properties.map(property => property.name === change.name ? {...property, value: change.value ?? ""} : property)};
      view.rerender(widget());
    }} />
    <input aria-label="外部操作" />
  </main></PreviewModeProvider>;
  const view = render(widget());
  try {
    const canvas = within(view.container), body = within(document.body);
    await document.fonts.ready;
    for (const width of [1024, 390, 320]) {
      await page.viewport(width, 900);
      const trigger = await canvas.findByRole("button", {name: "编辑属性 摘要"});
      const before = trigger.getBoundingClientRect().height;
      await userEvent.click(trigger);
      const input = await canvas.findByRole("textbox", {name: "属性值"}) as HTMLTextAreaElement;
      await waitFor(() => {
        expect(Math.abs(input.getBoundingClientRect().height - before)).toBeLessThanOrEqual(1);
        expect(input.scrollHeight).toBeLessThanOrEqual(input.clientHeight + 1);
        expect(input.scrollWidth).toBeLessThanOrEqual(input.clientWidth + 1);
      });
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(document.activeElement).toBe(canvas.getByRole("button", {name: "编辑属性 摘要"})));
      expect(canvas.getByRole("button", {name: "编辑属性 摘要"}).textContent).toBe(original);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
    }
    expect(changes).toEqual([]);
    await page.viewport(1024, 900);
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 摘要"}));
    const input = await canvas.findByRole("textbox", {name: "属性值"}) as HTMLTextAreaElement;
    const wideHeight = input.getBoundingClientRect().height;
    await page.viewport(320, 900);
    await waitFor(() => {
      expect(input.getBoundingClientRect().height).toBeGreaterThan(wideHeight);
      expect(input.scrollHeight).toBeLessThanOrEqual(input.clientHeight + 1);
    });
    await page.viewport(1024, 900);
    await waitFor(() => expect(Math.abs(input.getBoundingClientRect().height - wideHeight)).toBeLessThanOrEqual(1));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(canvas.getByRole("button", {name: "编辑属性 摘要"})));
    expect(changes).toEqual([]);
    await page.viewport(320, 900);
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 摘要"}));
    const multiline = await canvas.findByRole("textbox", {name: "属性值"}) as HTMLTextAreaElement;
    await userEvent.fill(multiline, "换行测试");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await waitFor(() => expect(multiline.value).toBe("换行测试\n"));
    const editedHeight = multiline.getBoundingClientRect().height;
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      const saved = canvas.getByRole("button", {name: "编辑属性 摘要"});
      expect(Math.abs(saved.getBoundingClientRect().height - editedHeight)).toBeLessThanOrEqual(1);
      expect(document.activeElement).toBe(saved);
    });
    expect(changes).toEqual([{name: "摘要", type: "text", value: "换行测试\n"}]);
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 摘要"}));
    await userEvent.fill(await canvas.findByRole("textbox", {name: "属性值"}), "外部保存");
    const outside = canvas.getByRole("textbox", {name: "外部操作"});
    await userEvent.click(outside);
    await waitFor(() => expect(canvas.getByRole("button", {name: "编辑属性 摘要"}).textContent).toBe("外部保存"));
    expect(document.activeElement).toBe(outside);
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 摘要"}));
    await userEvent.fill(await canvas.findByRole("textbox", {name: "属性值"}), "键盘离开");
    await userEvent.keyboard("{Tab}");
    await waitFor(() => expect(canvas.getByRole("button", {name: "编辑属性 摘要"}).textContent).toBe("键盘离开"));
    expect(document.activeElement?.closest("[data-property-key]")?.getAttribute("data-property-key")).toBe("property:零值");
    await userEvent.click(canvas.getByRole("button", {name: "属性菜单 摘要"}));
    await userEvent.click(await body.findByRole("menuitem", {name: /^属性可见性/}));
    await userEvent.click(await body.findByRole("menuitemradio", {name: "为空时隐藏"}));
    await waitFor(() => expect(body.queryByRole("menuitemradio", {name: "为空时隐藏"})).toBeNull());
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 摘要"}));
    await userEvent.clear(await canvas.findByRole("textbox", {name: "属性值"}));
    await userEvent.click(outside);
    await waitFor(() => expect(canvas.queryByRole("button", {name: "编辑属性 摘要"})).toBeNull());
    expect(document.activeElement).toBe(outside);
    expect(changes).toHaveLength(4);
    await userEvent.click(canvas.getByRole("button", {name: "更多属性"}));
    await userEvent.click(await canvas.findByRole("button", {name: "编辑属性 摘要"}));
    await userEvent.fill(await canvas.findByRole("textbox", {name: "属性值"}), "恢复值");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(canvas.getByRole("button", {name: "编辑属性 摘要"})));
    await userEvent.click(canvas.getByRole("button", {name: "收起"}));
    await userEvent.click(canvas.getByRole("button", {name: "编辑属性 摘要"}));
    await userEvent.clear(await canvas.findByRole("textbox", {name: "属性值"}));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(canvas.queryByRole("button", {name: "编辑属性 摘要"})).toBeNull();
      expect(document.activeElement).toBe(canvas.getByRole("button", {name: "更多属性"}));
    });
    expect(changes).toHaveLength(6);
  } finally { fixture.release(); }
}, 30_000);

test("collapsing properties preserves always-visible tags and custom properties", async () => {
  await page.viewport(1024, 900);
  await commands.setReducedMotion("reduce");
  const fixture = propertyLayoutFixture("layout-collapse-always"), changes: unknown[] = [];
  const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={preferenceProperties} onApply={async change => { changes.push(change); }} />
  </main></PreviewModeProvider>);
  try {
    const canvas = within(view.container), body = within(document.body);
    const toggle = canvas.getByRole("button", {name: "更多属性"});
    await userEvent.click(toggle);
    for (const [name, choice] of [["标签", "始终显示"], ["摘要", "始终显示"], ["空值", "始终隐藏"]]) {
      await userEvent.click(await canvas.findByRole("button", {name: `属性菜单 ${name}`}));
      await userEvent.click(await body.findByRole("menuitem", {name: /^属性可见性/}));
      await userEvent.click(await body.findByRole("menuitemradio", {name: choice}));
      await waitFor(() => expect(body.queryByRole("menuitemradio", {name: choice})).toBeNull());
    }
    expect(fixture.layout().visibility).toMatchObject({"system:tags": "always", "property:摘要": "always", "property:空值": "hidden"});
    const tags = canvas.getByRole("button", {name: "编辑标签"});
    const summary = canvas.getByRole("button", {name: "编辑属性 摘要"});
    expect(canvas.getByRole("button", {name: "编辑属性 空值"})).toBeTruthy();
    expect(toggle.textContent).toContain("收起");
    await userEvent.click(toggle);
    expect(canvas.queryByRole("button", {name: "编辑标签"})).toBe(tags);
    expect(canvas.queryByRole("button", {name: "编辑属性 摘要"})).toBe(summary);
    expect(canvas.queryByRole("button", {name: "编辑属性 空值"})).toBeNull();
    expect(toggle.textContent).toContain("更多属性");
    expect(changes).toEqual([]);
  } finally { fixture.release(); }
}, 20_000);

test("property grips reorder rows with native drag without editing note data", async () => {
  await page.viewport(1024, 900);
  await commands.setReducedMotion("reduce");
  const fixture = propertyLayoutFixture("layout-native-drag"), changes: unknown[] = [];
  const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={preferenceProperties} onApply={async change => { changes.push(change); }} />
  </main></PreviewModeProvider>);
  try {
    const canvas = within(view.container);
    const target = (await canvas.findByRole("button", {name: "属性菜单 零值"})).closest<HTMLElement>(".note-property-row")!;
    const name = canvas.getByRole("button", {name: "属性菜单 摘要"});
    const textLeft = within(name).getByText("摘要").getBoundingClientRect().left;
    await userEvent.hover(name);
    const grip = await canvas.findByRole("button", {name: "拖动属性 摘要"});
    expect(grip.draggable).toBe(true);
    expect(within(name).getByText("摘要").getBoundingClientRect().left).toBeCloseTo(textLeft, 1);
    await userEvent.dragAndDrop(grip, target, {targetPosition: {x: 30, y: target.getBoundingClientRect().height - 2}});
    // Release again: WebKit's native drag can suppress the next pointerdown.
    if (server.browser === "webkit") await commands.releaseLeftMouseButton();
    await waitFor(() => {
      const order = fixture.layout().order;
      expect(order.indexOf("property:零值")).toBeGreaterThanOrEqual(0);
      expect(order.indexOf("property:零值")).toBeLessThan(order.indexOf("property:摘要"));
    });
    grip.focus();
    await userEvent.keyboard("{ArrowUp}");
    await waitFor(() => {
      const order = fixture.layout().order;
      expect(order.indexOf("property:摘要")).toBeLessThan(order.indexOf("property:零值"));
    });
    expect(document.activeElement).toBe(grip);
    expect(changes).toEqual([]);
    const trigger = canvas.getByRole("button", {name: "属性菜单 标签"});
    const body = within(document.body);
    await userEvent.click(trigger, {delay: 250});
    await body.findByRole("menuitem", {name: /^属性可见性/});
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("menu", {name: "管理属性 标签"})).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  } finally { fixture.release(); }
}, 20_000);

for (const direction of ["ArrowUp", "ArrowDown"] as const) {
  test(`property grip retains focus during a delayed ${direction} save and ignores extra moves`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    let completeSave!: () => void;
    const saving = new Promise<void>(resolve => { completeSave = resolve; });
    const fixture = propertyLayoutFixture(`layout-delayed-${direction}`, () => saving), changes: unknown[] = [];
    const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4">
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={preferenceProperties} onApply={async change => { changes.push(change); }} />
    </main></PreviewModeProvider>);
    const frames = () => new Promise<void>(resolve => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); });
    try {
      const canvas = within(view.container);
      const grip = await canvas.findByRole("button", {name: "拖动属性 摘要"});
      await waitFor(() => expect(grip.draggable).toBe(true));
      const row = grip.closest(".note-property-row")!;
      const neighbor = (direction === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling)!.getAttribute("data-property-key")!;
      grip.focus();
      await userEvent.keyboard(`{${direction}}`);
      await waitFor(() => expect(fixture.writes).toHaveLength(1));
      await frames();
      expect(document.activeElement).toBe(grip);
      expect(grip).toHaveProperty("disabled", false);
      expect(grip.getAttribute("aria-disabled")).toBe("true");
      expect(grip.draggable).toBe(false);
      await userEvent.keyboard("{ArrowDown}{ArrowUp}");
      await frames();
      expect(fixture.writes).toHaveLength(1);
      expect(document.activeElement).toBe(grip);
      expect(changes).toEqual([]);
      completeSave();
      await waitFor(() => expect(grip.draggable).toBe(true));
      await frames();
      const order = fixture.layout().order;
      expect(order.indexOf("property:摘要")).toBeGreaterThanOrEqual(0);
      if (direction === "ArrowDown") expect(order.indexOf("property:摘要")).toBeGreaterThan(order.indexOf(neighbor));
      else expect(order.indexOf("property:摘要")).toBeLessThan(order.indexOf(neighbor));
      expect(fixture.writes).toHaveLength(1);
      expect(document.activeElement).toBe(grip);
      expect(changes).toEqual([]);
    } finally { completeSave(); fixture.release(); }
  }, 20_000);
}

test("removing the last tag hides its empty row and closes editing before revealing hidden properties", async () => {
  await page.viewport(1024, 900);
  await commands.setReducedMotion("reduce");
  const fixture = propertyLayoutFixture("layout-last-tag"), changes: unknown[] = [];
  let properties = structuredClone(preferenceProperties);
  const widget = () => <PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={properties} onApply={async change => {
      changes.push(change);
      properties = {...properties, tagProperty: {...properties.tagProperty!, value: change.value ?? []}};
      view.rerender(widget());
    }} />
  </main></PreviewModeProvider>;
  const view = render(widget());
  try {
    const canvas = within(view.container), body = within(document.body);
    await userEvent.click(await canvas.findByRole("button", {name: "属性菜单 标签"}));
    await userEvent.click(await body.findByRole("menuitem", {name: /^属性可见性/}));
    await userEvent.click(await body.findByRole("menuitemradio", {name: "为空时隐藏"}));
    await waitFor(() => expect(body.queryByRole("menuitemradio", {name: "为空时隐藏"})).toBeNull());
    await userEvent.click(canvas.getByRole("button", {name: "编辑标签"}));
    await body.findByRole("combobox", {name: "搜索或新建属性标签"});
    await userEvent.click(await body.findByRole("button", {name: "移除属性标签 设计"}));
    const hidden = await canvas.findByRole("button", {name: "更多属性"});
    await waitFor(() => expect(body.queryByRole("combobox", {name: "搜索或新建属性标签"})).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(hidden));
    expect(changes).toEqual([{name: "tags", type: "list", value: []}]);
    await userEvent.click(hidden);
    expect(await canvas.findByRole("button", {name: "编辑标签"})).toHaveProperty("textContent", "添加标签");
    expect(body.queryByRole("combobox", {name: "搜索或新建属性标签"})).toBeNull();
    await userEvent.click(canvas.getByRole("button", {name: "编辑标签"}));
    await body.findByRole("combobox", {name: "搜索或新建属性标签"});
    expect(changes).toHaveLength(1);
  } finally { fixture.release(); }
}, 20_000);

for (const value of ["legacy-tag", '{"legacy":"value"}']) {
  test(`hide-empty retains readonly unsupported tag data ${value}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("reduce");
    const fixture = propertyLayoutFixture(`layout-unsupported-tags-${value}`), changes: unknown[] = [];
    let properties: Properties = {...preferenceProperties, tagProperty: {name: "tags", type: "unsupported", value, editable: false}};
    const widget = () => <PreviewModeProvider mode="light"><main className="ui-theme p-4">
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={properties} onApply={async change => { changes.push(change); }} />
    </main></PreviewModeProvider>;
    const view = render(widget());
    try {
      const canvas = within(view.container), body = within(document.body);
      await userEvent.click(await canvas.findByRole("button", {name: "属性菜单 标签"}));
      await userEvent.click(await body.findByRole("menuitem", {name: /^属性可见性/}));
      await userEvent.click(await body.findByRole("menuitemradio", {name: "为空时隐藏"}));
      await waitFor(() => expect(fixture.layout().visibility["system:tags"]).toBe("hide-empty"));
      expect(canvas.getByRole("button", {name: "属性菜单 标签"})).toBeTruthy();
      expect(canvas.getByText(`属性标签 ${value} · 只读`)).toBeTruthy();
      expect(canvas.queryByRole("button", {name: "编辑标签"})).toBeNull();
      expect(body.queryByRole("combobox", {name: "搜索或新建属性标签"})).toBeNull();
      expect(changes).toEqual([]);
      properties = {...properties, tagProperty: {...properties.tagProperty!, value: ""}};
      view.rerender(widget());
      await canvas.findByRole("button", {name: "更多属性"});
      await waitFor(() => expect(canvas.queryByRole("button", {name: "属性菜单 标签"})).toBeNull());
      expect(changes).toEqual([]);
    } finally { fixture.release(); }
  }, 20_000);
}

for (const parentTheme of ["light", "dark"] as const) {
  test(`Dialog overlay follows the local theme on a ${parentTheme} page`, async () => {
    for (const theme of ["light", "dark"] as const) {
      const view = render(<PreviewModeProvider mode={parentTheme}><Dialog><DialogTrigger render={<Button />}>打开局部主题</DialogTrigger>
        <DialogContent className="ui-theme" data-ui-theme={theme}><DialogHeader><DialogTitle>局部主题</DialogTitle><DialogDescription>遮罩与弹窗共用主题。</DialogDescription></DialogHeader></DialogContent>
      </Dialog></PreviewModeProvider>);
      await userEvent.click(within(view.container).getByRole("button", { name: "打开局部主题" }));
      const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!;
      expect(overlay.dataset.uiTheme).toBe(theme);
      expect(getComputedStyle(overlay).backgroundColor).toContain(theme === "dark" ? "0.8" : "0.5");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull());
      view.unmount();
    }
  });
}

test("theme changes retain editable Docs state and system fonts while local Chinese/Latin fonts load", async () => {
  const view = render(<PreviewModeProvider mode="light"><ComponentDocs component="input" /></PreviewModeProvider>);
  const field = within(view.container).getAllByRole("textbox", { name: "名称" })[0];
  await userEvent.fill(field, "保留输入 MemoCard");
  view.rerender(<PreviewModeProvider mode="dark"><ComponentDocs component="input" /></PreviewModeProvider>);
  expect((field as HTMLInputElement).value).toBe("保留输入 MemoCard");
  await loadPreviewFonts(["noto-sans", "noto-serif"]);
  for (const [family, text] of [["Noto Sans Variable", "Aa"], ["Noto Sans SC Variable", "中文"], ["Noto Serif SC Variable", "中文"]]) {
    expect((await document.fonts.load(`400 16px "${family}"`, text)).length).toBeGreaterThan(0);
  }
  expect(getComputedStyle(field).fontFamily).toContain("system-ui");
});

test("Properties retains its input and Code view across tabs and appearance changes at 200% text size", async () => {
  await page.viewport(320, 900);
  document.documentElement.style.fontSize = "200%";
  const view = render(<PreviewModeProvider mode="light"><ComponentDocs component="input" /></PreviewModeProvider>);
  const docs = within(view.container);
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  const properties = docs.getByRole("tabpanel", { name: "Properties" });
  const field = within(properties).getByRole("textbox", { name: "名称" });
  await userEvent.fill(field, "保留属性预览");
  await userEvent.click(within(properties).getByRole("button", { name: "切换预览说明与代码" }));
  await userEvent.click(docs.getByRole("tab", { name: "Accessibility" }));
  await userEvent.click(docs.getByRole("tab", { name: "Properties" }));
  view.rerender(<PreviewModeProvider mode="dark" appearance={{ radius: "none", headingFont: "noto-serif", bodyFont: "noto-sans" }}><ComponentDocs component="input" /></PreviewModeProvider>);
  expect(within(properties).getByRole("textbox", { name: "名称" })).toBe(field);
  expect((field as HTMLInputElement).value).toBe("保留属性预览");
  expect(within(properties).getByRole("tab", { name: "Code" }).getAttribute("aria-selected")).toBe("true");
  const link = within(properties).getByRole("link", { name: "在 Canvas 中打开" });
  expect(link.getAttribute("href")).toContain("ui-input--example");
  expect(link.getAttribute("href")).toContain("theme:dark;radius:none;headingFont:noto-serif;bodyFont:noto-sans");
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(321);
  expect(field.getBoundingClientRect().width).toBeGreaterThan(0);
});

test("an unavailable font keeps readable fallback content and recovers after retry", async () => {
  await page.viewport(320, 900);
  await commands.setFontsOffline(true);
  await expect(loadPreviewFonts(["geist"], false)).rejects.toThrow();
  const view = render(<p style={{ fontFamily: '"Geist Variable", sans-serif', overflowWrap: "anywhere" }}>字体离线时仍可阅读 MemoCard notes</p>);
  expect(view.container.textContent).toContain("仍可阅读");
  expect(view.container.getBoundingClientRect().height).toBeGreaterThan(0);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(321);
  await commands.setFontsOffline(false);
  await loadPreviewFonts(["geist"], false);
  expect(document.fonts.check('400 16px "Geist Variable"', "Aa")).toBe(true);
});

test("real reduced-motion media removes Sheet transition and Escape restores focus", async () => {
  render(<PreviewModeProvider mode="light"><Sheet><SheetTrigger render={<Button />}>打开抽屉</SheetTrigger><SheetContent><SheetHeader><SheetTitle>动效验收</SheetTitle><SheetDescription>验证系统动态偏好与键盘返回。</SheetDescription></SheetHeader></SheetContent></Sheet></PreviewModeProvider>);
  const trigger = page.getByRole("button", { name: "打开抽屉" });
  await trigger.click();
  await waitFor(() => expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull());
  const dialog = document.querySelector<HTMLElement>('[data-slot="sheet-content"]')!;
  const normal = parseFloat(getComputedStyle(dialog).transitionDuration);
  expect(normal).toBeGreaterThan(0);
  await commands.setReducedMotion("reduce");
  await waitFor(() => expect(parseFloat(getComputedStyle(dialog).transitionDuration)).toBe(0));
  await userEvent.keyboard("{Escape}");
  await expect.element(trigger).toHaveFocus();
  await expect.element(page.getByRole("dialog", { name: "动效验收" })).not.toBeInTheDocument();
});

function LazyVaultImage() {
  const { ref, state, onLoaded, onFailed } = useNoteImage("memocard-asset://vault/assets/clipped.png", true);
  return <span data-image-state={state} style={{ display: "block", width: 80, height: 40 }}>
    <img ref={ref} alt="裁切图片" width={80} height={40} loading="lazy" onLoad={onLoaded} onError={onFailed} />
  </span>;
}

test("lazy vault images wait for every ancestor clip and read once after nested scrolling", async () => {
  await page.viewport(800, 600);
  const canvas = document.createElement("canvas");
  canvas.width = 16; canvas.height = 8;
  canvas.getContext("2d")!.fillRect(0, 0, 16, 8);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), "image/png"));
  let reads = 0;
  const releaseAssets = setStorybookBrowserAssets({ get "assets/clipped.png"() { reads++; return blob; } });
  const view = render(<div data-testid="outer-clip" style={{ width: 320, height: 140, overflow: "auto" }}>
    <div style={{ height: 500, paddingTop: 200 }}>
      <div data-testid="inner-clip" style={{ height: 120, overflow: "auto" }}>
        <div style={{ height: 400 }}><div style={{ height: 180 }} />
          <LazyVaultImage />
        </div>
      </div>
    </div>
  </div>);
  const outer = view.getByTestId("outer-clip"), inner = view.getByTestId("inner-clip");
  const image = view.getByRole("img", { name: "裁切图片" }) as HTMLImageElement;
  const intersecting = () => new Promise<boolean>(resolve => {
    const observer = new IntersectionObserver(([entry]) => { observer.disconnect(); resolve(entry.isIntersecting); }, { root: null });
    observer.observe(image.closest("[data-image-state]")!);
  });
  try {
    expect(await intersecting()).toBe(false);
    expect(reads).toBe(0);
    inner.scrollTop = 180;
    expect(await intersecting()).toBe(false);
    expect(reads).toBe(0);
    outer.scrollTop = 200;
    expect(await intersecting()).toBe(true);
    await waitFor(() => { expect(reads).toBe(1); expect(image.naturalWidth).toBe(16); });
    expect(image.getAttribute("width")).toBe("80");
    expect(image.getAttribute("height")).toBe("40");
    outer.scrollTop = 0;
    expect(await intersecting()).toBe(false);
    outer.scrollTop = 200;
    expect(await intersecting()).toBe(true);
    expect(reads).toBe(1);
  } finally { view.unmount(); releaseAssets(); }
});
}
