import type { Meta, StoryObj } from "@storybook/react-vite";
import { Item } from "../components/item";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { ItemExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/item",
  id: "ui-next-item",
  component: Item,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="item" /> } },
} satisfies Meta<typeof Item>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><ItemExample /></LumaStoryFrame> };
