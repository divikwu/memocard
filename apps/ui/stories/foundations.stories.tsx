import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { FoundationReference } from "./foundation-reference";
import { catalog } from "./foundation-reference.data";
import { LivePalette as ColorLivePalette } from "./foundation-colors.stories";

function Foundations() {
  return <FoundationReference />;
}

const meta = { title: "foundations/all tokens", id: "foundations-tokens", component: Foundations, globals: desktopGlobals, parameters: { docs: { page: Foundations } } } satisfies Meta<typeof Foundations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = canvas.getByRole("main");
    await waitFor(() => expect(page).toHaveAttribute("aria-busy", "false"));
    for (const [kind, count] of [["css", catalog.css.filter(token => token.layer !== "adapter").length], ["portable", catalog.portable.length], ["runtime", 0], ["external", 0], ["contract", 0]] as const) {
      await expect(page.querySelectorAll(`[data-token-kind="${kind}"]`)).toHaveLength(count);
    }
    const background = page.querySelector('[data-token-kind="css"][data-token-name="--background"]')!;
    const mode = canvasElement.ownerDocument.documentElement.classList.contains("dark") ? "dark" : "light";
    await waitFor(() => expect(page).toHaveAttribute("data-token-mode", mode));
    await expect(background.querySelectorAll("[data-color-mode]")).toHaveLength(1);
    await expect(within(background as HTMLElement).getByLabelText(`--background ${mode} value`)).toHaveTextContent(mode === "light" ? "#ffffff" : "#0a0a0a");
    await expect(page.querySelectorAll("details, summary")).toHaveLength(0);
    // Hash navigation belongs to the real Docs page; Vitest owns this tester frame's URL.
    await expect(canvas.getByRole("navigation", { name: "本页内容" }).querySelector('a[href="#foundation-spacing"]')).toHaveTextContent("Spacing tokens");
    await expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth + 1);
  },
};
export const Dark: Story = { ...Default, tags: ["!dev"], globals: { theme: "dark" } };
export const Mobile: Story = { ...Default, tags: ["!dev", "mobile"], globals: { viewport: { value: "mobile", isRotated: false } } };

// Preserve the original deep link and regression while sharing the Color fixture.
export const LivePalette: Story = { ...ColorLivePalette, tags: ["!dev"] };
