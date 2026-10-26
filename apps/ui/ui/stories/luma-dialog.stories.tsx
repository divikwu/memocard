import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog } from "../components/dialog";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { DialogExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/dialog",
  id: "ui-dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="dialog" /> } },
} satisfies Meta<typeof Dialog>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><DialogExample /></LumaStoryFrame> };
