import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/typography",
  id: "ui-typography",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "typography" },
  parameters: { docs: { page: () => <TokenPage category="typography" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
