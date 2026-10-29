import { afterEach, expect, test } from "vitest";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { commands, page, server, userEvent } from "vitest/browser";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { InputFocusFixture } from "./input-focus-fixture";
import { ComponentDocs } from "../ui/ComponentDocs";
import { ComponentDocsExample } from "../ui/ComponentDocsTemplate";
import { componentDocs, type ComponentKey } from "../ui/component-docs.data";
import { Button } from "../ui/components/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/components/accordion";
import { WebSettings } from "../ui/web/WebSettings";
import type { AppViewState } from "../src/App";
import { Card } from "../ui/components/card";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../ui/components/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui/components/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/components/dialog";
import { NoteProperties } from "../ui/business/NoteProperties";
import { NoteCollection } from "../ui/business/NoteCollection";
import { QuickCapture } from "../ui/business/QuickCapture";
import { PropertyConfirmationPopup } from "../ui/business/property-confirmation";
import { PreviewModeProvider } from "../ui/preview-mode";
import { loadPreviewFonts } from "../ui/preview-fonts";
import { useNoteImage } from "../src/use-note-image";
import { setStorybookBrowserAssets, setStorybookRequestHandler } from "./bridge";
import { editorNote } from "./editor-note";
import "../.storybook/preview.css";
import "../ui/preview-appearance.css";
import "../ui/business/NoteCollection.css";

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
      expect(bounds.left - outset, parent.className).toBeGreaterThanOrEqual(rect.left - 0.5);
      expect(bounds.right + outset, parent.className).toBeLessThanOrEqual(rect.right + 0.5);
    }
    if (/(hidden|clip|auto|scroll)/.test(clip.overflowY)) {
      expect(bounds.top - outset, parent.className).toBeGreaterThanOrEqual(rect.top - 0.5);
      expect(bounds.bottom + outset, parent.className).toBeLessThanOrEqual(rect.bottom + 0.5);
    }
  }
}

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
    if (kind === "source") expect(getComputedStyle(surface).borderBottomLeftRadius).toBe(getComputedStyle(surface.closest(".ui-docs-example")!).borderBottomLeftRadius);
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
      canvas.getByRole("switch", { name: "开关" }), canvas.getByRole("radio", { name: "第一个单选项" }),
      canvas.getByRole("button", { name: "切换按钮" }), await canvas.findByRole("slider", { name: "调整值" }),
      canvas.getByRole("tab", { name: "第一个标签" }), canvas.getByRole("button", { name: "折叠控件" }),
      canvas.getByText("原生折叠"),
    ];
    for (const control of controls) {
      const surface = control.closest('[data-slot="slider-thumb"]') ?? control;
      await userEvent.click(surface);
      expect(getComputedStyle(surface).outlineStyle, control.outerHTML).toBe("none");
      if (surface !== control) {
        control.focus();
        const previous = Number(control.getAttribute("aria-valuenow"));
        await userEvent.keyboard("{ArrowRight}");
        expect(Number(control.getAttribute("aria-valuenow"))).toBeGreaterThan(previous);
      }
      else { await userEvent.tab(); await userEvent.tab({ shift: true }); }
      expect(document.activeElement).toBe(control);
      expectKeyboardOutline(surface, mode);
      if (surface !== control) expect(getComputedStyle(control).outlineStyle).toBe("none");
      await userEvent.click(surface);
      expect(getComputedStyle(surface).outlineStyle).toBe("none");
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

  test(`collection layout changes preserve resting card borders without a color transition in ${mode}`, async () => {
    await page.viewport(1024, 900);
    await commands.setReducedMotion("no-preference");
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme bg-body p-8" data-ui-theme={mode}>
      <NoteCollection notes={[editorNote]} query="" onQueryChange={() => {}} searchPlaceholder="搜索" searchDisabled={false} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container);
    await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
    const card = canvas.getByRole("button", { name: `打开 ${editorNote.title}` }).closest(".ui-note-card")!;
    await Promise.all(card.getAnimations().map(animation => animation.finished));
    const restingBorder = getComputedStyle(card).borderTopColor;
    await userEvent.click(canvas.getByRole("button", { name: "列表布局" }));
    expect(getComputedStyle(card).borderTopWidth).toBe("0px");
    expect(getComputedStyle(card).borderTopColor).toBe(restingBorder);
    await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
    expect(card.matches(":hover")).toBe(false);
    expect(getComputedStyle(card).borderTopWidth).toBe("1px");
    expect(getComputedStyle(card).borderTopColor).toBe(restingBorder);
    expect(card.getAnimations().filter(animation => animation instanceof CSSTransition && animation.transitionProperty.startsWith("border-"))).toHaveLength(0);
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
      <Card className="ui-card-hover-shadow" data-testid="forced-card">高对比卡片</Card>
      <Card data-testid="forced-raised-card">高对比浮起卡片</Card>
      <QuickCapture vaultId="shadow-forced-colors-test" rootNotes tags={[]} disabled={false} canImage={false} handle={{ current: null }} onRecorded={() => {}} />
      <Popover><PopoverTrigger render={<Button />}>打开高对比浮层</PopoverTrigger>
        <PopoverContent className="ui-theme" data-ui-theme={mode}><PopoverTitle>高对比浮层</PopoverTitle><Button>前一项</Button><Button>焦点项</Button></PopoverContent>
      </Popover>
    </main></PreviewModeProvider>);
    const card = within(view.container).getByTestId("forced-card");
    await userEvent.hover(card);
    const field = within(view.container).getByRole("textbox", { name: "快速输入内容" });
    for (const surface of [card, within(view.container).getByTestId("forced-raised-card"), field.closest('[data-slot="input-group"]')!]) {
      const style = getComputedStyle(surface);
      expect(style.boxShadow).toBe("none");
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
    expect(outer.classList.contains("shadow-high")).toBe(true);
    expect(inner.classList.contains("shadow-high")).toBe(true);
    expect(getComputedStyle(inner).boxShadow).toBe(getComputedStyle(outer).boxShadow);
    const bounds = inner.getBoundingClientRect();
    expect(inner.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2))).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(inner.isConnected).toBe(false));
    expect(outer.isConnected).toBe(true);
    expect(document.activeElement).toBe(innerTrigger);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(outer.isConnected).toBe(false));
    expect(document.activeElement).toBe(outerTrigger);
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

for (const width of [320, 1024]) for (const theme of ["light", "dark"] as const) {
  test(`property editing and confirmation surfaces stay consistent at ${width}px in ${theme}`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const changes: unknown[] = [];
    const release = setStorybookRequestHandler(operation => {
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
      await userEvent.click(await canvas.findByRole("button", { name: /^属性$/ }));
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
