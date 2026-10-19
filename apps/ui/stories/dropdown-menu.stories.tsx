import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "../src/components/ui/dropdown-menu";

function DropdownMenuExample({ onAction }: { onAction: (action: string) => void }) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline">笔记操作</Button>} />
    <DropdownMenuContent align="start">
      <DropdownMenuGroup>
        <DropdownMenuLabel>当前笔记</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAction("pin")}>置顶笔记<DropdownMenuShortcut>⌘P</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem disabled onClick={() => onAction("share")}>分享笔记（暂不可用）</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("copy")}>复制链接</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={() => onAction("delete")}>删除笔记</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

const meta = {
  title: "components/dropdown-menu",
  component: DropdownMenuExample,
  globals: desktopGlobals,
  parameters: { layout: "centered", docs: { description: { component: "生产 Menu 包装与真实键盘回调。禁用项允许聚焦但不执行；选择或 Escape 关闭后焦点返回入口。" } } },
  args: { onAction: fn() },
} satisfies Meta<typeof DropdownMenuExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "笔记操作" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    const menu = await page.findByRole("menu");
    await waitFor(() => expect(within(menu).getByRole("menuitem", { name: /置顶笔记/ })).toHaveFocus());
    await expect(within(menu).getByRole("menuitem", { name: "分享笔记（暂不可用）" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{ArrowDown}");
    await expect(within(menu).getByRole("menuitem", { name: "分享笔记（暂不可用）" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onAction).not.toHaveBeenCalled();
    await expect(menu).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await expect(within(menu).getByRole("menuitem", { name: "复制链接" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onAction).toHaveBeenCalledOnce();
    await expect(args.onAction).toHaveBeenCalledWith("copy");
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await page.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(args.onAction).toHaveBeenCalledOnce();
  },
};
