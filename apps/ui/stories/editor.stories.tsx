import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookRequestHandler } from "../.storybook/bridge";
import { desktopGlobals } from "../.storybook/viewports";
import { EditorExample, type EditorExampleProps } from "./editor.example";
import { createEditorFixture, editorNote, editorVaultBinding } from "./editor.fixture";

let fixture = createEditorFixture();
function EditorStory(args: Omit<EditorExampleProps, "fixture">) { return <EditorExample {...args} fixture={fixture} />; }

const meta = {
  title: "business/editor",
  component: EditorStory,
  globals: desktopGlobals,
  args: { scenario: "ready", onSaved: fn(), onCommitted: fn(), onClose: fn(), onError: fn() },
  argTypes: { scenario: { control: false }, onSaved: { control: false }, onCommitted: { control: false }, onClose: { control: false }, onError: { control: false } },
  parameters: { layout: "fullscreen", docs: { story: { height: "900px" }, description: { component: "生产 Editor 的标题和 Tiptap 正文编辑、自动保存、恢复草稿、失败重试与返回真实 NoteCollection。数据桥仅接受当前内存笔记、绑定、路径与版本，未连接真实笔记库。H5 故事验证共享 Web 正文；iOS 原生导航、键盘与返回另在 Xcode Preview 和模拟器验收。" } } },
  beforeEach: ({ args }) => {
    fixture = createEditorFixture(args.scenario === "retry" || args.scenario === "pending" ? args.scenario : "ready");
    const current = fixture;
    const release = setStorybookRequestHandler(current.request);
    return () => { current.dispose(); release(); };
  },
} satisfies Meta<typeof EditorStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const title = "修改后的标题";
const body = "修改后的正文。";
async function edit(canvas: ReturnType<typeof within>) {
  const heading = canvas.getByRole("textbox", { name: "页面标题" });
  const content = canvas.getByRole("textbox", { name: "笔记内容" });
  await userEvent.clear(heading);
  await userEvent.type(heading, title);
  await userEvent.clear(content);
  await userEvent.type(content, body);
  await expect(heading).toHaveValue(title);
  await expect(content).toHaveTextContent(body);
  return { heading, content };
}

async function reopenSaved(canvas: ReturnType<typeof within>) {
  const collection = await canvas.findByRole("region", { name: "已保存的笔记集合" });
  await expect(within(collection).getByRole("button", { name: `打开 ${title}` })).toBeVisible();
  await expect(within(collection).getByText(body)).toBeVisible();
  await userEvent.click(within(collection).getByRole("button", { name: `打开 ${title}` }));
  await expect(await canvas.findByRole("textbox", { name: "页面标题" })).toHaveValue(title);
  await expect(canvas.getByRole("textbox", { name: "笔记内容" })).toHaveTextContent(body);
  await expect(fixture.calls.filter(call => call.operation === "getNote")).toEqual([
    { operation: "getNote", params: { id: editorNote.id, vaultBinding: editorVaultBinding } },
  ]);
}

async function retryAndReturn(canvasElement: HTMLElement, args: Omit<EditorExampleProps, "fixture">, mobile = false) {
  const canvas = within(canvasElement);
  if (mobile) {
    await waitFor(() => expect(canvas.getByRole("region", { name: "编辑笔记" })).toHaveFocus());
    await expect(canvas.getByRole("textbox", { name: "页面标题" })).not.toHaveFocus();
  }
  const { heading, content } = await edit(canvas);
  await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
  await expect(await canvas.findByRole("alert")).toHaveTextContent("磁盘只读（内存示例）");
  await expect(heading).toHaveValue(title);
  await expect(content).toHaveTextContent(body);
  await expect(canvas.queryByRole("region", { name: "已保存的笔记集合" })).not.toBeInTheDocument();
  if (mobile) await expect(canvas.getByRole("status")).toHaveTextContent("保存失败，请重试");
  await expect(args.onSaved).not.toHaveBeenCalled();
  await expect(args.onClose).not.toHaveBeenCalled();
  await expect(args.onCommitted).not.toHaveBeenCalled();
  await expect(fixture.readSaved()).toEqual(editorNote);
  await expect(fixture.readRecovery()).toMatchObject({ title, body, id: editorNote.id, vaultBinding: editorVaultBinding });
  await userEvent.click(canvas.getByRole("button", { name: "重试保存" }));
  await waitFor(() => expect(args.onSaved).toHaveBeenCalledOnce());
  const writes = fixture.calls.filter(call => call.operation === "saveNote");
  await expect(writes).toHaveLength(2);
  await expect(writes[1].params).toEqual(writes[0].params);
  await expect(writes[1].params).toMatchObject({ title, body, baseHash: editorNote.contentHash, vaultBinding: editorVaultBinding });
  await expect(fixture.readSaved()).toMatchObject({ title, body, contentHash: "storybook-editor-1" });
  await expect(fixture.readRecovery()).toBeNull();
  await expect(args.onCommitted).toHaveBeenCalledOnce();
  await reopenSaved(canvas);
  await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
  await expect(await canvas.findByRole("region", { name: "已保存的笔记集合" })).toBeVisible();
  await expect(args.onClose).toHaveBeenCalledOnce();
  await expect(fixture.calls.filter(call => call.operation === "saveNote")).toHaveLength(2);
  await expect(args.onError).not.toHaveBeenCalled();
}

export const EditAndAutosave: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await edit(canvas);
    await waitFor(() => expect(args.onCommitted).toHaveBeenCalledOnce());
    await expect(args.onSaved).not.toHaveBeenCalled();
    await expect(canvas.getByRole("region", { name: "编辑笔记" })).toBeVisible();
    await expect(fixture.readSaved()).toMatchObject({ title, body });
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await waitFor(() => expect(args.onSaved).toHaveBeenCalledOnce());
    await reopenSaved(canvas);
    await expect(fixture.calls.filter(call => call.operation === "saveNote")).toHaveLength(1);
    await expect(args.onError).not.toHaveBeenCalled();
  },
};

export const SaveFailureAndRetry: Story = {
  args: { scenario: "retry" },
  play: async ({ canvasElement, args }) => retryAndReturn(canvasElement, args),
};

export const SaveInProgress: Story = {
  args: { scenario: "pending" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const { heading, content } = await edit(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await waitFor(() => expect(fixture.calls.filter(call => call.operation === "saveNote")).toHaveLength(1));
    await expect(heading).toHaveAttribute("readonly");
    await expect(content).toHaveAttribute("contenteditable", "false");
    await expect(canvas.getByRole("button", { name: "返回笔记集合" })).toBeDisabled();
    await expect(args.onSaved).not.toHaveBeenCalled();
    await expect(fixture.readSaved()).toEqual(editorNote);
    await userEvent.click(canvas.getByRole("button", { name: "完成模拟保存" }));
    await waitFor(() => expect(args.onSaved).toHaveBeenCalledOnce());
    await expect(await canvas.findByRole("region", { name: "已保存的笔记集合" })).toBeVisible();
    await expect(fixture.readSaved()).toMatchObject({ title, body });
    await expect(fixture.readRecovery()).toBeNull();
  },
};

export const ReadOnly: Story = {
  args: { scenario: "readonly" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("textbox", { name: "页面标题" });
    await expect(heading).toHaveAttribute("readonly");
    await expect(canvas.getByRole("textbox", { name: "笔记内容" })).toHaveAttribute("contenteditable", "false");
    await userEvent.type(heading, "不会写入");
    await expect(heading).toHaveValue(editorNote.title);
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await expect(await canvas.findByRole("region", { name: "已保存的笔记集合" })).toBeVisible();
    await expect(args.onClose).toHaveBeenCalledOnce();
    await expect(args.onSaved).not.toHaveBeenCalled();
    await expect(fixture.calls).toEqual([]);
  },
};

export const MobileSaveFailureAndRetry: Story = {
  tags: ["mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  args: { scenario: "retry" },
  parameters: { docs: { story: { height: "844px" } } },
  play: async ({ canvasElement, args }) => retryAndReturn(canvasElement, args, true),
};
