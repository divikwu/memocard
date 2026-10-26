import { useId, useState } from "react";
import { Bar, BarChart, XAxis } from "recharts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ui/components/accordion";
import { Badge } from "@ui/components/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@ui/components/breadcrumb";
import { Button } from "@ui/components/button";
import { Calendar } from "@ui/components/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@ui/components/chart";
import { Checkbox } from "@ui/components/checkbox";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@ui/components/combobox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@ui/components/empty";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui/components/field";
import { Input } from "@ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@ui/components/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@ui/components/item";
import { Label } from "@ui/components/label";
import { NativeSelect, NativeSelectOption } from "@ui/components/native-select";
import { Progress, ProgressLabel, ProgressValue } from "@ui/components/progress";
import { RadioGroup, RadioGroupItem } from "@ui/components/radio-group";
import { Separator } from "@ui/components/separator";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from "@ui/components/sidebar";
import { Skeleton } from "@ui/components/skeleton";
import { Slider } from "@ui/components/slider";
import { Spinner } from "@ui/components/spinner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@ui/components/table";
import { Toggle } from "@ui/components/toggle";
import { ToggleGroup, ToggleGroupItem } from "@ui/components/toggle-group";
import { DocumentIcon, SearchIcon } from "./icons";

export function AccordionExample() {
  return <Accordion defaultValue={["theme"]} className="w-full max-w-md">
    <AccordionItem value="theme"><AccordionTrigger>主题如何切换？</AccordionTrigger><AccordionContent>使用工具栏在浅色和深色模式之间切换。</AccordionContent></AccordionItem>
    <AccordionItem value="radius"><AccordionTrigger>圆角基准是多少？</AccordionTrigger><AccordionContent>控件基准为 8px，其余圆角按语义派生。</AccordionContent></AccordionItem>
  </Accordion>;
}

export function BadgeExample() {
  return <div className="flex flex-wrap items-center gap-3"><Badge>默认</Badge><Badge variant="secondary">次要</Badge><Badge variant="outline">边框</Badge><Badge variant="destructive">需要处理</Badge></div>;
}

export function BreadcrumbExample() {
  const [location, setLocation] = useState("当前文档");
  return <div className="grid gap-4"><Breadcrumb aria-label="文档位置"><BreadcrumbList>
    <BreadcrumbItem><BreadcrumbLink href="#" onClick={event => { event.preventDefault(); setLocation("知识库"); }}>知识库</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbLink href="#" onClick={event => { event.preventDefault(); setLocation("设计规范"); }}>设计规范</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator />
    <BreadcrumbItem><BreadcrumbPage>当前文档</BreadcrumbPage></BreadcrumbItem>
  </BreadcrumbList></Breadcrumb><p role="status" className="text-sm text-secondary">示例导航：{location}</p></div>;
}

export function CalendarExample() {
  const id = useId();
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 9, 22));
  return <div className="grid justify-items-start gap-4"><Calendar mode="single" selected={date} onSelect={setDate} defaultMonth={new Date(2026, 9, 1)} aria-describedby={id} /><p id={id} role="status" className="text-sm text-secondary">{date ? `已选择 ${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : "尚未选择日期"}</p></div>;
}

const chartData = [{ day: "周一", notes: 4 }, { day: "周二", notes: 7 }, { day: "周三", notes: 5 }];
const chartConfig = { notes: { label: "笔记数量", color: "var(--color-data-blue-2)" } } satisfies ChartConfig;
export function ChartExample() {
  const id = useId();
  return <figure className="w-full max-w-md"><figcaption id={id} className="mb-4 text-sm">笔记数量示例：周一 4、周二 7、周三 5</figcaption><ChartContainer config={chartConfig} className="h-48 w-full" aria-labelledby={id}>
    <BarChart accessibilityLayer data={chartData}><XAxis dataKey="day" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="notes" fill="var(--color-notes)" radius={4} /></BarChart>
  </ChartContainer></figure>;
}

export function CheckboxExample() {
  const id = useId();
  const [checked, setChecked] = useState(true);
  const [mixed, setMixed] = useState(true);
  const [mixedChecked, setMixedChecked] = useState(false);
  return <div className="grid gap-4"><div className="flex items-center gap-3"><Checkbox id={id} checked={checked} onCheckedChange={setChecked} /><Label htmlFor={id}>接收更新通知</Label></div><div className="flex items-center gap-3"><Checkbox id={`${id}-mixed`} indeterminate={mixed} checked={mixedChecked} onCheckedChange={next => { setMixed(false); setMixedChecked(next); }} /><Label htmlFor={`${id}-mixed`}>选择全部项目（初始部分选中）</Label></div><div className="flex items-center gap-3"><Checkbox id={`${id}-disabled`} disabled /><Label htmlFor={`${id}-disabled`}>暂不可用</Label></div><p role="status" className="text-sm text-secondary">通知{checked ? "已开启" : "已关闭"}</p></div>;
}

const fonts = ["Noto Sans", "Noto Serif", "系统字体"];
export function ComboboxExample() {
  const id = useId();
  const [font, setFont] = useState<string | null>("Noto Sans");
  return <div className="grid w-full max-w-sm gap-3"><Label id={`${id}-label`} htmlFor={id}>字体</Label><Combobox items={fonts} value={font} onValueChange={setFont}>
    <ComboboxInput id={id} aria-labelledby={`${id}-label`} placeholder="搜索字体" showClear />
    <ComboboxContent><ComboboxEmpty>没有匹配字体</ComboboxEmpty><ComboboxList>{item => <ComboboxItem key={String(item)} value={item}>{String(item)}</ComboboxItem>}</ComboboxList></ComboboxContent>
  </Combobox><p role="status" className="text-sm text-secondary">当前选择：{font ?? "未选择"}</p></div>;
}

export function EmptyExample() {
  const [created, setCreated] = useState(false);
  return created ? <div className="grid justify-items-start gap-4"><p role="status">已创建示例内容。</p><Button variant="outline" onClick={() => setCreated(false)}>恢复空状态</Button></div> : <Empty className="max-w-md"><EmptyHeader><EmptyMedia variant="icon"><DocumentIcon aria-hidden="true" /></EmptyMedia><EmptyTitle>还没有内容</EmptyTitle><EmptyDescription>创建第一项内容，开始整理想法。</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={() => setCreated(true)}>创建内容</Button></EmptyContent></Empty>;
}

export function FieldExample() {
  const id = useId();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  return <form className="grid w-full max-w-sm gap-4" onSubmit={event => { event.preventDefault(); setInvalid(!value.trim()); }}><Field data-invalid={invalid || undefined}><FieldLabel htmlFor={id}>名称</FieldLabel><Input id={id} value={value} onChange={event => { setValue(event.target.value); setInvalid(false); }} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : `${id}-description`} /><FieldDescription id={`${id}-description`}>填写一个容易识别的名称。</FieldDescription>{invalid && <FieldError id={`${id}-error`}>请输入名称。</FieldError>}</Field><Button type="submit" variant="outline">检查字段</Button></form>;
}

export function InputGroupExample() {
  const id = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  return <form className="grid w-full max-w-sm gap-3" onSubmit={event => { event.preventDefault(); setResult(query.trim() || "全部内容"); }}><Label htmlFor={id}>搜索</Label><InputGroup><InputGroupAddon><SearchIcon aria-hidden="true" className="size-4" /></InputGroupAddon><InputGroupInput id={id} value={query} onChange={event => setQuery(event.target.value)} placeholder="输入关键词" /><InputGroupAddon align="inline-end"><InputGroupButton type="submit">搜索</InputGroupButton></InputGroupAddon></InputGroup>{result && <p role="status" className="text-sm text-secondary">示例搜索：{result}</p>}</form>;
}

export function ItemExample() {
  const [selected, setSelected] = useState(false);
  return <div className="grid w-full max-w-md gap-3"><ItemGroup><Item role="listitem" variant="outline"><ItemContent><ItemTitle>设计说明</ItemTitle><ItemDescription>一条包含说明和独立操作的内容。</ItemDescription></ItemContent><ItemActions><Button size="sm" variant="outline" aria-pressed={selected} onClick={() => setSelected(!selected)}>{selected ? "已收藏" : "收藏"}</Button></ItemActions></Item></ItemGroup><p role="status" className="text-sm text-secondary">{selected ? "内容已收藏" : "内容未收藏"}</p></div>;
}

export function LabelExample() {
  const id = useId();
  return <div className="grid w-full max-w-sm gap-3"><Label htmlFor={id}>显示名称</Label><Input id={id} placeholder="点击标签也可聚焦输入框" /></div>;
}

export function NativeSelectExample() {
  const id = useId();
  const [status, setStatus] = useState("draft");
  return <div className="grid justify-items-start gap-3"><Label htmlFor={id}>状态</Label><NativeSelect id={id} value={status} onChange={event => setStatus(event.target.value)}><NativeSelectOption value="draft">草稿</NativeSelectOption><NativeSelectOption value="published">已发布</NativeSelectOption><NativeSelectOption disabled value="archived">已归档（不可用）</NativeSelectOption></NativeSelect><p role="status" className="text-sm text-secondary">当前值：{status}</p></div>;
}

export function ProgressExample() {
  const [progress, setProgress] = useState<number | null>(60);
  return <div className="grid w-full max-w-sm gap-4"><Progress value={progress}><ProgressLabel>导入进度</ProgressLabel><ProgressValue /></Progress><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setProgress(Math.max(0, (progress ?? 0) - 10))}>减少</Button><Button variant="outline" size="sm" onClick={() => setProgress(Math.min(100, (progress ?? 0) + 10))}>增加</Button><Button variant="ghost" size="sm" onClick={() => setProgress(progress === null ? 60 : null)}>{progress === null ? "显示进度" : "不确定进度"}</Button></div></div>;
}

export function RadioGroupExample() {
  const id = useId();
  const [value, setValue] = useState("comfortable");
  return <div className="grid gap-4"><p id={id} className="text-sm font-medium">显示密度</p><RadioGroup aria-labelledby={id} value={value} onValueChange={next => setValue(String(next))}><div className="flex items-center gap-3"><RadioGroupItem id={`${id}-comfortable`} value="comfortable" /><Label htmlFor={`${id}-comfortable`}>舒适</Label></div><div className="flex items-center gap-3"><RadioGroupItem id={`${id}-compact`} value="compact" /><Label htmlFor={`${id}-compact`}>紧凑</Label></div><div className="flex items-center gap-3"><RadioGroupItem id={`${id}-disabled`} value="disabled" disabled /><Label htmlFor={`${id}-disabled`}>暂不可用</Label></div></RadioGroup><p role="status" className="text-sm text-secondary">当前密度：{value === "compact" ? "紧凑" : "舒适"}</p></div>;
}

export function SeparatorExample() {
  return <div className="grid w-full max-w-sm gap-4"><p>主题与外观</p><Separator /><p className="text-sm text-secondary">将相关内容分组，并保留清楚的结构。</p><div className="flex h-6 items-center gap-4"><span>说明</span><Separator orientation="vertical" /><span>帮助</span></div></div>;
}

export function SkeletonExample() {
  const [loading, setLoading] = useState(true);
  return <div className="grid w-full max-w-sm gap-4"><div aria-busy={loading}>{loading ? <div aria-hidden="true" className="grid gap-3"><Skeleton className="h-5 w-2/3 motion-reduce:animate-none" /><Skeleton className="h-4 w-full motion-reduce:animate-none" /><Skeleton className="h-4 w-4/5 motion-reduce:animate-none" /></div> : <div className="grid gap-2"><p>内容已加载</p><p className="text-sm text-secondary">这是与占位结构对应的真实内容。</p></div>}</div><p role="status" className="text-sm text-secondary">{loading ? "正在载入示例内容" : "示例内容已就绪"}</p><Button size="sm" variant="outline" onClick={() => setLoading(!loading)}>{loading ? "完成载入" : "重新载入"}</Button></div>;
}

export function SliderExample() {
  const id = useId();
  const [value, setValue] = useState([40]);
  return <div className="grid w-full max-w-sm gap-4"><p id={id} className="text-sm font-medium">音量</p><Slider aria-labelledby={id} value={value} onValueChange={next => setValue(Array.isArray(next) ? [...next] : [Number(next)])} min={0} max={100} step={5} /><p className="text-sm text-secondary">当前音量：{value[0]}%</p></div>;
}

export function SpinnerExample() {
  const [loading, setLoading] = useState(true);
  return <div className="grid justify-items-start gap-4"><div className="flex items-center gap-3">{loading && <Spinner aria-hidden="true" className="motion-reduce:animate-none" />}<span role="status">{loading ? "正在载入" : "载入完成"}</span></div><Button size="sm" variant="outline" onClick={() => setLoading(!loading)}>{loading ? "完成载入" : "重新载入"}</Button></div>;
}

export function TableExample() {
  return <div className="w-full max-w-md"><Table><TableCaption>示例内容清单</TableCaption><TableHeader><TableRow><TableHead scope="col">名称</TableHead><TableHead scope="col">状态</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>设计规范</TableCell><TableCell>已发布</TableCell></TableRow><TableRow><TableCell>组件草稿</TableCell><TableCell>草稿</TableCell></TableRow></TableBody></Table></div>;
}

export function ToggleExample() {
  const [pressed, setPressed] = useState(false);
  return <div className="grid justify-items-start gap-3"><Toggle pressed={pressed} onPressedChange={setPressed} variant="outline" aria-label="加粗">加粗</Toggle><p role="status" className="text-sm text-secondary">{pressed ? "加粗已开启" : "加粗未开启"}</p></div>;
}

export function ToggleGroupExample() {
  const [value, setValue] = useState(["bold"]);
  return <div className="grid justify-items-start gap-3"><ToggleGroup multiple value={value} onValueChange={setValue} variant="outline" aria-label="文本格式"><ToggleGroupItem value="bold" aria-label="加粗">加粗</ToggleGroupItem><ToggleGroupItem value="italic" aria-label="斜体">斜体</ToggleGroupItem><ToggleGroupItem value="underline" aria-label="下划线">下划线</ToggleGroupItem></ToggleGroup><p role="status" className="text-sm text-secondary">已启用：{value.join("、") || "无"}</p></div>;
}


export function SidebarExample() {
  const id = useId();
  const [open, setOpen] = useState(true);
  const [page, setPage] = useState("概览");
  return <SidebarProvider open={open} onOpenChange={setOpen} keyboardShortcut={false} persistState={false} className="min-h-0 w-full max-w-lg overflow-hidden rounded-container border border-border">
    <Sidebar id={id} collapsible="none" className="w-36 shrink-0 border-r border-border" style={{ display: open ? undefined : "none" }}>
      <SidebarHeader><p className="px-2 text-sm font-medium">示例工作区</p></SidebarHeader>
      <SidebarContent><nav aria-label="示例导航"><SidebarGroup><SidebarGroupLabel>文档</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
        {["概览", "最近内容", "收藏"].map(label => <SidebarMenuItem key={label}><SidebarMenuButton isActive={page === label} aria-current={page === label ? "page" : undefined} onClick={() => setPage(label)}>{label}</SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu></SidebarGroupContent></SidebarGroup></nav></SidebarContent>
    </Sidebar>
    <div className="grid min-w-0 flex-1 content-start gap-4 p-4"><Button size="sm" variant="outline" aria-controls={id} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "收起导航" : "展开导航"}</Button><p role="status" className="text-sm">当前页面：{page}</p><p className="text-sm text-secondary">此导航仅作用于当前示例。</p></div>
  </SidebarProvider>;
}

export const additionalExamplesMap = {
  accordion: AccordionExample,
  badge: BadgeExample,
  breadcrumb: BreadcrumbExample,
  calendar: CalendarExample,
  chart: ChartExample,
  checkbox: CheckboxExample,
  combobox: ComboboxExample,
  empty: EmptyExample,
  field: FieldExample,
  "input-group": InputGroupExample,
  item: ItemExample,
  label: LabelExample,
  "native-select": NativeSelectExample,
  progress: ProgressExample,
  "radio-group": RadioGroupExample,
  separator: SeparatorExample,
  sidebar: SidebarExample,
  skeleton: SkeletonExample,
  slider: SliderExample,
  spinner: SpinnerExample,
  table: TableExample,
  toggle: ToggleExample,
  "toggle-group": ToggleGroupExample,
};
