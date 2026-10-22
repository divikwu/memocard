import type { Meta, StoryObj } from "@storybook/react-vite";
import { FoundationReference } from "./foundation-reference";
import { desktopGlobals } from "../.storybook/viewports";

const meta = {
  title: "foundations/sizing", component: FoundationReference, args: { category: "sizing" }, globals: desktopGlobals,
  parameters: { docs: { page: () => <FoundationReference category="sizing" /> } },
} satisfies Meta<typeof FoundationReference>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
