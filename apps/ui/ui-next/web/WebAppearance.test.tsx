// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AppViewState } from "../../src/App";
import { noteEditor } from "../../src/editor-test-utils";
import { RichMarkdownEditor } from "../business/RichMarkdownEditor";
import { PREVIEW_FONTS, getPreviewFont, loadPreviewFonts } from "../preview-fonts";
import { DEFAULT_WEB_APPEARANCE, WebAppearanceProvider, useWebAppearance } from "./WebAppearance";
import { WebSettings } from "./WebSettings";

vi.mock("../preview-fonts", async original => ({ ...await original<typeof import("../preview-fonts")>(), loadPreviewFonts: vi.fn().mockResolvedValue(undefined) }));
const key = "memocard-web-appearance-v1";
let media: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
let changeSystem: () => void;
beforeEach(() => {
  localStorage.clear();
  media = { matches: false, addEventListener: vi.fn((_event, listener) => { changeSystem = listener; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn((query: string) => query.includes("prefers-color-scheme") ? media : { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("scrollBy", vi.fn());
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.mocked(loadPreviewFonts).mockReset().mockResolvedValue([]);
  delete document.documentElement.dataset.uiTheme; delete document.documentElement.dataset.uiNextAppearance; document.documentElement.removeAttribute("style");
});
function Controls() {
  const appearance = useWebAppearance()!;
  return <><pre aria-label="当前设置">{JSON.stringify(appearance.value)}</pre><button onClick={() => appearance.onChange({ ...appearance.value, theme: "system" })}>跟随系统</button><button onClick={() => appearance.onChange({ ...appearance.value, theme: "light" })}>浅色</button><button onClick={() => appearance.onChange({ ...appearance.value, radius: "none" })}>无圆角</button><button onClick={() => appearance.onChange({ ...appearance.value, palette: "blue", neutralPalette: "slate" })}>冷灰蓝色</button><button onClick={appearance.resetAppearance}>恢复默认</button>{appearance.persistenceError && <p role="status">保存失败</p>}</>;
}
function receive(value: unknown, storage: Storage = localStorage, storageKey: string | null = key) {
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: storageKey, newValue: value === null ? null : JSON.stringify(value), storageArea: storage })));
}

it("uses validated defaults for corrupt storage and keeps session controls working when saving is denied", () => {
  localStorage.setItem(key, "not-json");
  render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  expect(JSON.parse(screen.getByLabelText("当前设置").textContent!)).toEqual(DEFAULT_WEB_APPEARANCE);
  const denied = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota exceeded", "QuotaExceededError"); });
  fireEvent.click(screen.getByRole("button", { name: "无圆角" }));
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-radius")).toBe("0rem");
  expect(screen.getByRole("status").textContent).toBe("保存失败");
  denied.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: /^浅色$/ }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!).radius).toBe("none");
});

it("reports denied initial storage access and recovers persistence on a later choice", () => {
  const denied = vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  expect(screen.getByRole("status").textContent).toBe("保存失败");
  expect(document.documentElement.dataset.uiTheme).toBe("light");
  denied.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "无圆角" }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!).radius).toBe("none");
});

it("tracks OS changes only for system theme and removes the media subscription on unmount", () => {
  media.matches = true;
  localStorage.setItem(key, JSON.stringify({ theme: "system" }));
  const view = render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  expect(document.documentElement.dataset.uiTheme).toBe("dark");
  act(() => { media.matches = false; changeSystem(); });
  expect(document.documentElement.dataset.uiTheme).toBe("light");
  fireEvent.click(screen.getByRole("button", { name: /^浅色$/ }));
  act(() => { media.matches = true; changeSystem(); });
  expect(document.documentElement.dataset.uiTheme).toBe("light");
  fireEvent.click(screen.getByRole("button", { name: "跟随系统" }));
  expect(document.documentElement.dataset.uiTheme).toBe("dark");
  view.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", changeSystem);
});

it("syncs this local-storage key across tabs, ignores other storage, and resets after clear", () => {
  render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  receive({ theme: "dark", radius: "large", headingFont: "inherit", bodyFont: "geist" });
  expect(document.documentElement.dataset.uiTheme).toBe("dark");
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-body")).toContain("Geist Variable");
  receive({ theme: "light" }, sessionStorage);
  receive({ theme: "light" }, localStorage, "unrelated-key");
  expect(document.documentElement.dataset.uiTheme).toBe("dark");
  receive(null, localStorage, null);
  expect(JSON.parse(screen.getByLabelText("当前设置").textContent!)).toEqual(DEFAULT_WEB_APPEARANCE);
  receive({ theme: "unknown", radius: "999px", bodyFont: "url(evil)" });
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-radius")).toBe("0.5rem");
});

it("ignores storage events safely if browser permissions revoke access after mounting", () => {
  const area = localStorage;
  render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
  const error = vi.fn((event: ErrorEvent) => event.preventDefault());
  window.addEventListener("error", error);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key, newValue: '{"theme":"dark"}', storageArea: area })));
  window.removeEventListener("error", error);
  expect(error).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.uiTheme).toBe("light");
});

it("preserves a real editor instance, focus and undo when another tab changes appearance and fonts fail", async () => {
  vi.mocked(loadPreviewFonts).mockRejectedValue(new Error("Font offline"));
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<WebAppearanceProvider><WebSettings state={settingsState()} /><RichMarkdownEditor value="正文" notePath="notes/a.md" disabled={false} onChange={vi.fn()} onSave={vi.fn()} onError={vi.fn()} /></WebAppearanceProvider>);
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const editor = noteEditor(field);
  await waitFor(() => expect(editor.getText()).toBe("正文"));
  act(() => { editor.commands.insertContentAt(3, "修改"); field.focus(); });
  receive({ theme: "dark", radius: "medium", bodyFont: "geist", headingFont: "inherit" });
  expect(screen.getByRole("textbox", { name: "笔记内容" })).toBe(field);
  expect(noteEditor(field)).toBe(editor);
  expect(document.activeElement).toBe(field);
  const retry = await screen.findByRole("button", { name: "重试加载字体" }, { timeout: 5000 });
  expect(errors).toHaveBeenCalledWith(expect.stringContaining("字体加载失败"), expect.any(Error));
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-body")).toBe(PREVIEW_FONTS.find(font => font.id === "geist")!.fontFamily);
  expect(screen.getByRole("status").textContent).toContain("当前使用回退字体");
  vi.mocked(loadPreviewFonts).mockResolvedValue([]);
  fireEvent.click(retry);
  await waitFor(() => expect(screen.queryByText("所选字体暂时无法加载，当前使用回退字体。")).toBeNull());
  await waitFor(() => expect(screen.queryByText("正在加载所选字体，当前使用回退字体。")).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "正文字体" }));
  expect(noteEditor(field)).toBe(editor);
  act(() => { editor.commands.undo(); });
  expect(editor.getText()).toBe("正文");
});

it("ignores a failed older font request after a newer appearance has loaded", async () => {
  let rejectPrevious!: (error: Error) => void;
  vi.mocked(loadPreviewFonts).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPrevious = reject; }));
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<WebAppearanceProvider><WebSettings state={settingsState()} /></WebAppearanceProvider>);
  receive({ bodyFont: "geist" });
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  await act(async () => { rejectPrevious(new Error("Old font failed")); });
  expect(errors).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).toBeNull();
});

const settingsState = () => ({
  status: { connected: true, vaultName: "测试笔记库", coverage: { indexed: 3, pending: 1, issues: 2, indexedAt: "2026-10-22T08:12:00Z" } },
  sidebar: { canChooseVault: true, canCreateVault: true, onSelectVault: vi.fn() }, working: false, editor: null,
  capabilities: new Set(), environment: null, unsupportedBrowser: false,
} as unknown as AppViewState);

it("exposes native labelled appearance selectors and restores the last indexed timestamp", async () => {
  const user = userEvent.setup();
  render(<WebAppearanceProvider><WebSettings state={settingsState()} /></WebAppearanceProvider>);
  await user.selectOptions(screen.getByRole("combobox", { name: "主题" }), "system");
  await user.click(screen.getByText("高级外观"));
  await user.selectOptions(screen.getByRole("combobox", { name: "正文字体" }), "geist");
  await user.selectOptions(screen.getByRole("combobox", { name: "标题字体" }), "inherit");
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ theme: "system", bodyFont: "geist", headingFont: "inherit" });
  expect((screen.getByRole("combobox", { name: "正文字体" }) as HTMLSelectElement).tagName).toBe("SELECT");
  fireEvent.click(screen.getByText("本机文件状态"));
  expect(screen.getByText("最近索引时间").nextElementSibling?.querySelector("time")?.dateTime).toBe("2026-10-22T08:12:00Z");
});

it("hides unsupported folder-picking actions in settings", () => {
  render(<WebAppearanceProvider><WebSettings state={{ ...settingsState(), unsupportedBrowser: true }} /></WebAppearanceProvider>);
  expect(screen.queryByRole("button", { name: "打开已有笔记库" })).toBeNull();
  expect(screen.queryByRole("button", { name: "创建笔记库" })).toBeNull();
});

it.each([
  ["xs", "legacy-xs", "0.25rem", "pingfang"], ["sm", "legacy-sm", "0.375rem", "songti"],
  ["md", "default", "0.5rem", "noto-sans-sc"], ["lg", "medium", "0.625rem", "geist"],
  ["xl", "legacy-xl", "0.75rem", "inter"], ["2xl", "legacy-2xl", "1rem", "noto-sans"],
] as const)("retains existing %s radius and legacy font preferences when the Web key is absent", (radius, expected, rem, bodyFont) => {
  const legacy = { radius, bodyFont, headingFont: "songti", theme: "system", palette: "blue", neutralPalette: "slate" };
  localStorage.setItem("memocard-appearance-v1", JSON.stringify(legacy));
  render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  expect(JSON.parse(screen.getByLabelText("当前设置").textContent!)).toMatchObject({ ...legacy, radius: expected });
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-radius")).toBe(rem);
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-body")).toBe(getPreviewFont(bodyFont).fontFamily);
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-heading")).toBe(getPreviewFont("songti").fontFamily);
  expect(document.documentElement.dataset.webPalette).toBe("blue");
  expect(document.documentElement.dataset.webNeutral).toBe("slate");
  expect(localStorage.getItem(key)).toBeNull();
  expect(JSON.parse(localStorage.getItem("memocard-appearance-v1")!)).toEqual(legacy);
});

it("persists palette choices and resets to confirmed Luma defaults without erasing legacy preferences", () => {
  localStorage.setItem("memocard-appearance-v1", JSON.stringify({ palette: "green", radius: "2xl", bodyFont: "pingfang" }));
  const view = render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  fireEvent.click(screen.getByRole("button", { name: "冷灰蓝色" }));
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ palette: "blue", neutralPalette: "slate", radius: "legacy-2xl" });
  fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(DEFAULT_WEB_APPEARANCE);
  expect(document.documentElement.dataset.webPalette).toBe("mono");
  expect(document.documentElement.dataset.webNeutral).toBe("neutral");
  view.unmount();
  expect(document.documentElement.dataset.webPalette).toBeUndefined();
  render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  expect(JSON.parse(screen.getByLabelText("当前设置").textContent!)).toEqual(DEFAULT_WEB_APPEARANCE);
  expect(JSON.parse(localStorage.getItem("memocard-appearance-v1")!)).toMatchObject({ palette: "green", radius: "2xl" });
});

it("ignores later legacy edits after a new preference is saved, but falls back when that key is deleted", () => {
  localStorage.setItem("memocard-appearance-v1", JSON.stringify({ palette: "lime", radius: "xs" }));
  localStorage.setItem(key, JSON.stringify({ palette: "cyan", radius: "large" }));
  render(<WebAppearanceProvider><Controls /></WebAppearanceProvider>);
  receive({ palette: "blue" }, localStorage, "memocard-appearance-v1");
  expect(JSON.parse(screen.getByLabelText("当前设置").textContent!)).toMatchObject({ palette: "cyan", radius: "large" });
  localStorage.removeItem(key);
  receive(null);
  expect(JSON.parse(screen.getByLabelText("当前设置").textContent!)).toMatchObject({ palette: "lime", radius: "legacy-xs" });
  receive({ palette: "green", radius: "xl" }, localStorage, "memocard-appearance-v1");
  expect(JSON.parse(screen.getByLabelText("当前设置").textContent!)).toMatchObject({ palette: "green", radius: "legacy-xl" });
});

it("connects all eight palette choices, both neutral choices and reset to the real settings controls", async () => {
  const user = userEvent.setup();
  render(<WebAppearanceProvider><WebSettings state={settingsState()} /></WebAppearanceProvider>);
  const palette = screen.getByRole("combobox", { name: "强调色" });
  expect(within(palette).getAllByRole("option")).toHaveLength(8);
  for (const value of ["lime", "green", "emerald", "teal", "cyan", "sky", "blue", "mono"]) {
    await user.selectOptions(palette, value);
    expect(document.documentElement.dataset.webPalette).toBe(value);
    expect(JSON.parse(localStorage.getItem(key)!).palette).toBe(value);
  }
  await user.click(screen.getByText("高级外观"));
  const neutral = screen.getByRole("combobox", { name: "中性色" });
  expect(within(neutral).getAllByRole("option")).toHaveLength(2);
  for (const value of ["slate", "neutral"]) {
    await user.selectOptions(neutral, value);
    expect(document.documentElement.dataset.webNeutral).toBe(value);
  }
  await user.selectOptions(palette, "blue");
  await user.click(screen.getByRole("button", { name: /^恢复默认$/ }));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(DEFAULT_WEB_APPEARANCE);
});

it("shows existing font and radius values as real current options before the user changes them", async () => {
  localStorage.setItem("memocard-appearance-v1", JSON.stringify({ radius: "xs", headingFont: "songti", bodyFont: "pingfang" }));
  const user = userEvent.setup();
  render(<WebAppearanceProvider><WebSettings state={settingsState()} /></WebAppearanceProvider>);
  await user.click(screen.getByText("高级外观"));
  const radius = screen.getByRole("combobox", { name: "圆角" });
  const heading = screen.getByRole("combobox", { name: "标题字体" });
  const body = screen.getByRole("combobox", { name: "正文字体" });
  expect(radius).toHaveProperty("value", "legacy-xs");
  expect(heading).toHaveProperty("value", "songti");
  expect(body).toHaveProperty("value", "pingfang");
  expect(within(body).getByRole("option", { name: /已有设置/ })).toHaveProperty("selected", true);
  await user.selectOptions(radius, "default");
  expect(JSON.parse(localStorage.getItem(key)!)).toMatchObject({ radius: "default", headingFont: "songti", bodyFont: "pingfang" });
  expect(document.documentElement.style.getPropertyValue("--ui-next-preview-radius")).toBe("0.5rem");
});
