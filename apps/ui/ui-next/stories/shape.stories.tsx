import type { Meta, StoryObj } from "@storybook/react-vite";
import { TokenPage } from "../TokenPage";

const meta = {
  title: "foundations/shape",
  id: "ui-next-shape",
  component: TokenPage,
  tags: ["autodocs"],
  args: { category: "shape" },
  parameters: { docs: { page: () => <TokenPage category="shape" /> } },
} satisfies Meta<typeof TokenPage>;
export default meta;
export const Reference: StoryObj<typeof meta> = { tags: ["!dev"] };
