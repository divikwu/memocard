import type { Meta, StoryObj } from "@storybook/react-vite";
import { Table } from "../components/table";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { TableExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/table",
  id: "ui-next-table",
  component: Table,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="table" /> } },
} satisfies Meta<typeof Table>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><TableExample /></LumaStoryFrame> };
