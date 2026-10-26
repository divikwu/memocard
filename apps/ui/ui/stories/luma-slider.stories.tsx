import type { Meta, StoryObj } from "@storybook/react-vite";
import { Slider } from "../components/slider";
import { ComponentDocs } from "../ComponentDocs";
import { componentDocsRenderer } from "../component-docs-renderer";
import { SliderExample } from "../AdditionalExamples";
import { LumaStoryFrame } from "../LumaPage";

const meta = {
  title: "components/slider",
  id: "ui-slider",
  component: Slider,
  tags: ["autodocs"],
  parameters: { controls: { disable: true }, docs: { renderer: componentDocsRenderer, page: () => <ComponentDocs component="slider" /> } },
} satisfies Meta<typeof Slider>;
export default meta;
export const Example: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><SliderExample /></LumaStoryFrame> };
export const Default: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><div className="grid w-full max-w-sm gap-4"><p className="text-sm">未设置 value 或 defaultValue，默认位于 min。</p><Slider aria-label="默认数值" /></div></LumaStoryFrame> };
export const Range: StoryObj<typeof meta> = { render: () => <LumaStoryFrame><div className="grid w-full max-w-sm gap-4"><p className="text-sm">初始范围：20–80，可分别使用键盘或拖动调整。</p><Slider defaultValue={[20, 80]} aria-label="数值范围" /></div></LumaStoryFrame> };
