import type { ComponentProps } from "react";
import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { desktopGlobals } from "../.storybook/viewports";

function InputExample({ defaultValue, ...args }: ComponentProps<typeof Input>) {
  const id = useId();
  const [value, setValue] = useState(String(defaultValue ?? ""));
  return <div className="grid max-w-sm gap-2">
    <label htmlFor={id}>笔记标题</label>
    <Input {...args} id={id} value={value} aria-describedby={args["aria-invalid"] ? `${id}-error` : undefined} onChange={event => { setValue(event.currentTarget.value); args.onChange?.(event); }} />
    {args["aria-invalid"] && <p id={`${id}-error`} className="text-sm text-destructive">标题不能为空。</p>}
    <output aria-label="输入回显" className="text-sm text-muted-foreground">{value || "尚未输入"}</output>
  </div>;
}
const meta = {
  title: "components/input", component: Input, globals: desktopGlobals,
  render: args => <InputExample {...args} />,
  args: { placeholder: "输入标题", onChange: fn() }, parameters: { layout: "padded", docs: { description: { component: "生产 Input 与真实 input，展示输入回显、校验、只读和禁用；示例负责关联 label 与错误说明。" } } },
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), input = canvas.getByRole("textbox", { name: "笔记标题" });
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await userEvent.type(input, "Memo 标题");
    await expect(input).toHaveValue("Memo 标题");
    await expect(canvas.getByLabelText("输入回显")).toHaveTextContent("Memo 标题");
    await expect(args.onChange).toHaveBeenCalled();
  },
};
export const Invalid: Story = { args: { "aria-invalid": true } };
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: "已保存标题" },
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "笔记标题" });
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await userEvent.keyboard("new title");
    await expect(input).toHaveValue("已保存标题");
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "不可修改" },
  render: args => <div className="grid gap-3"><Button variant="outline">前一项</Button><InputExample {...args} /><Button variant="outline">后一项</Button></div>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "前一项" }));
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "后一项" })).toHaveFocus();
    await expect(canvas.getByRole("textbox", { name: "笔记标题" })).toHaveValue("不可修改");
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
