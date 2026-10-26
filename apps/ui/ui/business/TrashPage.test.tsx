// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Note, TrashItem, TrashList } from "@memocard/contracts";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetStorybookBridge, setStorybookRequestHandler } from "../../test-support/bridge";
import { TrashPage } from "./TrashPage";

let detach: (() => void) | undefined;
const style = document.createElement("style");
beforeEach(() => {
  resetStorybookBridge();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  style.textContent = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "trash.css"), "utf8");
  document.head.append(style);
});
afterEach(() => { cleanup(); detach?.(); resetStorybookBridge(); style.remove(); vi.unstubAllGlobals(); });

const note: Note = { id: "archived", title: "已删除的笔记", body: "完整正文", relativePath: "notes/archived.md", tags: [], createdAt: "2026-10-20T08:00:00Z", updatedAt: "2026-10-20T08:00:00Z", contentHash: "reviewed", sourceUrl: "" };
const item: TrashItem = { ...note, trashKey: "archive/archived.md", contentHash: "listed", deletedAt: note.updatedAt, preview: "原始预览" };
const props = { vaultId: "fixture", vaultBinding: "binding", refreshVersion: 0, onRestored: vi.fn() };

it("keeps long titles and deep paths on one line while exposing their full values and preserving independent restore", async () => {
  const user = userEvent.setup();
  const note: Note = { id: "long-note", title: "需要在窄屏保持单行并显示完整提示的长标题".repeat(4), body: "原始正文", relativePath: `${"很深的目录/".repeat(12)}长笔记.md`, tags: [], createdAt: "2026-10-20T08:00:00Z", updatedAt: "2026-10-20T08:00:00Z", contentHash: "reviewed", sourceUrl: "" };
  const item: TrashItem = { ...note, trashKey: "archive/long-note.md", deletedAt: note.updatedAt, contentHash: "listed", preview: "原始预览" };
  let removed = false;
  const request = vi.fn(async (operation: string) => {
    if (operation === "getTrash") return { notes: removed ? [] : [item], issues: [] };
    if (operation === "getTrashedNote") return { trashKey: item.trashKey, deletedAt: item.deletedAt, note };
    if (operation === "restoreNote") { removed = true; return note; }
    throw new Error(operation);
  });
  detach = setStorybookRequestHandler(request);
  render(<TrashPage vaultId="fixture" vaultBinding="binding" refreshVersion={0} onRestored={vi.fn()} />);
  const open = await screen.findByRole("button", { name: `查看已删除笔记：${note.title}` });
  const heading = within(open).getByRole("heading", { name: note.title });
  const path = within(open).getByText(note.relativePath);
  for (const [element, fullText] of [[heading, note.title], [path, note.relativePath]] as const) {
    expect(element.getAttribute("title")).toBe(fullText);
    expect(getComputedStyle(element).whiteSpace).toBe("nowrap");
    expect(getComputedStyle(element).overflow).toBe("hidden");
    expect(getComputedStyle(element).textOverflow).toBe("ellipsis");
  }
  await user.click(open);
  const dialog = await screen.findByRole("dialog", { name: note.title });
  await within(dialog).findByText(note.body);
  expect(request).toHaveBeenCalledWith("getTrashedNote", { trashKey: item.trashKey, vaultId: "fixture", vaultBinding: "binding" });
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", { name: `恢复笔记：${note.title}` }));
  await screen.findByText("回收站是空的");
  expect(request).toHaveBeenCalledWith("restoreNote", { trashKey: item.trashKey, baseHash: "listed", vaultId: "fixture", vaultBinding: "binding" });
  expect(request.mock.calls.filter(([operation]) => operation === "getTrashedNote")).toHaveLength(1);
});

it("announces initial and background loading, retains readable cards after refresh failure and retries into the card empty state", async () => {
  const user = userEvent.setup();
  let resolve!: (value: TrashList) => void;
  let reject!: (reason: unknown) => void;
  detach = setStorybookRequestHandler(() => new Promise<TrashList>((done, fail) => { resolve = done; reject = fail; }));
  const view = render(<TrashPage {...props} />);
  expect(screen.getByRole("status", { name: "正在读取回收站" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "刷新回收站" }).getAttribute("aria-busy")).toBe("true");
  expect(view.container.querySelectorAll('[aria-hidden="true"] .ui-trash-card')).toHaveLength(3);
  await act(async () => resolve({ notes: [item], issues: [] }));
  const open = await screen.findByRole("button", { name: `查看已删除笔记：${note.title}` });
  expect(screen.queryByRole("status", { name: "正在读取回收站" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "刷新回收站" }));
  expect(screen.getByRole("status", { name: "正在读取回收站" })).toBeTruthy();
  expect(screen.getByRole("button", { name: `查看已删除笔记：${note.title}` })).toBe(open);
  expect((screen.getByRole("button", { name: "刷新回收站" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new Error("磁盘拒绝读取")));
  expect(screen.getByRole("alert").textContent).toContain("回收站操作未完成");
  expect(screen.getByRole("alert").textContent).toContain("磁盘拒绝读取");
  expect(screen.queryByText("回收站是空的")).toBeNull();
  expect(screen.getByRole("button", { name: `查看已删除笔记：${note.title}` })).toBe(open);
  await user.click(screen.getByRole("button", { name: "刷新回收站" }));
  await act(async () => resolve({ notes: [], issues: [] }));
  const heading = await screen.findByRole("heading", { level: 2, name: "回收站是空的" });
  expect(heading.closest('[data-slot="card"]')).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("keeps unreadable archive records explained alongside the empty result and never invents a bulk clear action", async () => {
  detach = setStorybookRequestHandler(() => ({ notes: [], issues: [{ path: ".memocard/trash/broken.json", message: "invalid" }] }));
  render(<TrashPage {...props} />);
  await screen.findByRole("heading", { name: "回收站是空的", level: 2 });
  expect(screen.getByRole("status").textContent).toContain("部分回收记录无法读取");
  expect(screen.getByRole("status").textContent).toContain("1 条记录已保留");
  expect(screen.queryByRole("button", { name: /清空|永久删除/ })).toBeNull();
});

it("keeps preview restore disabled until a successful read and restores keyboard focus after a failed read closes", async () => {
  const user = userEvent.setup();
  let reject!: (reason: unknown) => void;
  detach = setStorybookRequestHandler(operation => operation === "getTrash" ? { notes: [item], issues: [] } : new Promise((_done, fail) => { reject = fail; }));
  render(<TrashPage {...props} />);
  const open = await screen.findByRole("button", { name: `查看已删除笔记：${note.title}` });
  open.focus();
  await user.keyboard("{Enter}");
  const dialog = await screen.findByRole("dialog", { name: note.title });
  expect(within(dialog).getByRole("status", { name: "正在读取笔记" })).toBeTruthy();
  expect((within(dialog).getByRole("button", { name: "恢复笔记" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => reject(new Error("记录已变化")));
  expect(within(dialog).getByRole("alert").textContent).toBe("记录已变化");
  expect(within(dialog).getByText(/此内容只读/)).toBeTruthy();
  expect((within(dialog).getByRole("button", { name: "恢复笔记" }) as HTMLButtonElement).disabled).toBe(true);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(open));
});

it("keeps permanent deletion separate, cancelable before confirmation and protected while pending or after failure", async () => {
  const user = userEvent.setup();
  let resolve!: (value: { deleted: boolean }) => void;
  let reject!: (reason: unknown) => void;
  let removed = false;
  const request = vi.fn((operation: string) => {
    if (operation === "getTrash") return { notes: removed ? [] : [item], issues: [] };
    if (operation === "permanentlyDeleteNote") return new Promise<{ deleted: boolean }>((done, fail) => { resolve = done; reject = fail; });
    throw new Error(operation);
  });
  detach = setStorybookRequestHandler(request);
  render(<TrashPage {...props} canPermanentlyDelete />);
  const remove = await screen.findByRole("button", { name: `永久删除笔记：${note.title}` });
  await user.click(remove);
  let dialog = await screen.findByRole("dialog", { name: `永久删除「${note.title}」？` });
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "取消" })));
  await user.click(within(dialog).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(request.mock.calls.filter(([operation]) => operation !== "getTrash")).toHaveLength(0);
  await user.click(remove);
  dialog = await screen.findByRole("dialog", { name: `永久删除「${note.title}」？` });
  await user.dblClick(within(dialog).getByRole("button", { name: "确认永久删除" }));
  expect(request.mock.calls.filter(([operation]) => operation === "permanentlyDeleteNote")).toHaveLength(1);
  expect((within(dialog).getByRole("button", { name: "取消" }) as HTMLButtonElement).disabled).toBe(true);
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBe(dialog);
  await act(async () => reject(new Error("版本冲突")));
  expect(within(dialog).getByRole("alert").textContent).toBe("版本冲突");
  await user.click(within(dialog).getByRole("button", { name: "确认永久删除" }));
  removed = true;
  await act(async () => resolve({ deleted: true }));
  await screen.findByRole("heading", { name: "回收站是空的", level: 2 });
  expect(request).toHaveBeenCalledWith("permanentlyDeleteNote", { trashKey: item.trashKey, baseHash: "listed", vaultId: "fixture", vaultBinding: "binding" });
  expect(request.mock.calls.some(([operation]) => operation === "getTrashedNote")).toBe(false);
});
