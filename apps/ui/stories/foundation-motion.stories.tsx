import type { Meta, StoryObj } from "@storybook/react-vite";
import { FoundationReference } from "./foundation-reference";
import { desktopGlobals } from "../.storybook/viewports";
import { MotionExample, inspectReducedMotion } from "./foundation-motion.example";

const meta = {
  title: "foundations/motion", component: FoundationReference, args: { category: "motion" }, globals: desktopGlobals,
  parameters: { docs: { page: () => <FoundationReference category="motion" /> } },
} satisfies Meta<typeof FoundationReference>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
export const ReducedMotion: StoryObj<typeof meta> = { tags: ["!dev"], render: () => <MotionExample />, play: inspectReducedMotion };
