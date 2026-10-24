import type { Meta, StoryObj } from "@storybook/react-vite";
import { Field } from "../components/field";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { FieldExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/field",
  id: "ui-next-field",
  component: Field,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="field" /> } },
} satisfies Meta<typeof Field>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><FieldExample /></LumaStoryFrame> };
