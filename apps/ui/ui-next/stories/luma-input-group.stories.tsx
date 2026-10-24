import type { Meta, StoryObj } from "@storybook/react-vite";
import { InputGroup } from "../components/input-group";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { InputGroupExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/input-group",
  id: "ui-next-input-group",
  component: InputGroup,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="input-group" /> } },
} satisfies Meta<typeof InputGroup>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><InputGroupExample /></LumaStoryFrame> };
