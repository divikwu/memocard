import type { Meta, StoryObj } from "@storybook/react-vite";
import { PalettePage } from "../PalettePage";

const meta = {
  title: "foundations/palette",
  id: "ui-palette",
  component: PalettePage,
  tags: ["autodocs"],
  parameters: { docs: { page: () => <PalettePage /> } },
} satisfies Meta<typeof PalettePage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
