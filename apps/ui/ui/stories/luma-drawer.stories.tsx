import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Drawer } from "../components/drawer";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { DrawerExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/drawer",
  id: "ui-drawer",
  component: Drawer,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="drawer" /> } },
} satisfies Meta<typeof Drawer>;
export default meta;
export const Example: StoryObj<typeof meta> = {
  render: () => <LumaStoryFrame><DrawerExample /></LumaStoryFrame>,
};
export const Mobile: StoryObj<typeof meta> = { ...Example, tags: ["mobile"], globals: { viewport: { value: "mobile", isRotated: false } } };
export const InteractionRegression: StoryObj<typeof meta> = {
  ...Example, tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = within(canvasElement).getByRole("button", { name: "打开抽屉" });
    await userEvent.click(trigger);
    const drawer = await page.findByRole("dialog", { name: "抽屉示例" });
    await expect(drawer).toHaveAttribute("data-swipe-direction", "down");
    await userEvent.click(within(drawer).getByRole("button", { name: "关闭抽屉" }));
    await waitFor(() => expect(page.queryByRole("dialog")).toBeNull());
    await expect(trigger).toHaveFocus();
  },
};
export const MobileInteractionRegression: StoryObj<typeof meta> = { ...InteractionRegression, tags: ["mobile", "!dev", "!autodocs"], globals: { viewport: { value: "mobile", isRotated: false } } };
