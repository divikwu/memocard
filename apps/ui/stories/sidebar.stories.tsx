import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AppSidebar } from "../src/components/app-sidebar";
import { desktopGlobals } from "../.storybook/viewports";
import { SidebarExample } from "./sidebar.example";
import { sidebarArgs, sidebarTags } from "./sidebar.fixtures";

async function expectRowMetrics(button: HTMLElement, height: number, fontSize: number) {
  const style = getComputedStyle(button);
  await expect(button.getBoundingClientRect().height).toBe(height);
  await expect(style.fontSize).toBe(`${fontSize}px`);
  await expect(style.columnGap).toBe("8px");
  const icon = button.querySelector("svg");
  await expect(icon).not.toBeNull();
  await expect(icon!.getBoundingClientRect().width).toBe(16);
  await expect(icon!.getBoundingClientRect().height).toBe(16);
}

const meta = {
  title: "sidebar/full sidebar",
  component: AppSidebar,
  render: SidebarExample,
  globals: desktopGlobals,
  args: sidebarArgs(),
  // Interactive fixtures start after the production lazy module is available.
  beforeEach: async () => { await import("../src/components/tag-navigation"); },
  parameters: { docs: { story: { height: "900px" }, description: { component: "Base UI 真实侧栏。iOS 原生侧栏对应 Xcode NativeSidebar Preview；这里展示桌面 Web 和 H5 的平台实现。" } } },
} satisfies Meta<typeof AppSidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  name: "desktop",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expectRowMetrics(canvas.getByRole("button", { name: "所有笔记" }), 32, 14);
    const toggle = canvas.getByRole("button", { name: "展开或收起快捷筛选" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await expect(args.onNavigate).not.toHaveBeenCalled();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByRole("button", { name: "有图片" }));
    await expect(args.onNavigate).toHaveBeenLastCalledWith("notes", null, "images");
    await userEvent.click(canvas.getByRole("button", { name: "所有笔记" }));
    await expect(args.onNavigate).toHaveBeenLastCalledWith("notes", null);
    let nested: HTMLElement;
    try {
      nested = await canvas.findByRole("button", { name: "体验/使用指南/快捷操作" });
    } catch (error) {
      const navigation = canvasElement.querySelector('nav[aria-label="标签"]');
      console.error("Sidebar Desktop fixture diagnostics", {
        loadingTags: Boolean(canvas.queryByRole("status", { name: "正在读取标签" })),
        tagNavigation: Boolean(navigation),
        sidebarState: canvasElement.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state"),
        toggles: [...canvasElement.querySelectorAll('button[aria-expanded]')].map(button => ({ label: button.getAttribute("aria-label") || button.textContent, expanded: button.getAttribute("aria-expanded") })),
        tagDOM: navigation?.outerHTML ?? canvasElement.querySelector('[data-sidebar="content"]')?.outerHTML,
      });
      throw error;
    }
    await userEvent.click(nested);
    await expect(args.onNavigate).toHaveBeenLastCalledWith("notes", "体验/使用指南/快捷操作");
    await userEvent.click(canvas.getByRole("button", { name: "展开或收起标签 体验/使用指南" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "体验/使用指南/快捷操作" })).not.toBeInTheDocument());
    await expect(args.onNavigate).toHaveBeenCalledTimes(3);
    const vault = canvas.getByRole("button", { name: "笔记库：我的笔记" });
    await userEvent.click(vault);
    const body = within(canvasElement.ownerDocument.body);
    await body.findByRole("menuitem", { name: "笔记库设置" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(vault).toHaveFocus());
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
export const Mobile: Story = {
  name: "mobile",
  tags: ["mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  parameters: { docs: { description: { story: "390 × 844 H5 抽屉。保留生产 Sheet、触摸命中区和笔记库底部菜单。" } } },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    const notes = await body.findByRole("button", { name: "所有笔记" });
    await expectRowMetrics(notes, 48, 16);
    const toggle = body.getByRole("button", { name: "展开或收起快捷筛选" });
    // Verify the extra 2px hit area resolves to the toggle, not the row beneath it.
    await waitFor(() => {
      const bounds = toggle.getBoundingClientRect();
      const edge = canvasElement.ownerDocument.elementFromPoint(bounds.right + 1, bounds.top + bounds.height / 2);
      expect(edge?.closest("button")).toBe(toggle);
    });
    await userEvent.click(toggle);
    await expect(args.onNavigate).not.toHaveBeenCalled();
    await userEvent.click(body.getByRole("button", { name: "有链接" }));
    await expect(args.onNavigate).toHaveBeenLastCalledWith("notes", null, "links");
    await userEvent.click(notes);
    await expect(args.onNavigate).toHaveBeenLastCalledWith("notes", null);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(body.getByRole("button", { name: "笔记库：我的笔记" }));
    await expect(await body.findByRole("button", { name: "关闭笔记库菜单" })).toBeVisible();
    await userEvent.click(body.getByRole("button", { name: "笔记库设置" }));
    await expect(args.onNavigate).toHaveBeenLastCalledWith("settings");
  },
};
export const Empty: Story = { args: { tags: [] } };
export const Loading: Story = { args: { loadingTags: true } };
export const PermissionError: Story = { args: { needsPermission: true, hasVaultIssue: true, canCreate: false, vaultStatusText: "无法读取笔记库，请重新授权文件夹。" } };
export const Disconnected: Story = { args: { connected: false, canCreate: false, tags: [], registeredVaults: [], canTrash: false } };
export const LongNames: Story = { args: { vaultName: "这是一个需要截断显示的很长的笔记库名称", tags: [...sidebarTags, { name: "这是一段很长的标签文字用于检查单行截断与可访问名称", count: 99 }] } };
export const DisabledActions: Story = {
  args: { working: true, canCreate: false },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "新建笔记" })).toBeDisabled();
    await expect(args.onNewNote).not.toHaveBeenCalled();
  },
};
