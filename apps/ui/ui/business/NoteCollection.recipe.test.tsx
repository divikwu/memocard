// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Note } from "@memocard/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NoteCollection, type NoteCollectionProps } from "./NoteCollection";

const note: Note = { id: "compact", title: "集合的界面标题", body: "# 正文中的标题\n\n保留**正文强调**和[参考链接](https://example.com)。\n\n- 第一行\n- 第二行\n\n#设计", tags: ["设计"], relativePath: "notes/compact.md", contentHash: "seed", sourceUrl: "", createdAt: "2026-10-22T08:00:00Z", updatedAt: "2026-10-22T08:00:00Z" };
const props = (): NoteCollectionProps => ({ notes: [note], query: "", onQueryChange: vi.fn(), searchPlaceholder: "搜索", searchDisabled: false, hasMore: false, paging: false, loadMoreDisabled: false, canOpen: true, canCreate: true, onNewNote: vi.fn(), onOpen: vi.fn(), onSelectTag: vi.fn(), onLoadMore: vi.fn(), onError: vi.fn(), formatDate: () => "2026-10-22" });
const style = document.createElement("style");
// Keep cold Markdown compilation outside the rendering assertion deadline.
beforeAll(async () => { await import("./NotePreview"); }, 15000);
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const directory = dirname(fileURLToPath(import.meta.url));
  style.textContent = ["note-content.css", "NoteCollection.css"].map(file => readFileSync(join(directory, file), "utf8")).join("\n");
  document.head.append(style);
});
afterEach(() => { cleanup(); style.remove(); vi.unstubAllGlobals(); });

it("uses the UI body font for card titles and the compact reading recipe for real Markdown without changing other previews", async () => {
  render(<NoteCollection {...props()} />);
  const previewHeading = await screen.findByRole("heading", { name: "正文中的标题" });
  const markdown = previewHeading.closest(".ui-note-markdown")!;
  expect(getComputedStyle(screen.getByRole("heading", { name: "集合的界面标题" })).fontFamily).toContain("--font-family-body");
  expect(getComputedStyle(previewHeading).fontSize).toBe("1em");
  expect(getComputedStyle(previewHeading).fontFamily).toBe(getComputedStyle(markdown).fontFamily);
  expect(getComputedStyle(markdown).getPropertyValue("--typeset-flow")).toBe("var(--spacing-1)");
  expect(getComputedStyle(markdown).fontSize).toContain("--font-size-sm");
  expect(getComputedStyle(markdown).lineHeight).toContain("--text-body-leading");
  expect(markdown.querySelector("button, a, input, [tabindex]")).toBeNull();
  expect(getComputedStyle(markdown.closest(".ui-note-preview")!).pointerEvents).toBe("none");
  const independent = markdown.cloneNode(true) as HTMLElement;
  document.body.append(independent);
  expect(getComputedStyle(independent.querySelector("h1")!).fontSize).not.toBe("1em");
  independent.remove();
});

it("keeps Badge tag filtering independent of card opening with Enter and Space in both persisted layouts", async () => {
  const user = userEvent.setup();
  const model = props();
  render(<NoteCollection {...model} />);
  for (const layout of ["cards", "list"] as const) {
    if (layout === "list") await user.click(screen.getByRole("button", { name: "列表布局" }));
    const list = screen.getByRole("list", { name: "笔记列表" });
    expect(list.getAttribute("data-layout")).toBe(layout);
    const tag = within(list).getByRole("button", { name: "筛选标签 设计" });
    expect(tag.getAttribute("data-slot")).toBe("badge");
    tag.focus();
    await user.keyboard("{Enter} ");
    expect(model.onOpen).toHaveBeenCalledTimes(layout === "cards" ? 0 : 2);
    const open = within(list).getByRole("button", { name: "打开 集合的界面标题" });
    open.focus();
    await user.keyboard("{Enter} ");
  }
  expect(model.onSelectTag).toHaveBeenCalledTimes(4);
  expect(model.onOpen).toHaveBeenCalledTimes(4);
  expect(localStorage.getItem("memocard:note-layout")).toBe("list");
});
