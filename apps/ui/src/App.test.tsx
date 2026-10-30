// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, NotePins, VaultStatus } from "@memocard/contracts";
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

async function openRetainedDrafts() {
  fireEvent.click(screen.getByRole("button", { name: "页面操作" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: /^保留草稿/ }));
}

async function createNote() {
  const entry = screen.queryByRole("button", { name: "新建" });
  if (entry) fireEvent.click(entry);
  else {
    fireEvent.click(screen.getByRole("button", { name: "页面操作" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "新建笔记" }));
  }
}

beforeAll(async () => {
  // Keep cold module transformation outside the UI assertion timeout.
  await Promise.all([import("@ui/business/NoteCollection"), import("@ui/business/sidebar"), import("@ui/business/QuickCapture"), import("@ui/business/HomeMascot"), import("@ui/business/Editor")]);
}, 30_000);

beforeEach(() => {
  document.elementFromPoint = () => null;
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
  it("clears quick capture only after saving and refreshes the recent tab from its first page", async () => {
    window.history.replaceState(null, "", "#/home");
    const implementation=bridge.request.getMockImplementation()!;
    let saved:Note | null=null;
    bridge.request.mockImplementation(async(operation,params)=>{
      if(operation==='getStatus')return {...status,capabilities:[...status.capabilities,'getNotePins']};
      if(operation==='getNotePins')return {pins:{[note.id]:'2026-10-14T08:00:00Z'},contentHash:'pins'};
      if(operation==='queryNotes')return {notes:params?.pinned ? [note] : saved ? [saved,note] : [note],nextCursor:null,coverage:status.coverage};
      if(operation==='saveNote')return saved={...note,id:params?.id as string,title:'新内容',body:params?.body as string,tags:[],contentHash:'new-source',relativePath:'新内容.md'};
      return implementation(operation,params);
    });
    const user=userEvent.setup();
    // Finish the initial lazy/editor React commits before timing user interactions.
    await act(async()=>{render(<App />);});
    await screen.findByRole('textbox',{name:'快速输入内容'});
    await user.click(screen.getByRole('tab',{name:/已固定/}));
    await screen.findByRole('button',{name:'打开 新内容'});
    await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'从主页记录的新想法');
    await user.click(screen.getByRole('button',{name:'记录'}));
    await waitFor(()=>expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLDivElement).textContent).toBe(''));
    await waitFor(()=>expect(screen.getByRole('tab',{name:'最近更新'}).getAttribute('aria-selected')).toBe('true'));
    await waitFor(()=>expect(document.querySelector(`[data-note-id="${saved?.id}"]`)).not.toBeNull());
    const last=bridge.request.mock.calls.filter(([op])=>op==='queryNotes').at(-1)?.[1];
    expect(last).toMatchObject({sort:'updatedAt',limit:30});
    expect(last).not.toHaveProperty('cursor');
    expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(1);
  });

  it("defaults home to recent updates and keeps pin actions in detail while returning to the chosen tab", async () => {
    window.history.replaceState(null, "", "#/home");
    localStorage.removeItem("memocard:home-layout");
    const user = userEvent.setup();
    const implementation = bridge.request.getMockImplementation()!;
    let pins: NotePins = {pins:{}, contentHash:"empty-pins"};
    bridge.request.mockImplementation(async (operation, params) => {
      if (operation === "getStatus") return {...status, capabilities:[...status.capabilities,"getNotePins","setNotePinned"]};
      if (operation === "getNotePins") return pins;
      if (operation === "setNotePinned") {
        expect(params).toEqual({id:note.id, pinned:!pins.pins[note.id], baseHash:pins.contentHash, vaultId:status.vaultId});
        pins = {pins:params?.pinned ? {[note.id]:"2026-10-14T08:00:00Z"} : {}, contentHash:params?.pinned ? "pinned" : "unpinned"};
        return pins;
      }
      if (operation === "queryNotes") return {notes:params?.pinned && !pins.pins[note.id] ? [] : [note], nextCursor:null, coverage:status.coverage};
      return implementation(operation, params);
    });
    render(<App />);
    await screen.findByRole("button", {name:"Boop the MemoCard · 黑笔最终版"});
    expect(screen.getByRole("heading", {name:"主页", level:1}).classList.contains("sr-only")).toBe(true);
    await screen.findByRole("button", {name:"打开 新内容"});
    expect(screen.getByRole("tab", {name:"最近更新"}).getAttribute("aria-selected")).toBe("true");
    expect(bridge.request).toHaveBeenCalledWith("queryNotes", expect.objectContaining({sort:"updatedAt"}));
    expect(screen.queryByRole("button", {name:/固定/})).toBeNull();
    await user.click(screen.getByRole("button", {name:"打开 新内容"}));
    await screen.findByRole("textbox", {name:"笔记内容"});
    await user.click(screen.getByRole("button", {name:"固定到主页"}));
    await screen.findByRole("button", {name:"取消固定"});
    expect(bridge.request.mock.calls.some(([op]) => op === "saveNote")).toBe(false);
    await user.click(screen.getByRole("button", {name:"返回主页"}));
    await user.click(await screen.findByRole("tab", {name:/已固定/}));
    await screen.findByRole("button", {name:"打开 新内容"});
    expect(bridge.request).toHaveBeenCalledWith("queryNotes", expect.objectContaining({sort:"pinnedAt", pinned:true}));
    expect(screen.queryByRole("button", {name:/固定/})).toBeNull();
    await user.click(screen.getByRole("button", {name:"打开 新内容"}));
    await user.click(await screen.findByRole("button", {name:"取消固定"}));
    await screen.findByRole("button", {name:"固定到主页"});
    await user.click(screen.getByRole("button", {name:"返回主页"}));
    await screen.findByText("把常用笔记固定在这里");
    expect(screen.getByRole("tab", {name:/已固定/}).getAttribute("aria-selected")).toBe("true");
  }, 15_000);

  it("enables pinning a new note only after its first source save", async () => {
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getStatus"
      ? Promise.resolve({...status, capabilities:[...status.capabilities,"getNotePins","setNotePinned"]})
      : operation === "getNotePins" ? Promise.resolve({pins:{},contentHash:"empty"}) : implementation(operation, params));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", {name:/^打开 /});
    await createNote();
    const pin = await screen.findByRole("button", {name:"固定到主页"});
    expect(pin.hasAttribute("disabled")).toBe(true);
    await user.click(pin);
    expect(bridge.request.mock.calls.some(([op]) => op === "setNotePinned")).toBe(false);
    replaceEditorText("新笔记首次保存", await screen.findByRole("textbox", {name:"笔记内容"}));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("saveNote", expect.objectContaining({body:"新笔记首次保存"})), {timeout:3000});
    await waitFor(() => expect(screen.getByRole("button", {name:"固定到主页"}).hasAttribute("disabled")).toBe(false));
  });

  it("shows indexing progress without disabling editing or replacing unsaved content", async () => {
    vi.useFakeTimers();
    const implementation = bridge.request.getMockImplementation()!;
    let indexing = true;
    bridge.request.mockImplementation((operation, params) => operation === "getStatus"
      ? Promise.resolve({...status, coverage:{...status.coverage, complete:!indexing}, ...(indexing ? {indexing:{phase:"reading", processed:12, total:null}} : {})})
      : implementation(operation, params));
    try {
      render(<App />);
      // Flush the initial list and lazy view before asserting; do not race CI rendering against 1s.
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByText("正在读取笔记库")).toBeTruthy();
      expect(screen.queryByText("部分文件待读取")).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", {name:/^打开 /}));
        await vi.advanceTimersByTimeAsync(0);
      });
      replaceEditorText("Indexing edit stays", screen.getByRole("textbox", {name:"笔记内容"}));
      indexing = false;
      await act(async () => {
        window.dispatchEvent(new CustomEvent("memocard:event", {detail:{type:"statusChanged"}}));
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.queryByText("正在读取笔记库")).toBeNull();
      expect(readEditorText(screen.getByRole("textbox", {name:"笔记内容"}))).toBe("Indexing edit stays");
      await act(async () => { await vi.advanceTimersByTimeAsync(650); });
      expect(bridge.request).toHaveBeenCalledWith("saveNote", expect.objectContaining({body:"Indexing edit stays"}));
    } finally { vi.useRealTimers(); }
  });

  it("polls native index progress and distinguishes a partial empty list from an empty vault", async () => {
    vi.useFakeTimers();
    const implementation = bridge.request.getMockImplementation()!;
    let indexing = true;
    bridge.request.mockImplementation((operation, params) => operation === "getStatus"
      ? Promise.resolve({...status, coverage:{...status.coverage, complete:!indexing}, ...(indexing ? {indexing:{phase:"indexing", processed:3, total:20}} : {})})
      : operation === "queryNotes" ? Promise.resolve({notes:[],nextCursor:null,coverage:status.coverage}) : implementation(operation, params));
    try {
      render(<App />);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(screen.getByText("正在建立索引")).toBeTruthy();
      expect(screen.getByText("笔记正在陆续载入")).toBeTruthy();
      expect(screen.queryByText("记下第一条笔记")).toBeNull();
      expect(screen.getByRole("button", {name:"新建"}).hasAttribute("disabled")).toBe(false);
      indexing = false;
      await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
      expect(screen.queryByText("正在建立索引")).toBeNull();
      expect(bridge.request.mock.calls.filter(([op]) => op === "getStatus").length).toBeGreaterThan(1);
      expect(bridge.request).toHaveBeenCalledWith("getStatus", {background:true});
    } finally { vi.useRealTimers(); }
  });

  it("opens a deep link with its recovery draft while the sidebar list is still loading", async () => {
    window.history.replaceState(null, "", `#/notes/${note.id}`);
    let resolvePage!: (value: unknown) => void;
    const page = new Promise(resolve => { resolvePage = resolve; });
    pendingDrafts = [{id:note.id, body:"Recovered before sidebar", tags:[], baseHash:note.contentHash}];
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "queryNotes" ? page : implementation(operation, params));
    render(<App />);
    await screen.findByRole("textbox", {name:"笔记内容"});
    expect(readEditorText()).toBe("Recovered before sidebar");
    const operations = bridge.request.mock.calls.map(([operation]) => operation);
    expect(operations.indexOf("getNote")).toBeLessThan(operations.indexOf("queryNotes"));
    expect(screen.queryByRole("heading", {name:"所有笔记"})).toBeNull();
    await act(async () => { resolvePage({notes:[note], nextCursor:null, coverage:status.coverage}); });
    expect(readEditorText()).toBe("Recovered before sidebar");
  });

  it("toggles property controls with the keyboard, preserves visible metadata and clears metadata for a new page", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^打开 / }));
    await screen.findByRole('textbox', { name: '笔记内容' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(`${note.id}.md`)).toBeTruthy();
    const expand = screen.getByRole('button', {name:'更多属性'});
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', {name:'笔记内容'})));
    act(() => expand.focus());
    expect(document.activeElement).toBe(expand);
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(expand);
    const properties = screen.getByLabelText('笔记属性');
    expect(properties.textContent).toContain(`${note.id}.md`);
    expect(properties.textContent).toContain('09/28/2026');
    expect(expand.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(expand);
    await user.keyboard(' ');
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText(`${note.id}.md`)).toBeTruthy();
    expect(bridge.request.mock.calls.some(([op]) => op === 'saveNote' || op === 'saveDraft')).toBe(false);
    await createNote();
    await screen.findByRole('region', {name:'新建笔记'});
    await user.click(screen.getByRole('button', {name:'更多属性'}));
    const unsaved = screen.getByLabelText('笔记属性');
    expect(unsaved.textContent).toContain('尚未保存');
    expect(unsaved.textContent).not.toContain(note.id);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(bridge.request.mock.calls.some(([op]) => op === 'saveNote' || op === 'saveDraft')).toBe(false);
  });
  it("renders note cards with open, tag and date affordances", async () => {
    render(<App />);
    const pageTitle = await screen.findByRole("heading", { name: "所有笔记", level: 1 });
    expect(pageTitle.closest(".sr-only")).toBeNull();
    expect(pageTitle.closest(".web-page-content")).not.toBeNull();
    const list = await screen.findByRole("list", { name: "笔记列表" });
    expect(list.getAttribute("data-layout")).toBe("cards");
    expect(list.className).toContain("ui-note-cards");
    const card = list.querySelector('[data-slot="card"]');
    expect(card?.className).toContain("ui-note-card");
    expect(within(card as HTMLElement).getByRole("button", { name: "打开 新内容" })).toBeTruthy();
    expect(within(card as HTMLElement).getByRole("button", { name: "筛选标签 生活" })).toBeTruthy();
    expect(card?.querySelector("time")?.getAttribute("dateTime")).toBe(note.updatedAt);
    expect(screen.queryByText("编辑")).toBeNull();
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
    fireEvent.change(await screen.findByRole("combobox", { name: "搜索笔记" }), { target: { value: "不存在的关键词" } });

    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "不存在的关键词", tags: [], sort: "updatedAt", limit: 30 }));
    expect(await screen.findByText("没有找到相关笔记")).toBeTruthy();
    expect(within(screen.getByRole("dialog", { name: "搜索笔记" })).queryByText(note.body)).toBeNull();
  });

  it("opens a saved note using the latest native content and preserves a pending local draft", async () => {
    const user = userEvent.setup();
    pendingDrafts = [{ id: note.id, body: "尚未提交的草稿文字", tags: ["生活"], baseHash: "draft-base-hash" }];
    render(<App />);
    await screen.findByText(note.body);

    await user.click(screen.getByRole("button", { name: /^打开 / }));

    expect(bridge.request).toHaveBeenCalledWith("getNote", { id: note.id });
    const editor = await screen.findByRole("region", { name: "编辑笔记" });
    expect(readEditorText(await within(editor).findByRole("textbox", { name: "笔记内容" }))).toBe("尚未提交的草稿文字");
    const back = screen.getByRole("button", { name: "返回笔记列表" });
    expect(back.closest("header")).not.toBeNull();
    expect(back.className).not.toContain("md:hidden");
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
    fireEvent.click(screen.getByRole("button", { name: /^打开 / }));
    await createNote();
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("不能被旧响应覆盖的新想法");

    await act(async () => { resolveNote(note); });

    expect(readEditorText()).toBe("不能被旧响应覆盖的新想法");
    expect(bridge.request).not.toHaveBeenCalledWith("saveNote", expect.objectContaining({ body: "", title: "" }));
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
    fireEvent.click(screen.getByRole("button", { name: /^打开 / }));
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    fireEvent.click(await screen.findByRole("button", { name: /查看草稿/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^继续编辑：/ }));

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
    await createNote();
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("先完成当前想法");
    await act(async () => { resolveNote(note); });

    expect(screen.getByText("完成当前记录后，将打开收到的笔记链接。")).toBeTruthy();
    expect(readEditorText()).toBe("先完成当前想法");
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));

    await screen.findByRole("textbox", { name: "笔记内容" });
    await waitFor(() => expect(readEditorText()).toBe(note.body));
    const operations = bridge.request.mock.calls.map(([operation]) => operation);
    expect(operations.indexOf("saveDraft")).toBeLessThan(operations.lastIndexOf("getNote"));
    expect(bridge.request).toHaveBeenCalledWith("saveDraft", expect.objectContaining({ body: "先完成当前想法" }));
  });

  it("flushes current input before opening a received deep link", async () => {
    render(<App />); await screen.findByText(note.body);
    await createNote();
    await screen.findByRole("textbox", { name: "笔记内容" }); replaceEditorText("正在输入");
    act(() => { window.dispatchEvent(new CustomEvent("memocard:open-note", { detail: { id: note.id } })); });
    await screen.findByRole("textbox", { name: "笔记内容" });
    await waitFor(() => expect(readEditorText()).toBe(note.body));
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
    await screen.findByRole("textbox", { name: "笔记内容" });
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
    fireEvent.click(await screen.findByRole("button", { name: /^打开 / }));
    const dialog = await screen.findByRole("region", { name: "编辑笔记" });
    const field = await within(dialog).findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("恢复后继续编辑", field);
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));

    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("saveDraft", { id: note.id, body: "恢复后继续编辑", tags: [], baseHash: "draft-hash", relativePath: offline ? oldPath : newPath }));
  });

  it("uses the mobile Sheet for navigation and dismisses it after navigation or Escape", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("767px"), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "打开导航" }));
    const sheet = await screen.findByRole("dialog", { name: "笔记导航" });

    await user.click(within(sheet).getByRole("button", { name: "所有笔记" }));
    expect(screen.queryByRole("button", { name: "保留的草稿" })).toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
    expect(window.location.hash).toBe("#/notes");

    await user.click(screen.getByRole("button", { name: "打开导航" }));
    await screen.findByRole("dialog", { name: "笔记导航" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
    expect(screen.getByRole("heading", { name: "所有笔记", level: 1 })).toBeTruthy();
  });

  it("explains unsupported browser directory access without offering Mac-dependent actions", async () => {
    bridge.native = false; bridge.browser = true;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getEnvironment" ? Promise.resolve({ platform: "web", phase: "browser", mcpEnabled: false, capabilities: [] }) : operation === "getStatus" ? Promise.resolve({ ...status, connected: false, capabilities: [] }) : implementation(operation, params));
    render(<App />);

    expect(await screen.findByText("通过本机服务连接笔记库")).toBeTruthy();
    expect(screen.getByText(/此浏览器无法直接读写文件夹/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "打开本机 Web" })).toBeNull();
    expect(await screen.findByRole("heading", { name: "通过本机服务连接笔记库" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "打开已有笔记库" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "搜索笔记" })).toBeNull();
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
    expect(screen.getByText(/选择文件夹并授权 \/ AbortError/)).toBeTruthy();
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
    fireEvent.change(screen.getByRole("textbox", { name: "搜索当前视图笔记" }), { target: { value: "旧库关键词" } });
    fireEvent.click(screen.getByRole("button", { name: "筛选标签 生活" }));
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
    await waitFor(() => expect((screen.getByRole("textbox", { name: "搜索当前视图笔记" }) as HTMLInputElement).value).toBe(cancelled ? "旧库关键词" : ""));
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
    await createNote();
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
    await createNote();
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
    await createNote();
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

    await createNote();
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
    await createNote();
    await screen.findByRole("textbox", { name: "笔记内容" });
    replaceEditorText("断开时还在编辑的内容");
    const implementation = bridge.request.getMockImplementation()!;
    const disconnected = Object.assign(new Error("此页面连接的 MemoCard 本机服务已停止。请重新打开；编辑中的内容仍保留在此页面。"), { code: "BRIDGE_UNAVAILABLE", retryable: false });
    bridge.request.mockImplementation((operation, params) => ["getStatus", "saveDraft", "saveNote"].includes(operation) ? Promise.reject(disconnected) : implementation(operation, params));
    fireEvent.focus(window);
    await screen.findByText("等待连接本机服务");
    expect(screen.getByText("连接已断开")).toBeTruthy();
    expect(screen.getByRole("link", { name: "重新打开", hidden: true }).getAttribute("href")).toBe("memocard-service://open-web");
    expect(screen.queryByRole("button", { name: "重试", hidden: true })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "页面操作" }));
    expect(await screen.findByRole("menuitem", { name: "新建笔记" })).toHaveProperty("ariaDisabled", "true");
    await userEvent.keyboard("{Escape}");
    fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "新建笔记" })).getByText(disconnected.message)).toBeTruthy());
    expect(readEditorText()).toBe("断开时还在编辑的内容");
  });

  it.each(["web", "browser"] as const)("refreshes all loaded pages and recovery metadata in %s without collapsing the list", async mode => {
    bridge.native = false; bridge[mode] = true;
    const second = { ...note, id: "second-note", body: "第二页的记录" };
    const changed = { ...second, body: "第二页外部更新", tags: ["外部标签"] };
    const added = { ...note, id: "added-note", body: "外部新增记录" };
    let external = false;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "queryNotes") return Promise.resolve({ notes: params?.cursor ? [external ? changed : second] : [external ? added : note], nextCursor: params?.cursor ? null : external ? "fresh-page-two" : "page-two", coverage: status.coverage });
      if (operation === "listTags" && external) return Promise.resolve({ tags: [{ name: "外部标签", count: 1 }] });
      return implementation(operation, params);
    });
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));
    await screen.findByText(second.body);
    external = true;
    pendingDrafts = [{id:"recovered",body:"外部恢复草稿",tags:[],baseHash:null}];
    fireEvent.focus(window);
    await screen.findByText(changed.body);
    expect(screen.getByText(added.body)).toBeTruthy();
    expect(screen.queryByText(note.body)).toBeNull();
    expect(screen.queryByText(second.body)).toBeNull();
    expect(within(screen.getByRole("list", {name:"笔记列表"})).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("有尚未完成的草稿")).toBeTruthy();
    expect(bridge.request).toHaveBeenCalledWith("queryNotes", expect.objectContaining({cursor:"fresh-page-two"}));
  });

  it("restarts a stale refresh cursor without showing a partial or duplicated list", async () => {
    bridge.native = false; bridge.web = true;
    const second = {...note,id:"second",body:"第二页原文"}, changed = {...second,body:"第二页最新版本"};
    let phase = "initial", failed = false;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation !== "queryNotes") return implementation(operation, params);
      if (phase === "initial") return Promise.resolve({notes:params?.cursor ? [second] : [note],nextCursor:params?.cursor ? null : "old",coverage:status.coverage});
      if (params?.cursor === "stale" && !failed) { failed = true; phase = "stable"; return Promise.reject(Object.assign(new Error("changed"),{code:"STALE_CURSOR"})); }
      return Promise.resolve({notes:params?.cursor ? [changed] : [note],nextCursor:params?.cursor ? null : phase === "changing" ? "stale" : "fresh",coverage:status.coverage});
    });
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button", {name:"加载更多"}));
    await screen.findByText(second.body);
    phase = "changing";
    fireEvent.focus(window);
    await screen.findByText(changed.body);
    expect(failed).toBe(true);
    expect(within(screen.getByRole("list",{name:"笔记列表"})).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("连接已断开")).toBeNull();
  });

  it("refreshes an expired load-more cursor and allows continuing with the new cursor", async () => {
    bridge.native = false; bridge.web = true;
    const second = {...note,id:"second",body:"刷新后第二页"};
    let version = 0;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation !== "queryNotes") return implementation(operation, params);
      if (params?.cursor === "old") {version++; return Promise.reject(Object.assign(new Error("changed"),{code:"STALE_CURSOR"}));}
      return Promise.resolve({notes:params?.cursor ? [second] : [note],nextCursor:params?.cursor ? null : version ? "new" : "old",coverage:status.coverage});
    });
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button",{name:"加载更多"}));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes",expect.not.objectContaining({cursor:expect.anything()})));
    await waitFor(() => expect((screen.getByRole("button",{name:"加载更多"}) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText("changed")).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"加载更多"}));
    await screen.findByText(second.body);
    expect(bridge.request).toHaveBeenCalledWith("queryNotes",expect.objectContaining({cursor:"new"}));
  });

  it("replays a native change notification received during loading more", async () => {
    const second = {...note,id:"second",body:"加载中的第二页"}, updated = {...second,body:"事件后的第二页"};
    let resolve!: (value: unknown) => void, external = false;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation !== "queryNotes") return implementation(operation, params);
      if (params?.cursor && !external) return new Promise(value => {resolve = value;});
      return Promise.resolve({notes:params?.cursor ? [updated] : [note],nextCursor:params?.cursor ? null : "page-two",coverage:status.coverage});
    });
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button",{name:"加载更多"}));
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    external = true;
    act(() => window.dispatchEvent(new CustomEvent("memocard:event",{detail:{type:"notesChanged"}})));
    await act(async () => resolve({notes:[second],nextCursor:null,coverage:status.coverage}));
    await screen.findByText(updated.body);
    expect(screen.queryByText(second.body)).toBeNull();
  });

  it("keeps the existing list during repeated cursor churn and clears the warning after recovery", async () => {
    bridge.native = false; bridge.web = true;
    const second = {...note,id:"second",body:"保留的第二页"};
    let changing = false, failures = 0;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation !== "queryNotes") return implementation(operation, params);
      if (changing && params?.cursor) { failures++; return Promise.reject(Object.assign(new Error("持续外部变更"),{code:"STALE_CURSOR"})); }
      return Promise.resolve({notes:params?.cursor ? [second] : [note],nextCursor:params?.cursor ? null : "next",coverage:status.coverage});
    });
    render(<App />);
    await screen.findByText(note.body);
    fireEvent.click(screen.getByRole("button",{name:"加载更多"}));
    await screen.findByText(second.body);
    changing = true;
    fireEvent.focus(window);
    await screen.findByText("持续外部变更");
    expect(failures).toBe(3);
    expect(screen.getByText(second.body)).toBeTruthy();
    expect(screen.queryByText("连接已断开")).toBeNull();
    changing = false;
    fireEvent.focus(window);
    await waitFor(() => expect(screen.queryByText("持续外部变更")).toBeNull());
  });

  it("anchors the visible note when refreshed pages insert rows above it", async () => {
    bridge.native = false; bridge.web = true;
    const added = {...note,id:"added",body:"上方新笔记"};
    let external = false;
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "queryNotes" ? Promise.resolve({notes:external ? [added,note] : [note],nextCursor:null,coverage:status.coverage}) : implementation(operation, params));
    render(<App />);
    await screen.findByText(note.body);
    const row = screen.getByText(note.body).closest("li")!;
    let container = row.parentElement!;
    while (!container.classList.contains("web-app-scroll")) container = container.parentElement!;
    container.scrollTop = 100;
    vi.spyOn(container,"getBoundingClientRect").mockReturnValue(new DOMRect(0,0,600,700));
    vi.spyOn(row,"getBoundingClientRect").mockImplementation(() => new DOMRect(0,Array.from(row.parentElement!.children).indexOf(row)*100,600,100));
    external = true;
    fireEvent.focus(window);
    await screen.findByText(added.body);
    expect(container.scrollTop).toBe(200);
  });

  it("serializes loading more against a pending refresh so cursor chains cannot mix", async () => {
    bridge.native = false; bridge.web = true;
    let refreshing = false, resolve!: (value: unknown) => void;
    const second = {...note,id:"second",body:"新快照第二页"};
    const implementation = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation !== "queryNotes") return implementation(operation, params);
      if (refreshing && !params?.cursor) return new Promise(value => {resolve = value;});
      return Promise.resolve({notes:params?.cursor ? [second] : [note],nextCursor:params?.cursor ? null : "old",coverage:status.coverage});
    });
    render(<App />);
    await screen.findByText(note.body);
    refreshing = true;
    fireEvent.focus(window);
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    const more = screen.getByRole("button",{name:"加载更多"});
    expect((more as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(more);
    expect(bridge.request).not.toHaveBeenCalledWith("queryNotes",expect.objectContaining({cursor:"old"}));
    await act(async () => resolve({notes:[note],nextCursor:"new",coverage:status.coverage}));
    expect((more as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(more);
    await screen.findByText(second.body);
    expect(bridge.request).toHaveBeenCalledWith("queryNotes",expect.objectContaining({cursor:"new"}));
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
  expect(screen.queryByText(/有尚未完成的草稿/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^打开 / }));
  // The editor region mounts before Tiptap creates its deferred content textbox.
  await screen.findByRole("textbox", { name: "笔记内容" }); expect(readEditorText()).toBe("旧内容");
  expect(bridge.request).not.toHaveBeenCalledWith("saveNote", expect.anything());
  expect(screen.queryByRole("button", { name: /草稿/ })).toBeNull();
});
it('opens source notes and exposes individual recovery issues while keeping good versions selectable',async()=>{
  window.history.replaceState(null,'',`#/notes/${note.id}`);
  const implementation=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='getDrafts' ? {drafts:['Good A','Good B'].map((body,index)=>({id:note.id,body,tags:[],baseHash:note.contentHash,draftKey:`client-${index}`})),issues:[{path:'/local/drafts/broken.json',code:'CORRUPT_DRAFT',message:'原文件已保留'}]} : implementation(op,params));
  render(<App />);await screen.findByRole('textbox',{name:'笔记内容'});
  expect(readEditorText()).toBe(note.body);expect(screen.getByText('/local/drafts/broken.json')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'返回笔记列表'}));
  await screen.findByText('有尚未完成的草稿');
  fireEvent.click(screen.getByRole('button',{name:'查看草稿'}));
  const dialog=await screen.findByRole('dialog',{name:'保留的草稿'});
  expect(within(dialog).getByRole('button',{name:'继续编辑：Good A'})).toBeTruthy();expect(within(dialog).getByRole('button',{name:'继续编辑：Good B'})).toBeTruthy();
});
it('does not block a source deep link when the entire recovery request fails',async()=>{
  window.history.replaceState(null,'',`#/notes/${note.id}`);
  const implementation=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='getDrafts' ? Promise.reject(new Error('恢复目录暂不可读')) : implementation(op,params));
  render(<App />);await screen.findByRole('textbox',{name:'笔记内容'});
  expect(readEditorText()).toBe(note.body);expect(screen.getByText('恢复目录暂不可读')).toBeTruthy();
  expect(screen.queryByText('连接已断开')).toBeNull();
});
it('retains historical drafts after dismissing reminders and keeps their recovery entry after reload',async()=>{
  const implementation=bridge.request.getMockImplementation()!;
  let dismissed=false;
  const historical={id:note.id,body:'Historical changed body',tags:[],baseHash:note.contentHash,draftKey:note.id,revision:'original-version',unscoped:true};
  bridge.request.mockImplementation((op,params)=>{
    if(op==='getStatus')return {...status,capabilities:[...status.capabilities,'dismissDraftReminder']};
    if(op==='getDrafts')return {drafts:[],unscopedDrafts:[{...historical,reminderDismissed:dismissed}]};
    if(op==='dismissDraftReminder'){dismissed=true;return {reminderDismissed:true};}
    return implementation(op,params);
  });
  render(<App />);await screen.findByText('有尚未完成的草稿');
  fireEvent.click(screen.getByRole('button',{name:'查看草稿'}));
  const dialog=await screen.findByRole('dialog',{name:'保留的草稿'});
  expect(within(dialog).getByText('所属笔记库待确认')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button',{name:'不再提醒'}));
  await waitFor(()=>expect(within(dialog).getByText('已关闭提醒')).toBeTruthy());
  expect(bridge.request).toHaveBeenCalledWith('dismissDraftReminder',{id:note.id,draftKey:note.id,revision:'original-version',unscoped:true});
  cleanup();render(<App />);await screen.findByText(note.body);
  expect(screen.queryByText('有尚未完成的草稿')).toBeNull();
  await openRetainedDrafts();
  const retained=await screen.findByRole('dialog',{name:'保留的草稿'});
  fireEvent.click(within(retained).getByRole('button',{name:/Historical changed body/}));
  await screen.findByRole('textbox',{name:'笔记内容'});
  expect(readEditorText()).toBe(historical.body);
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(0);
});
it('keeps historical reminders visible and drafts recoverable when saving the review fails',async()=>{
  const implementation=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>{
    if(op==='getStatus')return {...status,capabilities:[...status.capabilities,'dismissDraftReminder']};
    if(op==='getDrafts')return {drafts:[],unscopedDrafts:[{id:note.id,body:'Historical recovery',tags:[],baseHash:note.contentHash,draftKey:note.id,revision:'original',unscoped:true}]};
    if(op==='dismissDraftReminder')return Promise.reject(new Error('提醒设置未能保存，请重试'));
    return implementation(op,params);
  });
  render(<App />);await screen.findByText('有尚未完成的草稿');
  fireEvent.click(screen.getByRole('button',{name:'查看草稿'}));
  const dialog=await screen.findByRole('dialog',{name:'保留的草稿'});
  fireEvent.click(within(dialog).getByRole('button',{name:'不再提醒'}));
  expect((await within(dialog).findByRole('alert')).textContent).toContain('提醒设置未能保存，请重试');
  expect(within(dialog).queryByText('已关闭提醒')).toBeNull();
  expect(screen.getByText('有尚未完成的草稿')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button',{name:/Historical recovery/}));
  await screen.findByRole('textbox',{name:'笔记内容'});expect(readEditorText()).toBe('Historical recovery');
});
it('requires explicit selection of an old unscoped draft instead of restoring it into a copied vault',async()=>{
  const implementation=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='getDrafts' ? {drafts:[],unscopedDrafts:[{id:note.id,body:'Old unassigned recovery',tags:[],baseHash:note.contentHash,draftKey:note.id,revision:'legacy',unscoped:true}]} : implementation(op,params));
  render(<App />);await screen.findByText(note.body);
  fireEvent.click(screen.getByRole('button',{name:/^打开 /}));
  await screen.findByRole('textbox',{name:'笔记内容'});expect(readEditorText()).toBe(note.body);
  fireEvent.click(screen.getByRole('button',{name:'返回笔记列表'}));await screen.findByText('有尚未完成的草稿');
  fireEvent.click(screen.getByRole('button',{name:'查看草稿'}));
  const dialog=await screen.findByRole('dialog',{name:'保留的草稿'});
  expect(within(dialog).getByText('所属笔记库待确认')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button',{name:/Old unassigned recovery/}));
  await screen.findByRole('textbox',{name:'笔记内容'});expect(readEditorText()).toBe('Old unassigned recovery');
});
it('ignores empty cleanup records when opening the saved source',async()=>{
  pendingDrafts=[{id:note.id,title:'',body:'',tags:[],baseHash:null,draftKey:'empty-cleanup',updatedAt:'2026-10-12T00:00:00Z'}];
  render(<App />);await screen.findByText(note.body);
  expect(screen.queryByText(/有尚未完成的草稿/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/^打开 /}));
  await screen.findByRole('textbox',{name:'笔记内容'});expect(readEditorText()).toBe(note.body);
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(0);
});
it('keeps multiple client versions selectable instead of automatically choosing one',async()=>{
  pendingDrafts=['Window A unsaved','Window B unsaved'].map((body,index)=>({id:note.id,body,tags:[],baseHash:'old-hash',draftKey:`client-${index}`,revision:`revision-${index}`}));
  render(<App />);await screen.findByText('有尚未完成的草稿');
  fireEvent.click(screen.getByRole('button',{name:/^打开 /}));
  await screen.findByRole('textbox',{name:'笔记内容'});expect(readEditorText()).toBe(note.body);
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button',{name:'返回笔记列表'}));
  await screen.findByRole('list',{name:'笔记列表'});
  fireEvent.click(screen.getByRole('button',{name:'查看草稿'}));
  const dialog=await screen.findByRole('dialog',{name:'保留的草稿'});
  expect(within(dialog).getByRole('button',{name:'继续编辑：Window A unsaved'})).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button',{name:'继续编辑：Window B unsaved'}));
  await screen.findByRole('textbox',{name:'笔记内容'});expect(readEditorText()).toBe('Window B unsaved');
});
it('distinguishes recovered versions with the same title and body by pending property values',async()=>{
  pendingDrafts=['Client A pending','Client B pending'].map((value,index)=>({id:note.id,title:'Same title',body:note.body,tags:[],baseHash:'old-hash',draftKey:`client-${index}`,revision:`revision-${index}`,updatedAt:`2026-10-12T06:07:4${index}.000Z`,pendingProperties:[{name:'summary',type:'text',value}]}));
  render(<App />);await screen.findByText('有尚未完成的草稿');
  fireEvent.click(screen.getByRole('button',{name:'查看草稿'}));
  const dialog=await screen.findByRole('dialog',{name:'保留的草稿'});
  expect(within(dialog).getByText(/summary：Client A pending/)).toBeTruthy();
  expect(within(dialog).getByText(/summary：Client B pending/)).toBeTruthy();
});
it("creates independent pages with different identities and returns to the list", async () => {
  render(<App />); await screen.findByText(note.body);
  expect(screen.queryByRole("textbox", { name: "笔记内容" })).toBeNull();
  for (const text of ["第一条随手记", "第二条随手记"]) {
    await createNote();
    await screen.findByRole("textbox", { name: "笔记内容" });
    expect(window.location.hash).toBe('#/notes/new');
    replaceEditorText(text); fireEvent.click(screen.getByRole("button", { name: "返回笔记列表" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "笔记内容" })).toBeNull());
  }
  const writes = bridge.request.mock.calls.filter(([op, params]) => op === "saveNote" && params.body);
  expect(writes.map(([, params]) => params.body)).toEqual(["第一条随手记", "第二条随手记"]);
  expect(writes[0][1].id).not.toBe(writes[1][1].id); expect(window.location.hash).toBe("#/notes");
});
it('returns from a blank new page to the list without saving a file or recovery', async () => {
  render(<App />); await screen.findByText(note.body);
  await createNote();
  await screen.findByRole('textbox', { name: '页面标题' });
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await screen.findByRole('list', { name: '笔记列表' });
  expect(window.location.hash).toBe('#/notes');
  expect(bridge.request).not.toHaveBeenCalledWith('saveNote', expect.anything());
  expect(bridge.request).not.toHaveBeenCalledWith('saveDraft', expect.anything());
});

it('opens a direct note route only after recovery has loaded', async () => {
  pendingDrafts = [{ id: note.id, body: '恢复版本', tags: [], baseHash: 'old-hash' }];
  window.history.replaceState(null, '', `#/notes/${note.id}`);
  render(<App />);
  await screen.findByRole('textbox', { name: '笔记内容' });
  expect(readEditorText()).toBe('恢复版本');
});
it('keeps a refreshed note route in the detail loading view until recovery and the note are ready', async () => {
  bridge.native = false; bridge.web = true;
  const recovery: Draft = { id: note.id, body: '恢复版本', tags: [], baseHash: 'old-hash' };
  let resolveRecovery!: (value: { drafts: Draft[] }) => void;
  let resolveNote!: (value: Note) => void;
  const recoveryResult = new Promise<{ drafts: Draft[] }>(resolve => { resolveRecovery = resolve; });
  const noteResult = new Promise<Note>(resolve => { resolveNote = resolve; });
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getDrafts' ? recoveryResult : operation === 'getNote' ? noteResult : implementation(operation, params));
  const address = `#/notes/${note.id}`;
  window.history.replaceState(null, '', address);
  render(<App />);
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '所有笔记' })).toBeNull();
  await waitFor(() => expect(bridge.request).toHaveBeenCalledWith('getDrafts'));
  expect(bridge.request).toHaveBeenCalledWith('getNote', { id: note.id });
  expect(screen.queryByRole('textbox', { name: '笔记内容' })).toBeNull();
  await act(async () => { resolveRecovery({ drafts: [recovery] }); });
  await waitFor(() => expect(bridge.request).toHaveBeenCalledWith('getNote', { id: note.id }));
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  expect(screen.queryByRole('list', { name: '笔记列表' })).toBeNull();
  expect(screen.queryByRole('heading', { name: '所有笔记' })).toBeNull();
  expect(window.location.hash).toBe(address);
  await act(async () => { resolveNote(note); });
  await screen.findByRole('textbox', { name: '笔记内容' });
  expect(screen.queryByRole('status', { name: '正在读取内容' })).toBeNull();
  expect(readEditorText()).toBe(recovery.body);
  expect(window.location.hash).toBe(address);
});
it('exits detail loading and shows the error when a direct note cannot be read', async () => {
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? Promise.reject(new Error('笔记不存在')) : implementation(operation, params));
  window.history.replaceState(null, '', `#/notes/${note.id}`);
  render(<App />);
  await screen.findByText('笔记不存在');
  expect(screen.queryByRole('status', { name: '正在读取内容' })).toBeNull();
  expect(screen.queryByRole('list', { name: '笔记列表' })).toBeNull();
  expect(screen.getAllByRole('button', { name: '返回笔记列表' })[0]).toBeTruthy();
  expect(window.location.hash).toBe(`#/notes/${note.id}`);
});
it('flushes a hash navigation and keeps the requested route after first-save URL replacement', async () => {
  render(<App />); await screen.findByText(note.body);
  await createNote();
  await screen.findByRole('textbox', { name: '笔记内容' }); replaceEditorText('返回前保存');
  act(() => { window.history.replaceState(null, '', '#/settings'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  await screen.findByRole('heading', { name: '设置', level: 1 });
  expect(window.location.hash).toBe('#/settings');
  expect(bridge.request).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '返回前保存' }));
});
it('restores the editor address and input when navigation cannot save', async () => {
  render(<App />); await screen.findByText(note.body);
  await createNote();
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
  await screen.findByText("有尚未完成的草稿");
  fireEvent.click(screen.getByRole("button", { name: "稍后处理" }));
  expect(screen.queryByRole("button", { name: "查看草稿" })).toBeNull();
  expect(bridge.request).not.toHaveBeenCalledWith("saveDraft", expect.anything());
  expect(bridge.request).not.toHaveBeenCalledWith("saveNote", expect.anything());
});
it('ignores blank new-page recovery while retaining title-only and cleared existing notes', async () => {
  pendingDrafts = [
    { id: 'blank', title: '', body: '', tags: [], baseHash: null },
    { id: 'whitespace', title: '  ', body: '\n\t', tags: [], baseHash: null },
    { id: 'title-only', title: '保留标题', body: '', tags: [], baseHash: null },
    { id: note.id, title: '', body: '', tags: [], baseHash: 'old-hash' },
  ];
  render(<App />);
  await screen.findByText('有尚未完成的草稿');
  fireEvent.click(screen.getByRole('button', { name: '查看草稿' }));
  fireEvent.click(await screen.findByRole('button', { name: /^继续编辑：/ }));
  const title = await screen.findByRole('textbox', { name: '页面标题' });
  expect((title as HTMLTextAreaElement).value).toBe('保留标题');
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await screen.findByRole('list', { name: '笔记列表' });
  fireEvent.click(screen.getByRole('button', { name: /^打开 / }));
  await screen.findByRole('textbox', { name: '笔记内容' });
  expect(readEditorText()).toBe('');
});

it('uses all notes for a direct detail link instead of choosing a note tag', async () => {
  window.history.replaceState(null, "", `#/notes/${note.id}`);
  render(<App />);
  await screen.findByRole('textbox', { name: '笔记内容' });
  const breadcrumb = screen.getByRole('navigation', { name: '当前位置' });
  expect(breadcrumb.textContent).toBe('所有笔记');
  fireEvent.click(within(breadcrumb).getByRole('button', { name: '所有笔记' }));
  await screen.findByRole('list', { name: '笔记列表' });
  expect(window.location.hash).toBe('#/notes');
});

it('keeps the detail breadcrumb on its source while the page title changes', async () => {
  render(<App />);
  await screen.findByText(note.body);
  await createNote();
  const title = await screen.findByRole('textbox', { name: '页面标题' });
  const breadcrumb = screen.getByRole('navigation', { name: '当前位置' });
  expect(breadcrumb.textContent).toBe('所有笔记');
  fireEvent.change(title, { target: { value: '搜索' } });
  expect(breadcrumb.textContent).toBe('所有笔记');
  fireEvent.change(title, { target: { value: '' } });
  expect(breadcrumb.textContent).toBe('所有笔记');
});
it('leaves an untouched page created under a tag without writing a note or recovery', async () => {
  render(<App />); await screen.findByText(note.body);
  fireEvent.click(screen.getByRole('button', { name: '生活' }));
  await screen.findByRole('heading', { name: '# 生活', level: 1 });
  await createNote();
  const title = await screen.findByRole('textbox', { name: '页面标题' });
  expect((title as HTMLTextAreaElement).value).toBe('');
  expect(readEditorText()).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '更多属性' }));
  expect(screen.getByLabelText('笔记属性').textContent).toContain('生活');
  fireEvent.click(within(screen.getByRole('navigation', { name: '主要导航' })).getByRole('button', { name: '所有笔记' }));
  await screen.findByRole('list', { name: '笔记列表' });
  expect(bridge.request).not.toHaveBeenCalledWith('saveNote', expect.anything());
  expect(bridge.request).not.toHaveBeenCalledWith('saveDraft', expect.anything());
});


it('enters detail loading immediately on a list click and edits only the latest read', async () => {
  let resolveNote!: (value: Note) => void;
  const result = new Promise<Note>(resolve => { resolveNote = resolve; });
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? result : implementation(operation, params));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^打开 / }));
  expect(window.location.hash).toBe(`#/notes/${note.id}`);
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  expect(screen.queryByRole('list', { name: '笔记列表' })).toBeNull();
  expect(screen.queryByRole('textbox', { name: '笔记内容' })).toBeNull();
  expect(bridge.request).not.toHaveBeenCalledWith('saveDraft', expect.anything());
  await act(async () => { resolveNote({ ...note, body: '读取后的最新正文', contentHash: 'latest-hash' }); });
  await screen.findByRole('textbox', { name: '笔记内容' });
  expect(readEditorText()).toBe('读取后的最新正文');
  expect(screen.queryByRole('status', { name: '正在读取内容' })).toBeNull();
  replaceEditorText('继续编辑最新正文');
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(() => expect(bridge.request).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '继续编辑最新正文', baseHash: 'latest-hash' })));
});

it.each(['success', 'failure'])('cancels a loading detail on return and ignores its late %s', async outcome => {
  let resolveNote!: (value: Note) => void;
  let rejectNote!: (cause: Error) => void;
  const result = new Promise<Note>((resolve, reject) => { resolveNote = resolve; rejectNote = reject; });
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? result : implementation(operation, params));
  render(<App />);
  const card = await screen.findByRole('button', { name: /^打开 / });
  const scroll = card.closest('.web-app-scroll') as HTMLElement;
  scroll.scrollTop = 480;
  card.focus();
  fireEvent.click(card);
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  const returned = await screen.findByRole('button', { name: /^打开 / });
  expect(window.location.hash).toBe('#/notes');
  await waitFor(() => expect(scroll.scrollTop).toBe(480));
  await waitFor(() => expect(document.activeElement).toBe(returned));
  await act(async () => { if (outcome === 'success') resolveNote(note); else rejectNote(new Error('已取消的读取失败')); });
  expect(screen.queryByRole('region', { name: '编辑笔记' })).toBeNull();
  expect(screen.queryByText('已取消的读取失败')).toBeNull();
  expect(screen.getByRole('button', { name: /^打开 / }).hasAttribute('disabled')).toBe(false);
  expect(bridge.request).not.toHaveBeenCalledWith('saveNote', expect.anything());
});

it('keeps the second list selection when the first read finishes after returning and switching', async () => {
  let resolveOld!: (value: Note) => void;
  let resolveNew!: (value: Note) => void;
  const oldResult = new Promise<Note>(resolve => { resolveOld = resolve; });
  const newResult = new Promise<Note>(resolve => { resolveNew = resolve; });
  const other = { ...note, id: '11111111-2222-4333-8444-555555555555', body: '另一篇笔记' };
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? params?.id === note.id ? oldResult : newResult : operation === 'queryNotes' ? Promise.resolve({ notes: [note, other], nextCursor: null, coverage: status.coverage }) : implementation(operation, params));
  render(<App />);
  await screen.findByText(other.body);
  fireEvent.click(screen.getAllByRole('button', { name: /^打开 / })[0]);
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await screen.findByText(other.body);
  fireEvent.click(screen.getAllByRole('button', { name: /^打开 / })[1]);
  expect(window.location.hash).toBe(`#/notes/${other.id}`);
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  await act(async () => { resolveNew(other); });
  await screen.findByRole('textbox', { name: '笔记内容' });
  replaceEditorText('第二篇尚未提交的输入');
  await act(async () => { resolveOld(note); });
  expect(readEditorText()).toBe('第二篇尚未提交的输入');
  expect(window.location.hash).toBe(`#/notes/${other.id}`);
});

it('cancels a loading list selection on browser back without reopening after the response', async () => {
  let resolveNote!: (value: Note) => void;
  const result = new Promise<Note>(resolve => { resolveNote = resolve; });
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? result : implementation(operation, params));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^打开 / }));
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  act(() => { window.history.replaceState(null, '', '#/notes'); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  await screen.findByRole('button', { name: /^打开 / });
  await act(async () => { resolveNote(note); });
  expect(window.location.hash).toBe('#/notes');
  expect(screen.queryByRole('region', { name: '编辑笔记' })).toBeNull();
});

it('shows a readable detail failure and retries the same latest read without refreshing the list', async () => {
  let rejectNote!: (cause: Error) => void;
  let resolveRetry!: (value: Note) => void;
  const result = new Promise<Note>((_, reject) => { rejectNote = reject; });
  const retry = new Promise<Note>(resolve => { resolveRetry = resolve; });
  let reads = 0;
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? ++reads === 1 ? result : retry : implementation(operation, params));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^打开 / }));
  const listReads = bridge.request.mock.calls.filter(([op]) => op === 'queryNotes').length;
  await act(async () => { rejectNote(new Error('源文件暂时不可读')); });
  expect(await screen.findByText('源文件暂时不可读')).toBeTruthy();
  expect(screen.queryByRole('status', { name: '正在读取内容' })).toBeNull();
  expect(screen.queryByRole('list', { name: '笔记列表' })).toBeNull();
  expect(screen.queryByRole('textbox', { name: '笔记内容' })).toBeNull();
  expect(screen.getAllByRole('button', { name: '返回笔记列表' })[0]).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  await act(async () => { resolveRetry({ ...note, body: '重试后取得最新正文' }); });
  await screen.findByRole('textbox', { name: '笔记内容' });
  expect(readEditorText()).toBe('重试后取得最新正文');
  expect(bridge.request.mock.calls.filter(([op]) => op === 'queryNotes').length).toBe(listReads);
  expect(reads).toBe(2);
});

it('recovers a delayed draft with its original base hash and keeps it editable after a save conflict', async () => {
  pendingDrafts = [{ id: note.id, body: '未提交的恢复正文', tags: [], baseHash: 'draft-base-hash' }];
  let resolveNote!: (value: Note) => void;
  const result = new Promise<Note>(resolve => { resolveNote = resolve; });
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? result : operation === 'saveNote' ? Promise.reject(Object.assign(new Error('外部内容已变化'), { code: 'HASH_CONFLICT' })) : implementation(operation, params));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^打开 / }));
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: '笔记内容' })).toBeNull();
  await act(async () => { resolveNote({ ...note, body: '外部最新正文', contentHash: 'external-hash' }); });
  await screen.findByRole('textbox', { name: '笔记内容' });
  expect(readEditorText()).toBe('未提交的恢复正文');
  replaceEditorText('冲突时也必须保留的草稿');
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  expect(await screen.findByText('外部内容已变化')).toBeTruthy();
  expect(bridge.request).toHaveBeenCalledWith('saveDraft', expect.objectContaining({ body: '冲突时也必须保留的草稿', baseHash: 'draft-base-hash' }));
  expect(bridge.request).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '冲突时也必须保留的草稿', baseHash: 'draft-base-hash' }));
  expect(readEditorText()).toBe('冲突时也必须保留的草稿');
  expect(window.location.hash).toBe(`#/notes/${note.id}`);
});


it('opens the newest hash route while the previous list read is pending and ignores a stale failure', async () => {
  let rejectOld!: (cause: Error) => void;
  let resolveNew!: (value: Note) => void;
  const oldResult = new Promise<Note>((_, reject) => { rejectOld = reject; });
  const newResult = new Promise<Note>(resolve => { resolveNew = resolve; });
  const other = { ...note, id: '11111111-2222-4333-8444-555555555555', body: '连续导航的最新内容' };
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? params?.id === note.id ? oldResult : newResult : implementation(operation, params));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^打开 / }));
  act(() => { window.history.replaceState(null, '', `#/notes/${other.id}`); window.dispatchEvent(new HashChangeEvent('hashchange')); });
  await waitFor(() => expect(bridge.request).toHaveBeenCalledWith('getNote', { id: other.id }));
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  expect(window.location.hash).toBe(`#/notes/${other.id}`);
  await act(async () => { rejectOld(new Error('过时的文件读取失败')); });
  expect(screen.getByRole('status', { name: '正在读取内容' })).toBeTruthy();
  expect(screen.queryByText('过时的文件读取失败')).toBeNull();
  await act(async () => { resolveNew(other); });
  await screen.findByRole('textbox', { name: '笔记内容' });
  expect(readEditorText()).toBe(other.body);
  expect(window.location.hash).toBe(`#/notes/${other.id}`);
});

it('returns from a failed detail without saving or leaving the list disabled', async () => {
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation, params) => operation === 'getNote' ? Promise.reject(new Error('无法读取目标笔记')) : implementation(operation, params));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /^打开 / }));
  await screen.findByText('无法读取目标笔记');
  fireEvent.click(screen.getAllByRole('button', { name: '返回笔记列表' })[0]);
  const card = await screen.findByRole('button', { name: /^打开 / });
  expect(card.hasAttribute('disabled')).toBe(false);
  expect(screen.queryByText('无法读取目标笔记')).toBeNull();
  expect(screen.queryByRole('status', { name: '正在读取内容' })).toBeNull();
  expect(window.location.hash).toBe('#/notes');
  expect(bridge.request).not.toHaveBeenCalledWith('saveNote', expect.anything());
});


it('confirms deletion of one exact draft, retains failures, and updates the draft count',async()=>{
  window.history.replaceState(null,'','#/home');
  const implementation=bridge.request.getMockImplementation()!;
  const first={id:note.id,body:'Delete this draft',tags:[],baseHash:null,draftKey:'first',revision:'v1'};
  const sibling={...first,body:'Keep this draft',draftKey:'second',revision:'v2'};
  let records=[first,sibling],fail=true;
  bridge.request.mockImplementation((op,params)=>{
    if(op==='getStatus')return {...status,capabilities:[...status.capabilities,'deleteDraft']};
    if(op==='getDrafts')return {drafts:records};
    if(op==='deleteDraft'){
      if(fail)return Promise.reject(new Error('草稿已变化，请刷新草稿后重试。'));
      records=records.filter(draft=>draft.draftKey!==params?.draftKey);return {deleted:true};
    }
    return implementation(op,params);
  });
  const user=userEvent.setup();render(<App />);
  await user.click(await screen.findByRole('button',{name:'查看草稿'}));
  await user.click(await screen.findByRole('button',{name:'删除草稿：Delete this draft'}));
  expect(await screen.findByRole('heading',{name:'删除这条草稿？'})).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'取消'}));
  await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'删除草稿：Delete this draft'})));
  expect(bridge.request.mock.calls.filter(([op])=>op==='deleteDraft')).toHaveLength(0);
  await user.click(screen.getByRole('button',{name:'删除草稿：Delete this draft'}));
  await user.click(screen.getByRole('button',{name:'确认删除'}));
  expect((await screen.findByRole('alert')).textContent).toContain('草稿已变化，请刷新草稿后重试。');
  expect(screen.getByRole('button',{name:'继续编辑：Delete this draft'})).toBeTruthy();
  fail=false;
  await user.click(screen.getByRole('button',{name:'删除草稿：Delete this draft'}));
  await user.click(screen.getByRole('button',{name:'确认删除'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'继续编辑：Delete this draft'})).toBeNull());
  expect(screen.getByRole('button',{name:'继续编辑：Keep this draft'})).toBeTruthy();
  expect(bridge.request).toHaveBeenCalledWith('deleteDraft',{id:first.id,draftKey:'first',revision:'v1',unscoped:undefined,vaultId:status.vaultId});
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(0);
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button',{name:'稍后处理'}));
  fireEvent.click(screen.getByRole("button", { name: "页面操作" }));
  expect(await screen.findByRole("menuitem", { name: "保留草稿（1）" })).toBeTruthy();
});


it('removes a deleted mobile search result while retaining the query and other results', async () => {
  vi.stubGlobal('innerWidth', 390);
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: query.includes('767px'), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const implementation = bridge.request.getMockImplementation()!;
  const searched = { ...note, title: '搜索后删除' };
  const kept = { ...note, id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee', title: '仍保留的结果' };
  let deleted = false;
  bridge.request.mockImplementation((operation, params) => {
    if (operation === 'getStatus') return { ...status, capabilities: [...status.capabilities, 'deleteNote'] };
    if (operation === 'queryNotes') return { notes: deleted ? [kept] : [searched, kept], nextCursor: null, coverage: status.coverage };
    if (operation === 'getNote') return params?.id === kept.id ? kept : searched;
    if (operation === 'deleteNote') { deleted = true; return {}; }
    return implementation(operation, params);
  });
  const user = userEvent.setup(); render(<App />);
  await screen.findByRole('button', { name: '打开 搜索后删除' });
  await user.click(screen.getByRole('button', { name: '搜索全部笔记' }));
  await user.type(await screen.findByRole('combobox', { name: '搜索笔记' }), '散步');
  await user.click(await screen.findByRole('option', { name: searched.title }));
  await screen.findByRole('textbox', { name: '笔记内容' });
  await user.click(screen.getByRole('button', { name: '页面操作' }));
  await user.click(await screen.findByRole('menuitem', { name: '移入回收站' }));
  await user.click(await screen.findByRole('button', { name: '移入回收站' }));
  const search = await screen.findByRole('dialog', { name: '搜索笔记' });
  expect(within(search).getByRole('combobox')).toHaveProperty('value', '散步');
  await waitFor(() => expect(within(search).queryByRole('option', { name: searched.title })).toBeNull());
  expect(within(search).getByRole('option', { name: kept.title })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(within(search).getByRole('combobox')));
  await user.keyboard('{Enter}');
  await waitFor(() => expect(bridge.request.mock.calls.filter(([operation]) => operation === 'getNote').at(-1)?.[1]).toEqual({ id: kept.id }));
});

it.each(['cancel','retry'] as const)('handles note deletion %s after flushing edits without losing content',async flow=>{
  window.history.replaceState(null,'','#/home');
  const implementation=bridge.request.getMockImplementation()!;
  let current={...note},deleted=false,fail=true;
  bridge.request.mockImplementation((op,params)=>{
    if(op==='getStatus')return {...status,capabilities:[...status.capabilities,'deleteNote']};
    if(op==='queryNotes')return {notes:deleted ? [] : [current],nextCursor:null,coverage:status.coverage};
    if(op==='getNote')return current;
    if(op==='saveNote')return current={...current,body:params?.body as string,contentHash:'latest-hash'};
    if(op==='deleteNote'){
      if(fail)return Promise.reject(new Error('回收目录暂不可写'));
      deleted=true;return {id:note.id,relativePath:note.relativePath,trashPath:'.memocard/trash/test/source.md'};
    }
    return implementation(op,params);
  });
  const user=userEvent.setup();render(<App />);
  await user.click(await screen.findByRole('button',{name:'打开 新内容'}));
  await screen.findByRole('textbox',{name:'笔记内容'});
  replaceEditorText('删除前的新修改');
  await user.click(screen.getByRole('button',{name:'页面操作'}));
  await user.click(await screen.findByRole('menuitem',{name:'移入回收站'}));
  if(flow==='cancel'){
    await user.click(await screen.findByRole('button',{name:'取消'}));
    expect(bridge.request.mock.calls.filter(([op])=>op==='deleteNote')).toHaveLength(0);
    await user.click(screen.getByRole('button',{name:'页面操作'}));
    await user.click(await screen.findByRole('menuitem',{name:'移入回收站'}));
  }
  await user.click(await screen.findByRole('button',{name:'移入回收站'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','回收目录暂不可写');
  expect(deleted).toBe(false);
  if(flow==='cancel'){
    await user.click(screen.getByRole('button',{name:'取消'}));
    expect(readEditorText()).toBe('删除前的新修改');
    return;
  }
  fail=false;
  await user.click(await screen.findByRole('button',{name:'移入回收站'}));
  await waitFor(()=>expect(window.location.hash).toBe('#/home'));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'打开 新内容'})).toBeNull());
  expect(bridge.request).toHaveBeenCalledWith('deleteNote',{id:note.id,baseHash:'latest-hash',vaultId:status.vaultId});
  expect(screen.queryByRole('textbox',{name:'笔记内容'})).toBeNull();
});


it('opens the recycle bin from the sidebar and refreshes collections after restore',async()=>{
  const implementation=bridge.request.getMockImplementation()!;let trashed=true;
  bridge.request.mockImplementation(async(op,params)=>{
    if(op==='getStatus')return {...status,capabilities:[...status.capabilities,'getTrash','getTrashedNote','restoreNote']};
    if(op==='getTrash')return {notes:trashed ? [{trashKey:'archive/Old.md',id:note.id,title:'已删除的想法',relativePath:'Old.md',deletedAt:note.updatedAt,contentHash:note.contentHash,preview:note.body}] : [],issues:[]};
    if(op==='restoreNote'){trashed=false;return {...note,title:'已删除的想法'};}
    return implementation(op,params);
  });
  const user=userEvent.setup();render(<App/>);
  await user.click(await screen.findByRole('button',{name:`笔记库：${status.vaultName}`}));
  await user.click(await screen.findByRole('menuitem',{name:'回收站'}));
  await screen.findByRole('button',{name:'恢复笔记：已删除的想法'});expect(window.location.hash).toBe('#/trash');
  const requests=bridge.request.mock.calls.length;
  await user.click(screen.getByRole('button',{name:'恢复笔记：已删除的想法'}));
  await screen.findByText('回收站是空的');
  await waitFor(()=>expect(bridge.request.mock.calls.slice(requests).some(([op])=>op==='listTags')).toBe(true));
  await user.click(screen.getByRole('button',{name:'所有笔记'}));
  await screen.findByRole('button',{name:/^打开 / });
});

it("keeps migrated MCP read access unchecked until explicit write consent", async () => {
  window.history.replaceState(null, "", "#/settings");
  const implementation = bridge.request.getMockImplementation()!;
  let writes = false;
  bridge.request.mockImplementation(async (operation, params) => {
    if (operation === "getEnvironment") return { platform: "mac", mcpEnabled: true, mcpWritesEnabled: writes, capabilities: ["setMCPEnabled"] };
    if (operation === "setMCPEnabled") { writes = params?.enabled === true; return {}; }
    return implementation(operation, params);
  });
  render(<App />);
  const control = await screen.findByRole("switch", { name: "允许本机工具读写" });
  expect(control.getAttribute("aria-checked")).toBe("false");
  expect(screen.getByText("当前仅读取。")).toBeTruthy();
  expect(bridge.request.mock.calls.some(([op]) => op === "setMCPEnabled")).toBe(false);
  fireEvent.click(control);
  await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("setMCPEnabled", { enabled: true }));
  await waitFor(() => expect(control.getAttribute("aria-checked")).toBe("true"));
  expect(screen.getByText("写入时检查内容版本。")).toBeTruthy();
  expect(screen.getByText(/可新建、修改、移入回收站和恢复笔记，不开放永久删除/)).toBeTruthy();
});

it("lets migrated MCP users revoke legacy read access without granting writes", async () => {
  window.history.replaceState(null, "", "#/settings");
  const implementation = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation(async (operation, params) => {
    if (operation === "getEnvironment") return { platform: "mac", mcpEnabled: true, mcpWritesEnabled: false, capabilities: ["setMCPEnabled"] };
    if (operation === "setMCPEnabled") return {};
    return implementation(operation, params);
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "关闭旧版读取" }));
  await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("setMCPEnabled", { enabled: false }));
  expect(bridge.request).not.toHaveBeenCalledWith("setMCPEnabled", { enabled: true });
});
