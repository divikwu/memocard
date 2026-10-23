import type { Meta, StoryObj } from "@storybook/react-vite";
import { Accordion } from "../components/accordion";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { AccordionExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/accordion",
  id: "ui-next-accordion",
  component: Accordion,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="accordion" /> } },
} satisfies Meta<typeof Accordion>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><AccordionExample /></LumaStoryFrame> };
