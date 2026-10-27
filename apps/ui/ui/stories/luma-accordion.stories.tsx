import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Accordion } from "../components/accordion";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { AccordionExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/accordion",
  id: "ui-accordion",
  component: Accordion,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="accordion" /> } },
} satisfies Meta<typeof Accordion>;
export default meta;
export const Example: StoryObj<typeof meta> = {
  render: () => <LumaStoryFrame><AccordionExample /></LumaStoryFrame>,
};
export const ExampleRegression: StoryObj<typeof meta> = {
  ...Example,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "圆角基准是多少？" });
    await userEvent.click(trigger);
    const panel = canvas.getByText("控件基准为 8px，其余圆角按语义派生。").closest<HTMLElement>('[data-slot="accordion-content"]')!;
    await waitFor(() => expect(panel.getBoundingClientRect().height).toBeGreaterThan(0));
    expect(getComputedStyle(panel).animationName).toBe("none");
    expect(getComputedStyle(panel).transitionProperty).toBe("height");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(canvas.queryByText("控件基准为 8px，其余圆角按语义派生。")).toBeNull());
  },
};
