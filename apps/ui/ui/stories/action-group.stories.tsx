import type { Meta, StoryObj } from "@storybook/react-vite";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft02Icon from "@hugeicons/core-free-icons/ArrowLeft02Icon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import { ActionGroup } from "../components/action-group";
import { Button } from "../components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/action group",
  id: "ui-action-group",
  component: ActionGroup,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ActionGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: () => <LumaStoryFrame><ActionGroup aria-label="返回操作">
    <Button variant="ghost" size="icon" aria-label="返回笔记列表"><HugeiconsIcon icon={ArrowLeft02Icon} aria-hidden="true" /></Button>
  </ActionGroup></LumaStoryFrame>,
};

export const TwoActions: Story = {
  render: () => <LumaStoryFrame><ActionGroup aria-label="笔记操作">
    <TooltipProvider><Tooltip><TooltipTrigger render={<span className="inline-flex" />}>
      <Button variant="ghost" size="icon" aria-label="固定到主页"><HugeiconsIcon icon={PinIcon} aria-hidden="true" /></Button>
    </TooltipTrigger><TooltipContent>固定到主页</TooltipContent></Tooltip></TooltipProvider>
    <Button variant="ghost" size="icon" aria-label="页面操作"><HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" /></Button>
  </ActionGroup></LumaStoryFrame>,
};

export const Disabled: Story = {
  render: () => <LumaStoryFrame><ActionGroup aria-label="包含禁用操作的笔记工具">
    <Button variant="ghost" size="icon" aria-label="固定到主页" disabled><HugeiconsIcon icon={PinIcon} aria-hidden="true" /></Button>
    <Button variant="ghost" size="icon" aria-label="页面操作"><HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" /></Button>
  </ActionGroup></LumaStoryFrame>,
};

export const Large: Story = {
  render: () => <LumaStoryFrame><div className="flex flex-wrap items-center gap-4">
    <ActionGroup size="lg" aria-label="大尺寸返回操作">
      <Button variant="ghost" size="icon" aria-label="返回笔记列表"><HugeiconsIcon icon={ArrowLeft02Icon} aria-hidden="true" /></Button>
    </ActionGroup>
    <ActionGroup size="lg" aria-label="大尺寸笔记操作">
      <TooltipProvider><Tooltip><TooltipTrigger render={<span className="inline-flex" />}>
        <Button variant="ghost" size="icon" aria-label="固定到主页"><HugeiconsIcon icon={PinIcon} aria-hidden="true" /></Button>
      </TooltipTrigger><TooltipContent>固定到主页</TooltipContent></Tooltip></TooltipProvider>
      <Button variant="ghost" size="icon" aria-label="页面操作"><HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" /></Button>
    </ActionGroup>
  </div></LumaStoryFrame>,
};
