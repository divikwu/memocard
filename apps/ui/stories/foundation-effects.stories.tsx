import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { sidebarTokens } from "../src/generated/design-tokens";

const icons = Object.entries(import.meta.glob("../../apple/Resources/Assets.xcassets/Lucide-*.imageset/icon.svg", { eager: true, query: "?url", import: "default" })) as [string, string][];

function Effects() {
  return <main className="max-w-4xl space-y-8 bg-background p-6 text-foreground">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">图标、层次与输入反馈</h1><p className="text-sm text-muted-foreground">展示已有资源和组件样式；系统材质与系统控件尺寸继续由 iOS 管理。</p></header>
    <section className="space-y-3"><h2 className="text-lg font-semibold">同源侧栏图标</h2><p className="text-sm text-muted-foreground">以下直接显示 Lucide 生成的原生侧栏 SVG；常规基准 {sidebarTokens.iconSize}px / pt，图标视觉框与触摸命中区分别维护。</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{icons.map(([path, url]) => <div key={path} className="flex items-center gap-2 rounded-lg border p-3 text-xs"><span aria-hidden="true" data-testid="sidebar-icon" style={{ width: sidebarTokens.iconSize, height: sidebarTokens.iconSize, flexShrink: 0, backgroundColor: "currentColor", maskImage: `url(${JSON.stringify(url)})`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }} /><code className="break-all">{path.match(/Lucide-(.+)\.imageset/)![1]}</code></div>)}</div></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">浮层层次</h2><div aria-label="浮层阴影样本" className="rounded-lg bg-popover p-6 text-popover-foreground" style={{ boxShadow: "var(--overlay-shadow)" }}>生产 --overlay-shadow；明暗主题各自定义。</div><p className="text-sm text-muted-foreground">弹层层级仍属于对应组件；不为原生菜单复制 Web 阴影或 z-index。</p></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">键盘焦点与动效</h2><Button variant="outline">用 Tab 检查焦点</Button><p className="text-sm text-muted-foreground">焦点使用现有 ring 语义。生产 CSS 在 prefers-reduced-motion: reduce 下缩短动画与过渡；本示例不新增统一时长或动画。</p></section>
  </main>;
}

const meta = {
  title: "foundations/effects", component: Effects, globals: desktopGlobals,
  parameters: { docs: { story: { height: "1000px" } } },
} satisfies Meta<typeof Effects>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(icons.length).toBeGreaterThan(0);
    const renderedIcons = canvas.getAllByTestId("sidebar-icon");
    await expect(renderedIcons).toHaveLength(icons.length);
    for (const [index, [, url]] of icons.entries()) {
      // Quoted SVG data URLs must remain valid CSS masks, and their source must load.
      await expect(getComputedStyle(renderedIcons[index]).maskImage).not.toBe("none");
      const image = new Image();
      image.src = url;
      await image.decode();
      await expect(image.naturalWidth).toBeGreaterThan(0);
    }
    await expect(getComputedStyle(canvas.getByLabelText("浮层阴影样本")).boxShadow).not.toBe("none");
    await userEvent.tab();
    const button = canvas.getByRole("button", { name: "用 Tab 检查焦点" });
    await expect(button).toHaveFocus();
    await expect(getComputedStyle(button).boxShadow).not.toBe("none");
  },
};
