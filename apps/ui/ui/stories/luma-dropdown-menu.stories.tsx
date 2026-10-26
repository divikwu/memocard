import type { Meta, StoryObj } from "@storybook/react-vite";
import { DropdownMenu } from "../components/dropdown-menu";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { DropdownMenuExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/dropdown-menu",
  id: "ui-dropdown-menu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="dropdown-menu" /> } },
} satisfies Meta<typeof DropdownMenu>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><DropdownMenuExample /></LumaStoryFrame> };
