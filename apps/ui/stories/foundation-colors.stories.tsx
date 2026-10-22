import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useState } from "react";
import themeCSS from "../src/features/theme/tokens.css?raw";
import { useTheme } from "../src/features/theme/ThemeProvider";
import { Button } from "../src/components/ui/button";
import { Input } from "../src/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { FoundationReference } from "./foundation-reference";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { IOS_PALETTE_KEYS, readIOSPalette } from "../src/lib/ios-palette";
import { tagColors } from "../src/tag-colors";
import { colorPixel, contrastRatio, measurePair } from "./foundation-color-contrast";
import { Colors, contrastPairs } from "./foundation-colors.example";

// Keep the complete role-resolution check as a test fixture, outside the diagnostic page.
const theme = themeCSS.match(/@theme inline \{([\s\S]*?)\n\}/)![1];
const colorRoles = [...theme.matchAll(/--color-([\w-]+):\s*var\((--[\w-]+)\)/g)]
  .map(([, name, variable]) => ({ name, variable }));

const meta = {
  title: "foundations/colors", component: Colors, globals: desktopGlobals,
  parameters: { docs: { page: () => <FoundationReference category="colors" />, story: { height: "3000px" }, description: { component: "22 组配对测量；文字、图标和容器诊断分别判定。" } } },
} satisfies Meta<typeof Colors>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Diagnostics",
  tags: ["!dev"],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const style = getComputedStyle(canvasElement.ownerDocument.documentElement);
    await expect(colorRoles).toHaveLength(35);
    const colorSamples = canvasElement.ownerDocument.createElement("div");
    colorSamples.hidden = true;
    canvasElement.append(colorSamples);
    try {
      for (const { variable } of colorRoles) {
        await expect(style.getPropertyValue(variable).trim(), variable).not.toBe("");
        const sample = canvasElement.ownerDocument.createElement("span");
        sample.style.backgroundColor = `var(${variable})`;
        colorSamples.append(sample);
        await expect(getComputedStyle(sample).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      }
    } finally { colorSamples.remove(); }
    await expect(canvas.getByRole("table", { name: "颜色配对结果" }).querySelectorAll("tbody tr")).toHaveLength(22);
    await expect(canvas.queryByRole("region", { name: "交互状态" })).toBeNull();
    const palette = readIOSPalette();
    for (const key of IOS_PALETTE_KEYS) await expect(palette?.[key], key).toHaveLength(4);
    await expect(tagColors).toHaveLength(9);
    await expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBe(21);
    await expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.478089, 5);
    const baseline: Record<string, number> = {};
    for (const pair of contrastPairs) {
      const sample = canvas.getByLabelText(`${pair.id} 配对样本`);
      const reading = canvas.getByLabelText(`${pair.id} 对比度`);
      await waitFor(() => expect(reading).not.toHaveAttribute("data-result", "pending"));
      const measured = measurePair(sample);
      baseline[pair.id] = measured.ratio;
      await expect(Number(reading.getAttribute("data-ratio"))).toBeCloseTo(measured.ratio, 6);
      if (pair.scope === "diagnostic") {
        await expect(reading).toHaveAttribute("data-result", "diagnostic");
        await expect(reading).toHaveTextContent("容器配对诊断");
      } else {
        await expect(reading).toHaveAttribute("data-result", measured.ratio >= (pair.scope === "non-text" ? 3 : 4.5) ? "pass" : "fail");
        await expect(reading).toHaveTextContent(pair.scope === "non-text" ? "图标 3:1" : measured.ratio >= 4.5 ? "文字 AA 通过" : "文字 AA 未达标（既有问题）");
      }
    }
    const knownTextFailures = globals.palette === "blue" ? ["primary"] : [];
    const textFailures = contrastPairs.filter(pair => !pair.scope && baseline[pair.id] < 4.5).map(pair => pair.id);
    await expect(textFailures).toEqual(knownTextFailures);
    // Preserve the measured existing defect; green interaction tests do not claim AA.
    if (knownTextFailures.length) await expect(baseline.primary).toBeCloseTo(3.761777718, 3);
    for (const pair of contrastPairs.filter(pair => !pair.scope && !knownTextFailures.includes(pair.id))) await expect(baseline[pair.id], pair.id).toBeGreaterThanOrEqual(4.5);
    await expect(baseline["accent-text"]).toBeGreaterThanOrEqual(3);
    if (globals.theme === "light") await expect(baseline["muted-surface"]).toBeCloseTo(4.464779687, 3);
    else await expect(baseline["muted-surface"]).toBeGreaterThanOrEqual(4.5);
    if (import.meta.env.MODE === "test") console.info("FOUNDATION_COLOR_BASELINE", JSON.stringify({ theme: globals.theme, palette: globals.palette, neutralPalette: document.documentElement.dataset.neutralPalette, ratios: baseline, textFailures }));
  },
};
export const Dark: Story = { ...Default, name: "Dark", tags: ["!dev"], globals: { theme: "dark" } };
export const BlueSlate: Story = { ...Default, name: "Blue Slate", tags: ["!dev"], globals: { theme: "light", palette: "blue", neutralPalette: "slate" } };
export const DarkTeal: Story = { ...Default, name: "Dark Teal", tags: ["!dev"], globals: { theme: "dark", palette: "teal" } };
export const Mobile: Story = { ...Default, name: "Mobile", tags: ["!dev", "mobile"], globals: { viewport: { value: "mobile", isRotated: false } }, parameters: { docs: { story: { height: "844px" } } } };

// Interaction fixtures stay testable across the original appearance combinations,
// without adding controls or navigation entries to Diagnostics.
function ProductionStates() {
  const id = useId();
  const [value, setValue] = useState("");
  return <section aria-label="交互状态" className="space-y-4">
    <h2 className="text-balance text-lg font-semibold">交互状态</h2>
    <div className="grid gap-6 md:grid-cols-3">
      <div className="min-w-0 space-y-3">
        <h3 className="text-balance text-sm font-medium">按钮</h3>
        <div className="flex flex-wrap gap-3"><Button variant="outline">可操作</Button><Button disabled>不可用</Button></div>
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="text-balance text-sm font-medium">输入</h3>
        <label className="block space-y-2 text-sm">正常输入<Input aria-label="正常输入" value={value} onChange={event => setValue(event.target.value)} placeholder="输入一条笔记标题" /></label>
        <label className="block space-y-2 text-sm">校验错误<Input aria-label="校验错误" aria-invalid="true" aria-describedby={`${id}-error`} defaultValue="尚未通过校验" /><span id={`${id}-error`} className="block text-destructive">请检查输入内容。</span></label>
      </div>
      <div className="min-w-0 space-y-3">
        <h3 className="text-balance text-sm font-medium">Tabs</h3>
        <Tabs defaultValue="notes">
          <TabsList aria-label="状态切换"><TabsTrigger value="notes">笔记</TabsTrigger><TabsTrigger value="pinned">已固定</TabsTrigger></TabsList>
          <TabsContent value="notes">当前查看笔记。</TabsContent><TabsContent value="pinned">当前查看已固定笔记。</TabsContent>
        </Tabs>
      </div>
    </div>
  </section>;
}

export const StateRegression: Story = {
  tags: ["!dev"],
  render: () => <ProductionStates />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const style = getComputedStyle(canvasElement.ownerDocument.documentElement);
    const states = within(canvas.getByRole("region", { name: "交互状态" }));
    const button = states.getByRole("button", { name: "可操作" });
    const normal = colorPixel(getComputedStyle(button).backgroundColor);
    if (import.meta.env.MODE === "test") {
      // Synthetic mouse events cannot create CSS :hover; use a real browser pointer.
      const { page } = await import("vitest/browser");
      const target = page.getByRole("button", { name: "可操作", exact: true });
      await target.hover();
      await waitFor(() => expect(colorPixel(getComputedStyle(button).backgroundColor)).toEqual(colorPixel(style.getPropertyValue("--hover-bg"))));
      await expect(colorPixel(getComputedStyle(button).backgroundColor)).not.toEqual(normal);
      await target.unhover();
      await waitFor(() => expect(colorPixel(getComputedStyle(button).backgroundColor)).toEqual(normal));
    }
    const input = states.getByRole("textbox", { name: "正常输入" });
    await userEvent.click(input);
    await userEvent.tab({ shift: true });
    await expect(button).toHaveFocus();
    await expect(button.matches(":focus-visible")).toBe(true);
    await expect(getComputedStyle(button).boxShadow).not.toBe("none");
    await expect(states.getByRole("button", { name: "不可用" })).toBeDisabled();
    await expect(getComputedStyle(states.getByRole("button", { name: "不可用" })).opacity).toBe("0.5");
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.type(input, "本周笔记");
    await expect(input).toHaveValue("本周笔记");
    const invalid = states.getByRole("textbox", { name: "校验错误" });
    await expect(invalid).toHaveAttribute("aria-invalid", "true");
    await expect(invalid).toHaveAccessibleDescription("请检查输入内容。");
    await expect(colorPixel(getComputedStyle(invalid).borderTopColor)).toEqual(colorPixel(style.getPropertyValue("--destructive")));
    const first = states.getByRole("tab", { name: "笔记" });
    const second = states.getByRole("tab", { name: "已固定" });
    await expect(first).toHaveAttribute("aria-selected", "true");
    await userEvent.click(first);
    await userEvent.keyboard("{ArrowRight}");
    await expect(second).toHaveFocus();
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(first).toHaveAttribute("aria-selected", "false");
    await waitFor(() => expect(colorPixel(getComputedStyle(second).color)).toEqual(colorPixel(style.getPropertyValue("--foreground"))));
    await expect(states.getByRole("tabpanel", { name: "已固定" })).toHaveTextContent("当前查看已固定笔记。");
  },
};
export const StateRegressionDark: Story = { ...StateRegression, name: "State Regression Dark", tags: ["!dev"], globals: Dark.globals };
export const StateRegressionBlueSlate: Story = { ...StateRegression, name: "State Regression Blue Slate", tags: ["!dev"], globals: BlueSlate.globals };
export const StateRegressionDarkTeal: Story = { ...StateRegression, name: "State Regression Dark Teal", tags: ["!dev"], globals: DarkTeal.globals };
export const StateRegressionMobile: Story = { ...StateRegression, name: "State Regression Mobile", tags: ["!dev", "mobile"], globals: Mobile.globals };

function LiveThemeExample() {
  const { theme, palette, neutralPalette, setPalette, setNeutralPalette, resetAppearance } = useTheme();
  const instance = useId();
  return <main data-testid="live-theme" data-instance={instance} className="space-y-4 bg-background p-6 text-foreground">
    <h1 className="text-balance text-lg font-semibold">同一主题内切换颜色</h1>
    <p className="text-pretty text-sm text-muted-foreground">直接调用生产 ThemeProvider，在组件保持挂载时更新 CSS 和原生 palette 的采样来源。</p>
    <output aria-label="当前外观" className="block text-sm">{theme} / {palette} / {neutralPalette}</output>
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => setPalette("blue")}>使用蓝色强调色</Button>
      <Button onClick={() => setNeutralPalette("slate")}>使用石板中性色</Button>
      <Button variant="outline" onClick={resetAppearance}>恢复默认外观</Button>
    </div>
    <div className="flex gap-3">
      <div aria-label="强调色样本" className="size-20 rounded-lg bg-primary" />
      <div aria-label="侧栏颜色样本" className="size-20 rounded-lg border bg-sidebar" />
    </div>
  </main>;
}

export const LivePalette: Story = {
  tags: ["!dev"],
  render: () => <LiveThemeExample />,
  parameters: { docs: { story: { height: "360px" } } },
  globals: { theme: "light", palette: "mono", radius: "lg" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvasElement.ownerDocument.documentElement;
    const instance = canvas.getByTestId("live-theme").getAttribute("data-instance");
    const initial = readIOSPalette()!;
    await expect(initial.primary).toHaveLength(4);
    await expect(initial.sidebar).toHaveLength(4);
    await expect(root).toHaveClass("light");
    await userEvent.click(canvas.getByRole("button", { name: "使用蓝色强调色" }));
    await waitFor(() => {
      const current = readIOSPalette();
      expect(current?.primary).toHaveLength(4);
      expect(current?.primary).not.toEqual(initial.primary);
    });
    await expect(root).toHaveClass("light");
    await expect(canvas.getByTestId("live-theme")).toHaveAttribute("data-instance", instance!);
    await userEvent.click(canvas.getByRole("button", { name: "使用石板中性色" }));
    await waitFor(() => {
      const current = readIOSPalette();
      expect(current?.sidebar).toHaveLength(4);
      expect(current?.sidebar).not.toEqual(initial.sidebar);
    });
    await expect(root).toHaveClass("light");
    await expect(canvas.getByTestId("live-theme")).toHaveAttribute("data-instance", instance!);
    await userEvent.click(canvas.getByRole("button", { name: "恢复默认外观" }));
    await waitFor(() => {
      const restored = readIOSPalette();
      expect(restored?.primary).toEqual(initial.primary);
      expect(restored?.sidebar).toEqual(initial.sidebar);
    });
    await expect(root).toHaveClass("light");
    await expect(canvas.getByTestId("live-theme")).toHaveAttribute("data-instance", instance!);
  },
};
