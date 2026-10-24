import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "../components/card";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { CardExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/card",
  id: "ui-next-card",
  component: Card,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="card" /> } },
} satisfies Meta<typeof Card>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><CardExample /></LumaStoryFrame> };
