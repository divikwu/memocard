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

it("expands roots by default and keeps branch expansion separate from opening notes", async () => {
  const user = userEvent.setup(), args = props();
  render(<TagsPage {...args} />);
  expect(screen.getByRole("button", {name: "编辑标签名称 area/coffee"})).toBeTruthy();
  expect(screen.queryByRole("button", {name: "编辑标签名称 area/coffee/beans"})).toBeNull();
  await user.click(screen.getByRole("button", {name: "展开标签 area/coffee"}));
  expect(args.onSelect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name: "查看标签 area/coffee/beans 的笔记"}));
  expect(args.onSelect).toHaveBeenLastCalledWith("area/coffee/beans");
  await user.click(screen.getByRole("button", {name: "全部收起"}));
  expect(screen.queryByRole("button", {name: "编辑标签名称 area/coffee"})).toBeNull();
  await user.click(screen.getByRole("button", {name: "全部展开"}));
  expect(screen.getByRole("button", {name: "编辑标签名称 area/coffee/beans"})).toBeTruthy();
});

it("searches full paths across collapsed branches and distinguishes matching leaf names", async () => {
  const user = userEvent.setup();
  render(<TagsPage {...props()} />);
  await user.type(screen.getByRole("textbox", {name: "搜索标签"}), "COFFEE");
  const results = screen.getByRole("table", {name: "标签搜索结果"});
  expect(within(results).getAllByRole("button", {name: /^编辑标签名称 /})).toHaveLength(3);
  expect(within(results).getByText("area")).toBeTruthy();
  expect(within(results).getByText("journal")).toBeTruthy();
  await user.clear(screen.getByRole("textbox", {name: "搜索标签"}));
  await user.type(screen.getByRole("textbox", {name: "搜索标签"}), "不存在");
  expect(screen.getByText("没有找到相关标签")).toBeTruthy();
  await user.click(screen.getByRole("button", {name: "清空搜索"}));
  expect(screen.getByRole("table", {name: "标签层级"})).toBeTruthy();
});

it("shows only the immediate parent guide and ends it at the final sibling", async () => {
  const user = userEvent.setup();
  render(<TagsPage {...props()} tags={[...tags, {name: "area/coffee/beans/roast", count: 1}, {name: "area/work", count: 1}, {name: "area/work/uxd", count: 1}]} />);
  await user.click(screen.getByRole("button", {name: "全部展开"}));
  const guides = (path: string) => [...screen.getByRole("button", {name: `编辑标签名称 ${path}`}).closest("tr")!.querySelectorAll<HTMLElement>(".ui-tag-directory-guide")];
  expect(guides("area/coffee")[0].hasAttribute("data-end")).toBe(false);
  expect(guides("area/coffee/beans")).toHaveLength(1);
  expect(guides("area/coffee/beans")[0].style.getPropertyValue("--tag-guide-depth")).toBe("1");
  expect(guides("area/coffee/beans/roast")).toHaveLength(1);
  expect(guides("area/coffee/beans/roast")[0].style.getPropertyValue("--tag-guide-depth")).toBe("2");
  expect(guides("area/work")[0].hasAttribute("data-end")).toBe(true);
  expect(guides("area/work/uxd")).toHaveLength(1);
  expect(guides("area/work/uxd")[0].style.getPropertyValue("--tag-guide-depth")).toBe("1");
  await user.click(screen.getByRole("button", {name: "收起标签 area/work"}));
  expect(guides("area/work")[0].hasAttribute("data-end")).toBe(true);
  await user.type(screen.getByRole("textbox", {name: "搜索标签"}), "uxd");
  expect(guides("area/work/uxd")).toHaveLength(0);
});

it("shares pinned preferences and migrates pinned descendants and icons after renaming", async () => {
  localStorage.setItem(key, JSON.stringify({pinned: ["area/coffee"], icons: {"area/coffee": "☕"}}));
  const user = userEvent.setup(), args = props();
  render(<TagsPage {...args} />);
  expect(screen.queryByRole("button", {name: /^标签操作 /})).toBeNull();
  await user.click(screen.getByRole("button", {name: "置顶标签 journal"}));
  expect(JSON.parse(localStorage.getItem(key)!).pinned).toEqual(["area/coffee", "journal"]);
  const pinned = screen.getByRole("button", {name: "取消置顶 area/coffee"});
  expect(pinned.getAttribute("aria-pressed")).toBe("true");
  pinned.focus();
  await user.keyboard(" ");
  expect(screen.getByRole("button", {name: "置顶标签 area/coffee"}).getAttribute("aria-pressed")).toBe("false");
  expect(JSON.parse(localStorage.getItem(key)!).pinned).toEqual(["journal"]);
  await user.keyboard("{Enter}");
  expect(JSON.parse(localStorage.getItem(key)!).pinned).toEqual(["journal", "area/coffee"]);
  expect(args.onSelect).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name: "编辑标签图标 area"}));
  const dialog = await screen.findByRole("dialog", {name: "编辑标签"});
  await user.clear(within(dialog).getByRole("textbox", {name: "标签名称"}));
  await user.type(within(dialog).getByRole("textbox", {name: "标签名称"}), "topics");
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(args.onRename).toHaveBeenCalledWith("area", "topics");
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({pinned: ["journal", "topics/coffee"], icons: {"topics/coffee": "☕"}});
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
  expect(screen.getByRole("button", {name: "编辑标签图标 area"})).toHaveProperty("disabled", true);
});

it("saves and clears icons while keeping the tag editor open", async () => {
  const user = userEvent.setup(), args = props();
  render(<TagsPage {...args} />);
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
  await user.click(screen.getByRole("button", {name: "置顶标签 area"}));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "无法保存标签设置，请检查浏览器存储权限。");
  expect(screen.getByRole("button", {name: "置顶标签 area"}).getAttribute("aria-pressed")).toBe("false");
});

it("edits only the leaf name inline, supports cancellation and protects IME confirmation", async () => {
  const user = userEvent.setup(), args = props();
  render(<TagsPage {...args} />);
  expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["标签", "笔记数", "置顶"]);
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  let input = screen.getByRole("textbox", {name: "标签名称 area/coffee"});
  expect(document.activeElement).toBe(input);
  expect(input).toHaveProperty("value", "coffee");
  await user.clear(input);
  await user.type(input, "草稿");
  await user.keyboard("{Escape}");
  expect(args.onRename).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox", {name: "标签名称 area/coffee"})).toBeNull();
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  input = screen.getByRole("textbox", {name: "标签名称 area/coffee"});
  await user.clear(input);
  await user.type(input, "手冲");
  fireEvent.keyDown(input, {key: "Enter", code: "Enter", isComposing: true, keyCode: 229});
  expect(args.onRename).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(args.onRename).toHaveBeenCalledWith("area/coffee", "area/手冲"));
  expect(args.onSelect).not.toHaveBeenCalled();
});

it("keeps inline rename errors and drafts visible and permits retry", async () => {
  const user = userEvent.setup(), args = props();
  args.onRename.mockRejectedValueOnce(new Error("目标标签已存在"));
  render(<TagsPage {...args} />);
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  const input = screen.getByRole("textbox", {name: "标签名称 area/coffee"});
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
  await waitFor(() => expect(screen.queryByRole("textbox", {name: "标签名称 area/coffee"})).toBeNull());
  expect(args.onRename).toHaveBeenLastCalledWith("area/coffee", "area/手冲");
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
  render(<TagsPage {...args} />);
  await user.click(screen.getByRole("button", {name: "编辑标签名称 area/coffee"}));
  const input = screen.getByRole("textbox", {name: "标签名称 area/coffee"});
  expect(screen.queryByRole("button", {name: "保存标签名称"})).toBeNull();
  expect(screen.queryByRole("button", {name: "取消修改标签名称"})).toBeNull();
  await user.clear(input);
  await user.type(input, "手冲");
  await user.click(screen.getByRole("button", {name: "编辑标签名称 journal"}));
  await waitFor(() => expect(args.onRename).toHaveBeenCalledWith("area/coffee", "area/手冲"));
  expect(input).toHaveProperty("disabled", true);
  const next = screen.getByRole("textbox", {name: "标签名称 journal"});
  expect(document.activeElement).toBe(next);
  finish();
  await waitFor(() => expect(screen.queryByRole("textbox", {name: "标签名称 area/coffee"})).toBeNull());
  expect(document.activeElement).toBe(next);
  await user.keyboard("{Escape}");
  expect(args.onRename).toHaveBeenCalledTimes(1);
});
