import { useId, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Story } from "@storybook/addon-docs/blocks";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/ui/select";
import { componentDocsRenderer } from "../.storybook/component-docs-renderer";
import { ComponentDocsBestPractices, ComponentDocsExample, ComponentDocsMarkdown, ComponentDocsProperties, ComponentDocsSource, ComponentDocsTemplate, type ComponentDocsParameter, type ComponentDocsPractice } from "../.storybook/component-docs-template";
import { desktopGlobals } from "../.storybook/viewports";

const defaultName = "通用组件文档模板";
const description = "展示组件文档的标准结构、预览与代码切换。示范内容使用现有组件库和系统 token，接入时替换为对应组件的说明。";

function ExampleForm() {
  const id = useId();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("输入文字并提交，查看示例反馈。");
  return <form className="grid w-full max-w-sm gap-3" onSubmit={event => { event.preventDefault(); setMessage(`示例已提交：${value.trim()}`); }}>
    <label htmlFor={id} className="text-sm font-medium">示例文字</label>
    <Input id={id} value={value} placeholder="例如：保存更改" onChange={event => setValue(event.currentTarget.value)} />
    <Button type="submit" disabled={!value.trim()}>提交示例</Button>
    <output aria-live="polite" className="text-sm text-secondary">{message}</output>
  </form>;
}

const exampleCode = `import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ExampleForm() {
  const id = useId()
  const [value, setValue] = useState("")
  const [message, setMessage] = useState("输入文字并提交，查看示例反馈。")
  return <form className="grid w-full max-w-sm gap-3" onSubmit={event => {
    event.preventDefault()
    setMessage(\`示例已提交：\${value.trim()}\`)
  }}>
    <label htmlFor={id} className="text-sm font-medium">示例文字</label>
    <Input id={id} value={value} placeholder="例如：保存更改" onChange={event => setValue(event.currentTarget.value)} />
    <Button type="submit" disabled={!value.trim()}>提交示例</Button>
    <output aria-live="polite" className="text-sm text-secondary">{message}</output>
  </form>
}`;

const templateCode = `import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "../src/components/ui/button"
import { componentDocsRenderer } from "../.storybook/component-docs-renderer"
import { ComponentDocsBestPractices, ComponentDocsTemplate } from "../.storybook/component-docs-template"

const meta = {
  title: "components/example",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      renderer: componentDocsRenderer,
      description: { component: "一句话说明组件的用途。" },
      page: () => <ComponentDocsTemplate
        name="组件名称"
        overview={<>
          <p>填写用途、组成和示例。</p>
          <h2>最佳实践</h2>
          <ComponentDocsBestPractices items={[
            { guidance: "do", description: "填写推荐的使用方式。" },
            { guidance: "dont", description: "填写应避免的使用方式。" },
          ]} />
        </>}
        properties={<p>填写实际参数、默认值和组合契约。</p>}
        accessibility={<p>填写键盘、命名、状态和验证范围。</p>}
      />,
    },
  },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { children: "示例" } }`;

const anatomy = `| 区域 | 内容 |
| --- | --- |
| 标题与简介 | 组件名称和一句话用途说明。 |
| Overview | 用途、组成、最佳实践与可操作示例。 |
| Properties | 对应组件的真实 API、默认值和参数演示。 |
| Accessibility | 键盘、焦点、命名、状态与验证范围。 |
| 示例卡片 | 预览、描述 / Code 切换、代码复制与 Canvas 入口。 |`;

const bestPractices: ComponentDocsPractice[] = [
  { guidance: "do", description: '先说明组件用途，再提供可操作示例、组成和最佳实践；内容依据组件的真实 API。' },
  { guidance: "do", description: '复用现有组件与系统 token，保持标题、表格、代码模块和明暗模式的一致性。' },
  { guidance: "do", description: '在 `overview` 中组合 `ComponentDocsBestPractices`，用 `guidance` 和 `description` 分别填写指引与说明；说明支持 Markdown。' },
  { guidance: "dont", description: '避免照搬其他组件库的属性名，或将仅用于演示的状态描述为生产组件 API。' },
  { guidance: "dont", description: '避免用固定宽度或独立纵向滚动截断说明；长英文如 `ComponentDocumentationBestPractices` 也应在窄屏完整换行。' },
];

const templateParameters: ComponentDocsParameter[] = [
  { name: "name", type: "string", required: true, description: <p>必填，文档标题及页签组的可访问名称。选择预设标题，或在预览输入框中自由编辑。</p> },
  { name: "overview", type: "ReactNode", required: true, description: <p>必填，Overview 页签的内容。</p> },
  { name: "properties", type: "ReactNode", required: true, description: <p>必填，Properties 页签的内容；在当前文档会话中保留挂载。</p> },
  { name: "accessibility", type: "ReactNode", required: true, description: <p>必填，Accessibility 页签的内容。</p> },
];

const accessibility = `## 模板交互约定

| 项目 | 展示与交互 |
| --- | --- |
| 主页签 | 使用现有 line Tabs；左右方向键移动并激活页签，保留可见焦点。 |
| 隐藏面板 | 退出键盘和读屏导航；Properties 保留挂载以保存临时参数。 |
| 示例详情 | 描述和 Code 独立切换；代码提供复制按钮。 |
| 表格 | 窄屏时仅表格区域横向滚动；滚动区域可聚焦。 |
| 明暗模式 | 整个文档画布及示例跟随工具栏主题。 |

## 填写组件说明

接入时补齐实际组件的可访问名称、键盘行为、焦点管理、禁用及加载状态，并记录已验证的范围。此展示页的表单只演示界面交互，提交结果保留在当前示例中。`;

function TemplateDocsPage() {
  const id = useId();
  const [name, setName] = useState(defaultName);
  const title = name.trim() || defaultName;
  const items = [{ value: defaultName, label: "默认标题" }, { value: "Button", label: "Button" }, { value: "Input", label: "Input" }];
  // Keep the selected item stable while the free-form title changes per keystroke.
  const preset = items.some(item => item.value === title) ? title : "custom";
  if (preset === "custom") items.push({ value: "custom", label: "自定义标题" });
  const parameters = templateParameters.map<ComponentDocsParameter>(parameter => parameter.name === "name" ? {
    ...parameter,
    control: props => <Select value={preset} items={items} onValueChange={value => { if (value !== null && value !== "custom") setName(value); }}>
      <SelectTrigger {...props} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent align="start">{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
    </Select>,
  } : parameter);
  const code = templateCode.replace('name="组件名称"', `name={${JSON.stringify(title)}}`);
  return <ComponentDocsTemplate name={title} overview={<>
    <h2>预览与用法</h2>
    <ComponentDocsExample title="示例 — 操作表单" story="component-docs-template--example" code={exampleCode}
      description="输入文字后提交，查看内存中的反馈；切换 Code 可复制完整用法。" iframe><Story of={Example} height="240px" /></ComponentDocsExample>
    <h2>组成</h2><ComponentDocsMarkdown>{anatomy}</ComponentDocsMarkdown>
    <h2>最佳实践</h2><ComponentDocsBestPractices items={bestPractices} />
    <h2>接入模板</h2><p>在组件的 Storybook 文件中配置文档页，再替换三个内容区。</p>
    <ComponentDocsSource code={templateCode} />
  </>} properties={<>
    <h2>参数演示</h2>
    <ComponentDocsProperties name="ComponentDocsTemplate" code={code} parameters={parameters} resetLabel="恢复默认标题" onReset={() => setName(defaultName)} preview={
      <div className="sb-unstyled grid w-full max-w-sm gap-3">
        <label htmlFor={id} className="text-sm font-medium">文档标题（name）</label>
        <Input id={id} value={name} onChange={event => setName(event.currentTarget.value)} />
      </div>
    }>
      <h2>模板参数</h2>
      <p>以下是 ComponentDocsTemplate 的参数；示例表单使用的 Input 和 Button API 由各自组件文档维护。</p>
    </ComponentDocsProperties>
  </>} accessibility={<ComponentDocsMarkdown>{accessibility}</ComponentDocsMarkdown>} />;
}

const meta = {
  id: "component-docs-template",
  title: "文档模板/通用组件文档",
  component: ExampleForm,
  globals: desktopGlobals,
  parameters: {
    layout: "padded",
    controls: { disable: true },
    docs: {
      renderer: componentDocsRenderer,
      page: TemplateDocsPage,
      description: { component: description },
      story: { autoHeight: true, centered: true },
    },
  },
} satisfies Meta<typeof ExampleForm>;
export default meta;
type TemplateStory = StoryObj<typeof meta>;

export const Example: TemplateStory = { tags: ["!dev"] };
