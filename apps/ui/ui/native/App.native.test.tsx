// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => { window.__memocardNativeChrome = true; return { request: vi.fn() }; });
vi.mock("../../src/bridge", () => ({
  request: bridge.request, reconnectVault: vi.fn(), isNative: true, isBrowserVault: false, isLocalWeb: false, isConnectedClient: true,
  errorMessage: (cause: unknown) => cause instanceof Error ? cause.message : "操作未完成",
}));
import { App } from "../../src/App";
import type { NativeSurface } from "../../src/ios-native";
import { createWorkspaceFixture } from "../web/workspace-fixture";
import { WebAppearanceProvider } from "../web/WebAppearance";
import { preloadWebEditor } from "../web/WebAppView";

type Published = NativeSurface & { id: string; instance: string; remove?: boolean };
const surface = (id: string): Published | undefined => bridge.request.mock.calls.filter(([operation, params]) => operation === "updateNativeSurface" && params.id === id && !params.remove).at(-1)?.[1];
function send(id: string, action: string, value?: string) {
  const instance = surface(id)?.instance;
  expect(instance).toBeTypeOf("string");
  act(() => window.dispatchEvent(new CustomEvent("memocard:native-action", { detail: { surface: id, instance, action, value } })));
}
beforeAll(async () => { await Promise.all([preloadWebEditor(), import("../business/QuickCapture"), import("../business/NoteSearchDialog"), import("./IOSAppChrome")]); }, 30_000);
let systemDark = false;
const appearanceListeners = new Set<() => void>();
beforeEach(() => {
  systemDark = false; appearanceListeners.clear();
  localStorage.clear(); bridge.request.mockReset(); history.replaceState(null, "", "#/notes");
  document.elementFromPoint = () => null;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: vi.fn(async () => [{}]), [Symbol.iterator]: function* () {} } });
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ get matches() { return query.includes("max-width") || systemDark; }, media: query, addEventListener: (_name: string, callback: () => void) => { if (query.includes("prefers-color-scheme")) appearanceListeners.add(callback); }, removeEventListener: (_name: string, callback: () => void) => { appearanceListeners.delete(callback); } })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("scrollBy", vi.fn());
});
afterEach(async () => { cleanup(); await act(async () => {}); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function mount() {
  const fixture = await createWorkspaceFixture();
  bridge.request.mockImplementation(async (operation: string, params: Record<string, unknown> = {}) => {
    if (["updateNativeSurface", "uiReady"].includes(operation)) return {};
    const result = await fixture.request(operation, params);
    return operation === "getEnvironment" ? { ...(result as object), platform: "ios", storage: "native" } : result;
  });
  await act(async () => { render(<WebAppearanceProvider><App /></WebAppearanceProvider>); });
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  await waitFor(() => expect(surface("chrome")?.bottom?.map(action => action.id)).toEqual(["search", "capture"]));
  return fixture;
}

it("mounts the native chrome from the default App and routes native navigation, search and back actions", async () => {
  await mount();
  expect(document.querySelector(".web-app[data-native-chrome=true]")).not.toBeNull();
  expect(document.querySelector(".web-app-header")).toBeNull();
  expect(screen.queryByRole("button", { name: "搜索全部笔记" })).toBeNull();
  expect(bridge.request).toHaveBeenCalledWith("uiReady");
  send("chrome", "navigation"); send("navigation", "tag:设计");
  await screen.findByRole("button", { name: "打开 让设计语言走进真实页面" });
  await waitFor(() => expect(surface("chrome")?.title).toBe("# 设计"));
  expect(surface("navigation")?.presented).toBe(false);
  send("chrome", "search");
  await waitFor(() => expect(surface("search")?.presented).toBe(true));
  send("search", "query", "咖啡");
  await waitFor(() => expect(surface("search")?.sections?.some(section => section.actions?.some(action => action.title === "今天的手冲记录"))).toBe(true));
  const note = surface("search")!.sections!.flatMap(section => section.actions ?? []).find(action => action.title === "今天的手冲记录")!;
  send("search", note.id);
  await screen.findByRole("textbox", { name: "笔记内容" });
  expect(surface("chrome")?.leading?.id).toBe("back");
  expect(screen.queryByRole("dialog", { name: "搜索笔记" })).toBeNull();
  send("chrome", "back");
  await waitFor(() => expect(surface("search")?.presented).toBe(true));
  expect(surface("search")?.sections?.[0].fields?.[0].value).toBe("咖啡");
});

it("keeps the native capture mounted and saves text into the controller's refreshed list", async () => {
  const fixture = await mount();
  send("chrome", "capture");
  await waitFor(() => expect(surface("capture")?.presented).toBe(true));
  expect(screen.queryByRole("dialog", { name: "快速记录" })).toBeNull();
  send("capture", "text", "原生统一界面快速记录"); send("capture", "record");
  await waitFor(() => expect(fixture.snapshot().notes.some(note => note.body === "原生统一界面快速记录")).toBe(true));
  await waitFor(() => expect(surface("capture")?.presented).toBe(false));
  const saved = fixture.snapshot().notes.find(note => note.body === "原生统一界面快速记录")!;
  await waitFor(() => expect(document.querySelector(`[data-note-id="${saved.id}"]`)).not.toBeNull());
});

it("routes a native search retry through the shared search controller without clearing its query", async () => {
  await mount();
  const implementation = bridge.request.getMockImplementation()!;
  let fail = true;
  bridge.request.mockImplementation(async (operation, params = {}) => {
    if (operation === "queryNotes" && params.query === "原生重试" && fail) { fail = false; throw new Error("搜索暂时失败"); }
    return implementation(operation, params);
  });
  send("chrome", "search");
  await waitFor(() => expect(surface("search")?.presented).toBe(true));
  send("search", "query", "原生重试");
  await waitFor(() => expect(surface("search")?.error).toBe("搜索暂时失败"));
  send("search", "retry");
  await waitFor(() => expect(surface("search")?.error).toBe(""));
  await waitFor(() => expect(surface("search")?.loading).toBe(false));
  expect(surface("search")?.sections?.[0].fields?.[0].value).toBe("原生重试");
  expect(bridge.request.mock.calls.filter(([operation, params]) => operation === "queryNotes" && params.query === "原生重试")).toHaveLength(2);
});


it("follows system appearance in both the Web document and native chrome", async () => {
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ theme: "system", radius: "large" }));
  await mount();
  expect(surface("chrome")?.theme).toBe("system");
  expect(document.querySelector(".web-app")?.getAttribute("data-ui-theme")).toBe("light");
  act(() => { systemDark = true; appearanceListeners.forEach(callback => callback()); });
  await waitFor(() => expect(document.querySelector(".web-app")?.getAttribute("data-ui-theme")).toBe("dark"));
  expect(document.documentElement.dataset.uiTheme).toBe("dark");
  expect(surface("chrome")?.theme).toBe("system");
  send("chrome", "navigation");
  expect(surface("navigation")?.rowRadius).toBe(14);
});

it("keeps the native home layout menu and visible collection on the same default and saved choice", async () => {
  await mount();
  send("chrome", "navigation"); send("navigation", "home");
  await waitFor(() => expect(surface("chrome")?.title).toBe("主页"));
  expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("list");
  expect(surface("chrome")?.titleMenu?.find(action => action.id === "list")?.selected).toBe(true);
  send("chrome", "cards");
  await waitFor(() => expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("cards"));
  expect(surface("chrome")?.titleMenu?.find(action => action.id === "cards")?.selected).toBe(true);
  expect(localStorage.getItem("memocard:home-layout")).toBe("cards");
  send("chrome", "list");
  await waitFor(() => expect(screen.getByRole("list", { name: "笔记列表" }).getAttribute("data-layout")).toBe("list"));
  expect(surface("chrome")?.titleMenu?.find(action => action.id === "list")?.selected).toBe(true);
});
