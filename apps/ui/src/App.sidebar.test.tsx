// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, VaultStatus } from "@memocard/contracts";
import { App } from "./App";
import { readEditorText } from "./editor-test-utils";

const bridge = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./bridge", () => ({
  request: bridge.request,
  isNative: true,
  isLocalWeb: false,
  isBrowserVault: false,
  isConnectedClient: true,
  errorMessage: (cause: unknown) => cause instanceof Error ? cause.message : "操作未完成",
}));
vi.mock("@/features/theme/ThemeSettings", () => ({ ThemeSettings: () => <section aria-label="外观设置" /> }));

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

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "搜索笔记" })));
    expect(window.location.hash).toBe("#/notes");
  });

  it("preserves the current search and tag when collapsing and expanding the desktop sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: /^生活/ }));
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索笔记" }), { target: { value: "散步" } });
    fireEvent.click(screen.getByRole("button", { name: "查看结果" }));
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "散步", tags: ["生活"], limit: 30 }));

    await user.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(screen.queryByRole("navigation", { name: "主要导航" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "展开侧栏" }));

    expect(screen.getByRole("navigation", { name: "主要导航" })).toBeTruthy();
    expect(screen.getByText("搜索：散步")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "# 生活", level: 1 })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^生活/ }).getAttribute("aria-current")).toBe("page");
  });

  it("uses the template rail and keyboard shortcut without stealing editor input shortcuts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "切换侧栏" }));
    expect(screen.queryByRole("navigation", { name: "主要导航" })).toBeNull();
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(screen.getByRole("navigation", { name: "主要导航" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "新建笔记" }));
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

  it("closes mobile navigation and transfers focus to search", async () => {
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
    const sheet = await screen.findByRole("dialog", { name: "记忆卡导航" });

    await user.click(within(sheet).getByRole("button", { name: "搜索" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "搜索笔记" })));
    expect(window.location.hash).toBe("#/notes");
  });

  it("closes mobile navigation and transfers focus to the new note editor", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("767px"), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "打开导航" }));
    const sheet = await screen.findByRole("dialog", { name: "记忆卡导航" });

    await user.click(within(sheet).getByRole("button", { name: "新建笔记" }));

    const editor = await screen.findByRole("region", { name: "新建笔记" });
    expect(screen.queryByRole("dialog", { name: "新建笔记" })).toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(within(editor).getByRole("textbox", { name: "页面标题" })));
  });
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
  await user.click(screen.getByRole("button", { name: /^新建笔记$/ }));
  expect(readEditorText()).toBe("");
  expect(screen.getByRole("button", { name: "移除标签 工作/项目" })).toBeTruthy();
  expect(screen.queryByRole("dialog", { name: "新建笔记" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "返回笔记列表" }));
  await user.click(await screen.findByRole("button", { name: "#生活" }));
  await waitFor(() => {
    const calls = bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes");
    expect(calls.at(-1)?.[1]).toMatchObject({ tags: ["生活"] });
    expect(calls.at(-1)?.[1].folder).toBeUndefined();
  });
});


it("dismisses the mobile sheet at the desktop breakpoint without reopening on return", async () => {
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
  expect(await screen.findByRole("dialog", { name: "记忆卡导航" })).toBeTruthy();
  act(() => { mobile = false; listeners.forEach(listener => listener()); });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull());
  expect(screen.getByRole("button", { name: "收起侧栏" })).toBeTruthy();
  act(() => { mobile = true; listeners.forEach(listener => listener()); });
  expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull();
  expect(screen.getByRole("button", { name: "打开导航" }).getAttribute("aria-expanded")).toBe("false");
});
