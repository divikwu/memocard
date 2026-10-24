// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Note } from "@memocard/contracts";
import { NoteSearchDialog } from "./NoteSearchDialog";

const bridge = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/bridge", () => ({ request: bridge.request, errorMessage: (cause: unknown) => String(cause) }));
const note: Note = { id: "first", title: "完整笔记预览", body: "# 正文标题\n\n[参考链接](https://example.com)\n\n- [x] 已完成\n\n<details><summary>折叠说明</summary><p>折叠正文</p></details>\n\n```ts\nconst answer = 42;\n```\n\n| 项目 | 状态 |\n| --- | --- |\n| 搜索 | 保留 |", tags: [], relativePath: "notes/preview.md", createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", contentHash: "hash", sourceUrl: "" };
const coverage = { complete: true, indexed: 1, pending: 0, issues: 0, indexedAt: note.updatedAt };
beforeEach(() => {
  bridge.request.mockReset();
  bridge.request.mockResolvedValue({ notes: [note], nextCursor: null, coverage });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("preserves the full Markdown preview inside an inert region and keeps only the open action outside it", async () => {
  const onOpenNote = vi.fn();
  render(<NoteSearchDialog open available vaultName="测试库" returnFocus={{ current: null }} onOpenChange={vi.fn()} onOpenNote={onOpenNote} />);
  await screen.findByRole("option", { name: note.title! });
  const preview = screen.getByRole("complementary", { name: "笔记预览" });
  const content = preview.querySelector("[inert]")!;
  expect(content.querySelector("a")?.textContent).toBe("参考链接");
  expect(content.querySelector("a")).toHaveProperty("href", "https://example.com/");
  expect(content.querySelector("details")).toHaveProperty("open", false);
  expect(content.querySelector("summary")?.textContent).toBe("折叠说明");
  expect(content.querySelector('input[type="checkbox"]')).toHaveProperty("checked", true);
  expect(content.querySelector('input[type="checkbox"]')).toHaveProperty("disabled", true);
  expect(content.querySelector("pre code")?.textContent).toContain("const answer = 42;");
  expect(content.querySelector("table")?.textContent).toContain("搜索保留");
  const open = within(preview).getByRole("button", { name: "打开笔记" });
  expect(open.closest("[inert]")).toBeNull();
  await userEvent.setup().click(open);
  expect(onOpenNote).toHaveBeenCalledWith(note.id);
});

it("keeps a body-only note free from an invented preview title", async () => {
  bridge.request.mockResolvedValue({ notes: [{ ...note, title: "" }], nextCursor: null, coverage });
  render(<NoteSearchDialog open available vaultName="测试库" returnFocus={{ current: null }} onOpenChange={vi.fn()} onOpenNote={vi.fn()} />);
  await screen.findByRole("option", { name: "新内容" });
  const preview = screen.getByRole("complementary", { name: "笔记预览" });
  expect(preview.querySelector(".note-search-next-preview-title")).toBeNull();
  expect(preview.querySelector("h1")?.textContent).toBe("正文标题");
  expect(within(preview).getByRole("button", { name: "打开笔记" })).toBeTruthy();
});
