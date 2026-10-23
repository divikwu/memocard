import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "../components/separator";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SeparatorExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/separator",
  id: "ui-next-separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="separator" /> } },
} satisfies Meta<typeof Separator>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SeparatorExample /></LumaStoryFrame> };
