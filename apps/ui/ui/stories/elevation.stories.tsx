import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";
import { ElevationShowcase } from "../ElevationShowcase";
import { expect, userEvent, waitFor, within } from "storybook/test";

const meta = {
  title: "foundations/elevation",
  id: "ui-elevation",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "elevation" },
  parameters: { docs: { page: () => <TokenPage category="elevation" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };

export const Components: StoryObj<typeof meta> = {
  render: () => <ElevationShowcase />,
  globals: { theme: "light" },
  parameters: { layout: "fullscreen", controls: { disable: true } },
};

export const InteractionRegression: StoryObj<typeof meta> = {
  ...Components,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const shadow = (element: Element) => getComputedStyle(element).boxShadow;
    const modes = ["light", "dark"] as const;
    const controlShadows: string[] = [];
    for (const mode of modes) {
      const label = mode === "light" ? "浅色" : "深色";
      const panel = canvas.getByRole("region", { name: `${label}阴影预览` });
      const input = panel.querySelector('[data-shadow-role="input"]')!;
      const restingInputShadow = shadow(input);
      const inputPreview = within(panel).getByRole("textbox", { name: `${label}输入聚焦预览` });
      await userEvent.click(inputPreview);
      await waitFor(() => expect(shadow(input)).not.toBe(restingInputShadow));
      await expect(getComputedStyle(input).outlineStyle).toBe("none");
      await userEvent.tab();
      await userEvent.tab({ shift: true });
      await expect(inputPreview).toHaveFocus();
      await expect(getComputedStyle(input).outlineStyle).toBe("solid");
      await userEvent.click(inputPreview);
      await expect(getComputedStyle(input).outlineStyle).toBe("none");
      await userEvent.tab();
      await waitFor(() => expect(shadow(input)).toBe(restingInputShadow));
      const samples = [...panel.querySelectorAll<HTMLElement>("[data-shadow-scale]")];
      await expect(samples.map(sample => sample.dataset.shadowScale)).toEqual(["0", "1", "2", "3", "4"]);
      for (const sample of samples) {
        const value = shadow(sample);
        await expect(value).not.toBe("none");
        await expect(value).not.toContain("var(");
        await expect(value).not.toContain("inset");
        await expect(CSS.supports("box-shadow", value)).toBe(true);
      }
      const thumb = panel.querySelector('[data-slot="switch-thumb"]')!;
      controlShadows.push(shadow(thumb));
      await expect(shadow(thumb)).toContain(shadow(samples[1]));
      await expect(shadow(thumb)).toContain("inset");
      await expect(shadow(thumb)).toContain(`color(srgb 1 1 1 / ${mode === "light" ? "0.88" : "0.04"})`);
      const card = panel.querySelector('[data-shadow-role="card"]')!;
      await expect(shadow(card)).not.toBe("none");
      await expect(getComputedStyle(card).borderTopStyle).toBe("solid");
      await expect(shadow(card)).toContain("0px 0px 0px 1px");
      await expect(getComputedStyle(card).borderTopColor).toBe("rgba(0, 0, 0, 0)");
      for (const [role, level] of [["floating", 2], ["document", 3]] as const) {
        await expect(shadow(panel.querySelector(`[data-shadow-role="${role}"]`)!)).toContain(shadow(samples[level]));
      }
      const toggle = within(panel).getByRole("switch", { name: `${label}自动保存` });
      await expect(toggle).toBeChecked();
      await userEvent.click(toggle);
      await expect(toggle).not.toBeChecked();
      await userEvent.click(toggle);
      await expect(toggle).toBeChecked();
      await userEvent.click(within(panel).getByRole("button", { name: `${label}打开弹层` }));
      const popup = await body.findByTestId(`elevation-popover-${mode}`);
      await waitFor(() => expect(popup).toBeVisible());
      await expect(popup).toHaveAttribute("data-ui-theme", mode);
      await expect(shadow(popup)).not.toBe("none");
      await expect(getComputedStyle(popup).borderTopWidth).toBe("1px");
      await expect(getComputedStyle(popup).borderTopColor).toBe("rgba(0, 0, 0, 0)");
      if (mode === "dark") {
        await expect(shadow(popup)).toContain("1px inset");
        await expect(shadow(popup)).toContain("color(srgb 1 1 1 / 0.04)");
      }
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(popup).not.toBeInTheDocument());
      await userEvent.click(within(panel).getByRole("button", { name: `${label}打开文档预览` }));
      const document = await body.findByTestId(`elevation-document-${mode}`);
      await waitFor(() => expect(document).toBeVisible());
      await expect(document).toHaveAttribute("data-ui-theme", mode);
      await expect(shadow(document)).not.toBe("none");
      await expect(shadow(document)).toContain(shadow(samples[3]));
      const overlay = canvasElement.ownerDocument.querySelector('[data-slot="dialog-overlay"]')!;
      await expect(overlay).toHaveAttribute("data-ui-theme", mode);
      await expect(getComputedStyle(overlay).backgroundColor).toContain(mode === "dark" ? "/ 0.8)" : "/ 0.5)");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(document).not.toBeInTheDocument());
    }
    await expect(controlShadows[0]).not.toBe(controlShadows[1]);
  },
};
