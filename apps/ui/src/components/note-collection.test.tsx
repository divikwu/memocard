// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { Note } from "@memocard/contracts";
import { NoteCollection } from "./note-collection";

vi.mock("../NotePreview", () => ({ NotePreview: ({ body }: { body: string }) => <p>{body}</p> }));
const note: Note = { id: "note-1", title: "散步的想法", body: "周末散步时想到的记录", tags: ["生活"], createdAt: "2026-10-10T08:00:00Z", updatedAt: "2026-10-10T08:00:00Z", contentHash: "hash", relativePath: "notes/note-1.md", sourceUrl: "memocard://note/note-1" };
const props = { notes: [note], query: "", onQueryChange: vi.fn(), searchPlaceholder: "搜索当前标签内容", searchDisabled: false, hasMore: true, paging: false, loadMoreDisabled: false, canOpen: true, canCreate: true, onNewNote: vi.fn(), onOpen: vi.fn(), onSelectTag: vi.fn(), onLoadMore: vi.fn(), onError: vi.fn(), formatDate: () => "10月10日 16:00" };

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); localStorage.removeItem("memocard:note-layout"); localStorage.removeItem("memocard:home-layout"); });

it.each(["cards", "list"])("identifies notes by title even when their dates match in %s layout", layout => {
  localStorage.setItem("memocard:note-layout", layout);
  render(<NoteCollection {...props} notes={[note, { ...note, id: "note-2", title: "第二条笔记" }, { ...note, id: "note-3", title: " " }]} />);
  for (const title of ["散步的想法", "第二条笔记", "新内容"]) {
    fireEvent.click(screen.getByRole("button", { name: `打开 ${title}` }));
  }
  expect(props.onOpen.mock.calls).toEqual([[note.id], ["note-2"], ["note-3"]]);
});

it("shares the home layout across content tabs without exposing pin actions on notes", async () => {
  const user = userEvent.setup();
  const onTabChange = vi.fn();
  const updated = { ...note, updatedAt: "2026-10-14T08:00:00Z" };
  const view = render(<NoteCollection {...props} notes={[updated]} home={{tab:"recent", pinnedCount:1, onTabChange}} />);
  expect(screen.getByRole("tab", {name:"最近更新"}).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("list", {name:"笔记列表"}).getAttribute("data-layout")).toBe("list");
  expect(screen.getByText("10月10日 16:00").getAttribute("datetime")).toBe(updated.updatedAt);
  await user.click(screen.getByRole("button", {name:"卡片布局"}));
  await user.click(screen.getByRole("tab", {name:/已固定/}));
  expect(onTabChange).toHaveBeenCalledWith("pinned");
  view.rerender(<NoteCollection {...props} home={{tab:"pinned", pinnedCount:1, onTabChange}} />);
  expect(screen.getByRole("list", {name:"笔记列表"}).getAttribute("data-layout")).toBe("cards");
  expect(screen.queryByRole("button", {name:/固定/})).toBeNull();
  expect(screen.queryByText("查看全部")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  view.unmount();
  render(<NoteCollection {...props} home={{tab:"recent", pinnedCount:1, onTabChange}} />);
  expect(screen.getByRole("button", {name:"卡片布局"}).getAttribute("aria-pressed")).toBe("true");
});

it("shows titles, clickable tags and trailing time in the list and restores content in cards", async () => {
  const user = userEvent.setup();
  render(<NoteCollection {...props} />);
  expect(screen.getByRole("tab", { name: "卡片布局" }).getAttribute("aria-selected")).toBe("true");
  screen.getByRole("tab", { name: "列表布局" }).focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("list");
  expect(screen.getByRole("tab", { name: "列表布局" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText(note.title!)).toBeTruthy();
  expect(screen.queryByText(note.body)).toBeNull();
  const time = screen.getByText("10月10日 16:00");
  expect(time.tagName).toBe("TIME");
  expect(time.getAttribute("datetime")).toBe(note.createdAt);
  expect(time.parentElement?.lastElementChild).toBe(time);
  await user.click(screen.getByRole("button", { name: "筛选标签 生活" }));
  expect(props.onSelectTag).toHaveBeenCalledWith("生活");
  expect(props.onOpen).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "打开 散步的想法" }));
  expect(props.onOpen).toHaveBeenCalledWith(note.id);
  await user.click(screen.getByRole("button", { name: "加载更多" }));
  expect(props.onLoadMore).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("tab", { name: "卡片布局" }));
  expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("cards");
  expect(screen.getByText(note.body)).toBeTruthy();
  expect(screen.getByText("10月10日 16:00")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "筛选标签 生活" }));
  expect(props.onSelectTag).toHaveBeenCalledWith("生活");
});

it("opens the existing new-note flow only when creation is available", async () => {
  const user = userEvent.setup();
  const view = render(<NoteCollection {...props} canCreate={false} />);
  await user.click(screen.getByRole("button", { name: "新建" }));
  expect(props.onNewNote).not.toHaveBeenCalled();
  view.rerender(<NoteCollection {...props} />);
  await user.click(screen.getByRole("button", { name: "新建" }));
  expect(props.onNewNote).toHaveBeenCalledOnce();
  expect(props.onOpen).not.toHaveBeenCalled();
});

it("switches layouts with arrow keys and labels the visible tab panel", async () => {
  const user = userEvent.setup();
  render(<NoteCollection {...props} />);
  const cardsTab = screen.getByRole("tab", { name: "卡片布局" });
  const listTab = screen.getByRole("tab", { name: "列表布局" });
  cardsTab.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(listTab);
  expect(listTab.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel", { name: "列表布局" }).id).toBe(listTab.getAttribute("aria-controls"));
  expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("list");
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(cardsTab);
  expect(screen.getByRole("tabpanel", { name: "卡片布局" }).id).toBe(cardsTab.getAttribute("aria-controls"));
  expect(screen.getByText(note.body)).toBeTruthy();
});

it.each(["cards", "list"])("shows at most two tags and the remaining count in %s layout", layout => {
  localStorage.setItem("memocard:note-layout", layout);
  render(<NoteCollection {...props} notes={[{ ...note, tags: ["生活", "思考", "写作", "灵感"] }]} />);
  expect(screen.getByRole("button", { name: "筛选标签 生活" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "筛选标签 思考" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "筛选标签 写作" })).toBeNull();
  expect(screen.queryByRole("button", { name: "筛选标签 灵感" })).toBeNull();
  expect(screen.getByText("+2")).toBeTruthy();
});

it("restores the saved layout after remounting and preserves it when notes change", async () => {
  const user = userEvent.setup();
  const view = render(<NoteCollection {...props} />);
  await user.click(screen.getByRole("tab", { name: "列表布局" }));
  expect(localStorage.getItem("memocard:note-layout")).toBe("list");
  view.rerender(<NoteCollection {...props} notes={[note, { ...note, id: "note-2", title: "第二条笔记" }]} />);
  expect(screen.getByRole("list", { name: "笔记列表" }).children).toHaveLength(2);
  expect(screen.getByRole("tab", { name: "列表布局" }).getAttribute("aria-selected")).toBe("true");
  view.unmount();
  render(<NoteCollection {...props} />);
  expect(screen.getByRole("tab", { name: "列表布局" }).getAttribute("aria-selected")).toBe("true");
});

it("defaults to cards for invalid preferences and keeps switching available without storage", async () => {
  localStorage.setItem("memocard:note-layout", "unknown");
  const view = render(<NoteCollection {...props} />);
  expect(screen.getByRole("tab", { name: "卡片布局" }).getAttribute("aria-selected")).toBe("true");
  view.unmount();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  render(<NoteCollection {...props} />);
  await userEvent.setup().click(screen.getByRole("tab", { name: "列表布局" }));
  expect(screen.getByRole("tab", { name: "列表布局" }).getAttribute("aria-selected")).toBe("true");
});

it("keeps the toolbar and saved layout mounted while the first page loads", async () => {
  localStorage.setItem("memocard:note-layout", "list");
  const view = render(<NoteCollection {...props} notes={[]} loading hasMore={false} />);
  expect(screen.getByRole("textbox", {name:"搜索当前视图笔记"})).toBeTruthy();
  expect(screen.getByRole("button", {name:"新建"})).toBeTruthy();
  expect(screen.getByRole("tab", {name:"列表布局"}).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("status", {name:"正在读取笔记库"})).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("tab", {name:"卡片布局"}));
  view.rerender(<NoteCollection {...props} loading={false} />);
  expect(screen.getByRole("tab", {name:"卡片布局"}).getAttribute("aria-selected")).toBe("true");
  expect(await screen.findByText(note.body)).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});

it("marks retained search results busy until the replacement arrives", () => {
  const view = render(<NoteCollection {...props} query="新关键词" loading searching />);
  const list = screen.getByRole("list", {name:"笔记列表"});
  expect(list.parentElement?.getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("button", {name:`打开 ${note.title}`})).toBeTruthy();
  expect(screen.getByRole("status", {name:"正在搜索笔记"})).toBeTruthy();
  view.rerender(<NoteCollection {...props} query="新关键词" notes={[]} hasMore={false}><p>没有相关笔记</p></NoteCollection>);
  expect(screen.getByText("没有相关笔记")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByRole("button", {name:`打开 ${note.title}`})).toBeNull();
});
