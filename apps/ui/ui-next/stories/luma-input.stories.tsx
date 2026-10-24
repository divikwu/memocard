import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "../components/input";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { InputExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/input",
  id: "ui-next-input",
  component: Input,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="input" /> } },
} satisfies Meta<typeof Input>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><InputExample /></LumaStoryFrame> };
