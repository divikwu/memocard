// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, VaultStatus } from "@memocard/contracts";
import { App } from "./App";

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
  window.history.replaceState(null, "", "#/notes");
  bridge.request.mockReset();
  bridge.request.mockImplementation(async (operation: string) => {
    switch (operation) {
      case "getEnvironment": return { platform: "mac", phase: "M1", mcpEnabled: false, capabilities: ["selectVault"] };
      case "getStatus": return status;
      case "queryNotes": return { notes: [note], nextCursor: null, coverage: status.coverage };
      case "getDrafts": return { drafts: [] };
      case "listTags": return { tags: [{ name: "生活", count: 1 }] };
      case "selectVault": return { cancelled: true };
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

    await user.click(screen.getByRole("button", { name: "设置" }));
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
    fireEvent.change(screen.getByRole("textbox", { name: "搜索笔记" }), { target: { value: "散步" } });
    await waitFor(() => expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "散步", tags: ["生活"], limit: 30 }));

    await user.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(screen.queryByRole("navigation", { name: "主要导航" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "展开侧栏" }));

    expect(screen.getByRole("navigation", { name: "主要导航" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "搜索笔记" }) as HTMLInputElement).value).toBe("散步");
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
    const input = screen.getByRole("textbox", { name: "搜索笔记" });
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
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "设置" }));
    await user.click(screen.getByRole("button", { name: "打开导航" }));
    const sheet = await screen.findByRole("dialog", { name: "记忆卡导航" });

    await user.click(within(sheet).getByRole("button", { name: "搜索" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "搜索笔记" })));
    expect(window.location.hash).toBe("#/notes");
  });

  it("closes mobile navigation and transfers focus to the new note editor", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(note.body);
    await user.click(screen.getByRole("button", { name: "打开导航" }));
    const sheet = await screen.findByRole("dialog", { name: "记忆卡导航" });

    await user.click(within(sheet).getByRole("button", { name: "新建笔记" }));

    const editor = await screen.findByRole("dialog", { name: "新建笔记" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "记忆卡导航" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(within(editor).getByRole("textbox", { name: "笔记内容" })));
  });
});

it("creates in the selected folder and makes card tags use the global tag scope", async () => {
  const original = bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((operation: string, ...args: unknown[]) => {
    if (operation === "getStatus") return Promise.resolve({ ...status, capabilities: [...status.capabilities, "listFolders"] });
    if (operation === "listFolders") return Promise.resolve({ folders: ["notes", "notes/工作"], coverage: status.coverage });
    return original(operation, ...args);
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /^工作$/ }));
  await user.click(screen.getByRole("button", { name: /^新建笔记$/ }));
  expect(await screen.findByText("保存到：笔记目录 / 工作")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "保存草稿并关闭" }));
  await user.click(await screen.findByRole("button", { name: "#生活" }));
  await waitFor(() => {
    const calls = bridge.request.mock.calls.filter(([operation]) => operation === "queryNotes");
    expect(calls.at(-1)?.[1]).toMatchObject({ tags: ["生活"] });
    expect(calls.at(-1)?.[1].folder).toBeUndefined();
  });
});
