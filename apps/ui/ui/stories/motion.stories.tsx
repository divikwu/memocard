import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/motion",
  id: "ui-motion",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "motion" },
  parameters: { docs: { page: () => <TokenPage category="motion" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
