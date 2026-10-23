import type { Meta, StoryObj } from "@storybook/react-vite";
import { Label } from "../components/label";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { LabelExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/label",
  id: "ui-next-label",
  component: Label,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="label" /> } },
} satisfies Meta<typeof Label>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><LabelExample /></LumaStoryFrame> };
