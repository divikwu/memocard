import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sheet } from "../components/sheet";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SheetExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/sheet",
  id: "ui-sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="sheet" /> } },
} satisfies Meta<typeof Sheet>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SheetExample /></LumaStoryFrame> };
