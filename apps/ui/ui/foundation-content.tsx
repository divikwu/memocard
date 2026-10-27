import { AddIcon, CalendarIcon, CheckIcon, ChevronDownIcon, CloseIcon, DeleteIcon, DocumentIcon, FolderIcon, SearchIcon, SettingsIcon } from "./icons";
import type { TokenCategory } from "./token-catalog";
import { usePreviewGlobalsParam } from "./preview-mode";

export type GuidanceRule = { kind: "do" | "dont"; text: string };

export const overview: Partial<Record<TokenCategory, string>> = {
  all: "按用途查阅主题定义。源变量、间距派生标尺和合成文字样式分别维护，避免将展示行数当成独立 token 数量。",
  colors: "基础色阶保持固定，语义角色按浅深色模式选择引用。背景按 body → surface → card → popover 建立层次；文字、图标、强调填充与状态分别维护。",
  elevation: "阴影按基础尺度、语义角色和工具类适配三层维护。0–4 五个基础等级表达递增的视觉高度，统一定义多层外投影与 1px 装饰外缘；语义角色按使用场景选择等级。组件通过 flat、low、med、high、control、floating、document 等语义角色选择，同名 shadow-* 工具类用于 JSX，--shadow-* 用于 CSS；结构边框、浮层高光、键盘焦点与缩放动效分别维护。",
  icons: "图标表达固定含义。使用 Hugeicons，按操作与内容语义选择图形，同一操作保持一致。",
  illustrations: "插画用于帮助理解空状态、引导和说明。此页维护使用与布局规范，插画资产不计入主题 token 数量。",
  motion: "动效帮助说明状态、方向和空间关系。时长与缓动来自主题标尺，是否播放则遵循用户偏好与当前交互需求。",
  shape: "按钮、单行输入与选择框统一使用全圆角，多行输入使用独立的 12px 圆角。Luma 模块卡片与弹层外框默认 20px，快速记录输入面板默认 24px；容器与页面保持独立的圆角角色。",
  spacing: "布局工具类从共同基准派生间距。下方标尺展示完整步阶，控件高度另列为 Size；派生结果不重复计入源定义数量。",
  typography: "字体、字号、字重和行高组成语义文字样式。视觉样式与 HTML 标题层级分别决定，正文默认采用 Noto Sans，标题默认跟随正文，中文使用 Noto Sans SC 回退；标题仍可独立选择字体。",
};

export const bestPractices: Partial<Record<TokenCategory, GuidanceRule[]>> = {
  colors: [
    { kind: "do", text: "从 Palette 选择基础色阶，通过语义角色提供给组件；明暗模式切换调整语义引用。" },
    { kind: "do", text: "按表面层次选择 bg-body、bg-surface、bg-card 与 bg-popover。" },
    { kind: "do", text: "通用 hover 叠加色统一使用 --color-overlay-hover（bg-overlay-hover）：浅色为黑色 4%，深色为白色 4%。笔记卡片、标签、搜索结果与侧栏共用；侧栏整行选中态沿用同一底色。" },
    { kind: "do", text: "Item 的 muted 内嵌模块浅色使用 bg-muted，即 neutral-100 的 100% 不透明度；深色使用 dark:bg-muted/50，保留 neutral-800 的 50% 不透明度。" },
    { kind: "do", text: "进度条轨道使用 bg-neutral（--color-neutral）：浅色为黑色的 6% 不透明度，深色为白色的 10% 不透明度，使轨道与容器背景保持区分。" },
    { kind: "do", text: "强调填充成对使用 bg-accent-bg 与 text-on-accent；强调文字使用 text-accent。" },
    { kind: "do", text: "柔和控件底色上的占位文字与辅助文字使用 text-control-secondary；普通表面的辅助文字继续使用 text-secondary。" },
    { kind: "do", text: "状态浅底使用 bg-warning-muted 与 text-warning，实心使用 bg-warning-bg 与 text-on-warning。" },
    { kind: "do", text: "色系背景、边框、图标和文字分别选择对应角色。" },
    { kind: "do", text: "普通边框与分隔线使用 --color-border 和 --color-divider：浅色 black / 8%，深色 white / 10%。平面笔记卡片和移动端无投影输入面板使用 --color-border-subtle：浅色 black / 6%，深色 white / 5%。浮起时以投影内置外缘代替装饰描边，错误状态和焦点继续使用独立角色。" },
    { kind: "dont", text: "在组件中写死当前色值，或把 on-accent 当作任意背景上的文字颜色。" },
    { kind: "dont", text: "用 success、warning、error 表达与其业务状态无关的装饰强调。" },
  ],
  elevation: [
    { kind: "do", text: "基础标尺只保留 0–4 五个递增等级；组件引用语义角色，同名 Tailwind 工具类负责适配。通用表面使用 shadow-flat / low / med / high，不直接消费基础尺度。" },
    { kind: "do", text: "按职责选择 shadow-flat、shadow-control、shadow-low、shadow-med、shadow-high、surface-floating、shadow-floating 或 shadow-document；嵌入内容保持无投影。" },
    { kind: "do", text: "五档以多层投影表达递增高度，浅深色共用几何结构、分别设置各层透明度。等级 0 为六层透明值；1 使用两层投影与 1px 外缘；2–4 使用五层投影与 1px 外缘，其中透明占位层支持过渡。" },
    { kind: "do", text: "一个表面只选一档悬浮阴影。z-index 决定前后顺序，阴影等级表达感知高度；嵌套菜单与弹层可以复用同一等级。" },
    { kind: "do", text: "浮起表面的 1px 装饰外缘由阴影提供，保留透明布局边框，避免重复叠加。平面卡片与移动端无投影面板保留实际边框；浮层组合 surface-floating shadow-high，深色额外保留白色 4% 内侧高光。输入、按钮的状态边框及键盘焦点独立维护。" },
    { kind: "do", text: "输入控件通过页面级输入方式检测区分指针与键盘；输入文字不会切换导航模式，Tab 与选项导航显示焦点框。键盘焦点使用统一的 focus-visible:focus-ring：2px solid、向外偏移 2px；浅色使用不透明 neutral-600，深色使用不透明 neutral-400。强制颜色模式的焦点与浮层边框使用系统前景色 CanvasText，与 Canvas 背景配对；焦点不依赖阴影。" },
    { kind: "do", text: "嵌入式移动面板、表格与图片工具条保持平面；反色 Tooltip 通过实心底色与箭头区分内容。这些例外不因位置悬浮就自动增加投影。" },
    { kind: "dont", text: "让普通嵌入内容无缘由地使用最高等级阴影，或把预留 shadow-inset 状态变量当作已开放的组件工具类。" },
    { kind: "dont", text: "用 shadow-red-500 等工具类表达彩色投影；本项目的阴影颜色由主题 --color-shadow 统一拥有，状态与强调通过独立角色表达。" },
    { kind: "dont", text: "叠加多档悬浮阴影，或在已有外缘的投影上重复添加同用途描边；内侧高光、结构分隔、校验状态和焦点独立维护。" },
  ],
  motion: [
    { kind: "do", text: "高频局部反馈优先 fast，较明显的空间进入与退出再选择 medium 或 slow。" },
    { kind: "do", text: "使用 duration-fast-min、duration-fast、duration-fast-max、duration-medium-min、duration-medium 或 duration-slow，配合 ease-standard 同时控制过渡与动画。" },
    { kind: "do", text: "尊重 prefers-reduced-motion；减少动态效果时保留即时的状态反馈。" },
    { kind: "dont", text: "让动画完成成为继续操作的前提，或为频繁 hover 添加明显等待。" },
    { kind: "dont", text: "为展示标尺添加自动循环动效，持续分散阅读与操作的注意力。" },
  ],
  shape: [
    { kind: "do", text: "普通按钮统一使用 rounded-full；Tabs 分段样式标签按钮使用 rounded-full、h-element-sm（32px）与 px-3（左右各 12px）；线条样式使用 rounded-element、默认 8px，左右 px-1；单行、复合输入与选择框使用 rounded-control（--radius-control），统一引用 --radius-full，None 模式也保持全圆角；多行输入使用 rounded-textarea（--radius-textarea），默认 12px、None 时 0px；内容容器使用 rounded-container。" },
    { kind: "do", text: "Select 弹层外框使用 rounded-select-popover（--radius-select-popover），默认 20px；DropdownMenu（含子菜单）、Popover、Combobox 的弹层外框使用 rounded-popover（--radius-popover），默认 20px。Select 与 DropdownMenu 选项使用 list 默认的 rounded-item，默认 12px；Select 选项左右使用 px-2，默认各 8px。None 模式下弹层外框与列表选项为 0px，全圆角触发框保持独立。" },
    { kind: "do", text: "Luma 模块卡片使用 --radius-card，默认 20px；快速记录输入面板使用 --radius-element 的 3 倍，默认 24px；None 模式均为 0px。卡片使用 rounded-card，页眉、页脚与贴边图片的对应角使用同一卡片圆角。" },
    { kind: "do", text: "内嵌 Item 使用 rounded-item（--radius-item），默认 12px，None 模式为 0px。" },
    { kind: "do", text: "Contribution History 柱形顶部使用 --radius-element，默认 8px，底部保持 0px；图表悬浮提示框使用 rounded-popover（--radius-popover），默认 20px。None 模式下两者均为 0px。" },
    { kind: "do", text: "编辑器原生操作按钮和侧栏图标操作按钮同样使用 --radius-full；业务样式不得将通用按钮覆盖为 element 或 page 圆角。" },
    { kind: "do", text: "单行输入的外轮廓与自身聚焦环使用全圆角；InputGroup 内部无独立边界的输入保持 0px，由外层承担圆角：单行为 rounded-control 全圆角，包含 textarea 时使用 rounded-textarea，默认 12px。" },
    { kind: "do", text: "只有同心嵌套的表面，才依据外圆角减去内边距计算内圆角，最小值为零；容器内独立摆放的按钮不套用此公式。" },
    { kind: "dont", text: "将 page 圆角用于小控件，或为单个页面硬编码脱离主题的圆角。" },
  ],
  spacing: [
    { kind: "do", text: "优先使用 p-*、gap-* 和 m-* 标尺，按内容关系区分紧密与区块间距。" },
    { kind: "do", text: "控件高度使用 h-element-*，与布局间距分别选择。" },
    { kind: "do", text: "同时查阅 rem 与当前解析尺寸，让标尺随根字号变化。" },
    { kind: "dont", text: "在同一组件中随意混用主题标尺与任意 px 间距。" },
    { kind: "dont", text: "把派生步阶重复计入源 token 数量，或认为当前 px 值在所有环境都固定。" },
  ],
  typography: [
    { kind: "do", text: "使用 type-* 语义样式，配套选择字号、字重与行高。" },
    { kind: "do", text: "HTML 或 Markdown 阅读区使用 Typeset；阅读行高与 flow 单独维护，字体、颜色和圆角复用当前主题。嵌入组件通过 data-slot 保护，必要时使用 not-typeset 或 data-not-typeset 明确退出。" },
    { kind: "do", text: "按文档结构选择 h1–h6，视觉层级通过文字样式表达。" },
    { kind: "do", text: "辅助信息使用 type-supporting，代码使用 type-code，正文保留足够的可读尺寸。" },
    { kind: "do", text: "确认字体实际加载，并保留中文与系统字体回退。" },
    { kind: "dont", text: "只改 font-size 而忽略行高，或为取得视觉大小跳过标题层级。" },
    { kind: "dont", text: "将 4xs、3xs 等极小字号用于正文或关键操作信息。" },
  ],
};

export const usage: Partial<Record<TokenCategory, string>> = {
  all: '<section className="bg-surface text-primary">\n  <h2 className="type-heading-2">标题</h2>\n  <p className="type-body text-secondary">说明内容</p>\n</section>',
  colors: '<div className="bg-surface text-primary border border-border">\n  <p className="text-accent">强调文字</p>\n  <span className="bg-warning-muted text-warning">需要留意的状态</span>\n</div>',
  elevation: '<div className="bg-popover rounded-container border surface-floating shadow-high">\n  弹层：投影与独立轮廓组合\n</div>',
  icons: 'import { HugeiconsIcon } from "@hugeicons/react";\nimport Search01Icon from "@hugeicons/core-free-icons/Search01Icon";\nimport { Button } from "../components/button";\n\n<Button variant="ghost" size="icon" aria-label="搜索笔记">\n  <HugeiconsIcon icon={Search01Icon} aria-hidden="true" className="size-4 text-icon-primary" />\n</Button>',
  motion: '<div className="transition-opacity duration-fast ease-standard">\n  状态变化时使用主题时长与缓动\n</div>',
  shape: '<Card className="rounded-card">默认 20px 模块卡片</Card>\n<Button className="rounded-full">胶囊按钮</Button>\n<Input className="rounded-control" placeholder="全圆角输入" />\n<InputGroup className="rounded-control">单行复合输入</InputGroup>\n<Textarea className="rounded-textarea" placeholder="默认 12px 多行输入" />\n<SelectContent className="rounded-select-popover">默认 20px Select 弹层</SelectContent>\n<PopoverContent className="rounded-popover">默认 20px 弹层</PopoverContent>\n<SelectItem className="rounded-item px-2" value="default">默认 12px 列表选项</SelectItem>',
  spacing: '<div className="flex flex-col gap-4 p-6">\n  <p className="type-body">内容之间使用 gap，容器内部使用 padding。</p>\n</div>',
  typography: '<article>\n  <h2 className="type-heading-2">文档标题</h2>\n  <p className="type-body">正文内容</p>\n  <p className="type-supporting text-secondary">更新时间等辅助信息</p>\n</article>',
};

export const contentTitles = {
  "elevation-levels": "Choosing a level",
  "concentric-radius": "Concentric Radius",
  "icon-usage": "Available Icons",
  "illustration-scenarios": "When to Use",
  "illustration-guidelines": "Guidelines",
  "illustration-placement": "Placement",
  "motion-helps": "Where Motion Helps",
  "motion-hurts": "Where Motion Hurts",
  "motion-preferences": "Respecting User Preferences",
} as const;
export type ContentSection = keyof typeof contentTitles;

const iconUses = [
  { name: "Search01Icon", Icon: SearchIcon, purpose: "查找笔记与内容" },
  { name: "Add01Icon", Icon: AddIcon, purpose: "新建笔记或添加项目" },
  { name: "File01Icon", Icon: DocumentIcon, purpose: "笔记文档与搜索结果" },
  { name: "FolderOpenIcon", Icon: FolderIcon, purpose: "打开知识库或目录" },
  { name: "Delete02Icon", Icon: DeleteIcon, purpose: "回收站与移入回收站" },
  { name: "Settings02Icon", Icon: SettingsIcon, purpose: "应用设置" },
  { name: "Calendar03Icon", Icon: CalendarIcon, purpose: "日期与日历入口" },
  { name: "ArrowDown01Icon", Icon: ChevronDownIcon, purpose: "展开选择或下一级内容" },
  { name: "Tick02Icon", Icon: CheckIcon, purpose: "选中、确认与完成" },
  { name: "Cancel01Icon", Icon: CloseIcon, purpose: "关闭或取消当前界面" },
];

const illustrationRules: GuidanceRule[] = [
  { kind: "do", text: "在同一产品中保持统一的图形语言、笔触与比例。" },
  { kind: "do", text: "检查插画在浅深色表面上的清晰度与边界。" },
  { kind: "do", text: "按容器比例选择尺寸，让插画从属于内容。" },
  { kind: "do", text: "配合标题、解释和下一步操作；装饰图使用空替代文本。" },
  { kind: "dont", text: "在同一界面混用视觉风格不一致的插画。" },
  { kind: "dont", text: "用无信息作用的大图占据内容空间，或让插画成为唯一说明。" },
];

export function FoundationContent({ section }: { section: ContentSection }) {
  const globalsParam = usePreviewGlobalsParam();
  if (section === "elevation-levels") return <div className="token-table-wrap"><table className="foundation-table token-table" aria-label="Elevation level guidance">
    <thead><tr><th scope="col">Level</th><th scope="col">When to use</th></tr></thead>
    <tbody>{[
      ["flat · shadow-flat", "笔记集合卡片默认映射尺度 0，保留六层透明值支持过渡；嵌入式移动面板、表格与图片工具条、反色 Tooltip 保持无投影。"],
      ["control · shadow-control", "Switch 与 Slider 滑块、小型圆形控件；尺度 1 与独立控件高光组合。"],
      ["low · shadow-low", "轻浮起表面，例如 PC 快速记录的默认输入面板；映射尺度 2。"],
      ["med · shadow-med", "通用内容卡片；映射尺度 3。"],
      ["input-focus · --shadow-input-focus", "PC 快速记录聚焦时从 low 切换到 input-focus，当前映射 med；鼠标点击只增强阴影，Tab 导航进入编辑区时才显示独立焦点框。"],
      ["high · shadow-high + surface-floating", "菜单、Popover 与对话框组合尺度 4 和独立浮层高光，模态遮罩单独定义。"],
      ["floating · shadow-floating", "富文本浮动工具条与图表切换工具条；映射尺度 2。"],
      ["document · shadow-document", "回收站笔记预览等独立文档表面；映射尺度 3，普通全屏编辑器保持平面。"],
      ["card hover · shadow-card-hover", "PC 笔记卡片的悬停反馈；从 flat（尺度 0）切换到 low（尺度 2），缩放单独维护。"],
    ].map(([level, text]) => <tr key={level}><th scope="row"><code>{level}</code></th><td>{text}</td></tr>)}</tbody>
  </table></div>;
  if (section === "concentric-radius") return <>
    <p>仅当内外表面共享曲线中心时，内圆角取外圆角减去内边距，并将最小值截断为零。容器内独立摆放的按钮不使用此公式。</p>
    <figure className="foundation-figure"><div className="foundation-concentric-outer" style={{ borderRadius: "var(--radius-page)", padding: "calc(var(--spacing-1) * 4)" }}><div className="foundation-concentric-inner" style={{ borderRadius: "max(0px, calc(var(--radius-page) - var(--spacing-1) * 4))" }}>Inner surface</div></div><figcaption>外圆角使用 radius-page；内边距使用 4 个间距基准。</figcaption></figure>
    <pre className="foundation-code"><code>{"border-radius: max(0px, calc(var(--radius-page) - var(--spacing-1) * 4));"}</code></pre>
  </>;
  if (section === "icon-usage") return <>
    <p>以下选取组件与文档使用的 Hugeicons 图形。颜色使用 <code>text-icon-*</code> 语义角色，详见 <a href={`/?path=/docs/ui-colors--docs&globals=${globalsParam}`} target="_top">Colors</a>。</p>
    <div className="token-table-wrap"><table className="foundation-table token-table" aria-label="Project icon meanings"><thead><tr><th scope="col">Icon</th><th scope="col">Purpose</th></tr></thead><tbody>{iconUses.map(({ name, Icon, purpose }) => <tr key={name}><th scope="row"><span className="foundation-icon-label"><Icon aria-hidden="true" className="size-5 text-icon-primary" /><code>{name}</code></span></th><td>{purpose}</td></tr>)}</tbody></table></div>
  </>;
  if (section === "illustration-scenarios") return <div className="token-table-wrap"><table className="foundation-table token-table" aria-label="Illustration use cases"><thead><tr><th scope="col">Context</th><th scope="col">Purpose</th></tr></thead><tbody>{[
    ["空状态", "解释为什么当前没有内容，并指向可以采取的下一步。"],
    ["初次引导", "帮助理解尚未熟悉的概念与操作。"],
    ["功能介绍", "用图形辅助说明新能力及其价值。"],
    ["错误与中断", "配合清晰文字解释问题，并保留恢复路径。"],
  ].map(([context, text]) => <tr key={context}><th scope="row">{context}</th><td>{text}</td></tr>)}</tbody></table></div>;
  if (section === "illustration-guidelines") return <div className="token-table-wrap"><table className="foundation-table token-table" aria-label="Illustration guidelines"><thead><tr><th scope="col">Guidance</th><th scope="col">Practice</th></tr></thead><tbody>{illustrationRules.map(rule => <tr key={rule.text}><th scope="row"><span className={`foundation-guidance-label foundation-guidance-${rule.kind}`}>{rule.kind === "do" ? "建议" : "避免"}</span></th><td>{rule.text}</td></tr>)}</tbody></table></div>;
  if (section === "illustration-placement") return <figure className="foundation-figure foundation-placement"><div aria-hidden="true" className="foundation-illustration-placeholder">Illustration</div><p className="type-heading-3">清晰的标题</p><p className="text-secondary">说明当前情况与下一步。</p><span className="foundation-placement-action">操作入口</span><figcaption>布局示意：插画位于标题与说明上方；尺寸随容器选择，实际品牌素材待视觉配置确定。</figcaption></figure>;
  if (section === "motion-helps") return <ul className="foundation-list"><li>解释内容从哪里进入、离开或移动到哪里。</li><li>让展开、折叠与页面层级变化保持连续。</li><li>为状态切换提供即时、短暂的视觉确认。</li></ul>;
  if (section === "motion-hurts") return <ul className="foundation-list"><li>高频操作因动画等待而变慢。</li><li>持续循环或大范围位移打断阅读与输入。</li><li>用户需要关闭或重试时，动效阻挡了可用操作。</li></ul>;
  return <>
    <p>系统偏好减少动态效果时，本主题的时长变量解析为 0ms。状态变化仍应立即可见，操作无需等待动画完成。</p>
    <pre className="foundation-code"><code>{"@media (prefers-reduced-motion: reduce) {\n  /* 主题统一将时长变量覆盖为 0ms */\n}"}</code></pre>
  </>;
}
