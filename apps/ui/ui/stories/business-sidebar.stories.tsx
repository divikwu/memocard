import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AppSidebar, type AppSidebarProps } from "../business/sidebar";
import { SidebarTreeItem } from "../business/sidebar-tree-item";
import { SidebarIcon } from "../business/sidebar-icons";
import { usePreviewMode } from "../preview-mode";
import { Button } from "../components/button";
import { Sidebar, SidebarMenu, SidebarProvider, SidebarTrigger } from "../components/sidebar";

const tags = [{ name: "项目", count: 16 }, { name: "项目/MemoCard", count: 9 }, { name: "项目/MemoCard/设计系统", count: 4 }, { name: "项目/阅读", count: 7 }, { name: "生活", count: 8 }, { name: "生活/旅行", count: 3 }, { name: "灵感", count: 6 }];
const meta = {
  title: "business/sidebar",
  id: "ui-business-sidebar",
  component: AppSidebar,
  parameters: { layout: "fullscreen", docs: { description: { component: "当前 token 和组件构建的导航业务层。保留标签树、共享置顶/图标偏好、标签名称编辑和笔记库入口；仅使用隔离示例数据。手机宽度下使用侧滑导航和底部笔记库菜单。" } } },
  args: {
    view: "notes", tag: "项目/MemoCard", tags, vaultName: "我的笔记", vaultId: "ui-sidebar-story", connected: true, canTrash: true,
    registeredVaults: [{ vaultId: "ui-sidebar-story", name: "我的笔记", active: true }, { vaultId: "ui-sidebar-work", name: "工作笔记", active: false }],
    filterCounts: { untagged: 4, images: 7, links: 11 }, vaultStatusText: "已连接", hasVaultIssue: false,
    canCreate: true, canChooseVault: true, canCreateVault: true, needsPermission: false, working: false,
    onNavigate: fn(), onNewNote: fn(), onSearch: fn(), onSelectVault: fn(), onActivateVault: fn(), onReauthorize: fn(), onRenameTag: fn(async () => {}),
  },
  render: args => <SidebarStory {...args} />,
} satisfies Meta<typeof AppSidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

function SidebarStory(args: AppSidebarProps) {
  const mode = usePreviewMode();
  const [location, setLocation] = useState({ view: args.view, tag: args.tag, quickFilter: args.quickFilter });
  const [items, setItems] = useState(args.tags);
  const [notice, setNotice] = useState("");
  const [openMobile, setOpenMobile] = useState(false);
  return <SidebarProvider className="ui-theme sb-unstyled" data-ui-theme={mode} persistState={false} keyboardShortcut={false} openMobile={openMobile} onOpenMobileChange={setOpenMobile}>
    <AppSidebar {...args} {...location} tags={items} onNavigate={(view, tag = null, quickFilter = null) => { args.onNavigate(view, tag, quickFilter); setLocation({ view, tag, quickFilter }); setNotice(""); }} onNewNote={() => { args.onNewNote(); setNotice("新建笔记入口已触发"); }} onSearch={() => { args.onSearch(); setNotice("搜索入口已触发"); }} onSelectVault={create => { args.onSelectVault(create); setNotice(create ? "创建笔记库入口已触发" : "打开笔记库入口已触发"); }} onActivateVault={id => { args.onActivateVault(id); setNotice(`切换笔记库入口已触发：${id}`); }} onReauthorize={() => { args.onReauthorize(); setNotice("重新授权入口已触发"); }} onRenameTag={async (from, to) => { await args.onRenameTag?.(from, to); setItems(current => current.map(tag => ({ ...tag, name: tag.name === from || tag.name.startsWith(`${from}/`) ? to + tag.name.slice(from.length) : tag.name }))); setLocation(current => ({ ...current, tag: current.tag && (current.tag === from || current.tag.startsWith(`${from}/`)) ? to + current.tag.slice(from.length) : current.tag })); }} />
    <main className="min-w-0 flex-1 bg-body p-6"><div className="flex items-center gap-3"><SidebarTrigger /><h1 className="font-heading text-2xl">{location.view === "home" ? "主页" : location.view === "settings" ? "笔记库设置" : location.view === "trash" ? "回收站" : location.tag || location.quickFilter || "所有笔记"}</h1></div><p className="mt-4 max-w-xl text-sm text-secondary">展开标签树、搜索标签，或打开标签菜单编辑名称和图标。缩窄画布后，点击左上角导航按钮检查 H5 交互。</p>{notice && <p role="status" className="mt-4 text-sm">{notice}</p>}<Button type="button" variant="outline" className="mt-4 md:hidden" onClick={() => setOpenMobile(true)}>打开笔记导航</Button></main>
  </SidebarProvider>;
}

export const FullSidebar: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
export const Empty: Story = { args: { tags: [], tag: null } };
export const Loading: Story = { args: { loadingTags: true } };
export const Disconnected: Story = { args: { connected: false, canCreate: false, canTrash: false, registeredVaults: [], vaultId: null, vaultName: "选择笔记库", tags: [], tag: null, vaultStatusText: "尚未连接笔记库", hasVaultIssue: true } };
export const PermissionRequired: Story = { args: { needsPermission: true, canCreate: false, canTrash: false, hasVaultIssue: true, vaultStatusText: "需要重新授权文件夹访问权限。" } };
export const Working: Story = { args: { working: true } };
export const LongNames: Story = { args: { vaultName: "用于验证中文和英文字体以及长名称截断的笔记库 MemoCard Workspace", tags: [...tags, { name: "这是一个用于验证长标签名称截断和完整可访问名称的标签", count: 123456 }] } };
export const NestedAlignment: Story = {
  args: { vaultId: "ui-sidebar-alignment-story", tag: "生活/咖啡", tags: [{ name: "生活", count: 8 }, { name: "生活/咖啡", count: 3 }, { name: "生活/植物", count: 5 }] },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const mobile = window.innerWidth < 768;
    const transparent = "rgba(0, 0, 0, 0)";
    const tokenColor = (element: HTMLElement, token: string) => {
      const probe = element.ownerDocument.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;color:var(${token})`;
      element.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    if (mobile) await userEvent.click(await page.findByRole("button", { name: "打开笔记导航" }));
    else {
      const trigger = canvasElement.querySelector<HTMLElement>("main [data-slot=sidebar-trigger]")!;
      await waitFor(async () => expect(getComputedStyle(trigger).backgroundColor).toBe(transparent));
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
    }
    // Synthetic userEvent hover/Tab does not establish native :hover or :focus-visible.
    // Native pointer and keyboard checks are recorded separately in browser acceptance.
    const sidebar = canvasElement.ownerDocument.querySelector<HTMLElement>(".ui-business-sidebar[data-sidebar=sidebar], .ui-business-sidebar [data-sidebar=sidebar]")!;
    await expect(getComputedStyle(sidebar).backgroundColor).toBe(tokenColor(sidebar, "--color-background-sidebar"));
    const toggle = await page.findByRole("button", { name: "展开或收起快捷筛选" });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await waitFor(async () => expect(getComputedStyle(toggle).backgroundColor).toBe(transparent));
    if (mobile) await expect(getComputedStyle(toggle.parentElement!.querySelector<HTMLElement>(".ui-sidebar-branch-icon")!).opacity).toBe("1");
    for (const name of ["无标签", "有图片", "有链接", "生活/咖啡", "生活/植物"]) {
      const row = await page.findByRole("button", { name });
      await waitFor(async () => {
        const icon = row.querySelector<HTMLElement>(".ui-sidebar-row-icon")!;
        const label = row.querySelector<HTMLElement>(":scope > span:last-of-type")!;
        const range = row.ownerDocument.createRange();
        range.selectNodeContents(label);
        const iconBox = icon.getBoundingClientRect();
        const labelBox = label.getBoundingClientRect();
        const textBox = range.getBoundingClientRect();
        // Rows can grow with the current line-height while retaining their hit target.
        await expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(mobile ? 48 : 32);
        await expect(row.getBoundingClientRect().height).toBeGreaterThan(textBox.height);
        await expect(iconBox.width).toBeGreaterThan(0);
        await expect(getComputedStyle(row).textAlign).toBe("left");
        await expect(getComputedStyle(label).textAlign).toBe("left");
        await expect(labelBox.left - iconBox.right).toBeCloseTo(8, 0);
        // A flexing label box alone misses native button text centering: measure the text itself.
        await expect(textBox.left - iconBox.right).toBeCloseTo(8, 0);
        const badge = row.closest(".ui-sidebar-tree-row")?.querySelector<HTMLElement>(".ui-sidebar-row-actions > [data-sidebar=menu-badge]");
        if (badge && getComputedStyle(badge).display !== "none") {
          await expect(row.getBoundingClientRect().right - badge.getBoundingClientRect().right).toBeCloseTo(4, 0);
          await expect(badge.getBoundingClientRect().left).toBeGreaterThan(textBox.right);
        }
      });
    }
    await expect(page.getByRole("button", { name: "生活/咖啡" })).toHaveAttribute("aria-current", "page");
    await expect(getComputedStyle(page.getByRole("button", { name: "生活/咖啡" })).fontWeight).toBe("500");
    await expect(getComputedStyle(page.getByRole("button", { name: "生活/植物" })).fontWeight).toBe("400");
    const calendar = page.getByRole("button", { name: "日历" });
    await expect(calendar).toHaveAttribute("aria-disabled", "true");
    await expect(getComputedStyle(calendar).pointerEvents).toBe("none");
    await expect(getComputedStyle(calendar).opacity).toBe("1");
    await expect(getComputedStyle(calendar).color).toBe(tokenColor(calendar, "--color-text-disabled"));
    const calendarIcon = calendar.querySelector("svg")!;
    await expect(getComputedStyle(calendarIcon).color).toBe(tokenColor(calendar, "--color-icon-disabled"));
  },
};
export const MobileVaultGeometry: Story = {
  tags: ["mobile"], globals: { viewport: { value: "mobile", isRotated: false } },
  play: async ({ canvasElement }) => {
    if (window.innerWidth >= 768) return;
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByRole("button", { name: "打开笔记导航" }));
    const vaultTrigger = await page.findByRole("button", { name: "笔记库：我的笔记" });
    await userEvent.click(vaultTrigger);
    const sheet = await page.findByRole("dialog", { name: "笔记库" });
    const rows = [...sheet.querySelectorAll<HTMLElement>(".ui-sidebar-vault-menu-item")];
    await expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      await waitFor(async () => {
        const box = row.getBoundingClientRect();
        const list = row.parentElement!;
        const listStyle = getComputedStyle(list);
        const contentWidth = list.clientWidth - parseFloat(listStyle.paddingLeft) - parseFloat(listStyle.paddingRight);
        await expect(box.width).toBeCloseTo(contentWidth, 0);
        await expect(box.height).toBeGreaterThanOrEqual(48);
        await expect(getComputedStyle(row).fontSize).toBe("16px");
      });
    }
    const close = within(sheet).getByRole("button", { name: "关闭笔记库菜单" });
    await expect(close.getBoundingClientRect().width).toBeCloseTo(36, 0);
    await expect(close.getBoundingClientRect().height).toBeCloseTo(36, 0);
    // Only dismiss the menu; geometry acceptance must never activate a vault.
    await userEvent.click(close);
    await waitFor(async () => expect(page.queryByRole("dialog", { name: "笔记库" })).toBeNull());
    await waitFor(async () => expect(vaultTrigger).toHaveFocus());
  },
};
export const TreeRow: Story = { render: () => <SidebarProvider className="ui-theme sb-unstyled" persistState={false} keyboardShortcut={false}><Sidebar collapsible="none" className="ui-business-sidebar min-h-svh"><SidebarMenu><SidebarTreeItem label="项目" icon={<SidebarIcon name="hash" />} isActive={false} buttonProps={{ onClick: fn() }}><SidebarMenu className="pl-4"><SidebarTreeItem nested label="MemoCard" icon={<SidebarIcon name="hash" />} isActive buttonProps={{ onClick: fn() }} /></SidebarMenu></SidebarTreeItem></SidebarMenu></Sidebar></SidebarProvider> };
