import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToggleGroup } from "../components/toggle-group";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { ToggleGroupExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/toggle-group",
  id: "ui-next-toggle-group",
  component: ToggleGroup,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="toggle-group" /> } },
} satisfies Meta<typeof ToggleGroup>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><ToggleGroupExample /></LumaStoryFrame> };
