// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, TagPreferenceState, VaultStatus } from "@memocard/contracts";
import { App } from "./App";
import { noteEditor, noteSourceButton, readEditorText, replaceCaptureText } from "./editor-test-utils";
import { swipeSheet } from "@ui/components/sheet-swipe.test-utils";

const bridge = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./bridge", () => ({
  request: bridge.request,
  isNative: true,
  isLocalWeb: false,
  isBrowserVault: false,
  isConnectedClient: true,
  errorMessage: (cause: unknown) => cause instanceof Error ? cause.message : "操作未完成",
}));

const note: Note = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", body: "周末散步时想到的记录", tags: ["生活"],
  createdAt: "2026-09-28T08:00:00Z", updatedAt: "2026-09-28T08:00:00Z", contentHash: "current-hash",
  relativePath: "notes/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.md", sourceUrl: "memocard://note/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?vault=test-vault",
};
const status: VaultStatus = {
  connected: true, vaultId: "test-vault", vaultName: "侧栏测试库", phase: "M1", syncState: "local",
  coverage: { complete: true, indexed: 1, pending: 0, issues: 0, indexedAt: "2026-09-28T08:00:00Z" },
  capabilities: ["queryNotes", "getNote", "getDrafts", "listTags", "saveNote", "saveDraft"],
};

beforeAll(async () => {
  // Keep cold module transformation outside the UI assertion timeout.
  await Promise.all([import("@ui/business/NoteCollection"), import("@ui/business/NoteSearchDialog"), import("@ui/business/Editor")]);
}, 30_000);

beforeEach(() => {
  document.elementFromPoint = () => null;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  window.history.replaceState(null, "", "#/notes");
  bridge.request.mockReset();
  bridge.request.mockImplementation(async (operation: string, params?: Record<string, unknown>) => {
    switch (operation) {
      case "getEnvironment": return { platform: "mac", phase: "M1", mcpEnabled: false, capabilities: ["selectVault"] };
      case "getStatus": return status;
      case "queryNotes": return { notes: [note], nextCursor: null, coverage: status.coverage };
      case "getDrafts": return { drafts: [] };
      case "listTags": return { tags: [{ name: "生活", count: 1 }] };
      case "selectVault": return { cancelled: true };
      case "saveNote": return { ...note, ...params, contentHash: "saved" };
      case "saveDraft": case "uiReady": return {};
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

describe("sidebar workspace actions", () => {
  it("restores the search trigger after opening a result and returning to the list", async () => {
    const original = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => operation === "getNote" ? Promise.resolve(note) : original(operation, params));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await waitFor(() => expect((screen.getByRole("button", { name: "搜索" }) as HTMLButtonElement).disabled).toBe(false));
    const trigger = screen.getByRole("button", { name: "搜索" });
    await user.click(trigger);
    const input = await screen.findByRole("combobox", { name: "搜索笔记" });
    await screen.findByRole("option", { name: "新内容" });
    await waitFor(() => expect(document.activeElement).toBe(input));
    await user.keyboard("{Enter}");
    await screen.findByRole("textbox", { name: "页面标题" });
    expect(input.isConnected).toBe(false);
    await user.click(noteSourceButton());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("searches the whole vault without changing the selected tag or page", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(await screen.findByRole("button", { name: /^生活/ }));
    await user.click(screen.getByRole("button", { name: "搜索" }));
    const input = await screen.findByRole("combobox", { name: "搜索笔记" });
    await user.type(input, "散步");
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "散步", tags: [], sort: "updatedAt", limit: 30 }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "搜索笔记" })).toBeNull());
    expect(screen.getByRole("heading", { name: "# 生活", level: 1 })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "搜索当前视图笔记" }) as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "搜索" })));
  });

  it("opens global search with Ctrl K while keeping the editor and unsaved input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await waitFor(() => expect((screen.getByRole("button", { name: "新建" }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole("button", { name: "新建" }));
    const title = await screen.findByRole("textbox", { name: "页面标题" });
    await user.type(title, "未保存的标题");
    const route = window.location.hash;
    fireEvent.keyDown(title, { key: "k", ctrlKey: true });
    await screen.findByRole("combobox", { name: "搜索笔记" });
    expect(window.location.hash).toBe(route);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "搜索笔记" })).toBeNull());
    expect((screen.getByRole("textbox", { name: "页面标题" }) as HTMLInputElement).value).toBe("未保存的标题");
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it("searches within the selected tag and keeps the field focused through empty results", async () => {
    const original = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation, params) => {
      if (operation === "queryNotes" && params?.query) return Promise.resolve({ notes: [], nextCursor: null, coverage: status.coverage });
      return original(operation, params);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(await screen.findByRole("button", { name: /^生活/ }));
    const search = await screen.findByRole("textbox", { name: "搜索当前视图笔记" });
    await user.type(search, "不存在");
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "不存在", tags: ["生活"], limit: 30 }));
    expect(await screen.findByText("没有找到相关笔记")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "搜索当前视图笔记" })).toBe(search);
    expect(document.activeElement).toBe(search);
    expect(screen.getByRole("heading", { name: "# 生活", level: 1 })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "清空当前搜索" }));
    await screen.findByText(note.body);
    expect(bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes").at(-1)?.[1]).toEqual({ query: "", tags: ["生活"], limit: 30 });
    expect(screen.getByRole("heading", { name: "# 生活", level: 1 })).toBeTruthy();
  });

  it("shows loading instead of an empty result while a quick filter is pending, even with recovery content", async () => {
    const original = bridge.request.getMockImplementation()!;
    let finishQuery!: (value: unknown) => void;
    bridge.request.mockImplementation((operation: string, params?: Record<string, unknown>) => {
      if (operation === "getDrafts") return Promise.resolve({ drafts: [{ ...note, baseHash: note.contentHash }] });
      if (operation === "queryNotes" && params?.quickFilter) return new Promise(resolve => { finishQuery = resolve; });
      return original(operation, params);
    });
    render(<App />);
    await screen.findByText(note.body);
    await userEvent.setup().click(await screen.findByRole("button", { name: "展开或收起快捷筛选" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "有图片" }));
    await waitFor(() => expect(finishQuery).toBeTypeOf("function"));
    expect(screen.getByRole("status", { name: "正在读取笔记库" })).toBeTruthy();
    expect(screen.queryByText("在笔记中插入图片后，会自动出现在这里。")).toBeNull();
    await act(async () => finishQuery({ notes: [], nextCursor: null, coverage: status.coverage }));
    expect(await screen.findByText("还没有包含图片的笔记")).toBeTruthy();
  });

  it("retains quick filters in search and paging, clears them for tags and all notes, and explains empty results", async () => {
    const original = bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation: string, params?: Record<string, unknown>) => {
      if (operation === "queryNotes") return Promise.resolve({
        notes: params?.quickFilter === "links" ? [] : [note],
        nextCursor: params?.quickFilter === "images" && !params.cursor ? "image-page-2" : null,
        coverage: status.coverage, filterCounts: { untagged: 0, images: 31, links: 0 },
      });
      return original(operation, params);
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "展开或收起快捷筛选" }));
    await user.click(screen.getByRole("button", { name: "有图片" }));
    expect(await screen.findByRole("heading", { name: "有图片", level: 1 })).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "加载更多" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", expect.objectContaining({ quickFilter: "images", cursor: "image-page-2" })));
    const queryCount = bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes").length;
    const loadedCount = screen.getByRole("list", { name: "笔记列表" }).children.length;
    await user.click(screen.getByRole("button", { name: "列表布局" }));
    expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("list");
    expect(screen.getByRole("list", { name: "笔记列表" }).children).toHaveLength(loadedCount);
    expect(screen.getByRole("button", { name: "有图片" }).getAttribute("aria-current")).toBe("page");
    expect(bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes")).toHaveLength(queryCount);
    await user.click(screen.getByRole("button", { name: "卡片布局" }));
    await user.type(screen.getByRole("textbox", { name: "搜索当前视图笔记" }), "散步");
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", expect.objectContaining({ quickFilter: "images", query: "散步" })));
    expect(screen.getByRole("button", { name: "有图片" }).getAttribute("aria-current")).toBe("page");
    await user.click(screen.getByRole("button", { name: "清空当前搜索" }));
    await user.click(screen.getByRole("button", { name: "有链接" }));
    expect(await screen.findByText("在笔记中添加网页或笔记链接后，会自动出现在这里。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "查看所有笔记" }));
    await screen.findByText(note.body);
    expect(screen.getByRole("button", { name: "所有笔记" }).getAttribute("aria-current")).toBe("page");
    await user.click(screen.getByRole("button", { name: "有图片" }));
    await user.click(await screen.findByRole("button", { name: "筛选标签 生活" }));
    await waitFor(() => {
      const params = bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes").at(-1)?.[1];
      expect(params).toMatchObject({ tags: ["生活"] });
      expect(params.quickFilter).toBeUndefined();
    });
  });

  it.each([
    ["打开已有笔记库", false],
    ["创建新笔记库", true],
  ] as const)("opens the directory picker from %s and preserves the current vault after cancellation", async (label, create) => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);

    await user.click(screen.getByRole("button", { name: "笔记库：侧栏测试库" }));
    await user.click(await screen.findByRole("menuitem", { name: label }));

    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("selectVault", { create }));
    expect(screen.getByText(note.body)).toBeTruthy();
    expect(screen.getByRole("button", { name: "笔记库：侧栏测试库" })).toBeTruthy();
  });

  it("navigates to settings and returns to focused search from the sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);

    await user.click(screen.getByRole("button", { name: "笔记库：侧栏测试库" }));
    await user.click(await screen.findByRole("menuitem", { name: "笔记库设置" }));
    expect(await screen.findByRole("heading", { name: "设置", level: 1 })).toBeTruthy();
    expect(window.location.hash).toBe("#/settings");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "搜索笔记" })));
    expect(window.location.hash).toBe("#/settings");
  });

  it("preserves the current search and tag when collapsing and expanding the desktop sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    const collapse = screen.getByRole("button", { name: "收起侧栏" });
    expect(collapse.parentElement).toBe(screen.getByRole("button", { name: "MemoCard，返回主页" }).parentElement);
    expect(collapse.closest("main")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^生活/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索当前视图笔记" }), { target: { value: "散步" } });
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "散步", tags: ["生活"], limit: 30 }));

    await user.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(screen.queryByRole("navigation", { name: "主要导航" })).toBeNull();
    expect(screen.getByRole("button", { name: "展开侧栏" }).closest("header")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "展开侧栏" })));
    await user.click(screen.getByRole("button", { name: "展开侧栏" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "收起侧栏" })));

    expect(screen.getByRole("navigation", { name: "主要导航" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "搜索当前视图笔记" }) as HTMLInputElement).value).toBe("散步");
    expect(screen.getByRole("heading", { name: "# 生活", level: 1 })).toBeTruthy();
    expect(screen.queryByText("标签筛选")).toBeNull();
    expect(screen.queryByRole("button", { name: "清除标签筛选" })).toBeNull();
    expect(screen.getByRole("button", { name: /^生活/ }).getAttribute("aria-current")).toBe("page");
  });

  it("uses the template rail and keyboard shortcut without stealing editor input shortcuts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "切换笔记导航" }));
    expect(screen.queryByRole("navigation", { name: "主要导航" })).toBeNull();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.getByRole("navigation", { name: "主要导航" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "新建" }));
    const input = await screen.findByRole("textbox", { name: "笔记内容" });
    await user.click(input);
    fireEvent.keyDown(input, { key: "b", ctrlKey: true });
    expect(screen.getByRole("navigation", { name: "主要导航" })).toBeTruthy();
  });

  it("connects the template page-actions menu to refresh and settings", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    const previousReads = bridge.request.mock.calls.filter(([operation]) => operation === "getStatus").length;
    await user.click(screen.getByRole("button", { name: "页面操作" }));
    await user.click(await screen.findByRole("menuitem", { name: "刷新笔记库" }));
    await waitFor(() => expect(bridge.request.mock.calls.filter(([operation]) => operation === "getStatus").length).toBeGreaterThan(previousReads));
    await user.click(screen.getByRole("button", { name: "页面操作" }));
    await user.click(await screen.findByRole("menuitem", { name: "设置" }));
    expect(await screen.findByRole("heading", { name: "设置", level: 1 })).toBeTruthy();
  });

  it("returns from mobile settings to home before opening bottom search", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("767px"), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "页面操作" }));
    await user.click(await screen.findByRole("menuitem", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "打开导航" }));
    const sheet = await screen.findByRole("dialog", { name: "笔记导航" });

    expect(within(sheet).queryByRole("button", { name: "搜索" })).toBeNull();
    await user.click(within(sheet).getByRole("button", { name: "主页" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "搜索全部笔记" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "搜索笔记" })));
    expect(window.location.hash).toBe("#/home");
  });

  it("opens the new note editor from the mobile page menu", async () => {
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

    expect(within(sheet).queryByRole("button", { name: "新建笔记" })).toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "页面操作" }));
    await user.click(await screen.findByRole("menuitem", { name: "新建笔记" }));

    const editor = await screen.findByRole("region", { name: "新建笔记" });
    expect(screen.queryByRole("dialog", { name: "新建笔记" })).toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(within(editor).getByRole("textbox", { name: "页面标题" })));
  });
});

describe('mobile page navigation',()=>{
  beforeEach(()=>{
    vi.stubGlobal('innerWidth',390);
    window.matchMedia=vi.fn().mockImplementation((query:string)=>({matches:query.includes('767px'),media:query,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  });
  afterEach(()=>{
    localStorage.removeItem('memocard:note-layout');
    localStorage.removeItem('memocard:quick-capture:v1:test-vault');
  });

  it('keeps mobile search and capture in the bottom bar without duplicate sidebar entries',async()=>{
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    expect(screen.queryByRole('button',{name:'搜索笔记'})).toBeNull();
    const bar=screen.getByRole('contentinfo',{name:'快捷记录'});
    const search=within(bar).getByRole('button',{name:'搜索全部笔记'});
    expect(within(bar).getByRole('button',{name:'打开快速记录'})).toBeTruthy();
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    const sheet=await screen.findByRole('dialog',{name:'笔记导航'});
    expect(within(sheet).queryByRole('button',{name:'搜索'})).toBeNull();
    expect(within(sheet).queryByRole('button',{name:'新建笔记'})).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记导航'})).toBeNull());
    await user.click(search);
    const input=await screen.findByRole('combobox',{name:'搜索笔记'});
    await waitFor(()=>expect(document.activeElement).toBe(input));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记导航'})).toBeNull());
  });

  it('omits the mobile close button and dismisses navigation with the backdrop or Escape',async()=>{
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    const trigger=screen.getByRole('button',{name:'打开导航'});
    await user.click(trigger);
    const navigation=await screen.findByRole('dialog',{name:'笔记导航'});
    expect(within(navigation).queryByRole('button',{name:'关闭导航'})).toBeNull();
    await user.click(document.querySelector('[data-slot="sheet-overlay"]') as HTMLElement);
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记导航'})).toBeNull());
    await user.click(trigger);
    await screen.findByRole('dialog',{name:'笔记导航'});
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记导航'})).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('offers tag actions only from the selected mobile tag title',async()=>{
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    expect(screen.queryByRole('button',{name:'标签操作 生活'})).toBeNull();
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await screen.findByRole('button',{name:'笔记库：侧栏测试库'});
    const navigation=await screen.findByRole('dialog',{name:'笔记导航'});
    expect(within(navigation).queryByRole('button',{name:'标签操作 生活'})).toBeNull();
    await user.click(await within(navigation).findByRole('button',{name:'生活'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记导航'})).toBeNull());
    const title=await screen.findByRole('button',{name:'标签操作 生活'});
    await user.click(title);
    const menu=await screen.findByRole('menu',{name:'标签操作 生活'});
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(menu.isConnected).toBe(false));
    await waitFor(()=>expect(document.activeElement).toBe(title));
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(screen.getByRole('button',{name:'展开或收起快捷筛选'}));
    await user.click(screen.getByRole('button',{name:'无标签'}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记导航'})).toBeNull());
    expect(screen.queryByRole('button',{name:'标签操作 生活'})).toBeNull();
  });

  it('shares the all-notes title layout choice with the tag view',async()=>{
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    await user.click(await screen.findByRole('button',{name:'视图选项 所有笔记'}));
    await user.click(await screen.findByRole('menuitemradio',{name:'列表'}));
    await waitFor(()=>expect(screen.getByRole('list',{name:'笔记列表'}).getAttribute('data-layout')).toBe('list'));
    expect(localStorage.getItem('memocard:note-layout')).toBe('list');
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(await screen.findByRole('button',{name:'生活'}));
    await user.click(await screen.findByRole('button',{name:'标签操作 生活'}));
    expect((await screen.findByRole('menuitemradio',{name:'列表'})).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('menuitemradio',{name:'卡片'}));
    await waitFor(()=>expect(screen.getByRole('list',{name:'笔记列表'}).getAttribute('data-layout')).toBe('cards'));
    expect(localStorage.getItem('memocard:note-layout')).toBe('cards');
  });

  it('shares a changed tag layout with the quick-filter title menu',async()=>{
    localStorage.setItem('memocard:note-layout','list');
    const user=userEvent.setup();render(<App />);
    await screen.findByRole('button',{name:'打开 新内容'});
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(await screen.findByRole('button',{name:'生活'}));
    await user.click(await screen.findByRole('button',{name:'标签操作 生活'}));
    expect((await screen.findByRole('menuitemradio',{name:'列表'})).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('menuitemradio',{name:'卡片'}));
    await waitFor(()=>expect(screen.getByRole('list',{name:'笔记列表'}).getAttribute('data-layout')).toBe('cards'));
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(screen.getByRole('button',{name:'展开或收起快捷筛选'}));
    await user.click(screen.getByRole('button',{name:'有图片'}));
    await user.click(await screen.findByRole('button',{name:'视图选项 有图片'}));
    expect((await screen.findByRole('menuitemradio',{name:'卡片'})).getAttribute('aria-checked')).toBe('true');
    await user.click(await screen.findByRole('menuitemradio',{name:'列表'}));
    await waitFor(()=>expect(screen.getByRole('list',{name:'笔记列表'}).getAttribute('data-layout')).toBe('list'));
    expect(localStorage.getItem('memocard:note-layout')).toBe('list');
  });

  it('restores a quick-filter layout choice in all notes after remount',async()=>{
    const user=userEvent.setup();
    const app=render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(screen.getByRole('button',{name:'展开或收起快捷筛选'}));
    await user.click(screen.getByRole('button',{name:'有图片'}));
    await user.click(await screen.findByRole('button',{name:'视图选项 有图片'}));
    await user.click(await screen.findByRole('menuitemradio',{name:'列表'}));
    await waitFor(()=>expect(screen.getByRole('list',{name:'笔记列表'}).getAttribute('data-layout')).toBe('list'));
    expect(localStorage.getItem('memocard:note-layout')).toBe('list');
    app.unmount();
    render(<App />);
    await screen.findByRole('button',{name:'打开 新内容'});
    await user.click(await screen.findByRole('button',{name:'视图选项 所有笔记'}));
    expect((await screen.findByRole('menuitemradio',{name:'列表'})).getAttribute('aria-checked')).toBe('true');
  });

  it('keeps the mobile home title layout independent from note views',async()=>{
    window.history.replaceState(null,'','#/home');
    localStorage.setItem('memocard:home-layout','cards');
    localStorage.setItem('memocard:note-layout','cards');
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    await user.click(await screen.findByRole('button',{name:'视图选项 主页'}));
    await user.click(await screen.findByRole('menuitemradio',{name:'列表'}));
    await waitFor(()=>expect(screen.getByRole('list',{name:'笔记列表'}).getAttribute('data-layout')).toBe('list'));
    expect(localStorage.getItem('memocard:home-layout')).toBe('list');
    expect(localStorage.getItem('memocard:note-layout')).toBe('cards');
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(await screen.findByRole('button',{name:'所有笔记'}));
    await user.click(await screen.findByRole('button',{name:'视图选项 所有笔记'}));
    expect((await screen.findByRole('menuitemradio',{name:'卡片'})).getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(await screen.findByRole('button',{name:'主页'}));
    await user.click(await screen.findByRole('button',{name:'视图选项 主页'}));
    expect((await screen.findByRole('menuitemradio',{name:'列表'})).getAttribute('aria-checked')).toBe('true');
  });

  it('dismisses the mobile vault sheet back to the open navigation and restores vault trigger focus',async()=>{
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    const navigation=await screen.findByRole('dialog',{name:'笔记导航'});
    const trigger=within(navigation).getByRole('button',{name:'笔记库：侧栏测试库'});
    await user.click(trigger);
    const sheet=await screen.findByRole('dialog',{name:'笔记库'});
    expect(navigation.isConnected).toBe(true);
    expect(document.querySelectorAll('[data-slot="sheet-overlay"]')).toHaveLength(2);
    expect(within(sheet).getByRole('button',{name:'回收站'})).toHaveProperty('disabled',true);
    expect(within(sheet).getByRole('button',{name:'帮助'})).toHaveProperty('disabled',true);
    expect(within(sheet).getByRole('button',{name:'关闭笔记库菜单'})).toBeTruthy();
    await waitFor(()=>expect(sheet.hasAttribute('data-swipe-ready')).toBe(true));
    swipeSheet(within(sheet).getByRole('heading',{name:'笔记库'}),160);
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记库'})).toBeNull());
    expect(screen.getByRole('dialog',{name:'笔记导航'})).toBe(navigation);
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    await screen.findByRole('dialog',{name:'笔记库'});
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记库'})).toBeNull());
    expect(screen.getByRole('dialog',{name:'笔记导航'})).toBe(navigation);
    expect(document.activeElement).toBe(trigger);
  });

  it.each([['打开已有笔记库',false],['创建新笔记库',true]] as const)('keeps mobile navigation after cancelling %s',async(label,create)=>{
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(within(await screen.findByRole('dialog',{name:'笔记导航'})).getByRole('button',{name:'笔记库：侧栏测试库'}));
    await user.click(within(await screen.findByRole('dialog',{name:'笔记库'})).getByRole('button',{name:label}));
    await waitFor(()=>expect(bridge.request).toHaveBeenCalledWith('selectVault',{create}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记库'})).toBeNull());
    expect(screen.getByRole('dialog',{name:'笔记导航'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'笔记库：侧栏测试库'})).toBeTruthy();
  });

  it('closes both mobile sheets when entering vault settings',async()=>{
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(within(await screen.findByRole('dialog',{name:'笔记导航'})).getByRole('button',{name:'笔记库：侧栏测试库'}));
    await user.click(within(await screen.findByRole('dialog',{name:'笔记库'})).getByRole('button',{name:'笔记库设置'}));
    await screen.findByRole('heading',{name:'设置',level:1});
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.location.hash).toBe('#/settings');
  });

  it('expands quick capture and restores entry focus without changing list rows or opening the editor',async()=>{
    localStorage.setItem('memocard:note-layout','list');
    const user=userEvent.setup();render(<App />);
    await waitFor(()=>expect((screen.getByRole('button',{name:'打开快速记录'}) as HTMLButtonElement).disabled).toBe(false));
    const entry=screen.getByRole('button',{name:'打开快速记录'});
    const list=await screen.findByRole('list',{name:'笔记列表'});
    expect(within(list).queryByText(note.body)).toBeNull();
    expect(list.getAttribute('data-layout')).toBe('list');
    await user.click(entry);
    const capture=await screen.findByRole('textbox',{name:'快速输入内容'});
    await waitFor(()=>expect(document.activeElement).toBe(capture));
    expect(screen.queryByRole('textbox',{name:'页面标题'})).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(document.activeElement).toBe(entry));
    expect(bridge.request.mock.calls.some(([operation])=>operation==='saveNote')).toBe(false);
    expect(screen.getByRole('list',{name:'笔记列表'}).getAttribute('data-layout')).toBe('list');
    expect(screen.queryByText(note.body)).toBeNull();
  });

  it('resumes mobile search after a note visit and restores the original page when exiting',async()=>{
    const original=bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation,params)=>operation==='getNote' ? Promise.resolve(note) : original(operation,params));
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    const bar=screen.getByRole('contentinfo',{name:'快捷记录'});
    const search=within(bar).getByRole('button',{name:'搜索全部笔记'});
    const page=screen.getByRole('main').querySelector<HTMLElement>('.web-app-scroll')!;
    page.scrollTop=420;
    await waitFor(()=>expect((search as HTMLButtonElement).disabled).toBe(false));
    await user.click(search);
    const input=await screen.findByRole('combobox',{name:'搜索笔记'});
    await waitFor(()=>expect(document.activeElement).toBe(input));
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(document.activeElement).toBe(search));
    await user.click(search);
    await screen.findByRole('option',{name:'新内容'});
    const query=screen.getByRole('combobox',{name:'搜索笔记'});
    await waitFor(()=>expect(document.activeElement).toBe(query));
    await user.type(query,'散步');
    await waitFor(()=>expect(bridge.request).toHaveBeenCalledWith('queryNotes',{query:'散步',tags:[],sort:'updatedAt',limit:30}));
    await screen.findByRole('option',{name:'新内容'});
    const results=screen.getByRole('listbox',{name:'搜索结果'}).parentElement!;
    fireEvent.scroll(results,{target:{scrollTop:180}});
    const reads=bridge.request.mock.calls.filter(([operation,params])=>operation==='queryNotes' && params?.query==='散步').length;
    await user.keyboard('{Enter}');
    await screen.findByRole('textbox',{name:'页面标题'});
    expect(screen.queryByRole('button',{name:'搜索全部笔记'})).toBeNull();
    await user.click(screen.getByRole('button',{name:'返回搜索结果'}));
    const restored=await screen.findByRole('combobox',{name:'搜索笔记'});
    expect(restored).toHaveProperty('value','散步');
    expect(screen.getByRole('listbox',{name:'搜索结果'}).parentElement!.scrollTop).toBe(180);
    expect(bridge.request.mock.calls.filter(([operation,params])=>operation==='queryNotes' && params?.query==='散步')).toHaveLength(reads);
    await user.click(screen.getByRole('button',{name:'退出搜索'}));
    await waitFor(()=>expect(document.activeElement).toBe(search));
    expect(page.scrollTop).toBe(420);
    await user.click(search);
    expect(await screen.findByRole('combobox',{name:'搜索笔记'})).toHaveProperty('value','');
    expect(bridge.request.mock.calls.some(([operation])=>operation==='saveNote')).toBe(false);
  });

  it('shares one protected quick capture between mobile home and notes',async()=>{
    window.history.replaceState(null,'','#/home');
    const user=userEvent.setup();render(<App />);
    await waitFor(()=>expect((screen.getByRole('button',{name:'打开快速记录'}) as HTMLButtonElement).disabled).toBe(false));
    const entry=screen.getByRole('button',{name:'打开快速记录'});
    expect(screen.queryByRole('textbox',{name:'快速输入内容'})).toBeNull();
    await user.click(entry);
    const capture=await screen.findByRole('textbox',{name:'快速输入内容'});
    await user.type(capture,'尚未提交的首页想法');
    await user.click(screen.getByRole('button',{name:'收起快速记录'}));
    await waitFor(()=>expect(document.activeElement).toBe(entry));
    await user.click(screen.getByRole('button',{name:'打开导航'}));
    await user.click(within(await screen.findByRole('dialog',{name:'笔记导航'})).getByRole('button',{name:/^所有笔记$/}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'笔记导航'})).toBeNull());
    await user.click(screen.getByRole('button',{name:'打开快速记录'}));
    expect(await screen.findByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','尚未提交的首页想法');
    expect(bridge.request.mock.calls.some(([operation])=>operation==='saveNote')).toBe(false);
  });

  it('continues quick capture in the page editor without an initial source write or duplicate capture',async()=>{
    window.history.replaceState(null,'','#/home');
    const original=bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((op,params)=>op==='saveDraft' ? Promise.resolve({...params,draftKey:params?.draftKey ?? params?.id,revision:'draft-version'}) : original(op,params));
    const user=userEvent.setup();render(<App />);
    await waitFor(()=>expect(screen.getByRole('button',{name:'打开快速记录'})).toHaveProperty('disabled',false));
    await user.click(screen.getByRole('button',{name:'打开快速记录'}));
    replaceCaptureText(await screen.findByRole('textbox',{name:'快速输入内容'}),'从快速记录继续写');
    await user.click(screen.getByRole('button',{name:'切换为页面'}));
    const editor=await screen.findByRole('textbox',{name:'笔记内容'});
    await waitFor(()=>expect(document.activeElement).toBe(editor));
    expect(readEditorText(editor)).toBe('从快速记录继续写');
    expect(window.location.hash).toBe('#/notes/new');
    const draft=bridge.request.mock.calls.find(([op,params])=>op==='saveDraft' && params?.body==='从快速记录继续写')![1]!;
    expect(bridge.request.mock.calls.some(([op])=>op==='saveNote')).toBe(false);
    await user.click(screen.getByRole('button',{name:'返回主页'}));
    await waitFor(()=>expect(window.location.hash).toBe('#/home'));
    const saves=bridge.request.mock.calls.filter(([op])=>op==='saveNote');
    expect(saves).toHaveLength(1);
    expect(saves[0][1]).toEqual(expect.objectContaining({id:draft.id,body:'从快速记录继续写',recoveredFrom:{draftKey:draft.draftKey ?? draft.id,revision:'draft-version'}}));
    await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'打开快速记录'})));
    await user.click(screen.getByRole('button',{name:'打开快速记录'}));
    expect(await screen.findByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','');
  });

  it('hides the bottom entry in settings and disables it when note creation is unavailable',async()=>{
    const original=bridge.request.getMockImplementation()!;
    bridge.request.mockImplementation((operation,params)=>operation==='getStatus' ? Promise.resolve({...status,capabilities:status.capabilities.filter(capability=>capability!=='saveNote')}) : original(operation,params));
    const user=userEvent.setup();render(<App />);
    await screen.findByText(note.body);
    const entry=screen.getByRole('button',{name:'打开快速记录'});
    expect((entry as HTMLButtonElement).disabled).toBe(true);
    await user.click(entry);
    expect(screen.queryByRole('region',{name:'新建笔记'})).toBeNull();
    await user.click(screen.getByRole('button',{name:'页面操作'}));
    await user.click(await screen.findByRole('menuitem',{name:'设置'}));
    await screen.findByRole('heading',{name:'设置',level:1});
    expect(screen.queryByRole('button',{name:'打开快速记录'})).toBeNull();
    expect(screen.queryByRole('button',{name:'搜索全部笔记'})).toBeNull();
  });
});

it('keeps the desktop header and creation entry unchanged',async()=>{
  render(<App />);
  await screen.findByText(note.body);
  expect(screen.queryByRole('button',{name:'搜索笔记'})).toBeNull();
  expect(screen.queryByRole('button',{name:'打开快速记录'})).toBeNull();
  expect(screen.queryByRole('button',{name:'搜索全部笔记'})).toBeNull();
  expect(screen.queryByRole('button',{name:'关闭导航'})).toBeNull();
  expect(screen.getByRole('button',{name:'搜索'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'新建'})).toBeTruthy();
});

it("creates in the default folder with the selected nested tag and keeps tag filtering global", async () => {
  const original = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation: string, ...args: unknown[]) => {
    if (operation === "getStatus") return Promise.resolve({ ...status, capabilities: [...status.capabilities, "listFolders"] });
    if (operation === "listFolders") return Promise.resolve({ folders: ["notes", "notes/工作"], coverage: status.coverage });
    if (operation === "listTags") return Promise.resolve({ tags: [{ name: "工作", count: 1 }, { name: "工作/项目", count: 1 }] });
    return original(operation, ...args);
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "工作/项目" }));
  await user.click(await screen.findByRole("button", { name: "新建" }));
  expect(readEditorText()).toBe("");
  await user.click(screen.getByRole("button", { name: "更多属性" }));
  expect(screen.getByLabelText("笔记属性").textContent).toContain("工作/项目");
  expect(screen.queryByRole("button", { name: "移除标签 工作/项目" })).toBeNull();
  expect(screen.queryByLabelText("笔记标签")).toBeNull();
  expect(screen.queryByRole("dialog", { name: "新建笔记" })).toBeNull();
  await user.click(noteSourceButton());
  const cardTag = await screen.findByRole("button", { name: "筛选标签 生活" });
  expect(bridge.request).not.toHaveBeenCalledWith("saveNote", expect.anything());
  expect(bridge.request).not.toHaveBeenCalledWith("saveDraft", expect.anything());
  expect(cardTag.getAttribute("data-slot")).toBe("badge");
  expect(cardTag.getAttribute("data-variant")).toBe("secondary");
  expect(cardTag.className).toContain("text-xs");
  expect(cardTag.className).toContain("ui-note-tag");
  expect(cardTag.getAttribute("data-tag")).toBe(encodeURIComponent("生活"));
  expect(cardTag.className).toContain("h-5");
  expect(cardTag.className).toContain("py-0");
  await user.click(cardTag);
  await waitFor(() => {
    const calls = bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes");
    expect(calls.at(-1)?.[1]).toMatchObject({ tags: ["生活"] });
    expect(calls.at(-1)?.[1].folder).toBeUndefined();
  });
});


it("preserves quick capture through both responsive layouts", async () => {
  localStorage.clear();
  window.history.replaceState(null, "", "#/home");
  let mobile = false;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return query.includes("767px") && mobile; },
    media: query,
    addEventListener: (_: string, listener: () => void) => { if (query.includes("767px")) listeners.add(listener); },
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  const user = userEvent.setup();
  render(<App />);
  const desktop = await screen.findByRole("textbox", { name: "快速输入内容" });
  await user.type(desktop, "跨尺寸草稿");
  act(() => { vi.stubGlobal("innerWidth",390); mobile = true; listeners.forEach(listener => listener()); });
  await user.click(await screen.findByRole("button", { name: "打开快速记录" }));
  const phone = await screen.findByRole("textbox", { name: "快速输入内容" });
  expect(phone).toHaveProperty("textContent", "跨尺寸草稿");
  await waitFor(() => expect(document.activeElement).toBe(phone));
  act(() => { const editor=noteEditor(phone);editor.commands.setTextSelection(editor.state.doc.content.size); });
  await user.keyboard("补充");
  act(() => { vi.stubGlobal("innerWidth",1024); mobile = false; listeners.forEach(listener => listener()); });
  expect(await screen.findByRole("textbox", { name: "快速输入内容" })).toHaveProperty("textContent", "跨尺寸草稿补充");
  expect(bridge.request.mock.calls.some(([operation]) => operation === "saveNote")).toBe(false);
  await user.click(screen.getByRole("button", { name: "记录" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "快速输入内容" })).toHaveProperty("textContent", ""));
  expect(localStorage.getItem("memocard:quick-capture:v1:test-vault")).toBeNull();
  act(() => { vi.stubGlobal("innerWidth",390); mobile = true; listeners.forEach(listener => listener()); });
  await user.click(await screen.findByRole("button", { name: "打开快速记录" }));
  expect(await screen.findByRole("textbox", { name: "快速输入内容" })).toHaveProperty("textContent", "");
});

it("dismisses the mobile sheet at the desktop breakpoint without reopening on return", async () => {
  vi.stubGlobal("innerWidth",390);
  let mobile = true;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() { return query.includes("767px") && mobile; },
    media: query,
    addEventListener: (_: string, listener: () => void) => { if (query.includes("767px")) listeners.add(listener); },
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText(note.body);
  await user.click(screen.getByRole("button", { name: "打开导航" }));
  expect(await screen.findByRole("dialog", { name: "笔记导航" })).toBeTruthy();
  act(() => { vi.stubGlobal("innerWidth",1024); mobile = false; listeners.forEach(listener => listener()); });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
  expect(screen.getByRole("button", { name: "收起侧栏" })).toBeTruthy();
  act(() => { vi.stubGlobal("innerWidth",390); mobile = true; listeners.forEach(listener => listener()); });
  expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull();
  expect(screen.getByRole("button", { name: "打开导航" }).getAttribute("aria-expanded")).toBe("false");
});

it('shares vault-backed tag pins and icons instead of restoring stale browser settings', async () => {
  localStorage.setItem('memocard:tags:test-vault', JSON.stringify({pinned:['stale'],icons:{stale:'❌'}}));
  let appearance: TagPreferenceState = {pinned:['生活'],icons:{'生活':'☕'},contentHash:'shared-tags',initialized:true};
  const original = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation(async (operation, params) => {
    if (operation === 'getStatus') return {...status,capabilities:[...status.capabilities,'getTagPreferences','setTagPreferences']};
    if (operation === 'getTagPreferences') return structuredClone(appearance);
    if (operation === 'setTagPreferences') {
      expect(params?.baseHash).toBe(appearance.contentHash);
      appearance = {pinned:params?.pinned as string[],icons:params?.icons as Record<string,string>,contentHash:'saved-tags',initialized:true};
      return structuredClone(appearance);
    }
    return original(operation,params);
  });
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(bridge.request).toHaveBeenCalledWith('getTagPreferences',{vaultId:'test-vault'}),{timeout:5000});
  const pinned = await screen.findByRole('navigation',{name:'置顶标签'},{timeout:5000});
  expect(within(pinned).getByRole('button',{name:'生活'}).textContent).toContain('☕');
  expect(bridge.request.mock.calls.some(([operation]) => operation === 'setTagPreferences')).toBe(false);
  await user.click(within(pinned).getByRole('button',{name:'标签操作 生活'}));
  await user.click(await screen.findByRole('menuitem',{name:'取消置顶'}));
  await waitFor(() => expect(screen.queryByRole('navigation',{name:'置顶标签'})).toBeNull());
  expect(appearance.pinned).toEqual([]);
  expect(appearance.icons).toEqual({'生活':'☕'});
});
