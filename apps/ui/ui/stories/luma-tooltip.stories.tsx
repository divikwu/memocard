import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tooltip } from "../components/tooltip";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { TooltipExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/tooltip",
  id: "ui-tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="tooltip" /> } },
} satisfies Meta<typeof Tooltip>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><TooltipExample /></LumaStoryFrame> };
