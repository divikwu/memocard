import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import type { NoteProperties as Properties, PropertyChange, PropertyLayout } from "@memocard/contracts";
import { setStorybookRequestHandler } from "../../test-support/bridge";
import { editorNote } from "../../test-support/editor-note";
import { NoteProperties } from "../business/NoteProperties";
import TagColorStyles from "../business/TagColorStyles";
import { TagColorProvider } from "../../src/TagColorProvider";
import { usePreviewMode } from "../preview-mode";

const initial: Properties = {
  contentHash: editorNote.contentHash, writable: true,
  tagProperty: { name: "tags", type: "list", value: ["设计", "共享"], editable: true },
  properties: [
    { name: "摘要", type: "text", value: "较长的属性值会自然换行，属性名称与内容首行对齐。\n编辑、收起和重新展开后，正文及属性值均保持原样。", editable: true },
    { name: "得分", type: "number", value: "8.5", editable: true },
    { name: "领域", type: "multiSelect", value: ["设计"], options: [{ name: "设计", color: "blue" }, { name: "开发", color: "green" }], editable: true },
    { name: "日期", type: "date", value: "2026-10-23", editable: true },
    { name: "已验证", type: "checkbox", value: true, editable: true },
    { name: "封面", type: "image", value: "", editable: true },
  ],
};
function PropertyExample({ canEdit, busy, onApply, initialProperties = initial }: { canEdit: boolean; busy: boolean; onApply: (change: PropertyChange) => void; initialProperties?: Properties }) {
  const mode = usePreviewMode();
  const [properties, setProperties] = useState(() => structuredClone(initialProperties));
  async function apply(change: PropertyChange) {
    onApply(change);
    setProperties(current => {
      if (change.name === "tags") return { ...current, tagProperty: { ...current.tagProperty!, value: change.value ?? [] } };
      const previous = current.properties.find(item => item.name === change.name);
      const property = { ...previous, name: change.renameTo ?? change.name, type: change.type ?? previous?.type ?? "text", value: change.value ?? previous?.value ?? "", editable: true, options: change.options ?? previous?.options };
      return { ...current, properties: change.remove ? current.properties.filter(item => item.name !== change.name) : previous ? current.properties.map(item => item.name === change.name ? property : item) : [...current.properties, property] };
    });
  }
  return <main className="ui-theme mx-auto min-h-dvh max-w-3xl space-y-6 px-4 py-6 md:px-6 sb-unstyled" data-ui-theme={mode}>
    <h1 className="type-heading-1">笔记属性</h1>
    <p className="text-sm text-secondary">标签、文本、数字、选择、日期、复选框和图片共用原业务逻辑。此示例仅修改内存数据。</p>
    <TagColorProvider vaultId="ui-properties-story"><TagColorStyles /><div className="-mx-2"><NoteProperties note={editorNote} savedProperties={properties} tags={["共享", "正文/分类"]} relativePath={editorNote.relativePath} canEdit={canEdit} canRead busy={busy} onApply={apply} /></div></TagColorProvider>
  </main>;
}
const meta = {
  title: "business/note properties", id: "ui-business-note-properties", component: PropertyExample,
  args: { canEdit: true, busy: false, onApply: fn() }, argTypes: { onApply: { control: false }, initialProperties: { control: false } },
  parameters: { layout: "fullscreen" },
  beforeEach: () => {
    let revision = 0;
    let layout: PropertyLayout = {order: [], visibility: {}, contentHash: "0".repeat(64)};
    return setStorybookRequestHandler((operation, params) => {
      if (operation === "getStatus") return {vaultId: "ui-properties-story", capabilities: ["getPropertyLayout", "setPropertyLayout"]};
      if (operation === "getPropertyLayout") return structuredClone(layout);
      if (operation === "setPropertyLayout") {
        if (params.baseHash !== layout.contentHash) throw new Error("属性布局已更新，请重试。");
        layout = {order: [...params.order as string[]], visibility: {...params.visibility as PropertyLayout["visibility"]}, contentHash: (++revision).toString(16).padStart(64, "0")};
        return structuredClone(layout);
      }
      if (operation === "getPropertyLabels") return { labels: {}, contentHash: "story-labels" };
      if (operation === "renamePropertyLabel") return { labels: { [String(params.key)]: String(params.label) }, contentHash: "story-labels-renamed" };
      if (operation === "listTags") return { tags: [{ name: "设计" }, { name: "共享" }, { name: "开发" }] };
      if (operation === "pickImage") return null;
      throw new Error(`No property fixture operation: ${operation}`);
    });
  },
} satisfies Meta<typeof PropertyExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};
export const LayoutStress: Story = {
  name: "布局边界 · 长属性与多行标签",
  args: { initialProperties: {
    ...initial,
    tagProperty: {name: "tags", type: "list", value: [...Array.from({length: 14}, (_, index) => `project/stress-${String(index + 1).padStart(2, "0")}`), `oversized_${"abcdefghij".repeat(16)}`], editable: true},
    properties: [
      {name: "超长属性名称".repeat(8), type: "text", value: `第一行：核对属性名称与内容首行的对齐。\n第二行：内容自然增高，不覆盖下一行。\n${"UnbrokenValueToken".repeat(16)}`, editable: true},
      {name: "多选标签", type: "multiSelect", value: ["设计与产品", "较长的多选选项用于检查换行", "交互与无障碍", "工程实现"], options: [{name: "设计与产品", color: "blue"}, {name: "较长的多选选项用于检查换行", color: "purple"}, {name: "交互与无障碍", color: "green"}, {name: "工程实现", color: "orange"}], editable: true},
      ...initial.properties.slice(1),
    ],
  } },
};
export const EditableRegression: Story = { ...Editable, tags: ["!dev", "!autodocs"], play: async ({ canvasElement, args }) => {
  const canvas = within(canvasElement), body = within(canvasElement.ownerDocument.body);
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
export const Mobile: Story = { tags: ["mobile"], globals: { viewport: { value: "mobile", isRotated: false } } };
