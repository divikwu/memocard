// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { App, type AppViewState } from "../../src/App";
import { noteEditor, replaceCaptureText, replaceEditorText } from "../../src/editor-test-utils";
import { resetStorybookBridge, setStorybookClientMode, setStorybookRequestHandler } from "../../test-support/bridge";
import { createWorkspaceFixture } from "./workspace-fixture";
import { WebAppearanceProvider } from "./WebAppearance";
import { AppearanceCatalogProvider } from "./appearance/AppearanceRuntime";
import { appearanceCatalog } from "./appearance/catalog";
import type { AppearanceCatalog } from "./appearance/contracts";
import { appearanceFixture } from "../../ui-state-fixtures/appearance-fixture";
import { preloadWebEditor, renderWebApp } from "./WebAppView";

let detach: (() => void) | undefined;
beforeAll(async () => {
  await Promise.all([preloadWebEditor(), import("../business/NoteCardPreview"), import("../business/QuickCapture"), import("../business/NoteSearchDialog")]);
}, 30_000);
beforeEach(() => {
  localStorage.clear(); resetStorybookBridge();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ interfaceTheme: "classic" }));
  history.replaceState(null, "", "#/notes");
  document.elementFromPoint = () => null;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: vi.fn(async () => [{}]) } });
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("max-width") && window.innerWidth < 768, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("scrollBy", vi.fn());
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(async () => { cleanup(); await act(async () => {}); detach?.(); resetStorybookBridge(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function mount(scenario = "loading", readOnly = false, mapView?: (state: AppViewState) => AppViewState, catalog: AppearanceCatalog = appearanceCatalog) {
  const fixture = await createWorkspaceFixture(scenario);
  const request = vi.fn(async (operation: string, params: Record<string, unknown> = {}) => {
    const result = await fixture.request(operation, params);
    if (readOnly && ["getStatus", "getEnvironment"].includes(operation)) {
      const value = result as { capabilities: string[] };
      return { ...value, capabilities: value.capabilities.filter(capability => !["saveNote", "deleteNote", "deleteDraft", "selectVault"].includes(capability)) };
    }
    return result;
  });
  detach = setStorybookRequestHandler(request);
  await act(async () => { render(<AppearanceCatalogProvider catalog={catalog}><WebAppearanceProvider><App renderView={state => renderWebApp(mapView ? mapView(state) : state)} preloadEditor={preloadWebEditor} /></WebAppearanceProvider></AppearanceCatalogProvider>); });
  return { fixture, request };
}

it("navigates a tag, edits and saves a note, then finds its committed body through global search", async () => {
  const user = userEvent.setup();
  const { fixture, request } = await mount();
  const types = await screen.findByRole("tablist", { name: "类型" });
  expect(within(types).getByRole("tab", { name: "全部类型", selected: true })).toBeTruthy();
  expect(screen.queryByRole("group", { name: "最近使用的笔记标签" })).toBeNull();
  const selectDesign = async () => {
    await user.click(screen.getByRole("button", { name: /^筛选笔记/ }));
    await user.click(await screen.findByRole("button", { name: "筛选标签 设计" }));
    await user.click(screen.getByRole("button", { name: "完成" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  };
  await selectDesign();
  await screen.findByRole("heading", { name: "# 设计" });
  expect(screen.queryByRole("textbox", { name: "搜索当前视图笔记" })).toBeNull();
  await selectDesign();
  await screen.findByRole("heading", { name: "所有笔记" });
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  await selectDesign();
  await screen.findByRole("heading", { name: "# 设计" });
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
  await user.click(await screen.findByRole("button", { name: "打开 让设计语言走进真实页面" }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  expect(screen.queryByRole("button", { name: "返回笔记列表" })).toBeNull();
  expect(within(breadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["所有笔记", "设计"]);
  expect(breadcrumb.textContent).not.toContain("MemoCard");
  expect(within(breadcrumb).getByText("让设计语言走进真实页面").getAttribute("aria-current")).toBe("page");
  replaceEditorText("跨组件集成验收唯一正文 #设计", field);
  await user.click(within(breadcrumb).getByRole("button", { name: "设计" }));
  await screen.findByRole("button", { name: "打开 让设计语言走进真实页面" });
  expect(fixture.snapshot().notes.find(note => note.title === "让设计语言走进真实页面")?.body).toBe("跨组件集成验收唯一正文 #设计");
  await user.click(screen.getByRole("button", { name: "搜索" }));
  const dialog = await screen.findByRole("dialog", { name: "搜索笔记" });
  await user.type(within(dialog).getByRole("combobox", { name: "搜索笔记" }), "集成验收唯一");
  await within(dialog).findByRole("option", { name: "让设计语言走进真实页面" });
  expect(request.mock.calls.some(([operation, params = {}]) => operation === "queryNotes" && params.query === "集成验收唯一")).toBe(true);
  await user.click(within(dialog).getByRole("option", { name: "让设计语言走进真实页面" }));
  expect((await screen.findByRole("textbox", { name: "笔记内容" })).textContent).toContain("跨组件集成验收唯一正文");
});

it("keeps a home-opened note under the home breadcrumb", async () => {
  history.replaceState(null, "", "#/home");
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
  expect(screen.getByRole("heading", { name: "主页", level: 1 })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "收起侧栏" }));
  await screen.findByRole("button", { name: "展开侧栏" });
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
  expect(document.querySelector(".web-header-separator")).toBeNull();
  await user.click(screen.getByRole("button", { name: "展开侧栏" }));
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  expect(within(breadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["主页"]);
  const current = within(breadcrumb).getByText("今天的手冲记录");
  expect(current.tagName).toBe("SPAN");
  expect(current.getAttribute("aria-current")).toBe("page");
  expect(current.hasAttribute("href")).toBe(false);
  expect(current.tabIndex).toBe(-1);
  const detailHash = location.hash;
  await user.click(current);
  expect(location.hash).toBe(detailHash);
  expect(screen.getByRole("textbox", { name: "笔记内容" })).toBeDefined();
  await user.clear(screen.getByRole("textbox", { name: "页面标题" }));
  await waitFor(() => expect(current.textContent).toBe("新内容"));
  await user.type(screen.getByRole("textbox", { name: "页面标题" }), "新的手冲记录");
  await waitFor(() => expect(current.textContent).toBe("新的手冲记录"));
  expect(current.title).toBe("");
  await user.hover(current);
  expect(screen.queryByRole("tooltip")).toBeNull();
  await user.unhover(current);
  expect(screen.queryByRole("button", { name: "返回主页" })).toBeNull();
  await user.click(within(breadcrumb).getByRole("button", { name: "主页" }));
  await screen.findByRole("button", { name: "打开 新的手冲记录" });
  expect(location.hash).toBe("#/home");
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
});

it.each([1200, 390])("opens the tag directory and navigates its results at %spx", async width => {
  vi.stubGlobal("innerWidth", width);
  history.replaceState(null, "", "#/tags");
  const user = userEvent.setup();
  const { request } = await mount();
  const directory = await screen.findByRole("region", { name: "标签目录" });
  await within(directory).findByRole("button", { name: "查看标签 生活/咖啡 的笔记" });
  expect(request.mock.calls.some(([operation]) => operation === "queryNotes")).toBe(false);
  await user.type(within(directory).getByRole("textbox", { name: "搜索标签" }), "咖啡");
  await user.click(within(directory).getByRole("button", { name: "查看标签 生活/咖啡 的笔记" }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(location.hash).toBe("#/notes");
  if (width < 768) await user.click(screen.getByRole("button", { name: "打开导航" }));
  const navigation = screen.getByRole("navigation", { name: "主要导航" });
  const tags = within(navigation).getByRole("button", { name: "标签" });
  expect(tags.getAttribute("aria-disabled")).toBeNull();
  await user.click(tags);
  await screen.findByRole("region", { name: "标签目录" });
  expect(location.hash).toBe("#/tags");
});

it("renames a legacy tag without touching other tags", async () => {
  history.replaceState(null, "", "#/tags");
  const user = userEvent.setup();
  const { fixture } = await mount();
  const coffeeId = fixture.snapshot().notes.find(note => note.title === "今天的手冲记录")!.id;
  const directory = await screen.findByRole("region", { name: "标签目录" });
  await user.click(await within(directory).findByRole("button", { name: "编辑标签图标 生活/咖啡" }));
  const dialog = await screen.findByRole("dialog", { name: "编辑标签" });
  const name = within(dialog).getByRole("textbox", { name: "标签名称" });
  await user.clear(name);
  await user.type(name, "日常{Enter}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await within(directory).findByRole("button", { name: "查看标签 日常 的笔记" });
  const coffee = fixture.snapshot().notes.find(note => note.id === coffeeId)!;
  expect(coffee.tags).toContain("日常");
  expect(coffee.body).toContain("#日常");
  expect(coffee.tags).not.toContain("生活/咖啡");
});

it("refreshes the pinned sidebar tag after renaming a tag with no notes", async () => {
  history.replaceState(null, "", "#/tags");
  const user = userEvent.setup();
  await mount();
  const directory = within(await screen.findByRole("region", {name: "标签目录"}));
  await user.click(directory.getByRole("button", {name: "新建标签"}));
  await user.type(directory.getByRole("textbox", {name: "标签名称"}), "空标签{Enter}");
  await user.click(await directory.findByRole("button", {name: "标签操作 空标签"}));
  await user.click(await screen.findByRole("menuitem", {name: "置顶标签"}));
  const sidebar = within(await screen.findByRole("navigation", {name: "置顶标签"}));
  await sidebar.findByRole("button", {name: "空标签"});
  await user.click(directory.getByRole("button", {name: "编辑标签图标 空标签"}));
  const dialog = within(await screen.findByRole("dialog", {name: "编辑标签"}));
  const name = dialog.getByRole("textbox", {name: "标签名称"});
  await user.clear(name);
  await user.type(name, "新空标签{Enter}");
  await sidebar.findByRole("button", {name: "新空标签"});
  expect(sidebar.queryByRole("button", {name: "空标签"})).toBeNull();
});

it("shares tag icons between the collection heading and tag directory", async () => {
  const user = userEvent.setup();
  const { request } = await mount();
  await user.click(await screen.findByRole("button", { name: /^筛选笔记/ }));
  await user.click(await screen.findByRole("button", { name: "筛选标签 生活/咖啡" }));
  await user.click(screen.getByRole("button", { name: "完成" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const heading = await screen.findByRole("heading", { name: "# 生活/咖啡", level: 1 });
  const icon = within(heading.parentElement!).getByRole("button", { name: "编辑标签图标 生活/咖啡" });
  await user.click(icon);
  const dialog = within(await screen.findByRole("dialog", { name: "编辑标签" }));
  const search = dialog.getByRole("textbox", { name: "搜索 Emoji" });
  await user.type(search, "咖啡");
  await user.click(await dialog.findByRole("button", { name: /^茶、热饮、咖啡/ }));
  await waitFor(() => expect(icon.textContent).toContain("☕"));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标签" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(icon));
  await user.click(within(screen.getByRole("navigation", { name: "主要导航" })).getByRole("button", { name: "标签" }));
  const directory = within(await screen.findByRole("region", { name: "标签目录" }));
  expect(directory.getByRole("button", { name: "编辑标签图标 生活/咖啡" }).textContent).toContain("☕");
  expect(request.mock.calls.some(([operation]) => operation === "setTagPreferences")).toBe(true);
});

it("uses the full selected tag and blocks breadcrumb navigation when saving fails", async () => {
  const user = userEvent.setup();
  const { request } = await mount();
  await user.click(await screen.findByRole("button", { name: "列表布局" }));
  await user.click((await screen.findAllByRole("button", { name: "筛选标签 生活/咖啡" }))[0]);
  await screen.findByRole("heading", { name: "# 生活/咖啡", level: 1 });
  expect(screen.queryByRole("button", { name: "筛选标签 生活/咖啡" })).toBeNull();
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  expect(within(breadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["所有笔记", "生活/咖啡"]);
  const detailHash = location.hash;
  const implementation = request.getMockImplementation()!;
  request.mockImplementation(async (operation, params) => {
    if (operation === "saveNote") throw new Error("面包屑保存测试失败");
    return implementation(operation, params);
  });
  replaceEditorText("通过面包屑返回前需要保存的正文 #生活/咖啡", field);
  await user.click(within(breadcrumb).getByRole("button", { name: "生活/咖啡" }));
  await screen.findByText("面包屑保存测试失败");
  expect(location.hash).toBe(detailHash);
  expect(screen.getByRole("textbox", { name: "笔记内容" }).textContent).toContain("通过面包屑返回前需要保存的正文");
  request.mockImplementation(implementation);
  await user.click(within(breadcrumb).getByRole("button", { name: "生活/咖啡" }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(request.mock.calls.some(([operation, params]) => operation === "queryNotes" && JSON.stringify(params?.tags) === '["生活/咖啡"]')).toBe(true);
  await user.click(screen.getByRole("button", { name: "打开 今天的手冲记录" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  const reopenedBreadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  expect(within(reopenedBreadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["所有笔记", "生活/咖啡"]);
  await user.click(within(reopenedBreadcrumb).getByRole("button", { name: "所有笔记" }));
  await screen.findByRole("button", { name: "打开 Weekend reading list" });
});

it("preserves an H5 search session across detail navigation, then records a new capture into the refreshed list", async () => {
  vi.stubGlobal("innerWidth", 390);
  const user = userEvent.setup();
  const { fixture, request } = await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  await user.click(await screen.findByRole("button", { name: "搜索全部笔记" }));
  let search = await screen.findByRole("dialog", { name: "搜索笔记" });
  await user.type(within(search).getByRole("combobox", { name: "搜索笔记" }), "咖啡");
  await user.click(await within(search).findByRole("option", { name: "今天的手冲记录" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  await user.click(screen.getByRole("button", { name: "返回搜索结果" }));
  search = await screen.findByRole("dialog", { name: "搜索笔记" });
  expect((within(search).getByRole("combobox", { name: "搜索笔记" }) as HTMLInputElement).value).toBe("咖啡");
  expect(within(search).getByRole("option", { name: "今天的手冲记录" })).not.toBeNull();
  await user.click(within(search).getByRole("button", { name: "退出搜索" }));
  await user.click(await screen.findByRole("button", { name: "打开快速记录" }));
  const capture = await screen.findByRole("dialog", { name: "快速记录" });
  replaceCaptureText(within(capture).getByRole("textbox", { name: "快速输入内容" }), "H5 快速记录集成刷新");
  await user.click(within(capture).getByRole("button", { name: "记录" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "快速记录" })).toBeNull());
  const saved = fixture.snapshot().notes.find(note => note.body === "H5 快速记录集成刷新");
  expect(saved).toBeDefined();
  await waitFor(() => expect(document.querySelector(`[data-note-id="${saved!.id}"]`)).not.toBeNull());
  expect(request.mock.calls.filter(([operation]) => operation === "saveNote")).toHaveLength(1);
});

it("keeps the H5 search trigger mounted through note navigation and restores focus when search exits", async () => {
  vi.stubGlobal("innerWidth", 320);
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  const trigger = screen.getByRole("button", { name: "搜索全部笔记" });
  await user.click(trigger);
  let search = await screen.findByRole("dialog", { name: "搜索笔记" });
  await user.type(within(search).getByRole("combobox", { name: "搜索笔记" }), "咖啡");
  await user.click(await within(search).findByRole("option", { name: "今天的手冲记录" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  expect(trigger.isConnected).toBe(true);
  expect(trigger.closest("footer")).toHaveProperty("hidden", true);
  await user.click(screen.getByRole("button", { name: "返回搜索结果" }));
  search = await screen.findByRole("dialog", { name: "搜索笔记" });
  expect(within(search).getByRole("combobox", { name: "搜索笔记" })).toHaveProperty("value", "咖啡");
  await user.click(within(search).getByRole("button", { name: "清空搜索" }));
  expect(within(search).getByRole("combobox", { name: "搜索笔记" })).toHaveProperty("value", "");
  await user.click(within(search).getByRole("button", { name: "退出搜索" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "搜索笔记" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.getByRole("button", { name: "搜索全部笔记" })).toBe(trigger);
});

it("flushes unfinished edits before opening settings and preserves them across appearance changes", async () => {
  const user = userEvent.setup();
  const { fixture } = await mount();
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  replaceEditorText("离开编辑页前必须保留的正文", await screen.findByRole("textbox", { name: "笔记内容" }));
  await user.click(screen.getByRole("button", { name: /^笔记库：/ }));
  await user.click(await screen.findByRole("menuitem", { name: "笔记库设置" }));
  await screen.findByRole("heading", { name: "设置", level: 1 });
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
  expect(fixture.snapshot().notes.find(note => note.title === "今天的手冲记录")?.body).toBe("离开编辑页前必须保留的正文");
  await user.click(screen.getByRole("combobox", { name: "颜色模式" }));
  await user.click(await screen.findByRole("option", { name: "深色" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  await user.click(screen.getByRole("combobox", { name: "界面主题" }));
  await user.click(await screen.findByRole("option", { name: "简约" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  await screen.findByRole("navigation", { name: "顶部导航" });
  await user.click(screen.getByText("高级外观"));
  await user.click(screen.getByRole("combobox", { name: "圆角" }));
  await user.click(await screen.findByRole("option", { name: "None · 0px" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(document.documentElement.dataset.uiTheme).toBe("dark");
  expect(JSON.parse(localStorage.getItem("memocard-web-appearance-v1") || "{}").radius).toBe("none");
  await user.click(screen.getByRole("button", { name: "所有笔记" }));
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  expect((await screen.findByRole("textbox", { name: "笔记内容" })).textContent).toContain("离开编辑页前必须保留的正文");
});

it("cancels draft deletion with focus restored, then resumes the retained draft using its original identity", async () => {
  const user = userEvent.setup();
  const { request } = await mount("draft-many");
  await user.click(await screen.findByRole("button", { name: "查看草稿" }));
  const drafts = await screen.findByRole("dialog", { name: "保留的草稿" });
  const first = within(drafts).getByRole("heading", { name: "保留草稿 1" }).closest("article")!;
  const remove = within(first).getByRole("button", { name: /^删除草稿：/ });
  await user.click(remove);
  const confirmation = await screen.findByRole("dialog", { name: "删除这条草稿？" });
  await user.click(within(confirmation).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(document.activeElement).toBe(remove));
  expect(request.mock.calls.some(([operation]) => operation === "deleteDraft")).toBe(false);
  expect(request.mock.calls.some(([operation]) => operation === "saveNote")).toBe(false);
  await user.click(within(first).getByRole("button", { name: /^继续编辑：/ }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  expect(field.textContent).toContain("模拟草稿 1：这段内容尚未提交");
  expect((screen.getByRole("textbox", { name: "页面标题" }) as HTMLTextAreaElement).value).toBe("保留草稿 1");
  await waitFor(() => expect(request.mock.calls.some(([operation, params = {}]) => operation === "saveNote" && params.id === "aaaaaaaa-bbbb-4ccc-8ddd-000000000001" && String(params.body).includes("模拟草稿 1"))).toBe(true));
});

it("honors missing write/delete capabilities across sidebar, detail and page actions", async () => {
  const user = userEvent.setup();
  const { request } = await mount("loading", true);
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(screen.getByRole("button", { name: "新建笔记" })).toHaveProperty("disabled", true);
  await user.click(screen.getByRole("button", { name: "打开 今天的手冲记录" }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  expect(field.getAttribute("contenteditable")).toBe("false");
  await user.click(screen.getByRole("button", { name: "页面操作" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual(["外观和布局"]);
  expect(request.mock.calls.some(([operation]) => ["saveNote", "deleteNote", "deleteDraft"].includes(operation))).toBe(false);
});

it("keeps a reconnect action beside cached notes after the local service disconnects", async () => {
  const error = { code: "BRIDGE_UNAVAILABLE", message: "本机服务已停止", retryable: true };
  await mount("loading", false, state => ({ ...state, error, localWebReconnectRequired: true, connectionState: false }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  const notice = screen.getByRole("alert");
  expect(within(notice).getByText("连接已断开")).toBeDefined();
  expect(within(notice).getByRole("link", { name: "重新打开" }).getAttribute("href")).toBe("memocard-service://open-web");
  expect(within(notice).queryByRole("button", { name: "重试" })).toBeNull();
});

it("offers folder reauthorization even while cached results remain visible", async () => {
  const onReauthorize = vi.fn();
  const user = userEvent.setup();
  await mount("loading", false, state => ({ ...state, needsPermission: true, connectionState: false, sidebar: { ...state.sidebar, onReauthorize } }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  await user.click(screen.getByRole("button", { name: "重新授权" }));
  expect(onReauthorize).toHaveBeenCalledOnce();
});

it("shows incomplete-scan diagnostics directly and refreshes without discarding the current result", async () => {
  const user = userEvent.setup();
  const { request } = await mount("partial");
  const note = await screen.findByRole("button", { name: "打开 模拟笔记 · 产品验收" });
  const notice = screen.getByText("部分文件暂时无法读取").closest("[role=status]") as HTMLElement;
  expect(notice.textContent).toMatch(/已读入\s*2/);
  expect(notice.textContent).toMatch(/待读取\s*3/);
  expect(notice.textContent).toMatch(/需要处理\s*0/);
  expect(within(notice).getByText(/当前未提供具体文件和失败原因/)).toBeDefined();
  expect(within(notice).getByText(/请确认笔记文件夹可访问/)).toBeDefined();
  expect(within(notice).queryByRole("button", { name: "查看详情" })).toBeNull();
  expect(notice.querySelector("details, summary")).toBeNull();
  const before = request.mock.calls.filter(([operation]) => operation === "getStatus").length;
  await user.click(screen.getByRole("button", { name: "重新读取" }));
  await waitFor(() => expect(request.mock.calls.filter(([operation]) => operation === "getStatus").length).toBeGreaterThan(before));
  expect(note.isConnected).toBe(true);
});

it("shows draft timestamps and distinct pending property values before choosing a recovery version", async () => {
  const user = userEvent.setup();
  await mount("draft-versions");
  await user.click(await screen.findByRole("button", { name: "查看草稿" }));
  const dialog = await screen.findByRole("dialog", { name: "保留的草稿" });
  expect(within(dialog).getByText("未保存属性：摘要：客户端 1 待保存内容")).toBeDefined();
  expect(within(dialog).getByText("未保存属性：摘要：客户端 2 待保存内容")).toBeDefined();
  expect(dialog.querySelectorAll("time[datetime]")).toHaveLength(2);
});

it("restores useful focus after confirming deletion and retains the other drafts", async () => {
  const user = userEvent.setup();
  const { request } = await mount("draft-many");
  await user.click(await screen.findByRole("button", { name: "查看草稿" }));
  const dialog = await screen.findByRole("dialog", { name: "保留的草稿" });
  const first = within(dialog).getByRole("heading", { name: "保留草稿 1" }).closest("article")!;
  await user.click(within(first).getByRole("button", { name: /^删除草稿：/ }));
  const confirmation = await screen.findByRole("dialog", { name: "删除这条草稿？" });
  await user.click(within(confirmation).getByRole("button", { name: "确认删除" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "删除这条草稿？" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "完成" })));
  expect(within(dialog).queryByRole("heading", { name: "保留草稿 1" })).toBeNull();
  expect(within(dialog).getByRole("heading", { name: "保留草稿 3" })).toBeDefined();
  expect(request.mock.calls.filter(([operation]) => operation === "deleteDraft")).toHaveLength(1);
});

it("does not offer a misleading retry for a non-retryable operation error", async () => {
  await mount("loading", false, state => ({ ...state, error: { code: "INVALID_ARGUMENT", message: "无法执行此操作" }, retryableError: false }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(within(screen.getByRole("alert")).queryByRole("button", { name: "重试" })).toBeNull();
});

it("offers the right exit from an empty quick filter instead of implying the vault is empty", async () => {
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  await user.click(screen.getByRole("button", { name: /^筛选笔记/ }));
  await user.click(await screen.findByRole("button", { name: "有图片" }));
  await user.keyboard("{Escape}");
  await screen.findByText("在笔记中插入图片后，会自动出现在这里。");
  await user.click(screen.getByRole("button", { name: "查看所有笔记" }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
});

it("gives the folder onboarding a page heading and a skip link that leaves the route unchanged", async () => {
  const user = userEvent.setup();
  await mount("folder-cancel", false, state => ({ ...state, sidebar: { ...state.sidebar, canCreateVault: true } }));
  await screen.findByRole("heading", { level: 2, name: "打开你的笔记文件夹" });
  expect(screen.getByRole("heading", { level: 1, name: "所有笔记" })).toBeDefined();
  expect(screen.getByRole("button", { name: "创建笔记库" })).toBeDefined();
  expect(screen.getByRole("button", { name: "打开已有笔记库" })).toBeDefined();
  expect(screen.getByText("只访问你授权的文件夹")).toBeDefined();
  const hash = location.hash;
  await user.click(screen.getByRole("link", { name: "跳到笔记内容" }));
  expect(location.hash).toBe(hash);
  expect(document.activeElement?.id).toBe("web-main-content");
});

it("keeps the local-service instructions without a folder-permission hint in unsupported browsers", async () => {
  setStorybookClientMode("browser");
  await mount("unsupported");
  await screen.findByRole("heading", { level: 2, name: "通过本机服务连接笔记库" });
  expect(screen.getByText("此浏览器无法直接读写文件夹。请从 MemoCard 菜单栏打开，或使用 memocard serve。")).toBeDefined();
  expect(screen.queryByText("只访问你授权的文件夹")).toBeNull();
});

it("does not keep announcing loading after a terminal disconnect while opening a note", async () => {
  await mount("loading", false, state => ({ ...state, openingNote: true, error: { code: "BRIDGE_UNAVAILABLE", message: "本机服务已停止" }, detailReadFailed: false, localWebReconnectRequired: true, connectionState: false }));
  await screen.findByText("连接已断开");
  expect(screen.queryByRole("status", { name: "正在读取内容" })).toBeNull();
});

it("keeps desktop page headings without a page menu or duplicate header label", async () => {
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  const header = document.querySelector<HTMLElement>(".web-app-header")!;
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
  expect(screen.getByRole("heading", { name: "所有笔记", level: 1 })).toBeDefined();
  expect(within(header).queryByRole("button", { name: "页面操作" })).toBeNull();
  expect(within(header).queryByRole("button", { name: "搜索" })).toBeNull();
  expect(within(header).queryByRole("button", { name: "收起侧栏" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "收起侧栏" }));
  const title = screen.getByRole("heading", { name: "所有笔记", level: 1 });
  const expand = await within(title.parentElement!).findByRole("button", { name: "展开侧栏" });
  expect(within(header).queryByRole("button", { name: "展开侧栏" })).toBeNull();
  expect(expand.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(expand));
  expect(header.querySelector(".web-header-separator")).toBeNull();
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
  expect(document.querySelector('[data-slot="sidebar-inner"]')?.hasAttribute("inert")).toBe(true);
  await user.click(expand);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "收起侧栏" })));
  expect(within(title.parentElement!).queryByRole("button", { name: "展开侧栏" })).toBeNull();
});

it("opens retained drafts from the vault menu on desktop tags without page actions", async () => {
  const user = userEvent.setup();
  const { request } = await mount("draft-many");
  await screen.findByRole("button", { name: "查看草稿" });
  await user.click(within(screen.getByRole("navigation", { name: "主要导航" })).getByRole("button", { name: "标签" }));
  await screen.findByRole("heading", { name: "标签", level: 1 });
  expect(screen.queryByRole("button", { name: "页面操作" })).toBeNull();
  await user.click(screen.getByRole("button", { name: /^笔记库：/ }));
  expect((await screen.findByRole("menuitem", { name: "刷新笔记库" })).getAttribute("aria-disabled")).not.toBe("true");
  await user.click(screen.getByRole("menuitem", { name: /^保留草稿/ }));
  const dialog = await screen.findByRole("dialog", { name: "保留的草稿" });
  expect(within(dialog).getByRole("heading", { name: "保留草稿 1" })).toBeDefined();
  expect(request.mock.calls.some(([operation]) => ["saveNote", "deleteNote", "deleteDraft"].includes(operation))).toBe(false);
});

it("keeps typography choices with the current note without saving its content", async () => {
  const user = userEvent.setup();
  const { request } = await mount();
  const openNote = async (title: string) => {
    await user.click(await screen.findByRole("button", { name: `打开 ${title}` }));
    return (await screen.findByRole("textbox", { name: "笔记内容" })).closest<HTMLElement>(".web-page-content")!;
  };
  const back = () => user.click(within(screen.getByRole("navigation", { name: "当前位置" })).getByRole("button", { name: "所有笔记" }));
  const detail = await openNote("今天的手冲记录");
  expect(detail.hasAttribute("data-small-text")).toBe(false);
  await user.click(screen.getByRole("button", { name: "页面操作" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).getAllByRole("menuitem").map(item => item.textContent)).toEqual(["外观和布局", "移入回收站"]);
  await user.click(within(menu).getByRole("menuitem", { name: "外观和布局" }));
  const appearance = await screen.findByRole("menu", { name: "外观和布局" });
  const choose = async (group: string, name: string) => {
    const choice = within(within(appearance).getByRole("group", { name: group })).getByRole("menuitemradio", { name });
    act(() => choice.focus());
    await user.keyboard("{Enter}");
    expect(choice.getAttribute("aria-checked")).toBe("true");
  };
  const smallText = await within(appearance).findByRole("menuitemcheckbox", { name: "小字号" });
  expect(smallText.getAttribute("aria-checked")).toBe("false");
  expect(within(appearance).queryByText("跟随全局")).toBeNull();
  await choose("标题字体", "等宽体");
  await choose("正文字体", "无衬线体");
  act(() => smallText.focus());
  await user.keyboard("{Enter}");
  expect(smallText.getAttribute("aria-checked")).toBe("true");
  expect(detail.hasAttribute("data-small-text")).toBe(true);
  expect(detail.style.getPropertyValue("--note-font-heading")).toContain("ui-monospace");
  expect(detail.style.getPropertyValue("--note-font-body")).toContain("system-ui");
  expect(detail.style.getPropertyValue("--note-size")).toBe("var(--font-size-sm)");
  await user.keyboard("{Escape}{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await back();
  const other = await openNote("让设计语言走进真实页面");
  expect(other.hasAttribute("data-small-text")).toBe(false);
  expect(other.style.getPropertyValue("--note-font-heading")).toBe("");
  expect(other.style.getPropertyValue("--note-size")).toBe("");
  await back();
  expect((await openNote("今天的手冲记录")).style.getPropertyValue("--note-size")).toBe("var(--font-size-sm)");
  expect(request.mock.calls.some(([operation]) => operation === "saveNote")).toBe(false);
});

it("keeps H5 navigation in its drawer and the global search/capture in the record bar", async () => {
  vi.stubGlobal("innerWidth", 390);
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(screen.getByRole("heading", { name: "所有笔记", level: 1 }).closest(".sr-only")).not.toBeNull();
  const footer = screen.getByRole("contentinfo", { name: "快捷记录" });
  expect(within(footer).getByRole("button", { name: "搜索全部笔记" })).toBeDefined();
  expect(within(footer).getByRole("button", { name: "打开快速记录" })).toBeDefined();
  expect(screen.getByRole("button", { name: "打开导航" }).querySelector("img")).toBeNull();
  await user.click(screen.getByRole("button", { name: "打开导航" }));
  const drawer = await screen.findByRole("dialog", { name: "笔记导航" });
  expect(within(drawer).queryByRole("button", { name: "搜索" })).toBeNull();
  expect(within(drawer).queryByRole("button", { name: "新建笔记" })).toBeNull();
  await user.click(within(drawer).getByRole("button", { name: "主页" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
  expect(screen.getByRole("navigation", { name: "当前位置" }).textContent).toContain("主页");
  expect(screen.queryByText("MEMOCARD")).toBeNull();
  expect(screen.queryByText("一句发现、一段灵感，留在自己的笔记里。")).toBeNull();
});

it("retains page headings and the home mascot while showing the disconnected vault guide", async () => {
  const user = userEvent.setup();
  await mount("folder-cancel");
  await screen.findByRole("heading", { name: "打开你的笔记文件夹", level: 2 });
  expect(screen.getByRole("heading", { name: "所有笔记", level: 1 })).toBeDefined();
  await user.click(screen.getByRole("button", { name: "主页" }));
  expect(screen.getByRole("heading", { name: "主页", level: 1 })).toBeDefined();
  expect(screen.getByRole("button", { name: /Boop the MemoCard/ })).toBeDefined();
  expect(screen.getByText("只访问你授权的文件夹")).toBeDefined();
});

it("creates a note from the top bar and explains why it cannot be pinned until saved", async () => {
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ interfaceTheme: "minimal" }));
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("navigation", { name: "顶部导航" });
  const search = screen.getByRole("button", { name: "搜索" });
  const create = within(search.parentElement!).getByRole("button", { name: "新建笔记" });
  expect(create.nextElementSibling).toBe(search);
  expect(screen.queryByRole("button", { name: "新建" })).toBeNull();
  await user.click(create);
  await screen.findByRole("textbox", { name: "笔记内容" });
  const pin = screen.getByRole("button", { name: "固定到主页" });
  expect(pin).toHaveProperty("disabled", true);
  expect(pin.getAttribute("aria-description")).toBe("保存笔记后可固定到主页");
  await act(async () => { pin.parentElement!.focus(); });
  expect(await screen.findByText("保存笔记后可固定到主页")).toBeDefined();
});

it("retains a page heading when the service cannot provide trash", async () => {
  await mount("loading", false, state => ({ ...state, view: "trash", title: "回收站", trash: null }));
  await screen.findByRole("heading", { name: "当前服务暂不支持回收站", level: 2 });
  expect(screen.getByRole("heading", { name: "回收站", level: 1 })).toBeDefined();
  expect(screen.queryByRole("navigation", { name: "当前位置" })).toBeNull();
});


it("announces an initial list timeout and preserves its retry action", async () => {
  await mount("loading", false, state => ({ ...state, listTimeout: "initial" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("笔记加载超时");
  expect(within(alert).getByRole("button", { name: "重试" })).toBeDefined();
});


it("switches interface themes without rebuilding an open editor, changing its route, or losing undo", async () => {
  const user = userEvent.setup();
  await mount();
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const editor = noteEditor(field);
  const original = editor.getText();
  act(() => { editor.commands.insertContentAt(1, "主题切换保留编辑"); field.focus(); });
  const hash = location.hash;
  for (const interfaceTheme of ["minimal", "classic"]) {
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "memocard-web-appearance-v1", newValue: JSON.stringify({ interfaceTheme }), storageArea: localStorage })));
    if (interfaceTheme === "minimal") await screen.findByRole("navigation", { name: "顶部导航" });
    else await waitFor(() => expect(screen.queryByRole("navigation", { name: "顶部导航" })).toBeNull());
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toBe(field);
    expect(noteEditor(field)).toBe(editor);
    expect(document.activeElement).toBe(field);
    expect(location.hash).toBe(hash);
    expect(editor.getText()).toContain("主题切换保留编辑");
  }
  act(() => { editor.commands.undo(); });
  expect(editor.getText()).toBe(original);
});

it("opens the tag directory, search, and quick filters from the default minimal navigation", async () => {
  localStorage.removeItem("memocard-web-appearance-v1");
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(screen.queryByRole("complementary", { name: "笔记导航" })).toBeNull();
  expect(screen.queryByRole("button", { name: "展开侧栏" })).toBeNull();
  const nav = screen.getByRole("navigation", { name: "顶部导航" });
  await user.click(within(nav).getByRole("button", { name: "标签" }));
  const tags = await screen.findByRole("region", { name: "标签目录" });
  const search = screen.getByRole("button", { name: "搜索" });
  const create = within(search.parentElement!).getByRole("button", { name: "新建笔记" });
  expect(create.nextElementSibling).toBe(search);
  expect(screen.queryByRole("dialog", { name: "浏览标签" })).toBeNull();
  expect(within(tags).queryByRole("textbox", { name: "搜索标签" })).toBeNull();
  await user.click(within(tags).getByRole("button", { name: "查看标签 设计 的笔记" }));
  await screen.findByRole("button", { name: "打开 让设计语言走进真实页面" });
  expect(within(nav).getByRole("button", { name: "标签" }).getAttribute("aria-current")).toBe("page");
  await user.click(screen.getByRole("button", { name: "打开 让设计语言走进真实页面" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  expect(screen.getByRole("button", { name: "新建笔记" })).toBe(create);
  expect(within(nav).queryByRole("button", { current: "page" })).toBeNull();
  expect(screen.queryByRole("button", { name: "MemoCard，返回主页" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "返回笔记列表" }));
  await screen.findByRole("button", { name: "打开 让设计语言走进真实页面" });
  expect(within(nav).getByRole("button", { name: "标签", current: "page" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "MemoCard，返回主页" })).toBeTruthy();
  await user.click(within(nav).getByRole("button", { name: "更多" }));
  const menu = await screen.findByRole("menu");
  expect(within(menu).queryByRole("menuitem", { name: "新建笔记" })).toBeNull();
  expect(within(menu).getByRole("menuitem", { name: "刷新笔记库" }).querySelector("svg")).not.toBeNull();
  expect(within(menu).getAllByRole("menuitem").slice(-2).map(item => item.textContent)).toEqual(["设置", "回收站"]);
  expect(within(menu).queryByRole("group", { name: "快捷筛选" })).toBeNull();
  await user.keyboard("{Escape}");
  await user.click(within(nav).getByRole("button", { name: "所有笔记" }));
  expect(within(nav).getByRole("button", { name: "所有笔记" }).getAttribute("aria-haspopup")).toBeNull();
  await user.click(screen.getByRole("button", { name: /^筛选笔记/ }));
  const filters = within(await screen.findByRole("dialog", { name: "筛选笔记" })).getByRole("group", { name: "类型" });
  expect(within(filters).getAllByRole("button").map(item => item.textContent)).toEqual(["全部类型", "无标签1", "有图片0", "有链接0"]);
  await user.click(within(filters).getByRole("button", { name: "有图片" }));
  await user.keyboard("{Escape}");
  await screen.findByText("在笔记中插入图片后，会自动出现在这里。");
  expect(within(nav).getByRole("button", { name: "所有笔记", current: "page" })).toBeTruthy();
  await user.click(within(nav).getByRole("button", { name: "所有笔记" }));
  await screen.findByRole("heading", { name: "所有笔记", level: 1 });
  await user.click(screen.getByRole("button", { name: "搜索" }));
  await screen.findByRole("dialog", { name: "搜索笔记" });
});

it("keeps the drawer navigation on mobile even when the minimal theme is saved", async () => {
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ interfaceTheme: "minimal" }));
  vi.stubGlobal("innerWidth", 390);
  await mount();
  await screen.findByRole("heading", { name: "所有笔记", level: 1 });
  expect(screen.queryByRole("navigation", { name: "顶部导航" })).toBeNull();
  expect(screen.getByRole("button", { name: "打开导航" })).toBeDefined();
});


it("registers a CSS theme reusing topbar and a test-only layout without rebuilding shared content", async () => {
  const user = userEvent.setup();
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ interfaceTheme: "minimal" }));
  await mount("loading", false, undefined, appearanceFixture);
  await screen.findByRole("navigation", { name: "顶部导航" });
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const editor = noteEditor(field); const original = editor.getText(); const hash = location.hash;
  const nav = screen.getByRole("navigation", { name: "顶部导航" });
  act(() => { editor.commands.insertContentAt(1, "跨主题编辑"); field.focus(); });
  for (const interfaceTheme of ["paper", "experimental", "classic"]) {
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "memocard-web-appearance-v1", newValue: JSON.stringify({ interfaceTheme }), storageArea: localStorage })));
    await waitFor(() => expect(document.querySelector(".web-app")?.getAttribute("data-interface-theme")).toBe(interfaceTheme));
    if (interfaceTheme === "paper") expect(screen.getByRole("navigation", { name: "顶部导航" })).toBe(nav);
    if (interfaceTheme === "experimental") expect(screen.getByRole("navigation", { name: "测试布局" })).toBeDefined();
    expect(screen.getByRole("textbox", { name: "笔记内容" })).toBe(field);
    expect(noteEditor(field)).toBe(editor); expect(location.hash).toBe(hash);
    expect(document.activeElement).toBe(field); expect(editor.getText()).toContain("跨主题编辑");
  }
  act(() => { editor.commands.undo(); }); expect(editor.getText()).toBe(original);
});


it("commits a loaded theme without overwriting color changes made while loading", async () => {
  let finish!: () => void;
  const css = new Promise<void>(resolve => { finish = resolve; });
  const catalog: AppearanceCatalog = { ...appearanceFixture, themes: { ...appearanceFixture.themes, paper: { ...appearanceFixture.themes.paper, loadStyles: () => css } } };
  history.replaceState(null, "", "#/settings");
  const user = userEvent.setup(); await mount("loading", false, undefined, catalog);
  await screen.findByRole("combobox", { name: "界面主题" });
  await user.click(screen.getByRole("combobox", { name: "界面主题" }));
  await user.click(await screen.findByRole("option", { name: "测试纸感" }));
  expect(document.querySelector(".web-app")?.getAttribute("data-interface-theme")).toBe("classic");
  await user.click(screen.getByRole("combobox", { name: "颜色模式" }));
  await user.click(await screen.findByRole("option", { name: "深色" }));
  await act(async () => { finish(); });
  await waitFor(() => expect(document.querySelector(".web-app")?.getAttribute("data-interface-theme")).toBe("paper"));
  expect(JSON.parse(localStorage.getItem("memocard-web-appearance-v1")!)).toMatchObject({ interfaceTheme: "paper", theme: "dark" });
  expect(document.querySelector(".web-app")?.getAttribute("data-ui-theme")).toBe("dark");
});

it("keeps collection headings above the type toolbar for every filter state", async () => {
  const user = userEvent.setup();
  await mount();
  const types = within(await screen.findByRole("tablist", { name: "类型" }));
  const expectSeparateHeading = async (name: string) => {
    const heading = await screen.findByRole("heading", { name, level: 1 });
    expect(heading.closest(".ui-note-toolbar")).toBeNull();
    expect(heading.parentElement?.nextElementSibling?.classList.contains("ui-note-collection")).toBe(true);
  };
  await expectSeparateHeading("所有笔记");
  for (const name of ["无标签", "有图片", "有链接"]) {
    await user.click(types.getByRole("tab", { name }));
    await expectSeparateHeading("所有笔记");
    await user.click(types.getByRole("tab", { name: "全部类型" }));
    await expectSeparateHeading("所有笔记");
  }
  await user.click(types.getByRole("tab", { name: "有图片" }));
  await user.click(types.getByRole("tab", { name: "有链接" }));
  await expectSeparateHeading("所有笔记");
});
