import { useId } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { desktopGlobals } from "../.storybook/viewports";

function TabsExample({ orientation = "horizontal", variant = "default", onValueChange }: { orientation?: "horizontal" | "vertical"; variant?: "default" | "line"; onValueChange: ComponentProps<typeof Tabs>["onValueChange"] }) {
  const id = useId();
  return <Tabs defaultValue="notes" orientation={orientation} onValueChange={onValueChange} className="max-w-lg">
    <TabsList variant={variant} aria-label="笔记分类" className={variant === "default" ? "max-w-full overflow-x-auto" : undefined}>
      <TabsTrigger value="notes" id={`${id}-notes`}>所有笔记</TabsTrigger>
      <TabsTrigger value="archived" disabled>归档（暂不可用）</TabsTrigger>
      <TabsTrigger value="links" id={`${id}-links`}>链接</TabsTrigger>
    </TabsList>
    <TabsContent value="notes">这里是全部笔记。</TabsContent>
    <TabsContent value="archived">这里是归档笔记。</TabsContent>
    <TabsContent value="links">这里是包含链接的笔记。</TabsContent>
  </Tabs>;
}
const meta = {
  title: "components/tabs", component: TabsExample, globals: desktopGlobals,
  args: { orientation: "horizontal", variant: "default", onValueChange: fn() }, parameters: { layout: "padded", docs: { description: { component: "生产 Tabs 的 default/line 和纵向组合。横向 default 列表使用 h-9、line 使用 h-8，16px 根字号下分别为 36px / 32px，随根字号缩放；纵向列表使用内容高度。方向键切换，禁用项可聚焦但不激活。" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement), first = canvas.getByRole("tab", { name: "所有笔记" }), last = canvas.getByRole("tab", { name: "链接" });
    const disabled = canvas.getByRole("tab", { name: "归档（暂不可用）" });
    const next = args.orientation === "vertical" ? "{ArrowDown}" : "{ArrowRight}";
    const previous = args.orientation === "vertical" ? "{ArrowUp}" : "{ArrowLeft}";
    await userEvent.click(first);
    await expect(first).toHaveFocus();
    // Disabled tabs remain reachable by arrow keys, but cannot become active.
    await userEvent.keyboard(next);
    await expect(disabled).toHaveFocus();
    await userEvent.keyboard("{Enter} ");
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("tabpanel", { name: "所有笔记" })).toHaveTextContent("这里是全部笔记。");
    await expect(args.onValueChange).not.toHaveBeenCalledWith("archived", expect.anything());
    await userEvent.keyboard(next);
    await expect(last).toHaveFocus();
    await expect(last).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("tabpanel", { name: "链接" })).toHaveTextContent("这里是包含链接的笔记。");
    await expect(canvas.getByRole("tabpanel", { name: "链接" })).not.toHaveAttribute("inert");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("links", expect.anything());
    await userEvent.keyboard(previous + previous);
    await expect(first).toHaveFocus();
    await expect(canvas.getByRole("tabpanel", { name: "所有笔记" })).toHaveTextContent("这里是全部笔记。");
    await expect(canvas.getByRole("tabpanel", { name: "所有笔记" })).not.toHaveAttribute("inert");
    if (args.variant === "line") {
      const list = canvas.getByRole("tablist", { name: "笔记分类" });
      await expect(getComputedStyle(list).columnGap).toBe("12px");
      await expect(getComputedStyle(list).rowGap).toBe("4px");
      await expect(getComputedStyle(list).padding).toBe("3px");
      await expect(getComputedStyle(list).height).toBe("32px");
      for (const tab of [first, last]) {
        await expect(getComputedStyle(tab).paddingInlineStart).toBe("2px");
        await expect(getComputedStyle(tab).paddingInlineEnd).toBe("2px");
        await expect(getComputedStyle(tab).paddingBlockStart).toBe("2px");
        await expect(getComputedStyle(tab).fontWeight).toBe("500");
        await expect(getComputedStyle(tab, "::after").bottom).toBe("-5px");
      }
      await waitFor(async () => {
        await expect(getComputedStyle(first, "::after").opacity).toBe("1");
        await expect(getComputedStyle(last, "::after").opacity).toBe("0");
      });
    }
  },
} satisfies Meta<typeof TabsExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Line: Story = { args: { variant: "line" } };
export const Vertical: Story = { args: { orientation: "vertical" } };
