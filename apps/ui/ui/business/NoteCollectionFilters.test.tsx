// @vitest-environment jsdom
import { useState } from "react";
import type { NoteQuickFilter } from "@memocard/contracts";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NoteCollectionFilters } from "./NoteCollectionFilters";
import { NoteCollection } from "./NoteCollection";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("supports multiple tags and one type, preserves collapsed selections, and clears both", async () => {
  const change = vi.fn();
  function Filters() {
    const [value, setValue] = useState<{ tag: string[]; filter: NoteQuickFilter[] }>({ tag: [], filter: [] });
    return <NoteCollectionFilters tags={[{ name: "设计", count: 2 }, { name: "Coffee", count: 5 }, { name: "生活", count: 3 }]} filterCounts={{ untagged: 0, images: 123, links: 7 }} activeTags={value.tag} quickFilters={value.filter} onChange={(tag, filter) => { change(tag, filter); setValue({ tag, filter }); }} />;
  }
  const user = userEvent.setup();
  render(<Filters />);
  const trigger = screen.getByRole("button", { name: "筛选笔记" });
  await user.click(trigger);
  const dialog = within(await screen.findByRole("dialog", { name: "筛选笔记" }));
  expect(dialog.queryByRole("button", { name: "全部标签" })).toBeNull();
  expect(dialog.getByRole("button", { name: "无标签" }).textContent).toBe("无标签0");
  expect(dialog.getByRole("button", { name: "有图片" }).textContent).toBe("有图片123");
  expect(within(dialog.getByRole("list", { name: "C" })).getByRole("button", { name: "筛选标签 Coffee" }).getAttribute("aria-description")).toBe("5 条笔记");
  await user.type(dialog.getByRole("textbox", { name: "搜索筛选标签" }), "coffee");
  expect(dialog.queryByRole("button", { name: "筛选标签 设计" })).toBeNull();
  await user.click(dialog.getByRole("button", { name: "筛选标签 Coffee" }));
  expect(change).toHaveBeenLastCalledWith(["Coffee"], []);
  await user.click(dialog.getByRole("button", { name: "有图片" }));
  expect(change).toHaveBeenLastCalledWith(["Coffee"], ["images"]);
  expect(dialog.getByRole("button", { name: "有图片" }).getAttribute("aria-description")).toBe("全库 123 条笔记");
  expect(trigger.getAttribute("aria-label")).toBe("筛选笔记，已选 2 项");
  const typeSection = dialog.getByRole("button", { name: "类型", expanded: true });
  const tagSection = dialog.getByRole("button", { name: "标签", expanded: true });
  await user.click(tagSection);
  await waitFor(() => expect(dialog.queryByRole("textbox", { name: "搜索筛选标签" })).toBeNull());
  expect(typeSection.getAttribute("aria-expanded")).toBe("true");
  await user.click(typeSection);
  await waitFor(() => expect(dialog.queryByRole("button", { name: "有图片" })).toBeNull());
  expect(trigger.getAttribute("aria-label")).toBe("筛选笔记，已选 2 项");
  await user.keyboard("{Enter}");
  expect(await dialog.findByRole("button", { name: "有图片", pressed: true })).toBeTruthy();
  await user.click(tagSection);
  expect((await dialog.findByRole("textbox", { name: "搜索筛选标签" }) as HTMLInputElement).value).toBe("coffee");
  await user.click(dialog.getByRole("button", { name: "筛选标签 Coffee", pressed: true }));
  expect(change).toHaveBeenLastCalledWith([], ["images"]);
  await user.click(dialog.getByRole("button", { name: "筛选标签 Coffee" }));
  await user.click(dialog.getByRole("button", { name: "无标签" }));
  expect(change).toHaveBeenLastCalledWith(["Coffee"], ["untagged"]);
  await user.click(dialog.getByRole("button", { name: "筛选标签 Coffee" }));
  expect(change).toHaveBeenLastCalledWith([], ["untagged"]);
  await user.click(dialog.getByRole("button", { name: "全部类型" }));
  expect(change).toHaveBeenLastCalledWith([], []);
  await user.clear(dialog.getByRole("textbox", { name: "搜索筛选标签" }));
  await user.click(dialog.getByRole("button", { name: "筛选标签 Coffee" }));
  await user.click(dialog.getByRole("button", { name: "筛选标签 设计" }));
  await user.click(dialog.getByRole("button", { name: "有图片" }));
  await user.click(dialog.getByRole("button", { name: "有链接" }));
  expect(change).toHaveBeenLastCalledWith(["Coffee", "设计"], ["links"]);
  expect(trigger.getAttribute("aria-label")).toBe("筛选笔记，已选 3 项");
  await user.click(dialog.getByRole("button", { name: "有链接", pressed: true }));
  expect(change).toHaveBeenLastCalledWith(["Coffee", "设计"], ["links"]);
  await user.click(dialog.getByRole("button", { name: "清除筛选" }));
  expect(change).toHaveBeenLastCalledWith([], []);
  expect(dialog.getByRole("button", { name: "筛选标签 设计" })).toBeTruthy();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("allows empty tag results, retains a selected type, and disables unavailable filtering", async () => {
  const change = vi.fn();
  const user = userEvent.setup();
  const view = render(<NoteCollectionFilters tags={[]} activeTags={[]} quickFilters={["images"]} onChange={change} />);
  await user.click(screen.getByRole("button", { name: /^筛选笔记/ }));
  expect(screen.getByRole("status").textContent).toBe("暂无标签");
  expect(screen.getByRole("button", { name: "有图片" }).textContent).toBe("有图片");
  await user.type(screen.getByRole("textbox", { name: "搜索筛选标签" }), "missing");
  expect(screen.getByRole("status").textContent).toBe("没有匹配的标签");
  await user.click(screen.getByRole("button", { name: "有图片", pressed: true }));
  expect(change).toHaveBeenLastCalledWith([], ["images"]);
  await user.click(screen.getByRole("button", { name: "全部类型" }));
  expect(change).toHaveBeenLastCalledWith([], []);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  view.rerender(<NoteCollectionFilters tags={[]} activeTags={[]} quickFilters={[]} onChange={change} disabled />);
  expect((screen.getByRole("button", { name: "筛选笔记" }) as HTMLButtonElement).disabled).toBe(true);
});

it("clears all filters from the toolbar without opening the drawer and restores focus", async () => {
  const change = vi.fn();
  function Filters() {
    const [value, setValue] = useState<{ tags: string[]; types: NoteQuickFilter[] }>({ tags: ["设计", "Coffee"], types: ["images"] });
    return <NoteCollectionFilters tags={[]} activeTags={value.tags} quickFilters={value.types}
      onChange={(tags, types) => { change(tags, types); setValue({ tags, types }); }} />;
  }
  const user = userEvent.setup();
  render(<Filters />);
  const trigger = screen.getByRole("button", { name: "筛选笔记，已选 3 项" });
  await user.click(screen.getByRole("button", { name: "清除所有筛选" }));
  expect(change).toHaveBeenLastCalledWith([], []);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button", { name: "清除所有筛选" })).toBeNull();
  expect(trigger.getAttribute("aria-label")).toBe("筛选笔记");
  expect(document.activeElement).toBe(trigger);
});

it("syncs single-select types between tabs and drawer while preserving tags", async () => {
  const change = vi.fn();
  function Filters() {
    const [quickFilters, setQuickFilters] = useState<NoteQuickFilter[]>([]);
    const props = { tags: [{ name: "设计", count: 2 }], activeTags: ["设计"], quickFilters, filterCounts: { untagged: 3, images: 7, links: 24 }, onChange: (tags: string[], types: NoteQuickFilter[]) => { change(tags, types); setQuickFilters(types); } };
    return <NoteCollection filters={props} notes={[]} hasMore={false} paging={false} loadMoreDisabled={false} canOpen canCreate
      onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={value => value} />;
  }
  const user = userEvent.setup();
  render(<Filters />);
  const toolbar = within(screen.getByRole("tablist", { name: "类型" }));
  expect(toolbar.getByRole("tab", { name: "有图片" }).textContent).toBe("有图片");
  await user.click(toolbar.getByRole("tab", { name: "有图片" }));
  await user.click(toolbar.getByRole("tab", { name: "有链接" }));
  expect(change).toHaveBeenLastCalledWith(["设计"], ["links"]);
  await user.click(toolbar.getByRole("tab", { name: "有链接" }));
  expect(change).toHaveBeenLastCalledWith(["设计"], ["links"]);
  await user.click(screen.getByRole("button", { name: /^筛选笔记/ }));
  const dialog = within(await screen.findByRole("dialog", { name: "筛选笔记" }));
  expect(dialog.getByRole("button", { name: "有链接", pressed: true })).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "有图片" }));
  await user.click(dialog.getByRole("button", { name: "完成" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(change).toHaveBeenLastCalledWith(["设计"], ["images"]);
  expect(toolbar.getByRole("tab", { name: "有图片", selected: true })).toBeTruthy();
  expect(toolbar.queryAllByRole("tab", { selected: true })).toHaveLength(1);
  await user.click(toolbar.getByRole("tab", { name: "无标签" }));
  expect(change).toHaveBeenLastCalledWith(["设计"], ["untagged"]);
  expect(toolbar.getByRole("tab", { name: "无标签", selected: true })).toBeTruthy();
  await user.click(toolbar.getByRole("tab", { name: "全部类型" }));
  expect(change).toHaveBeenLastCalledWith(["设计"], []);
});
