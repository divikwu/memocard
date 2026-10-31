// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => { window.__memocardNativeChrome = false; return { request: vi.fn() }; });
vi.mock("../../src/bridge", () => ({
  request: bridge.request, reconnectVault: vi.fn(), isNative: true, isBrowserVault: false, isLocalWeb: false, isConnectedClient: true,
  errorMessage: (cause: unknown) => cause instanceof Error ? cause.message : "操作未完成",
}));
import { App } from "../../src/App";
import { createWorkspaceFixture } from "./workspace-fixture";
import { WebAppearanceProvider } from "./WebAppearance";
import { preloadWebEditor } from "./WebAppView";
import { MobileActionGroupProvider } from "../components/action-group";
import { Slider } from "../components/slider";

beforeAll(async () => { await Promise.all([preloadWebEditor(), import("../business/NoteSearchDialog")]); }, 30_000);
beforeEach(() => {
  localStorage.clear(); bridge.request.mockReset(); history.replaceState(null, "", "#/notes");
  document.elementFromPoint = () => null;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: vi.fn(async () => [{}]) } });
  vi.stubGlobal("innerWidth", 673);
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("max-width") && window.innerWidth < 768, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("scrollBy", vi.fn());
});
afterEach(async () => { cleanup(); await act(async () => {}); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])("gates the slider's mobile border recipe behind Web opt-in: %s", enabled => {
  const { container } = render(<MobileActionGroupProvider enabled={enabled}><Slider aria-label="字号" defaultValue={[50]} /></MobileActionGroupProvider>);
  const thumb = container.querySelector<HTMLElement>('[data-slot="slider-thumb"]')!;
  expect(thumb).not.toBeNull();
  expect(thumb.classList.contains("border-border")).toBe(true);
  expect(thumb.classList.contains("[@media(max-width:767px)]:border-(--color-border-floating)")).toBe(enabled);
});

it("keeps a narrow Mac native search Sheet outside Web mobile ActionGroup presentation", async () => {
  const fixture = await createWorkspaceFixture();
  bridge.request.mockImplementation(async (operation: string, params: Record<string, unknown> = {}) => {
    const result = await fixture.request(operation, params);
    return operation === "getEnvironment" ? { ...(result as object), platform: "mac", storage: "native" } : result;
  });
  const user = userEvent.setup();
  await act(async () => { render(<WebAppearanceProvider><App /></WebAppearanceProvider>); });
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  expect(document.querySelector(".web-app[data-native-chrome=true]")).toBeNull();
  const header = document.querySelector<HTMLElement>(".web-app-header")!;
  expect(header).not.toBeNull();
  expect(header.querySelector('[data-slot="action-group"]')).toBeNull();
  const navigation = within(header).getByRole("button", { name: "打开导航" });
  expect(navigation.parentElement).toBe(header.querySelector(".web-header-leading"));
  expect(header.querySelector(".web-header-actions")?.getAttribute("role")).toBeNull();
  expect(bridge.request).toHaveBeenCalledWith("uiReady");
  await user.click(screen.getByRole("button", { name: "搜索全部笔记" }));
  const search = await screen.findByRole("dialog", { name: "搜索笔记" });
  const close = within(search).getByRole("button", { name: "退出搜索" });
  expect(search.getAttribute("data-slot")).toBe("sheet-content");
  expect(search.querySelector('[data-slot="action-group"]')).toBeNull();
  expect(close.closest('[data-slot="action-group"]')).toBeNull();
  expect(close.getAttribute("data-action-group")).toBeNull();
  await user.click(close);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "搜索笔记" })).toBeNull());
  expect(bridge.request.mock.calls.some(([operation]) => ["saveNote", "saveDraft", "deleteNote"].includes(operation))).toBe(false);
});

it("keeps the desktop Mac header structure and original sidebar-trigger size classes", async () => {
  vi.stubGlobal("innerWidth", 1024);
  const fixture = await createWorkspaceFixture();
  bridge.request.mockImplementation(async (operation: string, params: Record<string, unknown> = {}) => {
    const result = await fixture.request(operation, params);
    return operation === "getEnvironment" ? { ...(result as object), platform: "mac", storage: "native" } : result;
  });
  const user = userEvent.setup();
  await act(async () => { render(<WebAppearanceProvider><App /></WebAppearanceProvider>); });
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
  await user.click(screen.getByRole("button", { name: "收起侧栏" }));
  const header = document.querySelector<HTMLElement>(".web-app-header")!;
  const navigation = await within(header).findByRole("button", { name: "展开侧栏" });
  expect(header.querySelector('[data-slot="action-group"]')).toBeNull();
  expect(navigation.parentElement).toBe(header.querySelector(".web-sidebar-logo"));
  expect(navigation.parentElement?.parentElement).toBe(header.querySelector(".web-header-leading"));
  expect(navigation.parentElement?.querySelector("img")?.getAttribute("alt")).toBe("");
  // jsdom does not apply the UI stylesheet; size=icon remains the HEAD 36px token.
  expect(navigation.classList.contains("size-element-md")).toBe(true);
  expect(header.querySelector(".web-header-actions")?.getAttribute("role")).toBeNull();
  expect(header.querySelector(".web-header-actions")?.parentElement).toBe(header);
  await user.click(screen.getByRole("button", { name: "打开 今天的手冲记录" }));
  await screen.findByRole("textbox", { name: "笔记内容" });
  expect(within(header).queryByRole("button", { name: "返回笔记列表" })).toBeNull();
  expect(within(header).getByRole("button", { name: "展开侧栏" })).toBe(navigation);
  await user.click(within(within(header).getByRole("navigation", { name: "当前位置" })).getByRole("button", { name: "所有笔记" }));
  await screen.findByRole("button", { name: "打开 今天的手冲记录" });
});
