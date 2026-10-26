import type { Meta, StoryObj } from "@storybook/react-vite";
import { TypesetPage, TypesetExample } from "../TypesetPage";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "foundations/typeset",
  id: "ui-typeset",
  component: TypesetPage,
  tags: ["autodocs"],
  parameters: { docs: { page: () => <TypesetPage /> } },
} satisfies Meta<typeof TypesetPage>;
export default meta;
export const Content: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><TypesetExample /></LumaStoryFrame> };
