import type { Meta, StoryObj } from "@storybook/react-vite";
import { LumaPage } from "../LumaPage";

const meta = {
  title: "components/Luma",
  id: "ui-luma",
  component: LumaPage,
  tags: ["autodocs"],
  parameters: { docs: { page: () => <LumaPage /> } },
} satisfies Meta<typeof LumaPage>;
export default meta;
export const Overview: StoryObj<typeof meta> = { tags: ["!dev"] };
