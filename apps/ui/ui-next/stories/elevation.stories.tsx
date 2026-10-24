import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/elevation",
  id: "ui-next-elevation",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "elevation" },
  parameters: { docs: { page: () => <TokenPage category="elevation" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
