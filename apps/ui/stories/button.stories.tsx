import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Search } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { desktopGlobals } from "../.storybook/viewports";

const meta = {
  title: "components/button",
  component: Button,
  globals: desktopGlobals,
  args: { children: "保存", onClick: fn() },
  parameters: { layout: "padded", docs: { description: { component: "生产 Button 的六种视觉变体和八种尺寸；键盘激活与 disabled 保持原行为。iOS 使用原生动作组件，不复刻 Web 内部尺寸。" } } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: args => <div className="flex flex-wrap items-center gap-3">{(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map(variant => <Button {...args} key={variant} variant={variant}>{variant}</Button>)}</div>,
};
export const Sizes: Story = {
  render: args => <div className="flex flex-wrap items-center gap-3">
    {(["xs", "sm", "default", "lg"] as const).map(size => <Button {...args} key={size} size={size}>{size}</Button>)}
    {(["icon-xs", "icon-sm", "icon", "icon-lg"] as const).map(size => <Button {...args} key={size} size={size} aria-label={`搜索 ${size}`}><Search aria-hidden="true" /></Button>)}
  </div>,
};
export const KeyboardAndDisabled: Story = {
  render: args => <div className="flex gap-3"><Button {...args}>保存</Button><Button {...args} disabled>不可用</Button><Button variant="outline">下一项</Button></div>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "保存" }));
    await expect(canvas.getByRole("button", { name: "保存" })).toHaveFocus();
    await userEvent.keyboard("{Enter} ");
    await expect(args.onClick).toHaveBeenCalledTimes(3);
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "下一项" })).toHaveFocus();
    await expect(canvas.getByRole("button", { name: "不可用" })).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(3);
  },
};
