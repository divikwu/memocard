// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { App, type AppViewState } from "../../src/App";
import { replaceCaptureText, replaceEditorText } from "../../src/editor-test-utils";
import { resetStorybookBridge, setStorybookClientMode, setStorybookRequestHandler } from "../../test-support/bridge";
import { createWorkspaceFixture } from "./workspace-fixture";
import { WebAppearanceProvider } from "./WebAppearance";
import { preloadWebEditor, renderWebApp } from "./WebAppView";

let detach: (() => void) | undefined;
beforeAll(async () => { await preloadWebEditor(); await Promise.all([import("../business/QuickCapture"), import("../business/NoteSearchDialog")]); }, 30_000);
beforeEach(() => {
  localStorage.clear(); resetStorybookBridge();
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

async function mount(scenario = "loading", readOnly = false, mapView?: (state: AppViewState) => AppViewState) {
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
  await act(async () => { render(<WebAppearanceProvider><App renderView={state => renderWebApp(mapView ? mapView(state) : state)} preloadEditor={preloadWebEditor} /></WebAppearanceProvider>); });
  return { fixture, request };
}

it("navigates a tag, edits and saves a note, then finds its committed body through global search", async () => {
  const user = userEvent.setup();
  const { fixture, request } = await mount();
  const tagNavigation = await screen.findByRole("navigation", { name: "标签" });
  await user.click(within(tagNavigation).getByRole("button", { name: "设计" }));
  await user.click(await screen.findByRole("button", { name: "打开 让设计语言走进真实页面" }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  expect(within(breadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["所有笔记", "设计"]);
  expect(breadcrumb.textContent).not.toContain("MemoCard");
  expect(breadcrumb.textContent).not.toContain("让设计语言走进真实页面");
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
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  expect(within(breadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["主页"]);
  await user.click(within(breadcrumb).getByRole("button", { name: "主页" }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(location.hash).toBe("#/home");
});

it("uses the selected tag hierarchy and blocks ancestor navigation when saving fails", async () => {
  const user = userEvent.setup();
  const { request } = await mount();
  await user.click((await screen.findAllByRole("button", { name: "筛选标签 生活/咖啡" }))[0]);
  await user.click(await screen.findByRole("button", { name: "打开 今天的手冲记录" }));
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  expect(within(breadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["所有笔记", "生活", "咖啡"]);
  const detailHash = location.hash;
  const implementation = request.getMockImplementation()!;
  request.mockImplementation(async (operation, params) => {
    if (operation === "saveNote") throw new Error("面包屑保存测试失败");
    return implementation(operation, params);
  });
  replaceEditorText("通过面包屑返回前需要保存的正文 #生活/咖啡", field);
  await user.click(within(breadcrumb).getByRole("button", { name: "生活" }));
  await screen.findByText("面包屑保存测试失败");
  expect(location.hash).toBe(detailHash);
  expect(screen.getByRole("textbox", { name: "笔记内容" }).textContent).toContain("通过面包屑返回前需要保存的正文");
  request.mockImplementation(implementation);
  await user.click(within(breadcrumb).getByRole("button", { name: "生活" }));
  await screen.findByRole("button", { name: "打开 在阳台上留一点绿色" });
  expect(request.mock.calls.some(([operation, params]) => operation === "queryNotes" && JSON.stringify(params?.tags) === '["生活"]')).toBe(true);
  await user.click(screen.getByRole("button", { name: "打开 今天的手冲记录" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  expect(within(breadcrumb).getAllByRole("button").map(button => button.textContent)).toEqual(["所有笔记", "生活"]);
  await user.click(within(breadcrumb).getByRole("button", { name: "所有笔记" }));
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
  await user.click(screen.getByRole("button", { name: "页面操作" }));
  await user.click(await screen.findByRole("menuitem", { name: "设置" }));
  await screen.findByRole("heading", { name: "设置", level: 1 });
  expect(fixture.snapshot().notes.find(note => note.title === "今天的手冲记录")?.body).toBe("离开编辑页前必须保留的正文");
  await user.click(screen.getByRole("combobox", { name: "主题" }));
  await user.click(await screen.findByRole("option", { name: "深色" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
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
  expect(within(menu).queryByRole("menuitem", { name: "移入回收站" })).toBeNull();
  expect(within(menu).getByRole("menuitem", { name: "新建笔记" }).getAttribute("aria-disabled")).toBe("true");
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
  await user.click(screen.getByRole("button", { name: "展开或收起快捷筛选" }));
  await user.click(screen.getByRole("button", { name: "有图片" }));
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

it("retains Sidebar-10 breadcrumb/action slots and restores the trigger only when the desktop sidebar is closed", async () => {
  const user = userEvent.setup();
  await mount();
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  const breadcrumb = screen.getByRole("navigation", { name: "当前位置" });
  const header = breadcrumb.closest("header")!;
  expect(within(header).getByRole("link", { name: "所有笔记" }).getAttribute("aria-current")).toBe("page");
  expect(within(header).getByRole("button", { name: "页面操作" })).toBeDefined();
  expect(within(header).queryByRole("button", { name: "搜索" })).toBeNull();
  expect(within(header).queryByRole("button", { name: "收起侧栏" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "收起侧栏" }));
  await within(header).findByRole("button", { name: "展开侧栏" });
  expect(header.querySelector('[data-slot="separator"]')?.getAttribute("data-orientation")).toBe("vertical");
  expect(within(header).getByRole("link", { name: "所有笔记" })).toBeDefined();
  expect(document.querySelector('[data-slot="sidebar-inner"]')?.hasAttribute("inert")).toBe(true);
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
  await user.click(screen.getByRole("button", { name: "打开导航" }));
  const drawer = await screen.findByRole("dialog", { name: "笔记导航" });
  expect(within(drawer).queryByRole("button", { name: "搜索" })).toBeNull();
  expect(within(drawer).queryByRole("button", { name: "新建笔记" })).toBeNull();
  await user.click(within(drawer).getByRole("button", { name: "主页" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "笔记导航" })).toBeNull());
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

it("explains why a new unsaved note cannot be pinned yet", async () => {
  const user = userEvent.setup();
  await mount();
  await user.click(await screen.findByRole("button", { name: "新建笔记" }));
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
});


it("announces an initial list timeout and preserves its retry action", async () => {
  await mount("loading", false, state => ({ ...state, listTimeout: "initial" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("笔记加载超时");
  expect(within(alert).getByRole("button", { name: "重试" })).toBeDefined();
});
