import { afterEach, expect, inject, test, vi } from "vitest";
import type { NoteProperties as Properties, PropertyLayout, TagPreferenceState, VaultStatus } from "@memocard/contracts";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { commands, page, server, userEvent } from "vitest/browser";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { InputFocusFixture } from "./input-focus-fixture";
import { ComponentDocs } from "../ui/ComponentDocs";
import { ComponentDocsExample } from "../ui/ComponentDocsTemplate";
import { componentDocs, type ComponentKey } from "../ui/component-docs.data";
import { Button } from "../ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/components/tabs";
import { Checkbox } from "../ui/components/checkbox";
import { TooltipHints } from "../ui/components/tooltip";
import { Sidebar, SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "../ui/components/sidebar";
import { ActionGroup, MobileActionGroupProvider } from "../ui/components/action-group";
import { Slider } from "../ui/components/slider";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/components/accordion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../ui/components/dropdown-menu";
import { WebSettings } from "../ui/web/WebSettings";
import { App, type AppViewState } from "../src/App";
import { richBlockBody } from "../src/rich-block-frame";
import { WebAppearanceProvider } from "../ui/web/WebAppearance";
import { preloadWebEditor, renderWebApp } from "../ui/web/WebAppView";
import { createWorkspaceFixture } from "../ui/web/workspace-fixture";
import propertyStoryMeta, { LayoutStress } from "../ui/stories/business-note-properties.stories";
import { Card } from "../ui/components/card";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../ui/components/popover";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "../ui/components/drawer";
import { ThemeScope } from "../ui/components/theme-scope";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../ui/components/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/components/dialog";
import { NoteProperties } from "../ui/business/NoteProperties";
import { NoteCollection } from "../ui/business/NoteCollection";
import { AppSidebar } from "../ui/business/sidebar";
import sidebarStoryMeta from "../ui/stories/business-sidebar.stories";
import { NoteSearchDialog } from "../ui/business/NoteSearchDialog";
import { QuickCapture } from "../ui/business/QuickCapture";
import { PropertyConfirmationPopup } from "../ui/business/property-confirmation";
import { MermaidContent, NoteMarkdown, VaultImage } from "../ui/business/NoteMarkdown";
import { RichMarkdownEditor } from "../ui/business/RichMarkdownEditor";
import { PreviewModeProvider } from "../ui/preview-mode";
import { loadPreviewFonts } from "../ui/preview-fonts";
import { useNoteImage } from "../src/use-note-image";
import { setStorybookBrowserAssets, setStorybookClientMode, setStorybookRequestHandler } from "./bridge";
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
    {name: "尚未设置", type: "checkbox", value: false, editable: true, missing: true},
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

function expectPropertyControlRadius(root: HTMLElement) {
  for (const control of root.querySelectorAll('button, input, textarea, select, [role="menuitem"], [role="menuitemradio"]')) {
    if (control.getAttribute('aria-hidden') === 'true' || control.hasAttribute('hidden')) continue;
    const radius = control.matches('.note-tag-search') ? "0px"
      : control.matches('.ui-sheet-close-button, .note-tag-pill, .note-tag-color-trigger, .note-tag-remove, [data-day], .note-date-picker .rdp-nav > button') ? "9999px" : "8px";
    expect(getComputedStyle(control).borderRadius, control.outerHTML.slice(0, 350)).toBe(radius);
  }
}

function expectPropertyCaretInsideCorners(input: HTMLElement) {
  const style = getComputedStyle(input);
  expect(parseFloat(style.paddingLeft)).toBeGreaterThanOrEqual(parseFloat(style.borderTopLeftRadius));
  expect(parseFloat(style.paddingRight)).toBeGreaterThanOrEqual(parseFloat(style.borderTopRightRadius));
  expect(input.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)).toBeGreaterThanOrEqual(parseFloat(style.fontSize));
}

// Geometry and focus assertions must run after Base UI's opening/closing lifecycle.
async function settlePropertyPopup(popup: HTMLElement) {
  await expect.element(popup).not.toHaveAttribute("data-starting-style");
  await Promise.all(popup.getAnimations().map(animation => animation.finished));
}

async function dismissPropertyPopup(popup: HTMLElement, trigger?: HTMLElement) {
  await userEvent.keyboard("{Escape}");
  await Promise.all(popup.getAnimations().map(animation => animation.finished));
  await expect.element(popup).not.toBeInTheDocument();
  if (trigger) await expect.element(trigger).toHaveFocus();
}

// The fixed touch project registers only the shared list flow below.
if (!inject("uiQualityTouch")) {
for (const mode of ["light", "dark"] as const) test(`property selectors expand in place and keep selected values during loading in ${mode}`, async () => {
  await page.viewport(1280, 900);
  await commands.setReducedMotion("reduce");
  let finishTags!: (value: {tags: {name:string}[]}) => void;
  const tags = new Promise<{tags: {name:string}[]}>(resolve => { finishTags = resolve; });
  const release = setStorybookRequestHandler(async operation => {
    if (operation === "getStatus") return propertyLayoutStatus();
    if (operation === "getPropertyLabels") return { labels: {}, contentHash: "labels" };
    if (operation === "getPropertyLayout") return emptyPropertyLayout();
    if (operation === "listTags") return tags;
    throw new Error(`Unexpected selector operation: ${operation}`);
  });
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode} style={{ maxWidth: 720, marginInline: "auto", padding: "80px 16px" }}>
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async () => {}} savedProperties={{
      contentHash: editorNote.contentHash, writable: true,
      tagProperty: { name: "tags", type: "list", value: ["现有"], editable: true },
      properties: [
        { name: "单选", type: "select", value: "设计", options: [{ name: "设计", color: "blue" }], editable: true },
        { name: "多选", type: "multiSelect", value: ["设计"], options: [{ name: "设计", color: "blue" }], editable: true },
      ],
    }} />
  </main></PreviewModeProvider>);
  try {
    const canvas = within(view.container), body = within(document.body);
    const trigger = await canvas.findByRole("button", { name: "编辑标签" });
    const anchor = trigger.querySelector('.note-tag-pill')!.getBoundingClientRect();
    await userEvent.hover(trigger);
    await waitFor(() => expect(getComputedStyle(trigger).backgroundColor).not.toBe("rgba(0, 0, 0, 0)"));
    await userEvent.click(trigger);
    // The first lazy import can still be showing its module-loading fallback.
    await expect.element(page.getByRole("combobox", { name: "搜索或新建属性标签" })).toBeVisible();
    const loading = body.getByRole("status", { name: "正在加载标签…" });
    const popup = body.getByRole("dialog", { name: "编辑标签" });
    await settlePropertyPopup(popup);
    expect(getComputedStyle(popup.querySelector('.note-tag-header')!).padding).toBe("8px");
    expectPropertyCaretInsideCorners(within(popup).getByRole("combobox", { name: "搜索或新建属性标签" }));
    const aligned = (element: HTMLElement, bounds: DOMRect) => {
      const pill = element.querySelector('.note-tag-selected .note-tag-pill')!.getBoundingClientRect();
      expect(pill.left).toBeCloseTo(bounds.left, 1);
      expect(pill.top).toBeCloseTo(bounds.top, 1);
    };
    await waitFor(() => aligned(popup, anchor));
    await waitFor(() => expect(getComputedStyle(trigger).backgroundColor).toBe("rgba(0, 0, 0, 0)"));
    expect(loading.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3);
    expect(getComputedStyle(loading.querySelector('[data-slot="skeleton"]')!).animationName).toBe("none");
    expect(within(popup).getByRole("toolbar", { name: "已选标签" }).textContent).toContain("现有");
    expect(body.queryByText("没有其他标签，输入名称可新建。")).toBeNull();
    finishTags({ tags: [{ name: "现有" }, { name: "候选" }] });
    const candidate = await body.findByRole("option", { name: "属性标签 候选" });
    expect(getComputedStyle(popup).borderRadius).toBe("12px");
    expect(getComputedStyle(candidate).height).toBe("32px");
    expect(getComputedStyle(candidate).fontWeight).toBe("400");
    expect(candidate.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    await waitFor(() => aligned(popup, anchor));
    expectPropertyControlRadius(popup);
    const tagSearch = within(popup).getByRole("combobox", { name: "搜索或新建属性标签" });
    await userEvent.type(tagSearch, "候选");
    expect((tagSearch as HTMLInputElement).value).toBe("候选");
    expectPropertyCaretInsideCorners(tagSearch);
    await userEvent.clear(tagSearch);
    await waitFor(() => aligned(popup, anchor));
    expect(body.queryByRole("status", { name: "正在加载标签…" })).toBeNull();
    const remove = within(popup).getByRole("button", { name: "移除属性标签 现有" });
    await userEvent.hover(remove);
    const removeStyle = getComputedStyle(remove);
    expect(removeStyle.backgroundClip).toMatch(/^content-box(?:,\s*content-box)*$/);
    await dismissPropertyPopup(popup, trigger);
    for (const name of ["单选", "多选"]) {
      const button = canvas.getByRole("button", { name: `编辑属性 ${name}` });
      const bounds = button.querySelector('.note-tag-pill')!.getBoundingClientRect();
      await userEvent.click(button);
      expectPropertyCaretInsideCorners(await body.findByRole("combobox", { name: "搜索或创建选项" }));
      await waitFor(() => aligned(body.getByRole("dialog", { name: `编辑属性 ${name}` }), bounds));
      const choicePopup = body.getByRole("dialog", { name: `编辑属性 ${name}` });
      await settlePropertyPopup(choicePopup);
      expect(getComputedStyle(choicePopup.querySelector('.note-tag-header')!).padding).toBe("8px");
      expect(getComputedStyle(choicePopup).borderRadius).toBe("12px");
      for (const option of within(choicePopup).getAllByRole("option")) {
        expect(getComputedStyle(option).height).toBe("32px");
        expect(getComputedStyle(option.querySelector('.note-tag-pill')!).fontWeight).toBe("400");
      }
      expectPropertyControlRadius(choicePopup);
      await waitFor(() => expect(getComputedStyle(button).backgroundColor).toBe("rgba(0, 0, 0, 0)"));
      await dismissPropertyPopup(choicePopup, button);
    }
    await page.viewport(390, 900);
    await userEvent.click(trigger);
    const sheet = await body.findByRole("dialog", { name: "编辑标签" });
    await settlePropertyPopup(sheet);
    expect(sheet.dataset.slot).toBe("sheet-content");
    expectPropertyCaretInsideCorners(within(sheet).getByRole("combobox", { name: "搜索或新建属性标签" }));
    expectPropertyControlRadius(sheet);
    await waitFor(() => expect(getComputedStyle(canvas.getByRole("button", { name: "编辑标签", hidden: true })).backgroundColor).toBe("rgba(0, 0, 0, 0)"));
    await waitFor(() => {
      expect(sheet.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
      expect(sheet.getBoundingClientRect().right).toBeLessThanOrEqual(390);
      expect(sheet.getBoundingClientRect().bottom).toBeCloseTo(900, 0);
    });
    expect(parseFloat(getComputedStyle(sheet).borderTopLeftRadius)).toBeCloseTo(20.8, 4);
    expect(getComputedStyle(sheet).paddingInlineStart).toBe("16px");
    expect(getComputedStyle(sheet.querySelector('[data-slot="sheet-header"]')!).paddingBlock).toBe("4px");
    expect(within(sheet).getByRole("option", { name: "属性标签 候选" }).getBoundingClientRect().height).toBe(32);
  } finally { view.unmount(); release(); }
});

for (const mode of ["light", "dark"] as const) test(`property selector failures retain the header and recover in ${mode}`, async () => {
  await commands.setReducedMotion("reduce");
  await page.viewport(1280, 900);
  let failing = true, reads = 0;
  const release = setStorybookRequestHandler(async operation => {
    if (operation === "getStatus") return propertyLayoutStatus();
    if (operation === "getPropertyLabels") return { labels: {}, contentHash: "labels" };
    if (operation === "getPropertyLayout") return emptyPropertyLayout();
    if (operation === "listTags") {
      reads++;
      if (failing) throw new Error("unavailable");
      return { tags: [{ name: "候选" }] };
    }
    throw new Error(`Unexpected failure-state operation: ${operation}`);
  });
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode} style={{ maxWidth: 720, marginInline: "auto", padding: "80px 16px" }}>
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async () => { throw new Error("Recovery must not save"); }} savedProperties={{
      contentHash: editorNote.contentHash, writable: true,
      tagProperty: { name: "tags", type: "list", value: ["现有"], editable: true }, properties: [],
    }} />
  </main></PreviewModeProvider>);
  try {
    for (const width of [1280, 390]) {
      failing = true;
      await page.viewport(width, 900);
      const trigger = await within(view.container).findByRole("button", { name: "编辑标签" });
      const anchor = trigger.querySelector('.note-tag-pill')!.getBoundingClientRect();
      await userEvent.click(trigger);
      const popup = await within(document.body).findByRole("dialog", { name: "编辑标签" });
      const alert = await within(popup).findByRole("alert");
      await settlePropertyPopup(popup);
      expect(alert.textContent).toBe("加载失败重试");
      const header = popup.querySelector('.note-tag-header')!;
      expect(header.textContent).toContain("现有");
      const pill = header.querySelector('.note-tag-pill')!.getBoundingClientRect();
      const headerOffset = pill.top - popup.getBoundingClientRect().top;
      if (width === 1280) {
        expect(pill.left).toBeCloseTo(anchor.left, 1);
        expect(pill.top).toBeCloseTo(anchor.top, 1);
      }
      const retry = within(alert).getByRole("button", { name: "重试加载标签" });
      expect(retry.getBoundingClientRect().height).toBe(width < 768 ? 44 : 32);
      expect(getComputedStyle(retry).borderRadius).toBe("8px");
      expect(getComputedStyle(alert).padding).toBe("8px");
      expectPropertyControlRadius(popup);
      const input = within(popup).getByRole("combobox", { name: "搜索或新建属性标签" });
      await userEvent.type(input, "候选");
      failing = false;
      const previousReads = reads;
      await userEvent.click(retry);
      await within(popup).findByRole("option", { name: "属性标签 候选" });
      expect(reads).toBe(previousReads + 1);
      expect(within(popup).queryByRole("alert")).toBeNull();
      expect(input).toHaveProperty("value", "候选");
      expect(document.activeElement).toBe(input);
      expect(header.querySelector('.note-tag-pill')!.getBoundingClientRect().top - popup.getBoundingClientRect().top).toBeCloseTo(headerOffset, 1);
      await dismissPropertyPopup(popup);
    }
  } finally { view.unmount(); release(); }
});

for (const mode of ["light", "dark"] as const) for (const width of [1280, 1024, 390]) test(`property editors preserve field positions and align selected text in ${mode} at ${width}px`, async () => {
  await commands.setReducedMotion("reduce");
  await page.viewport(width, 1000);
  const changes: unknown[] = [];
  const release = setStorybookRequestHandler(async operation => {
    if (operation === "getStatus") return propertyLayoutStatus();
    if (operation === "getPropertyLabels") return { labels: {}, contentHash: "labels" };
    if (operation === "getPropertyLayout") return emptyPropertyLayout();
    if (operation === "listTags") return { tags: [] };
    if (operation === "pickImage") throw new Error("无法读取图片");
    throw new Error(`Unexpected property review operation: ${operation}`);
  });
  const selected = ["设计", "开发", "有多个字的选项", "another selected value", "最后一个选项"];
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode} style={{ maxWidth: 720, marginInline: "auto", padding: "32px 16px" }}>
    <NoteProperties note={editorNote} tags={["正文", "共享"]} onLocateTag={() => { throw new Error("Opening must not navigate"); }} canEdit busy={false} onApply={async change => { changes.push(change); }} savedProperties={{
      contentHash: editorNote.contentHash, writable: true,
      tagProperty: { name: "tags", type: "list", value: [...selected, "共享"], editable: true },
      properties: [
        { name: "数字", type: "number", value: "1100.25", editable: true },
        { name: "日期", type: "date", value: "2026-11-04", editable: true },
        { name: "单选", type: "select", value: "设计", options: [{ name: "设计", color: "blue" }], editable: true },
        { name: "多选", type: "multiSelect", value: selected, editable: true },
        { name: "复选框", type: "checkbox", value: false, editable: true },
        { name: "图片", type: "image", value: "../assets/review.png", editable: true },
        { name: "空图片", type: "image", value: "", editable: true },
      ],
    }} />
    <p data-testid="following-content">后续正文位置保持不变</p>
  </main></PreviewModeProvider>);
  const textRects = (root: Element) => [...root.querySelectorAll('.note-tag-pill')].map(pill => {
    const walker = document.createTreeWalker(pill, NodeFilter.SHOW_TEXT), node = walker.nextNode()!;
    const range = document.createRange(); range.selectNodeContents(node);
    return [...range.getClientRects()].map(rect => ({left: rect.left, top: rect.top}));
  });
  try {
    const canvas = within(view.container), body = within(document.body);
    await canvas.findByRole("button", { name: "编辑标签" });
    await document.fonts.ready;
    const origin = view.container.querySelector('.note-properties')!;
    const layout = () => [...view.container.querySelectorAll('.note-property-row, [data-testid="following-content"]')].map(row => ({top: row.getBoundingClientRect().top - origin.getBoundingClientRect().top, height: row.getBoundingClientRect().height}));
    for (const name of ["编辑标签", "编辑属性 单选", "编辑属性 多选", "编辑属性 日期", "预览图片 图片"]) {
      const trigger = canvas.getByRole("button", { name });
      for (const pill of trigger.querySelectorAll('.note-tag-pill')) {
        const style = getComputedStyle(pill);
        expect(style.paddingInlineEnd).toBe(style.paddingInlineStart);
      }
      const bounds = layout();
      await userEvent.click(trigger);
      const popup = await body.findByRole("dialog", { name: name === "编辑标签" ? name : name === "预览图片 图片" ? "图片预览 图片" : name });
      await settlePropertyPopup(popup);
      await waitFor(() => expect(layout()).toEqual(bounds));
      if (name === "编辑标签" || name === "编辑属性 单选" || name === "编辑属性 多选") {
        await within(popup).findByRole("combobox");
        if (name === "编辑标签") await waitFor(() => expect(within(popup).queryByRole("status", { name: "正在加载标签…" })).toBeNull());
        if (width >= 768) await waitFor(() => {
          const before = textRects(trigger), after = textRects(popup.querySelector('.note-tag-header')!);
          expect(after.length).toBe(before.length);
          // Remove buttons can reflow the chips after the first one.
          expect(after[0][0].left, name).toBeCloseTo(before[0][0].left, 1);
          expect(after[0][0].top, name).toBeCloseTo(before[0][0].top, 1);
        });
      }
      await dismissPropertyPopup(popup);
    }
    const beforeError = layout();
    await userEvent.click(canvas.getByRole("button", { name: "上传图片 空图片" }));
    const failurePopup = await body.findByRole("dialog", { name: "图片操作 空图片" });
    expect(within(failurePopup).getByRole("alert").textContent).toBe("无法读取图片");
    expect(layout()).toEqual(beforeError);
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    await dismissPropertyPopup(failurePopup);
    const checkbox = canvas.getByRole("checkbox", { name: "切换属性 复选框" });
    const beforeToggle = layout();
    await userEvent.click(checkbox);
    await waitFor(() => expect(changes).toEqual([{ name: "复选框", type: "checkbox", value: true }]));
    expect(layout()).toEqual(beforeToggle);
    changes.length = 0;
    const number = canvas.getByRole("button", { name: "编辑属性 数字" });
    const numericStyle = getComputedStyle(number).fontVariantNumeric;
    const bounds = layout();
    await userEvent.click(number);
    const input = await canvas.findByRole("textbox", { name: "属性值" });
    expect(getComputedStyle(input).fontVariantNumeric).toBe(numericStyle);
    expect(layout()).toEqual(bounds);
    await userEvent.keyboard("{Escape}");
    expect(changes).toEqual([]);
  } finally { view.unmount(); release(); }
});

for (const mode of ["light", "dark"] as const) test(`property controls share 32px display rows, 36px floating editors and control radii in ${mode}`, async () => {
  await commands.setReducedMotion("reduce");
  await page.viewport(390, 900);
  const fixture = propertyLayoutFixture(`property-control-heights-${mode}`);
  const today = new Date();
  const selectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getDate() === 1 ? "02" : "01"}`;
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode} style={{ maxWidth: 640, marginInline: "auto", padding: 16 }}>
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} onApply={async () => {}} savedProperties={{
      contentHash: editorNote.contentHash, writable: true,
      tagProperty: { name: "tags", type: "list", value: ["设计"], editable: true },
      properties: [
        { name: "文本", type: "text", value: "一行内容", editable: true },
        { name: "空值", type: "text", value: "", editable: true },
        { name: "数字", type: "number", value: "0", editable: true },
        { name: "日期", type: "date", value: selectedDate, editable: true },
        { name: "单选", type: "select", value: "设计", options: [{ name: "设计", color: "blue" }], editable: true },
        { name: "多选", type: "multiSelect", value: ["设计"], options: [{ name: "设计", color: "blue" }], editable: true },
        { name: "复选框", type: "checkbox", value: false, editable: true },
        { name: "空图片", type: "image", value: "", editable: true },
        { name: "图片", type: "image", value: "../assets/height.png", editable: true },
        { name: "多行文本", type: "text", value: "多行内容自然增高。".repeat(30), editable: true },
        { name: "多行选项", type: "multiSelect", value: Array.from({ length: 20 }, (_, index) => `选项${index}`), editable: true },
      ],
    }} />
  </main></PreviewModeProvider>);
  try {
    const canvas = within(view.container);
    await canvas.findByRole("button", { name: "编辑属性 文本" });
    await document.fonts.ready;
    for (const width of [320, 1024]) {
      await page.viewport(width, 900);
      for (let state = 0; state < 2; state++) {
        const toggle = canvas.getByRole("button", { name: /^(更多属性|收起)$/ });
        expect(toggle.getBoundingClientRect().height, toggle.textContent ?? '').toBe(32);
        await userEvent.click(toggle);
        const addRow = view.container.querySelector(".note-property-add-row");
        if (addRow) expect(addRow.getBoundingClientRect().height).toBe(32);
      }
      await waitFor(() => {
        for (const row of view.container.querySelectorAll<HTMLElement>(".note-property-row[data-property-key]")) {
          const label = row.querySelector<HTMLElement>(".note-property-label")!;
          const value = row.querySelector<HTMLElement>("dd")!;
          const control = value.matches(".note-property-value") ? value : value.querySelector<HTMLElement>(".note-property-edit, .note-property-value, .note-property-image-trigger")!;
          const multiline = row.dataset.propertyKey === "property:多行文本" || row.dataset.propertyKey === "property:多行选项";
          expect(label.getBoundingClientRect().height, row.dataset.propertyKey).toBe(32);
          const grip = row.querySelector<HTMLElement>('.note-property-grip');
          if (grip) {
            expect(grip.getBoundingClientRect().height).toBe(32);
            expect(grip.getBoundingClientRect().top).toBeCloseTo(label.getBoundingClientRect().top, 1);
          }
          if (multiline) expect(control.getBoundingClientRect().height, row.dataset.propertyKey).toBeGreaterThan(32);
          else {
            expect(control.getBoundingClientRect().height, row.dataset.propertyKey).toBe(32);
          }
          expect(row.getBoundingClientRect().height, row.dataset.propertyKey).toBe(control.getBoundingClientRect().height);
          expect(value.getBoundingClientRect().height, row.dataset.propertyKey).toBe(control.getBoundingClientRect().height);
          expect(control.getBoundingClientRect().top, row.dataset.propertyKey).toBeCloseTo(label.getBoundingClientRect().top, 1);
        }
        for (const control of view.container.querySelectorAll('.note-properties :is(button, input, textarea, select, .note-property-inline):not(.note-tag-pill, [aria-hidden="true"], [hidden])')) {
          expect(getComputedStyle(control).borderRadius, control.outerHTML.slice(0, 350)).toBe(control.matches('[role="checkbox"]') ? "4px" : "8px");
        }
        for (const tag of view.container.querySelectorAll('.note-properties .note-tag-pill')) {
          expect(getComputedStyle(tag).borderRadius).toBe("9999px");
        }
      });
      for (const name of ["文本", "数字", "空值"]) {
        const rowBefore = canvas.getByRole("button", { name: `编辑属性 ${name}` }).closest(".note-property-row")!;
        const nextOffset = rowBefore.nextElementSibling!.getBoundingClientRect().top - rowBefore.getBoundingClientRect().top;
        await userEvent.click(canvas.getByRole("button", { name: `编辑属性 ${name}` }));
        const input = await canvas.findByRole("textbox", { name: "属性值" });
        expect(input.getBoundingClientRect().height).toBe(36);
        expect(input.closest('.note-property-row')!.getBoundingClientRect().height).toBe(32);
        expect(getComputedStyle(input).paddingTop).toBe("7px");
        expect(getComputedStyle(input).paddingBottom).toBe("7px");
        expect(getComputedStyle(input).paddingLeft).toBe("8px");
        expect(getComputedStyle(input).paddingRight).toBe("8px");
        const display = rowBefore.querySelector<HTMLElement>('.note-property-edit')!;
        const displayStyle = getComputedStyle(display), inputStyle = getComputedStyle(input);
        expect(input.getBoundingClientRect().left + parseFloat(inputStyle.paddingLeft)).toBeCloseTo(display.getBoundingClientRect().left + parseFloat(displayStyle.paddingLeft), 1);
        expect(input.getBoundingClientRect().top + parseFloat(inputStyle.paddingTop)).toBeCloseTo(display.getBoundingClientRect().top + parseFloat(displayStyle.paddingTop), 1);
        expect(input.clientWidth - parseFloat(inputStyle.paddingLeft) - parseFloat(inputStyle.paddingRight)).toBeCloseTo(display.clientWidth - parseFloat(displayStyle.paddingLeft) - parseFloat(displayStyle.paddingRight), 1);
        expect(getComputedStyle(input).borderRadius).toBe("8px");
        expect(getComputedStyle(input.closest('form')!).borderRadius).toBe("8px");
        expect(getComputedStyle(input.closest('form')!).position).toBe("absolute");
        expect(rowBefore.nextElementSibling!.getBoundingClientRect().top - rowBefore.getBoundingClientRect().top).toBeCloseTo(nextOffset, 1);
        if (name === "文本") {
          await userEvent.fill(input, "第一行\n第二行\n第三行");
          await waitFor(() => expect(input.getBoundingClientRect().height).toBeGreaterThan(36));
          expect(rowBefore.getBoundingClientRect().height).toBe(32);
          expect(rowBefore.nextElementSibling!.getBoundingClientRect().top - rowBefore.getBoundingClientRect().top).toBeCloseTo(nextOffset, 1);
        }
        await userEvent.keyboard("{Escape}");
      }
      await userEvent.click(canvas.getByRole("button", { name: "编辑属性 日期" }));
      await within(document.body).findByRole("textbox", { name: "属性值" });
      const datePopup = within(document.body).getByRole("dialog", { name: "编辑属性 日期" });
      expectPropertyControlRadius(datePopup);
      const dateInput = within(datePopup).getByRole("textbox", { name: "属性值" });
      expect(getComputedStyle(dateInput).paddingInline).toBe("8px");
      for (const name of ["上个月", "下个月"]) {
        const { width, height } = within(datePopup).getByRole("button", { name }).getBoundingClientRect();
        expect(width).toBeCloseTo(height, 1);
      }
      if (width >= 768) {
        expect(getComputedStyle(datePopup).padding).toBe("8px");
        const todayButton = datePopup.querySelector<HTMLElement>("[data-today] [data-day]")!;
        const selectedButton = datePopup.querySelector<HTMLElement>('[data-selected-single="true"]')!;
        const colors = (button: HTMLElement) => {
          const { backgroundColor, backgroundImage, color } = getComputedStyle(button);
          return { backgroundColor, backgroundImage, color };
        };
        const todayColors = colors(todayButton);
        const selectedColors = colors(selectedButton);
        expect(todayColors.backgroundColor).not.toBe(selectedColors.backgroundColor);
        await userEvent.hover(todayButton);
        expect(colors(todayButton)).toMatchObject({ backgroundColor: todayColors.backgroundColor, color: todayColors.color });
        expect(colors(todayButton).backgroundImage).not.toBe(todayColors.backgroundImage);
        await userEvent.hover(selectedButton);
        expect(colors(selectedButton)).toEqual(selectedColors);
        expect(colors(todayButton)).toEqual(todayColors);
        const weekdays = datePopup.querySelectorAll(".rdp-weekday");
        for (const day of datePopup.querySelectorAll("button[data-day]")) {
          const button = day.getBoundingClientRect();
          const dayCell = day.closest("td")!;
          const cell = dayCell.getBoundingClientRect();
          const weekday = weekdays[dayCell.cellIndex].getBoundingClientRect();
          expect(button.width).toBe(32);
          expect(button.height).toBe(32);
          expect(button.left - cell.left).toBeCloseTo(cell.right - button.right, 1);
          expect(button.top - cell.top).toBeCloseTo(cell.bottom - button.bottom, 1);
          expect(button.left + button.width / 2).toBeCloseTo(weekday.left + weekday.width / 2, 1);
        }
      }
      await userEvent.keyboard("{Escape}");
      await userEvent.click(canvas.getByRole("button", { name: "预览图片 图片" }));
      const imagePopup = await within(document.body).findByRole("dialog", { name: "图片预览 图片" });
      expectPropertyControlRadius(imagePopup);
      await userEvent.keyboard("{Escape}");
    }
  } finally { view.unmount(); fixture.release(); }
});

test("property hints avoid pointer noise and prefer the left side on desktop", async () => {
  await commands.setReducedMotion("reduce");
  const longName = "这是一条需要完整显示的属性名称";
  const fixture = propertyLayoutFixture("property-hints");
  const view = render(<PreviewModeProvider mode="light"><TooltipHints><main className="ui-theme" style={{ maxWidth: 480, marginInline: "auto", padding: "80px 16px" }}>
    <button>焦点起点</button>
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={{ ...preferenceProperties, properties: [...preferenceProperties.properties, { name: longName, type: "text", value: "内容", editable: true }] }} onApply={async () => {}} />
  </main></TooltipHints></PreviewModeProvider>);
  try {
    const canvas = within(view.container), body = within(document.body);
    const grip = await canvas.findByRole("button", { name: "拖动属性 摘要" });
    await waitFor(() => expect(grip.hasAttribute("aria-disabled")).toBe(false));
    for (const width of [390, 1024]) {
      await page.viewport(width, 900);
      const name = canvas.getByRole("button", { name: "属性菜单 摘要" });
      await userEvent.hover(name);
      const background = getComputedStyle(name).backgroundColor;
      expect(background).not.toBe("rgba(0, 0, 0, 0)");
      await userEvent.hover(grip);
      expect(getComputedStyle(name).backgroundColor).toBe(background);
      expect(body.queryByRole("tooltip")).toBeNull();
      await userEvent.click(canvas.getByRole("button", { name: "焦点起点" }));
      await userEvent.tab();
      grip.focus();
      const hint = await body.findByRole("tooltip");
      await waitFor(() => expect(hint.getAttribute("data-side")).toBe(width >= 768 ? "left" : "top"));
      expect(hint.textContent).toBe("↑↓ 调整顺序");
      expect(grip.getAttribute("aria-describedby")).toBe(hint.id);
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("tooltip")).toBeNull());
      await userEvent.hover(canvas.getByText(longName));
      const nameHint = await body.findByRole("tooltip");
      expect(nameHint.textContent).toBe(longName);
      await waitFor(() => expect(nameHint.getAttribute("data-side")).toBe(width >= 768 ? "left" : "top"));
      await userEvent.unhover(canvas.getByText(longName));
      await waitFor(() => expect(body.queryByRole("tooltip")).toBeNull());
    }
    view.container.querySelector("main")!.style.marginInline = "0";
    await userEvent.hover(canvas.getByText(longName));
    await waitFor(() => expect(body.getByRole("tooltip").getAttribute("data-side")).toBe("right"));
  } finally { view.unmount(); fixture.release(); }
});

for (const close of ["pointer leave", "Escape", "click", "scroll"]) test(`delegated tooltip preserves its content, position and theme during ${close} exit`, async () => {
  const view = render(<PreviewModeProvider mode="light"><TooltipHints>
    <div className="ui-theme" data-appearance-scope="" data-ui-theme="dark" style={{ padding: 160 }}>
      <Button data-ui-tooltip="project/yami">yami</Button>
    </div>
  </TooltipHints></PreviewModeProvider>);
  const button = within(view.container).getByRole("button", { name: "yami" });
  await userEvent.hover(button);
  const tooltip = await within(document.body).findByRole("tooltip");
  await Promise.all(tooltip.getAnimations().map(animation => animation.finished));
  const positioner = tooltip.parentElement!;
  const width = tooltip.offsetWidth;
  const position = positioner.getBoundingClientRect().toJSON();
  const background = getComputedStyle(tooltip).backgroundColor;
  const closed = new Promise<{ text: string | null; width: number; position: object; background: string }>(resolve => {
    const observer = new MutationObserver(() => {
      if (!tooltip.hasAttribute("data-closed")) return;
      resolve({ text: tooltip.textContent, width: tooltip.offsetWidth, position: positioner.getBoundingClientRect().toJSON(), background: getComputedStyle(tooltip).backgroundColor });
      observer.disconnect();
    });
    observer.observe(tooltip, { attributes: true });
  });
  if (close === "pointer leave") await userEvent.unhover(button);
  else if (close === "Escape") await userEvent.keyboard("{Escape}");
  else if (close === "click") await userEvent.click(button);
  else act(() => { document.dispatchEvent(new Event("scroll")); });
  expect(await closed).toEqual({ text: "project/yami", width, position, background });
  expect(button.hasAttribute("aria-describedby")).toBe(false);
  await waitFor(() => expect(tooltip.isConnected).toBe(false));
});

test("tooltip review reveals clipped labels and icon actions without repeating visible text", async () => {
  const fullName = "完整属性名称";
  const view = render(<PreviewModeProvider mode="light"><TooltipHints>
    <Button>焦点起点</Button><Button data-ui-tooltip={fullName}><span data-ui-tooltip-overflow style={{ display: "block", width: 200, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{fullName}</span></Button>
    <Button aria-label="必要的图标操作" data-ui-tooltip="必要的图标操作"><svg aria-hidden="true" /></Button><Button>已有文字的操作</Button>
  </TooltipHints></PreviewModeProvider>);
  const canvas = within(view.container), body = within(document.body), label = canvas.getByText(fullName);
  await userEvent.hover(label);
  expect(body.queryByRole("tooltip")).toBeNull();
  await userEvent.unhover(label);
  act(() => { label.style.width = "24px"; });
  await userEvent.hover(label);
  await waitFor(() => expect(body.getByRole("tooltip").textContent).toBe(fullName));
  await userEvent.unhover(label);
  await waitFor(() => expect(body.queryByRole("tooltip")).toBeNull());
  canvas.getByRole("button", { name: "焦点起点" }).focus();
  await userEvent.tab();
  if (server.browser === "webkit") canvas.getByRole("button", { name: fullName }).focus();
  await waitFor(() => expect(body.getByRole("tooltip").textContent).toBe(fullName));
  await userEvent.keyboard("{Escape}");
  await userEvent.hover(canvas.getByRole("button", { name: "必要的图标操作" }));
  await waitFor(() => expect(body.getByRole("tooltip").textContent).toBe("必要的图标操作"));
  await userEvent.hover(canvas.getByRole("button", { name: "已有文字的操作" }));
  await waitFor(() => expect(body.queryByRole("tooltip")).toBeNull());
});

for (const width of [390, 1024]) for (const mode of ["light", "dark"] as const) test(`pinned tag sidebar fades only beyond scroll edges at ${width}px in ${mode}`, async () => {
  await page.viewport(width, 720);
  await commands.setReducedMotion("reduce");
  const tags = Array.from({ length: 40 }, (_, index) => ({ name: `标签${String(index).padStart(2, "0")}`, count: 1 }));
  const vaultId = `scroll-edges-${width}-${mode}`;
  localStorage.setItem(`memocard:tags:${vaultId}`, JSON.stringify({ pinned: tags.map(tag => tag.name) }));
  render(<PreviewModeProvider mode={mode}><SidebarProvider persistState={false} keyboardShortcut={false} openMobile={width < 768} onOpenMobileChange={() => {}}>
    <AppSidebar {...sidebarStoryMeta.args} vaultId={vaultId} tag={null} tags={tags} />
  </SidebarProvider></PreviewModeProvider>);
  const body = within(document.body);
  await body.findByRole("button", { name: "标签00" });
  const scroller = document.querySelector<HTMLElement>(".ui-sidebar-tag-scroll")!;
  const edges = (top: boolean, bottom: boolean) => {
    expect(scroller.hasAttribute("data-overflow-top")).toBe(top);
    expect(scroller.hasAttribute("data-overflow-bottom")).toBe(bottom);
  };
  const scroll = (top: number) => act(() => { scroller.scrollTop = top; scroller.dispatchEvent(new Event("scroll")); });
  await waitFor(() => edges(false, true));
  expect(getComputedStyle(scroller).maskImage).toContain("linear-gradient");
  scroll((scroller.scrollHeight - scroller.clientHeight) / 2);
  await waitFor(() => edges(true, true));
  scroll(scroller.scrollHeight);
  await waitFor(() => edges(true, false));
  await userEvent.keyboard("{Tab}");
  const focused = body.getByRole("button", { name: "标签20" });
  act(() => focused.focus());
  await waitFor(() => {
    const bounds = scroller.getBoundingClientRect(), target = focused.getBoundingClientRect();
    expect(target.top).toBeGreaterThanOrEqual(bounds.top + 24);
    expect(target.bottom).toBeLessThanOrEqual(bounds.bottom - 24);
  });
  await userEvent.click(body.getByRole("button", { name: "置顶标签", expanded: true }));
  await waitFor(() => edges(false, false));
});

test("global UI hints use Tooltip without mouse focus persistence or duplicate portal hints", async () => {
  const view = render(<PreviewModeProvider mode="light"><TooltipHints><TooltipHints>
    <Button data-ui-tooltip="搜索 (⌘ / Ctrl K)">搜索提示</Button><Button>焦点起点</Button>
    <DropdownMenu><DropdownMenuTrigger render={<Button data-ui-tooltip="笔记库：测试" />}>菜单提示</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem data-ui-tooltip="完整路径 area/work/uxd">uxd</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </TooltipHints></TooltipHints></PreviewModeProvider>);
  const canvas = within(view.container), body = within(document.body);
  const search = canvas.getByRole("button", { name: "搜索提示" });
  expect(search.hasAttribute("title")).toBe(false);
  await userEvent.hover(search);
  await waitFor(() => expect(body.getAllByRole("tooltip")).toHaveLength(1));
  expect(body.getByRole("tooltip").textContent).toBe("搜索 (⌘ / Ctrl K)");
  await userEvent.click(search);
  await userEvent.unhover(search);
  await waitFor(() => expect(body.queryByRole("tooltip")).toBeNull());
  expect(document.activeElement).toBe(search);
  expect(search.matches(":focus-visible")).toBe(false);
  await userEvent.click(canvas.getByRole("button", { name: "焦点起点" }));
  canvas.getByRole("button", { name: "焦点起点" }).focus();
  await userEvent.tab({ shift: true });
  if (server.browser === "webkit") search.focus();
  expect(document.activeElement).toBe(search);
  await waitFor(() => expect(body.getByRole("tooltip").id).toBe(search.getAttribute("aria-describedby")));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("tooltip")).toBeNull());
  expect(document.activeElement).toBe(search);
  await userEvent.click(canvas.getByRole("button", { name: "菜单提示" }));
  const item = await body.findByRole("menuitem", { name: "uxd" });
  await userEvent.hover(item);
  await waitFor(() => expect(body.getByRole("tooltip").textContent).toBe("完整路径 area/work/uxd"));
  expect(body.getAllByRole("tooltip")).toHaveLength(1);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(body.queryByRole("tooltip")).toBeNull());
});

for (const [kind, block] of [
  ["table", `| A | B |\n| --- | --- |\n| ${"wide-table-cell".repeat(30)} | value |\n| second | row |`],
  ["code", `\`\`\`txt\n${"wide-code-line".repeat(30)}\n\`\`\``],
] as const) test(`compact card ${kind} preview stays at the start during native Tab navigation`, async () => {
  await page.viewport(1024, 900);
  const body = `${Array.from({ length: 6 }, (_, index) => `预览段落 ${index + 1}。`).join("\n\n")}\n\n${block}`;
  const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4" style={{ width: 384 }}>
    <NoteCollection notes={[{ ...editorNote, body, tags: ["检查"] }]} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
    <Button>预览之后</Button>
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
  const next = canvas.getByRole("button", { name: "预览之后" });
  open.focus();
  for (const [keys, target] of [
    [server.browser === "webkit" ? "{Alt>}{Tab}{/Alt}" : "{Tab}", next],
    [server.browser === "webkit" ? "{Alt>}{Shift>}{Tab}{/Shift}{/Alt}" : "{Shift>}{Tab}{/Shift}", open],
  ] as const) {
    await userEvent.keyboard(keys);
    expect(scrollPositions()).toEqual(before);
    expect(document.activeElement).toBe(target);
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
      if (label === "富文本输入") expect(getComputedStyle(surface).outlineStyle).toBe("none");
      else expectKeyboardOutline(surface, mode);
      if (surface !== field) expect(getComputedStyle(field).outlineStyle, label + " single ring").toBe("none");
      await userEvent.click(field);
      expect(getComputedStyle(surface).outlineStyle, label + " pointer again").toBe("none");
      await userEvent.keyboard("{Escape}");
    }
  });

  test(`rich-text Tab editing keeps the caret without a navigation outline in ${mode}`, async () => {
    await commands.setReducedMotion("reduce");
    for (const value of ["- First\n- Second", "1. First\n2. Second", "- [ ] First\n- [ ] Second", "| First | Second |\n| --- | --- |\n| Cell one | Cell two |", "Plain text", "## Heading\n\nPlain text", "> Quoted text", "```txt\ncode\n```"]) {
      const view = render(<PreviewModeProvider mode={mode}><RichMarkdownEditor value={value} notePath="notes/tab-focus.md" disabled={false} autoFocus={false} onChange={() => {}} onSave={() => {}} onError={() => {}} /><Button>正文之后</Button></PreviewModeProvider>);
      const canvas = within(view.container);
      const editor = await canvas.findByRole("textbox", { name: "笔记内容" });
      await waitFor(() => expect(editor.textContent).not.toBe(""));
      if (!value.startsWith("-") && !value.startsWith("1.") && !value.startsWith("|")) {
        await userEvent.click(editor);
        const tiptap = (editor as HTMLElement & { editor: import("@tiptap/react").Editor }).editor;
        const original = tiptap.state.doc, selection = tiptap.state.selection.toJSON();
        for (const key of ["{Tab}", "{Shift>}{Tab}{/Shift}"]) {
          await userEvent.keyboard(key);
          expect(document.activeElement).toBe(editor);
          expect(tiptap.state.doc.eq(original)).toBe(true);
          expect(tiptap.state.selection.toJSON()).toEqual(selection);
        }
        const hint = document.getElementById(editor.getAttribute("aria-describedby")!)!;
        expect(hint.textContent).toContain("Esc");
        expect(getComputedStyle(hint).opacity).toBe("1");
        await userEvent.keyboard("{Escape}{Tab}");
        const next = canvas.getByRole("button", { name: "正文之后" });
        const fold = editor.querySelector<HTMLElement>(".rich-heading-fold");
        if (fold && document.activeElement === fold) {
          expect(document.activeElement).toBe(fold);
          expectKeyboardOutline(fold, mode);
          await userEvent.tab();
        }
        expect(document.activeElement).toBe(next);
        expectKeyboardOutline(next, mode);
        await userEvent.tab({ shift: true });
        if (fold && document.activeElement === fold) { expectKeyboardOutline(fold, mode); await userEvent.tab({ shift: true }); }
        expect(document.activeElement).toBe(editor);
        await userEvent.keyboard("{Tab}");
        expect(document.activeElement).toBe(editor);
        expect(getComputedStyle(editor).outlineStyle).toBe("none");
        await userEvent.keyboard("x");
        expect(editor.textContent).toContain("x");
        expect(editor.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);
        act(() => { tiptap.commands.setNodeSelection(0); });
        await waitFor(() => {
          const highlight = view.container.querySelector<SVGPathElement>(".rich-block-highlights > path");
          expect(highlight).not.toBeNull();
          expect(highlight!.getBBox().width).toBeGreaterThan(0);
          expect(getComputedStyle(highlight!).fill).not.toBe("none");
        });
        expect(getComputedStyle(editor).outlineStyle).toBe("none");
        const grip = canvas.getByRole("button", { name: "内容块操作" });
        grip.focus();
        expectKeyboardOutline(grip, mode);
      } else {
        const table = value.startsWith("|");
        const target = editor.querySelector<HTMLElement>(table ? "td p" : "li:last-child p")!;
        await userEvent.click(target);
        if (table) editor.querySelector<HTMLElement>(".tableWrapper")!.focus();
        for (const key of ["{Tab}", "{Shift>}{Tab}{/Shift}"]) {
          await userEvent.keyboard(key);
          expect(document.activeElement).toBe(editor);
          expect(getComputedStyle(editor).outlineStyle).toBe("none");
          if (table) expect(document.getSelection()?.anchorNode?.parentElement?.closest("td")?.textContent).toBe(key === "{Tab}" ? "Cell two" : "Cell one");
          else expect(editor.querySelector("li li") !== null).toBe(key === "{Tab}");
        }
        const tiptap = (editor as HTMLElement & { editor: import("@tiptap/react").Editor }).editor;
        if (!tiptap.state.selection.empty) {
          await userEvent.keyboard("{Escape}");
          expect(tiptap.state.selection.empty).toBe(true);
          expect(document.activeElement).toBe(editor);
        }
        await userEvent.keyboard("{Escape}{Tab}");
        expect(document.activeElement, value).not.toBe(editor);
        expectKeyboardOutline(document.activeElement!, mode);
        if (table) {
          const scroller = document.activeElement;
          await userEvent.tab();
          expect(document.activeElement).not.toBe(scroller);
          expect(document.activeElement).not.toBe(editor);
        }
      }
      view.unmount();
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
      <NoteCollection notes={[{ ...editorNote, tags: ["检查"] }]} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
      <Button>键盘焦点起点</Button>
      <QuickCapture vaultId="shadow-focus-test" rootNotes tags={[]} disabled={false} canImage={false} handle={{ current: null }} onRecorded={() => {}} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container);
    await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
    const open = canvas.getByRole("button", { name: `打开 ${editorNote.title}` });
    const card = open.closest(".ui-note-card")!;
    const restingShadow = getComputedStyle(card).boxShadow;
    canvas.getByRole("button", { name: "列表布局" }).focus();
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
    expect(document.activeElement).toBe(canvas.getByRole("button", { name: "键盘焦点起点" }));
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
      <NoteCollection home={{ tab: "recent", pinnedCount: 1, onTabChange: () => {} }} notes={[editorNote]} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
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
      <NoteCollection notes={[editorNote]} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "今天"} />
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
      await userEvent.type(await within(popup).findByRole("combobox", {name: "搜索或创建选项"}), "a");
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
      const search = await within(popup).findByRole("combobox", {name:"搜索或新建属性标签"});
      // Suggestions replace the initial empty list with a virtualized list.
      await within(popup).findByRole("option", {name:`属性标签 ${tags[0].name}`});
      const list = within(popup).getByRole("listbox", {name:"可选属性标签"});
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
      const search = await within(popup).findByRole("combobox", {name: "搜索或新建属性标签"});
      await within(popup).findByRole("option", {name: "属性标签 area/tag0000"});
      let list = within(popup).getByRole("listbox", {name: "可选属性标签"});
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
      const settingsTrigger = within(popup).getByRole("button", {name: "管理标签 area/tag0000"});
      const settings = () => within(document.body).findByRole("dialog", {name: "标签设置 area/tag0000"});
      await userEvent.click(settingsTrigger);
      const editor = await settings();
      await userEvent.click(within(editor).getByRole("button", {name: "设置标签颜色 area/tag0000"}));
      await within(document.body).findByRole("menu", {name: "标签颜色 area/tag0000"});
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(within(document.body).queryByRole("menu", {name: "标签颜色 area/tag0000"})).toBeNull());
      if (width >= 768) {
        expect(getComputedStyle(settingsTrigger).opacity).toBe("1");
        await userEvent.click(settingsTrigger);
        await waitFor(() => expect(within(document.body).queryByRole("dialog", {name: "标签设置 area/tag0000"})).toBeNull());
        await userEvent.hover(search);
        await waitFor(() => expect(getComputedStyle(settingsTrigger).opacity).toBe("0"));
        await userEvent.hover(within(list).getByRole("option", {name: "属性标签 area/tag0000"}));
        await userEvent.click(settingsTrigger);
        const panel = await settings();
        list.scrollTop = list.scrollHeight;
        list.dispatchEvent(new Event("scroll"));
        await within(list).findByRole("option", {name: "属性标签 area/tag1999"});
        expect(panel.isConnected).toBe(true);
        expect(within(list).getAllByRole("option").length).toBeLessThan(40);
      }
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(within(document.body).queryByRole("dialog", {name: "标签设置 area/tag0000"})).toBeNull());
      await userEvent.type(search, "a");
      const create = await within(list).findByRole("option", {name: "新建标签 a"});
      await waitFor(() => expect(create.getBoundingClientRect().top).toBeGreaterThanOrEqual(list.getBoundingClientRect().top));
      expect(create.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom);
      await userEvent.keyboard("{Enter}");
      await waitFor(() => expect(changes).toContainEqual({name: "tags", type: "list", value: ["a"]}));
    } finally { release(); }
  });
}

for (const width of [320, 1024]) {
  test(`property icon picker in rename preserves drafts and replaces a saved filename Emoji at ${width}px`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    const note = {...editorNote, id: "11111111-1111-4111-8111-111111111111"};
    const icons: Record<string, string> = {[`note:${note.id}`]: "emoji:🚀"};
    const renames: string[] = [];
    const release = setStorybookRequestHandler((operation, params) => {
      if (operation === "getPropertyLayout") return emptyPropertyLayout();
      if (operation === "getPropertyLabels") return {labels: {}, contentHash: "labels"};
      if (operation === "renamePropertyLabel") {
        renames.push(String(params.label));
        return {labels: {[String(params.key)]: params.label}, contentHash: "new-labels"};
      }
      if (operation === "getPropertyIcons") return {icons: {...icons}, contentHash: "initial"};
      if (operation === "setPropertyIcon") {
        const key = String(params.key);
        if (params.icon === null) delete icons[key];
        else icons[key] = String(params.icon);
        return {icons: {...icons}, contentHash: "saved"};
      }
      throw new Error(`Unexpected property operation: ${operation}`);
    });
    const view = render(<PreviewModeProvider mode="light"><main className="ui-theme" data-ui-theme="light">
      <button type="button" className="fixed top-4 right-4 z-10">弹层外部</button>
      <NoteProperties note={note} tags={[]} canEdit busy={false} iconAccess layoutConnection={{vaultId:"icon-test",read:true,write:true}}
        savedProperties={{contentHash:note.contentHash,writable:true,properties:[{name:"摘要",type:"text",value:"内容",editable:true}]}} onApply={async () => undefined} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container), body = within(document.body);
    async function openRename(name: string) {
      const trigger = await canvas.findByRole("button", {name: `属性菜单 ${name}`});
      await waitFor(() => expect(trigger).toBeEnabled());
      // Assistive technology can open a menu without focusing its trigger first.
      act(() => trigger.click());
      expect(body.queryByRole("menuitem", {name: "更换图标"})).toBeNull();
      await userEvent.click(await body.findByRole("menuitem", {name: "重命名"}));
      const rename = within(await body.findByRole("dialog", {name: "重命名属性"}));
      expect(rename.queryByRole("button", {name: "保存"})).toBeNull();
      return rename;
    }
    async function openPicker(rename: ReturnType<typeof within>) {
      await userEvent.click(rename.getByRole("button", {name: "更换图标"}));
      return within(await rename.findByRole("region", {name: "属性图标选项"}));
    }
    try {
      let rename = await openRename("摘要");
      const input = rename.getByRole("textbox", {name: "新属性名"});
      const iconTrigger = rename.getByRole("button", {name: "更换图标"});
      expect(iconTrigger.getBoundingClientRect().right).toBeLessThan(input.getBoundingClientRect().left);
      await userEvent.fill(input, "临时名称");
      let picker = await openPicker(rename);
      expect(picker.queryByRole("tab", {name: "Emoji"})).toBeNull();
      const tile = await picker.findByRole("button", {name: "笔记"});
      expect(getComputedStyle(tile).width).toBe("32px");
      expect(getComputedStyle(tile).height).toBe("32px");
      expect(getComputedStyle(tile.parentElement!).gap).toBe("4px");
      await userEvent.fill(await picker.findByRole("textbox", {name: "搜索图标"}), "star");
      await userEvent.click(picker.getByRole("button", {name: "星标"}));
      await waitFor(() => expect(icons["property:摘要"]).toBe("icon:star"));
      expect(input).toHaveValue("临时名称");
      await waitFor(() => expect(iconTrigger).toHaveAttribute("aria-expanded", "false"));
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog", {name: "重命名属性"})).toBeNull());
      expect(renames).toEqual([]);
      rename = await openRename("文件名");
      expect(rename.getByRole("button", {name: "更换图标"})).toHaveTextContent("🚀");
      picker = await openPicker(rename);
      expect(picker.queryByRole("tab")).toBeNull();
      await userEvent.fill(await picker.findByRole("textbox", {name: "搜索图标"}), "star");
      await userEvent.click(picker.getByRole("button", {name: "星标"}));
      await waitFor(() => expect(icons[`note:${note.id}`]).toBe("icon:star"));
      picker = await openPicker(rename);
      expect(picker.queryByRole("button", {name: "恢复默认图标"})).toBeNull();
      await userEvent.fill(rename.getByRole("textbox", {name: "新属性名"}), "文件");
      if (width < 768) await userEvent.click(rename.getByRole("button", {name: "关闭重命名属性"}));
      else await userEvent.click(canvas.getByRole("button", {name: "弹层外部"}));
      await waitFor(() => expect(body.queryByRole("dialog", {name: "重命名属性"})).toBeNull());
      expect(renames).toEqual(["文件"]);
      expect(await canvas.findByRole("button", {name: "属性菜单 文件"})).toBeTruthy();
    } finally { view.unmount(); release(); }
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
      <div data-testid="inline-reference" className="bg-surface" style={{ boxShadow: "var(--shadow-scale-2)" }} />
      <span data-testid="danger-reference" style={{ color: "var(--color-icon-red)", backgroundColor: "var(--color-danger-surface)" }} />
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
        await userEvent.click(await canvas.findByRole("button", { name: `编辑属性 ${name}` }));
        const input = await body.findByRole("textbox", { name: "属性值" });
        const style = getComputedStyle(input.closest("form")!);
        const reference = getComputedStyle(canvas.getByTestId("inline-reference"));
        expect(style.boxShadow).toBe(reference.boxShadow);
        expect(style.backgroundColor).toBe(reference.backgroundColor);
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
        expectPropertyControlRadius(popup);
        await userEvent.click(within(popup).getByRole("button", { name: "取消" }));
        await waitFor(() => expect(body.queryByRole("alertdialog")).toBeNull());
      };
      await userEvent.click(canvas.getByRole("button", { name: "属性菜单 摘要" }));
      expectPropertyControlRadius(await body.findByRole("menu", { name: "管理属性 摘要" }));
      const deleteProperty = await body.findByRole("menuitem", { name: "删除属性" });
      const dangerStyle = getComputedStyle(canvas.getByTestId("danger-reference"));
      expect(getComputedStyle(deleteProperty).color).not.toBe(dangerStyle.color);
      deleteProperty.focus();
      await waitFor(() => expect(getComputedStyle(deleteProperty).backgroundColor).toBe(dangerStyle.backgroundColor));
      expect(getComputedStyle(deleteProperty).color).toBe(dangerStyle.color);
      expect(getComputedStyle(deleteProperty.querySelector("svg")!).color).toBe(dangerStyle.color);
      await userEvent.click(deleteProperty);
      await checkConfirmation();
      await userEvent.click(canvas.getByRole("button", { name: "属性菜单 摘要" }));
      const types = await body.findByRole("menuitem", { name: /^类型/ });
      await userEvent.click(types);
      await userEvent.click(await body.findByRole("menuitemradio", { name: "多选" }));
      await checkConfirmation();
      const checkColorOptions = (menu: HTMLElement) => {
        expectPropertyControlRadius(menu);
        for (const option of menu.querySelectorAll('.note-tag-color-option')) {
          expect(getComputedStyle(option).height).toBe("32px");
          expect(getComputedStyle(option).fontWeight).toBe("400");
        }
      };
      const confirmDeletion = async (trigger: HTMLElement) => {
        trigger.focus();
        expect(getComputedStyle(trigger).color).toBe(dangerStyle.color);
        expect(getComputedStyle(trigger.querySelector("svg")!).color).toBe(dangerStyle.color);
        await userEvent.click(trigger);
        await checkConfirmation();
      };
      await userEvent.click(canvas.getByRole("button", { name: "编辑属性 领域" }));
      await userEvent.click(await body.findByRole("button", { name: "管理选项 设计" }));
      await body.findByRole("textbox", { name: "选项名称" });
      checkColorOptions(body.getByRole("menu", { name: "选项设置 设计" }));
      await confirmDeletion(await body.findByRole("menuitem", { name: "删除选项" }));
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

      await userEvent.click(canvas.getByRole("button", { name: "编辑标签" }));
      await userEvent.click(await body.findByRole("button", { name: "管理标签 开发" }));
      const tagSettings = within(await body.findByRole("dialog", { name: "标签设置 开发" }));
      expect(getComputedStyle(tagSettings.getByRole("textbox", { name: "标签名称" })).borderRadius).toBe("8px");
      expect(getComputedStyle(tagSettings.getByRole("textbox", { name: "搜索 Emoji" })).borderRadius).toBe("9999px");
      await userEvent.click(tagSettings.getByRole("button", { name: "设置标签颜色 开发" }));
      checkColorOptions(await body.findByRole("menu", { name: "标签颜色 开发" }));
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("menu", { name: "标签颜色 开发" })).toBeNull());
      await confirmDeletion(tagSettings.getByRole("button", { name: "删除标签" }));
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog", { name: "标签设置 开发" })).toBeNull());
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());

      await userEvent.click(canvas.getByRole("button", { name: "属性菜单 摘要" }));
      await userEvent.click(await body.findByRole("menuitem", { name: "重命名" }));
      const rename = await body.findByRole("textbox", { name: "新属性名" });
      const renameDialog = rename.closest<HTMLElement>('[role="dialog"]')!;
      expectPropertyControlRadius(renameDialog);
      if (width >= 768) {
        const {paddingTop, paddingRight, paddingBottom, paddingLeft} = getComputedStyle(renameDialog);
        expect([paddingTop, paddingRight, paddingBottom, paddingLeft]).toEqual(["8px", "8px", "8px", "8px"]);
      }
      await userEvent.keyboard("{Escape}");
      const more = canvas.queryByRole("button", { name: "更多属性" });
      if (more) await userEvent.click(more);
      await userEvent.click(canvas.getByRole("button", { name: "添加属性" }));
      const create = await body.findByRole("textbox", { name: "属性名" });
      expectPropertyControlRadius(create.closest('[role="dialog"]')!);
      await userEvent.keyboard("{Escape}");
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
      await body.findByRole("menuitem", {name: "重命名"});
      expect(body.queryByRole("menuitem", {name: "上移"})).toBeNull();
      expect(body.queryByRole("menuitem", {name: "下移"})).toBeNull();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("menu")).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(canvas.getByRole("button", {name: "属性菜单 摘要"})));
      canvas.getByRole("button", {name: "拖动属性 摘要"}).focus();
      await userEvent.keyboard("{ArrowDown}");
      await waitFor(() => expect(names().indexOf("零值")).toBeLessThan(names().indexOf("摘要")));
      await visibility("空值", "为空时隐藏");
      await waitFor(() => expect(canvas.queryByRole("button", {name: "属性菜单 空值"})).toBeNull());
      await visibility("零值", "为空时隐藏");
      expect(canvas.getByRole("button", {name: "编辑属性 零值"})).toHaveProperty("textContent", "0");
      await visibility("未完成", "为空时隐藏");
      expect(canvas.getByRole("checkbox", {name: "切换属性 未完成"}).getAttribute("aria-checked")).toBe("false");
      await visibility("尚未设置", "为空时隐藏");
      await waitFor(() => expect(canvas.queryByRole("checkbox", {name: "切换属性 尚未设置"})).toBeNull());
      await visibility("摘要", "始终隐藏");
      await waitFor(() => expect(canvas.queryByRole("button", {name: "属性菜单 摘要"})).toBeNull());
      const hidden = await canvas.findByRole("button", {name: "更多属性"});
      await waitFor(() => expect(document.activeElement).toBe(hidden));
      await userEvent.click(hidden);
      await canvas.findByRole("button", {name: "属性菜单 空值"});
      expect(canvas.getByRole("checkbox", {name: "切换属性 尚未设置"}).getAttribute("aria-checked")).toBe("false");
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
      <span data-testid="menu-icon-reference" className="text-secondary" />
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
      if ([1, 3, 4].includes(index)) {
        expect(getComputedStyle(surface).borderRadius).toBe("12px");
        const rows = surface.querySelectorAll<HTMLElement>('[role^="menuitem"], [role="option"]');
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(getComputedStyle(row).height).toBe("32px");
          expect(getComputedStyle(row).fontWeight).toBe("400");
          for (const icon of row.querySelectorAll("svg")) expect(getComputedStyle(icon).color).toBe(getComputedStyle(canvas.getByTestId("menu-icon-reference")).color);
        }
      }
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
        if (scenario.width >= 768) {
          await userEvent.click(tabs[0]);
          await userEvent.hover(imageTrigger);
          await waitFor(() => expect(getComputedStyle(tablist.closest(".note-mermaid-toolbar")!).opacity).toBe("0"));
          expect(document.activeElement).toBe(tabs[0]);
          await userEvent.tab();
          await userEvent.tab({shift: true});
          expect(getComputedStyle(tablist.closest(".note-mermaid-toolbar")!).opacity).toBe("1");
        }
        const toolbarGroup = tabs[0].closest<HTMLElement>('[data-slot="action-group"]');
        if (grouped) {
          expect(toolbarGroup).not.toBeNull();
          expect(toolbarGroup!.getBoundingClientRect().width).toBe(112);
          expect(toolbarGroup!.getBoundingClientRect().height).toBe(40);
          checkFrame(toolbarGroup!);
          for (const tab of tabs) { expect(tab.getBoundingClientRect().width).toBe(36); expect(tab.getBoundingClientRect().height).toBe(36); }
        } else {
          expect(toolbarGroup?.dataset.size).toBe("compact");
          expect(toolbarGroup!.getBoundingClientRect().width).toBe(96);
          expect(toolbarGroup!.getBoundingClientRect().height).toBe(32);
          expect(getComputedStyle(tablist).columnGap).toBe("4px");
          expect(getComputedStyle(toolbarGroup!).padding).toBe("2px");
          expect(getComputedStyle(toolbarGroup!).borderRadius).toBe("8px");
          for (const tab of tabs) {
            expect(tab.getBoundingClientRect().width).toBe(28);
            expect(tab.getBoundingClientRect().height).toBe(28);
            expect(getComputedStyle(tab).borderRadius).toBe("4px");
          }
        }
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
        expect(imageTools.dataset.slot).toBe("action-group");
        expect(imageLayout.getBoundingClientRect().width).toBe(grouped ? 36 : 28);
        expect(imageLayout.getBoundingClientRect().height).toBe(grouped ? 36 : 28);
        if (grouped) {
          expect(imageTools.getBoundingClientRect().width).toBe(40);
          expect(imageTools.getBoundingClientRect().height).toBe(40);
          expect(getComputedStyle(imageTools).padding).toBe("2px");
          checkFrame(imageTools);
        } else {
          expect(imageTools.dataset.size).toBe("compact");
          expect(imageTools.getBoundingClientRect().width).toBe(32);
          expect(imageTools.getBoundingClientRect().height).toBe(32);
          expect(getComputedStyle(imageTools).padding).toBe("2px");
          expect(getComputedStyle(imageTools).borderRadius).toBe("8px");
          expect(getComputedStyle(imageLayout).borderRadius).toBe("4px");
        }
        imageLayout.focus();
        await userEvent.keyboard("{Enter}");
        const imageMenu = await body.findByRole("menu", {name: "图片布局"});
        expect(within(imageMenu).getByRole("menuitem", {name: "等宽排列"}).getAttribute("aria-disabled")).toBe("true");
        await userEvent.keyboard("{Escape}");
        await waitFor(() => { expect(body.queryByRole("menu", {name: "图片布局"})).toBeNull(); expect(document.activeElement).toBe(imageLayout); });
        if (scenario.width >= 768) {
          await userEvent.click(imageLayout);
          await body.findByRole("menu", {name: "图片布局"});
          await userEvent.click(imageLayout);
          await waitFor(() => expect(body.queryByRole("menu", {name: "图片布局"})).toBeNull());
          await userEvent.hover(imageTrigger);
          await waitFor(() => expect(getComputedStyle(imageTools).opacity).toBe("0"));
        }
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
      await waitFor(() => expect(view.container.querySelector(".web-app")).toHaveAttribute("data-workspace-layout", scenario.width < 768 ? "drawer" : "topbar"), { timeout: 10_000 });
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
        const outside = canvas.getByRole("button", {name: scenario.width < 768 ? "页面操作" : "MemoCard，返回主页"});
        await userEvent.hover(outside);
        expect(getComputedStyle(card).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        await userEvent.hover(open);
        expect(card.matches(":hover")).toBe(true);
        const overlay = getComputedStyle(reference).backgroundColor;
        await waitFor(() => expect(getComputedStyle(card).backgroundColor).toBe(scenario.touch ? "rgba(0, 0, 0, 0)" : overlay));
        if (scenario.width === 1440) {
          const tag = within(card).getAllByRole("button", {name: /^筛选标签 /})[0];
          const color = getComputedStyle(tag).color;
          const rowHover = getComputedStyle(tag).backgroundImage;
          expect(rowHover).not.toBe("none");
          expect(getComputedStyle(open).paddingInlineStart).toBe("12px");
          expect(getComputedStyle(open).paddingInlineEnd).toBe("12px");
          expect(Number.parseFloat(getComputedStyle(card).borderTopLeftRadius)).toBeGreaterThanOrEqual(card.getBoundingClientRect().height / 2);
          await userEvent.hover(tag);
          await waitFor(() => expect(getComputedStyle(tag).backgroundImage).not.toBe(rowHover));
          expect(getComputedStyle(tag).color).toBe(color);
          await userEvent.hover(outside);
          expect(getComputedStyle(tag).backgroundImage).toBe("none");
          expect(getComputedStyle(tag).color).toBe(color);
          await userEvent.hover(open);
        }
        const before = opened.length, bounds = card.getBoundingClientRect();
        await commands.pressLeftMouseButton();
        try {
          await waitFor(() => expect(open.matches(":active")).toBe(true));
          expect(getComputedStyle(card).backgroundColor).toBe(overlay);
          expect(card.getBoundingClientRect().top).toBeCloseTo(bounds.top, 1);
          expect(opened).toHaveLength(before);
        } finally { await commands.releaseLeftMouseButton(); }
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
test("Web collection headings align with the sidebar brand and retain compact spacing", async () => {
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ interfaceTheme: "classic" }));
  history.replaceState(null, "", "#/notes");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  await page.viewport(1440, 900);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    await canvas.findByRole("button", {name: "打开 今天的手冲记录"});
    const header = view.container.querySelector<HTMLElement>(".web-app-header")!;
    for (const width of [768, 1440]) {
      await page.viewport(width, 900);
      for (const name of ["所有笔记", "标签"]) {
        await userEvent.click(within(canvas.getByRole("navigation", {name: "主要导航"})).getByRole("button", {name}));
        const title = await canvas.findByRole("heading", {name, level: 1});
        await waitFor(() => {
          const brand = view.container.querySelector(".ui-sidebar-brand-header")!.getBoundingClientRect();
          const bounds = title.getBoundingClientRect();
          expect(bounds.top + bounds.height / 2).toBeCloseTo(brand.top + brand.height / 2, 1);
          expect(header.getBoundingClientRect().height).toBe(0);
        });
        expect(getComputedStyle(title.parentElement!).marginBottom).toBe("0px");
        expect(getComputedStyle(header, "::after").height).toBe("16px");
        const content = title.closest(".web-page-content")!;
        await waitFor(() => expect(content.querySelector(".ui-note-toolbar, .ui-tag-directory-toolbar")).not.toBeNull());
        const toolbar = content.querySelector(".ui-note-toolbar, .ui-tag-directory-toolbar")!.getBoundingClientRect();
        const results = content.querySelector(".ui-note-results, .ui-tag-directory-panel")!.getBoundingClientRect();
        expect(results.top - toolbar.bottom).toBeCloseTo(16, 1);
        if (name === "标签") {
          const search = content.querySelector(".ui-collection-search")!.getBoundingClientRect();
          const titleBounds = title.getBoundingClientRect();
          expect(search.left).toBeGreaterThan(titleBounds.right);
          expect(search.right).toBeCloseTo(results.right, 1);
          expect(search.top + search.height / 2).toBeCloseTo(titleBounds.top + titleBounds.height / 2, 1);
          expect(search.width).toBeLessThanOrEqual(320);
          const tabs = content.querySelector(".ui-tag-directory-tab-header > [role='tablist']")!.getBoundingClientRect();
          const panel = content.querySelector(".ui-tag-directory-panel > [role='tabpanel']")!.getBoundingClientRect();
          expect(tabs.top).toBeGreaterThan(results.top);
          expect(panel.top).toBeGreaterThanOrEqual(tabs.bottom);
        } else {
          const recentTags = content.querySelector(".ui-note-recent-tags")!.getBoundingClientRect();
          expect(recentTags.left).toBeCloseTo(title.parentElement!.getBoundingClientRect().left, 1);
          expect(toolbar.top - title.parentElement!.getBoundingClientRect().bottom).toBeCloseTo(8, 1);
        }
        expect(toolbar.right).toBeLessThanOrEqual(content.getBoundingClientRect().right);
      }
    }
    await userEvent.click(canvas.getByRole("button", {name: "收起侧栏"}));
    const expand = await canvas.findByRole("button", {name: "展开侧栏"});
    const title = canvas.getByRole("heading", {name: "标签", level: 1});
    await waitFor(() => {
      const button = expand.getBoundingClientRect(), bounds = title.getBoundingClientRect();
      expect(button.right).toBeLessThanOrEqual(bounds.left);
      expect(button.top + button.height / 2).toBeCloseTo(bounds.top + bounds.height / 2, 1);
      expect(header.getBoundingClientRect().height).toBe(0);
    });
    expect(expand.closest(".web-collection-heading")).toBe(title.parentElement);
    await waitFor(() => expect(document.activeElement).toBe(expand));
    await page.viewport(390, 900);
    await waitFor(() => expect(within(header).getByRole("button", {name: "页面操作"})).toBeDefined());
    expect(header.getBoundingClientRect().height).toBe(56);
    await userEvent.click(within(header).getByRole("button", {name: "打开导航"}));
    const mobileBrand = await within(document.body).findByRole("button", {name: "MemoCard，返回主页"});
    const mobileLogo = mobileBrand.querySelector("img")!.getBoundingClientRect();
    expect([mobileLogo.width, mobileLogo.height]).toEqual([32, 32]);
    expect(mobileBrand.getBoundingClientRect().height).toBe(44);
    expect(getComputedStyle(mobileBrand).borderRadius).toBe("9999px");
    expect(getComputedStyle(mobileBrand).paddingInlineStart).toBe("2px");
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/notes");
  }
});

test("tag picker tabs stay anchored near the viewport edge and use shared controls", async () => {
  await page.viewport(1495, 720);
  await commands.setReducedMotion("reduce");
  const { TagEditor } = await import("../ui/business/tag-navigation-editor");
  const view = render(<PreviewModeProvider mode="light"><main className="ui-theme" data-ui-theme="light">
    <button className="fixed bottom-6 left-48">标签操作</button>
    <Tabs defaultValue="emoji"><TabsList variant="line"><TabsTrigger value="emoji">参考标签页</TabsTrigger></TabsList></Tabs>
  </main></PreviewModeProvider>);
  const canvas = within(view.container);
  const anchor = canvas.getByRole("button", {name: "标签操作"});
  const reference = canvas.getByRole("tab", {name: "参考标签页"});
  const editor = render(<PreviewModeProvider mode="light">
    <TagEditor path="work/design" icon="😀" anchor={anchor} mobile={false} initialPickerOpen onClose={() => undefined} onSave={async () => undefined} />
  </PreviewModeProvider>);
  try {
    const dialog = await within(document.body).findByRole("dialog", {name: "编辑标签"});
    const controls = within(dialog);
    const emoji = controls.getByRole("tab", {name: "Emoji"});
    const icon = controls.getByRole("tab", {name: "图标"});
    const sharedSearch = controls.getByRole("textbox", {name: "搜索 Emoji"});
    for (const name of ["标签名称", "搜索 Emoji"]) {
      const input = getComputedStyle(controls.getByRole("textbox", {name}));
      expect(input.paddingLeft).toBe("8px");
      expect(input.paddingRight).toBe("8px");
    }
    await waitFor(() => {
      const bounds = dialog.getBoundingClientRect();
      expect(bounds.bottom).toBeLessThanOrEqual(720);
      expect(bounds.width).toBeCloseTo(dialog.offsetWidth, 0);
    });
    const bounds = dialog.getBoundingClientRect();
    const checkBounds = () => {
      const current = dialog.getBoundingClientRect();
      expect(current.x).toBeCloseTo(bounds.x, 0);
      expect(current.y).toBeCloseTo(bounds.y, 0);
      expect(current.height).toBeCloseTo(bounds.height, 0);
    };
    const checkGridEdges = () => {
      const grid = dialog.querySelector<HTMLElement>('[role="tabpanel"] .note-property-icon-grid')!;
      const tiles = [...grid.querySelectorAll("button")].map(button => button.getBoundingClientRect());
      const firstRow = tiles.filter(tile => tile.top === tiles[0].top);
      const left = grid.getBoundingClientRect().left;
      expect(firstRow[0].left).toBeCloseTo(left, 0);
      expect(firstRow.at(-1)!.right).toBeCloseTo(left + grid.clientWidth, 0);
    };
    checkGridEdges();
    await userEvent.click(icon);
    const iconSearch = await controls.findByRole("textbox", {name: "搜索图标"});
    expect(iconSearch).toBe(sharedSearch);
    for (const element of [iconSearch, controls.getByText("笔记与组织")]) {
      const style = getComputedStyle(element);
      expect(style.paddingLeft).toBe("8px");
      expect(style.paddingRight).toBe("8px");
    }
    checkBounds();
    checkGridEdges();
    await userEvent.fill(controls.getByRole("textbox", {name: "搜索图标"}), "star");
    await waitFor(() => expect(controls.getByRole("button", {name: "星标"})).toBeVisible());
    checkBounds();
    await userEvent.click(emoji);
    await waitFor(() => expect(controls.getByRole("textbox", {name: "搜索 Emoji"})).toBeVisible());
    expect(controls.getByRole("textbox", {name: "搜索 Emoji"})).toBe(sharedSearch);
    expect(sharedSearch).toHaveValue("");
    checkBounds();
    expect(document.activeElement).toBe(emoji);
    expect(getComputedStyle(emoji).fontWeight).toBe(getComputedStyle(reference).fontWeight);
    expect(emoji.getBoundingClientRect().height).toBe(reference.getBoundingClientRect().height);
    expect(controls.queryByRole("button", {name: "保存"})).toBeNull();
    expect(controls.queryByText(/使用 \/ 分隔多级标签/)).toBeNull();
  } finally { editor.unmount(); }
});

test("tag icon picker expands and collapses its controls as one panel", async () => {
  await page.viewport(1440, 900);
  await commands.setReducedMotion("no-preference");
  const { TagEditor } = await import("../ui/business/tag-navigation-editor");
  const anchor = render(<button className="fixed top-24 left-24">标签操作</button>).getByRole("button");
  let finishSave!: () => void;
  const pending = new Promise<void>(resolve => { finishSave = resolve; });
  const save = vi.fn(() => pending);
  render(<PreviewModeProvider mode="light">
    <TagEditor path="work/design" icon="icon:star" anchor={anchor} mobile={false} onClose={() => undefined} onSave={save} />
  </PreviewModeProvider>);
  const dialog = await within(document.body).findByRole("dialog", {name: "编辑标签"});
  const controls = within(dialog);
  const trigger = controls.getByRole("button", {name: "更换图标"});

  function trackHeightChange(searchLabel: string) {
    return new Promise<{ height: number; contentHeight: number; hasTabs: boolean; hasSearch: boolean }>(resolve => {
      const onTransition = (event: TransitionEvent) => {
        const panel = event.target;
        if (!(panel instanceof HTMLElement) || !panel.matches('section[aria-label="标签图标选项"]') || event.propertyName !== "height") return;
        dialog.removeEventListener("transitionrun", onTransition);
        const transition = panel.getAnimations().find(animation => animation instanceof CSSTransition && animation.transitionProperty === "height");
        if (transition?.effect) transition.currentTime = Number(transition.effect.getTiming().duration) / 2;
        resolve({
          height: panel.clientHeight,
          contentHeight: panel.scrollHeight,
          hasTabs: Boolean(panel.querySelector('[role="tablist"]')),
          hasSearch: Boolean(panel.querySelector(`input[aria-label="${searchLabel}"]`)),
        });
      };
      dialog.addEventListener("transitionrun", onTransition);
    });
  }

  const opening = trackHeightChange("搜索 Emoji");
  await userEvent.click(trigger);
  const expanded = await opening;
  expect(expanded.height).toBeGreaterThan(0);
  expect(expanded.height).toBeLessThan(expanded.contentHeight);
  expect(expanded).toMatchObject({hasTabs: true, hasSearch: true});
  const panel = controls.getByRole("region", {name: "标签图标选项"});
  await Promise.all(panel.getAnimations().map(animation => animation.finished));
  expect(controls.getByRole("tab", {name: "Emoji", selected: true})).toBeVisible();
  const grid = controls.getByRole("group", {name: "Emoji"});
  expect(grid.querySelectorAll("button").length).toBeLessThan(150);
  grid.scrollTop = grid.scrollHeight;
  expect(await controls.findByRole("button", {name: /^指纹、/})).toBeVisible();
  await userEvent.click(controls.getByRole("tab", {name: "图标"}));
  await userEvent.fill(controls.getByRole("textbox", {name: "搜索图标"}), "coffee");
  const closing = trackHeightChange("搜索图标");
  await userEvent.click(controls.getByRole("button", {name: "咖啡"}));
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(controls.getByRole("textbox", {name: "标签名称"})).toBeEnabled();
  const collapsed = await closing;
  expect(collapsed.height).toBeGreaterThan(0);
  expect(collapsed.height).toBeLessThan(collapsed.contentHeight);
  expect(collapsed).toMatchObject({hasTabs: true, hasSearch: true});
  expect(panel.inert).toBe(true);
  await waitFor(() => expect(panel.isConnected).toBe(false));
  expect(document.activeElement).toBe(trigger);
  expect(controls.getByRole("textbox", {name: "标签名称"})).toBeVisible();
  expect(save).toHaveBeenCalledWith("work/design", "icon:coffee");
  await userEvent.click(trigger);
  expect(await controls.findByRole("tab", {name: "Emoji", selected: true})).toBeVisible();
  finishSave();
});

test("Web tag color picker applies the shared palette without submitting the tag name", async () => {
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  history.replaceState(null, "", "#/tags");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container), body = within(document.body);
    const name = "生活/咖啡";
    const chip = await canvas.findByRole("button", {name: `查看标签 ${name} 的笔记`});
    const defaultBackground = getComputedStyle(chip).backgroundColor;
    let defaultIconColors: string[] | undefined;
    for (const [width, selected, next] of [[1440, "默认", "蓝色"], [390, "蓝色", "默认"]] as const) {
      await page.viewport(width, 1000);
      const iconButton = canvas.getByRole("button", {name: `编辑标签图标 ${name}`});
      await userEvent.click(iconButton);
      const editor = await body.findByRole("dialog", {name: "编辑标签"});
      expect(editor.getAttribute("data-slot")).toBe(width < 768 ? "sheet-content" : "popover-content");
      const input = within(editor).getByRole("textbox", {name: "标签名称"});
      const editIcon = within(editor).getByRole("button", {name: "更换图标"});
      const iconColors = () => {
        const {backgroundColor} = getComputedStyle(editIcon);
        const {stroke} = getComputedStyle(editIcon.querySelector("svg path")!);
        return [backgroundColor, stroke];
      };
      if (selected === "默认") defaultIconColors = iconColors();
      const trigger = within(editor).getByRole("button", {name: `设置标签颜色 ${name}`});
      expect(trigger.getBoundingClientRect().left).toBeGreaterThanOrEqual(input.getBoundingClientRect().right);
      await userEvent.clear(input);
      await userEvent.type(input, "未保存的名称");
      await userEvent.click(trigger);
      const palette = within(await body.findByRole("menu", {name: `标签颜色 ${name}`}));
      expect(palette.getByRole("menuitemradio", {name: selected, checked: true})).toBeTruthy();
      await userEvent.click(palette.getByRole("menuitemradio", {name: next}));
      await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
      expect(body.getByRole("dialog", {name: "编辑标签"})).toBe(editor);
      expect(input).toHaveValue("未保存的名称");
      expect(getComputedStyle(iconButton).backgroundColor).toBe("rgba(0, 0, 0, 0)");
      if (next === "默认") {
        expect(getComputedStyle(chip).backgroundColor).toBe(defaultBackground);
        expect(iconColors()).toEqual(defaultIconColors);
      } else {
        const {backgroundColor, color} = getComputedStyle(chip);
        expect(backgroundColor).not.toBe(defaultBackground);
        expect(iconColors()).toEqual([backgroundColor, color]);
      }
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(body.queryByRole("dialog", {name: "编辑标签"})).toBeNull());
    }
  } finally { view.unmount(); release(); history.replaceState(null, "", previousHash || "#/"); }
});

test("Web tag groups save shared membership without changing any notes", async () => {
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  history.replaceState(null, "", "#/tags");
  const fixture = await createWorkspaceFixture();
  const original = fixture.snapshot().notes.map(note => [note.id, note.body, note.tags]);
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container), body = within(document.body);
    await canvas.findByRole("button", {name: "查看标签 生活/咖啡 的笔记"});
    expect(canvas.queryByRole("button", {name: "新建群组"})).toBeNull();
    await userEvent.click(canvas.getByRole("tab", {name: "标签群组"}));
    await userEvent.click(canvas.getByRole("button", {name: "新建标签"}));
    const newLabel = within(await canvas.findByRole("rowgroup", {name: "新建标签"}));
    expect(body.queryByRole("dialog", {name: "新建标签"})).toBeNull();
    await userEvent.type(newLabel.getByRole("textbox", {name: "标签名称"}), "brewing");
    await userEvent.click(newLabel.getByRole("button", {name: "添加标签说明"}));
    await userEvent.type(newLabel.getByRole("textbox", {name: "标签说明"}), "手冲冲煮笔记");
    await userEvent.click(newLabel.getByRole("textbox", {name: "标签名称"}));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.queryByRole("rowgroup", {name: "新建标签"})).toBeNull());
    expect(canvas.queryByRole("button", {name: "查看标签 brewing 的笔记"})).toBeNull();
    await userEvent.click(canvas.getByRole("tab", {name: "全部"}));
    const unused = await canvas.findByRole("button", {name: "查看标签 brewing 的笔记"});
    expect(unused.getAttribute("aria-description")).toBe("0 条笔记");
    expect((await fixture.request<TagPreferenceState>("getTagPreferences")).labels?.brewing).toBe("手冲冲煮笔记");
    await userEvent.click(canvas.getByRole("tab", {name: "标签群组"}));
    for (const [name, width] of [["收藏", 1440], ["饮品", 390]] as const) {
      await page.viewport(width, 1000);
      await userEvent.click(canvas.getByRole("button", {name: "新建群组"}));
      const dialog = within(await canvas.findByRole("rowgroup", {name: "新建群组"}));
      expect(body.queryByRole("dialog", {name: "新建群组"})).toBeNull();
      const addDescription = dialog.getByRole("button", {name: "添加群组说明"});
      expect(addDescription).toBeDisabled();
      await userEvent.type(dialog.getByRole("textbox", {name: "群组名称"}), name);
      await userEvent.click(addDescription);
      const description = dialog.getByRole("textbox", {name: "群组说明"});
      await waitFor(() => expect(description.getBoundingClientRect().width)
        .toBeCloseTo(dialog.getByRole("textbox", {name: "群组名称"}).getBoundingClientRect().width, 1));
      await userEvent.fill(description, "群组测试说明");
      if (width === 390) await userEvent.click(canvas.getByRole("tab", {name: "标签群组", selected: true}));
      else await userEvent.keyboard("{Enter}");
      await canvas.findByRole("rowgroup", {name});
      expect((await fixture.request<TagPreferenceState>("getTagPreferences")).groups?.find(group => group.name === name)?.tags).toEqual([]);
      await userEvent.click(canvas.getByRole("tab", {name: "全部"}));
      for (const tag of name === "饮品" ? ["生活/咖啡", "brewing"] : ["生活/咖啡"]) {
        const actionsName = `标签操作 ${tag}`;
        const allTags = within(canvas.getByRole("tabpanel", {name: "全部"}));
        if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
          await userEvent.hover(allTags.getByRole("button", {name: `查看标签 ${tag} 的笔记`}));
        }
        await userEvent.click(allTags.getByRole("button", {name: actionsName}));
        const actions = await body.findByRole("menu", {name: actionsName});
        await userEvent.click(within(actions).getByRole("menuitem", {name: "加入群组"}));
        const membership = within(await body.findByRole("menu", {name: `加入群组 ${tag}`}));
        await userEvent.click(membership.getByRole("menuitemcheckbox", {name, checked: false}));
        await membership.findByRole("menuitemcheckbox", {name, checked: true});
        await userEvent.keyboard("{Escape}");
        await userEvent.keyboard("{Escape}");
        await waitFor(() => expect(body.queryByRole("menu", {name: actionsName})).toBeNull());
      }
      await userEvent.click(canvas.getByRole("tab", {name: "标签群组"}));
      expect(within(canvas.getByRole("rowgroup", {name})).getByRole("button", {name: "查看标签 生活/咖啡 的笔记"})).toBeTruthy();
      const member = within(canvas.getByRole("rowgroup", {name})).getByRole("button", {name: "查看标签 生活/咖啡 的笔记"}).closest("tr")!;
      expect(member.getBoundingClientRect().height).toBe(40);
      const groupIcon = canvas.getByRole("button", {name: `编辑群组图标 ${name}`}).getBoundingClientRect();
      const memberIcon = within(member).getByRole("button", {name: "编辑标签图标 生活/咖啡"}).getBoundingClientRect();
      const label = member.querySelector(".ui-tag-directory-label")!;
      const guide = parseFloat(getComputedStyle(label, "::before").insetInlineStart);
      expect(groupIcon.width).toBe(memberIcon.width);
      expect(groupIcon.left + groupIcon.width / 2).toBeCloseTo(label.getBoundingClientRect().left + guide);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
    }
    const groupedTable = canvas.getByRole("table", {name: "群组标签列表"});
    const nameColumn = within(groupedTable).getByRole("columnheader", {name: "名称"});
    expect(nameColumn.getAttribute("aria-sort")).toBe("ascending");
    await userEvent.click(within(nameColumn).getByRole("button"));
    expect(nameColumn.getAttribute("aria-sort")).toBe("descending");
    const descriptionColumn = within(groupedTable).getByRole("columnheader", {name: "说明"});
    expect(within(descriptionColumn).queryByRole("button")).toBeNull();
    const countColumn = within(groupedTable).getByRole("columnheader", {name: "笔记数"});
    const memberCounts = () => within(canvas.getByRole("rowgroup", {name: "饮品"}))
      .getAllByRole("button", {name: /查看标签 .* 的笔记/}).map(button => Number(button.textContent));
    await userEvent.click(within(countColumn).getByRole("button"));
    expect(countColumn.getAttribute("aria-sort")).toBe("ascending");
    const ascendingCounts = memberCounts();
    expect(ascendingCounts[0]).toBe(0);
    expect(ascendingCounts[1]).toBeGreaterThan(0);
    await userEvent.click(within(countColumn).getByRole("button"));
    expect(countColumn.getAttribute("aria-sort")).toBe("descending");
    expect(memberCounts()).toEqual([...ascendingCounts].reverse());
    const groupToggle = canvas.getByRole("button", {name: /^(收起|展开)群组 收藏$/});
    await userEvent.click(groupToggle);
    expect(groupToggle.getAttribute("aria-expanded")).toBe("false");
    expect(canvas.queryByRole("rowgroup", {name: "收藏"})).toBeNull();
    await userEvent.click(groupToggle);
    expect(canvas.getByRole("rowgroup", {name: "收藏"})).toBeTruthy();
    expect((await fixture.request<TagPreferenceState>("getTagPreferences")).groups?.map(group => [group.name, group.tags])).toEqual([
      ["收藏", ["生活/咖啡"]], ["饮品", ["生活/咖啡", "brewing"]],
    ]);
    await page.viewport(1440, 1000);
    const collectionIcon = canvas.getByRole("button", {name: "编辑群组图标 收藏"});
    const childIcon = within(canvas.getByRole("rowgroup", {name: "收藏"})).getByRole("button", {name: "编辑标签图标 生活/咖啡"});
    expect(collectionIcon.querySelector("svg")!.getBoundingClientRect().width).toBe(childIcon.querySelector("svg")!.getBoundingClientRect().width);
    expect(getComputedStyle(collectionIcon).color).toBe(getComputedStyle(childIcon).color);
    await userEvent.click(collectionIcon);
    const appearance = within(await body.findByRole("dialog", {name: "编辑群组图标"}));
    await userEvent.click(appearance.getByRole("button", {name: "设置群组颜色 收藏"}));
    const groupColors = within(await body.findByRole("menu", {name: "群组颜色 收藏"}));
    await userEvent.click(groupColors.getByRole("menuitemradio", {name: "紫色"}));
    await waitFor(() => expect(collectionIcon).toHaveClass("note-tag-color-purple"));
    expect(getComputedStyle(collectionIcon).color).not.toBe(getComputedStyle(childIcon).color);
    expect(getComputedStyle(appearance.getByRole("button", {name: "更换图标"})).color).toBe(getComputedStyle(collectionIcon).color);
    await userEvent.fill(appearance.getByRole("textbox", {name: "搜索 Emoji"}), "🌱");
    await userEvent.click(appearance.getByRole("button", {name: "芽、苗、幼苗、发芽"}));
    await waitFor(() => expect(collectionIcon.textContent).toBe("🌱"));
    expect((await fixture.request<TagPreferenceState>("getTagPreferences")).groups?.find(group => group.name === "收藏")?.icon).toBe("🌱");
    await userEvent.keyboard("{Escape}");
    const drinks = within(canvas.getByRole("rowgroup", {name: "饮品"}));
    await userEvent.click(drinks.getByRole("button", {name: "编辑标签图标 生活/咖啡"}));
    const tagAppearance = within(await body.findByRole("dialog", {name: "编辑标签"}));
    await userEvent.fill(tagAppearance.getByRole("textbox", {name: "搜索 Emoji"}), "☕");
    await userEvent.click(tagAppearance.getByRole("button", {name: /^茶、热饮、咖啡/}));
    await waitFor(() => expect(drinks.getByRole("button", {name: "编辑标签图标 生活/咖啡"}).textContent).toBe("☕"));
    expect(within(canvas.getByRole("rowgroup", {name: "收藏"})).getByRole("button", {name: "编辑标签图标 生活/咖啡"}).textContent).toBe("☕");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(drinks.getByRole("button", {name: "编辑标签名称 生活/咖啡"}));
    const tagName = drinks.getByRole("textbox", {name: "标签名称"});
    expect(tagName).toHaveValue("生活/咖啡");
    const tagNameWidth = tagName.getBoundingClientRect().width;
    await userEvent.fill(tagName, "咖啡");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(drinks.getByRole("button", {name: "添加标签说明 生活/咖啡"}));
    const tagDescription = drinks.getByRole("textbox", {name: "标签说明"});
    expect(tagDescription.getBoundingClientRect().width).toBeCloseTo(tagNameWidth, 1);
    await userEvent.fill(tagDescription, "冲煮笔记");
    await userEvent.tab();
    await waitFor(async () => expect((await fixture.request<TagPreferenceState>("getTagPreferences")).labels?.["生活/咖啡"]).toBe("冲煮笔记"));
    expect(within(canvas.getByRole("rowgroup", {name: "收藏"})).getByRole("button", {name: "编辑标签说明 生活/咖啡"})).toHaveTextContent("冲煮笔记");
    await userEvent.click(drinks.getByRole("button", {name: "标签操作 生活/咖啡"}));
    const renameActions = within(await body.findByRole("menu", {name: "标签操作 生活/咖啡"}));
    await userEvent.click(renameActions.getByRole("menuitem", {name: "编辑标签名称"}));
    expect(await drinks.findByRole("textbox", {name: "标签名称"})).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(drinks.getByRole("button", {name: "标签操作 生活/咖啡"}));
    const labelActions = within(await body.findByRole("menu", {name: "标签操作 生活/咖啡"}));
    await userEvent.click(labelActions.getByRole("menuitem", {name: "加入群组"}));
    const menu = within(await body.findByRole("menu", {name: "加入群组 生活/咖啡"}));
    await userEvent.click(menu.getByRole("menuitemcheckbox", {name: "收藏", checked: true}));
    await menu.findByRole("menuitemcheckbox", {name: "收藏", checked: false});
    await userEvent.keyboard("{Escape}{Escape}");
    await userEvent.click(canvas.getByRole("button", {name: "群组操作 饮品"}));
    const groupActions = within(await body.findByRole("menu", {name: "群组操作 饮品"}));
    await userEvent.click(groupActions.getByRole("menuitem", {name: "编辑群组"}));
    const editor = within(await canvas.findByRole("rowgroup", {name: "编辑群组"}));
    expect(editor.getByRole("button", {name: "编辑群组说明"})).toHaveTextContent("群组测试说明");
    await userEvent.click(editor.getByRole("button", {name: "删除群组"}));
    await waitFor(() => expect(canvas.queryByRole("heading", {name: "饮品"})).toBeNull());
    expect(canvas.queryByRole("button", {name: "查看标签 生活/咖啡 的笔记"})).toBeNull();
    await userEvent.click(canvas.getByRole("button", {name: "编辑群组说明 收藏"}));
    const groupDescription = canvas.getByRole("textbox", {name: "群组说明"});
    expect(groupDescription.getBoundingClientRect().height).toBe(36);
    const groupDescriptionWidth = groupDescription.getBoundingClientRect().width;
    expect(groupDescription.closest("tr")!.getBoundingClientRect().height).toBe(40);
    await userEvent.fill(groupDescription, "收藏的阅读笔记");
    await userEvent.keyboard("{Enter}");
    expect(await canvas.findByRole("button", {name: "编辑群组说明 收藏"})).toHaveTextContent("收藏的阅读笔记");
    await userEvent.click(canvas.getByRole("button", {name: "编辑群组名称 收藏"}));
    const groupName = canvas.getByRole("textbox", {name: "群组名称"});
    expect(groupName).toHaveValue("收藏");
    expect(groupName.getBoundingClientRect().height).toBe(36);
    expect(groupName.getBoundingClientRect().width).toBeCloseTo(groupDescriptionWidth, 1);
    expect(groupName.closest("tr")!.getBoundingClientRect().height).toBe(40);
    await userEvent.fill(groupName, "我的收藏");
    await userEvent.keyboard("{Enter}");
    expect(await canvas.findByRole("heading", {name: "我的收藏"})).toBeTruthy();
    expect((await fixture.request<TagPreferenceState>("getTagPreferences")).groups?.[0]).toMatchObject({
      name: "我的收藏", icon: "🌱", tags: [], description: "收藏的阅读笔记", color: "purple",
    });
    await userEvent.click(canvas.getByRole("tab", {name: "全部"}));
    expect(canvas.getByRole("button", {name: "查看标签 生活/咖啡 的笔记"})).toBeTruthy();
    expect(fixture.snapshot().notes.map(note => [note.id, note.body, note.tags])).toEqual(original);
  } finally { view.unmount(); release(); history.replaceState(null, "", previousHash || "#/"); }
}, 30_000);

test("Web tag directory supports flat labels, shared pins, renaming and responsive layouts", async () => {
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ interfaceTheme: "classic" }));
  history.replaceState(null, "", "#/tags");
  const fixture = await createWorkspaceFixture();
  const plant = fixture.snapshot().notes.find(note => note.tags.includes("生活/植物"))!;
  await fixture.request("updateNoteProperty", {id: plant.id, name: "tags", type: "list", value: ["生活/植物/绿萝"]});
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container), body = within(document.body);
    await canvas.findByRole("button", {name: "查看标签 生活/咖啡 的笔记"});
    const directory = within(canvas.getByRole("region", {name: "标签目录"}));
    await userEvent.click(directory.getByRole("tab", {name: "标签群组"}));
    expect(directory.getByText("还没有标签群组")).toBeTruthy();
    expect(directory.queryByRole("button", {name: "管理标签"})).toBeNull();
    await userEvent.click(directory.getByRole("tab", {name: "全部"}));
    const directoryControls = page.getByRole("region", {name: "标签目录", exact: true});
    const coffee = directory.getByRole("button", {name: "查看标签 生活/咖啡 的笔记"});
    const coffeeActions = directory.getByRole("button", {name: "标签操作 生活/咖啡"});
    for (const width of [320, 390, 767, 768, 1024, 1440]) {
      await page.viewport(width, 1000);
      await waitFor(() => {
        const chip = coffee.getBoundingClientRect();
        const actions = coffeeActions.getBoundingClientRect();
        expect(chip.height).toBe(36);
        expect(actions.right).toBeLessThan(chip.right);
        expect(actions.top + actions.height / 2).toBeCloseTo(chip.top + chip.height / 2, 1);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
        const panel = view.container.querySelector<HTMLElement>(".ui-tag-directory-panel")!;
        expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth + 1);
      });
    }
    const selectTagAction = async (tag: string, action: string) => {
      const name = `标签操作 ${tag}`;
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
        await userEvent.hover(directory.getByRole("button", {name: `查看标签 ${tag} 的笔记`}));
      }
      await userEvent.click(directory.getByRole("button", {name}));
      const menu = within(await body.findByRole("menu", {name}));
      await userEvent.click(menu.getByRole("menuitem", {name: action}));
      await waitFor(() => expect(body.queryByRole("menu", {name})).toBeNull());
    };
    await selectTagAction("生活/咖啡", "置顶标签");
    const pinned = within(await canvas.findByRole("navigation", {name: "置顶标签"}));
    await pinned.findByRole("button", {name: "生活/咖啡"});
    await selectTagAction("生活/咖啡", "取消置顶");
    await waitFor(() => expect(pinned.queryByRole("button", {name: "生活/咖啡"})).toBeNull());
    const iconTrigger = directory.getByRole("button", {name: "编辑标签图标 生活/咖啡"});
    await userEvent.hover(iconTrigger);
    expect(Number.parseFloat(getComputedStyle(iconTrigger).borderRadius)).toBeGreaterThanOrEqual(iconTrigger.getBoundingClientRect().height / 2);
    await userEvent.click(iconTrigger);
    await body.findByRole("dialog", {name: "编辑标签"});
    expect(iconTrigger.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(iconTrigger);
    await waitFor(() => expect(body.queryByRole("dialog", {name: "编辑标签"})).toBeNull());
    expect(iconTrigger.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(iconTrigger);
    const desktopEditor = await body.findByRole("dialog", {name: "编辑标签"});
    await waitFor(() => expect(desktopEditor.getAttribute("data-slot")).toBe("popover-content"));
    expect(desktopEditor.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
    expect(desktopEditor.getBoundingClientRect().right).toBeLessThanOrEqual(1440);
    await userEvent.click(within(desktopEditor).getByRole("tab", {name: "图标"}));
    await userEvent.type(within(desktopEditor).getByRole("textbox", {name: "搜索图标"}), "咖啡");
    await userEvent.click(within(desktopEditor).getByRole("button", {name: "咖啡"}));
    await waitFor(() => expect(within(desktopEditor).queryByRole("region", {name: "标签图标选项"})).toBeNull());
    expect(body.getByRole("dialog", {name: "编辑标签"})).toBe(desktopEditor);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog", {name: "编辑标签"})).toBeNull());
    await selectTagAction("生活/咖啡", "置顶标签");
    const directoryGlyph = directory.getByRole("button", {name: "编辑标签图标 生活/咖啡"}).querySelector("svg")!;
    const sidebarGlyph = (await pinned.findByRole("button", {name: "生活/咖啡"})).querySelector("svg")!;
    expect(directoryGlyph.innerHTML).toBe(sidebarGlyph.innerHTML);
    expect(sidebarGlyph.innerHTML).not.toBe(pinned.getByRole("button", {name: "设计"}).querySelector("svg")!.innerHTML);
    expect((await fixture.request<TagPreferenceState>("getTagPreferences")).icons["生活/咖啡"]).toBe("icon:coffee");
    await selectTagAction("生活/咖啡", "编辑名称/图标");
    const renameEditor = within(await body.findByRole("dialog", {name: "编辑标签"}));
    await userEvent.fill(renameEditor.getByRole("textbox", {name: "标签名称"}), "手冲记录");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(body.queryByRole("dialog", {name: "编辑标签"})).toBeNull());
    expect(fixture.snapshot().notes.some(note => note.tags.includes("手冲记录"))).toBe(true);
    await page.viewport(390, 1000);
    await userEvent.type(directory.getByRole("textbox", {name: "搜索标签"}), "手冲");
    expect(directory.getByRole("button", {name: "查看标签 手冲记录 的笔记"})).toBeTruthy();
    await userEvent.click(directory.getByRole("button", {name: "清空标签搜索"}));
    await selectTagAction("生活", "置顶标签");
    await userEvent.click(directory.getByRole("button", {name: "编辑标签图标 生活"}));
    const mobileEditor = await body.findByRole("dialog", {name: "编辑标签"});
    expect(mobileEditor.getAttribute("data-slot")).toBe("sheet-content");
    const dialog = within(mobileEditor);
    const input = dialog.getByRole("textbox", {name: "标签名称"});
    await waitFor(() => expect(document.activeElement).toBe(dialog.getByRole("textbox", {name: "搜索 Emoji"})));
    await userEvent.clear(input);
    await userEvent.type(input, "日常");
    await userEvent.type(dialog.getByRole("textbox", {name: "搜索 Emoji"}), "图书馆");
    await userEvent.click(dialog.getByRole("button", {name: /^书、书本、书籍/}));
    await waitFor(() => expect(dialog.queryByRole("region", {name: "标签图标选项"})).toBeNull());
    expect(input).toHaveValue("日常");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(body.queryByRole("dialog", {name: "编辑标签"})).toBeNull());
    expect(fixture.snapshot().notes.some(note => note.tags.includes("生活/植物/绿萝"))).toBe(true);
    const renamed = await directory.findByRole("button", {name: "编辑标签图标 日常"});
    await waitFor(() => expect(document.activeElement).toBe(renamed));
    expect(directory.getByRole("button", {name: "编辑标签图标 日常"}).textContent).toContain("📚");
    expect((await fixture.request<TagPreferenceState>("getTagPreferences")).pinned).toContain("日常");
    await directoryControls.getByRole("button", {name: "查看标签 手冲记录 的笔记", exact: true}).click();
    expect(location.hash).toBe("#/notes");
    await canvas.findByRole("list", {name: "笔记列表"});
  } finally { view.unmount(); release(); history.replaceState(null, "", previousHash || "#/" ); }
}, 30_000);

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
          const tags = item.querySelector(".ui-note-tags");
          expect(tags !== null).toBe(layout === "list");
          const sample = {
            left: bounds.left, width: bounds.width, itemWidth: item.getBoundingClientRect().width,
            columns: getComputedStyle(list).gridTemplateColumns,
            tags: tags ? getComputedStyle(tags).display : "none",
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
        if (layout === "list") {
          const list = canvas.getByRole("list", {name: "笔记列表"});
          const scroll = view.container.querySelector<HTMLElement>("#web-main-content")!;
          const naturalHeight = () => Array.from(list.children).reduce((height, item) => height + item.getBoundingClientRect().height, parseFloat(getComputedStyle(list).paddingTop) + parseFloat(getComputedStyle(list).paddingBottom));
          for (const height of [1200, 1600]) {
            await page.viewport(1440, height);
            await waitFor(() => {
              if (route === "home") expect(list.getBoundingClientRect().height).toBeCloseTo(naturalHeight(), 1);
              else expect(list.getBoundingClientRect().bottom).toBeCloseTo(scroll.getBoundingClientRect().bottom, 1);
              expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight + 1);
            });
            expect(getComputedStyle(list).overflowY).toBe("visible");
          }
          for (const height of [1200, 1600]) {
            await page.viewport(390, height);
            await waitFor(() => expect(current!.isMobile).toBe(true));
            expect(list.getBoundingClientRect().height).toBeCloseTo(naturalHeight(), 1);
          }
          await page.viewport(1440, 240);
          await waitFor(() => expect(current!.isMobile).toBe(false));
          expect(list.getBoundingClientRect().height).toBeCloseTo(naturalHeight(), 1);
          expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
          scroll.scrollTop = scroll.scrollHeight;
          expect(list.lastElementChild!.getBoundingClientRect().bottom).toBeLessThanOrEqual(scroll.getBoundingClientRect().bottom);
          scroll.scrollTop = 0;
        }
      }
    }
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/");
  }
}, 30_000);

for (const mode of ["light", "dark"] as const) test(`settings groups share card bounds, controls and disclosure spacing in ${mode}`, async () => {
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({theme: mode, interfaceTheme: "classic"}));
  history.replaceState(null, "", "#/settings");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    const title = await canvas.findByRole("heading", {name: "设置", level: 1});
    const advanced = canvas.getByText("高级排版").closest("details")!;
    const card = canvas.getByRole("combobox", {name: "行宽"}).closest<HTMLElement>('[data-slot="card"]')!;
    expect(advanced.closest('[data-slot="card"]')).toBe(card);
    for (const width of [320, 768, 1440]) {
      await page.viewport(width, 900);
      await waitFor(() => expect(title.getBoundingClientRect().height).toBeGreaterThanOrEqual(32));
      expect(title.getBoundingClientRect().width).toBeGreaterThan(100);
      const bounds = card.getBoundingClientRect(), disclosure = advanced.getBoundingClientRect();
      expect(disclosure.left).toBeGreaterThanOrEqual(bounds.left);
      expect(disclosure.right).toBeLessThanOrEqual(bounds.right);
      const preview = canvas.getByRole("region", {name: "笔记排版预览"});
      expect(getComputedStyle(preview).borderRadius).toBe(getComputedStyle(card).borderRadius);
      expect(getComputedStyle(preview).backgroundColor).toBe(getComputedStyle(card).backgroundColor);
      await userEvent.click(within(advanced).getByText("高级排版"));
      const controls = ["行宽", "字号", "行高", "段落间距"].map(name => canvas.getByRole("combobox", {name}));
      for (const control of controls) expect(control.getBoundingClientRect().width).toBeCloseTo(controls[0].getBoundingClientRect().width, 1);
      if (width >= 768) {
        const row = controls[0].parentElement!;
        expect(advanced.querySelector("summary")!.getBoundingClientRect().height).toBe(row.getBoundingClientRect().height - Number.parseFloat(getComputedStyle(row).borderBottomWidth));
        const scroller = view.container.querySelector<HTMLElement>("#web-main-content")!;
        expect(title.getBoundingClientRect().top + title.getBoundingClientRect().height / 2 + scroller.scrollTop).toBeCloseTo(view.container.querySelector(".ui-sidebar-brand-header")!.getBoundingClientRect().top + 20, 1);
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      await userEvent.click(within(advanced).getByText("高级排版"));
    }
  } finally { view.unmount(); release(); history.replaceState(null, "", previousHash || "#/"); }
});

test("shared sidebar hover actions hide after pointer focus and remain keyboard accessible", async () => {
  await page.viewport(1024, 900);
  const view = render(<PreviewModeProvider mode="light"><SidebarProvider className="ui-theme">
    <Sidebar collapsible="none"><SidebarMenu><SidebarMenuItem>
      <SidebarMenuButton>浏览笔记</SidebarMenuButton>
      <SidebarMenuAction showOnHover render={<Button />} aria-label="笔记操作">…</SidebarMenuAction>
    </SidebarMenuItem></SidebarMenu></Sidebar>
    <main><Button>区域之外</Button></main>
  </SidebarProvider></PreviewModeProvider>);
  const canvas = within(view.container);
  const trigger = canvas.getByRole("button", {name: "浏览笔记"});
  const action = canvas.getByRole("button", {name: "笔记操作"});
  await userEvent.click(trigger);
  await userEvent.hover(canvas.getByRole("button", {name: "区域之外"}));
  expect(getComputedStyle(action).opacity).toBe("0");
  trigger.focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(action);
  expect(getComputedStyle(action).opacity).toBe("1");
});

for (const mode of ["light", "dark"] as const) test(`desktop sidebar swaps its logo for the toggle on hover and keyboard focus in ${mode}`, async () => {
  await page.viewport(1024, 900);
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({theme: mode, interfaceTheme: "classic"}));
  history.replaceState(null, "", "#/notes");
  const fixture = await createWorkspaceFixture();
  const preferences = await fixture.request<TagPreferenceState>("getTagPreferences");
  await fixture.request("setTagPreferences", { ...preferences, pinned: ["生活"] });
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    await canvas.findByRole("button", {name: "打开 今天的手冲记录"});
    const tag = await canvas.findByRole("button", {name: "生活"});
    const tagRow = tag.closest(".ui-sidebar-tree-row")!;
    const tagMore = tagRow.querySelector<HTMLElement>(".ui-sidebar-tag-more")!;
    expect(tagRow.querySelector(".ui-sidebar-tree-toggle")).toBeNull();
    await userEvent.click(tag);
    await userEvent.hover(canvas.getByRole("heading", {name: "# 生活"}));
    await waitFor(() => expect(getComputedStyle(tagMore).opacity).toBe("0"));
    tag.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(tagMore);
    expect(getComputedStyle(tagMore).opacity).toBe("1");
    await userEvent.click(canvas.getByRole("button", {name: /^所有笔记$/}));
    const brand = canvas.getByRole("button", {name: "MemoCard，返回主页"});
    const logo = brand.querySelector<HTMLElement>(".ui-sidebar-logo")!;
    const collapse = canvas.getByRole("button", {name: "收起侧栏"});
    await userEvent.hover(brand.querySelector("span")!);
    expect(getComputedStyle(brand.parentElement!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(logo).opacity).toBe("1");
    expect(getComputedStyle(collapse).opacity).toBe("0");
    const logoBox = logo.getBoundingClientRect(), controlBox = collapse.getBoundingClientRect();
    expect([logoBox.width, logoBox.height]).toEqual([32, 32]);
    expect([controlBox.width, controlBox.height]).toEqual([36, 36]);
    expect(getComputedStyle(brand).borderRadius).toBe("9999px");
    expect(getComputedStyle(brand.parentElement!).borderRadius).toBe("9999px");
    expect(getComputedStyle(brand).paddingInlineStart).toBe("2px");
    const headerBox = brand.parentElement!.getBoundingClientRect();
    expect(controlBox.top - headerBox.top).toBe(2);
    expect(headerBox.bottom - controlBox.bottom).toBe(2);
    expect(controlBox.left - headerBox.left).toBe(2);
    expect(controlBox.left + controlBox.width / 2).toBeCloseTo(logoBox.left + logoBox.width / 2, 1);
    expect(controlBox.top + controlBox.height / 2).toBeCloseTo(logoBox.top + logoBox.height / 2, 1);
    await userEvent.hover(collapse);
    expect(getComputedStyle(logo).opacity).toBe("0");
    expect(getComputedStyle(collapse).opacity).toBe("1");
    await userEvent.hover(brand.querySelector("span")!);
    expect(getComputedStyle(logo).opacity).toBe("1");
    expect(getComputedStyle(collapse).opacity).toBe("0");
    brand.focus();
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(collapse);
    expect(getComputedStyle(collapse).opacity).toBe("1");
    expect(getComputedStyle(logo).opacity).toBe("0");
    expectKeyboardOutline(collapse, mode);
    await userEvent.keyboard("{Enter}");
    const expand = await canvas.findByRole("button", {name: "展开侧栏"});
    await waitFor(() => expect(document.activeElement).toBe(expand));
    expect(location.hash).toBe("#/notes");
    const collapsedLogo = expand.parentElement!.querySelector<HTMLElement>(".ui-sidebar-logo")!;
    expect(getComputedStyle(expand).opacity).toBe("1");
    expect(getComputedStyle(collapsedLogo).opacity).toBe("0");
    view.container.querySelector<HTMLElement>("#web-main-content")!.focus();
    await userEvent.hover(canvas.getByRole("heading", {name: "所有笔记"}));
    expect(getComputedStyle(expand).opacity).toBe("0");
    expect(getComputedStyle(collapsedLogo).opacity).toBe("1");
    const collapsedLogoBox = collapsedLogo.getBoundingClientRect(), expandBox = expand.getBoundingClientRect();
    expect([collapsedLogoBox.width, collapsedLogoBox.height]).toEqual([32, 32]);
    expect([expandBox.width, expandBox.height]).toEqual([36, 36]);
    expect(expandBox.left + expandBox.width / 2).toBeCloseTo(collapsedLogoBox.left + collapsedLogoBox.width / 2, 1);
    expect(expandBox.top + expandBox.height / 2).toBeCloseTo(collapsedLogoBox.top + collapsedLogoBox.height / 2, 1);
    await userEvent.hover(expand);
    expect(getComputedStyle(expand).opacity).toBe("1");
    expect(getComputedStyle(collapsedLogo).opacity).toBe("0");
    await userEvent.hover(canvas.getByRole("heading", {name: "所有笔记"}));
    expect(getComputedStyle(expand).opacity).toBe("0");
    expect(getComputedStyle(collapsedLogo).opacity).toBe("1");
    canvas.getByRole("link", {name: "跳到笔记内容"}).focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(expand);
    expect(getComputedStyle(expand).opacity).toBe("1");
    expect(getComputedStyle(collapsedLogo).opacity).toBe("0");
    expectKeyboardOutline(expand, mode);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(document.activeElement).toBe(canvas.getByRole("button", {name: "收起侧栏"})));
    expect(getComputedStyle(canvas.getByRole("button", {name: "收起侧栏"})).opacity).toBe("1");
    await userEvent.click(canvas.getByRole("button", {name: "MemoCard，返回主页"}));
    await waitFor(() => expect(location.hash).toBe("#/home"));
    await userEvent.hover(canvas.getByRole("tab", {name: /^最近更新$/}));
    const focusedBrand = canvas.getByRole("button", {name: "MemoCard，返回主页"});
    expect(document.activeElement).toBe(focusedBrand);
    expect(getComputedStyle(focusedBrand.parentElement!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    const vault = canvas.getByRole("button", {name: /^笔记库：/});
    expect(getComputedStyle(vault).opacity).toBe("0");
    await userEvent.tab();
    expect(document.activeElement).toBe(vault);
    expect(getComputedStyle(vault).opacity).toBe("1");
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/");
  }
});

for (const mode of ["light", "dark"] as const) test(`Web header preserves mobile touch targets, spacing and desktop appearance in ${mode}`, async () => {
  await page.viewport(320, 900);
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({theme: mode, interfaceTheme: "classic"}));
  const fixture = await createWorkspaceFixture();
  const note = { ...fixture.snapshot().notes[0], title: "用于检查当前笔记标题截断的长标题".repeat(12) };
  await fixture.request("saveNote", { id: note.id, title: note.title, body: note.body, tags: note.tags, baseHash: note.contentHash });
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
  hoverReference.style.color = "var(--color-icon-red)";
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
      const navigation = width < 768
        ? controls.getByRole("button", {name: /^返回/})
        : within(controls.getByRole("navigation", {name: "当前位置"})).getByRole("button", {name: "所有笔记"});
      expect(controls.queryByRole("button", {name: /^返回/})).toBe(width < 768 ? navigation : null);
      expect(navigation).toHaveProperty("disabled", false);
      const more = controls.getByRole("button", {name: "页面操作"});
      const pin = controls.getByRole("button", {name: "固定到主页"});
      const iconButtons = width < 768 ? [navigation, pin, more] : [pin, more];
      await waitFor(() => {
        const bounds = header.getBoundingClientRect();
        const navigationBounds = navigation.getBoundingClientRect();
        expect(navigationBounds.width).toBeGreaterThan(0);
        expect(navigationBounds.left).toBeGreaterThanOrEqual(bounds.left);
        expect(navigationBounds.right).toBeLessThanOrEqual(bounds.right);
        for (const button of iconButtons) {
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
          const groups = [navigation.closest<HTMLElement>('[data-slot="action-group"]'), pin.closest<HTMLElement>('[data-slot="action-group"]')];
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
          const current = controls.getByText(note.title);
          expect(current.getAttribute("aria-current")).toBe("page");
          expect(current.tabIndex).toBe(-1);
          expect(current.clientWidth).toBeGreaterThan(0);
          expect(current.scrollWidth).toBeGreaterThan(current.clientWidth);
          expect(getComputedStyle(current).textOverflow).toBe("ellipsis");
          expect(current.getBoundingClientRect().right).toBeLessThanOrEqual(pin.getBoundingClientRect().left);
          const groupStyle = getComputedStyle(actionGroup);
          expect(["none", getComputedStyle(noShadow).boxShadow]).toContain(groupStyle.boxShadow);
          expect(groupStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
          for (const button of iconButtons) expect(button.closest('[data-slot="action-group"]')).toBeNull();
        }
        expect(pin.getBoundingClientRect().left).toBeGreaterThanOrEqual(navigationBounds.right);
        expect(more.getBoundingClientRect().left - pin.getBoundingClientRect().right, `${width}px action gap`).toBeCloseTo(width < 768 ? 0 : 8, 1);
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
      });
      if (width >= 768) {
        navigation.focus();
        await userEvent.tab();
        expect(document.activeElement).toBe(pin);
      }
      await userEvent.click(pin);
      await waitFor(() => expect(controls.getByRole("button", {name: "取消固定"}).getAttribute("aria-pressed")).toBe("true"));
      await userEvent.click(pin);
      await waitFor(() => expect(controls.getByRole("button", {name: "固定到主页"}).getAttribute("aria-pressed")).toBe("false"));
      await userEvent.click(more);
      const menu = await body.findByRole("menu");
      const moveToTrash = within(menu).getByRole("menuitem", {name: "移入回收站"});
      const deleteColor = getComputedStyle(hoverReference).color;
      expect(getComputedStyle(moveToTrash).color).toBe(deleteColor);
      expect(getComputedStyle(moveToTrash.querySelector("svg")!).color).toBe(deleteColor);
      moveToTrash.focus();
      expect(getComputedStyle(moveToTrash).color).toBe(deleteColor);
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
    await userEvent.click(within(controls.getByRole("navigation", {name: "当前位置"})).getByRole("button", {name: "所有笔记"}));
    await waitFor(() => expect(canvas.queryByRole("textbox", {name: "页面标题"})).toBeNull());
    await userEvent.click(canvas.getByRole("button", {name: `打开 ${note.title}`}));
    await canvas.findByRole("textbox", {name: "页面标题"});
    await page.viewport(673, 900);
    await waitFor(() => expect(header.querySelectorAll('[data-slot="action-group"]')).toHaveLength(2));
    await userEvent.click(controls.getByRole("button", {name: /^返回/}));
    await waitFor(() => expect(canvas.queryByRole("textbox", {name: "页面标题"})).toBeNull());
    const collectionTitle = await within(header).findByRole("button", {name: "视图选项 所有笔记"});
    await waitFor(() => {
      const rect = collectionTitle.getBoundingClientRect();
      expect(rect.left + rect.width / 2).toBeCloseTo(673 / 2, 1);
    });
    await userEvent.click(canvas.getByRole("button", {name: "筛选笔记"}));
    const filterDialog = await body.findByRole("dialog", {name: "筛选笔记"});
    await userEvent.click(within(filterDialog).getByRole("button", {name: `筛选标签 ${longTag}`}));
    await userEvent.click(within(filterDialog).getByRole("button", {name: "完成"}));
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull());
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
      if (width < 768) {
        controls.getByRole("button", {name: "页面操作"}).focus();
        if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Shift>}{Tab}{/Shift}{/Alt}");
        else await userEvent.tab({shift: true});
      } else {
        expect(controls.queryByRole("button", {name: "页面操作"})).toBeNull();
        within(controls.getByRole("navigation", {name: "当前位置"})).getAllByRole("button").at(-1)!.focus();
        if (server.browser === "webkit") await userEvent.keyboard("{Alt>}{Tab}{/Alt}");
        else await userEvent.tab();
      }
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
  let current!: AppViewState;
  const view = render(<WebAppearanceProvider><App renderView={state => { current = state; return renderWebApp(state); }} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    const title = await canvas.findByRole("textbox", {name: "页面标题"});
    const body = await canvas.findByRole("textbox", {name: "笔记内容"});
    await canvas.findByRole("button", {name: "属性菜单 阶段"});
    await document.fonts.ready;
    for (const width of [320, 390, 640, 767, 768, 820, 1024, 1180, 1440]) {
      await page.viewport(width, 900);
      await waitFor(() => expect(current.isMobile).toBe(width < 768));
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const checkLayout = () => {
        const titleBox = title.getBoundingClientRect(), titleStyle = getComputedStyle(title);
        const start = titleBox.left + parseFloat(titleStyle.paddingLeft);
        const end = titleBox.right - parseFloat(titleStyle.paddingRight);
        if (width < 768) {
          const panel = view.container.querySelector<HTMLElement>(".web-app-main")!;
          const bounds = panel.getBoundingClientRect();
          expect(bounds.left).toBe(0);
          expect(bounds.right).toBe(width);
          expect(getComputedStyle(panel).borderRadius).toBe("0px");
          expect(start - bounds.left).toBeCloseTo(16, 1);
          expect(bounds.right - end).toBeCloseTo(16, 1);
        }
        const text = richBlockBody(body.firstElementChild as HTMLElement);
        const textBox = text.getBoundingClientRect(), textStyle = getComputedStyle(text);
        expect(textBox.left + parseFloat(textStyle.paddingLeft), `${width}px body start`).toBeCloseTo(start, 1);
        expect(textBox.right - parseFloat(textStyle.paddingRight), `${width}px body end`).toBeCloseTo(end, 1);
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
      const propertyOffsets = () => {
        const titleTop = title.getBoundingClientRect().top;
        return Object.fromEntries(Array.from(view.container.querySelectorAll<HTMLElement>(".note-property-row[data-property-key]"), row => [
          row.dataset.propertyKey!,
          row.querySelector("dd")!.getBoundingClientRect().top - titleTop,
        ]));
      };
      const collapsedOffsets = propertyOffsets();
      const checkPropertyOffsets = () => {
        const current = propertyOffsets();
        for (const [key, top] of Object.entries(collapsedOffsets)) {
          expect(current[key], `${width}px ${key} offset from title`).toBeCloseTo(top, 1);
        }
      };
      await userEvent.click(canvas.getByRole("button", {name: "更多属性"}));
      await waitFor(checkLayout);
      checkPropertyOffsets();
      await userEvent.click(canvas.getByRole("button", {name: "收起"}));
      await waitFor(checkLayout);
      checkPropertyOffsets();
      await userEvent.hover(body.querySelector("li")!);
      await waitFor(() => expect(view.container.querySelector<HTMLElement>(".block-controls")!.style.getPropertyValue("--editor-block-left")).not.toBe(""));
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

test("filling and clearing properties keeps adjacent rows stable when saving", async () => {
  await commands.setReducedMotion("reduce");
  await page.viewport(390, 900);
  const fixture = propertyLayoutFixture("layout-compact-empty");
  let properties: Properties = {
    ...preferenceProperties,
    properties: [
      {name:"摘要", type:"text", value:"", editable:true},
      {name:"数字", type:"number", value:"", editable:true},
    ],
  };
  const widget = () => <PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} reserveBodySpace savedProperties={properties} onApply={async change => {
      properties = {...properties, properties: properties.properties.map(property => property.name === change.name ? {...property, value: change.value ?? ""} : property)};
      view.rerender(widget());
    }} />
    <p data-testid="following-content">正文</p>
  </main></PreviewModeProvider>;
  const view = render(widget());
  try {
    const canvas = within(view.container);
    await canvas.findByRole("button", {name:"编辑属性 摘要"});
    await document.fonts.ready;
    const viewport = canvas.getByRole("region", {name:"属性列表"});
    const origin = view.container.querySelector(".note-properties")!;
    const layout = () => [...viewport.querySelectorAll(".note-property-row"), canvas.getByTestId("following-content")].map(row => ({
      top: row.getBoundingClientRect().top - origin.getBoundingClientRect().top,
      height: row.getBoundingClientRect().height,
    }));
    const textOrigin = (element:HTMLElement) => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      const cell = element.closest("dd")!.getBoundingClientRect();
      return {left: rect.left - cell.left + parseFloat(style.paddingLeft), top: rect.top - cell.top + parseFloat(style.paddingTop)};
    };
    for (const [name, value] of [["摘要", "输入内容"], ["数字", "123"]]) {
      const button = canvas.getByRole("button", {name:`编辑属性 ${name}`});
      expect(button.textContent).toBe("空");
      const before = layout(), beforeText = textOrigin(button);
      await userEvent.click(button);
      const input = await canvas.findByRole("textbox", {name:"属性值"});
      expect(layout()).toEqual(before);
      expect(textOrigin(input)).toEqual(beforeText);
      await userEvent.fill(input, value);
      expect(layout()).toEqual(before);
      await userEvent.keyboard("{Enter}");
      await waitFor(() => {
        expect(canvas.getByRole("button", {name:`编辑属性 ${name}`}).textContent).toBe(value);
        expect(layout()).toEqual(before);
      });
    }
    for (const expanded of [false, true]) {
      if (expanded) await userEvent.click(canvas.getByRole("button", {name:"更多属性"}));
      const write = async (name:string, value:string, before?:ReturnType<typeof layout>) => {
        const button = canvas.getByRole("button", {name:`编辑属性 ${name}`});
        const beforeText = textOrigin(button);
        await userEvent.click(button);
        const input = await canvas.findByRole("textbox", {name:"属性值"});
        expect(textOrigin(input)).toEqual(beforeText);
        await userEvent.fill(input, value);
        const edited = layout();
        if (before) expect(edited).toEqual(before);
        await userEvent.keyboard("{Enter}");
        await waitFor(() => {
          const saved = canvas.getByRole("button", {name:`编辑属性 ${name}`});
          expect(saved.textContent).toBe(value || "空");
          expect(document.activeElement).toBe(saved);
          expect(layout()).toEqual(edited);
        });
      };
      if (expanded) {
        await write("摘要", "输入内容", layout());
        await write("数字", "123", layout());
      }
      await write("摘要", "", layout());
      await write("数字", "", layout());
      await write("摘要", "第一行\n第二行");
      await write("摘要", "");
    }
  } finally { view.unmount(); fixture.release(); }
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
      const before = trigger.closest("dd")!.getBoundingClientRect().height;
      await userEvent.click(trigger);
      const input = await canvas.findByRole("textbox", {name: "属性值"}) as HTMLTextAreaElement;
      await waitFor(() => {
        expect(input.placeholder).toBe("");
        expect(Math.abs(input.closest("dd")!.getBoundingClientRect().height - before)).toBeLessThanOrEqual(1);
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
      expect(Math.abs(saved.closest("dd")!.getBoundingClientRect().height - editedHeight + 4)).toBeLessThanOrEqual(1);
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
    await waitFor(() => expect(canvas.getByRole("textbox", {name: "属性值"}).getBoundingClientRect().height).toBe(36));
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

for (const width of [390, 1100]) test(`cold Web detail shows the body during slow reads and scrolls 40 properties with the note at ${width}px`, async () => {
  await page.viewport(width, 900);
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.removeItem("memocard-web-appearance-v1");
  const fixture = await createWorkspaceFixture();
  const note = fixture.snapshot().notes[0];
  const properties: Properties = {
    ...preferenceProperties, contentHash: note.contentHash,
    properties: Array.from({length:40}, (_, index) => ({
      name: `字段${index}`, type: "text", value: index === 0 ? "需要换行的属性内容".repeat(30) : "属性内容", editable: true,
    })),
  };
  const layout: PropertyLayout = {
    ...emptyPropertyLayout(), order: ["property:字段0", "system:tags"],
    visibility: {"property:字段1":"hidden"},
  };
  let finishProperties!: () => void, finishLayout!: () => void;
  const propertyRead = new Promise<void>(resolve => { finishProperties = resolve; });
  const layoutRead = new Promise<void>(resolve => { finishLayout = resolve; });
  let pendingProperties = false, pendingLayout = false;
  history.replaceState(null, "", `#/notes/${note.id}`);
  const release = setStorybookRequestHandler(async (operation, params) => {
    if (operation === "getStatus") {
      const status = await fixture.request<VaultStatus>(operation, params);
      return {...status, capabilities:[...status.capabilities, "getPropertyLayout"]};
    }
    if (operation === "getNoteProperties") {
      pendingProperties = true;
      await propertyRead;
      return properties;
    }
    if (operation === "getPropertyLayout") {
      pendingLayout = true;
      await layoutRead;
      return layout;
    }
    return fixture.request(operation, params);
  });
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    const body = await canvas.findByRole("textbox", {name:"笔记内容"});
    const title = await canvas.findByRole("textbox", {name:"页面标题"});
    await waitFor(() => expect(view.container.querySelector(".web-app")).toHaveAttribute("data-interface-theme", "minimal"));
    await waitFor(() => expect(pendingProperties && pendingLayout).toBe(true));
    await document.fonts.ready;
    expect(body.textContent?.trim()).toBeTruthy();
    expect(body.getAttribute("contenteditable")).toBe("true");
    expect(body.getBoundingClientRect().top).toBeLessThan(window.innerHeight);
    const initialBodyTop = body.getBoundingClientRect().top;
    const initialTitleTop = title.getBoundingClientRect().top;
    expect(canvas.getByRole("status", {name:"正在读取属性"})).toBeTruthy();
    expect(canvas.getByRole("button", {name:"更多属性"})).toBeDisabled();
    expect(view.container.querySelector("[data-property-key]")).toBeNull();
    if (width < 768) finishLayout(); else finishProperties();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(canvas.getByRole("status", {name:"正在读取属性"})).toBeTruthy();
    expect(body.getBoundingClientRect().top).toBeCloseTo(initialBodyTop, 1);
    finishProperties();
    finishLayout();
    const lastField = await canvas.findByRole("button", {name:"编辑属性 字段39"});
    expect(view.container.querySelector("[data-property-key]")?.getAttribute("data-property-key")).toBe("property:字段0");
    expect(canvas.queryByRole("button", {name:"编辑属性 字段1"})).toBeNull();
    expect(view.container.querySelectorAll('[data-property-key^="property:"]')).toHaveLength(39);
    expect(canvas.getByRole("textbox", {name:"笔记内容"})).toBe(body);
    expect(title.getBoundingClientRect().top).toBeCloseTo(initialTitleTop, 1);
    expect(body.getBoundingClientRect().top).toBeGreaterThan(initialBodyTop);
    const viewport = lastField.closest<HTMLElement>(".note-property-viewport")!;
    const scroll = viewport.closest<HTMLElement>(".web-app-scroll")!;
    expect(viewport.scrollHeight).toBe(viewport.clientHeight);
    viewport.scrollTop = viewport.scrollHeight;
    expect(viewport.scrollTop).toBe(0);
    expect(lastField.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewport.getBoundingClientRect().bottom);
    const collapsedOffset = body.getBoundingClientRect().top - title.getBoundingClientRect().top;
    lastField.scrollIntoView({block:"center"});
    expect(scroll.scrollTop).toBeGreaterThan(0);
    expect(viewport.scrollTop).toBe(0);
    await userEvent.click(lastField);
    const input = await canvas.findByRole("textbox", {name:"属性值"});
    await waitFor(() => expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(viewport.getBoundingClientRect().bottom + 1));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvas.queryByRole("textbox", {name:"属性值"})).toBeNull());
    await userEvent.click(canvas.getByRole("button", {name:"更多属性"}));
    expect(canvas.getByRole("button", {name:"编辑属性 字段1"})).toBeTruthy();
    expect(viewport.scrollHeight).toBe(viewport.clientHeight);
    await userEvent.click(canvas.getByRole("button", {name:"收起"}));
    expect(body.getBoundingClientRect().top - title.getBoundingClientRect().top).toBeCloseTo(collapsedOffset, 1);
  } finally {
    finishProperties(); finishLayout(); view.unmount(); release();
    history.replaceState(null, "", previousHash || "#/notes");
  }
}, 25_000);

test("Web detail fits a short property list without blank rows above the body", async () => {
  await page.viewport(390, 900);
  const previousHash = location.hash;
  const fixture = await createWorkspaceFixture();
  const note = fixture.snapshot().notes[0];
  history.replaceState(null, "", `#/notes/${note.id}`);
  const release = setStorybookRequestHandler((operation, params) => operation === "getNoteProperties"
    ? {...preferenceProperties, contentHash: note.contentHash, properties: [{name:"摘要", type:"text", value:"短值", editable:true}]}
    : fixture.request(operation, params));
  const view = render(<WebAppearanceProvider><App renderView={renderWebApp} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    await canvas.findByRole("button", {name:"编辑属性 摘要"});
    const viewport = canvas.getByRole("region", {name:"属性列表"});
    const list = viewport.querySelector("dl")!;
    expect(list.children).toHaveLength(5);
    const {paddingTop, paddingBottom} = getComputedStyle(viewport);
    const fittedHeight = list.getBoundingClientRect().height + parseFloat(paddingTop) + parseFloat(paddingBottom);
    expect(viewport.getBoundingClientRect().height).toBeCloseTo(fittedHeight, 1);
    expect(viewport.scrollHeight).toBe(viewport.clientHeight);
  } finally {
    view.unmount(); release();
    history.replaceState(null, "", previousHash || "#/notes");
  }
}, 15_000);

test("property loading keeps the persisted order and holds the warm note body position", async () => {
  await page.viewport(1100, 900);
  const binding = "layout-skeleton-vault";
  const loaded: Properties = {...preferenceProperties, properties: Array.from({length:40}, (_,index) => ({
    name: `字段${index}`, type: "text", value: "属性内容", editable: true,
  }))};
  const layout: PropertyLayout = {
    order: ["property:字段39", "system:tags"],
    visibility: Object.fromEntries(loaded.properties.slice(0,32).map(property => [`property:${property.name}`, "hidden"])),
    contentHash: "0".repeat(64),
  };
  let finishLayout!: () => void;
  const release = setStorybookRequestHandler(async operation => {
    if (operation === "getStatus") return propertyLayoutStatus();
    if (operation === "getPropertyLabels") return {labels: {}, contentHash: "labels"};
    if (operation === "getPropertyLayout") { await new Promise<void>(resolve => { finishLayout = resolve; }); return layout; }
    throw new Error(`Unexpected property operation: ${operation}`);
  });
  const fixture = (key: string) => <PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties key={key} note={editorNote} vaultBinding={binding} tags={[]} canEdit busy={false} savedProperties={loaded} onApply={async () => {}} />
    <p>正文定位</p>
  </main></PreviewModeProvider>;
  const view = render(fixture("first"));
  const canvas = within(view.container);
  try {
    await waitFor(() => expect(finishLayout).toBeTypeOf("function"));
    expect(canvas.getByRole("status", {name:"正在读取属性"})).toBeTruthy();
    expect(view.container.querySelector("[data-property-key]")).toBeNull();
    finishLayout();
    await canvas.findByRole("button", {name:"编辑属性 字段39"});
    expect(view.container.querySelector("[data-property-key]")?.getAttribute("data-property-key")).toBe("property:字段39");
    expect(canvas.queryByRole("button", {name:"编辑属性 字段0"})).toBeNull();
    const body = canvas.getByText("正文定位");
    const readyY = body.getBoundingClientRect().top;
    const firstRead = finishLayout;
    view.rerender(fixture("reopen"));
    expect(canvas.getByRole("status", {name:"正在读取属性"})).toBeTruthy();
    expect(body.getBoundingClientRect().top).toBeCloseTo(readyY, 1);
    await waitFor(() => expect(finishLayout).not.toBe(firstRead));
    finishLayout();
    await canvas.findByRole("button", {name:"编辑属性 字段39"});
    expect(body.getBoundingClientRect().top).toBeCloseTo(readyY, 1);
  } finally { finishLayout?.(); release(); }
}, 15_000);

test("property grips move a row vertically and shift its neighbors before saving the order", async () => {
  await page.viewport(1024, 900);
  await commands.setReducedMotion("no-preference");
  let finishSave!: () => void;
  const saving = new Promise<void>(resolve => { finishSave = resolve; });
  const fixture = propertyLayoutFixture("layout-pointer-drag", () => saving), changes: unknown[] = [];
  const view = render(<PreviewModeProvider mode="light"><main className="ui-theme p-4">
    <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={preferenceProperties} onApply={async change => { changes.push(change); }} />
  </main></PreviewModeProvider>);
  try {
    const canvas = within(view.container);
    const target = (await canvas.findByRole("button", {name: "属性菜单 零值"})).closest<HTMLElement>(".note-property-row")!;
    const name = canvas.getByRole("button", {name: "属性菜单 摘要"});
    const textLeft = within(name).getByText("摘要").getBoundingClientRect().left;
    await userEvent.click(name);
    await within(document.body).findByRole("menu");
    await userEvent.click(name);
    await waitFor(() => expect(within(document.body).queryByRole("menu")).toBeNull());
    await userEvent.hover(canvas.getByRole("button", {name: "属性菜单 零值"}));
    expect(document.activeElement).toBe(name);
    await waitFor(() => expect(getComputedStyle(canvas.getByRole("button", {name: "拖动属性 摘要"})).opacity).toBe("0"));
    expect(getComputedStyle(name.querySelector("svg")!).visibility).toBe("visible");
    await userEvent.hover(name);
    const grip = await canvas.findByRole("button", {name: "拖动属性 摘要"});
    expect(grip.draggable).toBe(false);
    expect(within(name).getByText("摘要").getBoundingClientRect().left).toBeCloseTo(textLeft, 1);
    const source = grip.closest<HTMLElement>(".note-property-row")!;
    const start = source.getBoundingClientRect();
    const targetStart = target.getBoundingClientRect();
    const bodyBounds = document.body.getBoundingClientRect();
    let pointerId = 0;
    grip.addEventListener("pointerdown", event => { pointerId = event.pointerId; });
    for (const cancel of [true, false]) {
      await userEvent.hover(grip);
      await commands.pressLeftMouseButton();
      try {
        await userEvent.hover(document.body, { force: true, position: {
          x: targetStart.left + targetStart.width / 2 - bodyBounds.left,
          y: targetStart.bottom - 2 - bodyBounds.top,
        } });
        expect(source.getBoundingClientRect().left).toBeCloseTo(start.left, 1);
        await waitFor(() => expect(source.getBoundingClientRect().top).toBeGreaterThan(start.top));
        expect(getComputedStyle(source).backgroundColor).toBe("rgba(0, 0, 0, 0)");
        expect(getComputedStyle(name).borderRadius).toBe("6px");
        expect(getComputedStyle(grip).opacity).toBe("1");
        await waitFor(() => expect(target.getBoundingClientRect().top).toBeCloseTo(start.top, 1));
        expect(fixture.writes).toHaveLength(0);
        if (cancel) {
          const list = source.parentElement!;
          const bounds = vi.spyOn(list,"getBoundingClientRect");
          try {
            for (let index = 0; index < 120; index++) grip.dispatchEvent(new PointerEvent("pointermove", {
              pointerId, isPrimary:true, bubbles:true, clientY: targetStart.bottom - 3 + index / 120,
            }));
            expect(bounds).not.toHaveBeenCalled();
            await waitFor(() => expect(bounds).toHaveBeenCalledTimes(1));
          } finally { bounds.mockRestore(); }
          await userEvent.keyboard("{Escape}");
          expect(source.getBoundingClientRect().top).toBeCloseTo(start.top, 1);
          expect(target.getBoundingClientRect().top).toBeCloseTo(targetStart.top, 1);
        }
      } finally { await commands.releaseLeftMouseButton(); }
    }
    await waitFor(() => expect(fixture.writes).toHaveLength(1));
    expect(source.hasAttribute("data-dragging")).toBe(false);
    expect(getComputedStyle(name).borderRadius).toBe("8px");
    expect(source.getBoundingClientRect().top).toBeCloseTo(targetStart.bottom - start.height, 1);
    finishSave();
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
  } finally { finishSave(); fixture.release(); }
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
      await waitFor(() => expect(grip.hasAttribute("aria-disabled")).toBe(false));
      const row = grip.closest(".note-property-row")!;
      const neighbor = (direction === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling)!.getAttribute("data-property-key")!;
      grip.focus();
      await userEvent.keyboard(`{${direction}}`);
      await waitFor(() => expect(fixture.writes).toHaveLength(1));
      await frames();
      expect(document.activeElement).toBe(grip);
      expect(grip).toHaveProperty("disabled", false);
      expect(grip.getAttribute("aria-disabled")).toBe("true");
      await userEvent.keyboard("{ArrowDown}{ArrowUp}");
      await frames();
      expect(fixture.writes).toHaveLength(1);
      expect(document.activeElement).toBe(grip);
      expect(changes).toEqual([]);
      completeSave();
      await waitFor(() => expect(grip.hasAttribute("aria-disabled")).toBe(false));
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
    expect(await canvas.findByRole("button", {name: "编辑标签"})).toHaveProperty("textContent", "空");
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
      expect(getComputedStyle(overlay).backgroundColor).toContain(theme === "dark" ? "0.8" : "0.75");
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


test("minimal Web theme aligns navigation, collections and detail surfaces across breakpoints", async () => {
  await commands.setReducedMotion("reduce");
  const previousHash = location.hash;
  localStorage.clear();
  history.replaceState(null, "", "#/notes");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  let current: AppViewState | undefined;
  const view = render(<WebAppearanceProvider><App preloadEditor={preloadWebEditor} renderView={state => { current = state; return renderWebApp(state); }} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    for (const width of [768, 900, 1024, 1440, 1920]) {
      await page.viewport(width, 1000);
      await waitFor(() => expect(current!.isMobile).toBe(false));
      await canvas.findByRole("button", { name: "打开 今天的手冲记录" });
      await canvas.findByRole("navigation", { name: "顶部导航" });
      const navigation = view.container.querySelector<HTMLElement>(".web-topbar-inner")!;
      const content = view.container.querySelector<HTMLElement>(".web-page-content")!;
      const bounds = navigation.getBoundingClientRect();
      expect(bounds.width).toBeCloseTo(Math.min(1280, width - (width >= 1024 ? 64 : 48)), 1);
      expect(content.getBoundingClientRect().left).toBeCloseTo(bounds.left, 1);
      expect(content.getBoundingClientRect().width).toBeCloseTo(bounds.width, 1);
      const logo = navigation.querySelector("img")!.getBoundingClientRect();
      expect(logo.width).toBe(32); expect(logo.height).toBe(32);
      const recentTags = await canvas.findByRole("tablist", { name: "类型" });
      const tagRows = within(recentTags).getAllByRole("tab").map(button => button.getBoundingClientRect().top);
      expect(new Set(tagRows).size).toBe(1);
      expect(canvas.queryByRole("textbox", { name: "搜索当前视图笔记" })).toBeNull();
      await userEvent.click(canvas.getByRole("button", { name: "打开 今天的手冲记录" }));
      await canvas.findByRole("textbox", { name: "笔记内容" });
      const detail = view.container.querySelector<HTMLElement>(".web-app-main")!.getBoundingClientRect();
      expect(detail.left).toBeCloseTo(bounds.left, 1);
      expect(detail.width).toBeCloseTo(bounds.width, 1);
      expect(view.container.querySelector<HTMLElement>(".web-page-content")!.getBoundingClientRect().width).toBeLessThanOrEqual(720);
      expect(canvas.queryByRole("button", { name: "展开侧栏" })).toBeNull();
      await act(async () => { await current!.onNavigate("notes"); });
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width + 1);
    }
    await page.viewport(390, 844);
    await waitFor(() => expect(current!.isMobile).toBe(true));
    expect(canvas.queryByRole("navigation", { name: "顶部导航" })).toBeNull();
    expect(canvas.getByRole("button", { name: "打开导航" })).toBeVisible();
    const recentTags = await canvas.findByRole("tablist", { name: "类型" });
    expect(recentTags).toBeVisible();
    const tagRows = within(recentTags).getAllByRole("tab").map(button => button.getBoundingClientRect().top);
    expect(new Set(tagRows).size).toBe(1);
    const notes = await canvas.findByRole("list", { name: "笔记列表" });
    for (const width of [390, 700]) {
      await page.viewport(width, 844);
      await waitFor(() => {
        const bounds = notes.getBoundingClientRect();
        expect(bounds.left).toBe(12);
        expect(width - bounds.right).toBe(12);
      });
    }
  } finally { view.unmount(); release(); history.replaceState(null, "", previousHash || "#/"); }
}, 30_000);

if (!inject("uiQualityTouch")) test("desktop notes navigate directly and collection filters support keyboard dismissal", async () => {
  await page.viewport(1440, 900);
  const previousHash = location.hash;
  history.replaceState(null, "", "#/notes");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  const view = render(<WebAppearanceProvider><App preloadEditor={preloadWebEditor} renderView={renderWebApp} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    const nav = within(await canvas.findByRole("navigation", { name: "顶部导航" }));
    const trigger = nav.getByRole("button", { name: "所有笔记" });
    const body = within(document.body);
    await userEvent.hover(trigger);
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    const more = nav.getByRole("button", { name: "更多" });
    await userEvent.hover(more);
    const menu = await body.findByRole("menu", { name: "更多" });
    await userEvent.hover(within(menu).getByRole("menuitem", { name: "设置" }));
    expect(more).toHaveAttribute("aria-expanded", "true");
    await userEvent.hover(trigger);
    await waitFor(() => expect(body.queryByRole("menu")).toBeNull());
    await userEvent.click(nav.getByRole("button", { name: "主页" }));
    await canvas.findByRole("tab", { name: "最近更新", selected: true });
    await userEvent.click(trigger);
    await canvas.findByRole("heading", { name: "所有笔记", level: 1 });
    const filter = canvas.getByRole("button", { name: "筛选笔记" });
    filter.focus();
    await userEvent.keyboard("{Enter}");
    const dialog = await body.findByRole("dialog", { name: "筛选笔记" });
    await userEvent.click(within(dialog).getByRole("button", { name: "有图片" }));
    await userEvent.keyboard("{Escape}");
    await canvas.findByRole("heading", { name: "所有笔记", level: 1 });
    expect(canvas.getByRole("tab", { name: "有图片", selected: true })).toBeVisible();
    await waitFor(() => expect(body.queryByRole("dialog", { name: "筛选笔记" })).toBeNull());
    expect(filter).toHaveFocus();
    expect(canvas.getByRole("button", { name: "清除所有筛选" })).toBeVisible();
    await userEvent.click(trigger);
    await canvas.findByRole("heading", { name: "所有笔记", level: 1 });
    await page.viewport(390, 844);
    await waitFor(() => expect(canvas.queryByRole("navigation", { name: "顶部导航" })).toBeNull());
    expect(filter).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "有图片" }));
    expect(canvas.queryByRole("button", { name: "清除所有筛选" })).toBeNull();
    await userEvent.click(filter);
    const mobileDialog = await body.findByRole("dialog", { name: "筛选笔记" });
    await settlePropertyPopup(mobileDialog);
    expect(getComputedStyle(mobileDialog.querySelector('[data-slot="drawer-header"]')!).padding).toBe("4px 16px");
    expect(getComputedStyle(within(mobileDialog).getByRole("textbox", { name: "搜索筛选标签" })).fontSize).toBe("14px");
    expect(within(mobileDialog).getByRole("button", { name: "关闭筛选" }).closest('[data-mobile-actions]')).not.toBeNull();
    await userEvent.click(within(mobileDialog).getByRole("button", { name: "无标签" }));
    await userEvent.keyboard("{Escape}");
    await canvas.findByRole("button", { name: "视图选项 所有笔记" });
    expect(canvas.getByRole("tab", { name: "无标签", selected: true })).toBeVisible();
    await waitFor(() => expect(body.queryByRole("dialog", { name: "筛选笔记" })).toBeNull());
    expect(filter).toBeVisible();
    await userEvent.click(filter);
    await userEvent.click(within(await body.findByRole("dialog", { name: "筛选笔记" })).getByRole("button", { name: "清除筛选" }));
    await userEvent.click(body.getByRole("button", { name: "完成" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "筛选笔记" })).toBeNull());
    expect(canvas.getByRole("tab", { name: "全部类型", selected: true })).toBeVisible();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(391);
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/");
  }
});

test("drawer inherits semantic tokens in both themes and supports all four directions", async () => {
  await commands.setReducedMotion("reduce");
  await page.viewport(1024, 900);
  for (const mode of ["light", "dark"] as const) {
    for (const direction of ["down", "up", "left", "right"] as const) {
      const view = render(<ThemeScope value={{ mode, style: { "--ui-preview-radius": "8px" } as React.CSSProperties }}>
        <Drawer swipeDirection={direction} showSwipeHandle>
          <DrawerTrigger render={<Button />}>打开抽屉</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>主题抽屉</DrawerTitle><DrawerDescription>验证当前主题与方向。</DrawerDescription></DrawerHeader>
            <span data-drawer-token-probe aria-hidden="true" style={{ position: "absolute", visibility: "hidden", backgroundColor: "var(--color-background-popover)", color: "var(--color-text-primary)", borderRadius: "var(--radius-page)" }} />
            <DrawerFooter><DrawerClose render={<Button />}>完成</DrawerClose></DrawerFooter>
          </DrawerContent>
        </Drawer>
      </ThemeScope>);
      const trigger = within(view.container).getByRole("button", { name: "打开抽屉" });
      await userEvent.click(trigger);
      const dialog = await within(document.body).findByRole("dialog", { name: "主题抽屉" });
      await settlePropertyPopup(dialog);
      const style = getComputedStyle(dialog);
      const probe = getComputedStyle(dialog.querySelector("[data-drawer-token-probe]")!);
      expect(style.backgroundColor).toBe(probe.backgroundColor);
      expect(style.color).toBe(probe.color);
      expect(style.borderRadius).toBe(probe.borderRadius);
      expect(style.transitionDuration).toBe("0s");
      expect(dialog.closest("[data-ui-theme]")?.getAttribute("data-ui-theme")).toBe(mode);
      expect(dialog.getAttribute("data-swipe-direction")).toBe(direction);
      const bounds = dialog.getBoundingClientRect();
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(1024);
      expect(bounds.bottom).toBeLessThanOrEqual(900);
      await userEvent.click(within(dialog).getByRole("button", { name: "完成" }));
      await waitFor(() => expect(dialog.isConnected).toBe(false));
      expect(trigger).toHaveFocus();
      view.unmount();
    }
  }
});

if (!inject("uiQualityTouch")) test("drawer dismisses with a downward swipe and restores focus", async () => {
  await page.viewport(390, 844);
  const view = render(<Drawer showSwipeHandle>
    <DrawerTrigger render={<Button />}>打开滑动抽屉</DrawerTrigger>
    <DrawerContent><DrawerHeader><DrawerTitle>滑动抽屉</DrawerTitle><DrawerDescription>向下滑动关闭。</DrawerDescription></DrawerHeader>
      <div className="h-48 p-4">抽屉内容</div>
      <DrawerFooter><DrawerClose render={<Button />}>关闭</DrawerClose></DrawerFooter>
    </DrawerContent>
  </Drawer>);
  const trigger = within(view.container).getByRole("button", { name: "打开滑动抽屉" });
  await userEvent.click(trigger);
  const dialog = await within(document.body).findByRole("dialog", { name: "滑动抽屉" });
  await settlePropertyPopup(dialog);
  const handle = dialog.querySelector<HTMLElement>('[data-slot="drawer-swipe-handle"]')!;
  const start = handle.getBoundingClientRect();
  await userEvent.hover(handle);
  await commands.pressLeftMouseButton();
  try {
    for (const distance of [30, 80, 160, 240]) await userEvent.hover(document.documentElement, { force: true, position: { x: start.left + start.width / 2, y: start.top + start.height / 2 + distance } });
  } finally { await commands.releaseLeftMouseButton(); }
  await waitFor(() => expect(dialog.isConnected).toBe(false));
  expect(trigger).toHaveFocus();
});

test("tag collection heading keeps a 36px icon background while notes load", async () => {
  await page.viewport(1440, 900);
  const previousHash = location.hash;
  history.replaceState(null, "", "#/notes");
  const fixture = await createWorkspaceFixture();
  const tag = "生活/咖啡";
  let finishQuery!: () => void;
  const pendingQuery = new Promise<void>(resolve => { finishQuery = resolve; });
  const releaseMode = setStorybookClientMode("browser");
  const release = setStorybookRequestHandler(async (operation, params) => {
    if (operation === "queryNotes" && Array.isArray(params.tags) && params.tags.includes(tag)) await pendingQuery;
    return fixture.request(operation, params);
  });
  const view = render(<WebAppearanceProvider><App preloadEditor={preloadWebEditor} renderView={renderWebApp} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    await userEvent.click(await canvas.findByRole("button", { name: /^筛选笔记/ }));
    const dialog = within(await within(document.body).findByRole("dialog", { name: "筛选笔记" }));
    await userEvent.click(await dialog.findByRole("button", { name: `筛选标签 ${tag}` }));
    await userEvent.click(dialog.getByRole("button", { name: "完成" }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
    const heading = await canvas.findByRole("heading", { name: `# ${tag}`, level: 1 });
    const loadingIcon = heading.parentElement!.querySelector("span.web-collection-tag-icon")!;
    const background = (icon: Element) => {
      const { width, height } = icon.getBoundingClientRect();
      const { backgroundClip, backgroundColor, borderRadius } = getComputedStyle(icon);
      return { width, height, backgroundClip, backgroundColor, borderRadius };
    };
    const loadingBackground = background(loadingIcon);
    finishQuery();
    const button = await canvas.findByRole("button", { name: `编辑标签图标 ${tag}` });
    expect(background(button)).toEqual(loadingBackground);
    expect(loadingBackground).toMatchObject({ width: 36, height: 36, backgroundClip: "border-box" });
  } finally {
    view.unmount(); finishQuery(); release(); releaseMode();
    history.replaceState(null, "", previousHash || "#/");
  }
});

for (const mode of ["light", "dark"] as const) for (const width of [390, 1024]) {
  test(`capture suggestions and link properties share compact popup styles at ${width}px in ${mode}`, async () => {
    await page.viewport(width, 900);
    await commands.setReducedMotion("reduce");
    let editor: import("@tiptap/react").Editor | null = null;
    const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme p-4" data-ui-theme={mode}>
      <span data-testid="muted-icon" className="text-secondary" />
      <QuickCapture vaultId={`compact-popups-${width}-${mode}`} rootNotes tags={["设计"]} disabled={false} canImage={false} handle={{ current: null }} onRecorded={() => {}} />
      <RichMarkdownEditor value="验证链接属性" notePath="notes/popup-style.md" disabled={false} onChange={() => {}} onSave={() => {}} onError={() => {}} onEditorReady={value => { editor = value; }} />
    </main></PreviewModeProvider>);
    const canvas = within(view.container), body = within(document.body);
    const entry = canvas.queryByRole("button", {name: "打开快速记录"});
    if (entry) await userEvent.click(entry);
    await userEvent.click(body.getByRole("button", {name: "选择标签"}));
    const picker = await body.findByRole("dialog", {name: "选择标签"});
    expect(getComputedStyle(picker).borderRadius).toBe("12px");
    const option = within(picker).getByRole("button", {name: "设计"});
    expect(getComputedStyle(option).height).toBe("32px");
    expect(getComputedStyle(option).fontWeight).toBe("400");
    expect(getComputedStyle(option.querySelector("svg")!).color).toBe(getComputedStyle(canvas.getByTestId("muted-icon")).color);
    await userEvent.keyboard("{Escape}");
    await userEvent.type(body.getByRole("textbox", {name: "快速输入内容"}), "#设");
    const suggestions = await body.findByRole("group", {name: "标签建议"});
    expect(getComputedStyle(suggestions).borderRadius).toBe("12px");
    for (const button of within(suggestions).getAllByRole("button")) {
      expect(getComputedStyle(button).height).toBe("32px");
      expect(getComputedStyle(button).fontWeight).toBe("400");
    }
    await userEvent.keyboard("{Escape}");
    if (entry) await userEvent.click(body.getByRole("button", {name: "收起快速记录"}));
    await userEvent.click(canvas.getByRole("textbox", {name: "笔记内容"}));
    act(() => { editor!.chain().focus().setTextSelection({from: 1, to: 3}).run(); });
    await userEvent.click(await body.findByRole("button", {name: "链接"}));
    const input = await body.findByRole("textbox", {name: "链接地址"});
    const popup = input.closest<HTMLElement>('[role="dialog"]')!;
    expect(parseFloat(getComputedStyle(popup).borderTopLeftRadius)).toBeCloseTo(width < 768 ? 20.8 : 12, 4);
    if (width >= 768) expect(getComputedStyle(input).height).toBe("32px");
    for (const button of popup.querySelectorAll("button")) expect(getComputedStyle(button).fontWeight).toBe("400");
    await userEvent.click(within(popup).getByRole("button", {name: "取消"}));
  });
}

for (const mode of ["light", "dark"] as const) test(`note inline code uses the translucent tag fill in ${mode}`, async () => {
  const body = '正文 `inline`\n\n<aside data-callout="purple"><p><code>Steering</code></p></aside>\n\n```txt\nblock\n```';
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme" data-ui-theme={mode}>
    <span className="note-tag-pill">默认标签</span>
    <NoteMarkdown body={body} /><NoteMarkdown body={body} compact interactive={false} />
    <RichMarkdownEditor value={body} notePath="notes/inline-code.md" disabled={false} autoFocus={false} onChange={() => {}} onSave={() => {}} onError={() => {}} />
  </main></PreviewModeProvider>);
  const canvas = within(view.container);
  await canvas.findByRole("textbox", {name: "笔记内容"});
  const fill = getComputedStyle(canvas.getByText("默认标签")).backgroundColor;
  expect(fill).not.toBe("rgba(0, 0, 0, 0)");
  const inlineCode = view.container.querySelectorAll(".ui-note-markdown code:not(pre code)");
  expect(inlineCode).toHaveLength(6);
  for (const code of inlineCode) expect(getComputedStyle(code).backgroundColor).toBe(fill);
  const blockCode = view.container.querySelectorAll(".ui-note-markdown pre code");
  expect(blockCode).toHaveLength(3);
  for (const code of blockCode) expect(getComputedStyle(code).backgroundColor).toBe("rgba(0, 0, 0, 0)");
});

for (const mode of ["light", "dark"] as const) test(`checkboxes share 4px corners across controls and note tasks in ${mode}`, async () => {
  await page.viewport(1024, 900);
  const tasks = "- [ ] 未完成\n- [x] 已完成";
  const view = render(<PreviewModeProvider mode={mode}><main className="ui-theme p-4" data-ui-theme={mode}>
    <span data-testid="note-checkbox-outline" style={{ borderColor: "var(--color-border-gray)" }} />
    <Checkbox aria-label="未选复选框" /><Checkbox checked aria-label="已选复选框" />
    <Checkbox indeterminate aria-label="部分选中复选框" /><Checkbox disabled aria-label="禁用复选框" />
    <NoteProperties note={editorNote} tags={[]} canEdit canRead={false} busy={false} onApply={async () => {}} savedProperties={{
      contentHash: editorNote.contentHash, writable: true,
      properties: [{ name: "属性复选框", type: "checkbox", value: false, editable: true }],
    }} />
    <NoteMarkdown body={tasks} /><NoteMarkdown body={tasks} compact interactive={false} />
    <RichMarkdownEditor value={tasks} notePath="notes/checkbox-style.md" disabled={false} onChange={() => {}} onSave={() => {}} onError={() => {}} />
  </main></PreviewModeProvider>);
  const canvas = within(view.container);
  const editor = await canvas.findByRole("textbox", {name: "笔记内容"});
  const controls = view.container.querySelectorAll('[data-slot="checkbox"], .ui-note-markdown input[type="checkbox"], .note-task-indicator');
  expect(controls.length).toBeGreaterThanOrEqual(10);
  for (const control of controls) expect(getComputedStyle(control).borderRadius).toBe("4px");
  const property = getComputedStyle(canvas.getByRole("checkbox", {name: "切换属性 属性复选框"}));
  const task = getComputedStyle(editor.querySelector('input[type="checkbox"]:not(:checked)')!);
  expect(task.borderTopColor).toBe(getComputedStyle(canvas.getByTestId("note-checkbox-outline")).borderTopColor);
  expect(property.borderTopColor).toBe(task.borderTopColor);
  expect(property.borderTopWidth).toBe(task.borderTopWidth);
  expect(task.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(property.backgroundColor).toBe(task.backgroundColor);
});
