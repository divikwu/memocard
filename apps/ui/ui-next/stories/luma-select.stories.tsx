import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "../components/select";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SelectExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/select",
  id: "ui-next-select",
  component: Select,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="select" /> } },
} satisfies Meta<typeof Select>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SelectExample /></LumaStoryFrame> };
