import { useId, useState } from "react";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./components/select";
import { ComponentDocsBestPractices, ComponentDocsExample, ComponentDocsSource, ComponentDocsTemplate } from "./ComponentDocsTemplate";

const defaultName = "通用组件文档模板";
const description = "组件文档的统一结构：概览、参数与无障碍指南。示例使用 Luma 组件、Astryx 语义 token 和 Tailwind 基础色板。";

export function TemplateExampleForm() {
  const id = useId();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("输入文字并提交，查看示例反馈。");
  return <form className="luma-field mx-auto w-full max-w-sm" aria-label="模板操作表单" onSubmit={event => {
    event.preventDefault();
    setMessage(`示例已提交：${value.trim()}`);
  }}>
    <label htmlFor={id}>示例文字</label>
    <Input id={id} value={value} aria-describedby={`${id}-feedback`} placeholder="例如：保存更改" onChange={event => setValue(event.currentTarget.value)} />
    <Button type="submit" disabled={!value.trim()} aria-describedby={`${id}-feedback`}>提交示例</Button>
    <output id={`${id}-feedback`} aria-live="polite" className="luma-status">{value.trim() ? message : "请先输入文字，再提交示例。"}</output>
  </form>;
}

const exampleCode = `import { useId, useState } from "react";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";

export function ExampleForm() {
  const id = useId();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("输入文字并提交。");
  return <form className="mx-auto grid w-full max-w-sm gap-2" aria-label="模板操作表单" onSubmit={event => {
    event.preventDefault();
    setMessage(\`示例已提交：\${value.trim()}\`);
  }}>
    <label htmlFor={id}>示例文字</label>
    <Input id={id} value={value} aria-describedby={\`\${id}-feedback\`}
      onChange={event => setValue(event.currentTarget.value)} />
    <Button type="submit" disabled={!value.trim()}
      aria-describedby={\`\${id}-feedback\`}>提交示例</Button>
    <output id={\`\${id}-feedback\`} aria-live="polite">
      {value.trim() ? message : "请先输入文字，再提交示例。"}
    </output>
  </form>;
}`;

const templateCode = `import type { Meta, StoryObj } from "@storybook/react-vite";
import { componentDocsRenderer } from "@ui/component-docs-renderer";
import { LumaStoryFrame } from "@ui/LumaPage";
import { ComponentDocsTemplate, ComponentDocsExample,
  ComponentDocsSource, ComponentDocsBestPractices } from "@ui/ComponentDocsTemplate";
import { Button } from "@ui/components/button";

const usageCode = '<Button type="button">示例操作</Button>';

function ExampleDocs() {
  return <ComponentDocsTemplate
    name="组件名称"
    description="一句话说明组件的用途。"
    component="example"
    hero={<Button type="button">示例操作</Button>}
    overview={<>
      <section><h2>用法</h2>
      <ComponentDocsExample
        title="组件名称 — Usage"
        code={usageCode}
        story="ui-example--example"
        description="填写使用场景、组成和操作方式。"
      ><Button type="button">示例操作</Button></ComponentDocsExample></section>
      <section><h2>最佳实践</h2>
      <ComponentDocsBestPractices items={[
        { guidance: "do", description: "填写推荐的使用方式。" },
        { guidance: "dont", description: "填写应避免的使用方式。" },
      ]} /></section>
    </>}
    properties={<section>
      <h2>参数与用法</h2>
      <p>填写当前组件的真实 API、默认值与组合契约。</p>
      <ComponentDocsSource code={usageCode} />
    </section>}
    accessibility={<section>
      <h2>无障碍指南</h2>
      <p>填写可访问名称、键盘操作、焦点和状态反馈。</p>
    </section>}
  />;
}

const meta = {
  title: "components/example",
  id: "ui-example",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: { renderer: componentDocsRenderer, page: ExampleDocs },
  },
} satisfies Meta<typeof Button>;
export default meta;
export const Example: StoryObj<typeof meta> = {
  render: () => <LumaStoryFrame><Button type="button">示例操作</Button></LumaStoryFrame>,
};`;

const parameters = [
  { name: "name", type: "string", required: true, description: "文档标题及页签组名称。" },
  { name: "description", type: "string", required: false, description: "标题下的一句话用途说明。" },
  { name: "hero", type: "ReactNode", required: false, description: "Overview 页签顶部的主要组件预览。" },
  { name: "overview", type: "ReactNode", required: true, description: "概览、组成、实践与可操作示例。" },
  { name: "properties", type: "ReactNode", required: true, description: "真实属性、默认值与参数演示；切换页签时保留挂载。" },
  { name: "accessibility", type: "ReactNode", required: true, description: "键盘、焦点、名称与状态约定。" },
  { name: "component", type: "string", required: false, description: "可选的组件文档标识。" },
];

const practices = [
  { guidance: "do" as const, description: "先说明组件用途，再给出可操作示例、组成与实际 API。" },
  { guidance: "do" as const, description: "预览使用 Luma 组件，样式引用 Astryx 语义 token，字体与明暗模式保持一致。" },
  { guidance: "do" as const, description: "使用真实 Canvas 故事 ID，复制的代码应与当前组件接口一致。" },
  { guidance: "dont" as const, description: "避免照搬其他组件库的属性名，或把演示状态描述为组件提供的属性。" },
  { guidance: "dont" as const, description: "避免固定内容宽度导致窄屏裁切；表格和代码使用自身滚动区域。" },
];

export function ComponentDocsTemplatePage() {
  const id = useId();
  const [name, setName] = useState(defaultName);
  const title = name.trim() || defaultName;
  const items = [{ value: defaultName, label: "默认标题" }, { value: "Button", label: "Button" }, { value: "Input", label: "Input" }, { value: "custom", label: "自定义标题" }];
  const preset = items.some(item => item.value === title) ? title : "custom";
  const code = templateCode.replace('name="组件名称"', `name={${JSON.stringify(title)}}`);
  return <ComponentDocsTemplate name={title} description={description} component="template" hero={<TemplateExampleForm />} overview={<>
    <section><h2>预览与用法</h2><ComponentDocsExample title="示例 — 操作表单" story="ui-component-docs-template--example" code={exampleCode} description="输入文字并提交，反馈只保留在当前示例中；切换 Code 可复制用法。"><TemplateExampleForm /></ComponentDocsExample></section>
    <section><h2>组成</h2><ul><li>标题与简介：组件名称和用途。</li><li>Overview：主要预览、用法、组成和最佳实践。</li><li>Properties：实际参数、默认值和组合契约。</li><li>Accessibility：名称、键盘、焦点和验证范围。</li><li>示例卡片：预览、描述 / Code、复制代码与 Canvas 入口。</li></ul></section>
    <section><h2>最佳实践</h2><ComponentDocsBestPractices items={practices} /></section>
    <section><h2>接入模板</h2><p>在组件的 .stories.tsx 中配置模板，替换 title、id 和三个内容区；示例卡片的 story 与同文件导出的 Canvas 保持对应。</p><ComponentDocsSource code={templateCode} /></section>
  </>} properties={<>
    <section><h2>参数演示</h2><p>选择一个预设标题，或直接编辑 name，查看当前文档标题与代码同步变化。</p>
      <div className="ui-docs-example"><div className="ui-docs-example-preview"><div className="mx-auto grid w-full max-w-sm gap-4">
        <div className="luma-field"><label htmlFor={`${id}-preset`}>标题预设</label><Select value={preset} items={items} onValueChange={value => { if (value && value !== "custom") setName(value); }}><SelectTrigger id={`${id}-preset`}><SelectValue /></SelectTrigger><SelectContent align="start"><SelectGroup>{items.map(item => <SelectItem key={item.value} value={item.value} disabled={item.value === "custom"}>{item.label}</SelectItem>)}</SelectGroup></SelectContent></Select></div>
        <div className="luma-field"><label htmlFor={`${id}-title`}>文档标题（name）</label><Input id={`${id}-title`} value={name} onChange={event => setName(event.currentTarget.value)} /></div>
        <Button type="button" variant="outline" onClick={() => setName(defaultName)}>恢复默认标题</Button>
      </div></div></div>
    </section>
    <section><h2>模板参数</h2><div className="ui-docs-table-wrap ui-docs-properties-wrap" role="region" aria-label="ComponentDocsTemplate 参数表" tabIndex={0}><table className="ui-docs-table ui-docs-properties"><thead><tr><th scope="col">参数</th><th scope="col">类型 / 说明</th><th scope="col">必填</th></tr></thead><tbody>{parameters.map(parameter => <tr key={parameter.name}><th scope="row"><code>{parameter.name}</code></th><td><code>{parameter.type}</code><p>{parameter.description}</p></td><td>{parameter.required ? "是" : "否"}</td></tr>)}</tbody></table></div></section>
    <section><h2>当前用法</h2><ComponentDocsSource code={code} /></section>
  </>} accessibility={<>
    <section><h2>模板交互约定</h2><div className="ui-docs-table-wrap" role="region" aria-label="模板无障碍约定" tabIndex={0}><table className="ui-docs-table"><thead><tr><th scope="col">项目</th><th scope="col">展示与交互</th></tr></thead><tbody>
      <tr><th scope="row">主页签</th><td>使用 Base UI Tabs；方向键移动焦点，Enter 或空格激活页签，焦点保持可见。</td></tr>
      <tr><th scope="row">隐藏面板</th><td>退出键盘和读屏导航；Properties 保留挂载，保存当前参数。</td></tr>
      <tr><th scope="row">示例与代码</th><td>描述与 Code 支持切换，代码提供复制反馈和可聚焦的滚动区域。</td></tr>
      <tr><th scope="row">表格</th><td>窄屏时在表格区域内横向滚动，滚动区域可键盘聚焦。</td></tr>
      <tr><th scope="row">明暗模式</th><td>文档、示例与 Portal 均使用当前工具栏主题。</td></tr>
    </tbody></table></div></section>
    <section><h2>填写组件说明</h2><p>补齐真实组件的可访问名称、键盘行为、焦点管理与禁用状态；异步操作还需提供加载和结果反馈。记录实际验证范围。</p><p className="ui-docs-note">此页面的表单只演示本地交互，不会写入真实数据。</p></section>
  </>} />;
}
