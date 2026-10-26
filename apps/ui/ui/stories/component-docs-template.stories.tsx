import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComponentDocsTemplatePage, TemplateExampleForm } from "../ComponentDocsTemplatePage";
import { componentDocsRenderer } from "../component-docs-renderer";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  id: "ui-component-docs-template",
  title: "文档模板/通用组件文档",
  component: TemplateExampleForm,
  tags: ["autodocs"],
  parameters: {
    controls: { disable: true },
    docs: { renderer: componentDocsRenderer, page: ComponentDocsTemplatePage },
  },
} satisfies Meta<typeof TemplateExampleForm>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><TemplateExampleForm /></LumaStoryFrame> };
