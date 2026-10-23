import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumb } from "../components/breadcrumb";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { BreadcrumbExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/breadcrumb",
  id: "ui-next-breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="breadcrumb" /> } },
} satisfies Meta<typeof Breadcrumb>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><BreadcrumbExample /></LumaStoryFrame> };
