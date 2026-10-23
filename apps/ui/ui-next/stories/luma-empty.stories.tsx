import type { Meta, StoryObj } from "@storybook/react-vite";
import { Empty } from "../components/empty";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { EmptyExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/empty",
  id: "ui-next-empty",
  component: Empty,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="empty" /> } },
} satisfies Meta<typeof Empty>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><EmptyExample /></LumaStoryFrame> };
