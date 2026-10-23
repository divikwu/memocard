import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { ProgressExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/progress",
  id: "ui-next-progress",
  component: ProgressExample,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="progress" /> } },
} satisfies Meta<typeof ProgressExample>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><ProgressExample /></LumaStoryFrame> };
