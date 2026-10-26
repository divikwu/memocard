import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/spacing",
  id: "ui-spacing",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "spacing" },
  parameters: { docs: { page: () => <TokenPage category="spacing" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
