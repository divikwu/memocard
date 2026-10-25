// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Note } from "@memocard/contracts";
import { NoteCollection, type NoteCollectionProps } from "./NoteCollection";
import { NotePreview } from "./NotePreview";

vi.mock("./NotePreview", () => ({ NotePreview: vi.fn(({ body }: { body: string }) => <p>{body}</p>) }));

const note: Note = { id: "coffee", title: "咖啡记录", body: "今天尝试了新的手冲配方。", tags: ["area/coffee", "日常", "配方"], createdAt: "2026-10-20T08:00:00Z", updatedAt: "2026-10-22T08:00:00Z", contentHash: "fixture", relativePath: "notes/coffee.md", sourceUrl: "" };
const props = (overrides: Partial<NoteCollectionProps> = {}): NoteCollectionProps => ({
  notes: [note], query: "", onQueryChange: vi.fn(), searchPlaceholder: "搜索笔记内容", searchDisabled: false,
  hasMore: false, paging: false, loadMoreDisabled: false, canOpen: true, canCreate: true,
  onNewNote: vi.fn(), onOpen: vi.fn(), onSelectTag: vi.fn(), onLoadMore: vi.fn(), onError: vi.fn(), formatDate: value => value,
  ...overrides,
});

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("keeps card opening keyboard-accessible and tag filtering independent", async () => {
  const user = userEvent.setup();
  const options = props();
  render(<NoteCollection {...options} />);
  expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("cards");
  await user.click(screen.getByRole("button", { name: "筛选标签 area/coffee" }));
  expect(options.onSelectTag).toHaveBeenCalledWith("area/coffee");
  expect(options.onOpen).not.toHaveBeenCalled();
  const open = screen.getByRole("button", { name: "打开 咖啡记录" });
  expect(open.querySelector("button, a, table, p")).toBeNull();
  open.focus();
  await user.keyboard("{Enter}");
  expect(options.onOpen).toHaveBeenCalledWith("coffee");
  await user.keyboard(" ");
  expect(options.onOpen).toHaveBeenCalledTimes(2);
  screen.getByRole("button", { name: "筛选标签 area/coffee" }).focus();
  await user.keyboard("{Enter}");
  expect(options.onSelectTag).toHaveBeenCalledTimes(2);
  expect(options.onOpen).toHaveBeenCalledTimes(2);
  expect(screen.getByText("+1").getAttribute("aria-label")).toBe("另有 1 个标签");
  const previewProps = vi.mocked(NotePreview).mock.calls.at(-1)![0];
  expect(previewProps).toEqual(expect.objectContaining({ compact: true, showTitle: false, hiddenTags: note.tags, notePath: note.relativePath, onError: options.onError }));
  previewProps.onError("图片暂时无法读取");
  expect(options.onError).toHaveBeenCalledWith("图片暂时无法读取");
});

it("persists layout changes without removing tags or dates from list mode", async () => {
  const user = userEvent.setup();
  const options = props();
  const view = render(<NoteCollection {...options} />);
  await user.click(screen.getByRole("button", { name: "列表布局" }));
  expect(screen.getByRole("list").getAttribute("data-layout")).toBe("list");
  expect(localStorage.getItem("memocard:note-layout")).toBe("list");
  expect(screen.getByRole("button", { name: "筛选标签 日常" })).toBeTruthy();
  expect(screen.getByText(note.createdAt).getAttribute("dateTime")).toBe(note.createdAt);
  view.unmount();
  render(<NoteCollection {...options} />);
  expect(screen.getByRole("button", { name: "列表布局" }).getAttribute("aria-pressed")).toBe("true");
});

it("keeps list opening permission-aware and tag actions independent", async () => {
  const user = userEvent.setup();
  localStorage.setItem("memocard:home-layout", "list");
  const options = props({ canOpen: false, home: { tab: "recent", pinnedCount: 0, onTabChange: vi.fn() } });
  const view = render(<NoteCollection {...options} />);
  const open = screen.getByRole("button", { name: "打开 咖啡记录" });
  expect(open.querySelector(".next-note-list-title")?.textContent).toBe(note.title);
  expect(open.querySelector("time")?.getAttribute("dateTime")).toBe(note.updatedAt);
  expect(open).toHaveProperty("disabled", true);
  await user.click(open);
  expect(options.onOpen).not.toHaveBeenCalled();
  const tag = screen.getByRole("button", { name: "筛选标签 area/coffee" });
  await user.click(tag);
  await user.keyboard("{Enter} ");
  expect(options.onSelectTag).toHaveBeenCalledTimes(3);
  expect(options.onOpen).not.toHaveBeenCalled();

  view.rerender(<NoteCollection {...options} canOpen />);
  expect(open).toHaveProperty("disabled", false);
  expect(open.querySelector("button, a")).toBeNull();
  open.focus();
  await user.keyboard("{Enter} ");
  expect(options.onOpen).toHaveBeenCalledTimes(2);
  expect(options.onOpen).toHaveBeenLastCalledWith("coffee");
  expect(options.onSelectTag).toHaveBeenCalledTimes(3);
});

it("preserves controlled search, clear and create actions and permission flags", async () => {
  const user = userEvent.setup();
  const options = props();
  function SearchFixture() {
    const [query, setQuery] = useState("");
    return <NoteCollection {...options} query={query} onQueryChange={value => { options.onQueryChange(value); setQuery(value); }} />;
  }
  const view = render(<SearchFixture />);
  const input = screen.getByRole("textbox", { name: "搜索当前视图笔记" });
  await user.type(input, "coffee");
  expect(options.onQueryChange).toHaveBeenLastCalledWith("coffee");
  await user.click(screen.getByRole("button", { name: "清空当前搜索" }));
  expect((input as HTMLInputElement).value).toBe("");
  await user.click(screen.getByRole("button", { name: /^新建$/ }));
  expect(options.onNewNote).toHaveBeenCalledTimes(1);
  view.rerender(<NoteCollection {...options} query="coffee" searchDisabled canCreate={false} canOpen={false} />);
  expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "清空当前搜索" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: /^新建$/ }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "打开 咖啡记录" }));
  expect(options.onOpen).not.toHaveBeenCalled();
});

it("switches recent and pinned home tabs with an independent persisted layout", async () => {
  const user = userEvent.setup();
  const options = props();
  const tabChange = vi.fn();
  function HomeFixture() {
    const [tab, setTab] = useState<"recent" | "pinned">("recent");
    return <NoteCollection {...options} home={{ tab, pinnedCount: 2, onTabChange: next => { tabChange(next); setTab(next); } }} />;
  }
  const view = render(<HomeFixture />);
  expect(screen.getByRole("list").getAttribute("data-layout")).toBe("cards");
  expect(screen.getByText(note.updatedAt)).toBeTruthy();
  await user.click(screen.getByRole("tab", { name: /已固定/ }));
  expect(tabChange).toHaveBeenLastCalledWith("pinned");
  expect(screen.getByRole("tab", { name: /已固定/ }).getAttribute("aria-selected")).toBe("true");
  await user.keyboard("{ArrowLeft}");
  expect(tabChange).toHaveBeenLastCalledWith("recent");
  expect(screen.getByRole("tab", { name: /最近更新/ }).getAttribute("aria-selected")).toBe("true");
  await user.click(screen.getByRole("button", { name: "列表布局" }));
  expect(screen.getByRole("list").getAttribute("data-layout")).toBe("list");
  expect(localStorage.getItem("memocard:home-layout")).toBe("list");
  expect(localStorage.getItem("memocard:note-layout")).toBeNull();
  view.unmount();
  render(<HomeFixture />);
  expect(screen.getByRole("button", { name: "列表布局" }).getAttribute("aria-pressed")).toBe("true");
});

it("keeps existing results while loading and preserves caller empty and error feedback", () => {
  const options = props();
  const view = render(<NoteCollection {...options} loading searching />);
  expect(screen.getByRole("status", { name: "正在搜索笔记" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "打开 咖啡记录" })).toBeTruthy();
  view.rerender(<NoteCollection {...options} loading notes={[]}><p>还没有内容</p></NoteCollection>);
  expect(screen.queryByText("还没有内容")).toBeNull();
  expect(view.container.querySelector('[data-slot="collection-skeleton"]')).toBeTruthy();
  view.rerender(<NoteCollection {...options} notes={[]}><p role="alert">笔记读取失败，请重试</p></NoteCollection>);
  expect(screen.getByRole("alert").textContent).toBe("笔记读取失败，请重试");
  expect(screen.queryByText("记下第一条笔记")).toBeNull();
  view.rerender(<NoteCollection {...options} notes={[]}>{null}</NoteCollection>);
  expect(screen.queryByText("记下第一条笔记")).toBeNull();
  view.rerender(<NoteCollection {...options} notes={[]} />);
  expect(screen.getByText("记下第一条笔记")).toBeTruthy();
});

it("loads the next page once and prevents duplicate requests while paging", async () => {
  const user = userEvent.setup();
  const options = props({ hasMore: true });
  const view = render(<NoteCollection {...options} />);
  await user.click(screen.getByRole("button", { name: "加载更多" }));
  expect(options.onLoadMore).toHaveBeenCalledTimes(1);
  view.rerender(<NoteCollection {...options} paging />);
  const more = screen.getByRole("button", { name: "加载更多" });
  expect(more.getAttribute("aria-busy")).toBe("true");
  expect((more as HTMLButtonElement).disabled).toBe(true);
  await user.click(more);
  expect(options.onLoadMore).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toBe("正在加载更多笔记…");
});
