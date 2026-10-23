import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sidebar } from "../components/sidebar";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SidebarExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/sidebar",
  id: "ui-next-sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="sidebar" /> } },
} satisfies Meta<typeof Sidebar>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SidebarExample /></LumaStoryFrame> };
