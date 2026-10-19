import type { ComponentProps } from "react";
import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { Switch } from "../src/components/ui/switch";
import { desktopGlobals } from "../.storybook/viewports";

function SwitchExample({ defaultChecked, ...args }: ComponentProps<typeof Switch>) {
  const id = useId();
  const [checked, setChecked] = useState(defaultChecked ?? false);
  return <div className="grid gap-2"><div className="flex items-center gap-3"><Switch {...args} id={id} checked={checked} aria-labelledby={`${id}-label`} onCheckedChange={(next, details) => { setChecked(next); args.onCheckedChange?.(next, details); }} /><label id={`${id}-label`} htmlFor={id}>接收提醒</label></div><output aria-label="开关回显" className="text-sm text-muted-foreground">{checked ? "已开启" : "已关闭"}</output></div>;
}
const meta = {
  title: "components/switch", component: Switch, globals: desktopGlobals,
  render: args => <SwitchExample {...args} />,
  args: { onCheckedChange: fn() }, parameters: { layout: "padded", docs: { description: { component: "生产 Switch 的尺寸、选中、只读和禁用状态；键盘切换与回调保持现有语义。" } } },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), control = canvas.getByRole("switch", { name: "接收提醒" });
    await userEvent.click(control);
    await expect(control).toHaveFocus();
    await expect(control).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getByLabelText("开关回显")).toHaveTextContent("已开启");
    await userEvent.keyboard(" ");
    await expect(control).toHaveAttribute("aria-checked", "false");
    await expect(canvas.getByLabelText("开关回显")).toHaveTextContent("已关闭");
    await expect(args.onCheckedChange).toHaveBeenCalledTimes(2);
  },
};
export const SmallChecked: Story = { args: { size: "sm", defaultChecked: true } };
export const ReadOnly: Story = {
  args: { readOnly: true, defaultChecked: true },
  play: async ({ canvasElement, args }) => {
    const control = within(canvasElement).getByRole("switch", { name: "接收提醒" });
    await userEvent.click(control);
    await expect(control).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(control).toHaveAttribute("aria-checked", "true");
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
  render: args => <div className="grid gap-3"><Button variant="outline">前一项</Button><SwitchExample {...args} /><Button variant="outline">后一项</Button></div>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "前一项" }));
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "后一项" })).toHaveFocus();
    await expect(canvas.getByRole("switch", { name: "接收提醒" })).toHaveAttribute("aria-checked", "true");
    await expect(args.onCheckedChange).not.toHaveBeenCalled();
  },
};
