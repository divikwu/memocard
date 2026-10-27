import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Note } from "@memocard/contracts";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookBrowserAssets, setStorybookRequestHandler } from "../../test-support/bridge";
import { QuickCapture, type QuickCaptureHandle, type QuickCaptureMemory, type QuickCaptureProps } from "../business/QuickCapture";
import { usePreviewMode } from "../preview-mode";
import { TagColorProvider } from "../../src/TagColorProvider";
import TagColorStyles from "../business/TagColorStyles";

function CaptureExample(args: QuickCaptureProps) {
  const handle = useRef<QuickCaptureHandle | null>(null);
  const memory = useRef<QuickCaptureMemory | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [continued, setContinued] = useState("");
  const mode = usePreviewMode();
  return <main className="ui-theme min-h-dvh p-6 sb-unstyled" data-ui-theme={mode}><div className="mx-auto max-w-2xl space-y-6"><div><h1 className="font-heading text-2xl">快速记录</h1><p className="mt-2 text-sm text-secondary">记录文字、内联标签和图片。示例只保存到内存；手机宽度下本机保护仍沿用原草稿契约。</p></div><QuickCapture {...args} handle={handle} memory={memory} onRecorded={note => { args.onRecorded(note); setSaved(previous => [...previous, note.body]); }} onContinue={args.onContinue ? draft => { args.onContinue?.(draft); setContinued(draft.body); } : undefined} />{saved.length > 0 && <section aria-label="已保存记录" className="space-y-2"><h2 className="font-heading text-lg">已记录</h2>{saved.map((body, index) => <p key={index} className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm">{body}</p>)}</section>}{continued && <output aria-label="已切换为页面" className="block whitespace-pre-wrap text-sm">{continued}</output>}</div></main>;
}

async function fixtureImage() {
  const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 200;
  const context = canvas.getContext("2d")!; context.fillStyle = "#e5e5e5"; context.fillRect(0, 0, 320, 200); context.fillStyle = "#737373"; context.fillRect(24, 24, 272, 152);
  return new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
}

const meta = {
  title: "business/quick capture", id: "ui-business-quick-capture", component: CaptureExample,
  args: { vaultId: "ui-capture-story", rootNotes: true, tags: ["工作", "生活", "项目/MemoCard"], disabled: false, canImage: true, handle: { current: null }, onRecorded: fn(), onContinue: fn(), draftCount: 2, onOpenDrafts: fn() },
  parameters: { layout: "fullscreen", docs: { description: { component: "使用共享快速记录控制器、Markdown 文本 schema、撤销/重做与标签建议逻辑。输入、菜单、图片大图和 H5 底部抽屉使用当前组件与 token；失败时保持内容、附件和同一笔记 ID。" } } },
  beforeEach: async ({ args, parameters }) => {
    // H5 restores this vault's local draft; each example starts empty and restores prior storage on exit.
    const draftKey = `memocard:quick-capture:v1:${encodeURIComponent(args.vaultId)}`;
    const previousDraft = localStorage.getItem(draftKey);
    localStorage.removeItem(draftKey);
    const clearAssets = setStorybookBrowserAssets({ "assets/capture.png": await fixtureImage() });
    const clearRequest = setStorybookRequestHandler(async (operation, params) => {
      if (operation === "pickImage") return { relativePath: "assets/capture.png", markdownPath: "assets/capture.png", notePath: params.notePath };
      if (operation === "saveDraft") return { ...params, draftKey: params.id, revision: "story-version" };
      if (operation === "saveNote") {
        if (parameters.captureFailure) throw new Error("示例保存失败；输入和图片仍保留，可重试。");
        return { id: params.id, title: "快速记录", body: params.body, tags: params.tags, createdAt: "2026-10-23T00:00:00Z", updatedAt: "2026-10-23T00:00:00Z", contentHash: "story-saved", relativePath: params.relativePath, sourceUrl: `memocard://note/${params.id}` } as Note;
      }
      throw new Error(`示例不支持操作：${operation}`);
    });
    return () => {
      clearRequest(); clearAssets();
      if (previousDraft === null) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, previousDraft);
    };
  },
} satisfies Meta<typeof CaptureExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const InlineRegression: Story = {
  ...Inline,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole("textbox", { name: "快速输入内容" });
    await expect(field).toHaveTextContent("");
    await userEvent.type(field, "把想到的事情记下来 #工作");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "记录" }));
    await waitFor(() => expect(args.onRecorded).toHaveBeenCalledOnce());
    await expect(field).toHaveTextContent("");
    await expect(canvas.getByRole("region", { name: "已保存记录" })).toHaveTextContent("把想到的事情记下来 #工作");
  },
};
export const Dark: Story = { globals: { theme: "dark" } };
export const Disabled: Story = { args: { disabled: true } };
export const SaveFailure: Story = {
  parameters: { captureFailure: true },
};

export const SaveFailureRegression: Story = {
  ...SaveFailure,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = await canvas.findByRole("textbox", { name: "快速输入内容" });
    await expect(field).toHaveTextContent("");
    await userEvent.type(field, "这条记录会保留");
    await userEvent.click(canvas.getByRole("button", { name: "记录" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("示例保存失败");
    await expect(field).toHaveTextContent("这条记录会保留");
  },
};
export const Docked: Story = { args: { docked: true } };
export const LongTag: Story = {
  args: { tags: [`project/${"longlabel".repeat(12)}`] },
};

export const LongTagRegression: Story = {
  ...LongTag,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    await expect(await within(canvasElement).findByRole("textbox", { name: "快速输入内容" })).toHaveTextContent("");
    await userEvent.click(within(canvasElement).getByRole("button", { name: "选择标签" }));
    const popup = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "选择标签" });
    const tag = within(popup).getByRole("button", { name: args.tags[0] });
    await expect(popup.scrollWidth).toBeLessThanOrEqual(popup.clientWidth + 1);
    await expect(tag.scrollWidth).toBeLessThanOrEqual(tag.clientWidth + 1);
    await userEvent.click(tag);
    await expect(within(canvasElement).getByRole("textbox", { name: "快速输入内容" })).toHaveTextContent(args.tags[0]);
  },
};
export const ColoredInlineTag: Story = {
  decorators: [Story => <TagColorProvider vaultId="ui-capture-color-story"><TagColorStyles /><Story /></TagColorProvider>],
  beforeEach: () => {
    const key = "memocard:tag-colors:ui-capture-color-story";
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify({ "工作": "green" }));
    return () => { if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous); };
  },
};

export const ColoredInlineTagRegression: Story = {
  ...ColoredInlineTag,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const field = await within(canvasElement).findByRole("textbox", { name: "快速输入内容" });
    await expect(field).toHaveTextContent("");
    await userEvent.type(field, "保留标签配色 #工作 ");
    await userEvent.keyboard("{Escape}");
    const tag = field.querySelector<HTMLElement>(`.rich-inline-tag[data-tag="${encodeURIComponent("工作")}"]`)!;
    const probe = canvasElement.ownerDocument.createElement("span");
    probe.style.cssText = "color:var(--color-text-green);background:color-mix(in oklab,var(--color-text-green) var(--tag-bg-opacity),transparent)";
    canvasElement.append(probe);
    await expect(getComputedStyle(tag).color).toBe(getComputedStyle(probe).color);
    await expect(getComputedStyle(tag).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    probe.remove();
  },
};
