import { AddIcon, CalendarIcon, CheckIcon, ChevronDownIcon, CloseIcon, DeleteIcon, DocumentIcon, FolderIcon, SearchIcon, SettingsIcon } from "./icons";
import type { TokenCategory } from "./token-catalog";
import { usePreviewGlobalsParam } from "./preview-mode";

export type GuidanceRule = { kind: "do" | "dont"; text: string };

export const overview: Partial<Record<TokenCategory, string>> = {
  all: "按用途查阅主题定义。源变量、间距派生标尺和合成文字样式分别维护，避免将展示行数当成独立 token 数量。",
  colors: "基础色阶保持固定，语义角色按浅深色模式选择引用。背景按 body → surface → card → popover 建立层次；文字、图标、强调填充与状态分别维护。",
  elevation: "阴影表示表面相对于内容的层级。low、med、high 用于不同深度；inset 状态环属于控件反馈，与表面悬浮层级分别选择。",
  icons: "图标表达固定含义。新版使用 Hugeicons，按操作与内容语义选择图形，同一操作保持一致。",
  illustrations: "插画用于帮助理解空状态、引导和说明。此页维护使用与布局规范，插画资产不计入主题 token 数量。",
  motion: "动效帮助说明状态、方向和空间关系。时长与缓动来自主题标尺，是否播放则遵循用户偏好与当前交互需求。",
  shape: "圆角随控件、容器和页面的用途选择。嵌套表面依据外圆角与内边距计算内圆角，保持曲线同心。",
  spacing: "布局工具类从共同基准派生间距。下方标尺展示完整步阶，控件高度另列为 Size；派生结果不重复计入源定义数量。",
  typography: "字体、字号、字重和行高组成语义文字样式。视觉样式与 HTML 标题层级分别决定，正文采用 Noto Sans、标题采用 Noto Serif，中文分别使用 Noto Sans SC 与 Noto Serif SC 回退。",
};

export const bestPractices: Partial<Record<TokenCategory, GuidanceRule[]>> = {
  colors: [
    { kind: "do", text: "从 Palette 选择基础色阶，通过语义角色提供给组件；明暗模式切换调整语义引用。" },
    { kind: "do", text: "按表面层次选择 bg-body、bg-surface、bg-card 与 bg-popover。" },
    { kind: "do", text: "强调填充成对使用 bg-accent-bg 与 text-on-accent；强调文字使用 text-accent。" },
    { kind: "do", text: "柔和控件底色上的占位文字与辅助文字使用 text-control-secondary；普通表面的辅助文字继续使用 text-secondary。" },
    { kind: "do", text: "状态浅底使用 bg-warning-muted 与 text-warning，实心使用 bg-warning-bg 与 text-on-warning。" },
    { kind: "do", text: "色系背景、边框、图标和文字分别选择对应角色。" },
    { kind: "dont", text: "在组件中写死当前色值，或把 on-accent 当作任意背景上的文字颜色。" },
    { kind: "dont", text: "用 success、warning、error 表达与其业务状态无关的装饰强调。" },
  ],
  elevation: [
    { kind: "do", text: "按表面的实际层级选择 shadow-none、shadow-sm、shadow-md 或 shadow-lg。" },
    { kind: "do", text: "一个表面只选一档悬浮阴影，重叠时让上层表面的等级更高。" },
    { kind: "do", text: "键盘焦点继续使用统一的 focus-visible:focus-ring，状态内环单独选择。" },
    { kind: "dont", text: "让普通嵌入内容无缘由地使用最高等级阴影。" },
    { kind: "dont", text: "叠加多档悬浮阴影或用阴影模拟装饰边框；边框使用 border 角色。" },
  ],
  motion: [
    { kind: "do", text: "高频局部反馈优先 fast，较明显的空间进入与退出再选择 medium 或 slow。" },
    { kind: "do", text: "使用 duration-fast-min、duration-fast、duration-fast-max、duration-medium-min、duration-medium 或 duration-slow，配合 ease-standard 同时控制过渡与动画。" },
    { kind: "do", text: "尊重 prefers-reduced-motion；减少动态效果时保留即时的状态反馈。" },
    { kind: "dont", text: "让动画完成成为继续操作的前提，或为频繁 hover 添加明显等待。" },
    { kind: "dont", text: "为展示标尺添加自动循环动效，持续分散阅读与操作的注意力。" },
  ],
  shape: [
    { kind: "do", text: "控件使用 rounded-element，内容容器使用 rounded-container，胶囊使用 rounded-full。" },
    { kind: "do", text: "嵌套表面的内圆角依据外圆角减去内边距计算，最小值为零。" },
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
  elevation: '<div className="bg-popover rounded-container shadow-md">\n  浮于邻近内容之上的表面\n</div>',
  icons: 'import { HugeiconsIcon } from "@hugeicons/react";\nimport Search01Icon from "@hugeicons/core-free-icons/Search01Icon";\nimport { Button } from "../components/button";\n\n<Button variant="ghost" size="icon" aria-label="搜索笔记">\n  <HugeiconsIcon icon={Search01Icon} aria-hidden="true" className="size-4 text-icon-primary" />\n</Button>',
  motion: '<div className="transition-opacity duration-fast ease-standard">\n  状态变化时使用主题时长与缓动\n</div>',
  shape: '<div className="rounded-container border border-border p-4">\n  内容容器使用 rounded-container，控件使用 rounded-element。\n</div>',
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
      ["none · shadow-none", "平面、嵌入的页面内容，例如普通表单与文档区域。"],
      ["low · shadow-sm", "仍在页面流中，但需要与背景区分的内容表面。"],
      ["med · shadow-md", "浮于邻近内容上的面板，例如弹出菜单与 Popover。"],
      ["high · shadow-lg", "位于整体界面上方的模态表面，通常伴随遮罩。"],
    ].map(([level, text]) => <tr key={level}><th scope="row"><code>{level}</code></th><td>{text}</td></tr>)}</tbody>
  </table></div>;
  if (section === "concentric-radius") return <>
    <p>内外边界共享曲线中心时，内圆角取外圆角减去内边距，并将最小值截断为零。</p>
    <figure className="foundation-figure"><div className="foundation-concentric-outer" style={{ borderRadius: "var(--radius-page)", padding: "calc(var(--spacing-1) * 4)" }}><div className="foundation-concentric-inner" style={{ borderRadius: "max(0px, calc(var(--radius-page) - var(--spacing-1) * 4))" }}>Inner surface</div></div><figcaption>外圆角使用 radius-page；内边距使用 4 个间距基准。</figcaption></figure>
    <pre className="foundation-code"><code>{"border-radius: max(0px, calc(var(--radius-page) - var(--spacing-1) * 4));"}</code></pre>
  </>;
  if (section === "icon-usage") return <>
    <p>以下选取新版组件与文档使用的 Hugeicons 图形。颜色使用 <code>text-icon-*</code> 语义角色，详见 <a href={`/?path=/docs/ui-next-colors--docs&globals=${globalsParam}`} target="_top">Colors</a>。</p>
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
