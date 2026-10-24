import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar } from "../components/calendar";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { CalendarExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/calendar",
  id: "ui-next-calendar",
  component: Calendar,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="calendar" /> } },
} satisfies Meta<typeof Calendar>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><CalendarExample /></LumaStoryFrame> };
