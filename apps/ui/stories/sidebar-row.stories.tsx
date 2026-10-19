import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Hash } from "lucide-react";
import { SidebarTreeItem } from "../src/components/sidebar-tree-item";
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuSub, SidebarProvider } from "../src/components/ui/sidebar";
import { desktopGlobals } from "../.storybook/viewports";

function RowExample({ label, selected, disabled, emoji, expanded, onSelect }: { label: string; selected: boolean; disabled: boolean; emoji: boolean; expanded: boolean; onSelect: () => void }) {
  return <SidebarProvider className="min-h-0!">
    <Sidebar collapsible="none"><SidebarContent><SidebarMenu>
      <SidebarTreeItem label={label} icon={emoji ? "🧭" : <Hash />} buttonProps={{ disabled, onClick: onSelect }} isActive={selected} defaultOpen={expanded} toggleLabel="展开或收起示例标签">
        <SidebarMenuSub><SidebarTreeItem nested label="子级标签" icon={<Hash />} buttonProps={{ onClick: onSelect }} isActive={false} /></SidebarMenuSub>
      </SidebarTreeItem>
    </SidebarMenu></SidebarContent></Sidebar>
  </SidebarProvider>;
}
const meta = {
  title: "sidebar/row",
  component: RowExample,
  globals: desktopGlobals,
  args: { label: "产品", selected: false, disabled: false, emoji: false, expanded: true, onSelect: fn() },
  parameters: { layout: "padded" },
} satisfies Meta<typeof RowExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Emoji: Story = { args: { emoji: true } };
export const LongText: Story = { args: { label: "这是一段很长的标签文字用于验证截断后仍能正确点击" } };
export const Collapsed: Story = { args: { expanded: false } };
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("button", { name: "产品" });
    select.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onSelect).toHaveBeenCalledOnce();
    const toggle = canvas.getByRole("button", { name: "展开或收起示例标签" });
    toggle.focus();
    await userEvent.keyboard("{Enter}");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(args.onSelect).toHaveBeenCalledOnce();
    await expect(toggle).toHaveFocus();
  },
};
