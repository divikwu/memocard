import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { ChartExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/chart",
  id: "ui-chart",
  component: ChartExample,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="chart" /> } },
} satisfies Meta<typeof ChartExample>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><ChartExample /></LumaStoryFrame> };
