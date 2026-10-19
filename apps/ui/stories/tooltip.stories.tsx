import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../src/components/ui/tooltip";

function TooltipExample() {
  const descriptionId = useId();
  return <TooltipProvider>
    <div className="flex items-center gap-4">
      <Button variant="outline">上一个控件</Button>
      <Tooltip>
        <TooltipTrigger aria-describedby={descriptionId} render={<Button variant="outline">记录快捷键</Button>} />
        <TooltipContent id={descriptionId} role="tooltip">使用 ⌘ Enter 快速保存</TooltipContent>
      </Tooltip>
      <Button variant="outline">下一个控件</Button>
    </div>
  </TooltipProvider>;
}

const meta = {
  title: "components/tooltip",
  component: TooltipExample,
  globals: desktopGlobals,
  parameters: { layout: "centered", docs: { description: { component: "生产 Tooltip 的 hover 和键盘触发；消费端按现有约定显式提供 useId、aria-describedby 和 content role。" } } },
} satisfies Meta<typeof TooltipExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Hover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "记录快捷键" });
    await userEvent.hover(trigger);
    const tooltip = await page.findByRole("tooltip");
    await expect(tooltip).toHaveTextContent("使用 ⌘ Enter 快速保存");
    await expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    await userEvent.unhover(trigger);
    await waitFor(() => expect(page.queryByRole("tooltip")).not.toBeInTheDocument());
  },
};

export const KeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    canvas.getByRole("button", { name: "上一个控件" }).focus();
    await userEvent.tab();
    const trigger = canvas.getByRole("button", { name: "记录快捷键" });
    await expect(trigger).toHaveFocus();
    await expect(await page.findByRole("tooltip")).toHaveTextContent("使用 ⌘ Enter 快速保存");
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "下一个控件" })).toHaveFocus();
    await waitFor(() => expect(page.queryByRole("tooltip")).not.toBeInTheDocument());
  },
};
