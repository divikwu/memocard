import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "../components/badge";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { BadgeExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/badge",
  id: "ui-next-badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="badge" /> } },
} satisfies Meta<typeof Badge>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><BadgeExample /></LumaStoryFrame> };
