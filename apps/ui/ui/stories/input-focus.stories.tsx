import type { Meta, StoryObj } from "@storybook/react-vite";
import { InputFocusFixture } from "../../test-support/input-focus-fixture";

const meta = {
  title: "foundations/input focus", id: "ui-input-focus",
  component: InputFocusFixture,
  args: { mode: "light" },
  parameters: { layout: "fullscreen", controls: { disable: true } },
} satisfies Meta<typeof InputFocusFixture>;
export default meta;
export const Components: StoryObj<typeof meta> = {
  render: () => <main className="p-6"><h1 className="mb-2 text-2xl">输入焦点</h1><p className="mb-6 text-sm text-secondary">鼠标或触控不显示焦点框；Tab 导航显示控件焦点框，正文编辑以光标和选区提示位置。输入文字、换行和移动光标保持当前输入方式，校验错误单独显示。</p><div className="grid gap-6 md:grid-cols-2"><InputFocusFixture mode="light" /><InputFocusFixture mode="dark" /></div></main>,
};
