import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import { fn } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { componentDocsRenderer } from "../.storybook/component-docs-renderer";
import { ComponentDocsStandalone, type ComponentDocsPractice } from "../.storybook/component-docs-template";
import { desktopGlobals } from "../.storybook/viewports";
import { ButtonActions, ButtonAnatomy, ButtonDocsPage, ButtonExamples, ButtonLoading, ButtonOverview, ButtonProperties, ButtonSizes, ButtonStates } from "./button-docs";
import { buttonArgTypes } from "./button-docs.data";

const usage = `import { Button } from "@/components/ui/button"

export function SaveButton() {
  return <Button type="button">保存</Button>
}`;
const anatomy = `图标和文字通过 \`children\` 组合；前置、后置图标均为可选内容。纯图标按钮另用 \`aria-label\` 提供动作名称，\`size\` 只控制外框尺寸。`;
const bestPractices: ComponentDocsPractice[] = [
  { guidance: "do", description: '主操作使用 `default`，次要操作使用 `secondary` / `outline`，轻量操作使用 `ghost`，按重要程度建立清楚的层级。' },
  { guidance: "do", description: '用简短动词描述动作，例如“保存更改”“重试保存”，让使用者知道点击后的结果。' },
  { guidance: "do", description: '纯图标按钮用 `aria-label` 提供明确的动作名称，装饰图标设置 `aria-hidden="true"`；`size` 只控制外框尺寸。' },
  { guidance: "do", description: '异步处理中由业务层组合状态文字、`aria-busy` 和 `disabled`，并提供完成反馈；组件本身不管理请求或提供 `loading` 属性。' },
  { guidance: "do", description: '默认渲染路径提供 `type="button"`；表单提交显式设置 `type="submit"`。使用 `render` 替换元素时，按目标元素设置表单与交互语义。' },
  { guidance: "dont", description: '避免在同一区域放置多个同等强调的主操作；保留一个最重要的动作，例如“保存更改”配次要的“取消”。' },
  { guidance: "dont", description: '避免未经确认执行不可逆的删除操作；使用 `destructive` 表达危险动作，并由业务流程提供确认步骤。' },
  { guidance: "dont", description: '避免只用按钮外观表达导航。`variant="link"` 仍默认渲染按钮；导航应通过 `render` 组合真实的 `a href`。' },
];
const accessibility = `## 对比度与状态

| 要求 | 对比度 | 适用状态 | 检查方式 |
| --- | --- | --- | --- |
| 文字标签 | 4.5:1 | 默认、悬停、按下 | 按文字和最终背景检查；真正的大文本另按 3:1，size="lg" 本身不等于大文本。 |
| 必要图标、加载指示 | 3:1 | 纯图标、加载 | 按图标或旋转弧线与实际按钮背景检查。装饰图标不单独要求。 |
| 必要的控件边界 | 3:1 | 默认 | 仅当边界是识别控件所必需时适用。 |
| 键盘焦点指示 | 3:1 | focus-visible | 按焦点指示与相邻颜色检查；不能用 hover 替代焦点。 |
| 禁用外观 | 豁免 | disabled | 真正禁用的控件不要求达到上述对比度。 |

依据：[文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[非文本对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)、[可见焦点](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)。

## 键盘与命名

| 项目 | 使用要求 |
| --- | --- |
| 键盘与焦点 | 原生 \`button\` 用 Tab / Shift+Tab 移动焦点，Enter / Space 激活；保留可见的 focus-visible 指示，hover 不能替代键盘焦点。 |
| 可访问名称 | 优先用可见动作文字；装饰图标设 \`aria-hidden="true"\`，纯图标按钮提供明确的 \`aria-label\`。另设名称时须包含可见文字。 |
| 禁用 | 原生 \`disabled\` 阻止激活并退出 Tab 顺序；透明度或 \`aria-disabled\` 本身不能替代原生禁用。 |
| 链接与 render | \`variant="link"\` 仅改外观；导航组合真实 \`a href\` 并遵循 Enter 激活，\`disabled\` 不会原生禁用链接。替换元素后由调用方负责语义、键盘与焦点；自定义组件须转发 props 和 ref。 |

依据：[WAI Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)、[WAI Link](https://www.w3.org/WAI/ARIA/apg/patterns/link/)、[Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)、[Base UI Composition](https://base-ui.com/react/handbook/composition)。

## 当前验证边界

[Foundations Colors 默认](/story/foundations-colors--default) 与 [Blue Slate](/story/foundations-colors--blue-slate) 记录代表主题色样；浅色 blue / slate 的 primary 配白字约 **3.7617777:1**，低于普通文字 AA，属于既有缺口。本页保留外观，不把键盘通过写成全部配色 AA 通过。

颜色故事已检查真实 Button 的 hover 背景变化、键盘可达、focus-visible 样式存在及 disabled；尚未量化各按钮变体 / 各状态的文字、边界、焦点环对比度。已有固定图标的 3:1 量测不能外推到全部按钮图标。完整范围见[验证记录](https://github.com/divikwu/memocard/blob/main/design/validation.md#foundations-颜色状态排版与动效边界2026-10-19)。`;
const platform = `Web 与 H5 使用同一个本地 Button，继续消费生产主题、尺寸和状态样式。iOS 工具栏、菜单等原生动作继续使用现有原生组件；WebView 内容中的按钮沿用 Web 实现。本页文档描述 Web / H5 API。`;
const api = `本表列出 MemoCard 的外观约定和常用原生属性。完整 HTML 按钮属性见 [button 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button)；\`render\` 的组合契约见 [Base UI useRender](https://base-ui.com/react/utils/use-render)。本地类型为 \`React.ComponentProps<"button">\` 加 \`variant\`、\`size\` 和 \`useRender.RenderProp\`。`;

const meta = {
  title: "components/button",
  component: Button,
  globals: desktopGlobals,
  args: { children: "保存", onClick: fn() },
  argTypes: buttonArgTypes,
  decorators: [(Story, context) => context.parameters.layout === "fullscreen" ? <ComponentDocsStandalone><Story /></ComponentDocsStandalone> : <Story />],
  parameters: {
    layout: "padded",
    docs: {
      renderer: componentDocsRenderer,
      story: { centered: true },
      description: { component: "用于保存、重试、删除等操作的基础按钮，支持文字、图标与不同强调层级。" },
      page: (): ReactElement => <ButtonDocsPage overview={Overview} sizes={Sizes} usageStory={Default} properties={Properties} keyboard={KeyboardAndDisabled} examples={Examples} states={States} loading={Loading} anatomyStory={Anatomy} actions={Actions} usage={usage} anatomy={anatomy} bestPractices={bestPractices} accessibility={accessibility} platform={platform} api={api} />,
    },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { type: "button" },
};
export const Variants: Story = {
  parameters: { controls: { exclude: ["variant", "children"] } },
  render: args => <div className="flex flex-wrap items-center gap-3">{(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map(variant => <Button {...args} key={variant} variant={variant}>{variant}</Button>)}</div>,
};
export const Sizes: Story = {
  parameters: { controls: { exclude: ["size", "children", "aria-label"] }, docs: { story: { autoHeight: true } } },
  render: args => <ButtonSizes args={args} />,
};
export const KeyboardAndDisabled: Story = {
  parameters: { controls: { disable: true } },
  render: args => <div className="flex gap-3"><Button {...args}>保存</Button><Button {...args} disabled>不可用</Button><Button variant="outline">下一项</Button></div>,
};

export const Overview: Story = {
  tags: ["!dev"],
  render: () => <ButtonOverview />,
  parameters: { layout: "fullscreen", controls: { disable: true }, docs: { story: { height: "312px" } } },
};
export const Examples: Story = {
  tags: ["!dev"],
  render: () => <ButtonExamples />,
  parameters: { layout: "fullscreen", controls: { disable: true }, docs: { story: { autoHeight: true, centered: false } } },
};
export const Properties: Story = {
  tags: ["!dev"],
  render: () => <ButtonProperties />,
  parameters: { layout: "fullscreen", controls: { disable: true }, docs: { story: { height: "540px", autoHeight: true, centered: false } } },
};

export const Anatomy: Story = {
  tags: ["!dev"],
  render: () => <ButtonAnatomy />,
  parameters: { layout: "fullscreen", controls: { disable: true }, docs: { story: { autoHeight: true } } },
};
export const States: Story = {
  tags: ["!dev"],
  render: () => <ButtonStates />,
  parameters: { layout: "fullscreen", controls: { disable: true }, docs: { story: { autoHeight: true } } },
};
export const Loading: Story = {
  tags: ["!dev"],
  render: () => <ButtonLoading />,
  parameters: { controls: { disable: true } },
};
export const Actions: Story = {
  tags: ["!dev"],
  render: () => <ButtonActions />,
  parameters: { layout: "fullscreen", controls: { disable: true }, docs: { story: { autoHeight: true, centered: false, height: "320px" } } },
};
