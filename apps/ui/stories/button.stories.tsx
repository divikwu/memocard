import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Search } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { desktopGlobals } from "../.storybook/viewports";
import { ButtonDocsPage, ButtonExamples, ButtonOverview, ButtonProperties } from "./button-docs";
import { buttonArgTypes } from "./button-docs.data";

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
const accessibility = `### 键盘与命名

| 项目 | 使用要求 |
| --- | --- |
| 键盘与焦点 | 原生 \`button\` 用 Tab / Shift+Tab 移动焦点，Enter / Space 激活；保留可见的 focus-visible 指示，hover 不能替代键盘焦点。 |
| 可访问名称 | 优先用可见动作文字；装饰图标设 \`aria-hidden="true"\`，纯图标按钮提供明确的 \`aria-label\`。另设名称时须包含可见文字。 |
| 禁用 | 原生 \`disabled\` 阻止激活并退出 Tab 顺序；透明度或 \`aria-disabled\` 本身不能替代原生禁用。 |
| 链接与 render | \`variant="link"\` 仅改外观；导航组合真实 \`a href\` 并遵循 Enter 激活，\`disabled\` 不会原生禁用链接。替换元素后由调用方负责语义、键盘与焦点；自定义组件须转发 props 和 ref。 |

依据：[WAI Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)、[WAI Link](https://www.w3.org/WAI/ARIA/apg/patterns/link/)、[Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)、[Base UI Composition](https://base-ui.com/react/handbook/composition)。

### 对比度与状态

- 普通文字对实际背景按 **4.5:1** 检查，hover / focus 状态同样适用；\`size="lg"\` 不等于 WCAG 大文本。真正的大文本另按 3:1。[文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- 识别控件或状态所必需的图标、边界及作者定义的焦点指示，与相邻颜色按 **3:1** 检查；装饰边框、真正禁用控件有相应例外，也不要求 hover 前后两色相差 3:1。[非文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)、[可见焦点](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

### 当前验证边界

[Foundations Colors 默认](/?path=/story/foundations-colors--default) 与 [Blue Slate](/?path=/story/foundations-colors--blue-slate) 记录代表主题色样；浅色 blue / slate 的 primary 配白字约 **3.7617777:1**，低于普通文字 AA，属于既有缺口。本页保留外观，不把键盘通过写成全部配色 AA 通过。

颜色故事已检查真实 Button 的 hover 背景变化、键盘可达、focus-visible 样式存在及 disabled；尚未量化各按钮变体 / 各状态的文字、边界、焦点环对比度。已有固定图标的 3:1 量测不能外推到全部按钮图标。完整范围见[验证记录](https://github.com/divikwu/memocard/blob/main/design/validation.md#foundations-颜色状态排版与动效边界2026-10-19)。`;
const platform = `Web 与 H5 使用同一个本地 Button，继续消费生产主题、尺寸和状态样式。iOS 工具栏、菜单等原生动作继续使用现有原生组件；WebView 内容中的按钮沿用 Web 实现。本页文档描述 Web / H5 API。`;
const api = `本表列出 MemoCard 的外观约定和常用原生属性。完整 HTML 按钮属性见 [button 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)；\`render\` 的组合契约见 [Base UI useRender](https://base-ui.com/react/utils/use-render)。本地类型为 \`React.ComponentProps<"button">\` 加 \`variant\`、\`size\` 和 \`useRender.RenderProp\`。`;

const meta = {
  title: "components/button",
  component: Button,
  globals: desktopGlobals,
  args: { children: "保存", onClick: fn() },
  argTypes: buttonArgTypes,
  parameters: {
    layout: "padded",
    docs: {
      story: { centered: true },
      description: { component: "触发保存、重试等单次动作的基础按钮；保留生产外观、键盘激活和禁用行为。" },
      page: (): ReactElement => <ButtonDocsPage overview={Overview} sizes={Sizes} usageStory={Default} properties={Properties} keyboard={KeyboardAndDisabled} examples={Examples} usage={usage} anatomy={anatomy} guidelines={guidelines} accessibility={accessibility} platform={platform} api={api} />,
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
export const Examples: Story = {
  render: () => <ButtonExamples />,
  parameters: { controls: { disable: true }, docs: { story: { height: "112px", autoHeight: true, centered: false } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const action = canvas.getByRole("button", { name: "搜索笔记" });
    await expect(action.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await expect(canvas.getByRole("button", { name: "暂不可用" })).toBeDisabled();
    const link = canvas.getByRole("link", { name: "查看用法" });
    await expect(link).toHaveAttribute("href", "#button-usage");
    await expect(link).toHaveAttribute("target", "_self");
    await userEvent.click(action);
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText("链接目标：此示例中的按钮用法。")).toHaveFocus();
  },
};
export const Properties: Story = {
  render: () => <ButtonProperties />,
  parameters: { layout: "fullscreen", controls: { disable: true }, docs: { story: { height: "540px", autoHeight: true, centered: false } } },
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
    await expect(canvas.getByRole("table", { name: "Button API 与实时参数" })).toBeVisible();
    await expect(canvas.getAllByRole("row")).toHaveLength(9);
    await userEvent.click(canvas.getByText("查看代码"));
    await waitFor(() => expect(canvasElement.querySelector("details pre")).toHaveTextContent('variant="outline"'));
    const code = canvasElement.querySelector("details pre");
    await expect(code).toHaveTextContent(`{${JSON.stringify(caption)}}`);
    await expect(code).toHaveTextContent('variant="outline"');
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = fn<(text: string) => Promise<void>>(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      const copy = await canvas.findByRole("button", { name: /^Copy$/ });
      await userEvent.click(copy);
      await expect(writeText).toHaveBeenCalledWith(code?.textContent);
      await expect(await canvas.findByRole("button", { name: /^Copied!$/ })).toBeVisible();
    } finally {
      if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
      else Reflect.deleteProperty(navigator, "clipboard");
    }
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
