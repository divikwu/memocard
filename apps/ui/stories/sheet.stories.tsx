import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../src/components/ui/sheet";
import { DrawerCheck, inspectDrawer } from "./sheet-check.example";

function SheetExample({ side }: { side: "right" | "bottom" }) {
  return <Sheet>
    <SheetTrigger render={<Button variant="outline">打开笔记详情</Button>} />
    <SheetContent side={side} swipeToClose={side === "bottom"}>
      <SheetHeader>
        <SheetTitle>笔记详情</SheetTitle>
        <SheetDescription>查看当前笔记的信息，关闭后返回原来的操作位置。</SheetDescription>
      </SheetHeader>
      <dl className="space-y-3 px-4 text-sm">
        <div><dt className="text-secondary">标题</dt><dd>侧栏使用指南</dd></div>
        <div><dt className="text-secondary">标签</dt><dd>体验 / 使用指南</dd></div>
      </dl>
      <SheetFooter>
        <SheetClose render={<Button variant="outline">完成</Button>} />
      </SheetFooter>
    </SheetContent>
  </Sheet>;
}

const meta = {
  title: "components/sheet",
  component: SheetExample,
  globals: desktopGlobals,
  parameters: { layout: "centered", docs: { description: { component: "生产 Sheet 的桌面右侧与 H5 底部示例；覆盖关闭、Escape 和焦点返回。真实触摸滑动沿原测试和设备验收维护。" }, story: { height: "480px" } } },
  args: { side: "right" },
} satisfies Meta<typeof SheetExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "打开笔记详情" });
    await userEvent.click(trigger);
    const sheet = await page.findByRole("dialog", { name: "笔记详情" });
    await expect(sheet).toHaveTextContent("体验 / 使用指南");
    await userEvent.click(within(sheet).getByRole("button", { name: "完成" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await page.findByRole("dialog", { name: "笔记详情" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const MobileBottom: Story = {
  args: { side: "bottom" },
  tags: ["mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  parameters: { docs: { story: { height: "844px" } } },
  play: Right.play,
};

export const Interaction: Story = { render: () => <DrawerCheck />, play: inspectDrawer };
