import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { IOS_PALETTE_KEYS, readIOSPalette } from "../src/lib/ios-palette";
import { tagColors } from "../src/tag-colors";
import { colorPixel, contrastRatio, measurePair } from "./foundation-color-contrast";
import { Colors, colorRoles, contrastPairs } from "./foundation-colors.example";

const meta = {
  title: "foundations/colors", component: Colors, globals: desktopGlobals,
  parameters: { docs: { story: { height: "3000px" }, description: { component: "35 个生产语义色、9 组标签色与当前实际文字配对；显示浏览器实测的 sRGB 文字对比度，保留既有 AA 问题。真实 Button/Input/Tabs 验证基础状态，不把诊断故事通过等同于所有颜色 AA 通过。" } } },
} satisfies Meta<typeof Colors>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const style = getComputedStyle(canvasElement.ownerDocument.documentElement);
    await expect(colorRoles).toHaveLength(35);
    for (const { name, variable } of colorRoles) {
      await expect(style.getPropertyValue(variable).trim(), variable).not.toBe("");
      await expect(getComputedStyle(canvas.getByLabelText(`${name} 色样`)).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    }
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
    const knownTextFailures = globals.theme === "light" && globals.palette === "blue" ? ["primary"] : [];
    const textFailures = contrastPairs.filter(pair => !pair.scope && baseline[pair.id] < 4.5).map(pair => pair.id);
    await expect(textFailures).toEqual(knownTextFailures);
    // Preserve the measured existing defect; green interaction tests do not claim AA.
    if (knownTextFailures.length) await expect(baseline.primary).toBeCloseTo(3.761777718, 3);
    for (const pair of contrastPairs.filter(pair => !pair.scope && !knownTextFailures.includes(pair.id))) await expect(baseline[pair.id], pair.id).toBeGreaterThanOrEqual(4.5);
    await expect(baseline["accent-text"]).toBeGreaterThanOrEqual(3);
    if (globals.theme === "light") await expect(baseline["muted-surface"]).toBeCloseTo(4.464779687, 3);
    else await expect(baseline["muted-surface"]).toBeGreaterThanOrEqual(4.5);
    if (import.meta.env.MODE === "test") console.info("FOUNDATION_COLOR_BASELINE", JSON.stringify({ theme: globals.theme, palette: globals.palette, neutralPalette: document.documentElement.dataset.neutralPalette, ratios: baseline, textFailures }));
    const states = within(canvas.getByRole("region", { name: "真实组件状态" }));
    const button = states.getByRole("button", { name: "悬停或聚焦此按钮" });
    const normal = colorPixel(getComputedStyle(button).backgroundColor);
    if (import.meta.env.MODE === "test") {
      // Synthetic mouse events cannot create CSS :hover; use a real browser pointer.
      const { page } = await import("vitest/browser");
      const target = page.getByRole("button", { name: "悬停或聚焦此按钮", exact: true });
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
    await expect(states.getByRole("button", { name: "暂不可用" })).toBeDisabled();
    await expect(getComputedStyle(states.getByRole("button", { name: "暂不可用" })).opacity).toBe("0.5");
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
export const Dark: Story = { ...Default, globals: { theme: "dark" } };
export const BlueSlate: Story = { ...Default, globals: { theme: "light", palette: "blue", neutralPalette: "slate" } };
export const DarkTeal: Story = { ...Default, globals: { theme: "dark", palette: "teal" } };
export const Mobile: Story = { ...Default, tags: ["mobile"], globals: { viewport: { value: "mobile", isRotated: false } }, parameters: { docs: { story: { height: "844px" } } } };
