import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../components/button";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { ButtonExample, LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/button",
  id: "ui-button",
  component: Button,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="button" /> } },
} satisfies Meta<typeof Button>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><ButtonExample /></LumaStoryFrame> };
