import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "../src/components/ui/popover";

function PopoverExample() {
  const titleId = useId();
  const descriptionId = useId();
  const queryId = useId();
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button variant="outline">筛选标签</Button>} />
    <PopoverContent aria-labelledby={titleId} aria-describedby={descriptionId}>
      <PopoverHeader>
        <PopoverTitle id={titleId}>标签筛选</PopoverTitle>
        <PopoverDescription id={descriptionId}>输入关键词查找已有标签。</PopoverDescription>
      </PopoverHeader>
      <div className="mt-4 space-y-2">
        <label htmlFor={queryId} className="text-sm font-medium">标签关键词</label>
        <Input id={queryId} placeholder="例如：产品" />
        <Button onClick={() => setOpen(false)}>完成</Button>
      </div>
    </PopoverContent>
  </Popover>;
}

const meta = {
  title: "components/popover",
  component: PopoverExample,
  globals: desktopGlobals,
  parameters: { layout: "centered", docs: { description: { component: "生产非模态 Popover，示例显式关联标题、说明和输入 label；关闭或 Escape 后焦点返回入口。" } } },
} satisfies Meta<typeof PopoverExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "筛选标签" });
    await userEvent.click(trigger);
    const popover = await page.findByRole("dialog", { name: "标签筛选" });
    const query = within(popover).getByRole("textbox", { name: "标签关键词" });
    await userEvent.type(query, "产品");
    await expect(query).toHaveValue("产品");
    await userEvent.click(within(popover).getByRole("button", { name: "完成" }));
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    await page.findByRole("dialog", { name: "标签筛选" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
