import themeCSS from "./theme.css?raw";

export const categories = [
  { id: "all", name: "all tokens", title: "All tokens", story: "ui-theme", description: "MemoCard 的基础 token 目录：查阅颜色、间距、尺寸、圆角、阴影、字体与动效定义。" },
  { id: "colors", name: "colors", title: "Colors", story: "ui-colors", description: "保留 Astryx 语义命名，颜色主要按浅深色模式引用 Tailwind 基础色板；投影基色分别适配项目的浅深色背景。" },
  { id: "elevation", name: "elevation", title: "Elevation", story: "ui-elevation", description: "从递增的基础尺度到语义角色，统一管理浅深色阴影及组件用法；高光、边框、焦点与动效独立维护。" },
  { id: "icons", name: "icons", title: "Icons", story: "ui-icons", description: "项目使用的 Hugeicons 图形、语义用途与 Tailwind 用法。" },
  { id: "illustrations", name: "illustrations", title: "Illustrations", story: "ui-illustrations", description: "插画的使用场景、风格与布局规范，不计入基础 token 数量。" },
  { id: "motion", name: "motion", title: "Motion", story: "ui-motion", description: "统一的时长和缓动标尺。减少动态效果时，主题将有效时长设置为 0ms。" },
  { id: "shape", name: "shape", title: "Shape", story: "ui-shape", description: "语义圆角标尺与同心圆角，按控件、容器和页面用途选择。" },
  { id: "spacing", name: "spacing", title: "Spacing", story: "ui-spacing", description: "布局间距共用一个基准；控件高度使用独立的 sm、md、lg 角色。" },
  { id: "typography", name: "typography", title: "Typography", story: "ui-typography", description: "字体、字重、字号与行高共同定义界面文字层级。" },
] as const;

export type TokenCategory = (typeof categories)[number]["id"];

export const textStyles = [
  ["type-display-1", "Display 1"], ["type-display-2", "Display 2"], ["type-display-3", "Display 3"],
  ["type-heading-1", "H1"], ["type-heading-2", "H2"], ["type-heading-3", "H3"],
  ["type-heading-4", "H4"], ["type-heading-5", "H5"], ["type-heading-6", "H6"],
  ["type-large", "Large"], ["type-body", "Body"], ["type-label", "Label"],
  ["type-code", "Code"], ["type-supporting", "Supporting"],
].map(([className, label]) => ({ name: className.slice(5), label, className }));

// Only the explicitly authored theme blocks are indexed. Media overrides and
// Tailwind aliases are separate contracts, not additional source tokens.
const source = themeCSS.replace(/\/\*[\s\S]*?\*\//g, "");
function block(pattern: RegExp) {
  const match = pattern.exec(source)!;
  let depth = 1, end = match.index + match[0].length;
  const start = end;
  for (; depth > 0 && end < source.length; end++) {
    if (source[end] === "{") depth++;
    if (source[end] === "}") depth--;
  }
  return source.slice(start, end - 1);
}
function declarations(css: string) {
  return [...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => ({ name, value: value.trim() }));
}
const base = declarations(block(/:root,\s*\.ui-theme\s*\{/));
const dark = new Map(declarations(block(/\[data-ui-theme="dark"\]\s*\{/)).map(token => [token.name, token.value]));
export const aliases = declarations(block(/@theme reference inline\s*\{/));
export const utilities = [...source.matchAll(/@utility ([\w-]+)\s*\{/g)].map(([, name]) => ({
  name, source: block(new RegExp(`@utility ${name}\\s*\\{`)),
}));

const projectColors = new Set([
  "--color-background-control",
  "--color-background-glass",
  "--color-background-selection",
  "--color-background-sidebar",
  "--color-text-control-secondary",
  "--color-border-subtle",
  "--color-border-floating",
  "--color-success-fill", "--color-warning-fill", "--color-error-fill",
  "--color-on-accent-overlay-hover", "--color-on-accent-overlay-pressed",
]);
const hueNames = "blue|cyan|gray|green|orange|pink|purple|red|teal|yellow";
const hueRole = new RegExp(`^--color-(background|border|icon|text)-(${hueNames})$`);

function colorGroupOf(name: string) {
  if (!name.startsWith("--color-")) return undefined;
  if (projectColors.has(name)) return "extensions";
  if (name === "--color-brand") return "brand";
  if (name.startsWith("--color-syntax-")) return "syntax";
  if (name.startsWith("--color-data-")) return "data";
  if (hueRole.test(name)) return "palette";
  return "colors";
}

function categoryOf(name: string): Exclude<TokenCategory, "all"> {
  if (name === "--spacing-reading-flow") return "typography";
  if (name.startsWith("--color-icon-")) return "icons";
  if (name.startsWith("--surface-edge-") || name.startsWith("--surface-highlight-") || name.startsWith("--shadow-") || name.startsWith("--blur-") || name === "--color-shadow") return "elevation";
  if (name.startsWith("--color-")) return "colors";
  if (name.startsWith("--duration-") || name.startsWith("--ease-")) return "motion";
  if (name.startsWith("--radius-") || name.startsWith("--focus-") || name === "--border-width") return "shape";
  if (name.startsWith("--spacing-") || name.startsWith("--size-")) return "spacing";
  return "typography";
}

function utilityFor(name: string) {
  if (name === "--default-border-width") return "border";
  if (name === "--spacing") return "p-* / gap-*";
  if (name.startsWith("--spacing-element-")) return name.replace("--spacing-", "h-");
  if (name.startsWith("--font-")) return name.replace("--font-", "font-");
  if (name.startsWith("--text-")) return name.replace("--text-", "text-");
  if (name.startsWith("--radius-")) return name.replace("--radius-", "rounded-");
  if (name.startsWith("--shadow-")) return name.replace("--shadow-", "shadow-");
  if (name.startsWith("--ease-")) return name.replace("--ease-", "ease-");
  if (name.startsWith("--default-transition-")) return "transition-*";
  const color = name.replace("--color-", "");
  if (color.startsWith("border")) return `border-${color}`;
  if (color === "focus") return "outline-focus";
  if (color === "shadow") return "";
  if (color.startsWith("on-accent-overlay-")) return `bg-${color}`;
  if (new RegExp(`^(${hueNames})$`).test(color)) return `text-${color}`;
  if (color.startsWith("syntax-") && !["syntax-background", "syntax-added", "syntax-removed", "syntax-diff-header"].includes(color)) return `text-${color}`;
  if (/^(primary|secondary|control-secondary|disabled|accent|icon-.+|on-.+|success|warning|error)$/.test(color)) return `text-${color}`;
  return `bg-${color}`;
}

export const tokens = base.map(token => ({
  name: token.name,
  light: token.value,
  dark: dark.get(token.name) ?? token.value,
  category: categoryOf(token.name),
  colorGroup: colorGroupOf(token.name),
  projectExtension: projectColors.has(token.name),
  valueSource: token.name === "--color-shadow" ? "project" as const : undefined,
  pending: token.name === "--color-brand" && token.value === "initial",
  interfaces: [...new Set([
    ...aliases.filter(alias => alias.value.includes(`var(${token.name})`)).map(alias => utilityFor(alias.name)),
    ...utilities.filter(utility => utility.source.includes(`var(${token.name})`)).map(utility => utility.name),
  ].filter(Boolean))],
}));
export type ThemeToken = (typeof tokens)[number];
export const sourceRef = themeCSS.match(/[a-f0-9]{40}/)![0];
