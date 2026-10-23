import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "../components/spinner";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SpinnerExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/spinner",
  id: "ui-next-spinner",
  component: Spinner,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="spinner" /> } },
} satisfies Meta<typeof Spinner>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SpinnerExample /></LumaStoryFrame> };
