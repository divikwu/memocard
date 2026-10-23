import { useId, useState, type ComponentProps } from "react";
import { Markdown, Story } from "@storybook/addon-docs/blocks";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../src/components/ui/dialog";
import { Input } from "../src/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../src/components/ui/select";
import { Switch } from "../src/components/ui/switch";
import { ComponentDocsBestPractices, ComponentDocsExample, ComponentDocsMarkdown, ComponentDocsProperties, ComponentDocsTemplate, type ComponentDocsParameter, type ComponentDocsPractice } from "../.storybook/component-docs-template";
import { buttonArgTypes, buttonParameters, buttonSizeExamples } from "./button-docs.data";
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

export function ButtonAnatomy() {
  return <figure className="button-anatomy">
    <div className="button-example-stage"><Button type="button"><Search aria-hidden="true" />搜索笔记</Button></div>
    <figcaption><table className="component-docs-table" aria-label="Button 组成">
      <thead><tr><th scope="col">组成</th><th scope="col">说明</th></tr></thead>
      <tbody>
        <tr><th scope="row">容器</th><td>原生 button：承载点击、焦点和禁用行为。</td></tr>
        <tr><th scope="row">前置图标 · 可选</th><td>Search：辅助识别动作，使用 aria-hidden。</td></tr>
        <tr><th scope="row">动作文字</th><td>“搜索笔记”：说明动作，同时提供可访问名称。</td></tr>
      </tbody>
    </table></figcaption>
  </figure>;
}

export function ButtonSizes({ args = {} }: { args?: ComponentProps<typeof Button> }) {
  return <div className="button-size-gallery">
    {[false, true].map(icon => <section key={String(icon)} aria-label={icon ? "图标按钮尺寸" : "文字按钮尺寸"}>
      <p className="button-example-label">{icon ? "图标按钮" : "文字按钮"}</p>
      <div className="button-size-grid">{buttonSizeExamples.filter(item => item.size.startsWith("icon") === icon).map(({ size, height, usage }) => <div className="button-size-item" key={size}>
        <div><Button {...args} size={size} aria-label={icon ? `搜索 ${size}` : undefined}>{icon ? <Search aria-hidden="true" /> : "保存"}</Button></div>
        <code>{size}</code><small>{icon ? `${height} × ${height} px` : `${height} px 高`} · {usage}</small>
      </div>)}</div>
    </section>)}
  </div>;
}

export function ButtonStates() {
  return <div className="grid w-fit max-w-full gap-4 p-4" role="group" aria-label="按钮状态对照">
    {(["Default", "Disabled", "Loading"] as const).map(state => <div key={state}>
      <p className="mb-1 text-sm text-secondary">{state}</p>
      <div className="flex flex-wrap gap-3">{buttonArgTypes.variant.options.map(variant =>
        <Button key={variant} className="w-28" type="button" variant={variant} disabled={state !== "Default"} aria-busy={state === "Loading" || undefined}>
          {state === "Loading" ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span className="sr-only">{variant} 处理中</span></> : variant}
        </Button>)}
      </div>
    </div>)}
  </div>;
}

export const buttonStatesCode = `import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ButtonStates() {
  const variants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const
  return <div className="grid w-fit max-w-full gap-4 p-4">
    {(["Default", "Disabled", "Loading"] as const).map(state => <div key={state}>
      <p className="mb-1 text-sm text-secondary">{state}</p>
      <div className="flex flex-wrap gap-3">{variants.map(variant =>
        <Button key={variant} className="w-28" type="button" variant={variant} disabled={state !== "Default"} aria-busy={state === "Loading" || undefined}>
          {state === "Loading" ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span className="sr-only">{variant} 处理中</span></> : variant}
        </Button>)}
      </div>
    </div>)}
  </div>
}`;

export const buttonLoadingCode = `import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SaveExample() {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("尚未保存。")
  async function save() {
    setSaving(true)
    setMessage("正在保存…")
    await new Promise(resolve => setTimeout(resolve, 800)) // 模拟请求
    setSaving(false)
    setMessage("已保存（演示）。")
  }
  return <>
    <Button type="button" className="min-w-28" disabled={saving} aria-busy={saving} onClick={save}>
      {saving && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
      {saving ? "保存中…" : "保存更改"}
    </Button>
    <output aria-live="polite">{message}</output>
  </>
}`;

export function ButtonLoading() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("尚未保存。");
  async function save() {
    setSaving(true);
    setMessage("正在保存…");
    await new Promise(resolve => setTimeout(resolve, 800));
    setSaving(false);
    setMessage("已保存（演示）。");
  }
  return <div className="button-loading-example">
    <Button type="button" className="min-w-28" disabled={saving} aria-busy={saving} onClick={save}>
      {saving && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
      {saving ? "保存中…" : "保存更改"}
    </Button>
    <output aria-live="polite">{message}</output>
  </div>;
}

export function ButtonProperties() {
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

  const parameters = buttonParameters.map<ComponentDocsParameter>(name => {
    const parameter = buttonArgTypes[name];
    return {
      name, type: parameter.table.type.summary, defaultValue: parameter.table.defaultValue.summary,
      description: <><p>{parameter.description}</p>{name === "children" && icon && <p>此演示使用 Search 图标；名称留空时使用“搜索”。实际内容由 children 提供。</p>}</>,
      control: props => name === "disabled" ? <Switch {...props} checked={values.disabled} onCheckedChange={checked => setValues({ ...values, disabled: checked })} /> : name === "children" || name === "aria-label" ?
        <Input {...props} value={values[name]} disabled={name === "children" && icon} onChange={event => setValues({ ...values, [name]: event.currentTarget.value })} /> : name === "variant" || name === "size" || name === "type" ?
        <Select value={values[name]} items={buttonArgTypes[name].options.map(value => ({ value, label: value }))} onValueChange={value => { if (value !== null) setValues({ ...values, [name]: value }); }}>
          <SelectTrigger {...props} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent align="start">{buttonArgTypes[name].options.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select> : null,
    };
  });
  return <ComponentDocsProperties name="Button" code={code} parameters={parameters} feedback={<>演示点击：{clicks} 次</>} onReset={() => { setValues(defaults); setClicks(0); }} preview={
    <form aria-label="实时按钮预览" onSubmit={event => event.preventDefault()} onReset={event => event.preventDefault()}>
      <Button variant={values.variant} size={values.size} type={values.type} disabled={values.disabled} aria-label={label} onClick={() => setClicks(count => count + 1)}>
        {icon ? <Search aria-hidden="true" /> : values.children}
      </Button>
    </form>
  } />;
}

type StoryReference = ComponentProps<typeof Story>["of"];
type ButtonDocsPageProps = {
  overview: StoryReference;
  sizes: StoryReference;
  usageStory: StoryReference;
  properties: StoryReference;
  keyboard: StoryReference;
  examples: StoryReference;
  states: StoryReference;
  loading: StoryReference;
  anatomyStory: StoryReference;
  actions: StoryReference;
  usage: string;
  anatomy: string;
  bestPractices: readonly ComponentDocsPractice[];
  accessibility: string;
  platform: string;
  api: string;
};

const sizesCode = `import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ButtonSizes() {
  return <div className="flex flex-wrap items-center gap-3">
    ${buttonSizeExamples.map(({ size, height }) => `<div><Button size="${size}"${size.startsWith("icon") ? ' aria-label="搜索"' : ""}>${size.startsWith("icon") ? '<Search aria-hidden="true" />' : "保存"}</Button><p>${size} · ${height} px</p></div>`).join("\n    ")}
  </div>
}`;

const iconLabelCode = `import { ArrowRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export function IconLabelExample() {
  return <div className="flex flex-wrap items-center gap-3">
    <Button type="button"><Search aria-hidden="true" />搜索笔记</Button>
    <Button type="button" variant="outline">下一步<ArrowRight aria-hidden="true" /></Button>
  </div>
}`;

const iconOnlyCode = `import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export function IconOnlyExample() {
  return <Button type="button" variant="outline" size="icon" aria-label="打开搜索">
  <Search aria-hidden="true" />
</Button>
}`;
const disabledCode = `import { useId } from "react"
import { Button } from "@/components/ui/button"

export function DisabledExample() {
  const id = useId()
  return <>
    <Button type="button" disabled aria-describedby={id}>导出笔记</Button>
    <p id={id}>请先选择笔记后再导出。</p>
  </>
}`;
const navigationCode = `import { Button } from "@/components/ui/button"

export function NavigationExample() {
  return <>
    <Button variant="link" render={<a href="#button-link-target" target="_self" />}>查看用法</Button>
    <p id="button-link-target" tabIndex={-1}>链接目标：此示例中的按钮用法。</p>
  </>
}`;
export const buttonActionsCode = `import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function ActionExamples() {
  return <div className="flex flex-wrap items-center gap-3">
    <Button type="button">保存更改</Button>
    <Button type="button" variant="outline">取消</Button>
    <Dialog>
      <DialogTrigger render={<Button variant="destructive">删除笔记</Button>} />
      <DialogContent>
        <DialogTitle>确认删除笔记？</DialogTitle>
        <DialogDescription>此处仅演示确认流程，不会删除真实笔记。</DialogDescription>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">取消删除</Button>} />
          <DialogClose render={<Button variant="destructive">确认删除</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}`;

const buttonKeyboardCode = `import { Button } from "@/components/ui/button"

export function KeyboardExample() {
  return <div className="flex gap-3"><Button>保存</Button><Button disabled>不可用</Button><Button variant="outline">下一项</Button></div>
}`;

export function ButtonExamples() {
  const id = useId();
  return <div className="button-examples">
    <ComponentDocsExample title="Button — Icon" story="components-button--examples" code={iconLabelCode} description="图标辅助识别动作；装饰图标隐藏于读屏，文字保持明确。"><div className="button-example-stage">
      <Button type="button"><Search aria-hidden="true" />搜索笔记</Button>
      <Button type="button" variant="outline">下一步<ArrowRight aria-hidden="true" /></Button>
    </div></ComponentDocsExample>
    <ComponentDocsExample title="Button — Icon Only" story="components-button--examples" code={iconOnlyCode} description="提供明确的 aria-label。size 只决定尺寸，不会自动添加图标。"><div className="button-example-stage"><Button type="button" variant="outline" size="icon" aria-label="打开搜索"><Search aria-hidden="true" /></Button><code>aria-label="打开搜索"</code></div></ComponentDocsExample>
    <ComponentDocsExample title="Button — Disabled" story="components-button--examples" code={disabledCode} description="在按钮附近解释不可用的原因，帮助使用者找到下一步。"><div className="button-example-stage">
      <Button type="button" disabled aria-describedby={`${id}-export-reason`}>导出笔记</Button><p id={`${id}-export-reason`}>请先选择笔记后再导出。</p>
    </div></ComponentDocsExample>
    <ComponentDocsExample title="Button — Navigation" story="components-button--examples" code={navigationCode} description={'导航使用真实 a href；variant="link" 本身只改变外观。'}><div className="button-example-stage">
      <Button variant="link" render={<a href="#button-link-target" target="_self" />}>查看用法</Button>
      <p id="button-link-target" tabIndex={-1}>链接目标：此示例中的按钮用法。</p>
    </div></ComponentDocsExample>
  </div>;
}

export function ButtonActions() {
  return <div className="button-example-stage button-actions-stage">
      <Button type="button">保存更改</Button><Button type="button" variant="outline">取消</Button>
      <Dialog>
        <DialogTrigger render={<Button variant="destructive">删除笔记</Button>} />
        <DialogContent>
          <DialogTitle>确认删除笔记？</DialogTitle>
          <DialogDescription>此处仅演示确认流程，不会删除真实笔记。</DialogDescription>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">取消删除</Button>} />
            <DialogClose render={<Button variant="destructive">确认删除</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </div>;
}

export function ButtonDocsPage({ overview, sizes, usageStory, properties, keyboard, examples, states, loading, anatomyStory, actions, usage, anatomy, bestPractices, accessibility, platform, api }: ButtonDocsPageProps) {
  return <ComponentDocsTemplate name="Button" overview={<>
        <div className="component-docs-hero"><Story of={overview} height="100%" /></div>
        <h2 id="button-usage">用法</h2><ComponentDocsExample title="Button — Usage" story="components-button--default" code={usage} description={'普通动作使用 type="button"；表单提交显式设置 type="submit"，并由业务层处理提交。'} iframe><Story of={usageStory} height="200px" /></ComponentDocsExample>
        <h2>组成</h2><Story of={anatomyStory} /><Markdown>{anatomy}</Markdown>
        <h2>最佳实践</h2><ComponentDocsBestPractices items={bestPractices} />
        <h2>示例</h2><p>常用配置、变体和交互状态。</p>
        <ComponentDocsExample title="Button — Variants" story="components-button--states" code={buttonStatesCode} description="六种视觉变体用于不同强调层级：default 为主操作，secondary / outline 为次操作，ghost 为轻量操作，destructive 为危险操作，link 为链接外观。加载状态由业务层组合。" iframe><Story of={states} /></ComponentDocsExample>
        <p>加载状态由业务层组合 disabled、aria-busy 和内容；组件不新增 loading 属性。</p>
        <ComponentDocsExample title="Button — Loading" story="components-button--loading" code={buttonLoadingCode} description="点击试用模拟保存，观察状态文字、禁用和完成反馈。加载由业务层组合，不会写入真实笔记。" iframe><Story of={loading} height="200px" /></ComponentDocsExample>
        <ComponentDocsExample title="Button — Keyboard" story="components-button--keyboard-and-disabled" code={buttonKeyboardCode} description="点击“保存”后按 Tab，焦点会跳过禁用按钮，移动到“下一项”。Enter / Space 可激活按钮。" iframe><Story of={keyboard} height="200px" /></ComponentDocsExample>
        <ComponentDocsExample title="Button — Sizes" story="components-button--sizes" code={sizesCode} description="文字与图标按钮分别展示四种尺寸。紧凑列表使用 xs，桌面工具栏使用 sm，常规表单使用 default，需要突出时使用 lg。" iframe><Story of={sizes} /></ComponentDocsExample>
        <Story of={examples} />
        <ComponentDocsExample title="Button — Actions" story="components-button--actions" code={buttonActionsCode} description="保存为主操作，取消为次操作；删除需先确认。本示例不写入或删除笔记。" iframe><Story of={actions} /></ComponentDocsExample>
      </>} properties={<>
        <Story of={properties} />
        <Markdown>{api}</Markdown>
      </>} accessibility={<>
        <ComponentDocsMarkdown>{accessibility}</ComponentDocsMarkdown>
        <h2>键盘与禁用状态</h2><ComponentDocsExample title="Button — Keyboard" story="components-button--keyboard-and-disabled" code={buttonKeyboardCode} description="Tab / Shift+Tab 移动焦点并跳过禁用按钮，Enter / Space 激活原生按钮；键盘焦点保持可见。" iframe><Story of={keyboard} height="200px" /></ComponentDocsExample>
        <h2>平台差异</h2><Markdown>{platform}</Markdown>
      </>} />;
}
