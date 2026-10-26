import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup } from "../components/radio-group";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { RadioGroupExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/radio-group",
  id: "ui-radio-group",
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="radio-group" /> } },
} satisfies Meta<typeof RadioGroup>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><RadioGroupExample /></LumaStoryFrame> };
