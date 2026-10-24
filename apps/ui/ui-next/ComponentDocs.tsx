import type { ComponentType } from "react";
import { ButtonExample, CardExample, DialogExample, DropdownMenuExample, InputExample, PopoverExample, SelectExample, SheetExample, SwitchExample, TabsExample, TextareaExample, TooltipExample } from "./LumaPage";
import { additionalExamplesMap } from "./AdditionalExamples";
import { componentDocs, type ComponentKey } from "./component-docs.data";
import { ComponentDocsBestPractices, ComponentDocsExample, ComponentDocsTemplate } from "./ComponentDocsTemplate";

const examples: Record<ComponentKey, ComponentType> = {
  ...additionalExamplesMap,
  button: ButtonExample,
  input: InputExample,
  textarea: TextareaExample,
  card: CardExample,
  dialog: DialogExample,
  "dropdown-menu": DropdownMenuExample,
  popover: PopoverExample,
  select: SelectExample,
  sheet: SheetExample,
  switch: SwitchExample,
  tabs: TabsExample,
  tooltip: TooltipExample,
};

export function ComponentDocs({ component }: { component: ComponentKey }) {
  const doc = componentDocs[component];
  const Example = examples[component];
  return <ComponentDocsTemplate name={doc.name} description={doc.description} component={component} hero={<Example />} overview={<>
        <section><h2>用法</h2><ComponentDocsExample title={`${doc.name} — Usage`} code={doc.code} story={`ui-next-${component}--example`} description={doc.description}><Example /></ComponentDocsExample></section>
        <section><h2>组成</h2><ul>{doc.anatomy.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h2>最佳实践</h2><ComponentDocsBestPractices items={doc.practices.map(description => ({ guidance: "do", description }))} /></section>
      </>} properties={<>
        <section><h2>参数与用法</h2><p>以下属性对应当前 Luma 封装与 Base UI 组合。示例可交互；参数表列出主要契约。</p><ComponentDocsExample title={`${doc.name} — Properties`} code={doc.code} story={`ui-next-${component}--example`} description="完整变体与交互可在 Canvas 中查看；属性应设置在表中注明的根组件或子组件上。"><Example /></ComponentDocsExample></section>
        <section><h2>Props</h2><div className="next-docs-table-wrap next-docs-properties-wrap" role="region" aria-label={`${doc.name} 参数表`} tabIndex={0}><table className="next-docs-table next-docs-properties"><thead><tr><th scope="col">参数</th><th scope="col">类型 / 说明</th><th scope="col">默认值</th></tr></thead><tbody>{doc.props.map(prop => <tr key={prop.name}><th scope="row"><code>{prop.name}</code></th><td><code>{prop.type}</code><p>{prop.description}</p></td><td><code>{prop.defaultValue ?? "未设置"}</code></td></tr>)}</tbody></table></div></section>
      </>} accessibility={<>
        <section><h2>无障碍指南</h2><div className="next-docs-table-wrap" role="region" aria-label={`${doc.name} 无障碍指南`} tabIndex={0}><table className="next-docs-table"><thead><tr><th scope="col">项目</th><th scope="col">行为与要求</th></tr></thead><tbody>{doc.accessibility.map(item => <tr key={item.title}><th scope="row">{item.title}</th><td>{item.description}</td></tr>)}</tbody></table></div></section>
        <section><h2>主题与验证范围</h2><p>示例使用 Noto 字体、Hugeicons、统一焦点 token 和当前明暗主题。禁用状态与数据图形分别评估；实际业务仍需核验名称、内容和操作结果。</p><p className="next-docs-note">Base UI 提供基础交互；调用方负责可访问名称、内容语义及必要的状态反馈。</p></section>
      </>} />;
}
