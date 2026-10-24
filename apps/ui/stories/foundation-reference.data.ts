import catalog from "../../../design/token-coverage.generated.json";
import iconCatalog from "../../../design/icon-usage.generated.json";
import tailwindTheme from "tailwindcss/theme.css?raw";

export { catalog };
const upstreamShadows = [...tailwindTheme.matchAll(/^\s*(--(?:shadow|inset-shadow|drop-shadow)-(?:2xs|xs|sm|md|lg|xl|2xl)):\s*([^;]+);/gm)]
  .map(([, name, value]) => ({ name, value }));
export const shadowScale = upstreamShadows.filter(token => token.name.startsWith("--shadow-"));
export const insetShadowScale = upstreamShadows.filter(token => token.name.startsWith("--inset-shadow-"));
export const dropShadowScale = upstreamShadows.filter(token => token.name.startsWith("--drop-shadow-"));
export type CSSToken = typeof catalog.css[number];
export type FoundationCategory = "all" | "colors" | "elevation" | "icons" | "motion" | "shape" | "spacing" | "typography" | "sizing";
export type SectionId = typeof colorTokenGroups[number]["id"] | "tags" | "callouts" | "palettes" | "spacing-web" | "spacing" | "sizing" | "shape" | "shape-current" | "elevation" | "typography" | "typography-fonts" | "typography-size" | "typography-weight" | "typography-leading" | "motion" | "icons";

export const colorTokenGroups = [
  { id: "colors", title: "基础表面与文字", description: "页面、卡片、浮层、反色区域与普通／禁用图标的语义颜色。", names: ["--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground", "--muted", "--muted-foreground", "--surface-bg", "--surface-foreground", "--inverted-bg", "--inverted-foreground", "--icon-primary-color", "--icon-secondary-color", "--text-disabled-color", "--icon-disabled-color", "--on-dark-color", "--on-light-color"] },
  { id: "colors-actions", title: "操作与状态", description: "操作填充、强调文字与成功／警告／错误状态；emphasis 系列保留为预留角色。", names: ["--primary", "--primary-foreground", "--secondary", "--secondary-foreground", "--accent", "--accent-foreground", "--accent-text", "--emphasis", "--emphasis-foreground", "--text-accent-color", "--destructive", "--error-muted", "--error-foreground", "--success", "--success-muted", "--success-foreground", "--warning", "--warning-muted", "--warning-foreground", "--accent-muted-bg", "--error-inverted-bg"] },
  { id: "colors-feedback", title: "边界与反馈", description: "边框、焦点、悬停／按压、遮罩、控件轨道与加载占位。", names: ["--border", "--input", "--ring", "--hover-bg", "--pressed-bg", "--overlay-bg", "--track-bg", "--skeleton-bg", "--border-emphasized-color", "--focus-outline-color", "--tint-hover-color", "--shadow-color"] },
  { id: "colors-sidebar", title: "侧栏", description: "侧栏表面、文字、选中状态与边界反馈；sidebar-primary 系列保留为预留角色。", names: ["--sidebar", "--sidebar-foreground", "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-primary", "--sidebar-primary-foreground", "--sidebar-border", "--sidebar-ring"] },
  { id: "colors-hues", title: "公共多色语义", description: "十种公共色相与 MemoCard 棕色扩展；背景、边框、图标和文字分别覆盖。", names: catalog.css.filter(token => token.id === "color.hues").map(token => token.name) },
  { id: "colors-data", title: "数据可视化（按需导入）", description: "分类色、中性色与九组五档顺序色；当前产品未提供数据图表。", names: catalog.css.filter(token => token.id === "color.data").map(token => token.name) },
  { id: "colors-syntax", title: "代码语法与差异", description: "代码背景已接入；其余角色供高亮器与差异视图按需使用。", names: catalog.css.filter(token => ["color.syntax", "color.syntax-background"].includes(token.id)).map(token => token.name) },
  { id: "colors-chart", title: "图表", description: "五档预留图表颜色角色。", names: ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] },
] as const;

export const foundationSections: { id: SectionId; title: string; description: string }[] = [
  { id: "colors", title: "Color tokens", description: "页面、内容与操作的语义颜色。色样由生产 CSS 解析为 sRGB，仅展示工具栏当前模式与配色下的值。" },
  ...colorTokenGroups.slice(1).map(({ id, title, description }) => ({ id, title, description })),
  { id: "tags", title: "Tag colors", description: "标签文字与透明背景成对使用。默认与八种配色沿用现有选项，gray 是内部别名输入。" },
  { id: "callouts", title: "Callout colors", description: "标注背景、浅深色文字与菜单色样。菜单色样沿用固定色相，默认文字与样本使用 foreground。" },
  { id: "palettes", title: "Palette tokens", description: "中性色阶、强调色阶与设置中的配色样本。色阶引用锁定的 Tailwind 主题。" },
  { id: "spacing-web", title: "Web 间距标尺", description: "生产代码实际使用的 Tailwind 间距档位，包含 padding、margin、gap 与 space。负边距共用对应的标尺幅度；auto、安全区和局部任意值不纳入标尺。" },
  { id: "spacing", title: "Spacing tokens", description: "跨端尺寸使用下列逻辑基准；Web 常规布局沿用 Tailwind 间距标尺。Web 与原生分别以 px 和 pt 使用基准。" },
  { id: "sizing", title: "Size tokens", description: "侧栏度量区分视觉框、行高和触摸命中区。Web px 与原生 pt 各按原平台契约映射。" },
  { id: "shape", title: "Shape tokens", description: "圆角选项是用户选择的基准；--radius-* 是当前基准的派生角色。两者保留各自含义和原有公式。" },
  { id: "shape-current", title: "当前主题圆角", description: "主题派生圆角随工具栏设置更新；交互区域圆角使用独立规则。" },
  { id: "elevation", title: "Elevation tokens", description: "浮层与表面阴影、轻量控件阴影及标签背景透明度。" },
  { id: "typography", title: "Typography tokens", description: "界面与笔记的字体角色分别管理。运行时偏好覆盖静态回退，原生系统文字遵循 Dynamic Type。" },
  { id: "typography-fonts", title: "字体", description: "直接读取现有字体选项与字体栈；样本使用生产字体加载器，本机字体和中文回退由平台解析。" },
  { id: "typography-size", title: "基础字号", description: "唯一的七档 rem 字号标尺。所有界面与内容样式引用这些档位，换算值和样本随根字号更新。" },
  { id: "typography-weight", title: "基础字重", description: "常规 400、中等 500、强调 600 三档；标题与重点共用强调字重。" },
  { id: "typography-leading", title: "基础行高", description: "紧凑、标准、宽松三种策略。文字角色按字号对齐 4px 基准网格，最少保留 4px 行间空间；计算后的行高随根字号缩放。旧阅读行高设置继续兼容。" },
  { id: "motion", title: "Motion", description: "统一的时长、缓动与组件使用关系；保留系统减少动态效果下的既有行为。" },
  { id: "icons", title: "Icons", description: "项目已使用的图标，按标准名称去重。" },
];

export const foundationPages: Record<FoundationCategory, { title: string; description: string; sections: SectionId[] }> = {
  all: { title: "All tokens", description: "MemoCard 的基础 token 目录：查阅颜色、间距、尺寸、圆角、阴影、字体与动效定义。", sections: foundationSections.filter(section => !["icons", "shape-current", "spacing-web"].includes(section.id) && !section.id.startsWith("typography-") && !section.id.startsWith("colors-")).map(section => section.id) },
  colors: { title: "Color", description: "用于页面、内容与组件状态的语义色，以及标签、标注和配色标尺。", sections: [...colorTokenGroups.map(group => group.id), "tags", "callouts", "palettes"] },
  elevation: { title: "Elevation", description: "查阅基础阴影、内阴影、轮廓投影与项目定义。", sections: ["elevation"] },
  icons: { title: "Icons", description: "查阅 MemoCard 使用的 Lucide 图标。", sections: ["icons"] },
  motion: { title: "Motion", description: "查阅统一动效 token、使用方式与场景映射，并随系统偏好观察真实组件。", sections: ["motion"] },
  shape: { title: "Shape", description: "查阅可选圆角档位与组件实际使用的圆角。", sections: ["shape", "shape-current"] },
  spacing: { title: "Spacing", description: "查阅 Web 实际使用的间距标尺与跨端间距基准。", sections: ["spacing-web", "spacing"] },
  typography: { title: "Typography", description: "查阅项目使用的通用文字样式、字体、字号、字重与行高。", sections: ["typography", "typography-fonts", "typography-size", "typography-weight", "typography-leading"] },
  sizing: { title: "Size & density", description: "查阅项目实际使用的控件密度与跨端侧栏尺寸。", sections: ["sizing"] },
};

export const projectIcons = iconCatalog.icons;
