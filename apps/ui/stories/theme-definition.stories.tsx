import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeDefinitionExample } from "./theme-definition.example";
import { desktopGlobals } from "../.storybook/viewports";

const definitionCode = `import "@/styles.css";
import { defineTheme } from "@/features/theme/define-theme";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { Button } from "@/components/ui/button";

const base = defineTheme({
  name: "ocean-base",
  color: { accent: ["#0064E0", "#48CAE4"], neutralStyle: "cool" },
  localTokens: { "--brand-emphasis": ["#123456", "#BFEAFF"] },
});
const ocean = defineTheme({
  name: "ocean",
  extends: base,
  color: { contrast: "high" },
  tokens: { "--text-accent-color": ["#064E8A", "#8FDFFF"] },
  syntax: { comment: ["#515151", "#B8B8B8"] },
});

export function Example() {
  return <ThemeProvider definition={ocean}>
    <Button>主要操作</Button>
    <p className="text-accent">强调文字</p>
  </ThemeProvider>;
}`;

const meta = {
  title: "foundations/theme definition", component: ThemeDefinitionExample, globals: desktopGlobals,
  parameters: { docs: {
    story: { inline: false, height: "480px", autoHeight: true },
    source: { code: definitionCode, language: "tsx" },
    description: { component: `ocean 继承 ocean-base，保留配色种子并提高对比度。运行时与预编译输出相同，示例可切回原有主题，不修改已保存偏好。

## 定义与继承

下方 Show code 包含完整的 defineTheme 和应用代码。应用根保留一个 ThemeProvider，把 definition 传给已有的 Provider。字符串用于两种模式，二元组分别指定浅色与深色；子主题继承父主题结果，再应用本层生成配置、syntax 和显式 tokens。

每个浏览器文档使用一个根主题；Portal 读取同一根定义，组件局部 CSS 变量仍可覆盖。外观与阅读字体偏好继续优先；本示例不更改字号、圆角或动效。

## 语义类名对照

组件使用按用途命名的 Tailwind 类，主题覆盖底层变量。类名与底层变量不总是同名：

| 用途 | Tailwind 类名 | 主题覆盖入口 |
| --- | --- | --- |
| 正文主色 | \`text-primary\` | \`--foreground\` |
| 强调文字 | \`text-accent\` | \`--text-accent-color\` |
| 强调填充与前景 | \`bg-accent-bg text-on-accent\` | \`--primary / --primary-foreground\` |
| 选中表面与前景 | \`bg-state text-on-state\` | \`--accent / --accent-foreground\` |
| 加载占位 | \`bg-skeleton\` | \`--skeleton-bg\` |
| 等宽字体 | \`font-mono\` | \`--app-font-mono\` |

完整强调配对使用 color.accent 生成。单独覆盖 --primary 时，也需指定合适的 --primary-foreground；任意显式覆盖不会自动获得对比度保证。

## 预编译 CSS

在仓库根目录生成并检查独立样式：

\`\`\`sh
pnpm theme:build design/themes/ocean.json design/themes/ocean.generated.css
pnpm theme:build design/themes/ocean.json design/themes/ocean.generated.css --check
\`\`\`

从 apps/ui/src/main.tsx 加载该文件后，只传主题名称即可应用，无需在运行时导入生成器：

\`\`\`tsx
import "../../../design/themes/ocean.generated.css";

<ThemeProvider definition={{ name: "ocean" }}><App /></ThemeProvider>
\`\`\`

移除 definition 会恢复原有主题；预编译 CSS 本身不改写用户偏好。完整 syntax 色板仍按需导入。` },
  } },
} satisfies Meta<typeof ThemeDefinitionExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
