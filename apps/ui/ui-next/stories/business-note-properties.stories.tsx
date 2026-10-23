import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { NoteProperties as Properties, PropertyChange } from "@memocard/contracts";
import { setStorybookRequestHandler } from "../../.storybook/bridge";
import { editorNote } from "../../stories/editor.fixture";
import { NoteProperties } from "../business/NoteProperties";
import TagColorStyles from "../business/TagColorStyles";
import { TagColorProvider } from "../../src/TagColorProvider";
import { usePreviewMode } from "../preview-mode";

const initial: Properties = {
  contentHash: editorNote.contentHash, writable: true,
  tagProperty: { name: "tags", type: "list", value: ["设计", "共享"], editable: true },
  properties: [
    { name: "摘要", type: "text", value: "保留属性写入与撤销语义。", editable: true },
    { name: "得分", type: "number", value: "8.5", editable: true },
    { name: "领域", type: "multiSelect", value: ["设计"], options: [{ name: "设计", color: "blue" }, { name: "开发", color: "green" }], editable: true },
    { name: "日期", type: "date", value: "2026-10-23", editable: true },
    { name: "已验证", type: "checkbox", value: true, editable: true },
    { name: "封面", type: "image", value: "", editable: true },
  ],
};
function PropertyExample({ canEdit, busy, onApply }: { canEdit: boolean; busy: boolean; onApply: (change: PropertyChange) => void }) {
  const mode = usePreviewMode();
  const [properties, setProperties] = useState(() => structuredClone(initial));
  async function apply(change: PropertyChange) {
    onApply(change);
    setProperties(current => {
      if (change.name === "tags") return { ...current, tagProperty: { ...current.tagProperty!, value: change.value ?? [] } };
      const previous = current.properties.find(item => item.name === change.name);
      const property = { ...previous, name: change.renameTo ?? change.name, type: change.type ?? previous?.type ?? "text", value: change.value ?? previous?.value ?? "", editable: true, options: change.options ?? previous?.options };
      return { ...current, properties: change.remove ? current.properties.filter(item => item.name !== change.name) : previous ? current.properties.map(item => item.name === change.name ? property : item) : [...current.properties, property] };
    });
  }
  return <main className="ui-next-theme mx-auto min-h-dvh max-w-3xl space-y-6 p-6 sb-unstyled" data-ui-theme={mode}>
    <h1 className="type-heading-1">笔记属性</h1>
    <p className="text-sm text-secondary">标签、文本、数字、选择、日期、复选框和图片共用原业务逻辑。此示例仅修改内存数据。</p>
    <TagColorProvider vaultId="ui-next-properties-story"><TagColorStyles /><NoteProperties note={editorNote} savedProperties={properties} tags={["共享", "正文/分类"]} relativePath={editorNote.relativePath} canEdit={canEdit} canRead busy={busy} onApply={apply} /></TagColorProvider>
  </main>;
}
const meta = {
  title: "business/note properties", id: "ui-next-business-note-properties", component: PropertyExample,
  args: { canEdit: true, busy: false, onApply: fn() }, argTypes: { onApply: { control: false } },
  parameters: { layout: "fullscreen" },
  beforeEach: () => setStorybookRequestHandler((operation, params) => {
    if (operation === "getPropertyLabels") return { labels: {}, contentHash: "story-labels" };
    if (operation === "renamePropertyLabel") return { labels: { [String(params.key)]: String(params.label) }, contentHash: "story-labels-renamed" };
    if (operation === "listTags") return { tags: [{ name: "设计" }, { name: "共享" }, { name: "开发" }] };
    if (operation === "pickImage") return null;
    throw new Error(`No property fixture operation: ${operation}`);
  }),
} satisfies Meta<typeof PropertyExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = { play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
  await userEvent.click(await canvas.findByRole("button", { name: /^属性$/ }));
  await expect(canvas.getByRole("checkbox", { name: "切换属性 已验证" })).toBeChecked();
  await userEvent.click(canvas.getByRole("button", { name: "编辑属性 领域" }));
  await userEvent.click(await body.findByRole("button", { name: "管理选项 设计" }));
  await expect(await body.findByRole("menuitemradio", { name: "蓝色" })).toBeChecked();
  await userEvent.keyboard("{Escape}{Escape}");
  await userEvent.click(canvas.getByRole("checkbox", { name: "切换属性 已验证" }));
  await expect(args.onApply).toHaveBeenCalledWith({ name: "已验证", type: "checkbox", value: false });
} };
export const ReadOnly: Story = { args: { canEdit: false } };
export const Updating: Story = { args: { busy: true } };
export const Mobile: Story = { globals: { viewport: { value: "mobile1", isRotated: false } } };
