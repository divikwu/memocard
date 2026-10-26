import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/colors",
  id: "ui-colors",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "colors" },
  parameters: { docs: { page: () => <TokenPage category="colors" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
