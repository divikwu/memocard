import type { Meta, StoryObj } from "@storybook/react-vite";
import { FoundationReference } from "./foundation-reference";
import { desktopGlobals } from "../.storybook/viewports";

const meta = {
  title: "foundations/shape", component: FoundationReference, args: { category: "shape" }, globals: desktopGlobals,
  parameters: { docs: { page: () => <FoundationReference category="shape" /> } },
} satisfies Meta<typeof FoundationReference>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
