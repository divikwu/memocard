import { useState, type ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookBrowserAssets } from "../../.storybook/bridge";
import { NotePreview } from "../business/NotePreview";
import { Button } from "../components/button";
import { usePreviewMode } from "../preview-mode";

const longMarkdown = `## 保留思考经过

正文中的 **重点**、*说明* 和 \`代码\` 使用新版阅读排版。

> 先记录，再逐步整理。

- [x] 收集灵感
- [ ] 回顾笔记

${Array.from({ length: 9 }, (_, index) => `### 第 ${index + 1} 次回顾\n\n把零散的想法放回上下文，保留思考经过，再决定下一步行动。`).join("\n\n")}

最后一段：全文已经展开。`;

function PreviewFrame({ children }: { children: React.ReactNode }) {
  const mode = usePreviewMode();
  return <main className="ui-next-theme mx-auto min-h-screen w-full max-w-3xl p-6 sb-unstyled" data-ui-theme={mode}>{children}</main>;
}

async function imageBlob() {
  const canvas = document.createElement("canvas");
  canvas.width = 480; canvas.height = 320;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#e5e5e5"; context.fillRect(0, 0, 480, 320);
  context.fillStyle = "#737373"; context.fillRect(40, 40, 400, 240);
  return await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
}

function CachedImageRemount(args: ComponentProps<typeof NotePreview>) {
  const [visible, setVisible] = useState(true);
  return <div className="space-y-4">
    <Button variant="outline" onClick={() => setVisible(value => !value)}>{visible ? "隐藏图片预览" : "重新显示图片预览"}</Button>
    {visible && <NotePreview {...args} />}
  </div>;
}

const meta = {
  title: "business/note preview",
  id: "ui-next-business-note-preview",
  component: NotePreview,
  args: { body: "", notePath: "notes/preview.md", onError: fn() },
  argTypes: { onError: { control: false } },
  decorators: [Story => <PreviewFrame><Story /></PreviewFrame>],
  parameters: { docs: { description: { component: "新版 Typeset 内容层复用原安全 Markdown、WikiLink、附件和数学解析。卡片摘要非交互，长正文保留展开/收起；图片与图表使用新版组件。示例仅使用内存附件。" } } },
} satisfies Meta<typeof NotePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "空正文",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "新内容" })).toBeVisible();
    await expect(canvas.getByText("还没有正文")).toBeVisible();
  },
};

export const Expandable: Story = {
  name: "阅读 · 展开与收起",
  args: { title: "每周回顾", body: longMarkdown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", { name: "展开全文" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    await expect(canvas.getByText("最后一段：全文已经展开。")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "收起全文" })).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByRole("button", { name: "收起全文" }));
    await expect(canvas.getByRole("button", { name: "展开全文" })).toHaveAttribute("aria-expanded", "false");
  },
};

export const CompactText: Story = {
  name: "卡片 · 文本与标签",
  args: { compact: true, showTitle: false, hiddenTags: ["工作", "设计"], body: `正文中的 #工作 标签保留。\n\n${Array.from({ length: 8 }, (_, index) => `第 ${index + 1} 条观察：卡片摘要按可用高度显示内容，让后续笔记容易浏览。`).join("\n\n")}\n\n#工作 #设计` },
  render: args => <section aria-label="卡片摘要容器" className="h-36 max-w-80"><NotePreview {...args} /></section>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("正文中的 #工作 标签保留。")).toBeVisible();
    await expect(canvas.queryByText("#工作 #设计")).not.toBeInTheDocument();
    await waitFor(() => expect(canvasElement.querySelector("[data-overflow=true]")).not.toBeNull());
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

export const CompactTable: Story = {
  name: "卡片 · 完整表格行裁切",
  args: { compact: true, showTitle: false, body: `| 阶段 | 内容 | 状态 |\n| --- | --- | --- |\n${Array.from({ length: 12 }, (_, index) => `| ${index + 1} | 回顾与整理笔记 | 待处理 |`).join("\n")}` },
  render: args => <section aria-label="表格摘要容器" className="h-40 max-w-80"><NotePreview {...args} /></section>,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(within(canvasElement).getByText("…")).toBeVisible());
    const clip = canvasElement.querySelector<HTMLElement>("[style*='max-height']")!;
    const bottom = clip.getBoundingClientRect().bottom;
    const rows = [...canvasElement.querySelectorAll("tr")];
    await expect(rows.every(row => row.getBoundingClientRect().top >= bottom - 1 || row.getBoundingClientRect().bottom <= bottom + 1)).toBe(true);
  },
};

export const RichContent: Story = {
  name: "WikiLink · 数学 · 图表 · 导入内容",
  args: { title: "关联与表达", body: '相关思路：[[相关笔记|继续阅读]]。\n\n$E=mc^2$\n\n<aside data-callout="blue" data-callout-icon="🧭"><p>提示：保留来源和上下文。</p></aside>\n\n```mermaid\ngraph TD\nA[捕捉]-->B[整理]\nB-->C[回顾]\n```\n\n<details><summary>更多说明</summary><p>保留完整的语义内容和安全清理。</p></details>\n\n| 日期 | 想法 |\n| --- | --- |\n| 今天 | 先记录，再整理 |' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "继续阅读" })).toBeVisible();
    await expect(canvas.getByRole("tablist", { name: "Mermaid 显示模式" })).toBeVisible();
    await waitFor(() => expect(canvas.getByRole("button", { name: "放大 Mermaid 图表" })).toBeVisible());
  },
};

export const LocalImage: Story = {
  name: "本地图片 · 大图与焦点恢复",
  args: { body: "![灵感卡片](../assets/note-preview.png)" },
  beforeEach: async () => setStorybookBrowserAssets({ "assets/note-preview.png": await imageBlob() }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "查看大图 灵感卡片" });
    await waitFor(() => expect(trigger).toHaveAttribute("data-image-state", "loaded"));
    await userEvent.click(trigger);
    const viewer = await page.findByRole("dialog", { name: "灵感卡片" });
    await waitFor(() => expect(within(viewer).getByRole("img", { name: "灵感卡片" })).toBeVisible());
    await userEvent.click(within(viewer).getByRole("button", { name: "关闭图片" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const CachedRemount: Story = {
  name: "本地图片 · 尺寸缓存与重新挂载",
  args: { body: "![灵感卡片](../assets/note-preview.png)" },
  beforeEach: async () => setStorybookBrowserAssets({ "assets/note-preview.png": await imageBlob() }),
  render: args => <CachedImageRemount {...args} />,
};

export const MissingImage: Story = {
  name: "缺失图片 · 可见错误",
  args: { body: "![缺失附件](../assets/missing.png)" },
  beforeEach: () => setStorybookBrowserAssets({}),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", { name: "查看大图 缺失附件" });
    await waitFor(() => expect(trigger).toHaveAttribute("data-image-state", "failed"));
    await expect(within(trigger).getByText("图片暂时无法读取")).toBeVisible();
  },
};
