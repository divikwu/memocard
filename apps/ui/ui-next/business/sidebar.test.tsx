// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppSidebar, type AppSidebarProps } from "./sidebar";
import { SidebarTreeItem } from "./sidebar-tree-item";
import { Sidebar, SidebarMenu, SidebarProvider } from "../components/sidebar";

const vaultId = "ui-next-sidebar-test";
const preferencesKey = `memocard:tags:${vaultId}`;
const tags = [{ name: "项目", count: 8 }, { name: "项目/MemoCard", count: 5 }, { name: "生活", count: 3 }];
const props = (): AppSidebarProps => ({ view: "notes", tag: null, tags, vaultName: "我的笔记", vaultId, registeredVaults: [{ vaultId, name: "我的笔记", active: true }, { vaultId: "other", name: "工作笔记", active: false }], connected: true, canTrash: true, vaultStatusText: "已连接", hasVaultIssue: false, canCreate: true, canChooseVault: true, canCreateVault: true, needsPermission: true, working: false, filterCounts: { untagged: 2, images: 4, links: 6 }, onNavigate: vi.fn(), onNewNote: vi.fn(), onSearch: vi.fn(), onSelectVault: vi.fn(), onActivateVault: vi.fn(), onReauthorize: vi.fn(), onRenameTag: vi.fn(async () => {}) });

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn((query: string) => ({ matches: query.includes("max-width") && window.innerWidth < 768, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })) });
  localStorage.removeItem(preferencesKey);
});
afterEach(() => { cleanup(); localStorage.removeItem(preferencesKey); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mount(overrides: Partial<AppSidebarProps> = {}) {
  const args = { ...props(), ...overrides };
  render(<SidebarProvider keyboardShortcut={false} persistState={false}><AppSidebar {...args} /></SidebarProvider>);
  return args;
}

it("keeps selection and expansion independent and supports keyboard row selection", async () => {
  const user = userEvent.setup();
  const select = vi.fn();
  render(<SidebarProvider keyboardShortcut={false} persistState={false}><Sidebar collapsible="none"><SidebarMenu><SidebarTreeItem label="项目" icon="#" isActive={false} defaultOpen={false} buttonProps={{ onClick: select }}><span>子标签</span></SidebarTreeItem></SidebarMenu></Sidebar></SidebarProvider>);
  await user.click(screen.getByRole("button", { name: "展开或收起 项目" }));
  expect(select).not.toHaveBeenCalled();
  expect(screen.getByText("子标签")).not.toBeNull();
  const row = screen.getByRole("button", { name: "项目" });
  row.focus();
  await user.keyboard("{Enter}");
  expect(select).toHaveBeenCalledTimes(1);
});

it("preserves note filters, counts, tag navigation and creation/search entry callbacks", async () => {
  const user = userEvent.setup();
  const args = mount();
  await user.click(screen.getByRole("button", { name: "展开或收起快捷筛选" }));
  const images = screen.getByRole("button", { name: "有图片" });
  expect(images.getAttribute("aria-description")).toBe("4 条笔记");
  await user.click(images);
  expect(args.onNavigate).toHaveBeenLastCalledWith("notes", null, "images");
  await user.click(screen.getByRole("button", { name: "项目/MemoCard" }));
  expect(args.onNavigate).toHaveBeenLastCalledWith("notes", "项目/MemoCard", undefined);
  await user.click(screen.getByRole("button", { name: "搜索" }));
  await user.click(screen.getByRole("button", { name: "新建笔记" }));
  expect(args.onSearch).toHaveBeenCalledTimes(1);
  expect(args.onNewNote).toHaveBeenCalledTimes(1);
});

it("keeps the Sidebar-10 business mapping: brand and primary navigation above tags, vault at the footer", () => {
  mount();
  const brand = screen.getByRole("button", { name: "MemoCard，返回主页" });
  expect(brand.querySelector("img")?.getAttribute("src")).toBe("./favicon.png");
  expect(brand.querySelector("img")?.getAttribute("alt")).toBe("");
  expect(brand.closest('[data-sidebar="header"]')).not.toBeNull();
  const nav = screen.getByRole("navigation", { name: "主要导航" });
  expect(within(nav).getAllByRole("button").map(button => button.textContent)).toEqual(["搜索", "新建笔记", "主页", "所有笔记", "", "日历"]);
  expect(screen.getByRole("navigation", { name: "标签" }).closest('[data-sidebar="content"]')).not.toBeNull();
  expect(screen.getByRole("button", { name: "笔记库：我的笔记" }).closest('[data-sidebar="footer"]')).not.toBeNull();
});

it("filters the tag tree by full path and uses existing tag preference storage for pinning", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "标签操作 项目" }));
  await user.click(await screen.findByRole("menuitem", { name: "置顶标签" }));
  const pinned = await screen.findByRole("navigation", { name: "置顶标签" });
  expect(within(pinned).getByRole("button", { name: "项目" })).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(preferencesKey) || "{}").pinned).toEqual(["项目"]);
  await user.click(screen.getByRole("button", { name: "搜索标签" }));
  await user.type(screen.getByRole("textbox", { name: "搜索标签" }), "memocard");
  const tagList = screen.getByRole("navigation", { name: "标签" });
  expect(within(tagList).getByRole("button", { name: "项目/MemoCard" })).not.toBeNull();
  expect(within(tagList).queryByRole("button", { name: "生活" })).toBeNull();
});

it("edits tag name and icon through the existing rename callback and preference mapping", async () => {
  const user = userEvent.setup();
  localStorage.setItem(preferencesKey, JSON.stringify({ pinned: ["项目/MemoCard"], icons: { "项目/MemoCard": "🎨" } }));
  const args = mount();
  const tagList = screen.getByRole("navigation", { name: "标签" });
  await user.click(within(tagList).getByRole("button", { name: "标签操作 项目/MemoCard" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  const dialog = await screen.findByRole("dialog", { name: "编辑标签" });
  const name = within(dialog).getByRole("textbox", { name: "标签名称" });
  await user.clear(name);
  await user.type(name, "项目/设计");
  await user.click(within(dialog).getByRole("button", { name: "选择 Emoji" }));
  await user.click(within(dialog).getByRole("button", { name: "清除图标" }));
  await user.click(within(dialog).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标签" })).toBeNull());
  expect(args.onRenameTag).toHaveBeenCalledWith("项目/MemoCard", "项目/设计");
  const saved = JSON.parse(localStorage.getItem(preferencesKey) || "{}");
  expect(saved.pinned).toEqual(["项目/设计"]);
  expect(saved.icons["项目/设计"]).toBe("");
  expect(saved.icons["项目/MemoCard"]).toBeUndefined();
});

it("keeps failed rename drafts open and does not write appearance preferences", async () => {
  const user = userEvent.setup();
  mount({ onRenameTag: vi.fn(async () => { throw new Error("标签名称已存在"); }) });
  await user.click(screen.getByRole("button", { name: "标签操作 生活" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  const dialog = await screen.findByRole("dialog", { name: "编辑标签" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "标签名称" }), { target: { value: "工作" } });
  await user.click(within(dialog).getByRole("button", { name: "保存" }));
  expect((await screen.findByRole("alert")).textContent).toBe("标签名称已存在");
  expect((within(dialog).getByRole("textbox", { name: "标签名称" }) as HTMLInputElement).value).toBe("工作");
  expect(localStorage.getItem(preferencesKey)).toBeNull();
});

it("keeps ordinary Emoji search Enter inside the picker without saving the tag", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole("button", { name: "标签操作 生活" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  const dialog = await screen.findByRole("dialog", { name: "编辑标签" });
  await user.click(within(dialog).getByRole("button", { name: "选择 Emoji" }));
  const search = within(dialog).getByRole("textbox", { name: "搜索 Emoji" });
  await user.type(search, "警告{Enter}");
  expect(screen.queryByRole("dialog", { name: "编辑标签" })).toBe(dialog);
  expect(localStorage.getItem(preferencesKey)).toBeNull();
  expect(within(dialog).getByRole("button", { name: "警告、小心" })).not.toBeNull();
});

it("focuses the anchored editor and discards unsaved name and Emoji changes on outside dismissal", async () => {
  const user = userEvent.setup();
  const args = mount();
  await user.click(screen.getByRole("button", { name: "标签操作 生活" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  const dialog = await screen.findByRole("dialog", { name: "编辑标签" });
  const name = within(dialog).getByRole("textbox", { name: "标签名称" });
  await waitFor(() => expect(document.activeElement).toBe(name));
  await user.clear(name);
  await user.type(name, "工作");
  await user.click(within(dialog).getByRole("button", { name: "选择 Emoji" }));
  const search = within(dialog).getByRole("textbox", { name: "搜索 Emoji" });
  await waitFor(() => expect(document.activeElement).toBe(search));
  await user.type(search, "🧑🏽‍💻{Enter}");
  expect(within(dialog).getByRole("button", { name: "选择 Emoji" }).textContent).toBe("🧑🏽‍💻");
  await user.click(screen.getByRole("button", { name: /^主页$/ }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标签" })).toBeNull());
  expect(args.onRenameTag).not.toHaveBeenCalled();
  expect(localStorage.getItem(preferencesKey)).toBeNull();
});

it("protects an anchored rename from Escape and outside dismissal while saving", async () => {
  const user = userEvent.setup();
  let complete!: () => void;
  const rename = vi.fn(() => new Promise<void>(resolve => { complete = resolve; }));
  mount({ onRenameTag: rename });
  await user.click(screen.getByRole("button", { name: "标签操作 生活" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  const dialog = await screen.findByRole("dialog", { name: "编辑标签" });
  const name = within(dialog).getByRole("textbox", { name: "标签名称" });
  fireEvent.change(name, { target: { value: "工作" } });
  await user.click(within(dialog).getByRole("button", { name: "保存" }));
  expect(name).toHaveProperty("disabled", true);
  await user.click(within(dialog).getByRole("button", { name: "保存中…" }));
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: /^主页$/ }));
  expect(screen.getByRole("dialog", { name: "编辑标签" })).toBe(dialog);
  expect(rename).toHaveBeenCalledTimes(1);
  complete();
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标签" })).toBeNull());
  expect(rename).toHaveBeenCalledWith("生活", "工作");
});

it("does not announce zero note counts before optional quick filter counts have loaded", async () => {
  const user = userEvent.setup();
  mount({ filterCounts: undefined });
  await user.click(screen.getByRole("button", { name: "展开或收起快捷筛选" }));
  expect(screen.getByRole("button", { name: "有图片" }).getAttribute("aria-description")).toBeNull();
  expect(screen.getByRole("button", { name: "有图片" }).parentElement?.querySelector('[data-sidebar="menu-badge"]')).toBeNull();
});

it("returns keyboard focus to the renamed tag when its original trigger is replaced", async () => {
  const user = userEvent.setup();
  function RenamingSidebar() {
    const [items, setItems] = useState(tags);
    return <SidebarProvider keyboardShortcut={false} persistState={false}><AppSidebar {...props()} tags={items} onRenameTag={async (from, to) => setItems(current => current.map(item => ({ ...item, name: item.name === from ? to : item.name })))} /></SidebarProvider>;
  }
  render(<RenamingSidebar />);
  await user.click(screen.getByRole("button", { name: "标签操作 生活" }));
  await user.click(await screen.findByRole("menuitem", { name: "编辑名称/图标" }));
  const dialog = await screen.findByRole("dialog", { name: "编辑标签" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "标签名称" }), { target: { value: "工作" } });
  await user.click(within(dialog).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "工作" })));
});

it("retains vault switching and management actions while respecting capability and busy flags", async () => {
  const user = userEvent.setup();
  const args = mount();
  const open = async () => { await user.click(screen.getByRole("button", { name: "笔记库：我的笔记" })); return screen.findByRole("menu"); };
  await open();
  await user.click(screen.getByRole("menuitem", { name: "工作笔记" }));
  expect(args.onActivateVault).toHaveBeenCalledWith("other");
  await open(); await user.click(screen.getByRole("menuitem", { name: "打开已有笔记库" }));
  expect(args.onSelectVault).toHaveBeenCalledWith(false);
  await open(); await user.click(screen.getByRole("menuitem", { name: "创建新笔记库" }));
  expect(args.onSelectVault).toHaveBeenCalledWith(true);
  await open(); await user.click(screen.getByRole("menuitem", { name: "重新授权文件夹" }));
  expect(args.onReauthorize).toHaveBeenCalledTimes(1);
  await open(); await user.click(screen.getByRole("menuitem", { name: "回收站" }));
  expect(args.onNavigate).toHaveBeenLastCalledWith("trash", undefined, undefined);
  cleanup();
  const busy = mount({ working: true, canTrash: false });
  await open();
  const create = screen.getByRole("menuitem", { name: "创建新笔记库" });
  expect(create.getAttribute("aria-disabled")).toBe("true");
  await user.click(create);
  expect(busy.onSelectVault).not.toHaveBeenCalled();
  expect(screen.getByRole("menuitem", { name: "回收站" }).getAttribute("aria-disabled")).toBe("true");
});

it("supports a controlled H5 drawer, closes on navigation and exposes the vault bottom sheet", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  const user = userEvent.setup();
  const args = props();
  const change = vi.fn();
  function Mobile() {
    const [open, setOpen] = useState(true);
    return <SidebarProvider keyboardShortcut={false} persistState={false} openMobile={open} onOpenMobileChange={next => { change(next); setOpen(next); }}><AppSidebar {...args} /></SidebarProvider>;
  }
  render(<Mobile />);
  const drawer = await screen.findByRole("dialog", { name: "笔记导航" });
  expect(drawer.classList.contains("next-business-sidebar")).toBe(true);
  expect(within(drawer).queryByRole("button", { name: "搜索" })).toBeNull();
  expect(within(drawer).queryByRole("button", { name: "新建笔记" })).toBeNull();
  expect(within(drawer).queryByRole("button", { name: "关闭笔记导航" })).toBeNull();
  expect(within(drawer).queryByRole("button", { name: "标签操作 项目" })).toBeNull();
  await user.click(within(drawer).getByRole("button", { name: "笔记库：我的笔记" }));
  const vaultSheet = await screen.findByRole("dialog", { name: "笔记库" });
  await user.click(within(vaultSheet).getByRole("button", { name: "创建新笔记库" }));
  expect(args.onSelectVault).toHaveBeenCalledWith(true);
  expect(change).toHaveBeenCalledWith(false);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
