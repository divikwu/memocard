import type { Meta, StoryObj } from "@storybook/react-vite";
import { FoundationReference } from "./foundation-reference";
import { desktopGlobals } from "../.storybook/viewports";

const meta = {
  title: "foundations/icons", component: FoundationReference, args: { category: "icons" }, globals: desktopGlobals,
  parameters: { docs: { page: () => <FoundationReference category="icons" /> } },
} satisfies Meta<typeof FoundationReference>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
