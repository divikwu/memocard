import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "../components/textarea";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { TextareaExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/textarea",
  id: "ui-textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="textarea" /> } },
} satisfies Meta<typeof Textarea>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><TextareaExample /></LumaStoryFrame> };
