import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../components/checkbox";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { CheckboxExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/checkbox",
  id: "ui-checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="checkbox" /> } },
} satisfies Meta<typeof Checkbox>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><CheckboxExample /></LumaStoryFrame> };
