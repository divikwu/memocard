import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookBrowserAssets } from "../.storybook/bridge";
import { desktopGlobals } from "../.storybook/viewports";
import { NotePreview } from "../src/NotePreview";
import { captureImageBlob } from "./quick-capture-fixture";

const longMarkdown = `## 让想法保持可读

正文中的 **重点**、*说明* 和 \`代码\` 使用生产 Markdown 排版。

> 先记录，再逐步整理。

- [x] 收集灵感
- [ ] 回顾笔记

${Array.from({ length: 10 }, (_, index) => `### 第 ${index + 1} 次回顾\n\n把零散的想法放回上下文，保留思考经过，再决定下一步行动。`).join("\n\n")}

最后一段：全文已经展开。`;

const compactText = `正文中的 #工作 标签保留。

${Array.from({ length: 8 }, (_, index) => `第 ${index + 1} 条观察：卡片摘要按可用高度显示内容，让后续笔记保持容易浏览。`).join("\n\n")}

#工作 #设计`;

const tableMarkdown = `| 阶段 | 内容 | 状态 |
| --- | --- | --- |
${Array.from({ length: 12 }, (_, index) => `| ${index + 1} | 回顾与整理笔记 | 待处理 |`).join("\n")}`;

const meta = {
  title: "business/note preview",
  component: NotePreview,
  globals: desktopGlobals,
  args: { body: "", notePath: "notes/preview.md", onError: fn() },
  argTypes: { onError: { control: false } },
  decorators: [Story => <main className="mx-auto w-full max-w-2xl p-4"><Story /></main>],
  parameters: {
    docs: { story: { height: "560px" }, description: { component: "生产 NotePreview 与 Markdown 的独立状态。卡片摘要限制由调用方容器提供；全文展开、表格滚动、图片大图及关闭后的焦点恢复均使用现有交互。图片只读取示例内存中的 Blob，不连接真实笔记库。iOS 使用同一 Web 内容，不额外复制 SwiftUI 视图。" } },
  },
} satisfies Meta<typeof NotePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

async function expandAndCollapse(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const expand = await canvas.findByRole("button", { name: "展开全文" });
  const finalParagraph = canvas.getByText("最后一段：全文已经展开。");
  const collapsed = finalParagraph.closest(".typeset-summary")!;
  const collapsedHeight = collapsed.getBoundingClientRect().height;
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(expand);
  const collapse = canvas.getByRole("button", { name: "收起全文" });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await expect(finalParagraph).toBeVisible();
  await expect(finalParagraph.closest(".typeset-content")!.getBoundingClientRect().height).toBeGreaterThan(collapsedHeight);
  await userEvent.click(collapse);
  await expect(canvas.getByRole("button", { name: "展开全文" })).toHaveAttribute("aria-expanded", "false");
}

export const Empty: Story = {
  name: "空正文 · 默认提示",
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "新内容" })).toBeVisible();
    await expect(canvas.getByText("还没有正文")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "展开全文" })).not.toBeInTheDocument();
    await expect(args.onError).not.toHaveBeenCalled();
  },
};

export const ExpandableMarkdown: Story = {
  name: "Markdown · 展开与收起",
  args: { title: "每周回顾", body: longMarkdown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "每周回顾" })).toBeVisible();
    await expect(canvas.getByText("重点").tagName).toBe("STRONG");
    await expect(canvas.getAllByRole("checkbox")).toHaveLength(2);
    await expandAndCollapse(canvasElement);
  },
};

export const CompactText: Story = {
  name: "卡片摘要 · 文本裁切与标签去重",
  args: { body: compactText, compact: true, showTitle: false, hiddenTags: ["工作", "设计"] },
  render: args => <section aria-label="卡片摘要容器" className="h-36 w-full max-w-80"><NotePreview {...args} /></section>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByRole("region", { name: "卡片摘要容器" });
    await expect(canvas.getByText("正文中的 #工作 标签保留。")).toBeVisible();
    await expect(canvas.queryByText("#工作 #设计")).not.toBeInTheDocument();
    await waitFor(() => expect(frame.querySelector("[data-overflow=true]")).not.toBeNull());
    const markdown = frame.querySelector<HTMLElement>(".markdown")!;
    await expect(markdown.getBoundingClientRect().bottom).toBeLessThanOrEqual(frame.getBoundingClientRect().bottom + 1);
    await expect(canvas.queryByRole("button", { name: "展开全文" })).not.toBeInTheDocument();
  },
};

export const CompactTable: Story = {
  name: "卡片摘要 · 完整表格行裁切",
  args: { body: tableMarkdown, compact: true, showTitle: false },
  render: args => <section aria-label="表格摘要容器" className="h-40 w-full max-w-80"><NotePreview {...args} /></section>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByRole("region", { name: "表格摘要容器" });
    await waitFor(() => expect(canvas.getByText("…")).toBeVisible());
    const clip = frame.querySelector<HTMLElement>("[style*='max-height']")!;
    const bottom = clip.getBoundingClientRect().bottom;
    const rows = [...frame.querySelectorAll("tr")];
    await expect(rows.some(row => row.getBoundingClientRect().bottom <= bottom + 1)).toBe(true);
    await expect(rows.some(row => row.getBoundingClientRect().top > bottom)).toBe(true);
    await expect(rows.every(row => row.getBoundingClientRect().top >= bottom - 1 || row.getBoundingClientRect().bottom <= bottom + 1)).toBe(true);
    await expect(clip.getBoundingClientRect().height).toBeLessThan(frame.getBoundingClientRect().height);
  },
};

export const ImageViewer: Story = {
  name: "本地图片 · 大图与返回焦点",
  args: { body: "![灵感卡片](../assets/note-preview.png)" },
  beforeEach: async () => setStorybookBrowserAssets({ "assets/note-preview.png": await captureImageBlob() }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "查看大图 灵感卡片" });
    await waitFor(() => expect(trigger).toHaveAttribute("data-image-state", "loaded"));
    await userEvent.click(trigger);
    const viewer = await page.findByRole("dialog", { name: "灵感卡片" });
    await waitFor(() => expect(within(viewer).getByRole("img", { name: "灵感卡片" })).toBeVisible());
    await userEvent.click(within(viewer).getByRole("button", { name: "关闭图片" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(page.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(args.onError).not.toHaveBeenCalled();
  },
};

export const MissingImage: Story = {
  name: "图片缺失 · 可见错误",
  args: { body: "![缺失附件](../assets/missing-preview.png)" },
  beforeEach: () => setStorybookBrowserAssets({}),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "查看大图 缺失附件" });
    await waitFor(() => expect(trigger).toHaveAttribute("data-image-state", "failed"));
    await expect(within(trigger).getByText("图片暂时无法读取")).toBeVisible();
    await userEvent.click(trigger);
    const viewer = await page.findByRole("dialog", { name: "缺失附件" });
    await expect(await within(viewer).findByRole("alert")).toHaveTextContent("图片暂时无法读取，请检查文件是否可用。");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const MobileMarkdown: Story = {
  name: "H5 · 全文与横向表格",
  args: { body: `${longMarkdown}\n\n| 字段一的完整名称 | 字段二的完整名称 | 字段三的完整名称 | 字段四的完整名称 |\n| --- | --- | --- | --- |\n| 需要保留的长内容 | 跨平台默认样式 | 表格可以横向滚动 | 页面继续垂直浏览 |` },
  tags: ["mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  parameters: { docs: { story: { height: "844px" } } },
  play: async ({ canvasElement }) => {
    await expandAndCollapse(canvasElement);
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "展开全文" }));
    const table = canvas.getByRole("region", { name: "表格，可横向滚动" });
    await expect(table.scrollWidth).toBeGreaterThan(table.clientWidth);
    await userEvent.click(table);
    await expect(table).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(table.scrollLeft).toBeGreaterThan(0);
    await userEvent.keyboard("{ArrowLeft}");
    await expect(table.scrollLeft).toBe(0);
    const document = canvasElement.ownerDocument;
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.defaultView!.innerWidth);
  },
};
