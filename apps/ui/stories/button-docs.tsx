import { useId, useState, type ComponentProps } from "react";
import { ArgTypes, Canvas, Description, Markdown, Story, Title } from "@storybook/addon-docs/blocks";
import { Tabs } from "@base-ui/react/tabs";
import { Search } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import "./button-docs.css";

const variants = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const sizes = ["xs", "sm", "default", "lg", "icon-xs", "icon-sm", "icon", "icon-lg"] as const;
type Properties = {
  variant: typeof variants[number];
  size: typeof sizes[number];
  children: string;
  disabled: boolean;
  type: "button" | "submit" | "reset";
  ariaLabel: string;
};
const defaults: Properties = { variant: "default", size: "default", children: "保存", disabled: false, type: "button", ariaLabel: "" };

export function ButtonOverview() {
  return <div className="button-overview-stage">
    {variants.map(variant => <Button key={variant} type="button" variant={variant}>{variant}</Button>)}
  </div>;
}

export function ButtonProperties() {
  const id = useId();
  const [values, setValues] = useState(defaults);
  const [clicks, setClicks] = useState(0);
  const icon = values.size.startsWith("icon");
  const label = values.ariaLabel.trim() || (icon ? "搜索" : undefined);
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
    <div className="button-properties-main">
      <div>
        <form className="button-properties-stage" aria-label="实时按钮预览" onSubmit={event => event.preventDefault()} onReset={event => event.preventDefault()}>
          <Button variant={values.variant} size={values.size} type={values.type} disabled={values.disabled} aria-label={label} onClick={() => setClicks(count => count + 1)}>
            {icon ? <Search aria-hidden="true" /> : values.children}
          </Button>
        </form>
        <output className="button-properties-feedback" aria-live="polite">演示点击：{clicks} 次</output>
      </div>
      <div className="button-properties-controls">
        <label htmlFor={`${id}-variant`}>variant<select id={`${id}-variant`} value={values.variant} onChange={event => setValues({ ...values, variant: event.currentTarget.value as Properties["variant"] })}>{variants.map(value => <option key={value}>{value}</option>)}</select></label>
        <label htmlFor={`${id}-size`}>size<select id={`${id}-size`} value={values.size} onChange={event => setValues({ ...values, size: event.currentTarget.value as Properties["size"] })}>{sizes.map(value => <option key={value}>{value}</option>)}</select></label>
        <label htmlFor={`${id}-children`}>children<Input id={`${id}-children`} value={values.children} disabled={icon} aria-describedby={`${id}-help`} onChange={event => setValues({ ...values, children: event.currentTarget.value })} /></label>
        <label htmlFor={`${id}-type`}>type<select id={`${id}-type`} value={values.type} onChange={event => setValues({ ...values, type: event.currentTarget.value as Properties["type"] })}>{["button", "submit", "reset"].map(value => <option key={value}>{value}</option>)}</select></label>
        <label htmlFor={`${id}-label`}>aria-label<Input id={`${id}-label`} value={values.ariaLabel} placeholder="纯图标默认为搜索" onChange={event => setValues({ ...values, ariaLabel: event.currentTarget.value })} /></label>
        <label className="button-properties-checkbox" htmlFor={`${id}-disabled`}><input id={`${id}-disabled`} type="checkbox" checked={values.disabled} onChange={event => setValues({ ...values, disabled: event.currentTarget.checked })} />disabled</label>
        <div className="button-properties-reset"><Button type="button" variant="outline" size="sm" onClick={() => { setValues(defaults); setClicks(0); }}>Reset</Button></div>
      </div>
    </div>
    <p id={`${id}-help`} className="button-properties-note">请使用预览内控件调整参数。图标尺寸显示 Search；名称为空时使用“搜索”。点击计数属于内存示例，submit / reset 不提交或重置页面。</p>
    <details className="button-properties-code"><summary>查看当前代码</summary><pre><code>{code}</code></pre></details>
  </section>;
}

type StoryReference = ComponentProps<typeof Canvas>["of"];
type ButtonDocsPageProps = {
  overview: StoryReference;
  sizes: StoryReference;
  usageStory: StoryReference;
  properties: StoryReference;
  keyboard: StoryReference;
  usage: string;
  anatomy: string;
  guidelines: string;
  accessibility: string;
  platform: string;
  api: string;
  apiArgs: string[];
};

const overviewCode = `import { Button } from "@/components/ui/button"

export function ButtonVariants() {
  return <div className="flex flex-wrap items-center justify-center gap-3">
    ${variants.map(variant => `<Button variant="${variant}">${variant}</Button>`).join("\n    ")}
  </div>
}`;

export function ButtonDocsPage({ overview, sizes, usageStory, properties, keyboard, usage, anatomy, guidelines, accessibility, platform, api, apiArgs }: ButtonDocsPageProps) {
  return <div className="button-docs">
    <Title>Button</Title><Description />
    <Tabs.Root defaultValue="overview">
      <Tabs.List className="button-docs-tab-list" aria-label="Button 文档" activateOnFocus>
        <Tabs.Tab className="button-docs-tab" value="overview">Overview</Tabs.Tab>
        <Tabs.Tab className="button-docs-tab" value="properties">Properties</Tabs.Tab>
        <Tabs.Tab className="button-docs-tab" value="accessibility">Accessibility</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel className="button-docs-panel" value="overview">
        <Canvas of={overview} source={{ code: overviewCode, language: "tsx" }} sourceState="hidden" />
        <h2>尺寸</h2><Canvas of={sizes} sourceState="hidden" story={{ height: "128px" }} />
        <h2>用法</h2><Canvas of={usageStory} source={{ code: usage, language: "tsx" }} sourceState="hidden" story={{ height: "96px" }} />
        <h2>组成</h2><Markdown>{anatomy}</Markdown>
        <h2>使用建议</h2><Markdown>{guidelines}</Markdown>
      </Tabs.Panel>
      <Tabs.Panel className="button-docs-panel" value="properties">
        <p>调整下方参数，即时查看生产 Button；展开“查看当前代码”复制对应 JSX。</p>
        <Story of={properties} />
        <h2>API</h2><Markdown>{api}</Markdown><ArgTypes include={apiArgs} />
      </Tabs.Panel>
      <Tabs.Panel className="button-docs-panel" value="accessibility">
        <Markdown>{accessibility}</Markdown>
        <h2>键盘与禁用状态</h2><Canvas of={keyboard} sourceState="hidden" story={{ height: "96px" }} />
        <h2>平台差异</h2><Markdown>{platform}</Markdown>
      </Tabs.Panel>
    </Tabs.Root>
  </div>;
}
