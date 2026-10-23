import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "../components/skeleton";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SkeletonExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/skeleton",
  id: "ui-next-skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="skeleton" /> } },
} satisfies Meta<typeof Skeleton>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SkeletonExample /></LumaStoryFrame> };
