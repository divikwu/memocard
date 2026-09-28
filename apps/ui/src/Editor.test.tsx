// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@memocard/contracts";
import { Editor } from "./Editor";
import { moveEditorCaretToEnd, noteEditor, readEditorText, replaceEditorText } from "./editor-test-utils";
import { request, type Draft } from "./bridge";

const client = vi.hoisted(() => ({ web: false, browser: false }));
vi.mock("./client-mode", () => ({ isBrowserVault: false, isLocalWeb: false }));
vi.mock("./bridge", () => ({
  request: vi.fn(),
  get isLocalWeb() { return client.web; },
  get isBrowserVault() { return client.browser; },
  errorMessage: (cause: unknown) => cause instanceof Error ? cause.message : "操作未完成",
}));

const initial: Draft = { id: "test-note", body: "", tags: [], baseHash: null };
const savedNote: Note = {
  id: initial.id, body: "记下一件小事", tags: ["生活"], createdAt: "2026-09-28T08:00:00Z",
  updatedAt: "2026-09-28T08:00:00Z", contentHash: "saved-hash",
  relativePath: "notes/test-note.md", sourceUrl: "memocard://note/test-note?vault=test-vault",
};
const nativeRequest = vi.mocked(request);

function editor(props: Partial<React.ComponentProps<typeof Editor>> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<Editor initial={initial} capabilities={new Set(["saveDraft", "saveNote", "pickImage"])} onClose={onClose} onSaved={onSaved} {...props} />);
  return { onClose, onSaved };
}

beforeEach(() => {
  client.web = false;
  client.browser = false;
  nativeRequest.mockReset();
  nativeRequest.mockResolvedValue(undefined);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("note editor", () => {
  it("keeps the original browser directory and draft identity on every write", async () => {
    client.browser = true;
    const bound = { ...initial, vaultBinding: "original-directory", draftKey: "original-draft" };
    nativeRequest.mockImplementation(async (operation) => operation === "saveNote" ? savedNote : undefined);
    editor({ initial: bound });
    replaceEditorText("只写入最初打开的文件夹");
    await userEvent.click(screen.getByRole("button", { name: /保存笔记/ }));
    expect(nativeRequest).toHaveBeenCalledWith("saveDraft", expect.objectContaining({ vaultBinding: bound.vaultBinding, draftKey: bound.draftKey }));
    expect(nativeRequest).toHaveBeenCalledWith("saveNote", expect.objectContaining({ vaultBinding: bound.vaultBinding, draftKey: bound.draftKey }));
  });

  it("protects standalone browser text before its IndexedDB draft is saved", () => {
    client.browser = true;
    editor();
    replaceEditorText("尚未持久保存的浏览器草稿");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("guards browser close until the latest text has reached the Mac draft store", async () => {
    client.web = true;
    editor();
    replaceEditorText("网页上尚未持久保存的内容");
    const pendingClose = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pendingClose);
    expect(pendingClose.defaultPrevented).toBe(true);
    await screen.findByText("草稿已存本机");
    await waitFor(() => {
      const savedClose = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(savedClose);
      expect(savedClose.defaultPrevented).toBe(false);
    });
  });

  it("keeps the dialog and entered text when saving a draft before close fails", async () => {
    const user = userEvent.setup();
    const { onClose } = editor();
    replaceEditorText("不能丢掉的内容");
    nativeRequest.mockRejectedValueOnce(new Error("草稿目录暂时不可写"));

    await user.click(screen.getByRole("button", { name: "保存草稿并关闭" }));

    expect((await screen.findByRole("alert")).textContent).toContain("草稿目录暂时不可写");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(readEditorText()).toBe("不能丢掉的内容");

    await user.click(screen.getByRole("button", { name: "保存草稿并关闭" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("waits for the current draft before committing the note and preserves its base hash", async () => {
    let finishDraft!: () => void;
    const pending = new Promise<void>((resolve) => { finishDraft = resolve; });
    nativeRequest.mockImplementation((operation) => operation === "saveDraft" ? pending : Promise.resolve(savedNote));
    const { onSaved } = editor({ initial: { ...initial, baseHash: "original-hash" } });
    replaceEditorText("记下一件小事");
    const tagField = screen.getByRole("textbox", { name: "添加标签" });
    fireEvent.change(tagField, { target: { value: "生活" } });
    fireEvent.keyDown(tagField, { key: "Enter" });
    fireEvent.change(tagField, { target: { value: "记录" } });
    fireEvent.click(screen.getByRole("button", { name: /保存笔记/ }));
    await waitFor(() => expect(nativeRequest).toHaveBeenCalledWith("saveDraft", {
      id: initial.id, body: "记下一件小事", tags: ["生活", "记录"], baseHash: "original-hash", relativePath: "notes/test-note.md",
    }));
    expect(nativeRequest).not.toHaveBeenCalledWith("saveNote", expect.anything());

    await act(async () => { finishDraft(); });

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedNote));
    expect(nativeRequest.mock.calls.map(([operation]) => operation)).toEqual(["saveDraft", "saveNote"]);
    expect(nativeRequest).toHaveBeenLastCalledWith("saveNote", {
      id: initial.id, body: "记下一件小事", tags: ["生活", "记录"], baseHash: "original-hash", relativePath: "notes/test-note.md",
    });
  });

  it("flushes the draft on Escape and ignores repeated dismissals while the write is pending", async () => {
    const user = userEvent.setup();
    let finishDraft!: () => void;
    nativeRequest.mockImplementation(() => new Promise<void>((resolve) => { finishDraft = resolve; }));
    const { onClose } = editor();
    replaceEditorText("关闭前写入草稿");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(nativeRequest).toHaveBeenCalledOnce());
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(nativeRequest).toHaveBeenCalledOnce();

    await act(async () => { finishDraft(); });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("saves the current draft when the backdrop requests dismissal", async () => {
    const user = userEvent.setup();
    const { onClose } = editor();
    replaceEditorText("点击遮罩前的内容");
    const backdrop = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(nativeRequest).toHaveBeenCalledWith("saveDraft", {
      id: initial.id, body: "点击遮罩前的内容", tags: [], baseHash: null, relativePath: "notes/test-note.md",
    });
  });

  it("uses one editable Markdown area without edit or preview tabs", () => {
    editor({ initial: { ...initial, body: "**我的记录**\n\n继续输入" } });

    expect(screen.getAllByRole("textbox", { name: "笔记内容" })).toHaveLength(1);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    expect(document.querySelectorAll(".cm-editor")).toHaveLength(1);
    expect(readEditorText()).toBe("**我的记录**\n\n继续输入");
    replaceEditorText("**我的记录**\n\n编辑和呈现在同一区域");
    expect(readEditorText()).toBe("**我的记录**\n\n编辑和呈现在同一区域");
  });

  it.each(["save", "close"])("preserves exact Markdown source when only tags change before %s", async (action) => {
    const source = "# 原始记录\r\n\r\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<div data-kind=\"external\">原始 HTML</div>\n\n引用[^one] 与 &amp; 转义\n\n[^one]: 保留脚注\n[ref]: https://example.com \"原始标题\"\n";
    nativeRequest.mockImplementation((operation) => Promise.resolve(operation === "saveNote" ? savedNote : undefined));
    const { onClose, onSaved } = editor({ initial: { ...initial, body: source, tags: ["原标签"] } });
    fireEvent.change(screen.getByRole("textbox", { name: "添加标签" }), { target: { value: "新增标签" } });
    fireEvent.click(screen.getByRole("button", { name: action === "save" ? /保存笔记/ : "保存草稿并关闭" }));

    await waitFor(() => expect(action === "save" ? onSaved : onClose).toHaveBeenCalledOnce());
    expect(nativeRequest).toHaveBeenCalledWith("saveDraft", {
      id: initial.id, body: source, tags: ["原标签", "新增标签"], baseHash: null, relativePath: "notes/test-note.md",
    });
    if (action === "save") expect(nativeRequest).toHaveBeenCalledWith("saveNote", { id: initial.id, body: source, tags: ["原标签", "新增标签"], baseHash: null, relativePath: "notes/test-note.md" });
  });

  it("changes one paragraph without serializing unrelated Markdown", async () => {
    const source = "开头正文\n\n| 外部表格 | 原值 |\n| --- | --- |\n| a | b |\n\n<!-- preserved comment -->\n\n[ref]: https://example.com \"title\"\n";
    nativeRequest.mockImplementation((operation) => Promise.resolve(operation === "saveNote" ? savedNote : undefined));
    editor({ initial: { ...initial, body: source } });
    const view = noteEditor();
    act(() => view.dispatch({ changes: { from: 0, to: "开头正文".length, insert: "只修改这个段落" } }));
    fireEvent.click(screen.getByRole("button", { name: /保存笔记/ }));

    await waitFor(() => expect(nativeRequest).toHaveBeenCalledWith("saveNote", {
      id: initial.id, body: source.replace("开头正文", "只修改这个段落"), tags: [], baseHash: null, relativePath: "notes/test-note.md",
    }));
  });

  it("preserves existing tag values exactly when only the body is edited", async () => {
    const tags = ["machine learning", "C#,F#", "#literal", "中，文", "  external spacing  "];
    nativeRequest.mockImplementation((operation) => Promise.resolve(operation === "saveNote" ? savedNote : undefined));
    editor({ initial: { ...initial, body: "原始正文", tags } });
    replaceEditorText("只修改正文");
    fireEvent.click(screen.getByRole("button", { name: /保存笔记/ }));

    await waitFor(() => expect(nativeRequest).toHaveBeenCalledWith("saveNote", { id: initial.id, body: "只修改正文", tags, baseHash: null, relativePath: "notes/test-note.md" }));
    expect(nativeRequest).toHaveBeenCalledWith("saveDraft", { id: initial.id, body: "只修改正文", tags, baseHash: null, relativePath: "notes/test-note.md" });
  });

  it("adds one literal tag per Enter, ignores composition Enter, and removes only the selected tag", async () => {
    const { onClose } = editor({ initial: { ...initial, body: "标签编辑", tags: ["C#,F#"] } });
    const field = screen.getByRole("textbox", { name: "添加标签" });
    fireEvent.change(field, { target: { value: "  #machine learning，记录  " } });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(screen.queryByRole("button", { name: "移除标签 #machine learning，记录" })).toBeNull();
    expect((field as HTMLInputElement).value).toBe("  #machine learning，记录  ");

    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByRole("button", { name: "移除标签 #machine learning，记录" })).toBeTruthy();
    expect((field as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "移除标签 C#,F#" }));
    fireEvent.change(field, { target: { value: "最后一个,标签" } });
    fireEvent.click(screen.getByRole("button", { name: "保存草稿并关闭" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(nativeRequest).toHaveBeenCalledWith("saveDraft", { id: initial.id, body: "标签编辑", tags: ["#machine learning，记录", "最后一个,标签"], baseHash: null, relativePath: "notes/test-note.md" });
  });

  it("autosaves and restores exact tags, including the tag still being typed", async () => {
    const original = ["machine learning", "C#,F#", "#literal"];
    editor({ initial: { ...initial, body: "自动草稿", tags: original, relativePath: "notes/moved/note.md" } });
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("textbox", { name: "添加标签" }), { target: { value: "未确认,标签" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(nativeRequest).toHaveBeenCalledWith("saveDraft", { id: initial.id, body: "自动草稿", tags: [...original, "未确认,标签"], baseHash: null, relativePath: "notes/moved/note.md" });

    const persisted = nativeRequest.mock.calls.find(([operation]) => operation === "saveDraft")![1] as Draft;
    cleanup();
    vi.useRealTimers();
    editor({ initial: { ...persisted, updatedAt: "2026-09-28T08:00:00Z" } });
    original.concat("未确认,标签").forEach((name) => expect(screen.getByRole("button", { name: `移除标签 ${name}` })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "保存草稿并关闭" }));
    await waitFor(() => expect(nativeRequest).toHaveBeenCalledTimes(2));
    expect(nativeRequest.mock.calls[1][1]).toEqual(persisted);
  });

  it("passes the stable note ID to image import and previews the returned relative path", async () => {
    nativeRequest.mockImplementation((operation) => Promise.resolve(operation === "pickImage" ? { markdownPath: "../../assets/image.png", relativePath: "assets/image.png" } : undefined));
    editor({ initial: { ...initial, body: "", relativePath: "notes/moved/note.md" } });
    fireEvent.click(screen.getByRole("button", { name: "添加本地图片" }));
    await waitFor(() => expect(readEditorText()).toBe("![图片](../../assets/image.png)\n\n"));
    expect(nativeRequest).toHaveBeenCalledWith("pickImage", { noteId: initial.id, notePath: "notes/moved/note.md" });
    moveEditorCaretToEnd();
    expect(screen.getByRole("img", { name: "图片" }).getAttribute("src")).toBe("memocard-asset://vault/assets/image.png");
  });

  it("updates preview and draft paths when image import discovers an external move", async () => {
    nativeRequest.mockImplementation((operation) => Promise.resolve(operation === "pickImage" ? { markdownPath: "../../assets/image.png", relativePath: "assets/image.png", notePath: "notes/folder/test-note.md" } : undefined));
    const { onClose } = editor({ initial: { ...initial, body: "移动前打开的笔记", baseHash: "unchanged-hash", relativePath: "notes/test-note.md" } });
    fireEvent.click(screen.getByRole("button", { name: "添加本地图片" }));
    await waitFor(() => expect(readEditorText()).toBe("移动前打开的笔记\n\n![图片](../../assets/image.png)\n\n"));

    moveEditorCaretToEnd();
    expect(screen.getByRole("img", { name: "图片" }).getAttribute("src")).toBe("memocard-asset://vault/assets/image.png");
    fireEvent.click(screen.getByRole("button", { name: "保存草稿并关闭" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(nativeRequest).toHaveBeenCalledWith("saveDraft", { id: initial.id, body: "移动前打开的笔记\n\n![图片](../../assets/image.png)\n\n", tags: [], baseHash: "unchanged-hash", relativePath: "notes/folder/test-note.md" });
  });

  it("does not submit when Command Enter is part of Chinese input composition", async () => {
    nativeRequest.mockImplementation((operation) => Promise.resolve(operation === "saveNote" ? savedNote : undefined));
    const { onSaved } = editor({ initial: { ...initial, body: "正在输入中文" } });
    const field = screen.getByRole("textbox", { name: "笔记内容" });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true, isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true, keyCode: 229 });
    expect(nativeRequest).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: "Enter", metaKey: true });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedNote));
  });

  it("does not bypass the native save capability through a keyboard shortcut", () => {
    editor({ initial: { ...initial, body: "只读内容" }, capabilities: new Set(["saveDraft"]) });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "笔记内容" }), { key: "Enter", metaKey: true });
    expect(nativeRequest).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /保存笔记/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("serializes autosaves before flushing the newest content on close", async () => {
    let finishFirst!: () => void;
    const pending = new Promise<void>((resolve) => { finishFirst = resolve; });
    nativeRequest.mockImplementationOnce(() => pending);
    const { onClose } = editor();
    vi.useFakeTimers();
    const field = screen.getByRole("textbox", { name: "笔记内容" });
    replaceEditorText("第一版", field);
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    replaceEditorText("最后一版", field);
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(nativeRequest).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "保存草稿并关闭" }));
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => { finishFirst(); });

    expect(nativeRequest.mock.calls.map(([, params]) => params?.body)).toEqual(["第一版", "最后一版", "最后一版"]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

it("submits the selected nested path with the note, not just its draft", async () => {
  nativeRequest.mockImplementation((operation) => Promise.resolve(operation === "saveNote" ? savedNote : undefined));
  editor({ initial: { ...initial, body: "子目录正式保存", relativePath: "notes/工作/项目/test-note.md" } });
  await userEvent.click(screen.getByRole("button", { name: /保存笔记/ }));
  expect(nativeRequest).toHaveBeenCalledWith("saveNote", expect.objectContaining({ relativePath: "notes/工作/项目/test-note.md", body: "子目录正式保存" }));
});
