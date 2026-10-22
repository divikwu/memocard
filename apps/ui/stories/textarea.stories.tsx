import type { ComponentProps } from "react";
import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { Textarea } from "../src/components/ui/textarea";
import { desktopGlobals } from "../.storybook/viewports";

function TextareaExample({ defaultValue, ...args }: ComponentProps<typeof Textarea>) {
  const id = useId();
  const [value, setValue] = useState(String(defaultValue ?? ""));
  return <div className="grid max-w-sm gap-2">
    <label htmlFor={id}>补充说明</label>
    <Textarea {...args} id={id} value={value} aria-describedby={args["aria-invalid"] ? `${id}-error` : undefined} onChange={event => { setValue(event.currentTarget.value); args.onChange?.(event); }} />
    {args["aria-invalid"] && <p id={`${id}-error`} className="text-sm text-destructive">请补充说明。</p>}
    <output aria-label="多行输入回显" className="whitespace-pre-wrap text-sm text-muted-foreground">{value || "尚未输入"}</output>
  </div>;
}
const meta = {
  title: "components/textarea", component: Textarea, globals: desktopGlobals,
  render: args => <TextareaExample {...args} />,
  args: { placeholder: "输入多行说明", onChange: fn() }, parameters: { layout: "padded", docs: { description: { component: "生产多行输入，展示真实输入、只读、禁用与校验。最小高度为 min-h-16：16px 根字号下为 64px，随根字号缩放，并按现有 field-sizing: content 规则容纳内容；软件键盘和 IME 仍需 App 验收。" } } },
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), input = canvas.getByRole("textbox", { name: "补充说明" });
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await userEvent.type(input, "第一行{Enter}第二行");
    await expect(input).toHaveValue("第一行\n第二行");
    await expect(canvas.getByLabelText("多行输入回显")).toHaveTextContent("第二行");
    await expect(args.onChange).toHaveBeenCalled();
  },
};
export const Invalid: Story = { args: { "aria-invalid": true } };
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: "只读说明" },
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole("textbox", { name: "补充说明" });
    await userEvent.click(input);
    await expect(input).toHaveFocus();
    await userEvent.keyboard("{Enter}new text");
    await expect(input).toHaveValue("只读说明");
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "不可修改" },
  render: args => <div className="grid gap-3"><Button variant="outline">前一项</Button><TextareaExample {...args} /><Button variant="outline">后一项</Button></div>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "前一项" }));
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "后一项" })).toHaveFocus();
    await expect(canvas.getByRole("textbox", { name: "补充说明" })).toHaveValue("不可修改");
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
