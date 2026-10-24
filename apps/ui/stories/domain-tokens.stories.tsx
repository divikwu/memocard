import type { Meta, StoryObj } from "@storybook/react-vite";
import { DomainTokens } from "./domain-tokens.example";
import { desktopGlobals } from "../.storybook/viewports";

const usageCode = `import "./domain-theme.css";

export function DomainExample() {
  return <>
    <svg role="img" aria-label="系列一" viewBox="0 0 100 100">
      <rect className="fill-data-categorical-blue" width="60" height="80" />
    </svg>
    <pre className="bg-syntax-background p-4">
      <code className="text-syntax-variable">
        <span className="text-syntax-keyword">const</span> answer = 42;
      </code>
    </pre>
    <div className="bg-syntax-added text-syntax-added-marker">+ answer = 42;</div>
  </>;
}`;

const meta = {
  title: "foundations/domain tokens",
  component: DomainTokens,
  globals: desktopGlobals,
  parameters: { docs: {
    story: { autoHeight: true },
    source: { code: usageCode, language: "tsx" },
    description: { component: `数据与语法角色是可独立导入的领域接口。分类色表达系列，顺序色表达强度；语法与 diff 角色表达代码结构。完整名称与当前值见 Color / All tokens。

## 按需加载

核心样式已经提供普通代码背景。使用完整数据与语法色板时，新建 \`src/domain-theme.css\`，将它作为 main.tsx 的样式入口，让 Tailwind 在同一个入口编译这些模块：

\`\`\`css
@import "./styles.css";
@import "./features/theme/domains/data.css";
@import "./features/theme/domains/syntax.css";
\`\`\`

在 main.tsx 中导入 \`./domain-theme.css\`，替代原来的 \`./styles.css\` 导入。只需其中一个领域时，省略另一个领域的 import。

## 角色与工具类

| 用途 | Tailwind 类名 | 可覆盖的 CSS 变量 |
| --- | --- | --- |
| 分类系列 | \`fill-data-categorical-blue\` | \`--data-categorical-blue\` |
| 顺序强度 | \`bg-data-blue-3\` | \`--data-blue-3\` |
| 语法关键字 | \`text-syntax-keyword\` | \`--syntax-keyword\` |
| 代码背景 | \`bg-syntax-background\` | \`--syntax-background\` |
| 新增行与标记 | \`bg-syntax-added text-syntax-added-marker\` | \`--syntax-added / --syntax-added-marker\` |

数据色不替代操作强调色或状态色，图表仍需数字或标签。语法 token 不提供语言解析器；当前笔记代码块继续显示普通文本。下方 Show code 可复制实际导入与工具类用法。` },
  } },
} satisfies Meta<typeof DomainTokens>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };
