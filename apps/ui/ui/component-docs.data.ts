import { additionalComponentDocs, type AdditionalComponentKey } from "./additional-component-docs.data";

export type CoreComponentKey = "button" | "input" | "textarea" | "card" | "dialog" | "dropdown-menu" | "popover" | "select" | "sheet" | "switch" | "tabs" | "tooltip";

export type ComponentKey = CoreComponentKey | AdditionalComponentKey;

export type ComponentDoc = {
  key: ComponentKey;
  name: string;
  description: string;
  anatomy: string[];
  practices: string[];
  props: { name: string; type: string; defaultValue?: string; description: string }[];
  accessibility: { title: string; description: string }[];
  code: string;
};

const coreComponentDocs: Record<CoreComponentKey, ComponentDoc> = {
  button: {
    key: "button", name: "Button", description: "触发操作的按钮。Luma 提供主要、次要、边框、轻量、危险和链接六种视觉变体，交互由 Base UI Button 承载。",
    anatomy: ["Button：可聚焦的操作节点。", "children：操作文字与可选的 Hugeicons 图标。", "variant / size：决定视觉强调与尺寸。"],
    practices: ["使用明确的动词描述操作；同一区域突出一个主要操作。", "ghost 按钮的 hover 使用 bg-overlay-hover：浅色黑色 4%，深色白色 4%；侧栏展开按钮的展开态覆盖同样沿用该角色。", "图标按钮使用 icon 尺寸，并提供独立的可访问名称。", "导航使用链接语义；危险操作采用 destructive 视觉并说明后果。"],
    props: [
      { name: "variant", type: '"default" | "outline" | "secondary" | "ghost" | "destructive" | "link"', defaultValue: "default", description: "封装属性：选择视觉变体。" },
      { name: "size", type: '"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"', defaultValue: "default", description: "封装属性：文字按钮或仅图标按钮的尺寸。" },
      { name: "disabled", type: "boolean", defaultValue: "false", description: "Base UI 属性：禁用按钮交互。" },
      { name: "onClick", type: "React.MouseEventHandler", description: "Base UI 按钮点击事件。异步状态由使用方维护。" },
      { name: "render", type: "ReactElement | render function", description: "Base UI 组合属性：合并到自定义元素；改变元素时需保持相应语义。" },
      { name: "aria-label", type: "string", description: "为没有可见文字的按钮提供名称。" },
    ],
    accessibility: [{ title: "键盘", description: "可用 Tab 聚焦；原生按钮支持 Enter 与空格激活。" }, { title: "焦点", description: "键盘焦点使用统一 focus-ring，禁用状态不会接受操作。" }, { title: "名称", description: "可见文字应说明目的；装饰图标使用 aria-hidden。" }],
    code: `import { Button } from "@ui/components/button";

<>
  <Button type="submit">保存</Button>
  <Button variant="outline">取消</Button>
  <Button variant="destructive">移入回收站</Button>
</>`,
  },
  input: {
    key: "input", name: "Input", description: "用于单行文本和常见表单字段。封装采用 Base UI Input，并保留原生 input 属性、事件与表单语义。",
    anatomy: ["label：字段的可见名称，由使用方提供。", "Input：单行输入节点。", "描述 / 错误信息：通过 aria-describedby 与字段关联。"],
    practices: ["为字段提供持续可见的 label；placeholder 用于示例。", "受控 value 与 onChange 成对使用，默认值使用 defaultValue。", "无效状态同时提供错误文字，保留用户已输入的内容。"],
    props: [
      { name: "type", type: "React.HTMLInputTypeAttribute", defaultValue: "text", description: "原生属性：选择文本、邮箱、密码等输入类型。" },
      { name: "value / defaultValue", type: "string | number | readonly string[]", description: "原生属性：分别用于受控值和初始值。" },
      { name: "onChange", type: "React.ChangeEventHandler<HTMLInputElement>", description: "原生输入变更事件，从 event.target.value 读取内容。" },
      { name: "disabled / readOnly", type: "boolean", defaultValue: "false", description: "原生属性：分别表示不可交互和只读。" },
      { name: "placeholder", type: "string", description: "原生属性：为空时显示的格式提示，不能替代字段名称。" },
      { name: "aria-invalid", type: 'React.AriaAttributes["aria-invalid"]', description: "标记无效状态，并触发相应边框样式。" },
      { name: "aria-describedby", type: "string", description: "关联描述或错误消息元素的 ID。" },
    ],
    accessibility: [{ title: "字段名称", description: "label 的 htmlFor 与 Input 的 id 对应，或通过 aria-labelledby 关联。" }, { title: "错误说明", description: "校验失败时同时设置 aria-invalid 和可读的错误文字。" }, { title: "输入辅助", description: "按用途提供 autoComplete、inputMode 与合适的 type。" }],
    code: `import { Input } from "@ui/components/input";

<>
  <label htmlFor="email">电子邮箱</label>
  <Input id="email" type="email" autoComplete="email"
    aria-invalid="true" aria-describedby="email-error" />
  <p id="email-error">请输入完整的电子邮箱地址。</p>
</>`,
  },
  textarea: {
    key: "textarea", name: "Textarea", description: "用于多行文本输入。封装保留原生 textarea 的值、事件与表单属性，默认按内容调整高度并提供最小高度。使用独立的 rounded-textarea 圆角，默认 12px、None 时 0px。",
    anatomy: ["label：说明需要填写的内容。", "Textarea：多行输入节点。", "描述 / 错误信息：说明格式、限制或修正方式。"],
    practices: ["为较长内容提供足够空间，并保持描述靠近字段。", "长度限制通过 maxLength 与可见说明配合传达。", "提交状态和保存反馈由使用方实现，避免仅依靠颜色提示。"],
    props: [
      { name: "value / defaultValue", type: "string | number | readonly string[]", description: "原生属性：受控内容或初始内容。" },
      { name: "onChange", type: "React.ChangeEventHandler<HTMLTextAreaElement>", description: "原生多行输入变更事件。" },
      { name: "rows", type: "number", description: "原生属性：建议的可见行数，最终高度也受 CSS 约束。" },
      { name: "maxLength", type: "number", description: "原生属性：允许输入的最大字符数。" },
      { name: "disabled / readOnly", type: "boolean", defaultValue: "false", description: "原生属性：禁用或只读状态。" },
      { name: "aria-invalid / aria-describedby", type: "boolean / string", description: "分别标记无效内容和关联说明信息。" },
    ],
    accessibility: [{ title: "字段名称", description: "为文本域提供 label，placeholder 仅用于补充示例。" }, { title: "错误信息", description: "错误信息通过 aria-describedby 关联，并说明如何修正。" }, { title: "键盘", description: "保留原生多行编辑行为，避免拦截 Tab 导致键盘无法离开。" }],
    code: `import { Textarea } from "@ui/components/textarea";

<>
  <label htmlFor="description">说明</label>
  <Textarea id="description" rows={4} maxLength={500}
    aria-describedby="description-hint" />
  <p id="description-hint">最多填写 500 个字符。</p>
</>`,
  },
  card: {
    key: "card", name: "Card", description: "组织相关内容与操作的静态表面。Card 本身不提供点击、选择或焦点行为，使用标题、说明、正文和页脚组合内容。",
    anatomy: ["Card：容器与统一间距。", "CardHeader / CardTitle / CardDescription / CardAction：标题区、说明及可选操作。", "CardContent / CardFooter：正文与底部信息。"],
    practices: ["卡片内的内容应围绕一个主题，操作放在可预测的位置。", "交互使用明确的按钮或链接，不将整个 div 当作按钮。", "需要文档标题时在 CardTitle 内提供合适层级的标题元素。"],
    props: [
      { name: "Card.size", type: '"default" | "sm"', defaultValue: "default", description: "封装属性：调整卡片的内边距与区块间距。" },
      { name: "children", type: "ReactNode", description: "组合 CardHeader、CardContent、CardFooter 等子部件。" },
      { name: "className", type: "string", description: "各子部件保留原生 div 属性；可补充布局和宽度。" },
      { name: "role / aria-labelledby", type: "string", description: "原生属性：仅在内容需要区域语义时提供，默认不生成交互角色。" },
    ],
    accessibility: [{ title: "内容结构", description: "CardTitle 默认渲染 div；标题层级由使用方明确提供。" }, { title: "交互语义", description: "可点击内容使用链接或按钮，并提供独立焦点。" }, { title: "阅读顺序", description: "标题、说明、内容与操作的 DOM 顺序应与视觉顺序一致。" }],
    code: `import { Card, CardHeader, CardTitle, CardDescription,
  CardContent, CardFooter } from "@ui/components/card";

<Card>
  <CardHeader>
    <CardTitle><h3>项目概览</h3></CardTitle>
    <CardDescription>当前状态与相关信息。</CardDescription>
  </CardHeader>
  <CardContent>卡片正文</CardContent>
  <CardFooter>更新时间：今天</CardFooter>
</Card>`,
  },
  dialog: {
    key: "dialog", name: "Dialog", description: "展示需要用户集中处理的模态内容。Root 管理开关状态，Content 内组合标题、说明、正文和操作；默认提供右上角关闭按钮。",
    anatomy: ["Dialog / DialogTrigger：状态根节点与触发器。", "DialogContent：包含 Portal、遮罩和内容面板。", "DialogHeader / Title / Description / Footer / Close：内容与关闭操作。"],
    practices: ["每个对话框提供清楚的标题和必要的说明。", "表单提交结果由使用方处理，操作完成后再关闭。", "需要替换默认关闭按钮时，仍提供可键盘操作的关闭路径。"],
    props: [
      { name: "Dialog.open / defaultOpen", type: "boolean", description: "Base UI Root 属性：受控开关或初始开关。defaultOpen 默认 false。" },
      { name: "Dialog.onOpenChange", type: "(open, eventDetails) => void", description: "Base UI Root 属性：开关变化通知，可读取触发原因。" },
      { name: "Dialog.modal", type: 'boolean | "trap-focus"', defaultValue: "true", description: "Base UI Root 属性：模态与焦点约束模式。" },
      { name: "DialogTrigger.render", type: "ReactElement | render function", description: "Base UI 组合属性：使用 render={<Button />} 复用按钮样式。" },
      { name: "DialogContent.showCloseButton", type: "boolean", defaultValue: "true", description: "封装属性：是否显示内容区右上角关闭按钮。" },
      { name: "DialogFooter.showCloseButton", type: "boolean", defaultValue: "false", description: "封装属性：在页脚末尾追加关闭按钮。" },
    ],
    accessibility: [{ title: "名称与描述", description: "使用 DialogTitle 和 DialogDescription 建立面板名称与说明关联。" }, { title: "焦点管理", description: "默认模态打开后限制焦点在面板内，关闭后返回触发器；使用方需验收实际焦点位置。" }, { title: "关闭", description: "保留 Escape 与明确的关闭操作，避免只提供鼠标可用的关闭方式。" }],
    code: `import { Button } from "@ui/components/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@ui/components/dialog";

<Dialog>
  <DialogTrigger render={<Button />}>编辑信息</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>编辑信息</DialogTitle>
      <DialogDescription>修改完成后保存。</DialogDescription>
    </DialogHeader>
    <p>在这里放置表单内容。</p>
    <DialogFooter><DialogClose render={<Button variant="outline" />}>取消</DialogClose></DialogFooter>
  </DialogContent>
</Dialog>`,
  },
  "dropdown-menu": {
    key: "dropdown-menu", name: "Dropdown Menu", description: "把一组操作收纳到触发器旁的弹出菜单。支持普通操作、复选项、单选组和子菜单，使用 Default / Solid 表面与 Subtle 高亮。",
    anatomy: ["DropdownMenu / Trigger / Content：根状态、触发按钮和定位菜单。", "Group / Label / Item / Separator：分组、标签、操作与分隔。", "CheckboxItem / RadioGroup / RadioItem / Sub：选择项和子菜单。"],
    practices: ["菜单用于操作集合；表单值选择优先使用 Select。", "危险操作使用 destructive 视觉与清楚的文字。", "复杂交互或表单放进 Dialog / Popover，保持菜单项简短。"],
    props: [
      { name: "DropdownMenu.open / defaultOpen", type: "boolean", description: "Base UI Root 属性：受控或非受控开关。defaultOpen 默认 false。" },
      { name: "DropdownMenu.onOpenChange", type: "(open, eventDetails) => void", description: "Base UI Root 属性：菜单打开和关闭的变化通知。" },
      { name: "DropdownMenuContent.align", type: '"start" | "center" | "end"', defaultValue: "start", description: "封装定位属性：与触发器的对齐方式。" },
      { name: "DropdownMenuContent.sideOffset", type: "number", defaultValue: "4", description: "封装定位属性：菜单与触发器的距离，单位 px。" },
      { name: "DropdownMenuItem.variant", type: '"default" | "destructive"', defaultValue: "default", description: "封装属性：普通或危险操作的视觉。" },
      { name: "DropdownMenuItem.disabled", type: "boolean", defaultValue: "false", description: "Base UI Item 属性：禁止执行此操作。" },
      { name: "DropdownMenuCheckboxItem.checked", type: "boolean", description: "Base UI CheckboxItem 属性：与 onCheckedChange 配对维护选中状态。" },
    ],
    accessibility: [{ title: "触发器", description: "使用可聚焦的按钮，Base UI 管理菜单展开状态关联。" }, { title: "键盘导航", description: "支持方向键移动、键入查找和 Escape 关闭，禁用项不可执行。" }, { title: "状态语义", description: "复选项和单选项使用对应子部件，避免以普通菜单项模拟选中状态。" }],
    code: `import { Button } from "@ui/components/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator } from "@ui/components/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger render={<Button variant="outline" />}>更多操作</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => console.info("创建副本")}>创建副本</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive" onClick={() => console.info("移入回收站")}>移入回收站</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
  },
  popover: {
    key: "popover", name: "Popover", description: "在触发器附近展示轻量内容、辅助设置或短表单。默认允许继续与页面其他区域交互，内容由 Portal 定位。",
    anatomy: ["Popover / PopoverTrigger：管理开关与触发器。", "PopoverContent：与触发器定位关联的内容面板。", "PopoverHeader / Title / Description：可选的标题与说明组合。"],
    practices: ["内容保持简短，需要更完整流程时使用 Dialog 或 Sheet。", "表单字段保留 label，并为内容区提供清楚名称。", "将关闭与保存行为按实际需求实现，避免自动丢弃输入。"],
    props: [
      { name: "Popover.open / defaultOpen", type: "boolean", description: "Base UI Root 属性：受控或初始开关。defaultOpen 默认 false。" },
      { name: "Popover.onOpenChange", type: "(open, eventDetails) => void", description: "Base UI Root 属性：打开和关闭的变化通知。" },
      { name: "Popover.modal", type: 'boolean | "trap-focus"', defaultValue: "false", description: "Base UI Root 属性：决定面板的模态和焦点约束。" },
      { name: "PopoverContent.side", type: '"top" | "right" | "bottom" | "left" | "inline-start" | "inline-end"', defaultValue: "bottom", description: "封装定位属性：优先放置方向，实际位置由空间约束决定。" },
      { name: "PopoverContent.align", type: '"start" | "center" | "end"', defaultValue: "center", description: "封装定位属性：与触发器的对齐方式。" },
      { name: "PopoverContent.sideOffset", type: "number", defaultValue: "4", description: "封装定位属性：与触发器的间距，单位 px。" },
    ],
    accessibility: [{ title: "面板名称", description: "提供 PopoverTitle，或为内容区设置 aria-label / aria-labelledby。" }, { title: "焦点", description: "非模态内容仍应有合理的键盘阅读顺序；关闭后确认焦点返回触发器。" }, { title: "关闭路径", description: "默认支持 Escape 和外部点击关闭，关键输入需妥善处理关闭结果。" }],
    code: `import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { Popover, PopoverTrigger, PopoverContent,
  PopoverHeader, PopoverTitle } from "@ui/components/popover";

<Popover>
  <PopoverTrigger render={<Button variant="outline" />}>调整名称</PopoverTrigger>
  <PopoverContent>
    <PopoverHeader><PopoverTitle>显示名称</PopoverTitle></PopoverHeader>
    <label htmlFor="display-name">名称</label>
    <Input id="display-name" />
  </PopoverContent>
</Popover>`,
  },
  select: {
    key: "select", name: "Select", description: "从预定义选项中选择表单值。Root 管理值与开关，Trigger 展示当前值，Content 中组合选项与分组。",
    anatomy: ["Select：管理值、表单信息与选项数据。", "SelectTrigger / SelectValue：触发选择并展示当前标签，右侧展开图标统一使用 Hugeicons ChevronDownIcon。", "SelectContent / Group / Label / Item / Separator：定位选项与分组。弹层宽度为触发框宽度加两个 spacing-1（默认共 8px），保留 9rem 最小宽度；列表或分组四边使用 p-1（默认 4px），选项左右使用 px-2（默认 8px），选中标记参与行内布局；选项使用 list 默认的 rounded-item，默认 12px、None 时 0px；触发框使用 rounded-control 全圆角，None 模式也保持全圆角；弹层外框使用独立的 rounded-select-popover，默认 20px、None 时 0px。"],
    practices: ["选项文本应清楚区分，表单字段提供可见名称。", "使用 items 提供值与标签映射，避免 Trigger 只显示内部值。", "对象值需要稳定比较逻辑；菜单操作不使用 Select 代替。"],
    props: [
      { name: "Select.value / defaultValue", type: "Value | Value[] | null", description: "Base UI Root 泛型属性：受控或初始值；数组用于 multiple 模式。" },
      { name: "Select.onValueChange", type: "(value, eventDetails) => void", description: "Base UI Root 属性：所选值变化通知。" },
      { name: "Select.items", type: "Record<string, ReactNode> | readonly item[]", description: "Base UI Root 属性：提供值与显示标签，item 可以包含 label、value 或分组。" },
      { name: "Select.disabled", type: "boolean", defaultValue: "false", description: "Base UI Root 属性：禁用整组选择交互。" },
      { name: "SelectTrigger.size", type: '"default" | "sm"', defaultValue: "default", description: "封装属性：选择触发器高度。" },
      { name: "SelectContent.alignItemWithTrigger", type: "boolean", defaultValue: "true", description: "封装定位属性：尝试将选中项与触发器对齐。" },
      { name: "SelectItem.value", type: "Value", description: "Base UI Item 属性：此选项对应的值，应与 Root 使用同一类型。" },
    ],
    accessibility: [{ title: "字段名称", description: "将 label 与触发器 id 对应，或在 SelectTrigger 上提供 aria-labelledby。" }, { title: "键盘", description: "Base UI 管理方向键、选项查找、选中与 Escape 关闭。" }, { title: "状态", description: "禁用项使用 disabled；错误状态通过 aria-invalid 和关联文字说明。" }],
    code: `import { Select, SelectTrigger, SelectValue,
  SelectContent, SelectItem } from "@ui/components/select";

const items = { draft: "草稿", published: "已发布" };

<>
  <label htmlFor="status">状态</label>
  <Select defaultValue="draft" items={items} name="status">
    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="draft">草稿</SelectItem>
      <SelectItem value="published">已发布</SelectItem>
    </SelectContent>
  </Select>
</>`,
  },
  sheet: {
    key: "sheet", name: "Sheet", description: "沿视口边缘打开的辅助面板。交互基于 Base UI Dialog，适合需要更多空间的设置、详情或表单。",
    anatomy: ["Sheet / SheetTrigger：开关状态与触发器。", "SheetContent：包含 Portal、遮罩和指定方向的面板。", "SheetHeader / Title / Description / Footer / Close：面板内容与关闭操作。"],
    practices: ["选择与内容空间关系一致的打开方向。", "长内容在面板内部规划滚动，关键操作保持可达。", "每个面板提供标题和清楚的关闭操作。"],
    props: [
      { name: "Sheet.open / defaultOpen", type: "boolean", description: "Base UI Dialog Root 属性：受控或初始开关。defaultOpen 默认 false。" },
      { name: "Sheet.onOpenChange", type: "(open, eventDetails) => void", description: "Base UI Dialog Root 属性：面板打开和关闭的通知。" },
      { name: "Sheet.modal", type: 'boolean | "trap-focus"', defaultValue: "true", description: "Base UI Dialog Root 属性：模态与焦点约束。" },
      { name: "SheetContent.side", type: '"top" | "right" | "bottom" | "left"', defaultValue: "right", description: "封装属性：面板出现的视口边缘。" },
      { name: "SheetContent.showCloseButton", type: "boolean", defaultValue: "true", description: "封装属性：显示面板内右上角关闭按钮。" },
      { name: "SheetTrigger.render", type: "ReactElement | render function", description: "Base UI 组合属性：合并到自定义触发按钮。" },
    ],
    accessibility: [{ title: "名称与说明", description: "使用 SheetTitle 与 SheetDescription 提供面板名称及说明。" }, { title: "焦点", description: "默认模态行为约束面板内焦点，关闭后应回到触发器。" }, { title: "窄屏可达", description: "检查面板正文和操作在小视口及缩放后仍可阅读和操作。" }],
    code: `import { Button } from "@ui/components/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader,
  SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@ui/components/sheet";

<Sheet>
  <SheetTrigger render={<Button variant="outline" />}>打开设置</SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>显示设置</SheetTitle>
      <SheetDescription>调整当前页面的显示选项。</SheetDescription>
    </SheetHeader>
    <SheetFooter><SheetClose render={<Button />}>完成</SheetClose></SheetFooter>
  </SheetContent>
</Sheet>`,
  },
  switch: {
    key: "switch", name: "Switch", description: "立即切换一个二元设置。状态由 Base UI Switch 管理，标签说明开关控制的功能，不随开关状态改变名称。",
    anatomy: ["Switch：带隐藏表单输入的状态根节点。", "Thumb：封装内部的滑块，用于表达开启与关闭。", "label：开关设置的稳定名称，由使用方提供。"],
    practices: ["用于即时生效的设置，提交式表单中的多项选择可考虑 Checkbox。", "标签描述设置本身，状态可另显示为已开启／已关闭。", "使用 checked 时配套 onCheckedChange，初始状态使用 defaultChecked。"],
    props: [
      { name: "checked", type: "boolean", description: "Base UI Root 属性：受控开启状态。" },
      { name: "defaultChecked", type: "boolean", defaultValue: "false", description: "Base UI Root 属性：非受控初始状态。" },
      { name: "onCheckedChange", type: "(checked, eventDetails) => void", description: "Base UI Root 属性：开关状态变化通知。" },
      { name: "size", type: '"default" | "sm"', defaultValue: "default", description: "封装属性：开关轨道与滑块尺寸。" },
      { name: "disabled / readOnly", type: "boolean", defaultValue: "false", description: "Base UI Root 属性：禁用或只读。" },
      { name: "name / value", type: "string", description: "Base UI Root 属性：表单字段名和开启时提交的值；value 默认 on。" },
    ],
    accessibility: [{ title: "稳定名称", description: "label 的 htmlFor 关联 Switch id，或通过 aria-labelledby 提供名称。" }, { title: "状态", description: "Base UI 提供 switch 角色与选中状态，避免再手动维护一套 aria-checked。" }, { title: "键盘", description: "Tab 聚焦后可通过空格切换，统一焦点轮廓应保持可见。" }],
    code: `import { Switch } from "@ui/components/switch";

<>
  <Switch id="notifications" name="notifications" defaultChecked />
  <label htmlFor="notifications">接收通知</label>
</>`,
  },
  tabs: {
    key: "tabs", name: "Tabs", description: "在同一区域切换一组相关内容。Root 维护当前标签值，List 组织标签，Content 通过相同的 value 关联对应面板。",
    anatomy: ["Tabs：当前值与方向的根节点。", "TabsList / TabsTrigger：标签组与各标签；分段样式标签按钮使用 rounded-full 全圆角、h-element-sm（32px）和 px-3（默认左右各 12px），横向外层为 36px，四边内边距各 2px；线条样式使用 rounded-element（默认 8px、None 时 0px）和 px-1（默认左右各 4px）。", "TabsContent：与触发标签同值的内容面板。"],
    practices: ["用于同一主题的并列内容；独立页面导航使用链接。", "标签简洁且含义明确，面板 value 与对应 Trigger 保持一致。", "自动激活仅适用于切换成本低的内容，较慢内容保留手动激活。", "布局切换器保留按钮组与 aria-pressed 语义，复用 tabsListVariants 与 tabsTriggerStyles，与分段 Tabs 共用外观。"],
    props: [
      { name: "Tabs.value / defaultValue", type: "TabsTab.Value", description: "Base UI Root 属性：受控或初始选中值，支持稳定的任意值；null 表示不选中标签。未指定 defaultValue 时由 Base UI 选择初始项。" },
      { name: "Tabs.onValueChange", type: "(value, eventDetails) => void", description: "Base UI Root 属性：当前标签变化通知。" },
      { name: "Tabs.orientation", type: '"horizontal" | "vertical"', defaultValue: "horizontal", description: "Root 属性：决定布局方向与键盘移动方向。" },
      { name: "TabsList.variant", type: '"default" | "line"', defaultValue: "default", description: "封装属性：胶囊背景或线条样式；line 使用 gap-3，默认标签间距 12px。" },
      { name: "TabsList.activateOnFocus", type: "boolean", defaultValue: "false", description: "Base UI List 属性：方向键聚焦后是否立即激活标签。" },
      { name: "TabsTrigger.value / TabsContent.value", type: "TabsTab.Value", description: "Base UI 子部件属性：用同一值关联标签与面板。" },
      { name: "TabsTrigger.disabled", type: "boolean", defaultValue: "false", description: "Base UI Tab 属性：禁止激活当前标签。" },
    ],
    accessibility: [{ title: "标签组名称", description: "为 TabsList 提供 aria-label 或 aria-labelledby。" }, { title: "键盘", description: "方向键移动标签焦点；默认以 Enter／空格激活，activateOnFocus 可开启自动激活。" }, { title: "面板关联", description: "Base UI 维护标签与面板的角色及关联，保持各项 value 唯一。" }],
    code: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ui/components/tabs";

<Tabs defaultValue="overview">
  <TabsList aria-label="项目信息">
    <TabsTrigger value="overview">概览</TabsTrigger>
    <TabsTrigger value="details">详情</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">概览内容</TabsContent>
  <TabsContent value="details">详细内容</TabsContent>
</Tabs>`,
  },
  tooltip: {
    key: "tooltip", name: "Tooltip", description: "在悬停或键盘聚焦时补充简短说明。提示不承载必需操作，也不能代替按钮名称或持续可见的帮助文字。",
    anatomy: ["TooltipProvider：提供延迟与连续提示的共享配置。", "Tooltip / TooltipTrigger：单个提示的开关状态与触发节点。", "TooltipContent：定位提示内容并渲染箭头。"],
    practices: ["提示文字保持简短，必要信息放在页面或字段说明中。", "图标按钮先提供 aria-label，再用 Tooltip 补充说明。", "需要链接、输入或其他可交互内容时使用 Popover。"],
    props: [
      { name: "TooltipProvider.delay", type: "number", defaultValue: "0", description: "封装属性：悬停后打开的等待时间，单位 ms。" },
      { name: "Tooltip.open / defaultOpen", type: "boolean", description: "Base UI Root 属性：受控或初始开关。defaultOpen 默认 false。" },
      { name: "Tooltip.onOpenChange", type: "(open, eventDetails) => void", description: "Base UI Root 属性：提示打开和关闭的变化通知。" },
      { name: "Tooltip.disabled", type: "boolean", defaultValue: "false", description: "Base UI Root 属性：禁用提示。" },
      { name: "TooltipContent.side", type: '"top" | "right" | "bottom" | "left" | "inline-start" | "inline-end"', defaultValue: "top", description: "封装定位属性：提示优先放置方向。" },
      { name: "TooltipContent.align", type: '"start" | "center" | "end"', defaultValue: "center", description: "封装定位属性：与触发器的对齐方式。" },
      { name: "TooltipContent.sideOffset", type: "number", defaultValue: "4", description: "封装定位属性：提示与触发器的间距，单位 px。" },
    ],
    accessibility: [{ title: "触发方式", description: "鼠标悬停与键盘聚焦均应能显示提示，Escape 可关闭。" }, { title: "辅助说明", description: "Base UI 将提示内容关联为描述；触发器仍需自己的名称。" }, { title: "内容边界", description: "提示内不放交互控件，避免键盘无法进入或操作。" }],
    code: `import { Button } from "@ui/components/button";
import { TooltipProvider, Tooltip, TooltipTrigger,
  TooltipContent } from "@ui/components/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger render={<Button variant="outline" />}>归档</TooltipTrigger>
    <TooltipContent>将当前项目移入归档。</TooltipContent>
  </Tooltip>
</TooltipProvider>`,
  },
};

export const componentDocs: Record<ComponentKey, ComponentDoc> = { ...coreComponentDocs, ...additionalComponentDocs };

for (const key of ["input", "textarea", "input-group", "select", "native-select", "combobox"] as const) {
  componentDocs[key] = { ...componentDocs[key], accessibility: [...componentDocs[key].accessibility, { title: "焦点反馈", description: "鼠标或触控聚焦不显示焦点框；Tab 导航和选项键盘导航时显示统一焦点框。输入文字、换行和移动光标保持当前输入方式，错误描边独立保留。" }] };
}
