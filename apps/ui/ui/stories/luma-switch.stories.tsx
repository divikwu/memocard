import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "../components/switch";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SwitchExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/switch",
  id: "ui-switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="switch" /> } },
} satisfies Meta<typeof Switch>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SwitchExample /></LumaStoryFrame> };
