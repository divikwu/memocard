import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../src/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../src/components/ui/sheet";

export const motionQuery = "(prefers-reduced-motion: reduce)";

export function MotionExample({ compact = false }: { compact?: boolean }) {
  const [reduced, setReduced] = useState(() => window.matchMedia(motionQuery).matches);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(motionQuery);
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const Heading = compact ? "h3" : "h2";
  return <section className="space-y-3" aria-label={compact ? "动效演示" : undefined}>
    <Heading className="text-lg font-semibold">{compact ? "动效演示" : "系统动效偏好与真实抽屉"}</Heading>
    <output aria-label="当前动效媒体偏好" className="block text-sm">{reduced ? "reduce · 减少动态效果" : "no-preference · 常规动效"}</output>
    {!compact && <p className="text-sm text-secondary">Canvas 遵循浏览器／系统偏好。自动测试临时模拟两种偏好，再恢复常规动效；不修改生产样式或自造动画。</p>}
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline">{compact ? "播放动效" : "打开生产抽屉"}</Button>} />
      <SheetContent>
        <SheetHeader><SheetTitle>{compact ? "动效演示" : "生产抽屉动效"}</SheetTitle><SheetDescription>{compact ? "随系统减少动态效果设置变化。" : "复用生产 Sheet 的滑入、淡入与过渡；关闭或按 Escape 后焦点返回入口。"}</SheetDescription></SheetHeader>
        {!compact && <p className="px-4 text-sm">减少动态效果时，生产全局 CSS 缩短此抽屉的动画与过渡。</p>}
      </SheetContent>
    </Sheet>
    {!compact && <output aria-label="动效抽屉状态" className="block text-sm text-secondary">{open ? "抽屉已打开" : "抽屉已关闭"}</output>}
  </section>;
}


function durationMilliseconds(value: string) {
  return Math.max(...value.split(",").map(time => Number.parseFloat(time) * (time.trim().endsWith("ms") ? 1 : 1000)));
}

export async function inspectSheet(canvasElement: HTMLElement, escape = false) {
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

export async function inspectReducedMotion({ canvasElement }: { canvasElement: HTMLElement }) {
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
}
