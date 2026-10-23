import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "../components/tabs";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { TabsExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/tabs",
  id: "ui-next-tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="tabs" /> } },
} satisfies Meta<typeof Tabs>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><TabsExample /></LumaStoryFrame> };
