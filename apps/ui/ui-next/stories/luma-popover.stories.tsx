import type { Meta, StoryObj } from "@storybook/react-vite";
import { Popover } from "../components/popover";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { PopoverExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/popover",
  id: "ui-next-popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="popover" /> } },
} satisfies Meta<typeof Popover>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><PopoverExample /></LumaStoryFrame> };
