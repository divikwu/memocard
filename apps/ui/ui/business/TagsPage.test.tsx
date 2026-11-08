// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TagsPage } from "./TagsPage";

const key = "memocard:tags:tag-directory-test";
const tags = [{name: "area", count: 3}, {name: "area/coffee", count: 2}, {name: "area/coffee/beans", count: 1}, {name: "journal", count: 1}, {name: "journal/coffee", count: 1}];
const props = () => ({tags, vaultId: "tag-directory-test", loading: false, connected: true, disabled: false, canRename: true, onSelect: vi.fn(), onRename: vi.fn(async () => {})});
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", vi.fn(() => ({matches: false, addEventListener() {}, removeEventListener() {}})));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function renderGroupedTags(element: React.ReactElement) {
  localStorage.setItem(key, JSON.stringify({groups: [{id: "g", name: "收藏", tags: tags.map(tag => tag.name)}]}));
  render(element);
  fireEvent.click(screen.getByRole("tab", {name: "标签群组"}));
}

async function openTagMenu(user: ReturnType<typeof userEvent.setup>, tag: string) {
  await user.click(screen.getByRole("button", {name: `标签操作 ${tag}`}));
  return within(await screen.findByRole("menu", {name: `标签操作 ${tag}`}));
}

it("defaults to alphabetical tags and keeps search when switching to independent groups", async () => {
  const user = userEvent.setup(), args = props();
  render(<TagsPage {...args} tags={[{name: "生活/咖啡", count: 4}, {name: "3d", count: 2}, ...tags]} />);
  expect(screen.getByRole("tab", {name: "全部", selected: true})).toBeTruthy();
  expect(screen.getAllByRole("heading", {level: 2}).map(heading => heading.textContent)).toEqual(["3", "A", "J", "其他"]);
  const coffee = within(screen.getByRole("list", {name: "A"})).getByRole("button", {name: "查看标签 area/coffee 的笔记"});
  expect(coffee.textContent).toContain("area/coffee2");
  await user.click(coffee);
  expect(args.onSelect).toHaveBeenCalledWith("area/coffee");
  await user.type(screen.getByRole("textbox", {name: "搜索标签"}), "COFFEE");
  expect(screen.getAllByRole("button", {name: /^查看标签 /})).toHaveLength(3);
  await user.click(screen.getByRole("tab", {name: "标签群组"}));
  const grouped = screen.getByRole("tabpanel", {name: "标签群组"});
  expect(within(grouped).getByText("还没有标签群组")).toBeTruthy();
  expect(within(grouped).queryByRole("button", {name: /^查看标签 /})).toBeNull();
  expect(screen.queryByRole("button", {name: "管理标签"})).toBeNull();
  expect(screen.getByRole("textbox", {name: "搜索标签"})).toHaveProperty("value", "COFFEE");
  await user.click(screen.getByRole("button", {name: "清空标签搜索"}));
  await user.click(screen.getByRole("tab", {name: "全部"}));
  expect(screen.getByRole("button", {name: "查看标签 3d 的笔记"})).toBeTruthy();
});

it("creates a tag inline from the alphabetical view even when search has no results", async () => {
  const user = userEvent.setup();
  render(<TagsPage {...props()} />);
  const all = within(screen.getByRole("tabpanel", {name: "全部"}));
  await user.type(screen.getByRole("textbox", {name: "搜索标签"}), "missing");
  await user.click(screen.getByRole("button", {name: "新建标签"}));
  const name = all.getByRole("textbox", {name: "标签名称"});
  expect(document.activeElement).toBe(name);
  const addDescription = all.getByRole("button", {name: "添加标签说明"});
  expect(addDescription).toHaveProperty("disabled", true);
  await user.type(name, "reading");
  expect(all.queryByRole("textbox", {name: "标签说明"})).toBeNull();
  await user.click(addDescription);
  await user.type(all.getByRole("textbox", {name: "标签说明"}), "Books to read{Enter}");
  const created = await all.findByRole("button", {name: "查看标签 reading 的笔记"});
  expect(created.getAttribute("aria-description")).toBe("0 条笔记");
  expect(all.queryByRole("textbox", {name: "标签名称"})).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!).labels).toEqual({reading: "Books to read"});
});

it("searches legacy names without a hierarchy", async () => {
  const user = userEvent.setup();
  render(<TagsPage {...props()} />);
  await user.type(screen.getByRole("textbox", {name: "搜索标签"}), "COFFEE");
  const results = screen.getByRole("tabpanel", {name: "全部"});
  expect(within(results).getAllByRole("button", {name: /^标签操作 /})).toHaveLength(3);
  expect(within(results).getByText("area/coffee")).toBeTruthy();
  expect(within(results).getByText("journal/coffee")).toBeTruthy();
  await user.clear(screen.getByRole("textbox", {name: "搜索标签"}));
  await user.type(screen.getByRole("textbox", {name: "搜索标签"}), "不存在");
  expect(screen.getByText("没有找到相关标签")).toBeTruthy();
  await user.click(screen.getByRole("button", {name: "清空搜索"}));
  expect(screen.getByRole("button", {name: "查看标签 area 的笔记"})).toBeTruthy();
});

it("keeps other tags and migrates only the renamed tag across groups", async () => {
  localStorage.setItem(key, JSON.stringify({pinned: ["area/coffee"], icons: {"area/coffee": "☕"}, groups: [{id: "g", name: "收藏", tags: ["area", "area/coffee"]}]}));
  const user = userEvent.setup(), args = props();
  render(<TagsPage {...args} />);
  await user.click((await openTagMenu(user, "journal")).getByRole("menuitem", {name: "置顶标签"}));
  expect(JSON.parse(localStorage.getItem(key)!).pinned).toEqual(["area/coffee", "journal"]);
  await user.click((await openTagMenu(user, "area/coffee")).getByRole("menuitem", {name: "取消置顶"}));
  expect(JSON.parse(localStorage.getItem(key)!).pinned).toEqual(["journal"]);
  await user.click((await openTagMenu(user, "area/coffee")).getByRole("menuitem", {name: "置顶标签"}));
  expect(JSON.parse(localStorage.getItem(key)!).pinned).toEqual(["journal", "area/coffee"]);
  expect(args.onSelect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name: "编辑标签图标 area"}));
  const dialog = await screen.findByRole("dialog", {name: "编辑标签"});
  await user.clear(within(dialog).getByRole("textbox", {name: "标签名称"}));
  await user.type(within(dialog).getByRole("textbox", {name: "标签名称"}), "topics");
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(args.onRename).toHaveBeenCalledWith("area", "topics");
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({pinned: ["journal", "area/coffee"], icons: {"area/coffee": "☕"}, groups: [{id: "g", tags: ["topics", "area/coffee"]}]});
});

it("keeps failed renames editable and prevents renaming a read-only library", async () => {
  const user = userEvent.setup(), args = props();
  args.onRename.mockRejectedValue(new Error("目标标签已存在"));
  const view = render(<TagsPage {...args} />);
  await user.click(screen.getByRole("button", {name: "编辑标签图标 area"}));
  const dialog = await screen.findByRole("dialog", {name: "编辑标签"});
  await user.type(within(dialog).getByRole("textbox", {name: "标签名称"}), "2");
  await user.keyboard("{Enter}");
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", "目标标签已存在");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  view.rerender(<TagsPage {...args} canRename={false} />);
  expect(screen.queryByRole("button", {name: "编辑标签图标 area"})).toBeNull();
});

it.each(["browse", "groups"])("saves and clears icons from %s without opening notes", async mode => {
  const user = userEvent.setup(), args = props();
  const view = <TagsPage {...args} />;
  if (mode === "groups") renderGroupedTags(view);
  else render(view);
  await user.click(screen.getByRole("button", {name: "编辑标签图标 journal/coffee"}));
  const editor = await screen.findByRole("dialog", {name: "编辑标签"});
  const dialog = within(editor);
  const trigger = dialog.getByRole("button", {name: "更换图标"});
  await user.click(dialog.getByRole("tab", {name: "Emoji"}));
  await user.type(dialog.getByRole("textbox", {name: "搜索 Emoji"}), "咖啡");
  await user.click(dialog.getByRole("button", {name: /^茶、热饮、咖啡/}));
  await waitFor(() => expect(dialog.queryByRole("region", {name: "标签图标选项"})).toBeNull());
  expect(screen.getByRole("dialog", {name: "编辑标签"})).toBe(editor);
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(JSON.parse(localStorage.getItem(key)!).icons["journal/coffee"]).toBe("☕");
  expect(screen.getByRole("button", {name: "编辑标签图标 journal/coffee"}).textContent).toContain("☕");
  await user.click(trigger);
  await user.click(dialog.getByRole("button", {name: "清除图标"}));
  await waitFor(() => expect(dialog.queryByRole("region", {name: "标签图标选项"})).toBeNull());
  expect(screen.getByRole("dialog", {name: "编辑标签"})).toBe(editor);
  expect(JSON.parse(localStorage.getItem(key)!).icons["journal/coffee"]).toBe("");
  expect(args.onRename).not.toHaveBeenCalled();
  expect(args.onSelect).not.toHaveBeenCalled();
});

it("distinguishes loading, an empty library and a disconnected library", () => {
  const args = {...props(), tags: []};
  const view = render(<TagsPage {...args} loading />);
  expect(screen.getByRole("status", {name: "正在读取标签"})).toBeTruthy();
  expect(screen.queryByText("还没有标签")).toBeNull();
  view.rerender(<TagsPage {...args} />);
  expect(screen.getByText("还没有标签")).toBeTruthy();
  view.rerender(<TagsPage {...args} connected={false} />);
  expect(screen.getByText("连接笔记库后查看标签")).toBeTruthy();
});

it("reports failed pin storage without displaying a successful pin", async () => {
  const user = userEvent.setup();
  render(<TagsPage {...props()} />);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  await user.click((await openTagMenu(user, "area")).getByRole("menuitem", {name: "置顶标签"}));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "无法保存标签设置，请检查浏览器存储权限。");
  expect((await openTagMenu(user, "area")).getByRole("menuitem", {name: "置顶标签"})).toBeTruthy();
});

it("renames a whole legacy tag inline, supports cancellation and protects IME confirmation", async () => {
  const user = userEvent.setup(), args = props();
  renderGroupedTags(<TagsPage {...args} />);
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  let input = screen.getByRole("textbox", {name: "标签名称"});
  expect(document.activeElement).toBe(input);
  expect(input).toHaveProperty("value", "area/coffee");
  await user.clear(input);
  await user.type(input, "草稿");
  await user.keyboard("{Escape}");
  expect(args.onRename).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox", {name: "标签名称"})).toBeNull();
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  input = screen.getByRole("textbox", {name: "标签名称"});
  await user.clear(input);
  await user.type(input, "手冲");
  fireEvent.keyDown(input, {key: "Enter", code: "Enter", isComposing: true, keyCode: 229});
  expect(args.onRename).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(args.onRename).toHaveBeenCalledWith("area/coffee", "手冲"));
  expect(args.onSelect).not.toHaveBeenCalled();
});

it("keeps inline rename errors and drafts visible and permits retry", async () => {
  const user = userEvent.setup(), args = props();
  args.onRename.mockRejectedValueOnce(new Error("目标标签已存在"));
  renderGroupedTags(<TagsPage {...args} />);
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  const input = screen.getByRole("textbox", {name: "标签名称"});
  await user.clear(input);
  await user.type(input, "beans{Enter}");
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "目标标签已存在");
  expect(input).toHaveProperty("value", "beans");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
  await user.clear(input);
  await user.type(input, "beans/other{Enter}");
  expect(args.onRename).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("alert").textContent).toContain("不能包含 /");
  await user.clear(input);
  await user.type(input, "手冲{Enter}");
  await waitFor(() => expect(screen.queryByRole("textbox", {name: "标签名称"})).toBeNull());
  expect(args.onRename).toHaveBeenLastCalledWith("area/coffee", "手冲");
});

it("toggles the existing icon picker from the icon without navigating", async () => {
  const user = userEvent.setup(), args = props();
  render(<TagsPage {...args} />);
  const trigger = screen.getByRole("button", {name: "编辑标签图标 area/coffee"});
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await user.click(trigger);
  const dialog = within(await screen.findByRole("dialog", {name: "编辑标签"}));
  expect(dialog.getByRole("textbox", {name: "搜索 Emoji"})).toBeTruthy();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await user.click(trigger);
  await waitFor(() => expect(screen.queryByRole("dialog", {name: "编辑标签"})).toBeNull());
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await user.keyboard("{Enter}");
  await screen.findByRole("dialog", {name: "编辑标签"});
  await user.keyboard("{Escape}");
  expect(args.onSelect).not.toHaveBeenCalled();
  expect(args.onRename).not.toHaveBeenCalled();
});

it("keeps the icon editor open when its trigger is clicked during a save", async () => {
  const user = userEvent.setup(), args = props();
  let finish!: () => void;
  args.onRename.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  render(<TagsPage {...args} />);
  const trigger = screen.getByRole("button", {name: "编辑标签图标 area/coffee"});
  await user.click(trigger);
  const dialog = within(await screen.findByRole("dialog", {name: "编辑标签"}));
  await user.type(dialog.getByRole("textbox", {name: "标签名称"}), "2");
  await user.keyboard("{Enter}");
  await user.click(trigger);
  expect(screen.getByRole("dialog", {name: "编辑标签"})).toBeTruthy();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  finish();
  await waitFor(() => expect(screen.queryByRole("dialog", {name: "编辑标签"})).toBeNull());
});

it("saves on blur without action buttons and preserves focus on the next editor", async () => {
  const user = userEvent.setup(), args = props();
  let finish!: () => void;
  args.onRename.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  renderGroupedTags(<TagsPage {...args} />);
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  const input = screen.getByRole("textbox", {name: "标签名称"});
  expect(screen.queryByRole("button", {name: "保存标签名称"})).toBeNull();
  expect(screen.queryByRole("button", {name: "取消修改标签名称"})).toBeNull();
  await user.clear(input);
  await user.type(input, "手冲");
  await user.click(screen.getByRole("button", {name: "编辑标签名称 journal"}));
  await waitFor(() => expect(args.onRename).toHaveBeenCalledWith("area/coffee", "手冲"));
  expect(input).toHaveProperty("readOnly", true);
  const next = screen.getAllByRole("textbox", {name: "标签名称"}).find(editor => editor !== input);
  expect(document.activeElement).toBe(next);
  finish();
  await waitFor(() => expect(screen.getByRole("textbox", {name: "标签名称"})).toBe(next));
  expect(document.activeElement).toBe(next);
  await user.keyboard("{Escape}");
  expect(args.onRename).toHaveBeenCalledTimes(1);
});
