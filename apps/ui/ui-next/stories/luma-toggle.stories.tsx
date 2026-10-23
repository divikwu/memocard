import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toggle } from "../components/toggle";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { ToggleExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/toggle",
  id: "ui-next-toggle",
  component: Toggle,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="toggle" /> } },
} satisfies Meta<typeof Toggle>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><ToggleExample /></LumaStoryFrame> };
