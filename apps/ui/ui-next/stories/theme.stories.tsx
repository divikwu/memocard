import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/all tokens",
  id: "ui-next-theme",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "all" },
  parameters: {
    docs: { page: () => <TokenPage category="all" /> },
  },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Foundation: StoryObj<typeof meta> = { tags: ["!dev"] };
