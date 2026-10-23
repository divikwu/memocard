import type { Meta, StoryObj } from "@storybook/react-vite";
import { NativeSelect } from "../components/native-select";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { NativeSelectExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/native-select",
  id: "ui-next-native-select",
  component: NativeSelect,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="native-select" /> } },
} satisfies Meta<typeof NativeSelect>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><NativeSelectExample /></LumaStoryFrame> };
