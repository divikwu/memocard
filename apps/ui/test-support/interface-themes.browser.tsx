import { afterEach, expect, test } from "vitest";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { page, userEvent } from "vitest/browser";
import { App, type AppViewState } from "../src/App";
import { WebAppearanceProvider, WebPaletteStyles } from "../ui/web/WebAppearance";
import { AppearanceCatalogProvider } from "../ui/web/appearance/AppearanceRuntime";
import { preloadWebEditor, renderWebApp } from "../ui/web/WebAppView";
import { createWorkspaceFixture } from "../ui/web/workspace-fixture";
import { appearanceFixture } from "../ui-state-fixtures/appearance-fixture";
import { setStorybookRequestHandler } from "./bridge";
import { ThemeScope, useThemeScopeProps, type ThemeScopeValue } from "../ui/components/theme-scope";
import { PreviewModeProvider } from "../ui/preview-mode";
import { Button } from "../ui/components/button";
import { TooltipHints } from "../ui/components/tooltip";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../ui/components/popover";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Dialog, DialogContent, DialogTitle } from "../ui/components/dialog";
import { RichMarkdownEditor } from "../ui/business/RichMarkdownEditor";
import { PropertyOptionMenu } from "../ui/business/property-editors";
import { NoteProperties } from "../ui/business/NoteProperties";
import { editorNote } from "./editor-note";
import { Sheet, SheetContent, SheetTitle } from "../ui/components/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/components/dropdown-menu";
import "../.storybook/preview.css";

afterEach(cleanup);

function ScopeRoot({ children }: { children: ReactNode }) {
  return <div {...useThemeScopeProps()}>{children}</div>;
}
function ScopedPopover({ name, value }: { name: string; value: ThemeScopeValue }) {
  return <ThemeScope value={value}><ScopeRoot><span data-probe={name} style={{ backgroundColor: "var(--color-accent)" }}>{name}</span>
    <Popover open><PopoverTrigger render={<Button />}>{name}入口</PopoverTrigger><PopoverContent aria-label={name}><PopoverTitle>{name}</PopoverTitle><span data-popup-probe={name} style={{ backgroundColor: "var(--color-accent)" }}>配色</span></PopoverContent></Popover>
  </ScopeRoot></ThemeScope>;
}

test("interface theme scopes isolate light/dark palettes across independent stable portal roots", async () => {
  const fixture = (palette: string) => <PreviewModeProvider mode="dark"><WebPaletteStyles value={{ palette: "blue", neutralPalette: "slate" }} />
    <ScopedPopover name="浅色局部" value={{ mode: "light", palette, neutral: "neutral", themeId: "classic" }} />
    <ScopedPopover name="深色局部" value={{ mode: "dark", palette: "lime", neutral: "slate", themeId: "minimal" }} />
  </PreviewModeProvider>;
  const view = render(fixture("blue"));
  const left = await within(document.body).findByRole("dialog", { name: "浅色局部" });
  const right = await within(document.body).findByRole("dialog", { name: "深色局部" });
  const leftPortal = left.closest("[data-appearance-scope]")!;
  const rightPortal = right.closest("[data-appearance-scope]")!;
  const source = (name: string) => getComputedStyle(view.container.querySelector(`[data-probe="${name}"]`)!).backgroundColor;
  const popup = (name: string) => getComputedStyle(document.querySelector(`[data-popup-probe="${name}"]`)!).backgroundColor;
  await waitFor(() => {
    expect(popup("浅色局部")).toBe(source("浅色局部"));
    expect(popup("深色局部")).toBe(source("深色局部"));
    expect(popup("浅色局部")).not.toBe(popup("深色局部"));
    expect(getComputedStyle(left).backgroundColor).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(right).backgroundColor).not.toBe("rgb(255, 255, 255)");
  });
  const previous = popup("浅色局部");
  view.rerender(fixture("green"));
  await waitFor(() => expect(popup("浅色局部")).not.toBe(previous));
  expect(left.closest("[data-appearance-scope]")).toBe(leftPortal);
  expect(right.closest("[data-appearance-scope]")).toBe(rightPortal);
  expect(popup("浅色局部")).toBe(source("浅色局部"));
});

test("minimal theme aligns visible page titles with the all-notes heading", async () => {
  await page.viewport(1440, 1000);
  const previousHash = location.hash;
  const appearanceKey = "memocard-web-appearance-v1";
  const previousAppearance = localStorage.getItem(appearanceKey);
  localStorage.setItem(appearanceKey, JSON.stringify({ interfaceTheme: "minimal" }));
  history.replaceState(null, "", "#/notes");
  const fixture = await createWorkspaceFixture();
  const release = setStorybookRequestHandler(fixture.request);
  let current!: AppViewState;
  const view = render(<WebAppearanceProvider><App preloadEditor={preloadWebEditor} renderView={state => { current = state; return renderWebApp(state); }} /></WebAppearanceProvider>);
  try {
    const canvas = within(view.container);
    await canvas.findByRole("navigation", { name: "顶部导航" });
    const typography = (title: HTMLElement) => {
      const { fontFamily, fontSize, fontWeight, lineHeight } = getComputedStyle(title);
      return { fontFamily, fontSize, fontWeight, lineHeight };
    };
    const baseline = typography(await canvas.findByRole("heading", { name: "所有笔记", level: 1 }));
    expect(baseline).toMatchObject({ fontSize: "30px", fontWeight: "600", lineHeight: "42px" });
    for (const [route, name] of [["tags", "标签"], ["settings", "设置"], ["trash", "回收站"]] as const) {
      await act(async () => { await current.onNavigate(route); });
      expect(typography(await canvas.findByRole("heading", { name, level: 1 }))).toEqual(baseline);
    }
    await act(async () => { await current.onNavigate("notes"); });
    await userEvent.click(await canvas.findByRole("button", { name: "打开 今天的手冲记录" }));
    const noteTitle = await canvas.findByRole("textbox", { name: "页面标题" });
    expect(typography(noteTitle)).toEqual(baseline);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: appearanceKey, newValue: JSON.stringify({ interfaceTheme: "classic" }), storageArea: localStorage })));
    await waitFor(() => expect(typography(noteTitle).fontSize).toBe("32px"));
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/");
    if (previousAppearance === null) localStorage.removeItem(appearanceKey);
    else localStorage.setItem(appearanceKey, previousAppearance);
  }
});

test("interface theme fixture extends CSS and layout independently without replacing the editor", async () => {
  const previousHash = location.hash;
  const appearanceKey = "memocard-web-appearance-v1";
  const previousAppearance = localStorage.getItem(appearanceKey);
  localStorage.setItem(appearanceKey, JSON.stringify({ interfaceTheme: "minimal" }));
  history.replaceState(null, "", "#/notes");
  await page.viewport(1440, 1000);
  const fixture = await createWorkspaceFixture(); const release = setStorybookRequestHandler(fixture.request);
  let current!: AppViewState;
  const view = render(<AppearanceCatalogProvider catalog={appearanceFixture}><WebAppearanceProvider><App preloadEditor={preloadWebEditor} renderView={state => { current = state; return renderWebApp(state); }} /></WebAppearanceProvider></AppearanceCatalogProvider>);
  try {
    const canvas = within(view.container);
    const navigation = await canvas.findByRole("navigation", { name: "顶部导航" }, { timeout: 5000 });
    const logo = canvas.getByRole("button", { name: "MemoCard，返回主页" }).querySelector("img")!;
    expect(logo.getBoundingClientRect()).toMatchObject({ width: 32, height: 32 });
    await userEvent.click(await canvas.findByRole("button", { name: "打开 今天的手冲记录" }));
    const editor = await canvas.findByRole("textbox", { name: "笔记内容" });
    const change = async (interfaceTheme: string) => {
      act(() => window.dispatchEvent(new StorageEvent("storage", { key: appearanceKey, newValue: JSON.stringify({ interfaceTheme }), storageArea: localStorage })));
      await waitFor(() => expect(view.container.querySelector(".web-app")).toHaveAttribute("data-interface-theme", interfaceTheme));
    };
    await change("paper");
    expect(canvas.getByRole("textbox", { name: "笔记内容" })).toBe(editor);
    expect(canvas.getByRole("navigation", { name: "顶部导航" })).toBe(navigation);
    const paperLogo = canvas.getByRole("button", { name: "MemoCard，返回主页" }).querySelector("img")!;
    expect(paperLogo.getBoundingClientRect()).toMatchObject({ width: 28, height: 28 });
    const navigationBounds = view.container.querySelector(".web-topbar-inner")!.getBoundingClientRect();
    const detailBounds = view.container.querySelector(".web-app-shell")!.getBoundingClientRect();
    expect(navigationBounds.width).toBe(1024);
    expect(detailBounds.width).toBe(navigationBounds.width);
    expect(detailBounds.left).toBe(navigationBounds.left);
    await userEvent.click(within(navigation).getByRole("button", { name: "标签" }));
    const tags = await within(document.body).findByRole("dialog", { name: "浏览标签" });
    expect(getComputedStyle(tags).paddingLeft).toBe("10px");
    await change("minimal");
    await change("paper");
    expect(within(navigation).getByRole("button", { name: "标签" })).toHaveAttribute("aria-expanded", "false");
    expect(within(document.body).queryByRole("dialog", { name: "浏览标签" })).toBeNull();
    await act(async () => { await current.onNavigate("notes"); });
    await canvas.findByRole("heading", { name: "所有笔记", level: 1 });
    const collectionBounds = view.container.querySelector(".web-page-content")!.getBoundingClientRect();
    expect(collectionBounds.width).toBe(navigationBounds.width);
    expect(collectionBounds.left).toBe(navigationBounds.left);
    await userEvent.click(await canvas.findByRole("button", { name: "打开 今天的手冲记录" }));
    await canvas.findByRole("textbox", { name: "笔记内容" });
    const reopenedEditor = canvas.getByRole("textbox", { name: "笔记内容" });
    const reopenedHash = location.hash;
    await change("experimental");
    await canvas.findByRole("navigation", { name: "测试布局" });
    expect(canvas.getByRole("textbox", { name: "笔记内容" })).toBe(reopenedEditor);
    expect(location.hash).toBe(reopenedHash);
    await page.viewport(390, 844);
    await waitFor(() => expect(current.isMobile).toBe(true));
    await waitFor(() => expect(view.container.querySelector(".web-app")).toHaveAttribute("data-workspace-layout", "drawer"));
    expect(view.container.querySelector(".web-app")).toHaveAttribute("data-interface-theme", "experimental");
    expect(canvas.getByRole("textbox", { name: "笔记内容" })).toBe(reopenedEditor);
  } finally {
    view.unmount(); release(); history.replaceState(null, "", previousHash || "#/");
    if (previousAppearance === null) localStorage.removeItem(appearanceKey);
    else localStorage.setItem(appearanceKey, previousAppearance);
  }
}, 30_000);


test("real editor menus and property confirmation inherit a local dialog scope", async () => {
  await appearanceFixture.themes.paper.loadStyles();
  await page.viewport(1024, 900);
  let editor!: Editor;
  const view = render(<PreviewModeProvider mode="light"><ThemeScope value={{ themeId: "paper", palette: "green", neutral: "slate" }}>
    <Dialog open><DialogContent data-ui-theme="dark"><DialogTitle>局部编辑器</DialogTitle>
      <span data-testid="local-delete-color" style={{ color: "var(--color-icon-red)" }} />
      <RichMarkdownEditor value="A scoped paragraph" notePath="scope.md" disabled={false} onChange={() => {}} onSave={() => {}} onError={() => {}} onEditorReady={value => { if (value) editor = value; }} />
      <PropertyOptionMenu name="测试" kind="标签" color="default" disabled={false} normalizeName={name => name} onChangeName={async () => {}} onChangeColor={() => {}} deleteDescription="作用域确认" />
    </DialogContent></Dialog>
  </ThemeScope></PreviewModeProvider>);
  const body = within(document.body);
  try {
    const content = await body.findByRole("textbox", { name: "笔记内容" });
    await userEvent.click(content);
    act(() => { editor.chain().focus().setTextSelection(1).run(); });
    await userEvent.click(body.getByRole("button", { name: "内容块操作" }));
    const menu = await body.findByRole("menu", { name: "内容块操作菜单" });
    expect(getComputedStyle(menu).borderRadius).toBe("12px");
    for (const item of menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')) {
      expect(getComputedStyle(item).height).toBe("32px");
      expect(getComputedStyle(item).fontWeight).toBe("400");
    }
    const scope = menu.closest("[data-appearance-scope]")!;
    expect(scope.getAttribute("data-ui-theme")).toBe("dark");
    expect(scope.getAttribute("data-interface-theme")).toBe("paper");
    expect(scope.getAttribute("data-web-palette")).toBe("green");
    expect(getComputedStyle(menu).getPropertyValue("--workspace-menu-padding").trim()).toBe("10px");
    expect(getComputedStyle(menu).backgroundColor).not.toBe("rgb(255, 255, 255)");
    const deleteBlock = within(menu).getByRole("menuitem", { name: "删除" });
    const deleteColor = getComputedStyle(body.getByTestId("local-delete-color")).color;
    expect(getComputedStyle(deleteBlock).color).toBe(deleteColor);
    expect(getComputedStyle(deleteBlock.querySelector("svg")!).color).toBe(deleteColor);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(body.getByRole("button", { name: "管理标签 测试" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "删除标签" }));
    const confirmation = await body.findByRole("alertdialog");
    const confirmationScope = confirmation.closest("[data-appearance-scope]")!;
    expect(confirmationScope.getAttribute("data-ui-theme")).toBe("dark");
    expect(confirmationScope.getAttribute("data-interface-theme")).toBe("paper");
    // Nested AlertDialog intentionally shares its parent Dialog backdrop.
    expect(document.querySelector('[data-slot="dialog-overlay"]')?.closest("[data-appearance-scope]")?.getAttribute("data-ui-theme")).toBe("dark");
    expect(getComputedStyle(confirmation).backgroundColor).not.toBe("rgb(255, 255, 255)");
    await userEvent.click(within(confirmation).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(body.queryByRole("alertdialog")).toBeNull());
    expect(body.getByRole("dialog", { name: "局部编辑器" })).toBeVisible();
    expect(body.getByRole("textbox", { name: "笔记内容" })).toBe(content);
  } finally { view.unmount(); }
}, 30_000);


for (const local of ["light", "dark"] as const) test(`local ${local} interaction colors ignore the opposite document mode`, async () => {
  const parent = local === "light" ? "dark" : "light";
  await page.viewport(1024, 900);
  const view = render(<PreviewModeProvider mode={parent}><ThemeScope value={{ mode: parent, themeId: "classic", palette: "blue", neutral: "neutral" }}><TooltipHints>
    <Dialog open><DialogContent data-ui-theme={local}><DialogTitle>独立明暗</DialogTitle>
      <Button variant="outline" data-ui-tooltip="作用域提示">提示目标</Button>
      <DropdownMenu><DropdownMenuTrigger render={<Button />}>局部菜单</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>局部操作</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      <span data-testid="expected-tooltip-color" style={{ color: local === "light" ? "var(--color-on-dark)" : "var(--color-on-light)" }} />
      <span data-testid="expected-menu-color" style={{ color: local === "light" ? "var(--color-text-accent)" : "var(--color-text-primary)" }} />
    </DialogContent></Dialog>
  </TooltipHints></ThemeScope></PreviewModeProvider>);
  const body = within(document.body);
  const button = await body.findByRole("button", { name: "提示目标" });
  const resting = getComputedStyle(button).backgroundColor;
  if (local === "light") expect(resting).not.toBe("rgba(0, 0, 0, 0)");
  else expect(resting).toBe("rgba(0, 0, 0, 0)");
  await userEvent.hover(button);
  const tooltip = await body.findByRole("tooltip");
  expect(tooltip.closest("[data-appearance-scope]")?.getAttribute("data-ui-theme")).toBe(local);
  expect(getComputedStyle(tooltip).color).toBe(getComputedStyle(body.getByTestId("expected-tooltip-color")).color);
  await userEvent.click(body.getByRole("button", { name: "局部菜单" }));
  const item = await body.findByRole("menuitem", { name: "局部操作" });
  item.focus();
  await waitFor(() => expect(getComputedStyle(item).color).toBe(getComputedStyle(body.getByTestId("expected-menu-color")).color));
  view.unmount();
});

test("delegated sheet hints retain inherited font inputs and follow a live layout change", async () => {
  await page.viewport(1024, 900);
  const fixture = (layoutId: string) => <PreviewModeProvider mode="light"><ThemeScope value={{ mode: "light", themeId: "classic", layoutId, style: { "--ui-preview-body": "Arial", "--ui-preview-heading": "Arial", "--ui-preview-radius": "8px" } as React.CSSProperties }}><TooltipHints>
    <ThemeScope value={{ style: { "--ui-preview-body": "monospace", "--ui-preview-heading": "monospace", "--ui-preview-radius": "22px" } as React.CSSProperties }}>
      <Sheet open><SheetContent style={{ bottom: 0 }}><SheetTitle>独立字体</SheetTitle><Button data-ui-tooltip="继承字体提示">Sheet 提示目标</Button></SheetContent></Sheet>
    </ThemeScope>
  </TooltipHints></ThemeScope></PreviewModeProvider>;
  const view = render(fixture("sidebar"));
  const target = await within(document.body).findByRole("button", { name: "Sheet 提示目标" });
  await userEvent.hover(target);
  const tooltip = await within(document.body).findByRole("tooltip");
  const portal = tooltip.closest("[data-appearance-scope]");
  expect(getComputedStyle(target).fontFamily).toBe("monospace");
  expect(getComputedStyle(tooltip).fontFamily).toBe("monospace");
  view.rerender(fixture("drawer"));
  await waitFor(() => expect(portal?.getAttribute("data-workspace-layout")).toBe("drawer"));
  expect(tooltip.closest("[data-appearance-scope]")).toBe(portal);
});

for (const mode of ["light", "dark"] as const) test(`property selector header follows its local ${mode} scope inside the opposite global mode`, async () => {
  await page.viewport(1280, 900);
  const release = setStorybookRequestHandler(async operation => {
    if (operation === "getStatus") return { vaultId: "property-theme-scope", capabilities: [] };
    if (operation === "getPropertyLabels") return { labels: {}, contentHash: "labels" };
    if (operation === "getPropertyLayout") return { order: [], visibility: {}, contentHash: "layout" };
    if (operation === "listTags") return { tags: [] };
    throw new Error(`Unexpected property theme operation: ${operation}`);
  });
  const view = render(<PreviewModeProvider mode={mode === "light" ? "dark" : "light"}><ThemeScope value={{ mode }}><ScopeRoot>
    <main style={{ maxWidth: 720, marginInline: "auto", padding: 60 }}>
      <span data-testid="expected-header" style={{ backgroundColor: `var(--color-neutral-${mode === "light" ? "100" : "900"})` }}>局部主题</span>
      <NoteProperties note={editorNote} tags={[]} canEdit busy={false} savedProperties={{ contentHash: editorNote.contentHash, writable: true, tagProperty: { name: "tags", type: "list", value: ["现有"], editable: true }, properties: [] }} onApply={async () => { throw new Error("Opening must not save"); }} />
    </main>
  </ScopeRoot></ThemeScope></PreviewModeProvider>);
  try {
    await userEvent.click(await within(view.container).findByRole("button", { name: "编辑标签" }));
    const popup = await within(document.body).findByRole("dialog", { name: "编辑标签" });
    await within(popup).findByRole("combobox");
    expect(getComputedStyle(popup.closest('[data-appearance-scope]')!).colorScheme).toBe(mode);
    expect(getComputedStyle(popup.querySelector('.note-tag-editor')!).backgroundColor).toBe(getComputedStyle(within(view.container).getByTestId("expected-header")).backgroundColor);
  } finally { view.unmount(); release(); }
});
