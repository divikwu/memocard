// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, VaultStatus } from "@memocard/contracts";
import type { Draft } from "./bridge";
import { App } from "./App";
import { readEditorText, replaceEditorText } from "./editor-test-utils";

const bridge = vi.hoisted(() => ({ request: vi.fn(), reconnect: vi.fn(), native: true, web: false, browser: false }));
vi.mock("./bridge", () => ({
  request: bridge.request,
  reconnectVault: bridge.reconnect,
  get isNative() { return bridge.native; },
  get isLocalWeb() { return bridge.web; },
  get isBrowserVault() { return bridge.browser; },
  get isConnectedClient() { return bridge.native || bridge.web || bridge.browser; },
  errorMessage: (cause: unknown) => cause instanceof Error ? cause.message : "操作未完成",
}));
vi.mock("@/features/theme/ThemeSettings", () => ({ ThemeSettings: () => <section aria-label="外观设置" /> }));

const note: Note = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", body: "周末散步时想到的记录", tags: ["生活"],
  createdAt: "2026-09-28T08:00:00Z", updatedAt: "2026-09-28T08:00:00Z", contentHash: "current-content-hash",
  relativePath: "notes/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.md", sourceUrl: "memocard://note/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?vault=test-vault",
};
const status: VaultStatus = {
  connected: true, vaultId: "test-vault", vaultName: "界面测试库", phase: "M1", syncState: "local",
  coverage: { complete: true, indexed: 1, pending: 0, issues: 0, indexedAt: "2026-09-28T08:00:00Z" },
  capabilities: ["queryNotes", "getNote", "getDrafts", "listTags", "saveNote", "saveDraft"],
};
let pendingDrafts: Draft[] = [];

beforeEach(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  window.history.replaceState(null, "", "#/notes");
  bridge.native = true;
  bridge.web = false;
  bridge.browser = false;
  pendingDrafts = [];
  bridge.request.mockReset();
  bridge.reconnect.mockReset();
  bridge.request.mockImplementation(async (operation: string, params?: Record<string, unknown>) => {
    switch (operation) {
      case "getEnvironment": return { platform: "mac", phase: "M1", mcpEnabled: false, capabilities: ["selectVault", "setMCPEnabled"] };
      case "getStatus": return status;
      case "queryNotes": return { notes: params?.query ? [] : [note], nextCursor: null, coverage: status.coverage };
      case "getDrafts": return { drafts: pendingDrafts };
      case "listTags": return { tags: [{ name: "生活", count: 1 }] };
      case "getNote": return note;
      case "saveDraft": return {};
      case "saveNote":
        if (pendingDrafts.some((draft) => draft.id === params?.id) && !bridge.request.mock.calls.some(([op]) => op === "saveDraft")) throw new Error("文件冲突");
        return { ...note, id: params?.id, body: params?.body, tags: params?.tags, title: params?.title };
      case "uiReady": return {};
      default: throw new Error(`Unexpected test operation: ${operation}`);
    }
  });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("note workspace", () => {
  it("renders notes as an equal-height card grid", async () => {
    render(<App />);
    const pageTitle = await screen.findByRole("heading", { name: "所有笔记", level: 1 });
    expect(pageTitle.className).toContain("text-[32px]");
    expect(pageTitle.closest(".sr-only")).toBeNull();
    const contentScroll = pageTitle.parentElement?.parentElement?.parentElement;
    expect(contentScroll?.className).toContain("px-4");
    expect(contentScroll?.className).toContain("md:px-[104px]");
    expect(contentScroll?.className).not.toContain("xl:px-16");
    const list = await screen.findByRole("list", { name: "笔记列表" });
    expect(list.className).toContain("grid");
    const card = list.querySelector('[data-slot="card"]');
    expect(card?.className).toContain("h-64");
    expect(card?.className).toContain("border-border");
    expect(card?.className).not.toContain("border-border/60");
    expect(card?.className).not.toContain("border-0");
    expect(card?.className).toContain("bg-card");
    expect(card?.className).not.toContain("bg-[#fbfbfb]");
    expect(card?.className).not.toContain("bg-muted/50");
    expect(card?.className).toContain("shadow-[0_4px_12px_rgba(25,25,25,0.027),0_1px_2px_rgba(25,25,25,0.02)]");
    expect(card?.className).not.toContain("shadow-none");
    expect(screen.getByText("新页面").className).toContain("text-base");
    expect(card?.querySelector("time")?.className).toContain("text-xs");
    expect(screen.getByRole("button", { name: "#生活" }).className).toContain("text-xs");
    expect(screen.queryByText("编辑")).toBeNull();
    expect(screen.getByRole("button", { name: /^打开 .* 的笔记$/ }).className).toContain("flex-1");
  });

  it("waits for the native vault before showing notes and searches with the typed query", async () => {
    let resolveStatus!: (value: VaultStatus) => void;
    const statusReady = new Promise<VaultStatus>((resolve) => { resolveStatus = resolve; });
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getStatus" ? statusReady : implementation(operation, params));
    render(<App />);
    expect(screen.getByRole("status", { name: "正在读取笔记库" })).toBeTruthy();
    expect(screen.queryByText(note.body)).toBeNull();

    await act(async () => { resolveStatus(status); });
    expect(await screen.findByText(note.body)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索笔记" }), { target: { value: "不存在的关键词" } });

    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "不存在的关键词", tags: [], limit: 30 }));
    expect(await screen.findByText("没有找到相关笔记")).toBeTruthy();
    expect(screen.queryByText(note.body)).toBeNull();
  });

  it("opens a saved note using the latest native content and preserves a pending local draft", async () => {
    const user = userEvent.setup();
    pendingDrafts = [{ id: note.id, body: "尚未提交的草稿文字", tags: ["生活"], baseHash: "draft-base-hash" }];
    render(<App />);
    await screen.findByText(note.body);

    await user.click(screen.getByRole("button", { name: /^打开 .* 的笔记$/ }));

    expect(bridge.request).toHaveBeenCalledWith("getNote", { id: note.id });
    const editor = await screen.findByRole("region", { name: "编辑笔记" });
    expect(readEditorText(within(editor).getByRole("textbox", { name: "笔记内容" }))).toBe("尚未提交的草稿文字");
    const back = screen.getByRole("button", { name: "返回笔记列表" });
    expect(back.closest("header")).not.toBeNull();
    expect(back.className).toContain("md:hidden");
    expect(within(editor).queryByRole("button", { name: "返回笔记列表" })).toBeNull();
    await user.click(back);
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("saveNote", expect.objectContaining({ body: "尚未提交的草稿文字", baseHash: "draft-base-hash" })));
  });

  it("does not let a late read replace a new editor or discard its unsaved input", async () => {
    let resolveNote!: (value: Note) => void;
    const pending = new Promise<Note>((resolve) => { resolveNote = resolve; });
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getNote" ? pending : implementation(operation, params));
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: /^打开 .* 的笔记$/ }));
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("不能被旧响应覆盖的新想法");

    await act(async () => { resolveNote(note); });

    expect(readEditorText()).toBe("不能被旧响应覆盖的新想法");
    expect(bridge.request).toHaveBeenCalledWith("saveNote", expect.objectContaining({ body: "", title: "" }));
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("saveDraft", expect.objectContaining({ body: "不能被旧响应覆盖的新想法" })));
  });

  it("ignores a failed old read after a draft has been opened", async () => {
    let rejectNote!: (cause: Error) => void;
    const pending = new Promise<Note>((_, reject) => { rejectNote = reject; });
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getNote" ? pending : implementation(operation, params));
    pendingDrafts = [{ id: "local-draft", body: "已有草稿", tags: [], baseHash: null }];
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: /^打开 .* 的笔记$/ }));
    fireEvent.click(await screen.findByRole("button", { name: /恢复内容/ }));

    await act(async () => { rejectNote(new Error("迟到的读取错误")); });

    expect(readEditorText()).toBe("已有草稿");
    expect(screen.queryByText("迟到的读取错误")).toBeNull();
  });

  it("keeps an interrupted deep link queued until the new draft has been flushed", async () => {
    let resolveNote!: (value: Note) => void;
    const pending = new Promise<Note>((resolve) => { resolveNote = resolve; });
    const implementation = bridge.request.getMockImplementation()!;
    let reads = 0;
    bridge.request.mockImplementation((operation, params) => operation === "getNote" && ++reads === 1 ? pending : implementation(operation, params));
    render(<App />);
    await screen.findByText(note.body);
    act(() => { window.dispatchEvent(new CustomEvent("memocard:open-note", { detail: { id: note.id } })); });
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("先完成当前想法");
    await act(async () => { resolveNote(note); });

    expect(screen.getByText("完成当前记录后，将打开收到的笔记链接。")).toBeTruthy();
    expect(readEditorText()).toBe("先完成当前想法");
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));

    await screen.findByRole("region", { name: "编辑笔记" });
    expect(readEditorText()).toBe(note.body);
    const operations = bridge.request.mock.calls.map(([operation]) => operation);
    expect(operations.indexOf("saveDraft")).toBeLessThan(operations.lastIndexOf("getNote"));
    expect(bridge.request).toHaveBeenCalledWith("saveDraft", expect.objectContaining({ body: "先完成当前想法" }));
  });

  it("flushes current input before opening a received deep link", async () => {
    render(<App />); await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" }); replaceEditorText("正在输入");
    act(() => { window.dispatchEvent(new CustomEvent("memocard:open-note", { detail: { id: note.id } })); });
    await screen.findByRole("region", { name: "编辑笔记" });
    expect(readEditorText()).toBe(note.body);
    const calls = bridge.request.mock.calls.map(([op]) => op);
    expect(calls.indexOf("saveNote")).toBeLessThan(calls.lastIndexOf("getNote"));
  });

  it("keeps the newest deep-link request when older reads finish out of order", async () => {
    let resolveOld!: (value: Note) => void;
    const pending = new Promise<Note>((resolve) => { resolveOld = resolve; });
    const nextNote = { ...note, id: "11111111-2222-4333-8444-555555555555", body: "新链接的笔记" };
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getNote" ? params?.id === note.id ? pending : Promise.resolve(nextNote) : implementation(operation, params));
    render(<App />);
    await screen.findByText(note.body);
    act(() => {
      window.dispatchEvent(new CustomEvent("memocard:open-note", { detail: { id: note.id } }));
      window.dispatchEvent(new CustomEvent("memocard:open-note", { detail: { id: nextNote.id } }));
    });
    await screen.findByRole("region", { name: "编辑笔记" });
    await act(async () => { resolveOld(note); });

    expect(readEditorText()).toBe(nextNote.body);
  });

  it.each([false, true])("resumes an existing draft with a current path or its offline fallback (offline=%s)", async (offline) => {
    const oldPath = "notes/old-name.md";
    const newPath = "notes/folder/new-name.md";
    pendingDrafts = [{ id: note.id, body: "待恢复的正文", tags: ["machine learning"], baseHash: "draft-hash", relativePath: oldPath }];
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getNote" ? offline ? Promise.reject(new Error("待下载")) : Promise.resolve({ ...note, relativePath: newPath }) : implementation(operation, params));
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(await screen.findByRole("button", { name: /^打开 .* 的笔记$/ }));
    const dialog = await screen.findByRole("region", { name: "编辑笔记" });
    const field = within(dialog).getByRole("textbox", { name: "笔记内容" });
    replaceEditorText("恢复后继续编辑", field);
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));

    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("saveDraft", { id: note.id, body: "恢复后继续编辑", tags: [], baseHash: "draft-hash", relativePath: offline ? oldPath : newPath }));
  });

  it("uses the mobile Sheet for navigation and dismisses it after navigation or Escape", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("767px"), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "打开导航" }));
    const sheet = await screen.findByRole("dialog", { name: "记忆卡导航" });

    await user.click(within(sheet).getByRole("button", { name: "所有笔记" }));
    expect(screen.queryByRole("button", { name: "草稿" })).toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull());
    expect(window.location.hash).toBe("#/notes");

    await user.click(screen.getByRole("button", { name: "打开导航" }));
    await screen.findByRole("dialog", { name: "记忆卡导航" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull());
    expect(screen.getByRole("heading", { name: "所有笔记", level: 1 })).toBeTruthy();
  });

  it("explains unsupported browser directory access without offering Mac-dependent actions", async () => {
    bridge.native = false; bridge.browser = true;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getEnvironment" ? Promise.resolve({ platform: "web", phase: "browser", mcpEnabled: false, capabilities: [] }) : operation === "getStatus" ? Promise.resolve({ ...status, connected: false, capabilities: [] }) : implementation(operation, params));
    render(<App />);

    expect(await screen.findByText("需要启动 MemoCard 本机服务")).toBeTruthy();
    expect(screen.getByText(/Safari 和 Codex 通过本机服务读写笔记库/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "打开本机 Web" })).toBeNull();
    expect(await screen.findByRole("heading", { name: "连接 MemoCard 本机服务" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "打开已有笔记库" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "搜索笔记" })).toBeNull();
    expect(screen.queryByText(note.body)).toBeNull();
    expect(bridge.request).not.toHaveBeenCalledWith("queryNotes", expect.anything());
  });

  it.each([false, true])("opens a browser folder without a Mac app (create=%s)", async (create) => {
    bridge.native = false; bridge.browser = true;
    let connected = false;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "getEnvironment") return Promise.resolve({ platform: "web", phase: "browser", vaultBinding: "browser-vault", mcpEnabled: false, capabilities: ["selectVault", "createVault"] });
      if (operation === "getStatus") return Promise.resolve({ ...status, connected });
      if (operation === "selectVault") { connected = true; return Promise.resolve({ vaultId: status.vaultId, vaultBinding: "browser-vault" }); }
      return implementation(operation, params);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: create ? "创建笔记库" : "打开已有笔记库" }));

    expect(bridge.request).toHaveBeenCalledWith("selectVault", { create });
    expect(await screen.findByText(note.body)).toBeTruthy();
    expect(bridge.request).not.toHaveBeenCalledWith("uiReady");
    expect(screen.queryByText(/请在 App 中授权/)).toBeNull();
  });

  it("shows feedback while a browser picker is pending and after an aborted selection", async () => {
    bridge.native = false; bridge.browser = true;
    let finish!: (value: { cancelled: boolean; diagnostic: string }) => void;
    const original = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "getEnvironment") return Promise.resolve({ platform: "web", capabilities: ["selectVault", "createVault"] });
      if (operation === "getStatus") return Promise.resolve({ ...status, connected: false });
      if (operation === "selectVault") return new Promise(resolve => { finish = resolve; });
      return original(operation, params);
    });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "打开已有笔记库" }));
    expect(await screen.findByText("正在打开笔记库")).toBeTruthy();
    await act(async () => { finish({ cancelled: true, diagnostic: "选择文件夹并授权 / AbortError" }); });
    expect(await screen.findByText("文件夹授权未完成")).toBeTruthy();
    expect(screen.getByText(/未完成文件夹授权/)).toBeTruthy();
    expect(screen.getByText(/选择文件夹并授权 \/ AbortError/)).toBeTruthy();
    expect(screen.queryByText("正在打开笔记库")).toBeNull();
  });

  it.each([false, true])("resets filters only after a successful browser vault switch (cancelled=%s)", async (cancelled) => {
    bridge.native = false; bridge.browser = true;
    let switched = false;
    const otherNote = { ...note, id: "other-note", body: "另一个笔记库的内容", tags: ["另一库"] };
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "getEnvironment") return Promise.resolve({ platform: "web", phase: "browser", vaultBinding: switched ? "other-binding" : "original-binding", mcpEnabled: false, capabilities: ["selectVault", "createVault"] });
      if (operation === "getStatus") return Promise.resolve(switched ? { ...status, vaultId: "other-vault", vaultName: "另一个库" } : status);
      if (operation === "queryNotes") return Promise.resolve({ notes: switched ? [otherNote] : [note], nextCursor: "next-page", coverage: status.coverage });
      if (operation === "listTags") return Promise.resolve({ tags: [{ name: switched ? "另一库" : "生活", count: 1 }] });
      if (operation === "selectVault") { switched = !cancelled; return Promise.resolve(cancelled ? { cancelled: true } : { vaultId: "other-vault", vaultBinding: "other-binding" }); }
      return implementation(operation, params);
    });
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索笔记" }), { target: { value: "旧库关键词" } });
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));
    fireEvent.click(screen.getByRole("button", { name: "#生活" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "旧库关键词", tags: ["生活"], limit: 30 }));
    window.location.hash = "#/settings";
    fireEvent(window, new Event("hashchange"));
    fireEvent.click(await screen.findByRole("button", { name: "切换笔记库" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "切换笔记库" }) as HTMLButtonElement).disabled).toBe(false));

    if (cancelled) expect(screen.queryByText("文件夹授权未完成")).toBeNull();
    if (!cancelled) {
      expect(bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes").at(-1)).toEqual(["queryNotes", { query: "", tags: [], limit: 30 }]);
      expect(screen.queryByRole("button", { name: /生活 1/ })).toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: "所有笔记" }));
    expect(screen.queryByText("搜索：旧库关键词") !== null).toBe(cancelled);
    expect(await screen.findByText(cancelled ? note.body : otherNote.body)).toBeTruthy();
  });

  it("asks for browser permission again while preserving an open editor", async () => {
    bridge.native = false; bridge.browser = true;
    let permitted = true;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "getEnvironment") return Promise.resolve({ platform: "web", phase: "browser", vaultBinding: "browser-binding", mcpEnabled: false, capabilities: ["selectVault", "createVault", ...(permitted ? [] : ["reauthorizeVault"])] });
      if (operation === "getStatus") return Promise.resolve({ ...status, connected: permitted, syncState: permitted ? "local" : "unauthorized" });
      if (operation === "reauthorizeVault") { permitted = true; return Promise.resolve({}); }
      return implementation(operation, params);
    });
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("重新授权前保留的想法");
    permitted = false;
    await act(async () => { fireEvent.focus(window); });

    expect(await screen.findByText("重新授权笔记文件夹")).toBeTruthy();
    expect(readEditorText()).toBe("重新授权前保留的想法");
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "重新授权" }));
    expect(await screen.findByText(note.body)).toBeTruthy();
    expect(bridge.request).toHaveBeenCalledWith("reauthorizeVault");
  });

  it("attaches the browser vault binding to new editor drafts and blocks switching while editing", async () => {
    bridge.native = false; bridge.browser = true;
    window.history.replaceState(null, "", "#/settings");
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getEnvironment" ? Promise.resolve({ platform: "web", phase: "browser", vaultBinding: "current-browser-vault", mcpEnabled: false, capabilities: ["selectVault", "createVault"] }) : implementation(operation, params));
    render(<App />);
    await screen.findByRole("button", { name: "切换笔记库" });
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("仅写入当前笔记库");
    expect(screen.queryByRole("button", { name: "切换笔记库" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("saveDraft", expect.objectContaining({ body: "仅写入当前笔记库", vaultBinding: "current-browser-vault" })));
  });

  it("reads and creates real notes through the local web capabilities without native-only calls", async () => {
    bridge.native = false; bridge.web = true;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getEnvironment" ? Promise.resolve({ platform: "web", mcpEnabled: false, capabilities: ["pickImage", "openExternal"] }) : implementation(operation, params));
    render(<App />);
    await screen.findByText(note.body);
    expect(bridge.request).not.toHaveBeenCalledWith("uiReady");
    expect(screen.queryByText("浏览器预览")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("浏览器中新建的记录");
    expect(screen.queryByRole("button", { name: "添加本地图片" })).toBeNull();
    expect(screen.queryByRole("button", { name: "完成" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("saveNote", expect.objectContaining({ body: "浏览器中新建的记录" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("switches a local Web vault through the native picker and reconnects on the same origin", async () => {
    bridge.native = false; bridge.web = true;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "getEnvironment") return Promise.resolve({ platform: "web", phase: "M1", storage: "local-web", mcpEnabled: false, capabilities: ["selectVault", "createVault"] });
      if (operation === "selectVault") return Promise.resolve({ reconnectUrl: "http://127.0.0.1:5194/#/connect?token=next" });
      return implementation(operation, params);
    });
    window.history.replaceState(null, "", "#/settings");
    render(<App />);
    expect(await screen.findByRole("button", { name: "创建新笔记库" })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "切换笔记库" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("selectVault", { create: false }));
    expect(bridge.reconnect).toHaveBeenCalledWith("http://127.0.0.1:5194/#/connect?token=next");
  });

  it("loads registered local Web vaults and activates one without opening a picker", async () => {
    bridge.native = false; bridge.web = true;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "getEnvironment") return Promise.resolve({ platform: "web", phase: "M1", storage: "local-web", mcpEnabled: false, capabilities: ["selectVault", "createVault", "listVaults", "activateVault"] });
      if (operation === "listVaults") return Promise.resolve({ vaults: [{ vaultId: status.vaultId, name: "当前库", active: true }, { vaultId: "other-vault", name: "另一个库", active: false }] });
      if (operation === "activateVault") return Promise.resolve({ reconnectUrl: "http://127.0.0.1:5194/#/connect?token=other" });
      return implementation(operation, params);
    });
    render(<App />);
    await screen.findByText(note.body);
    await userEvent.click(screen.getByRole("button", { name: `笔记库：${status.vaultName}` }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "另一个库" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("activateVault", { vaultId: "other-vault" }));
    expect(bridge.reconnect).toHaveBeenCalledWith("http://127.0.0.1:5194/#/connect?token=other");
  });

  it("switches the first nine registered vaults with Option-number outside editable controls", async () => {
    bridge.native = false; bridge.web = true;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "getEnvironment") return Promise.resolve({ platform: "web", phase: "M1", storage: "local-web", mcpEnabled: false, capabilities: ["listVaults", "activateVault"] });
      if (operation === "listVaults") return Promise.resolve({ vaults: [{ vaultId: status.vaultId, name: "当前库", active: true }, { vaultId: "other-vault", name: "另一个库", active: false }] });
      if (operation === "activateVault") return Promise.resolve({ reconnectUrl: "http://127.0.0.1:5194/#/connect?token=other" });
      return implementation(operation, params);
    });
    render(<App />);
    await screen.findByText(note.body);

    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "笔记内容" }), { altKey: true, code: "Digit2", key: "™" });
    expect(bridge.request).not.toHaveBeenCalledWith("activateVault", expect.anything());

    fireEvent.keyDown(window, { altKey: true, code: "Digit2", key: "™" });
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("activateVault", { vaultId: "other-vault" }));
    expect(bridge.reconnect).toHaveBeenCalledWith("http://127.0.0.1:5194/#/connect?token=other");
  });

  it("retains the web editor and offers a fresh service URL when its local host disconnects", async () => {
    bridge.native = false; bridge.web = true;
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("断开时还在编辑的内容");
    const implementation = bridge.request.getMockImplementation()!;
    const disconnected = Object.assign(new Error("此页面连接的 MemoCard 本机服务已停止。请重新打开本机 Web；编辑中的内容仍保留在此页面。"), { code: "BRIDGE_UNAVAILABLE", retryable: false });
    bridge.request.mockImplementation((operation, params) => ["getStatus", "saveDraft", "saveNote"].includes(operation) ? Promise.reject(disconnected) : implementation(operation, params));
    fireEvent.focus(window);
    await screen.findByText("等待连接本机服务");
    expect(screen.getByText("本机 Web 已断开")).toBeTruthy();
    expect(screen.getByRole("link", { name: "重新打开本机 Web", hidden: true }).getAttribute("href")).toBe("memocard-service://open-web");
    expect(screen.queryByRole("button", { name: "重试", hidden: true })).toBeNull();
    expect((screen.getByRole("button", { name: "新建笔记", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "新建笔记" })).getByText(disconnected.message)).toBeTruthy());
    expect(readEditorText()).toBe("断开时还在编辑的内容");
  });

  it("checks local web connection without resetting pages already loaded", async () => {
    bridge.native = false; bridge.web = true;
    const second = { ...note, id: "second-note", body: "第二页的记录" };
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "queryNotes" ? Promise.resolve({ notes: params?.cursor ? [second] : [note], nextCursor: params?.cursor ? null : "page-two", coverage: status.coverage }) : implementation(operation, params));
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    await screen.findByText(second.body);
    const queries = bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes").length;
    const statusCalls = bridge.request.mock.calls.filter(([operation]) => operation === "getStatus").length;
    await act(async () => { fireEvent.focus(window); });
    expect(bridge.request.mock.calls.filter(([operation]) => operation === "getStatus")).toHaveLength(statusCalls + 1);
    expect(bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes")).toHaveLength(queries);
    expect(screen.getByText(second.body)).toBeTruthy();
  });

  it("delegates the Mac browser entry to the menu bar service", async () => {
    window.history.replaceState(null, "", "#/settings");
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getEnvironment" ? Promise.resolve({ platform: "mac", mcpEnabled: false, capabilities: ["openWeb"] }) : operation === "openWeb" ? Promise.resolve({}) : implementation(operation, params));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "在浏览器中打开" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("openWeb"));
    expect(screen.queryByRole("button", { name: "复制访问链接" })).toBeNull();
    expect(screen.queryByRole("button", { name: "关闭本机 Web" })).toBeNull();
  });
});

it.each(["web", "browser"] as const)("opens an internal note event in %s mode without native readiness calls", async (mode) => {
  bridge.native = false;
  bridge[mode] = true;
  render(<App />);
  await screen.findByText(note.body);
  act(() => window.dispatchEvent(new CustomEvent("memocard:open-note", { detail: { id: note.id } })));
  await screen.findByRole("textbox", { name: "笔记内容" });
  expect(readEditorText()).toBe(note.body);
  expect(bridge.request).not.toHaveBeenCalledWith("uiReady");
});

it("offers recovery without auto-committing it or exposing a drafts route", async () => {
  pendingDrafts = [{ id: note.id, body: "旧内容", tags: [], baseHash: "old-hash" }];
  render(<App />); await screen.findByText(note.body);
  expect(bridge.request).not.toHaveBeenCalledWith("saveNote", expect.anything());
  expect(screen.queryByText(/发现 .* 条未保存内容/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^打开 .* 的笔记$/ }));
  await screen.findByRole("region", { name: "编辑笔记" }); expect(readEditorText()).toBe("旧内容");
  expect(screen.queryByRole("button", { name: /草稿/ })).toBeNull();
});
it("creates independent pages with different identities and returns to the list", async () => {
  render(<App />); await screen.findByText(note.body);
  expect(screen.queryByRole("textbox", { name: "笔记内容" })).toBeNull();
  for (const text of ["第一条随手记", "第二条随手记"]) {
    fireEvent.click(screen.getByRole("button", { name: "新建笔记" }));
    await screen.findByRole("textbox", { name: "笔记内容" });
    expect(window.location.hash).toMatch(/^#\/notes\/[a-f0-9-]+$/);
    replaceEditorText(text); fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "笔记内容" })).toBeNull());
  }
  const writes = bridge.request.mock.calls.filter(([op, params]) => op === "saveNote" && params.body);
  expect(writes.map(([, params]) => params.body)).toEqual(["第一条随手记", "第二条随手记"]);
  expect(writes[0][1].id).not.toBe(writes[1][1].id); expect(window.location.hash).toBe("#/notes");
});

it('opens a direct note route only after recovery has loaded', async () => {
  pendingDrafts = [{ id: note.id, body: '恢复版本', tags: [], baseHash: 'old-hash' }];
  window.history.replaceState(null, '', `#/notes/${note.id}`);
  render(<App />);
  await screen.findByRole('region', { name: '编辑笔记' });
  expect(readEditorText()).toBe('恢复版本');
});
it('flushes a hash navigation and keeps the requested route after first-save URL replacement', async () => {
  render(<App />); await screen.findByText(note.body);
  fireEvent.click(screen.getByRole('button', { name: '新建笔记' }));
  await screen.findByRole('textbox', { name: '笔记内容' }); replaceEditorText('返回前保存');
  act(() => { window.history.replaceState(null, '', '#/settings'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  await screen.findByRole('heading', { name: '设置', level: 1 });
  expect(window.location.hash).toBe('#/settings');
  expect(bridge.request).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '返回前保存' }));
});
it('restores the editor address and input when navigation cannot save', async () => {
  render(<App />); await screen.findByText(note.body);
  fireEvent.click(screen.getByRole('button', { name: '新建笔记' }));
  await screen.findByRole('textbox', { name: '笔记内容' });
  const address = window.location.hash;
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'saveNote' ? Promise.reject(new Error('磁盘不可写')) : implementation(operation, params));
  replaceEditorText('必须保留');
  act(() => { window.history.replaceState(null, '', '#/notes'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  await screen.findByText('磁盘不可写');
  await waitFor(() => expect(window.location.hash).toBe(address));
  expect(readEditorText()).toBe('必须保留');
});

it("dismisses unfiled recovery for this visit without deleting it", async () => {
  pendingDrafts = [{ id: "unfiled", body: "待恢复内容", tags: [], baseHash: null }];
  render(<App />);
  await screen.findByText("发现 1 条未保存内容");
  fireEvent.click(screen.getByRole("button", { name: "稍后处理" }));
  expect(screen.queryByRole("button", { name: "恢复内容" })).toBeNull();
  expect(bridge.request).not.toHaveBeenCalledWith("saveDraft", expect.anything());
  expect(bridge.request).not.toHaveBeenCalledWith("saveNote", expect.anything());
});

it('keeps the breadcrumb in sync with unsaved page titles and empty-title fallback', async () => {
  render(<App />);
  await screen.findByText(note.body);
  fireEvent.click(screen.getByRole('button', { name: '新建笔记' }));
  const title = await screen.findByRole('textbox', { name: '页面标题' });
  const breadcrumb = screen.getByRole('navigation', { name: '当前位置' });
  expect(breadcrumb.textContent).toBe('新页面');
  fireEvent.change(title, { target: { value: '搜索' } });
  expect(breadcrumb.textContent).toBe('搜索');
  fireEvent.change(title, { target: { value: '' } });
  expect(breadcrumb.textContent).toBe('新页面');
});
