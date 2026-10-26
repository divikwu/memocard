// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { App } from "../../src/App";
import { errorMessage } from "../../src/error-messages";
import { resetStorybookBridge, setStorybookClientMode, setStorybookRequestHandler } from "../../test-support/bridge";
import { createStateFixture } from "../../ui-state-fixtures/state-fixture";
import { scenarios as sharedScenarios } from "../../ui-state-fixtures/catalog";
import { WebAppearanceProvider } from "../web/WebAppearance";
import { preloadWebEditor } from "../web/WebAppView";
import { ScenarioView } from "./ScenarioView";
import { getScenario, noteId, scenarios } from "./scenarios";

vi.mock("../preview-fonts", async original => ({ ...await original<typeof import("../preview-fonts")>(), loadPreviewFonts: vi.fn().mockResolvedValue([]) }));

beforeAll(async () => {
  await preloadWebEditor();
  await Promise.all([import("../business/property-editors"), import("../business/NoteSearchDialog")]);
}, 30_000);
beforeEach(() => {
  localStorage.clear();
  resetStorybookBridge();
  document.elementFromPoint = () => null;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("FontFace", class {});
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("max-width") && window.innerWidth < 768, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("scrollBy", vi.fn());
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(async () => {
  cleanup();
  await act(async () => {});
  resetStorybookBridge();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function show(id: string) {
  const scenario = getScenario(id);
  const fixture = createStateFixture(id);
  setStorybookClientMode(fixture.browser ? "browser" : "local-web");
  const request = vi.fn(fixture.request);
  setStorybookRequestHandler(request);
  history.replaceState(null, "", scenario.group === "设置" ? "#/settings" : scenario.detail ? `#/notes/${noteId}` : "#/notes");
  await act(async () => {
    render(<WebAppearanceProvider><App preloadEditor={preloadWebEditor} renderView={state => <ScenarioView state={state} scenario={scenario} />} /></WebAppearanceProvider>);
    await vi.dynamicImportSettled();
  });
  return { fixture, request };
}

it("retains every shared scenario identity while providing instructions for the new view", () => {
  expect(scenarios.map(scenario => scenario.id)).toEqual(sharedScenarios.map(scenario => scenario.id));
  expect(new Set(scenarios.map(scenario => scenario.id)).size).toBe(48);
  expect(scenarios.filter(scenario => scenario.group === "空状态")).toHaveLength(3);
  expect(getScenario("date-invalid").instructions).toContain("MM/DD/YYYY");
});

it.each([
  ["disconnected", "需要重新连接本机服务"],
  ["unauthorized", "需要重新连接本机服务"],
  ["permission", "需要文件夹访问权限"],
  ["unsupported", "通过本机服务连接笔记库"],
  ["detail-error", "无法打开笔记"],
  ["detail-missing", "笔记不存在"],
  ["timeout", "笔记加载超时"],
  ["partial", "部分文件暂时无法读取"],
  ["index-reading", "正在读取笔记库"],
  ["index-writing", "正在建立索引"],
  ["draft-corrupt", "部分草稿无法读取"],
  ["draft-directory", "此恢复目录暂时无法读取，原记录已保留。"],
  ["save-error", "文件操作未完成，请检查目录权限和文件可用性。"],
  ["draft-save-error", "本机草稿暂时无法保存，请检查本机目录权限和可用空间。"],
  ["conflict", "文件已在其他位置修改，原文未被覆盖。请保留草稿并重新读取。"],
  ["source-deleted", "原文件已移除，不能从旧缓存恢复。"],
  ["source-conflict", "文件存在未解决的 iCloud 版本冲突，原版本均已保留。"],
  ["transaction-error", "保存事务期间文件被外部修改，事务记录和草稿已保留，请先处理恢复记录。"],
  ["property-read-error", "属性定义配置无法读取，请检查 .memocard/property-definitions.json。"],
  ["readonly", "部分属性只读"],
  ["empty", "记下第一条笔记"],
])("%s renders its state through the real new application view", async (id, message) => {
  await show(id);
  expect((await screen.findAllByText(text => text.includes(errorMessage(new Error(message))), {}, { timeout: 4000 })).length).toBeGreaterThan(0);
  expect(document.querySelector(".web-app")).not.toBeNull();
  expect(document.querySelector(".ui-theme")).not.toBeNull();
});

it("recovers a failed detail read into the new editor without an early write", async () => {
  const user = userEvent.setup();
  const { fixture, request } = await show("detail-error");
  const state = await screen.findByRole("alert");
  expect(within(state).getByRole("button", { name: "返回笔记列表" })).toBeDefined();
  const retry = within(state).getByRole("button", { name: "重试" });
  expect(request.mock.calls.some(([operation]) => ["saveNote", "saveDraft"].includes(operation))).toBe(false);
  fixture.retry();
  await user.click(retry);
  await screen.findByRole("textbox", { name: "笔记内容" });
  expect(document.querySelector(".ui-note-editor")).not.toBeNull();
  expect(request.mock.calls.some(([operation]) => ["saveNote", "saveDraft"].includes(operation))).toBe(false);
});

it("preserves unsaved content while a failed save is retried and committed", async () => {
  const user = userEvent.setup();
  const { fixture } = await show("save-error");
  const retry = await screen.findByRole("button", { name: "重试保存" }, { timeout: 4000 });
  expect((await screen.findByRole("textbox", { name: "笔记内容" })).textContent).toContain("模拟未保存修改");
  expect(fixture.snapshot().notes.find(note => note.id === noteId)?.body).not.toContain("模拟未保存修改");
  fixture.retry();
  await user.click(retry);
  await waitFor(() => expect(fixture.snapshot().notes.find(note => note.id === noteId)?.body).toContain("模拟未保存修改"));
});

it.each(["draft-single", "draft-many", "draft-versions", "draft-dismissed"])("%s opens the correct recovery dialog without writing", async id => {
  const { request } = await show(id);
  const dialog = await screen.findByRole("dialog", { name: "保留的草稿" });
  const count = id === "draft-many" ? 6 : id === "draft-versions" ? 2 : 1;
  expect(within(dialog).getAllByRole("button", { name: /^继续编辑：/ })).toHaveLength(count);
  if (id === "draft-versions") {
    expect(within(dialog).getByText("未保存属性：摘要：客户端 1 待保存内容")).toBeDefined();
    expect(within(dialog).getByText("未保存属性：摘要：客户端 2 待保存内容")).toBeDefined();
  }
  if (id === "draft-dismissed") expect(within(dialog).getByText("已关闭提醒")).toBeDefined();
  expect(request.mock.calls.some(([operation]) => ["saveNote", "saveDraft", "dismissDraftReminder"].includes(operation))).toBe(false);
});

it("keeps a reminder failure inside the open recovery dialog and retains the draft", async () => {
  const user = userEvent.setup();
  await show("draft-reminder-error");
  const dialog = await screen.findByRole("dialog", { name: "保留的草稿" });
  await user.click(within(dialog).getByRole("button", { name: "不再提醒" }));
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("草稿已更新，请刷新列表后重试。"));
  expect(within(dialog).getByRole("button", { name: "继续编辑：保留草稿 1" })).toBeDefined();
});

it("shows an actual search miss and restores the collection when cleared", async () => {
  const user = userEvent.setup();
  const { request } = await show("search-empty");
  await screen.findByText("没有找到相关笔记");
  expect(screen.getByRole("textbox", { name: "搜索当前视图笔记" })).toHaveProperty("value", "不存在的关键词");
  expect(request.mock.calls.some(([operation, params]) => operation === "queryNotes" && params?.query === "不存在的关键词")).toBe(true);
  await user.click(screen.getByRole("button", { name: "清空当前搜索" }));
  await screen.findByRole("list", { name: "笔记列表" });
});

it("starts in the images filter and returns to the unfiltered notes", async () => {
  const user = userEvent.setup();
  const { request } = await show("filter-empty");
  await screen.findByText("还没有包含图片的笔记");
  expect(request.mock.calls.some(([operation, params]) => operation === "queryNotes" && params?.quickFilter === "images")).toBe(true);
  await user.click(screen.getByRole("button", { name: "查看所有笔记" }));
  await screen.findByRole("list", { name: "笔记列表" });
});

it("runs folder selection before showing cancellation and can reselect in memory", async () => {
  const user = userEvent.setup();
  const { fixture, request } = await show("folder-cancel");
  await screen.findByRole("heading", { name: "文件夹授权未完成" });
  expect(request.mock.calls.some(([operation]) => operation === "selectVault")).toBe(true);
  fixture.retry();
  await user.click(screen.getByRole("button", { name: "重新选择文件夹" }));
  await screen.findByRole("list", { name: "笔记列表" });
});

it("retains the collection while a refresh times out and restores it through retry", async () => {
  const user = userEvent.setup();
  const { fixture } = await show("refresh-timeout");
  const notice = (await screen.findByText("刷新超时")).closest("[role=alert]")!;
  const list = screen.getByRole("list", { name: "笔记列表" });
  fixture.retry();
  await user.click(within(notice as HTMLElement).getByRole("button", { name: "重试" }));
  await waitFor(() => expect(screen.queryByText("刷新超时")).toBeNull());
  expect(screen.getByRole("list", { name: "笔记列表" })).toBe(list);
});

it("opens the property controls and validates a malformed date using the new picker", async () => {
  await show("date-invalid");
  fireEvent.click(await screen.findByRole("button", { name: "属性" }));
  fireEvent.click(await screen.findByRole("button", { name: "编辑属性 日期" }));
  const input = await screen.findByRole("textbox", { name: "属性值" });
  fireEvent.change(input, { target: { value: "99/99/2026" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(await screen.findByText("请输入有效日期（MM/DD/YYYY）。")).toBeDefined();
});

async function confirmSummaryType(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "属性" }));
  await user.click(await screen.findByRole("button", { name: "属性菜单 摘要" }));
  const trigger = await screen.findByRole("menuitem", { name: /^类型/ });
  trigger.focus();
  await user.keyboard("{ArrowRight}");
  const types = await screen.findByRole("menu", { name: "属性类型 摘要" });
  await user.click(within(types).getByRole("menuitemradio", { name: "复选框" }));
  return screen.findByRole("alertdialog", { name: "更改「摘要」的类型？" });
}

it("keeps a rejected lossy conversion inside its real confirmation without changing note or property values", async () => {
  const user = userEvent.setup();
  const { fixture, request } = await show("lossy-conversion");
  const original = fixture.snapshot();
  const dialog = await confirmSummaryType(user);
  await user.click(within(dialog).getByRole("button", { name: "确认更改" }));
  expect(await within(dialog).findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("转换"));
  expect(request.mock.calls.filter(([operation]) => operation === "updateNoteProperty")).toEqual([
    ["updateNoteProperty", expect.objectContaining({ id: noteId, name: "摘要", type: "checkbox", definition: true })],
  ]);
  expect(fixture.snapshot().notes).toEqual(original.notes);
  expect(fixture.snapshot().properties).toEqual(original.properties);
  expect(screen.queryByRole("button", { name: "重试保存" })).toBeNull();
  expect(screen.getByRole("alertdialog", { name: "更改「摘要」的类型？" })).toBe(dialog);
});

it("cancels a real type confirmation without submitting any mutation", async () => {
  const user = userEvent.setup();
  const { fixture, request } = await show("confirm-type");
  const original = fixture.snapshot();
  const dialog = await confirmSummaryType(user);
  expect(within(dialog).getByText(/库内所有同名属性将改为「复选框」/)).toBeDefined();
  await user.click(within(dialog).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(request.mock.calls.some(([operation]) => ["updateNoteProperty", "saveNote", "saveDraft"].includes(operation))).toBe(false);
  expect(fixture.snapshot()).toEqual(original);
  expect(screen.getByRole("button", { name: "编辑属性 摘要" })).toHaveProperty("textContent", "保留原始内容");
});

it("requires a real delete confirmation and changes only the current in-memory fixture", async () => {
  const user = userEvent.setup();
  const untouched = createStateFixture("confirm-delete");
  const secondOriginal = untouched.snapshot();
  const { fixture, request } = await show("confirm-delete");
  const original = fixture.snapshot();
  await user.click(await screen.findByRole("button", { name: "属性" }));
  await user.click(await screen.findByRole("button", { name: "属性菜单 摘要" }));
  await user.click(await screen.findByRole("menuitem", { name: "删除属性" }));
  const dialog = await screen.findByRole("alertdialog", { name: "删除属性「摘要」？" });
  expect(within(dialog).getByText("将从所有笔记中删除此属性及已填写的值，此操作无法撤销。")).toBeDefined();
  expect(request.mock.calls.some(([operation]) => operation === "updateNoteProperty")).toBe(false);
  expect(fixture.snapshot()).toEqual(original);
  await user.click(within(dialog).getByRole("button", { name: "确认删除" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(fixture.snapshot().properties.properties.map(property => property.name)).toEqual(["日期", "阶段"]);
  expect(screen.queryByRole("button", { name: "编辑属性 摘要" })).toBeNull();
  expect(fixture.snapshot().notes).toEqual(original.notes);
  expect(untouched.snapshot()).toEqual(secondOriginal);
});
