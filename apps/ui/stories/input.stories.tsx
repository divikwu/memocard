import type { ComponentProps } from "react";
import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { ComponentDocsPage } from "../.storybook/component-docs";
import { desktopGlobals } from "../.storybook/viewports";

const usage = `import { Input } from "@/components/ui/input"

export function NoteTitleInput() {
  return (
    <label className="grid gap-2">
      笔记标题
      <Input name="title" placeholder="输入标题" />
    </label>
  )
}`;
const anatomy = `- 根元素是透传原生属性的 \`input\`，消费生产边框、文字、占位符和状态样式。
- 可见标签由表单组合层提供，使用包裹标签或 \`htmlFor\` / \`id\` 关联。
- 帮助或错误文案放在输入框外，通过 \`aria-describedby\` 关联；\`aria-invalid\` 声明错误状态。`;
const guidelines = `- 用于标题、搜索和短文本等单行输入。标签说明输入内容，\`placeholder\` 只提供示例或提示。
- 默认高度为 \`h-9\`：16px 根字号下为 36px，随根字号缩放。移动端文字采用 body 字号，桌面采用 label 字号与行高。
- InputGroup 组合默认为 \`h-8\`（32px 基准），行内输入填满边框内部；分块输入保留 \`h-9\`，分块 addon 用于独立工具栏。尺寸由现有组件组合决定。
- 不受控用法设置 \`defaultValue\` 作为初值；受控用法同时提供 \`value\` 和同步更新它的 \`onChange\`。同一实例保持一种模式，受控文本值保持字符串。
- \`readOnly\` 保留聚焦、选择和复制能力；\`disabled\` 用于当前不可操作的字段，并从原生表单提交数据中排除。
- \`required\` 参与浏览器表单约束；业务层决定何时展示错误，并提供 \`aria-invalid\` 和可理解的错误说明。
- 上方复制代码展示不受控的生产用法。本页交互故事为了展示输入回显，自行维护受控 \`value\`，并用 \`defaultValue\` 仅初始化；\`value\`、\`defaultValue\`、标签与错误关联不作为可调 Controls。`;
const accessibility = `- 提供可见且关联的 label；占位符不能代替可访问名称。
- 错误时同时设置 \`aria-invalid={true}\` 并通过 \`aria-describedby\` 关联文字说明。Input 不自动校验或生成错误文案。
- 可编辑和只读输入都能接收焦点；禁用输入跳过 Tab。本页交互测试覆盖输入回显、只读防改和禁用焦点跳过。
- 根据内容选择合适的 \`type\` 和 \`autoComplete\`，保留浏览器输入与自动填充行为。`;
const platform = `Web 与 H5 使用同一个生产 Input 和原生 HTML 输入行为。iOS 原生输入继续由现有 SwiftUI 组件管理尺寸、焦点与系统键盘；WebView 内容中的输入沿用 Web 实现。本页预览验证 Web / H5 契约。`;
const api = `本地 Input 的类型为 \`React.ComponentProps<"input">\`，没有额外的值管理或校验 API。下表只维护常用输入属性，完整受控规则和原生属性见 [React input 文档](https://react.dev/reference/react-dom/components/input)。表中的 \`value\` / \`defaultValue\` 描述生产能力，预览仍由 InputExample 管理自身状态。`;

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
  args: { placeholder: "输入标题", onChange: fn() },
  argTypes: {
    type: { control: "select", options: ["text", "search", "email", "url", "tel", "password"], description: "常见文本输入类型；其余原生类型见 React input 文档。", table: { type: { summary: "React.HTMLInputTypeAttribute" }, defaultValue: { summary: '"text"（浏览器默认值）' } } },
    placeholder: { control: "text", description: "空值时的输入提示，不代替 label。", table: { type: { summary: "string" } } },
    value: { control: false, description: "受控值，需由 onChange 同步更新；本页预览内部维护。", table: { type: { summary: "string | number | readonly string[]" } } },
    defaultValue: { control: false, description: "不受控初值，仅初始化生效；本页用于初始化回显状态。", table: { type: { summary: "string | number | readonly string[]" } } },
    onChange: { control: false, description: "原生变更事件；受控用法在这里更新 value。", table: { type: { summary: "React.ChangeEventHandler<HTMLInputElement>" } } },
    disabled: { control: "boolean", description: "禁止输入和聚焦，并从原生表单提交数据中排除。", table: { type: { summary: "boolean" } } },
    readOnly: { control: "boolean", description: "保留聚焦、选择和复制，阻止用户编辑。", table: { type: { summary: "boolean" } } },
    required: { control: "boolean", description: "参与原生表单约束，不自动设置错误文案或 aria-invalid。", table: { type: { summary: "boolean" } } },
    name: { control: "text", description: "原生表单字段名称。", table: { type: { summary: "string" } } },
    autoComplete: { control: "text", description: "浏览器自动填充提示。", table: { type: { summary: "React.HTMLInputAutoCompleteAttribute" } } },
    id: { control: false, description: "用于 label / 帮助文案关联；本页预览使用 useId 自动生成。", table: { type: { summary: "string" } } },
    "aria-invalid": { control: "boolean", description: "设为 true 声明无效值并激活生产错误外观；校验由业务层处理。", table: { type: { summary: 'boolean | "true" | "false" | "grammar" | "spelling"' } } },
    "aria-describedby": { control: false, description: "帮助或错误文案的元素 ID；本页按错误状态自动关联。", table: { type: { summary: "string" } } },
  },
  parameters: {
    layout: "padded",
    docs: {
      description: { component: "标题、搜索等单行内容的基础输入框；表单组合层负责标签、值管理与错误说明。" },
      page: () => <ComponentDocsPage usage={usage} anatomy={anatomy} guidelines={guidelines} accessibility={accessibility} platform={platform} api={api} apiArgs={["type", "placeholder", "value", "defaultValue", "onChange", "disabled", "readOnly", "required", "name", "autoComplete", "id", "aria-invalid", "aria-describedby"]} />,
    },
  },
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
