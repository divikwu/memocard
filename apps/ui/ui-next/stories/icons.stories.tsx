import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/icons",
  id: "ui-next-icons",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "icons" },
  parameters: { docs: { page: () => <TokenPage category="icons" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
