import type { Meta, StoryObj } from "@storybook/react-vite";
import { Combobox } from "../components/combobox";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { ComboboxExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/combobox",
  id: "ui-combobox",
  component: Combobox,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="combobox" /> } },
} satisfies Meta<typeof Combobox>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><ComboboxExample /></LumaStoryFrame> };
