import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { radiusValues, sidebarTokens } from "../src/generated/design-tokens";
import { useTheme } from "../src/features/theme/ThemeProvider";
import { readIOSPalette } from "../src/lib/ios-palette";
import { Button } from "../src/components/ui/button";
import { desktopGlobals } from "../.storybook/viewports";

function Foundations() {
  return <main className="max-w-4xl space-y-8 bg-background p-6 text-foreground">
    <div className="space-y-2"><h1 className="text-balance text-2xl font-semibold">MemoCard 基础规范</h1><p className="text-pretty text-sm text-muted-foreground">尺寸来自同一份设计 token；颜色由生产主题 CSS 解析。iOS 自定义侧栏消费生成的 Swift 值，系统控件遵循平台规则。</p></div>
    <section className="space-y-3"><h2 className="text-balance text-lg font-semibold">语义颜色</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {["background", "foreground", "muted", "muted-foreground", "accent", "border", "sidebar", "sidebar-accent"].map(name => <div key={name} className="overflow-hidden rounded-lg border"><div className="h-16" style={{ backgroundColor: `var(--${name})` }} /><p className="border-t p-2 text-xs">{name}</p></div>)}
    </div></section>
    <section className="space-y-3"><h2 className="text-balance text-lg font-semibold">圆角选项</h2><div className="flex flex-wrap gap-3">{Object.entries(radiusValues).map(([name, value]) => <div key={name} className="flex size-20 flex-col items-center justify-center border bg-muted text-xs" style={{ borderRadius: value }}><span>{name}</span><span className="tabular-nums">{value}px / pt</span></div>)}</div></section>
    <section className="space-y-3"><h2 className="text-balance text-lg font-semibold">侧栏平台映射</h2><pre className="overflow-x-auto rounded-lg border bg-muted p-4 text-xs leading-relaxed tabular-nums">{JSON.stringify(sidebarTokens, null, 2)}</pre></section>
  </main>;
}
const meta = { title: "foundations/tokens", component: Foundations, globals: desktopGlobals, parameters: { docs: { story: { height: "1000px" } } } } satisfies Meta<typeof Foundations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Dark: Story = { globals: { theme: "dark" } };

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
