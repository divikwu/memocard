// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import type { Note } from "@memocard/contracts";
import { NoteSearchDialog } from "./NoteSearchDialog";
import { swipeSheet } from "../../src/components/ui/sheet-swipe.test-utils";

const bridge = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/bridge", () => ({ request: bridge.request, errorMessage: (cause: unknown) => String(cause) }));
vi.mock("./NoteMarkdown", () => ({ NoteMarkdown: ({ body }: { body: string }) => <p>{body}</p> }));
const coverage = { complete: true, indexed: 2, pending: 0, issues: 0, indexedAt: "2026-10-16T00:00:00Z" };
const note: Note = { id: "first", title: "项目计划", body: "计划正文", tags: ["工作"], relativePath: "projects/计划.md", createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-16T00:00:00Z", contentHash: "hash", sourceUrl: "" };
const second = { ...note, id: "second", title: "周末散步", body: "散步正文", relativePath: "生活/散步.md" };
function setup() {
  const onOpenNote = vi.fn(), onOpenChange = vi.fn();
  const props = { open: true, onOpenNote, onOpenChange, vaultName: "测试库", available: true, returnFocus: { current: null } };
  const view = render(<NoteSearchDialog {...props} />);
  return { ...view, props, onOpenNote, onOpenChange };
}
beforeEach(() => {
  bridge.request.mockReset();
  bridge.request.mockResolvedValue({ notes: [note, second], nextCursor: null, coverage });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it("queries all notes by update time, previews keyboard selection and opens on Enter", async () => {
  const { onOpenNote } = setup();
  await screen.findByRole("option", { name: "项目计划" });
  expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "", tags: [], sort: "updatedAt", limit: 30 });
  expect(screen.getByText("计划正文")).toBeTruthy();
  const input = screen.getByRole("combobox", { name: "搜索笔记" });
  await waitFor(() => expect(document.activeElement).toBe(input));
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getByRole("option", { name: "周末散步" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText("散步正文")).toBeTruthy();
  expect(input.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "周末散步" }).id);
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(onOpenNote).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onOpenNote).toHaveBeenCalledWith("second");
});

it("discards late responses after a new query and clears back to recent notes", async () => {
  let finishOld!: (value: unknown) => void;
  bridge.request.mockImplementation((_operation, params) => params.query === "旧" ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve({ notes: params.query ? [second] : [note], nextCursor: null, coverage }));
  setup();
  await screen.findByRole("option", { name: "项目计划" });
  const input = screen.getByRole("combobox", { name: "搜索笔记" });
  fireEvent.change(input, { target: { value: "旧" } });
  await waitFor(() => expect(finishOld).toBeTypeOf("function"));
  fireEvent.change(input, { target: { value: "散步" } });
  await screen.findByRole("option", { name: "周末散步" });
  await act(async () => finishOld({ notes: [note], nextCursor: null, coverage }));
  expect(screen.queryByRole("option", { name: "项目计划" })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "清空搜索" }));
  await screen.findByRole("option", { name: "项目计划" });
  expect((input as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(input);
});

it("loads further results with the same global query and ignores stale pagination", async () => {
  let finishPage!: (value: unknown) => void;
  bridge.request.mockImplementation((_operation, params) => params.cursor ? new Promise(resolve => { finishPage = resolve; }) : Promise.resolve({ notes: params.query ? [second] : [note], nextCursor: params.query ? null : "next", coverage }));
  setup();
  await userEvent.setup().click(await screen.findByRole("button", { name: "加载更多结果" }));
  expect(bridge.request).toHaveBeenCalledWith("queryNotes", { query: "", tags: [], sort: "updatedAt", limit: 30, cursor: "next" });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "散步" } });
  await screen.findByRole("option", { name: "周末散步" });
  await act(async () => finishPage({ notes: [note], nextCursor: null, coverage }));
  expect(screen.queryByRole("option", { name: "项目计划" })).toBeNull();
});

it("shows errors with retry, empty results and incomplete coverage", async () => {
  bridge.request.mockRejectedValueOnce("读取失败").mockResolvedValue({ notes: [], nextCursor: null, coverage: { ...coverage, complete: false } });
  setup();
  expect((await screen.findByRole("alert")).textContent).toContain("读取失败");
  await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
  await screen.findByText("笔记库中还没有笔记");
  expect(screen.getByText("部分文件尚未读入，搜索结果可能不完整。")).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "不存在" } });
  await screen.findByText("没有找到相关笔记");
});

it("stops requests and clears results when the vault disconnects", async () => {
  const { rerender, props, onOpenNote } = setup();
  await screen.findByRole("option", { name: "项目计划" });
  const count = bridge.request.mock.calls.length;
  rerender(<NoteSearchDialog {...props} available={false} />);
  expect(screen.queryByRole("option")).toBeNull();
  expect(screen.getByRole("combobox", { name: "搜索笔记" })).toHaveProperty("disabled", true);
  expect(screen.getByText("请先连接笔记库，再搜索内容。")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(bridge.request.mock.calls).toHaveLength(count);
  expect(onOpenNote).not.toHaveBeenCalled();
});

it("restarts from the first page when the vault changes during pagination", async () => {
  bridge.request.mockResolvedValueOnce({ notes: [note], nextCursor: "old-cursor", coverage })
    .mockRejectedValueOnce({ code: "STALE_CURSOR" })
    .mockResolvedValue({ notes: [second], nextCursor: null, coverage });
  setup();
  await userEvent.setup().click(await screen.findByRole("button", { name: "加载更多结果" }));
  await screen.findByRole("option", { name: "周末散步" });
  expect(screen.queryByRole("option", { name: "项目计划" })).toBeNull();
  expect(bridge.request.mock.calls.at(-1)).toEqual(["queryNotes", { query: "", tags: [], sort: "updatedAt", limit: 30 }]);
});

it("provides a dismissal action and tracks keyboard focus without a pointer background", async () => {
  const { onOpenChange } = setup();
  const input = screen.getByRole("combobox", { name: "搜索笔记" });
  fireEvent.keyDown(input, { key: "Tab" });
  expect(screen.getByRole("dialog").hasAttribute("data-keyboard-focus")).toBe(true);
  fireEvent.pointerDown(input);
  expect(screen.getByRole("dialog").hasAttribute("data-keyboard-focus")).toBe(false);
  await userEvent.setup().click(screen.getByRole("button", { name: "关闭搜索" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("closes on Escape and returns focus to the connected search trigger", async () => {
  const trigger = document.createElement("button");
  trigger.textContent = "打开搜索";
  document.body.append(trigger);
  const onOpenChange = vi.fn();
  const props = { open: true, onOpenNote: vi.fn(), onOpenChange, vaultName: "测试库", available: true, returnFocus: { current: trigger } };
  const view = render(<NoteSearchDialog {...props} />);
  try {
    const input = screen.getByRole("combobox", { name: "搜索笔记" });
    await waitFor(() => expect(document.activeElement).toBe(input));
    await userEvent.setup().keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: "escape-key" }));
    view.rerender(<NoteSearchDialog {...props} open={false} />);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  } finally {
    view.unmount();
    trigger.remove();
  }
});

it("keeps loaded results and selection when pagination fails, then retries the same cursor", async () => {
  bridge.request.mockResolvedValueOnce({ notes: [note, second], nextCursor: "next", coverage })
    .mockRejectedValueOnce("下一页读取失败")
    .mockResolvedValue({ notes: [{ ...note, id: "third", title: "下一页笔记" }], nextCursor: null, coverage });
  const { onOpenNote } = setup();
  await screen.findByRole("option", { name: "项目计划" });
  const input = screen.getByRole("combobox", { name: "搜索笔记" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  const results = screen.getByRole("listbox").parentElement!;
  fireEvent.scroll(results, { target: { scrollTop: 120 } });
  await userEvent.setup().click(screen.getByRole("button", { name: "加载更多结果" }));
  expect((await screen.findByRole("alert")).textContent).toContain("下一页读取失败");
  expect(screen.getAllByRole("option")).toHaveLength(2);
  expect(screen.getByRole("option", { name: "周末散步" }).getAttribute("aria-selected")).toBe("true");
  expect(results.scrollTop).toBe(120);
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onOpenNote).toHaveBeenCalledWith("second");
  await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
  await screen.findByRole("option", { name: "下一页笔记" });
  expect(bridge.request.mock.calls.at(-1)).toEqual(["queryNotes", { query: "", tags: [], sort: "updatedAt", limit: 30, cursor: "next" }]);
  expect(screen.getAllByRole("option")).toHaveLength(3);
  expect(screen.queryByRole("alert")).toBeNull();
});

it("announces pending search and opens results only after loading finishes", async () => {
  let finish!: (value: unknown) => void;
  bridge.request.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { onOpenNote } = setup();
  const input = screen.getByRole("combobox", { name: "搜索笔记" });
  expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("status").textContent).toContain("正在搜索笔记");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onOpenNote).not.toHaveBeenCalled();
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  await act(async () => finish({ notes: [note], nextCursor: null, coverage }));
  expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("false");
  await userEvent.setup().click(screen.getByRole("option", { name: "项目计划" }));
  expect(onOpenNote).toHaveBeenCalledWith("first");
});

it("highlights the first literal case-insensitive title match using the trimmed query", async () => {
  const matching = { ...note, title: "Plan [a] plan [a]" };
  bridge.request.mockResolvedValue({ notes: [matching], nextCursor: null, coverage });
  setup();
  await screen.findByRole("option", { name: matching.title });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: " [A] " } });
  await waitFor(() => expect(bridge.request).toHaveBeenLastCalledWith("queryNotes", { query: "[A]", tags: [], sort: "updatedAt", limit: 30 }));
  const result = await screen.findByRole("option", { name: matching.title });
  const marks = result.querySelectorAll("mark");
  expect(marks).toHaveLength(1);
  expect(marks[0].textContent).toBe("[a]");
  expect(result.textContent).toBe(matching.title);
});

it("groups notes by update time, merges paginated groups and keeps keyboard order across groups", async () => {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const dated = (days: number, id: string) => {
    const updated = new Date(today); updated.setDate(today.getDate() - days);
    return { ...note, id, title: id, updatedAt: updated.toISOString() };
  };
  bridge.request.mockResolvedValueOnce({ notes: [dated(0, "今天的笔记"), dated(1, "昨天的笔记"), dated(2, "近期笔记一")], nextCursor: "next", coverage })
    .mockResolvedValue({ notes: [dated(6, "近期笔记二"), dated(8, "更早的笔记")], nextCursor: null, coverage });
  const { onOpenNote } = setup();
  await screen.findByRole("option", { name: "今天的笔记" });
  expect(within(screen.getByRole("group", { name: "今天" })).getByRole("option", { name: "今天的笔记" })).toBeTruthy();
  expect(within(screen.getByRole("group", { name: "昨天" })).getByRole("option", { name: "昨天的笔记" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "加载更多结果" }));
  await screen.findByRole("option", { name: "更早的笔记" });
  expect(screen.getAllByRole("group", { name: "过去 7 天" })).toHaveLength(1);
  expect(within(screen.getByRole("group", { name: "过去 7 天" })).getAllByRole("option")).toHaveLength(2);
  expect(within(screen.getByRole("group", { name: "更早" })).getByRole("option", { name: "更早的笔记" })).toBeTruthy();
  const input = screen.getByRole("combobox", { name: "搜索笔记" });
  for (let index = 0; index < 4; index++) fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onOpenNote).toHaveBeenCalledWith("更早的笔记");
});

it('preserves mobile query, pagination, selection and result scroll while visiting a note',async()=>{
  vi.stubGlobal('innerWidth',390);
  window.matchMedia=vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()});
  bridge.request.mockImplementation((_op,params)=>Promise.resolve({notes:params.cursor ? [second] : [note],nextCursor:params.cursor ? null : 'next',coverage}));
  const onOpenNote=vi.fn(),onOpenChange=vi.fn();
  const props={open:true,preserveSession:true,onOpenNote,onOpenChange,vaultName:'测试库',available:true,returnFocus:{current:null}};
  const page=render(<NoteSearchDialog {...props} />);
  const input=screen.getByRole('combobox',{name:'搜索笔记'});
  await waitFor(()=>expect(document.activeElement).toBe(input));
  fireEvent.change(input,{target:{value:'项目'}});
  await screen.findByRole('option',{name:'项目计划'});
  await userEvent.setup().click(screen.getByRole('button',{name:'加载更多结果'}));
  await screen.findByRole('option',{name:'周末散步'});
  fireEvent.keyDown(input,{key:'ArrowDown'});
  fireEvent.scroll(screen.getByRole('listbox',{name:'搜索结果'}).parentElement!,{target:{scrollTop:275}});
  fireEvent.keyDown(input,{key:'Enter'});
  expect(onOpenNote).toHaveBeenCalledWith('second');
  const calls=bridge.request.mock.calls.length;
  page.rerender(<NoteSearchDialog {...props} open={false} />);
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'搜索笔记'})).toBeNull());
  page.rerender(<NoteSearchDialog {...props} />);
  expect(await screen.findByRole('combobox',{name:'搜索笔记'})).toHaveProperty('value','项目');
  expect(screen.getByRole('listbox',{name:'搜索结果'}).parentElement!.scrollTop).toBe(275);
  expect(screen.getByRole('option',{name:'周末散步'}).getAttribute('aria-selected')).toBe('true');
  expect(bridge.request.mock.calls).toHaveLength(calls);
  expect(screen.queryByRole('button',{name:'加载更多结果'})).toBeNull();
  await userEvent.setup().click(screen.getByRole('button',{name:'退出搜索'}));
  expect(onOpenChange).toHaveBeenCalledWith(false,expect.objectContaining({reason:'close-press'}));
});

it('fits mobile search to the visible viewport while the keyboard is open',async()=>{
  vi.stubGlobal('innerWidth',390);
  vi.stubGlobal('innerHeight',852);
  window.matchMedia=vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()});
  const viewport=Object.assign(new EventTarget(),{height:360,offsetTop:12});
  vi.stubGlobal('visualViewport',viewport);
  setup();
  const dialog=screen.getByRole('dialog',{name:'搜索笔记'});
  expect(dialog.style.bottom).toBe('480px');
  expect(dialog.style.maxHeight).toBe('344px');
  act(()=>{viewport.height=420;viewport.offsetTop=0;viewport.dispatchEvent(new Event('resize'));});
  expect(dialog.style.bottom).toBe('432px');
  expect(dialog.style.maxHeight).toBe('404px');
});

it('allows mobile search dismissal from its title while keeping result gestures separate',async()=>{
  vi.stubGlobal('innerWidth',390);
  window.matchMedia=vi.fn().mockReturnValue({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()});
  const {onOpenChange}=setup();
  const result=await screen.findByRole('option',{name:'项目计划'});
  const popup=screen.getByRole('dialog',{name:'搜索笔记'});
  await waitFor(()=>expect(popup.hasAttribute('data-swipe-ready')).toBe(true));
  swipeSheet(popup.querySelector('[data-slot="sheet-handle"]')!,20);
  expect(popup.style.getPropertyValue('--sheet-swipe-y')).toBe('0px');
  swipeSheet(result,160);
  swipeSheet(screen.getByRole('combobox',{name:'搜索笔记'}),160);
  expect(onOpenChange).not.toHaveBeenCalled();
  swipeSheet(screen.getByRole('heading',{name:'搜索笔记'}),160);
  expect(onOpenChange).toHaveBeenCalledWith(false,expect.objectContaining({reason:'close-press'}));
});
