import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { useTypography } from "../src/features/typography/TypographyProvider";
import { defaults } from "../src/features/typography/preferences";
import { sidebarTokens } from "../src/generated/design-tokens";
import "../src/typeset.css";

function Typography() {
  const { value, save } = useTypography();
  return <main className="max-w-4xl space-y-8 bg-background p-6 text-foreground">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">界面与笔记排版</h1><p className="text-sm text-muted-foreground">界面字体由外观设置管理；笔记排版由生产 TypographyProvider 管理，两者保留各自职责。</p></header>
    <section className="space-y-3"><h2 className="text-lg font-semibold">界面文字角色</h2><p className="font-heading text-xl font-semibold">标题 · MemoCard 记忆卡</p><p className="font-sans text-base">正文 · 中文、English 与 Emoji 📝</p><p className="text-sm text-muted-foreground">辅助说明 · 可用完整名称与文本表达状态。</p><p className="text-xs text-muted-foreground">分组与次要信息</p></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">真实笔记排版</h2><output aria-label="笔记排版设置" className="block text-sm tabular-nums">{value.size}px / {value.leading} / {value.measure}</output><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => save({ ...value, size: "18" })}>正文使用 18px</Button><Button variant="outline" onClick={() => save({ ...defaults })}>恢复排版默认值</Button></div>
      <article aria-label="笔记排版样本" className="markdown typeset rounded-lg border p-4"><h1>把想法写下来</h1><p>这一段使用生产笔记正文的字体、字号、行高和阅读宽度。A small note can hold a useful idea.</p><h2>让层级帮助阅读</h2><ul><li>标题、段落与列表来自现有 Typeset 样式。</li><li>长文本允许换行，不挤压相邻内容。</li></ul><p><strong>强调内容</strong>与<code>inline code</code>各自保留语义。</p><pre><code>{"VStack(spacing: 8) {\n    Text(\"记下此刻的想法\")\n}"}</code></pre></article>
    </section>
    <section className="space-y-2"><h2 className="text-lg font-semibold">原生平台映射</h2><p className="text-sm">iOS 侧栏正文 / 品牌 / 辅助基准为 {sidebarTokens.mobileFontSize} / {sidebarTokens.brandFontSize} / {sidebarTokens.captionFontSize}pt，使用系统字体与 Dynamic Type。大字预览在 NativeSidebar.swift 的 Xcode Preview 中维护。</p></section>
  </main>;
}

const meta = {
  title: "foundations/typography", component: Typography, globals: desktopGlobals,
  parameters: { docs: { story: { height: "1300px" } } },
} satisfies Meta<typeof Typography>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sample = canvas.getByRole("article", { name: "笔记排版样本" });
    const initial = getComputedStyle(sample).fontSize;
    await userEvent.click(canvas.getByRole("button", { name: "正文使用 18px" }));
    await waitFor(() => expect(getComputedStyle(sample).fontSize).not.toBe(initial));
    await expect(canvas.getByLabelText("笔记排版设置")).toHaveTextContent("18px");
    await userEvent.click(canvas.getByRole("button", { name: "恢复排版默认值" }));
    await waitFor(() => expect(getComputedStyle(sample).fontSize).toBe(initial));
    await expect(canvas.getByLabelText("笔记排版设置")).toHaveTextContent(`${defaults.size}px`);
  },
};
