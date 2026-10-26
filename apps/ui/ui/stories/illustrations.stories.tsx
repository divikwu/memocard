import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/illustrations",
  id: "ui-illustrations",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "illustrations" },
  parameters: { docs: { page: () => <TokenPage category="illustrations" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
