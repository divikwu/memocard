import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/ui/select";
import { desktopGlobals } from "../.storybook/viewports";

const items = [{ value: "light", label: "浅色" }, { value: "system", label: "跟随系统（暂不可用）" }, { value: "dark", label: "深色" }];
function SelectExample({ size = "default", disabled = false, readOnly = false, invalid = false, onChange }: { size?: "sm" | "default"; disabled?: boolean; readOnly?: boolean; invalid?: boolean; onChange: (value: string | null) => void }) {
  const id = useId();
  const [value, setValue] = useState<string | null>("light");
  return <div className="grid max-w-sm gap-2">
    <label id={`${id}-label`} htmlFor={id}>主题模式</label>
    <Select value={value} items={items} disabled={disabled} readOnly={readOnly} onValueChange={next => { setValue(next); onChange(next); }}>
      <SelectTrigger id={id} size={size} aria-labelledby={`${id}-label`} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}><SelectValue /></SelectTrigger>
      <SelectContent align="start">{items.map(item => <SelectItem key={item.value} value={item.value} disabled={item.value === "system"}>{item.label}</SelectItem>)}</SelectContent>
    </Select>
    {invalid && <p id={`${id}-error`} className="text-sm text-destructive">请选择可用主题。</p>}
    <output aria-label="选择回显" className="text-sm text-muted-foreground">{value}</output>
  </div>;
}
const meta = {
  title: "components/select", component: SelectExample, globals: desktopGlobals,
  args: { size: "default", disabled: false, readOnly: false, invalid: false, onChange: fn() }, parameters: { layout: "padded", docs: { description: { component: "生产 Base UI Select。禁用选项仍可由方向键聚焦以读取名称，但不能提交；选择与 Escape 关闭后返回 trigger。" } } },
} satisfies Meta<typeof SelectExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardSelection: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("combobox", { name: "主题模式" });
    await userEvent.click(trigger);
    const initial = await body.findByRole("option", { name: "浅色" });
    await waitFor(() => expect(initial).toHaveFocus());
    // Base UI keeps disabled options focusable so their labels remain discoverable.
    await userEvent.keyboard("{ArrowDown}");
    const disabled = body.getByRole("option", { name: "跟随系统（暂不可用）" });
    await expect(disabled).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onChange).not.toHaveBeenCalled();
    await expect(trigger).toHaveTextContent("浅色");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onChange).toHaveBeenLastCalledWith("dark");
    await expect(trigger).toHaveTextContent("深色");
    await expect(canvas.getByLabelText("选择回显")).toHaveTextContent("dark");
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    await body.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("listbox")).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveTextContent("深色");
  },
};
export const Small: Story = { args: { size: "sm" } };
export const Invalid: Story = { args: { invalid: true } };
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), trigger = canvas.getByRole("combobox", { name: "主题模式" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(trigger).toHaveTextContent("浅色");
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
export const Disabled: Story = {
  args: { disabled: true },
  render: args => <div className="grid gap-3"><Button variant="outline">前一项</Button><SelectExample {...args} /><Button variant="outline">后一项</Button></div>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "前一项" }));
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "后一项" })).toHaveFocus();
    await expect(canvas.getByLabelText("选择回显")).toHaveTextContent("light");
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
