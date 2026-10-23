import type { ComponentDoc } from "./component-docs.data";

export type AdditionalComponentKey = "accordion" | "badge" | "breadcrumb" | "calendar" | "chart" | "checkbox" | "combobox" | "empty" | "field" | "input-group" | "item" | "label" | "native-select" | "progress" | "radio-group" | "separator" | "sidebar" | "skeleton" | "slider" | "spinner" | "table" | "toggle" | "toggle-group";
type AdditionalComponentDoc = Omit<ComponentDoc, "key"> & { key: AdditionalComponentKey };

export const additionalComponentDocs: Record<AdditionalComponentKey, AdditionalComponentDoc> = {
  accordion: {
    key: "accordion", name: "Accordion", description: "将一组说明组织为可展开的面板。Base UI 管理展开状态、触发器与内容关联，Luma 封装提供边框、图标和过渡。",
    anatomy: ["Accordion：维护展开项的值数组。", "AccordionItem：用唯一 value 标识一个面板。", "AccordionTrigger / AccordionContent：面板标题按钮与对应内容。"],
    practices: ["标题应在收起时也能说明内容。", "比较多个面板时使用 multiple；简短的必要说明可直接显示。", "每项使用稳定且唯一的 value。"],
    props: [
      { name: "value / defaultValue", type: "unknown[]", description: "Accordion 属性：受控展开项或初始展开项；单项模式同样使用数组。" },
      { name: "onValueChange", type: "(value: unknown[], eventDetails) => void", description: "Accordion 属性：展开项变更回调。" },
      { name: "multiple", type: "boolean", defaultValue: "false", description: "Accordion 属性：允许同时展开多个面板。" },
      { name: "disabled", type: "boolean", defaultValue: "false", description: "Accordion / AccordionItem 属性：禁用整组或单个面板。" },
      { name: "orientation", type: '"horizontal" | "vertical"', defaultValue: "vertical", description: "Accordion 属性：决定方向键导航方向；当前布局用于纵向内容。" },
      { name: "AccordionItem.value", type: "unknown", description: "子项属性：面板的稳定标识。" },
    ],
    accessibility: [{ title: "键盘", description: "Tab 聚焦标题，Enter 或空格展开；方向键在标题间移动。" }, { title: "标题与内容", description: "Base UI 维护 aria-expanded 和面板关联；标题按钮内避免嵌套其它可交互元素。" }],
    code: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@ui-next/components/accordion";

<Accordion defaultValue={["theme"]}>
  <AccordionItem value="theme">
    <AccordionTrigger>主题如何切换？</AccordionTrigger>
    <AccordionContent>使用工具栏切换浅色与深色模式。</AccordionContent>
  </AccordionItem>
</Accordion>`,
  },
  badge: {
    key: "badge", name: "Badge", description: "为内容提供简短分类或状态说明。默认渲染为 span；需要导航时可通过 render 合并到链接。",
    anatomy: ["Badge：紧凑的行内标签。", "children：简短文字与可选装饰图标。", "variant：控制强调程度与状态颜色。"],
    practices: ["用文字明确表达状态，避免只靠颜色区分。", "保持标签简短，长说明放在相邻正文中。", "将可点击标签渲染为正确的链接或按钮元素。"],
    props: [
      { name: "variant", type: '"default" | "secondary" | "destructive" | "outline" | "ghost" | "link"', defaultValue: "default", description: "封装属性：选择标签视觉。" },
      { name: "render", type: "ReactElement | render function", description: "组合属性：将标签样式合并到自定义元素。" },
      { name: "children", type: "ReactNode", description: "标签内容；可包含装饰图标与可见文字。" },
      { name: "className", type: "string", description: "原生 span 样式类；不要用固定颜色覆盖状态语义。" },
    ],
    accessibility: [{ title: "状态文字", description: "颜色不自动产生语义；为状态保留清楚的可见文字。" }, { title: "交互语义", description: "静态 span 不进入 Tab 顺序；交互用途需要链接或按钮及可访问名称。" }],
    code: `import { Badge } from "@ui-next/components/badge";

<>
  <Badge>默认</Badge>
  <Badge variant="secondary">次要</Badge>
  <Badge variant="outline">边框</Badge>
  <Badge variant="destructive">需要处理</Badge>
</>`,
  },
  breadcrumb: {
    key: "breadcrumb", name: "Breadcrumb", description: "展示当前内容的层级位置。封装保留 nav、列表、链接与当前页的原生语义，路由跳转由应用接入。",
    anatomy: ["Breadcrumb / BreadcrumbList：导航区域与有序列表。", "BreadcrumbItem / BreadcrumbLink：层级项与可导航链接。", "BreadcrumbSeparator / BreadcrumbPage：装饰分隔符与当前页。"],
    practices: ["层级名称与实际目的地一致。", "当前页使用 BreadcrumbPage，避免重复导航。", "链接 href 指向实际地址；客户端路由可用 render 组合。"],
    props: [
      { name: "Breadcrumb.aria-label", type: "string", defaultValue: "breadcrumb", description: "导航区域的可访问名称，可按产品语言覆盖。" },
      { name: "BreadcrumbLink.href", type: "string", description: "原生链接属性：目标地址。" },
      { name: "BreadcrumbLink.render", type: "ReactElement | render function", description: "组合属性：接入应用路由链接。" },
      { name: "BreadcrumbSeparator.children", type: "ReactNode", description: "覆盖默认分隔图标；分隔符保持装饰语义。" },
    ],
    accessibility: [{ title: "位置", description: "BreadcrumbPage 标记 aria-current=page；导航区域应有描述性的名称。" }, { title: "链接", description: "可导航层级使用链接；分隔符不进入键盘顺序，也不需要读出。" }],
    code: `import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@ui-next/components/breadcrumb";

<Breadcrumb aria-label="文档位置">
  <BreadcrumbList>
    <BreadcrumbItem><BreadcrumbLink href="/docs">文档</BreadcrumbLink></BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbPage>组件</BreadcrumbPage></BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>`,
  },
  calendar: {
    key: "calendar", name: "Calendar", description: "通过月份网格选择日期。Luma 封装采用 React Day Picker，选择模式、日期范围和本地化由 Day Picker 属性控制。",
    anatomy: ["Calendar：月份、导航与日期网格。", "mode / selected / onSelect：日期选择模式与状态。", "buttonVariant：月份导航按钮的视觉。"],
    practices: ["根据任务选择 single、multiple 或 range 模式。", "使用 disabled 表达不可选择日期，并说明限制。", "表单提交日期时明确本地日期与时区处理方式。"],
    props: [
      { name: "mode", type: '"single" | "multiple" | "range"', description: "Day Picker 属性：选择模式，决定 selected 和 onSelect 的类型。" },
      { name: "selected / onSelect", type: "mode 对应的日期值 / 回调", description: "Day Picker 属性：受控选择；单选为 Date | undefined。" },
      { name: "month / defaultMonth", type: "Date", description: "Day Picker 属性：受控显示月份或初始月份。" },
      { name: "disabled", type: "Matcher | Matcher[]", description: "Day Picker 属性：禁用符合条件的日期。" },
      { name: "showOutsideDays", type: "boolean", defaultValue: "true", description: "Day Picker 属性：显示相邻月份的日期。" },
      { name: "buttonVariant", type: "Button variant", defaultValue: "ghost", description: "封装属性：月份导航按钮变体。" },
      { name: "locale", type: "DayPicker Locale", description: "Day Picker 属性：本地化月份、星期和日期格式。" },
    ],
    accessibility: [{ title: "键盘", description: "日期网格支持方向键导航；保留 Day Picker 提供的日期名称和键盘行为。" }, { title: "选择反馈", description: "相邻文字可说明所选日期及禁用规则；不要仅使用颜色表达已选日期。" }],
    code: `import { useState } from "react";
import { Calendar } from "@ui-next/components/calendar";

function DateExample() {
  const [date, setDate] = useState<Date | undefined>();
  return <Calendar mode="single" selected={date} onSelect={setDate} />;
}`,
  },
  chart: {
    key: "chart", name: "Chart", description: "为 Recharts 图表提供主题颜色、提示和图例样式。ChartContainer 管理尺寸与系列配置，具体数据和图表类型由 Recharts 组件决定。",
    anatomy: ["ChartContainer：响应式容器与系列 CSS 变量。", "ChartConfig：为数据键配置标签和颜色。", "ChartTooltipContent / ChartLegendContent：主题化提示与图例。"],
    practices: ["为容器提供明确高度，避免响应式图表塌陷。", "颜色引用语义数据 token，使用标签辅助区分系列。", "提供简短的文字摘要；关键信息同时可在表格或正文读取。"],
    props: [
      { name: "ChartContainer.config", type: "ChartConfig", description: "必需的系列配置；每个键可设置 label、icon，以及 color 或 light/dark theme。" },
      { name: "ChartContainer.children", type: "ResponsiveContainer children", description: "Recharts 图表节点；图形和数据由该节点配置。" },
      { name: "ChartContainer.className", type: "string", description: "设置容器布局和高度，例如 h-48 w-full。" },
      { name: "ChartContainer.initialDimension", type: "{ width: number; height: number }", defaultValue: "{ width: 320, height: 200 }", description: "响应式测量前的初始尺寸。" },
      { name: "ChartTooltipContent.hideLabel / hideIndicator", type: "boolean", defaultValue: "false", description: "隐藏提示中的标签或系列标记。" },
      { name: "ChartTooltipContent.indicator", type: '"dot" | "line" | "dashed"', defaultValue: "dot", description: "提示中的系列标记样式。" },
    ],
    accessibility: [{ title: "文字替代", description: "为图表提供标题和摘要，并提供读取精确数值的途径。" }, { title: "键盘与颜色", description: "在支持的 Recharts 图表上保留 accessibilityLayer；系列名称和数值应能独立于颜色理解。" }],
    code: `import { Bar, BarChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@ui-next/components/chart";

const config = { notes: { label: "笔记数量", color: "var(--color-data-blue-2)" } };
const data = [{ day: "周一", notes: 4 }, { day: "周二", notes: 7 }];

<ChartContainer config={config} className="h-48 w-full" aria-label="周一 4 篇，周二 7 篇笔记">
  <BarChart accessibilityLayer data={data}>
    <XAxis dataKey="day" />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="notes" fill="var(--color-notes)" />
  </BarChart>
</ChartContainer>`,
  },
  checkbox: {
    key: "checkbox", name: "Checkbox", description: "在独立的开关状态之间选择，或表示一组选项的部分选中状态。Base UI 管理选中、混合状态及表单输入。",
    anatomy: ["Checkbox：可聚焦的选择控件。", "Indicator：封装内的选择标记。", "Label：与唯一 id 关联的可见名称。"],
    practices: ["多个选项可以独立选择时使用复选框。", "部分选中状态应根据子项状态计算；点击后更新为明确的选中状态。", "禁用原因用文字解释，避免依赖灰色外观。"],
    props: [
      { name: "checked / defaultChecked", type: "boolean", description: "Base UI 属性：受控或初始选中状态。" },
      { name: "onCheckedChange", type: "(checked: boolean, eventDetails) => void", description: "Base UI 属性：选中状态变更。" },
      { name: "indeterminate", type: "boolean", defaultValue: "false", description: "Base UI 属性：表示部分选中，与 checked 分开维护。" },
      { name: "disabled / readOnly", type: "boolean", defaultValue: "false", description: "Base UI 属性：禁用或只读。" },
      { name: "name / value", type: "string", description: "表单属性：提交字段名与选中时的值。" },
      { name: "id", type: "string", description: "用于关联 Label 的唯一标识；重复示例建议用 useId。" },
    ],
    accessibility: [{ title: "名称", description: "通过 Label 的 htmlFor 关联控件 id；点击标签也应切换复选框。" }, { title: "键盘与状态", description: "Tab 聚焦，空格切换；Base UI 维护 checked / mixed 的可访问状态。" }],
    code: `import { useId } from "react";
import { Checkbox } from "@ui-next/components/checkbox";
import { Label } from "@ui-next/components/label";

function CheckboxField() {
  const id = useId();
  return <div className="flex items-center gap-3">
    <Checkbox id={id} defaultChecked />
    <Label htmlFor={id}>接收更新通知</Label>
  </div>;
}`,
  },
  combobox: {
    key: "combobox", name: "Combobox", description: "将可搜索输入与选项列表组合。Base UI 处理过滤、活动选项、选择和键盘操作，Luma 封装提供输入组与弹层样式。",
    anatomy: ["Combobox：数据项与选择状态。", "ComboboxInput：可编辑输入、下拉触发器与可选清除按钮。", "ComboboxContent / List / Item / Empty：弹层、候选项和无结果状态。"],
    practices: ["为字段提供可见名称和能理解的选项文字。", "少量且无需搜索的选项可使用 Select。", "输入清空、无结果和已选择状态都应有明确反馈。"],
    props: [
      { name: "Combobox.items", type: "readonly Value[]", description: "Base UI 属性：候选项数据；对象项需要配置对应的字符串转换方式。" },
      { name: "Combobox.value / defaultValue", type: "Value | null（单选）/ readonly Value[]（多选）", description: "Base UI 属性：受控值或初始选择；多选在根组件设置 multiple，使用值数组。" },
      { name: "Combobox.onValueChange", type: "(value, eventDetails) => void", description: "Base UI 属性：选择或清除时的变更回调。" },
      { name: "ComboboxInput.showTrigger / showClear", type: "boolean", defaultValue: "true / false", description: "封装属性：显示展开按钮或清除按钮。" },
      { name: "ComboboxInput.triggerAriaLabel / clearAriaLabel", type: "string", defaultValue: "切换选项 / 清除选择", description: "封装属性：覆盖内建图标按钮的可访问名称，用于本地化或补充任务上下文。" },
      { name: "ComboboxChip.removeAriaLabel", type: "string", defaultValue: "移除 [文字] / 移除选项", description: "封装属性：覆盖多选标签的移除按钮名称。简单文字自动加入名称；复杂节点建议显式命名。" },
      { name: "ComboboxInput.disabled", type: "boolean", defaultValue: "false", description: "禁用输入、展开和清除交互。" },
      { name: "ComboboxContent.side / align", type: '"top" | "bottom" | "left" | "right" / "start" | "center" | "end"', defaultValue: "bottom / start", description: "弹层相对输入框的位置。" },
    ],
    accessibility: [{ title: "输入名称", description: "Label 的 htmlFor 关联输入 id，同时为 Label 提供独立 id 并由 ComboboxInput 的 aria-labelledby 显式引用，使弹层展开后仍保留名称关联；placeholder 仅提供示例。内建按钮默认使用中文名称，跨语言场景通过 triggerAriaLabel、clearAriaLabel 和多选标签的 removeAriaLabel 覆盖。" }, { title: "键盘", description: "输入筛选，方向键浏览，Enter 选择，Escape 关闭；保留 Base UI 的活动项与列表关联。" }],
    code: `import { useId } from "react";
import { Label } from "@ui-next/components/label";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from "@ui-next/components/combobox";

function FontPicker() {
  const id = useId();
  return <>
    <Label id={id + "-label"} htmlFor={id}>字体</Label>
    <Combobox items={["Noto Sans", "Noto Serif"]}>
      <ComboboxInput id={id} aria-labelledby={id + "-label"} showClear />
      <ComboboxContent>
        <ComboboxEmpty>没有匹配字体</ComboboxEmpty>
        <ComboboxList>{item => <ComboboxItem key={String(item)} value={item}>{String(item)}</ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>
  </>;
}`,
  },
  empty: {
    key: "empty", name: "Empty", description: "当列表或区域没有内容时，说明当前状态与可以采取的下一步。它是原生布局组件，创建或重试行为由使用方实现。",
    anatomy: ["Empty：空状态区域。", "EmptyHeader / Media / Title / Description：图形、标题与说明。", "EmptyContent：主要行动或补充内容。"],
    practices: ["区分尚未创建、没有搜索结果和加载失败。", "说明当前状态，并提供一个有帮助的行动。", "使用简短说明，避免大段教程或多项竞争操作。"],
    props: [
      { name: "Empty.children", type: "ReactNode", description: "由 Header、Content 等部件组合内容。" },
      { name: "Empty.className", type: "string", description: "原生 div 属性：设置区域宽度、留白与边框。" },
      { name: "EmptyMedia.variant", type: '"default" | "icon"', defaultValue: "default", description: "封装属性：图形容器的视觉。" },
      { name: "EmptyDescription.children", type: "ReactNode", description: "解释原因或提供下一步；可包含语义正确的链接。" },
    ],
    accessibility: [{ title: "说明", description: "空状态需要可读文字；装饰图标使用 aria-hidden。" }, { title: "动态更新", description: "搜索或创建后出现的新结果可通过相邻 status 消息通知，避免让整个区域反复读出。" }],
    code: `import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@ui-next/components/empty";
import { Button } from "@ui-next/components/button";

<Empty>
  <EmptyHeader>
    <EmptyTitle>还没有内容</EmptyTitle>
    <EmptyDescription>创建第一项内容，开始整理想法。</EmptyDescription>
  </EmptyHeader>
  <EmptyContent><Button>创建内容</Button></EmptyContent>
</Empty>`,
  },
  field: {
    key: "field", name: "Field", description: "组织字段标签、输入、帮助和错误信息。此封装提供原生布局与状态样式；校验逻辑、控件值和 ARIA 关联由使用方维护。",
    anatomy: ["Field / FieldGroup / FieldSet：单个字段、字段集合与原生 fieldset。", "FieldLabel / FieldDescription：字段名称与帮助说明。", "FieldError：错误消息，提供 alert 语义。"],
    practices: ["标签、描述和错误消息保持靠近对应控件。", "无效时同时设置 Field 的 data-invalid 与控件的 aria-invalid。", "使用 useId 连接 label、输入、描述和错误信息。"],
    props: [
      { name: "Field.orientation", type: '"vertical" | "horizontal" | "responsive"', defaultValue: "vertical", description: "封装属性：标签和控件的布局方向。" },
      { name: "Field.data-invalid", type: "boolean | string", description: "样式状态：配合输入控件的 aria-invalid 表达错误。" },
      { name: "FieldLabel.htmlFor", type: "string", description: "原生 label 属性：对应输入控件的 id。" },
      { name: "FieldError.errors", type: "Array<{ message?: string } | undefined>", description: "封装属性：输出错误信息并移除重复消息；不执行校验。" },
      { name: "FieldError.children", type: "ReactNode", description: "直接提供错误文字，优先于 errors。" },
      { name: "FieldLegend.variant", type: '"legend" | "label"', defaultValue: "legend", description: "封装属性：原生 legend 的字号和字重。" },
    ],
    accessibility: [{ title: "关联", description: "Field 布局不会自动关联输入；用 htmlFor、aria-describedby、aria-invalid 明确连接。" }, { title: "分组", description: "相关复选框或单选框使用 FieldSet 与 FieldLegend；FieldError 仅在需要时显示。" }],
    code: `import { useId } from "react";
import { Field, FieldLabel, FieldDescription } from "@ui-next/components/field";
import { Input } from "@ui-next/components/input";

function NameField() {
  const id = useId();
  return <Field>
    <FieldLabel htmlFor={id}>名称</FieldLabel>
    <Input id={id} aria-describedby={id + "-description"} />
    <FieldDescription id={id + "-description"}>填写一个容易识别的名称。</FieldDescription>
  </Field>;
}`,
  },
  "input-group": {
    key: "input-group", name: "Input Group", description: "把输入与图标、前后缀或附加操作放入共同边框。输入值由原生控件管理，装饰与操作通过 Addon 明确分工。",
    anatomy: ["InputGroup：共享边框与焦点样式的分组。", "InputGroupInput / InputGroupTextarea：输入控件。", "InputGroupAddon / Text / Button：前后缀、说明与附加操作。"],
    practices: ["继续为输入提供外部 Label；图标不能代替字段名称。", "附加动作使用 InputGroupButton，装饰图标隐藏于辅助技术。", "提交按钮显式设置 type=submit，其余操作保留 button 类型。"],
    props: [
      { name: "InputGroupAddon.align", type: '"inline-start" | "inline-end" | "block-start" | "block-end"', defaultValue: "inline-start", description: "封装属性：前后缀相对输入的排列位置。" },
      { name: "InputGroupInput.value / onChange", type: "原生 input 值 / ChangeEventHandler", description: "原生输入属性：维护受控输入值。" },
      { name: "InputGroupInput.aria-invalid", type: "boolean", description: "标记无效字段并触发父分组的错误样式。" },
      { name: "InputGroupButton.variant", type: "Button variant", defaultValue: "ghost", description: "附加操作的视觉变体。" },
      { name: "InputGroupButton.size", type: '"xs" | "sm" | "icon-xs" | "icon-sm"', defaultValue: "xs", description: "封装属性：适合输入组的按钮尺寸。" },
      { name: "InputGroupButton.type", type: '"button" | "submit" | "reset"', defaultValue: "button", description: "操作的原生表单行为。" },
    ],
    accessibility: [{ title: "标签", description: "Label 与真正的 InputGroupInput 关联，不要关联外围分组。" }, { title: "附加内容", description: "必要的单位或格式说明通过 aria-describedby 关联；仅图标按钮提供 aria-label。" }],
    code: `import { useId } from "react";
import { Label } from "@ui-next/components/label";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@ui-next/components/input-group";

function SearchField() {
  const id = useId();
  return <form>
    <Label htmlFor={id}>搜索</Label>
    <InputGroup>
      <InputGroupInput id={id} placeholder="输入关键词" />
      <InputGroupAddon align="inline-end"><InputGroupButton type="submit">搜索</InputGroupButton></InputGroupAddon>
    </InputGroup>
  </form>;
}`,
  },
  item: {
    key: "item", name: "Item", description: "组织包含标题、说明、媒体和独立操作的一行内容。布局封装不管理选中状态、导航或列表数据，使用方提供合适的语义。",
    anatomy: ["ItemGroup / Item：一组条目与单个条目。", "ItemMedia / ItemContent / Title / Description：媒体与文本内容。", "ItemActions / Header / Footer：独立操作及扩展区域。"],
    practices: ["标题用于识别条目，说明补充必要上下文。", "整行导航与内部按钮不要形成嵌套交互。", "ItemGroup 使用列表语义时，为条目设置 role=listitem。"],
    props: [
      { name: "Item.variant", type: '"default" | "outline" | "muted"', defaultValue: "default", description: "封装属性：条目背景与边框。" },
      { name: "Item.size", type: '"default" | "sm" | "xs"', defaultValue: "default", description: "封装属性：内边距与间距密度。" },
      { name: "Item.render", type: "ReactElement | render function", description: "组合属性：将布局合并到链接等元素。" },
      { name: "ItemMedia.variant", type: '"default" | "icon" | "image"', defaultValue: "default", description: "封装属性：媒体区域的布局与裁切。" },
      { name: "Item.role", type: "React.AriaRole", description: "原生属性：按实际结构提供 listitem 等语义。" },
    ],
    accessibility: [{ title: "列表", description: "ItemGroup 的 list 需要匹配 listitem 子项；也可单独使用 Item 并提供相应原生语义。" }, { title: "操作", description: "条目操作使用真实按钮或链接，名称应包含足够的对象上下文。" }],
    code: `import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@ui-next/components/item";
import { Button } from "@ui-next/components/button";

<ItemGroup>
  <Item role="listitem" variant="outline">
    <ItemContent><ItemTitle>设计说明</ItemTitle><ItemDescription>包含说明和独立操作的内容。</ItemDescription></ItemContent>
    <ItemActions><Button size="sm" variant="outline">收藏</Button></ItemActions>
  </Item>
</ItemGroup>`,
  },
  label: {
    key: "label", name: "Label", description: "为表单控件提供持续可见的名称。该组件渲染原生 label，并提供 Luma 字体、间距和禁用状态样式。",
    anatomy: ["Label：原生 label 元素。", "htmlFor：关联控件的唯一 id。", "children：字段名称和必要的文字提示。"],
    practices: ["标签说明填写内容，placeholder 提供示例。", "重复出现的表单组件使用 useId 生成唯一关联。", "必填或可选提示应使用可读文字，避免只有符号。"],
    props: [
      { name: "htmlFor", type: "string", description: "原生属性：与对应输入控件的 id 一致。" },
      { name: "children", type: "ReactNode", description: "字段的可见名称。" },
      { name: "className", type: "string", description: "原生属性：追加布局样式；禁用样式可由关联的 peer 或父 Field 状态控制。" },
    ],
    accessibility: [{ title: "关联", description: "点击标签应聚焦或切换对应控件；htmlFor 不能指向装饰容器。" }, { title: "可见名称", description: "尽量让可访问名称与可见标签一致，帮助语音输入和辅助技术使用者。" }],
    code: `import { useId } from "react";
import { Label } from "@ui-next/components/label";
import { Input } from "@ui-next/components/input";

function DisplayName() {
  const id = useId();
  return <><Label htmlFor={id}>显示名称</Label><Input id={id} /></>;
}`,
  },
  "native-select": {
    key: "native-select", name: "Native Select", description: "为原生 select、option 和 optgroup 提供 Luma 外观。键盘操作、表单提交与移动端选项界面由浏览器提供。",
    anatomy: ["NativeSelect：外围布局、原生 select 与下拉图标。", "NativeSelectOption：原生 option。", "NativeSelectOptGroup：具有标签的选项分组。"],
    practices: ["优先用于简单、短文本选项和浏览器原生体验。", "为每个 option 提供稳定 value。", "需要搜索时使用 Combobox；需要自定义弹层时使用 Select。"],
    props: [
      { name: "value / defaultValue", type: "string | number | readonly string[]", description: "原生属性：受控值或初始值。" },
      { name: "onChange", type: "React.ChangeEventHandler<HTMLSelectElement>", description: "原生变更事件，从 event.target.value 读取选项值。" },
      { name: "size", type: '"default" | "sm"', defaultValue: "default", description: "封装属性：视觉尺寸，替代原生数字 size 属性。" },
      { name: "disabled / required", type: "boolean", defaultValue: "false", description: "原生属性：禁用状态与表单必填校验。" },
      { name: "name", type: "string", description: "原生属性：表单提交字段名。" },
      { name: "NativeSelectOption.disabled", type: "boolean", defaultValue: "false", description: "原生属性：禁用特定选项。" },
    ],
    accessibility: [{ title: "名称", description: "使用 Label 的 htmlFor 关联 select 的 id。" }, { title: "原生行为", description: "保留浏览器的键盘与移动端选择体验；不要用额外角色覆盖 select 的语义。" }],
    code: `import { useId } from "react";
import { Label } from "@ui-next/components/label";
import { NativeSelect, NativeSelectOption } from "@ui-next/components/native-select";

function StatusField() {
  const id = useId();
  return <><Label htmlFor={id}>状态</Label>
    <NativeSelect id={id} name="status" defaultValue="draft">
      <NativeSelectOption value="draft">草稿</NativeSelectOption>
      <NativeSelectOption value="published">已发布</NativeSelectOption>
    </NativeSelect>
  </>;
}`,
  },
  progress: {
    key: "progress", name: "Progress", description: "呈现任务完成比例或无法估计的等待状态。Base UI 提供进度语义，封装自动生成 Track 与 Indicator，可组合标签和数值。",
    anatomy: ["Progress：当前值与范围。", "ProgressLabel / ProgressValue：任务名称与可见数值。", "Track / Indicator：由 Progress 默认渲染的进度轨道。"],
    practices: ["已知进度使用准确数值；无法估计时传 null。", "为任务提供名称，并在完成或失败时显示文字反馈。", "进度条显示状态，取消与重试使用相邻按钮。"],
    props: [
      { name: "value", type: "number | null", description: "Base UI 必需属性：当前值；null 表示不确定进度。" },
      { name: "min", type: "number", defaultValue: "0", description: "Base UI 属性：范围最小值。" },
      { name: "max", type: "number", defaultValue: "100", description: "Base UI 属性：范围最大值。" },
      { name: "format", type: "Intl.NumberFormatOptions", description: "Base UI 属性：格式化可见数值和辅助技术读取的数值。" },
      { name: "children", type: "ReactNode", description: "可组合 ProgressLabel 和 ProgressValue；封装会附加轨道，无需重复添加。" },
    ],
    accessibility: [{ title: "名称与数值", description: "使用 ProgressLabel 或 aria-label 说明任务；Base UI 维护进度值与范围语义。" }, { title: "完成反馈", description: "任务完成或失败时提供可读状态；避免每次微小进度更新都触发额外 live 播报。" }],
    code: `import { Progress, ProgressLabel, ProgressValue } from "@ui-next/components/progress";

<Progress value={60}>
  <ProgressLabel>导入进度</ProgressLabel>
  <ProgressValue />
</Progress>`,
  },
  "radio-group": {
    key: "radio-group", name: "Radio Group", description: "从一组互斥选项中选择一个值。Base UI 管理组内键盘导航、选中状态及表单字段。",
    anatomy: ["RadioGroup：选择值、字段名与组名称。", "RadioGroupItem：具有唯一 value 的单选项。", "Label：每个选项的可见名称。"],
    practices: ["选项应相互排斥，并采用可比较的措辞。", "将相关选项放在同一组并提供组名称。", "不要在用户选择后立即触发意外导航或提交。"],
    props: [
      { name: "RadioGroup.value / defaultValue", type: "Value", description: "Base UI 属性：受控值或初始选择。" },
      { name: "RadioGroup.onValueChange", type: "(value: Value, eventDetails) => void", description: "Base UI 属性：选中项变更回调。" },
      { name: "RadioGroup.name", type: "string", description: "Base UI 属性：表单字段名。" },
      { name: "RadioGroup.disabled / readOnly / required", type: "boolean", defaultValue: "false", description: "Base UI 属性：整组禁用、只读或必填。" },
      { name: "RadioGroupItem.value", type: "Value", description: "必需的单选项值，组内唯一。" },
      { name: "RadioGroupItem.disabled", type: "boolean", defaultValue: "false", description: "禁用单个选项。" },
    ],
    accessibility: [{ title: "组和选项名称", description: "用 aria-labelledby 或 aria-label 命名组；每项通过 Label 关联 id。" }, { title: "键盘", description: "Tab 进入或离开组，方向键在可用选项间移动和选择。" }],
    code: `import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@ui-next/components/radio-group";
import { Label } from "@ui-next/components/label";

function DensityField() {
  const id = useId();
  return <><p id={id}>显示密度</p>
    <RadioGroup defaultValue="comfortable" aria-labelledby={id}>
      <div><RadioGroupItem id={id + "-comfortable"} value="comfortable" /><Label htmlFor={id + "-comfortable"}>舒适</Label></div>
      <div><RadioGroupItem id={id + "-compact"} value="compact" /><Label htmlFor={id + "-compact"}>紧凑</Label></div>
    </RadioGroup>
  </>;
}`,
  },
  separator: {
    key: "separator", name: "Separator", description: "在相关内容组之间建立视觉与语义分隔。Base UI Separator 提供方向与分隔语义，Luma 封装提供细线样式。",
    anatomy: ["Separator：分隔节点。", "orientation：水平或垂直方向。", "className：长度与局部布局。"],
    practices: ["仅在内容分组确实需要时使用。", "垂直分隔需要有明确高度的容器。", "仅为装饰的线条可使用 aria-hidden。"],
    props: [
      { name: "orientation", type: '"horizontal" | "vertical"', defaultValue: "horizontal", description: "Base UI 属性：线条方向与 aria-orientation。" },
      { name: "className", type: "string | ((state) => string | undefined)", description: "自定义尺寸和局部布局；回调的 state.orientation 为 horizontal 或 vertical，结果与基础样式合并。" },
      { name: "aria-hidden", type: "boolean", description: "原生 ARIA 属性：纯装饰分隔使用 true。" },
    ],
    accessibility: [{ title: "语义", description: "有意义的分组保留 separator 角色；纯装饰线条从辅助技术中隐藏。" }, { title: "操作", description: "静态分隔线不需要焦点；可拖动分割器需要独立的交互实现。" }],
    code: `import { Separator } from "@ui-next/components/separator";

<div className="grid gap-4">
  <p>主题与外观</p>
  <Separator />
  <p>内容显示设置</p>
</div>`,
  },
  sidebar: {
    key: "sidebar", name: "Sidebar", description: "组合工作区导航、内容分组和折叠状态。提供桌面侧栏与移动 Sheet；本页示例固定在局部容器，并关闭全局快捷键和状态持久化。",
    anatomy: ["SidebarProvider：维护展开状态、移动端状态与导航上下文。", "Sidebar / Header / Content / Footer：侧栏结构。", "SidebarGroup / Menu / MenuItem / MenuButton：分组与导航操作。"],
    practices: ["当前页面使用 isActive，并提供可理解的导航名称。", "嵌入式示例使用 collapsible=none，避免固定定位覆盖其它内容。", "同页多个示例禁用 keyboardShortcut 和 persistState；应用主侧栏可保留默认行为。"],
    props: [
      { name: "SidebarProvider.open / defaultOpen", type: "boolean", defaultValue: "defaultOpen: true", description: "受控展开状态或初始状态。" },
      { name: "SidebarProvider.onOpenChange", type: "(open: boolean) => void", description: "展开状态变更回调。" },
      { name: "SidebarProvider.keyboardShortcut / persistState", type: "boolean", defaultValue: "true / true", description: "项目扩展：分别注册全局折叠快捷键、写入侧栏状态 cookie。局部预览传 false。" },
      { name: "Sidebar.side", type: '"left" | "right"', defaultValue: "left", description: "侧栏所在一侧。" },
      { name: "Sidebar.variant", type: '"sidebar" | "floating" | "inset"', defaultValue: "sidebar", description: "侧栏与主内容的视觉关系。" },
      { name: "Sidebar.collapsible", type: '"offcanvas" | "icon" | "none"', defaultValue: "offcanvas", description: "折叠方式；none 渲染为普通布局容器。" },
      { name: "SidebarMenuButton.isActive", type: "boolean", defaultValue: "false", description: "当前导航项的视觉状态；实际链接同时提供 aria-current。" },
    ],
    accessibility: [{ title: "导航语义", description: "在侧栏内使用具有名称的 nav；链接目标明确，当前页提供 aria-current=page。" }, { title: "展开操作", description: "折叠按钮应有名称、aria-expanded 与 aria-controls；移动端保留 Sheet 的关闭与焦点管理。" }],
    code: `import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@ui-next/components/sidebar";

<SidebarProvider keyboardShortcut={false} persistState={false} className="min-h-0">
  <Sidebar collapsible="none">
    <SidebarContent>
      <nav aria-label="文档导航"><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton isActive render={<a href="/docs" aria-current="page" />}>文档</SidebarMenuButton></SidebarMenuItem>
      </SidebarMenu></nav>
    </SidebarContent>
  </Sidebar>
</SidebarProvider>`,
  },
  skeleton: {
    key: "skeleton", name: "Skeleton", description: "在内容加载期间保留与实际结构接近的视觉占位。组件仅渲染带占位样式的 div，加载状态与内容替换由使用方控制。",
    anatomy: ["Skeleton：占位块。", "className：与实际内容匹配的宽度、高度和圆角。", "外部加载区域：维护 aria-busy、状态文字与内容切换。"],
    practices: ["按真实内容结构设计少量占位，避免制造虚假进度。", "加载结束后以真实内容替换占位。", "状态文字与动画分开，尊重减少动态效果偏好。"],
    props: [
      { name: "className", type: "string", description: "原生属性：设置占位宽高、形状与动画覆盖。" },
      { name: "aria-hidden", type: "boolean", description: "纯视觉占位建议隐藏；可由外围容器统一设置。" },
      { name: "style", type: "React.CSSProperties", description: "原生 div 属性：必要时由内容尺寸设置局部样式。" },
    ],
    accessibility: [{ title: "加载状态", description: "外围内容区域用 aria-busy；使用独立 status 文字通知载入与完成。" }, { title: "减少动态", description: "纯装饰占位不应重复读出；需要时通过 motion-reduce:animate-none 关闭脉冲。" }],
    code: `import { Skeleton } from "@ui-next/components/skeleton";

<div aria-busy="true">
  <div aria-hidden="true" className="grid gap-3">
    <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
    <Skeleton className="h-4 w-full motion-reduce:animate-none" />
  </div>
  <p role="status">正在载入内容</p>
</div>`,
  },
  slider: {
    key: "slider", name: "Slider", description: "在连续范围或固定步长之间调整数值。Base UI 处理拖动、键盘和数值语义，封装根据值的数量生成滑块。",
    anatomy: ["Slider：数值、范围和交互状态。", "Control / Track / Indicator：拖动区域、轨道与填充。", "Thumb：根据 value 或 defaultValue 数量自动生成。"],
    practices: ["提供可见名称、当前数值和能理解的单位。", "使用符合任务的步长，避免要求拖动到难以达到的精确值。", "本页演示单滑块；当前封装的多个滑块共享名称，范围选择前需补充可区分的逐项标签。"],
    props: [
      { name: "value / defaultValue", type: "number | readonly number[]", description: "Base UI 属性：受控值或初始值；数组可生成多个滑块。" },
      { name: "onValueChange", type: "(value, eventDetails) => void", description: "Base UI 属性：拖动或键盘调整时的值变更。" },
      { name: "min / max", type: "number", defaultValue: "0 / 100", description: "Base UI 属性：可用数值范围。" },
      { name: "step", type: "number", defaultValue: "1", description: "Base UI 属性：每次调整的数值增量。" },
      { name: "orientation", type: '"horizontal" | "vertical"', defaultValue: "horizontal", description: "Base UI 属性：滑动方向。" },
      { name: "disabled", type: "boolean", defaultValue: "false", description: "Base UI 属性：禁用调整。" },
      { name: "aria-label / aria-labelledby", type: "string", description: "为滑块提供名称；本封装传递 Root 的名称关联给滑块。" },
    ],
    accessibility: [{ title: "键盘", description: "滑块可用 Tab 聚焦、方向键调整；Home 与 End 选择范围边界。" }, { title: "名称与数值", description: "为滑块提供名称；需要单位时用 Base UI 的 format 设置数值格式，并保留可见数值。" }],
    code: `import { useId } from "react";
import { Slider } from "@ui-next/components/slider";

function VolumeField() {
  const id = useId();
  return <><p id={id}>音量</p>
    <Slider aria-labelledby={id} defaultValue={[40]} min={0} max={100} step={5} />
  </>;
}`,
  },
  spinner: {
    key: "spinner", name: "Spinner", description: "表示短时进行中的操作。组件渲染旋转的 Hugeicons 图形，实际任务状态与完成反馈由使用方维护。",
    anatomy: ["Spinner：带默认尺寸与旋转动画的 SVG 图形。", "相邻状态文字：说明正在执行的任务。", "外部状态：控制出现、消失与完成反馈。"],
    practices: ["搭配具体任务文字，避免只有转圈图形。", "已有 status 文字时将图形标为 aria-hidden，减少重复播报。", "长任务提供进度、取消或进一步说明。"],
    props: [
      { name: "className", type: "string", description: "SVG 属性：控制尺寸和动画；默认 size-4 animate-spin。" },
      { name: "aria-label", type: "string", defaultValue: "Loading", description: "SVG 可访问名称；单独使用时改为对应任务的本地化描述。" },
      { name: "role", type: "React.AriaRole", defaultValue: "status", description: "SVG 角色；有外部 status 文字时图形可隐藏。" },
      { name: "aria-hidden", type: "boolean", description: "有相邻可读状态文字时传 true。" },
    ],
    accessibility: [{ title: "状态反馈", description: "对外提供单一清楚的状态消息，任务结束后更新为完成或错误文字。" }, { title: "减少动态", description: "使用 motion-reduce:animate-none 时保留状态文字，让无需动画也能理解当前任务。" }],
    code: `import { Spinner } from "@ui-next/components/spinner";

<div className="flex items-center gap-3">
  <Spinner aria-hidden="true" className="motion-reduce:animate-none" />
  <span role="status">正在载入内容</span>
</div>`,
  },
  table: {
    key: "table", name: "Table", description: "为原生表格提供一致的行、列、边框和滚动样式。数据、排序、筛选和分页由使用方实现，组件本身保留 HTML 表格语义。",
    anatomy: ["Table / TableCaption：表格与内容说明。", "TableHeader / Body / Footer：表头、主体与汇总区域。", "TableRow / Head / Cell：行、表头单元格与数据单元格。"],
    practices: ["仅在数据具有行列关系时使用表格。", "列名清楚，数字保持便于比较的对齐方式。", "排序等交互使用真实按钮，并明确表达当前排序状态。"],
    props: [
      { name: "Table.children", type: "ReactNode", description: "原生表格内容，按 caption、thead、tbody、tfoot 组合。" },
      { name: "Table.className", type: "string", description: "表格本体样式；外层容器负责水平滚动。" },
      { name: "TableHead.scope", type: '"col" | "row" | "colgroup" | "rowgroup"', description: "原生 th 属性：标明表头对应的数据范围。" },
      { name: "TableCell.colSpan / rowSpan", type: "number", description: "原生 td 属性：跨列或跨行。" },
      { name: "TableRow.data-state", type: "string", description: "样式状态：selected 可呈现选中行；选择逻辑需由使用方实现。" },
    ],
    accessibility: [{ title: "表头关系", description: "使用 TableHead 和 scope 建立表头关系；复杂合并表格需要额外 headers / id 关联。" }, { title: "表格说明", description: "TableCaption 或 aria-label 说明表格用途；不要用 div 模拟已有的原生表格结构。" }],
    code: `import { Table, TableCaption, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@ui-next/components/table";

<Table>
  <TableCaption>内容清单</TableCaption>
  <TableHeader><TableRow><TableHead scope="col">名称</TableHead><TableHead scope="col">状态</TableHead></TableRow></TableHeader>
  <TableBody><TableRow><TableCell>设计规范</TableCell><TableCell>已发布</TableCell></TableRow></TableBody>
</Table>`,
  },
  toggle: {
    key: "toggle", name: "Toggle", description: "控制一个可持续开启或关闭的模式，例如文字格式。Base UI 管理按下状态，Luma 封装提供普通与边框视觉。",
    anatomy: ["Toggle：可聚焦的切换按钮。", "pressed：持续生效的按下状态。", "children：文字或具有独立名称的图标。"],
    practices: ["用于保持状态的操作；一次性命令使用 Button。", "切换前后保持稳定的名称，让按下状态表达是否开启。", "仅图标的按钮提供 aria-label。"],
    props: [
      { name: "pressed / defaultPressed", type: "boolean", description: "Base UI 属性：受控或初始按下状态。" },
      { name: "onPressedChange", type: "(pressed: boolean, eventDetails) => void", description: "Base UI 属性：切换状态回调。" },
      { name: "variant", type: '"default" | "outline"', defaultValue: "default", description: "封装属性：视觉变体。" },
      { name: "size", type: '"default" | "sm" | "lg"', defaultValue: "default", description: "封装属性：控件尺寸。" },
      { name: "disabled", type: "boolean", defaultValue: "false", description: "Base UI 属性：禁用交互。" },
    ],
    accessibility: [{ title: "状态", description: "Base UI 通过 aria-pressed 表达状态；不要另行覆盖为冲突的角色或状态。" }, { title: "键盘与名称", description: "Tab 聚焦，Enter 或空格切换；按钮的可访问名称应保持稳定。" }],
    code: `import { Toggle } from "@ui-next/components/toggle";

<Toggle variant="outline" aria-label="加粗">加粗</Toggle>`,
  },
  "toggle-group": {
    key: "toggle-group", name: "Toggle Group", description: "将相关的持续状态按钮组合为单选或多选集合。Base UI 管理方向键导航，Luma 封装统一组内尺寸、变体和间距。",
    anatomy: ["ToggleGroup：选择值数组、导航方向和组名称。", "ToggleGroupItem：具有唯一 value 的切换按钮。", "variant / size / spacing：由组传给各项的视觉配置。"],
    practices: ["互斥模式使用单选，可同时生效的格式使用 multiple。", "单选模式同样使用值数组，而不是字符串。", "为整个组和每个图标按钮提供清楚的名称。"],
    props: [
      { name: "value / defaultValue", type: "readonly string[]", description: "Base UI 属性：受控值或初始值；单选也使用数组。" },
      { name: "onValueChange", type: "(value: string[], eventDetails) => void", description: "Base UI 属性：选择集合变更。" },
      { name: "multiple", type: "boolean", defaultValue: "false", description: "Base UI 属性：允许多项同时开启。" },
      { name: "orientation", type: '"horizontal" | "vertical"', defaultValue: "horizontal", description: "封装与 Base UI 属性：布局和键盘导航方向。" },
      { name: "variant / size", type: '"default" | "outline" / "default" | "sm" | "lg"', defaultValue: "default / default", description: "组内按钮的统一视觉配置。" },
      { name: "spacing", type: "number", defaultValue: "2", description: "封装属性：Tailwind 间距倍数；0 将边框按钮连接在一起。" },
      { name: "ToggleGroupItem.value / disabled", type: "string / boolean", description: "子项属性：唯一值与是否禁用。" },
    ],
    accessibility: [{ title: "键盘", description: "Tab 进入或离开按钮组，方向键在可用项间移动；保留 Base UI 的焦点管理。" }, { title: "状态与名称", description: "每项用 aria-pressed 表达开启状态；用 aria-label 或可见文字命名组和按钮。" }],
    code: `import { ToggleGroup, ToggleGroupItem } from "@ui-next/components/toggle-group";

<ToggleGroup multiple defaultValue={["bold"]} variant="outline" aria-label="文本格式">
  <ToggleGroupItem value="bold" aria-label="加粗">加粗</ToggleGroupItem>
  <ToggleGroupItem value="italic" aria-label="斜体">斜体</ToggleGroupItem>
  <ToggleGroupItem value="underline" aria-label="下划线">下划线</ToggleGroupItem>
</ToggleGroup>`,
  },
};
