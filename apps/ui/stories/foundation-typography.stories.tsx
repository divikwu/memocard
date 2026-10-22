import type { Meta, StoryObj } from "@storybook/react-vite";
import { FoundationReference } from "./foundation-reference";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals, mobileViewport } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { useTypography } from "../src/features/typography/TypographyProvider";
import { defaults, options, parseTypography, STORAGE_KEY, type Typography as TypographyValue } from "../src/features/typography/preferences";
import { sidebarTokens } from "../src/generated/design-tokens";
import "../src/typeset.css";

const axes = ["size", "leading", "measure", "flow"] as const;
const labels = { size: "笔记字号", leading: "笔记行高", measure: "笔记阅读宽度", flow: "笔记段落间距" };
const boundary = (end: "first" | "last") => parseTypography(JSON.stringify({ ...defaults,
  ...Object.fromEntries(axes.map(key => [key, end === "first" ? options[key][0] : options[key].at(-1)])),
}));
const compact = boundary("first"), spacious = boundary("last");
const seed = (value: TypographyValue) => { localStorage.setItem(STORAGE_KEY, JSON.stringify(parseTypography(JSON.stringify(value)))); };
const longLink = `https://example.com/notes/${"readable-without-page-overflow-".repeat(8)}`;

function Typography() {
  const { value, save, error } = useTypography();
  return <main className="max-w-4xl space-y-8 bg-background p-6 text-foreground">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">界面与笔记排版</h1><p className="text-sm text-muted-foreground">界面字体由外观设置管理；笔记排版由生产 TypographyProvider 管理，两者保留各自职责。这里验证排版边界，不代表所有字体的字形验收。</p></header>
    <section className="space-y-3"><h2 className="text-lg font-semibold">界面文字角色</h2><p className="font-heading text-xl font-semibold">标题 · MemoCard 记忆卡</p><p className="font-sans text-base">正文 · 中文、English 与 Emoji 📝</p><p className="text-sm text-muted-foreground">辅助说明 · 可用完整名称与文本表达状态。</p><p className="text-xs text-muted-foreground">分组与次要信息</p></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">真实笔记排版</h2><output aria-label="笔记排版设置" className="block text-sm tabular-nums">{value.size}px 基准 / {value.leading} / {value.measure} / {value.flow}</output>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{axes.map(key => <label key={key} className="min-w-0 space-y-1 text-sm">{labels[key]}<select aria-label={labels[key]} value={value[key]} onChange={event => save({ ...value, [key]: event.target.value })} className="block w-full rounded-md border bg-background px-2 py-1 text-foreground">{options[key].map(option => <option key={option} value={option}>{key === "size" ? `${option}px 基准` : option}</option>)}</select></label>)}</div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => save({ ...value, size: "18" })}>正文使用 18px 基准</Button><Button variant="outline" onClick={() => save(compact)}>使用紧凑边界</Button><Button variant="outline" onClick={() => save(spacious)}>使用宽松边界</Button><Button variant="outline" onClick={() => save({ ...defaults })}>恢复排版默认值</Button></div>
      {error && <p role="status" className="text-sm text-destructive">{error}</p>}
      <article aria-label="笔记排版样本" className="markdown typeset rounded-lg border p-4"><h1>把想法写下来</h1><p data-testid="chinese-paragraph">这一段使用生产笔记正文的字体、字号、行高和阅读宽度。把沿途观察到的细节记下来，再回头看看哪些想法值得继续展开。阅读宽度变窄时，中文应自然换行；字号和行距增加时，段落仍然保持完整，不能挤出页面。{"让每一次回顾都保留清晰的阅读节奏。".repeat(5)}</p><p data-testid="paragraph-flow">A small note can hold a useful idea. {"Reading should remain comfortable when a paragraph grows longer, across narrow screens and wider desktop layouts. ".repeat(5)}</p><h2>让层级帮助阅读</h2><ul><li>标题、段落与列表来自现有 Typeset 样式。</li><li>Long list items wrap with the same reading width instead of stretching the whole page.</li></ul><p><strong>强调内容</strong>与<code>inline code</code>各自保留语义。</p><p><a href={longLink} onClick={event => event.preventDefault()}>{longLink}</a></p><pre aria-label="可横向滚动的代码"><code>{`const note = "${"keep-code-inside-its-scroll-container-".repeat(8)}";\nconsole.log(note);`}</code></pre></article>
    </section>
    <section className="space-y-2"><h2 className="text-lg font-semibold">原生平台映射</h2><p className="text-sm">iOS 侧栏正文 / 品牌 / 辅助基准为 {sidebarTokens.mobileFontSize} / {sidebarTokens.brandFontSize} / {sidebarTokens.captionFontSize}pt，使用系统字体与 Dynamic Type。大字预览在 NativeSidebar.swift 的 Xcode Preview 中维护。</p></section>
  </main>;
}

const meta = {
  title: "foundations/typography", component: Typography, globals: desktopGlobals,
  parameters: { docs: { page: () => <FoundationReference category="typography" />, story: { height: "1600px" }, description: { component: "控件与边界值来自生产 typography options/defaults，使用真实 Provider 保存、解析和恢复。字号、行高、阅读宽度与段距按代表组合覆盖；H5 使用真实 390×844 视口，代码内部横滚沿用生产 Typeset 规则。" } } },
} satisfies Meta<typeof Typography>;
export default meta;
type Story = StoryObj<typeof meta>;
type Canvas = ReturnType<typeof within>;

async function verifyTypography(canvasElement: HTMLElement, value: TypographyValue) {
  const canvas = within(canvasElement), sample = canvas.getByRole("article", { name: "笔记排版样本" });
  await waitFor(() => {
    expect(getComputedStyle(sample).fontSize).toBe(`${value.size}px`);
    expect(parseFloat(getComputedStyle(sample).lineHeight)).toBeCloseTo(Number(value.size) * Number(value.leading), 2);
    expect(parseFloat(getComputedStyle(canvas.getByTestId("paragraph-flow")).marginBlockStart)).toBeCloseTo(Number(value.size) * parseFloat(value.flow), 2);
  });
  for (const key of axes) await expect(canvas.getByRole("combobox", { name: labels[key] })).toHaveValue(value[key]);
  const measure = parseFloat(getComputedStyle(sample.ownerDocument.documentElement).getPropertyValue("--note-measure"));
  await expect(parseFloat(getComputedStyle(sample).maxWidth)).toBe(measure);
  await expect(sample.getBoundingClientRect().width).toBeCloseTo(Math.min(measure, sample.parentElement!.clientWidth), 0);
  const paragraph = canvas.getByTestId("chinese-paragraph");
  await expect(paragraph.getBoundingClientRect().height).toBeGreaterThan(parseFloat(getComputedStyle(paragraph).lineHeight) * 2);
  return sample;
}

async function selectBoundary(canvas: Canvas, value: TypographyValue) {
  for (const key of axes) await userEvent.selectOptions(canvas.getByRole("combobox", { name: labels[key] }), value[key]);
}

async function verifyNarrowLayout(canvasElement: HTMLElement) {
  const canvas = within(canvasElement), sample = canvas.getByRole("article", { name: "笔记排版样本" });
  const document = sample.ownerDocument;
  await expect(document.defaultView!.innerWidth).toBe(mobileViewport.width);
  // The manager can constrain Canvas height; the browser project fixes the full test viewport.
  if (import.meta.env.MODE === "test") await expect(document.defaultView!.innerHeight).toBe(mobileViewport.height);
  for (const element of [document.documentElement, canvas.getByRole("main"), sample]) await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
  const code = canvas.getByLabelText("可横向滚动的代码");
  await expect(getComputedStyle(code).overflowX).toBe("auto");
  await expect(code.scrollWidth).toBeGreaterThan(code.clientWidth);
  await expect(code.getBoundingClientRect().right).toBeLessThanOrEqual(sample.getBoundingClientRect().right);
}

export const Default: Story = {
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await verifyTypography(canvasElement, defaults);
    await expect(defaults.size).toBe("16");
    await userEvent.click(canvas.getByRole("button", { name: "正文使用 18px 基准" }));
    await verifyTypography(canvasElement, { ...defaults, size: "18" });
    await userEvent.click(canvas.getByRole("button", { name: "恢复排版默认值" }));
    await verifyTypography(canvasElement, defaults);
    await expect(canvas.getByLabelText("笔记排版设置")).toHaveTextContent(`${defaults.size}px`);
  },
};

export const CompactBoundary: Story = {
  tags: ["!dev"],
  beforeEach: () => seed(compact),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement), sample = await verifyTypography(canvasElement, compact);
    await expect(axes.map(key => compact[key])).toEqual(["14", "1.6", "60", "1em"]);
    const narrowWidth = sample.getBoundingClientRect().width;
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: labels.measure }), spacious.measure);
    await verifyTypography(canvasElement, { ...compact, measure: spacious.measure });
    await expect(sample.getBoundingClientRect().width).toBeGreaterThan(narrowWidth);
    await userEvent.click(canvas.getByRole("button", { name: "恢复排版默认值" }));
    await verifyTypography(canvasElement, defaults);
  },
};

export const SpaciousBoundary: Story = {
  tags: ["!dev"],
  beforeEach: () => seed(spacious),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await verifyTypography(canvasElement, spacious);
    await expect(axes.map(key => spacious[key])).toEqual(["18", "1.9", "90", "2em"]);
    const paragraph = canvas.getByTestId("paragraph-flow"), initialGap = parseFloat(getComputedStyle(paragraph).marginBlockStart);
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: labels.flow }), compact.flow);
    await verifyTypography(canvasElement, { ...spacious, flow: compact.flow });
    await expect(parseFloat(getComputedStyle(paragraph).marginBlockStart)).toBeLessThan(initialGap);
    await userEvent.click(canvas.getByRole("button", { name: "恢复排版默认值" }));
    await verifyTypography(canvasElement, defaults);
  },
};

export const MobileResponsive: Story = {
  tags: ["mobile", "!dev"], globals: { viewport: { value: "mobile", isRotated: false } },
  beforeEach: () => seed(compact),
  parameters: { docs: { story: { height: "844px" } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await verifyTypography(canvasElement, compact); await verifyNarrowLayout(canvasElement);
    await selectBoundary(canvas, spacious);
    await verifyTypography(canvasElement, spacious); await verifyNarrowLayout(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "恢复排版默认值" }));
    await verifyTypography(canvasElement, defaults); await verifyNarrowLayout(canvasElement);
  },
};
