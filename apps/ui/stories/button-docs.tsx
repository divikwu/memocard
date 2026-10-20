import { useId, useState, type ComponentProps } from "react";
import { Description, Markdown, Story, Title } from "@storybook/addon-docs/blocks";
import { Search } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { ButtonCodePanel } from "./button-code-panel";
import { buttonArgTypes, buttonParameters } from "./button-docs.data";
import "./button-docs.css";

type Properties = {
  variant: typeof buttonArgTypes.variant.options[number];
  size: typeof buttonArgTypes.size.options[number];
  children: string;
  disabled: boolean;
  type: "button" | "submit" | "reset";
  "aria-label": string;
};
const defaults: Properties = { variant: "default", size: "default", children: "保存", disabled: false, type: "button", "aria-label": "" };

export function ButtonOverview() {
  return <div className="button-overview-stage">
    {buttonArgTypes.variant.options.map(variant => <Button key={variant} type="button" variant={variant}>{variant}</Button>)}
  </div>;
}

export function ButtonProperties() {
  const id = useId();
  const [values, setValues] = useState(defaults);
  const [clicks, setClicks] = useState(0);
  const icon = values.size.startsWith("icon");
  const label = values["aria-label"].trim() || (icon ? "搜索" : undefined);
  const attributes = [`variant="${values.variant}"`, `size="${values.size}"`, `type="${values.type}"`, ...(values.disabled ? ["disabled"] : []), ...(label ? [`aria-label={${JSON.stringify(label)}}`] : [])];
  const code = `import { Button } from "@/components/ui/button"${icon ? '\nimport { Search } from "lucide-react"' : ""}

export function Example() {
  return (
    <Button
      ${attributes.join("\n      ")}
    >
      ${icon ? '<Search aria-hidden="true" />' : `{${JSON.stringify(values.children)}}`}
    </Button>
  )
}`;

  return <section className="button-properties" aria-label="Button 参数演示">
    <ButtonCodePanel code={code}>
        <form className="button-properties-stage" aria-label="实时按钮预览" onSubmit={event => event.preventDefault()} onReset={event => event.preventDefault()}>
          <Button variant={values.variant} size={values.size} type={values.type} disabled={values.disabled} aria-label={label} onClick={() => setClicks(count => count + 1)}>
            {icon ? <Search aria-hidden="true" /> : values.children}
          </Button>
        </form>
        <output className="button-properties-feedback" aria-live="polite">演示点击：{clicks} 次</output>
    </ButtonCodePanel>
    <p className="button-properties-note">下表直接控制预览。点击计数属于内存示例，submit / reset 不提交或重置页面。</p>
    <div className="button-properties-table-wrap" role="region" aria-label="Button 参数表" tabIndex={0}><table className="button-properties-table">
      <caption>Button API 与实时参数</caption>
      <thead><tr><th scope="col">名称</th><th scope="col">类型 / 默认值</th><th scope="col">说明</th><th scope="col">当前值</th></tr></thead>
      <tbody>{buttonParameters.map(name => {
        const parameter = buttonArgTypes[name];
        const controlId = `${id}-${name}`;
        return <tr key={name}>
          <th scope="row">{parameter.control === false ? <code>{name}</code> : <label htmlFor={controlId}><code>{name}</code></label>}</th>
          <td><code>{parameter.table.type.summary}</code><small>默认：{parameter.table.defaultValue.summary}</small></td>
          <td id={`${controlId}-description`}>{parameter.description}</td>
          <td>{name === "onClick" ? <span>点击计数（只读）</span> : name === "render" ? <span>原生 button（只读）</span> : name === "disabled" ?
            <input id={controlId} type="checkbox" checked={values.disabled} aria-describedby={`${controlId}-description`} onChange={event => setValues({ ...values, disabled: event.currentTarget.checked })} /> : name === "children" || name === "aria-label" ?
            <Input id={controlId} value={values[name]} disabled={name === "children" && icon} aria-describedby={`${controlId}-description`} onChange={event => setValues({ ...values, [name]: event.currentTarget.value })} /> :
            <select id={controlId} value={values[name]} aria-describedby={`${controlId}-description`} onChange={event => setValues({ ...values, [name]: event.currentTarget.value })}>{buttonArgTypes[name].options.map(value => <option key={value}>{value}</option>)}</select>
          }</td>
        </tr>;
      })}</tbody>
    </table></div>
    <Button type="button" variant="outline" size="sm" onClick={() => { setValues(defaults); setClicks(0); }}>Reset</Button>
  </section>;
}

type StoryReference = ComponentProps<typeof Story>["of"];
type ButtonDocsPageProps = {
  overview: StoryReference;
  sizes: StoryReference;
  usageStory: StoryReference;
  properties: StoryReference;
  keyboard: StoryReference;
  examples: StoryReference;
  usage: string;
  anatomy: string;
  guidelines: string;
  accessibility: string;
  platform: string;
  api: string;
};

const overviewCode = `import { Button } from "@/components/ui/button"

export function ButtonVariants() {
  return <div className="flex flex-wrap items-center justify-center gap-3">
    ${buttonArgTypes.variant.options.map(variant => `<Button variant="${variant}">${variant}</Button>`).join("\n    ")}
  </div>
}`;

const sizesCode = `import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ButtonSizes() {
  return <div className="flex flex-wrap items-center gap-3">
    ${buttonArgTypes.size.options.map(size => size.startsWith("icon") ? `<Button size="${size}" aria-label="搜索"><Search aria-hidden="true" /></Button>` : `<Button size="${size}">${size}</Button>`).join("\n    ")}
  </div>
}`;

export const buttonExamplesCode = `import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ButtonExamples() {
  return <div className="flex flex-wrap items-center gap-3">
    <Button type="button"><Search aria-hidden="true" />搜索笔记</Button>
    <Button type="button" disabled>暂不可用</Button>
    <Button variant="link" render={<a href="#button-usage" target="_self" />}>查看用法</Button>
    <p id="button-usage" tabIndex={-1}>链接目标：此示例中的按钮用法。</p>
  </div>
}`;

export function ButtonExamples() {
  return <div className="button-examples-stage">
    <Button type="button"><Search aria-hidden="true" />搜索笔记</Button>
    <Button type="button" disabled>暂不可用</Button>
    <Button variant="link" render={<a href="#button-usage" target="_self" />}>查看用法</Button>
    <p id="button-usage" tabIndex={-1}>链接目标：此示例中的按钮用法。</p>
  </div>;
}

export function ButtonDocsPage({ overview, sizes, usageStory, properties, keyboard, examples, usage, anatomy, guidelines, accessibility, platform, api }: ButtonDocsPageProps) {
  return <div className="button-docs">
    <Title>Button</Title><Description />
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="button-docs-tab-list" aria-label="Button 文档" activateOnFocus>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="properties">Properties</TabsTrigger>
        <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
      </TabsList>
      <TabsContent className="button-docs-panel" value="overview">
        <ButtonCodePanel code={overviewCode} iframe><Story of={overview} /></ButtonCodePanel>
        <h2 id="button-usage">用法</h2><ButtonCodePanel code={usage} iframe><Story of={usageStory} height="96px" /></ButtonCodePanel>
        <h2>组成</h2><Markdown>{anatomy}</Markdown>
        <h2>使用建议</h2><Markdown>{guidelines}</Markdown>
        <h2>示例</h2><h3>尺寸</h3><ButtonCodePanel code={sizesCode} iframe><Story of={sizes} /></ButtonCodePanel>
        <h3>图文、禁用与链接</h3><ButtonCodePanel code={buttonExamplesCode} iframe><Story of={examples} height="112px" /></ButtonCodePanel>
      </TabsContent>
      <TabsContent className="button-docs-panel" value="properties" keepMounted>
        <p>调整参数行，即时查看生产 Button；展开“查看代码”复制对应 JSX。</p>
        <Story of={properties} />
        <Markdown>{api}</Markdown>
      </TabsContent>
      <TabsContent className="button-docs-panel" value="accessibility">
        <Markdown>{accessibility}</Markdown>
        <h2>键盘与禁用状态</h2><ButtonCodePanel code={`import { Button } from "@/components/ui/button"\n\nexport function KeyboardExample() {\n  return <div className="flex gap-3"><Button>保存</Button><Button disabled>不可用</Button><Button variant="outline">下一项</Button></div>\n}`} iframe><Story of={keyboard} height="96px" /></ButtonCodePanel>
        <h2>平台差异</h2><Markdown>{platform}</Markdown>
      </TabsContent>
    </Tabs>
  </div>;
}
