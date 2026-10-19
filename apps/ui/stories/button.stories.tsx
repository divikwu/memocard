import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Search } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { desktopGlobals } from "../.storybook/viewports";
import { ButtonDocsPage, ButtonOverview, ButtonProperties } from "./button-docs";

const usage = `import { Button } from "@/components/ui/button"

export function SaveButton() {
  return <Button type="button">保存</Button>
}`;
const anatomy = `- 根元素默认为原生 \`button\`，承载焦点、点击与禁用语义。
- \`children\` 放置动作文字和可选图标；纯图标按钮通过 \`aria-label\` 提供名称。
- \`variant\` 选择六种外观，\`size\` 选择四种文字尺寸或四种图标尺寸。`;
const guidelines = `- 用简短动词描述动作，例如“保存”“重试保存”；同一操作区域保持清楚的主次关系。
- 主操作使用 \`default\`，并列或次要操作使用 \`secondary\` / \`outline\`，轻量操作使用 \`ghost\`；破坏性动作使用 \`destructive\` 并由业务流程处理确认。
- \`link\` 只改变外观，默认元素仍是按钮。导航动作应使用具有正确链接语义的元素。
- 默认渲染路径由 Base UI useRender 提供 \`type="button"\`；提交动作显式设置 \`type="submit"\`。使用 \`render\` 替换元素时，按目标元素设置表单与交互语义。
- 异步处理中由业务层提供状态文字并控制 \`disabled\`；组件本身不管理请求或保存状态。`;
const accessibility = `- 原生按钮支持 Enter / Space 激活；\`disabled\` 阻止激活并跳过 Tab 顺序。本页保留键盘和禁用行为的交互测试。
- 图标与文字并用时将装饰图标标为 \`aria-hidden="true"\`；纯图标按钮必须有可理解的 \`aria-label\`。
- \`render\` 组合优先保留 \`button\` 元素；更换元素时由调用方负责相应的键盘、焦点和禁用语义。
- 主题配色的对比度验收沿用 Foundations Colors 的记录，键盘测试不代表所有配色均通过 AA。`;
const platform = `Web 与 H5 使用同一个本地 Button，继续消费生产主题、尺寸和状态样式。iOS 工具栏、菜单等原生动作继续使用现有原生组件；WebView 内容中的按钮沿用 Web 实现。本页文档描述 Web / H5 API。`;
const api = `下表列出 MemoCard 的外观约定和常用原生属性。完整 HTML 按钮属性见 [button 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)；\`render\` 的组合契约见 [Base UI useRender](https://base-ui.com/react/utils/use-render)。本地类型为 \`React.ComponentProps<"button">\` 加 \`variant\`、\`size\` 和 \`useRender.RenderProp\`。`;

const meta = {
  title: "components/button",
  component: Button,
  globals: desktopGlobals,
  args: { children: "保存", onClick: fn() },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "outline", "ghost", "destructive", "link"], description: "生产按钮的视觉变体，不改变动作语义。", table: { type: { summary: '"default" | "secondary" | "outline" | "ghost" | "destructive" | "link"' }, defaultValue: { summary: '"default"' } } },
    size: { control: "select", options: ["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"], description: "文字或纯图标按钮的生产尺寸。", table: { type: { summary: '"xs" | "sm" | "default" | "lg" | "icon-xs" | "icon-sm" | "icon" | "icon-lg"' }, defaultValue: { summary: '"default"' } } },
    children: { control: "text", description: "动作文字和可选装饰图标。", table: { type: { summary: "React.ReactNode" } } },
    disabled: { control: "boolean", description: "禁用原生按钮，阻止激活并跳过 Tab 顺序。", table: { type: { summary: "boolean" } } },
    type: { control: "select", options: ["button", "submit", "reset"], description: "表单行为；默认渲染路径为 button，提交需显式设置 submit。", table: { type: { summary: '"button" | "submit" | "reset"' }, defaultValue: { summary: '"button"（默认渲染路径）' } } },
    onClick: { control: false, description: "原生点击回调，业务层处理动作。", table: { type: { summary: "React.MouseEventHandler<HTMLButtonElement>" } } },
    "aria-label": { control: "text", description: "纯图标按钮的可访问名称。", table: { type: { summary: "string" } } },
    render: { control: false, description: "Base UI useRender 的元素或渲染函数，用于组合生产控件。", table: { type: { summary: "useRender.RenderProp" } } },
  },
  parameters: {
    layout: "padded",
    docs: {
      description: { component: "触发保存、重试等单次动作的基础按钮；保留生产外观、键盘激活和禁用行为。" },
      page: (): ReactElement => <ButtonDocsPage overview={Overview} sizes={Sizes} usageStory={Default} properties={Properties} keyboard={KeyboardAndDisabled} usage={usage} anatomy={anatomy} guidelines={guidelines} accessibility={accessibility} platform={platform} api={api} apiArgs={["variant", "size", "children", "disabled", "type", "onClick", "aria-label", "render"]} />,
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: "button" },
};
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

export const Overview: Story = {
  render: () => <ButtonOverview />,
  parameters: { controls: { disable: true }, docs: { story: { height: "312px" } } },
};
export const Properties: Story = {
  render: () => <ButtonProperties />,
  parameters: { controls: { disable: true }, docs: { story: { height: "540px", autoHeight: true } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const preview = within(canvas.getByRole("form", { name: "实时按钮预览" }));
    const caption = '收藏 "项目" {草稿} <笔记>';
    await expect(canvasElement.querySelector("details")).not.toHaveAttribute("open");
    await userEvent.clear(canvas.getByLabelText("children"));
    await userEvent.type(canvas.getByLabelText("children"), '收藏 "项目" {{草稿} <笔记>');
    await userEvent.selectOptions(canvas.getByLabelText("variant"), "outline");
    await userEvent.selectOptions(canvas.getByLabelText("size"), "lg");
    await userEvent.selectOptions(canvas.getByLabelText("type"), "submit");
    const button = preview.getByRole("button", { name: caption });
    await expect(button).toHaveAttribute("data-variant", "outline");
    await expect(button).toHaveAttribute("data-size", "lg");
    await expect(button).toHaveAttribute("type", "submit");
    await userEvent.click(button);
    await expect(canvas.getByText("演示点击：1 次")).toBeVisible();
    await userEvent.click(canvas.getByLabelText("disabled"));
    await expect(button).toBeDisabled();
    button.click();
    await expect(canvas.getByText("演示点击：1 次")).toBeVisible();
    await userEvent.click(canvas.getByText("查看当前代码"));
    const code = canvasElement.querySelector("details code");
    await expect(code).toHaveTextContent(`{${JSON.stringify(caption)}}`);
    await expect(code).toHaveTextContent('variant="outline"');
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    const reset = preview.getByRole("button", { name: "保存" });
    await expect(reset).toBeEnabled();
    await expect(reset).toHaveAttribute("data-variant", "default");
    await expect(reset).toHaveAttribute("data-size", "default");
    await expect(reset).toHaveAttribute("type", "button");
    await expect(canvas.getByText("演示点击：0 次")).toBeVisible();
    await userEvent.selectOptions(canvas.getByLabelText("size"), "icon-sm");
    await userEvent.type(canvas.getByLabelText("aria-label"), '搜索 "标签" <项目>');
    await expect(preview.getByRole("button", { name: '搜索 "标签" <项目>' })).toHaveAttribute("data-size", "icon-sm");
    await expect(code).toHaveTextContent(`aria-label={${JSON.stringify('搜索 "标签" <项目>')}}`);
    await expect(code).toHaveTextContent('import { Search } from "lucide-react"');
    await userEvent.selectOptions(canvas.getByLabelText("type"), "reset");
    await userEvent.click(preview.getByRole("button", { name: '搜索 "标签" <项目>' }));
    await expect(canvas.getByText("演示点击：1 次")).toBeVisible();
    await expect(preview.getByRole("button", { name: '搜索 "标签" <项目>' })).toHaveAttribute("data-size", "icon-sm");
  },
};
