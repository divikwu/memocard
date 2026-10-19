import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../src/components/ui/dialog";
import { Input } from "../src/components/ui/input";

function DialogExample({ onSave }: { onSave: () => void }) {
  const titleId = useId();
  return <Dialog>
    <DialogTrigger render={<Button variant="outline">编辑笔记标题</Button>} />
    <DialogContent>
      <DialogHeader>
        <DialogTitle>编辑标题</DialogTitle>
        <DialogDescription>保存后继续编辑当前笔记。</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <label htmlFor={titleId} className="text-sm font-medium">笔记标题</label>
        <Input id={titleId} defaultValue="侧栏使用指南" />
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline">取消</Button>} />
        <DialogClose render={<Button onClick={onSave}>保存</Button>} />
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

const meta = {
  title: "components/dialog",
  component: DialogExample,
  globals: desktopGlobals,
  parameters: { layout: "centered", docs: { description: { component: "生产模态 Dialog 的组合示例；关闭与 Escape 后焦点返回入口。示例操作仅更新本地回调。iOS 确认与弹窗保留系统实现。" } } },
  args: { onSave: fn() },
} satisfies Meta<typeof DialogExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "编辑笔记标题" });
    await userEvent.click(trigger);
    const dialog = await page.findByRole("dialog", { name: "编辑标题" });
    await expect(within(dialog).getByRole("textbox", { name: "笔记标题" })).toHaveValue("侧栏使用指南");
    await userEvent.click(within(dialog).getByRole("button", { name: "保存" }));
    await expect(args.onSave).toHaveBeenCalledOnce();
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await page.findByRole("dialog", { name: "编辑标题" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(args.onSave).toHaveBeenCalledOnce();
  },
};
