import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { Button } from "../src/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../src/components/ui/sheet";
import { sidebarTokens } from "../src/generated/design-tokens";

const icons = Object.entries(import.meta.glob("../../apple/Resources/Assets.xcassets/Lucide-*.imageset/icon.svg", { eager: true, query: "?url", import: "default" })) as [string, string][];
const motionQuery = "(prefers-reduced-motion: reduce)";

function MotionExample() {
  const [reduced, setReduced] = useState(() => window.matchMedia(motionQuery).matches);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(motionQuery);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <section className="space-y-3">
    <h2 className="text-lg font-semibold">系统动效偏好与真实抽屉</h2>
    <output aria-label="当前动效媒体偏好" className="block text-sm">{reduced ? "reduce · 减少动态效果" : "no-preference · 常规动效"}</output>
    <p className="text-sm text-muted-foreground">Canvas 遵循浏览器／系统偏好。自动测试临时模拟两种偏好，再恢复常规动效；不修改生产样式或自造动画。</p>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline">打开生产抽屉</Button>} />
      <SheetContent>
        <SheetHeader><SheetTitle>生产抽屉动效</SheetTitle><SheetDescription>复用生产 Sheet 的滑入、淡入与过渡；关闭或按 Escape 后焦点返回入口。</SheetDescription></SheetHeader>
        <p className="px-4 text-sm">减少动态效果时，生产全局 CSS 缩短此抽屉的动画与过渡。</p>
      </SheetContent>
    </Sheet>
    <output aria-label="动效抽屉状态" className="block text-sm text-muted-foreground">{open ? "抽屉已打开" : "抽屉已关闭"}</output>
  </section>;
}

function Effects() {
  return <main className="max-w-4xl space-y-8 bg-background p-6 text-foreground">
    <header className="space-y-2"><h1 className="text-2xl font-semibold">图标、层次与输入反馈</h1><p className="text-sm text-muted-foreground">展示已有资源和组件样式；系统材质与系统控件尺寸继续由 iOS 管理。</p></header>
    <section className="space-y-3"><h2 className="text-lg font-semibold">同源侧栏图标</h2><p className="text-sm text-muted-foreground">以下直接显示 Lucide 生成的原生侧栏 SVG；常规基准 {sidebarTokens.iconSize}px / pt，图标视觉框与触摸命中区分别维护。</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{icons.map(([path, url]) => <div key={path} className="flex items-center gap-2 rounded-lg border p-3 text-xs"><span aria-hidden="true" data-testid="sidebar-icon" style={{ width: sidebarTokens.iconSize, height: sidebarTokens.iconSize, flexShrink: 0, backgroundColor: "currentColor", maskImage: `url(${JSON.stringify(url)})`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }} /><code className="break-all">{path.match(/Lucide-(.+)\.imageset/)![1]}</code></div>)}</div></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">浮层层次</h2><div aria-label="浮层阴影样本" className="rounded-lg bg-popover p-6 text-popover-foreground" style={{ boxShadow: "var(--overlay-shadow)" }}>生产 --overlay-shadow；明暗主题各自定义。</div><p className="text-sm text-muted-foreground">弹层层级仍属于对应组件；不为原生菜单复制 Web 阴影或 z-index。</p></section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">键盘焦点与动效</h2><Button variant="outline">用 Tab 检查焦点</Button><p className="text-sm text-muted-foreground">焦点使用现有 ring 语义。生产 CSS 在 prefers-reduced-motion: reduce 下缩短动画与过渡；本示例不新增统一时长或动画。</p></section>
    <MotionExample />
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
    await inspectSheet(canvasElement);
  },
};

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

function durationMilliseconds(value: string) {
  return Math.max(...value.split(",").map(time => Number.parseFloat(time) * (time.trim().endsWith("ms") ? 1 : 1000)));
}

async function inspectSheet(canvasElement: HTMLElement, escape = false) {
  const canvas = within(canvasElement), page = within(canvasElement.ownerDocument.body);
  const trigger = canvas.getByRole("button", { name: "打开生产抽屉" });
  await userEvent.click(trigger);
  const sheet = await page.findByRole("dialog", { name: "生产抽屉动效" });
  await waitFor(() => {
    const current = getComputedStyle(sheet);
    expect(current.animationName).not.toBe("none");
    expect(durationMilliseconds(current.animationDuration)).toBeGreaterThan(0);
    expect(durationMilliseconds(current.transitionDuration)).toBeGreaterThan(0);
  });
  const style = getComputedStyle(sheet);
  const durations = { animation: durationMilliseconds(style.animationDuration), transition: durationMilliseconds(style.transitionDuration) };
  if (window.matchMedia(motionQuery).matches) {
    await expect(durations.animation).toBeCloseTo(0.01, 5);
    await expect(durations.transition).toBeCloseTo(0.01, 5);
  }
  if (escape) await userEvent.keyboard("{Escape}");
  else await userEvent.click(within(sheet).getByRole("button", { name: "关闭" }));
  await waitFor(() => expect(page.queryByRole("dialog", { name: "生产抽屉动效" })).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  await expect(canvas.getByLabelText("动效抽屉状态")).toHaveTextContent("抽屉已关闭");
  return durations;
}

export const ReducedMotion: Story = {
  parameters: { docs: { description: { story: "Canvas 展示实际系统媒体偏好。浏览器自动测试通过 Playwright 临时切换 no-preference / reduce，比较真实 Sheet 的 CSS 时长并验证关闭与焦点恢复，finally 恢复 no-preference。" } } },
  play: async ({ canvasElement }) => {
    if (import.meta.env.MODE !== "test") {
      await inspectSheet(canvasElement);
      return;
    }
    const { commands } = await import("vitest/browser");
    try {
      await commands.setReducedMotion("no-preference");
      await waitFor(() => expect(window.matchMedia(motionQuery).matches).toBe(false));
      const normal = await inspectSheet(canvasElement);
      await commands.setReducedMotion("reduce");
      await waitFor(() => expect(window.matchMedia(motionQuery).matches).toBe(true));
      await waitFor(() => expect(within(canvasElement).getByLabelText("当前动效媒体偏好")).toHaveTextContent("reduce · 减少动态效果"));
      const reduced = await inspectSheet(canvasElement, true);
      await expect(reduced.animation).toBeLessThan(normal.animation);
      await expect(reduced.transition).toBeLessThan(normal.transition);
    } finally {
      await commands.setReducedMotion("no-preference");
    }
    await waitFor(() => expect(window.matchMedia(motionQuery).matches).toBe(false));
    await waitFor(() => expect(within(canvasElement).getByLabelText("当前动效媒体偏好")).toHaveTextContent("no-preference · 常规动效"));
  },
};
