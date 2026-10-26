// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPortal } from "react-dom";
import type { AppViewState } from "../../src/App";
import { noteEditor } from "../../src/editor-test-utils";
import { defaults, options, STORAGE_KEY } from "../../src/features/typography/preferences";
import { FONT_FAMILIES } from "../../src/lib/font-options";
import { RichMarkdownEditor } from "../business/RichMarkdownEditor";
import { NoteMarkdown } from "../business/NoteMarkdown";
import { loadPreviewFonts } from "../preview-fonts";
import { WebAppearanceProvider } from "./WebAppearance";
import { WebSettings } from "./WebSettings";
import { WebTypographyProvider } from "./WebTypographyProvider";

vi.mock("../preview-fonts", async original => ({ ...await original<typeof import("../preview-fonts")>(), loadPreviewFonts: vi.fn().mockResolvedValue([]) }));

const state = () => ({ status: { connected: false, coverage: {} }, sidebar: {}, capabilities: new Set(), environment: null, unsupportedBrowser: true } as unknown as AppViewState);
let style: HTMLStyleElement;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("FontFace", class {});
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("scrollBy", vi.fn());
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  style = document.createElement("style");
  style.textContent = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "web-typography.css"), "utf8");
  document.head.append(style);
});
afterEach(() => {
  cleanup(); style.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  vi.mocked(loadPreviewFonts).mockClear();
  document.documentElement.removeAttribute("style");
});

async function choose(user: ReturnType<typeof userEvent.setup>, label: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
}

function mount(editor = false) {
  return render(<WebAppearanceProvider><WebTypographyProvider><WebSettings state={state()} />{editor && <div className="ui-note-editor"><textarea className="note-page-title" aria-label="页面标题" defaultValue="原标题" /><RichMarkdownEditor value="正文" notePath="notes/a.md" disabled={false} onChange={vi.fn()} onSave={vi.fn()} onError={vi.fn()} /></div>}</WebTypographyProvider></WebAppearanceProvider>);
}

it("activates the adapter for inline and portaled note content only while the Web provider is mounted", () => {
  render(<><NoteMarkdown body="# 独立业务组件" />{createPortal(<div className="ui-note-search-preview-content"><NoteMarkdown body="# Portal 预览" /></div>, document.body)}</>);
  const content = ["独立业务组件", "Portal 预览"].map(name => screen.getByRole("heading", { name }).closest(".ui-note-markdown")!);
  const originalWidths = content.map(element => getComputedStyle(element).maxWidth);
  for (const element of content) expect(getComputedStyle(element).getPropertyValue("--typeset-font-body")).toBe("");
  const web = render(<WebTypographyProvider><span>Web 页面</span></WebTypographyProvider>);
  for (const element of content) expect(getComputedStyle(element).getPropertyValue("--typeset-font-body")).toContain("--note-body-font");
  expect(getComputedStyle(content[1]).getPropertyValue("--typeset-size")).toContain("--font-size-sm");
  web.unmount();
  for (const [index, element] of content.entries()) {
    expect(getComputedStyle(element).getPropertyValue("--typeset-font-body")).toBe("");
    expect(getComputedStyle(element).getPropertyValue("--typeset-size")).toBe("");
    expect(getComputedStyle(element).maxWidth).toBe(originalWidths[index]);
  }
});

it("restores all seven existing note preferences and applies the CSS-free shared contract to real Typeset content", async () => {
  const value = { ...defaults, measure: "60", heading: "lora", body: "inter", mono: "jetbrains-mono", size: "18", leading: "1.9", flow: "2em" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  mount();
  for (const [label, text] of [["行宽", "窄"], ["笔记标题字体", "Lora"], ["笔记正文字体", "Inter"], ["笔记等宽字体", "JetBrains Mono"], ["字号", "18px 基准"], ["行高", "宽松（1.9）"], ["段落间距", "宽松（2em）"]]) expect(screen.getByRole("combobox", { name: label }).textContent).toBe(text);
  const root = document.documentElement.style;
  expect(root.getPropertyValue("--note-measure")).toBe("504px");
  expect(root.getPropertyValue("--note-size")).toBe("var(--font-size-lg)");
  expect(root.getPropertyValue("--note-heading-font")).toBe(FONT_FAMILIES.lora);
  expect(root.getPropertyValue("--note-mono-font")).toBe(FONT_FAMILIES["jetbrains-mono"]);
  const markdown = within(screen.getByRole("region", { name: "笔记排版预览" })).getByRole("heading", { name: "把一闪而过的想法留下来" }).closest(".ui-note-markdown")!;
  const computed = getComputedStyle(markdown);
  expect(computed.getPropertyValue("--typeset-font-body")).toContain("--note-body-font");
  expect(computed.getPropertyValue("--typeset-size")).toContain("--note-size");
  expect(computed.getPropertyValue("--typeset-leading")).toContain("--note-leading");
  expect(computed.getPropertyValue("--typeset-flow")).toContain("--note-flow");
  await waitFor(() => expect(loadPreviewFonts).toHaveBeenCalledWith(["inter", "lora", "jetbrains-mono"], false));
});

it("persists note styles independently, retains a live editor and undo history, and restores the same choices on remount", async () => {
  const user = userEvent.setup();
  const view = mount(true);
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const editor = noteEditor(field);
  await waitFor(() => expect(editor.getText()).toBe("正文"));
  act(() => editor.commands.insertContentAt(3, "修改"));
  const uiBody = document.documentElement.style.getPropertyValue("--ui-preview-body");
  const uiHeading = document.documentElement.style.getPropertyValue("--ui-preview-heading");
  await choose(user, "笔记正文字体", "Inter");
  await choose(user, "笔记标题字体", "Lora");
  await choose(user, "字号", "18px 基准");
  await choose(user, "行宽", "适中");
  await choose(user, "行高", "宽松（1.9）");
  await choose(user, "段落间距", "宽松（2em）");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ body: "inter", heading: "lora", measure: "70", size: "18", leading: "1.9", flow: "2em" });
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("594px");
  expect(document.documentElement.style.getPropertyValue("--ui-preview-body")).toBe(uiBody);
  expect(document.documentElement.style.getPropertyValue("--ui-preview-heading")).toBe(uiHeading);
  expect(screen.getByRole("textbox", { name: "笔记内容" })).toBe(field);
  expect(noteEditor(field)).toBe(editor);
  expect(getComputedStyle(field).getPropertyValue("--typeset-font-mono")).toContain("--note-mono-font");
  expect(getComputedStyle(screen.getByRole("textbox", { name: "页面标题" })).fontFamily).toContain("--note-heading-font");
  act(() => editor.commands.undo());
  expect(editor.getText()).toBe("正文");
  view.unmount();
  mount();
  expect(screen.getByRole("combobox", { name: "行宽" }).textContent).toBe("适中");
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("594px");
});

it("retains a proportional legacy code font while randomization uses only the original allowed options and reset leaves UI appearance intact", async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults, mono: "inter" }));
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ bodyFont: "geist", theme: "dark", radius: "none" }));
  mount();
  const mono = screen.getByRole("combobox", { name: "笔记等宽字体" });
  expect(mono.textContent).toBe("Inter（已有设置）");
  const user = userEvent.setup();
  await user.click(mono);
  expect((await screen.findByRole("option", { name: "Inter（已有设置）" })).getAttribute("aria-selected")).toBe("true");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  vi.spyOn(Math, "random").mockReturnValue(0);
  fireEvent.click(screen.getByRole("button", { name: "随机搭配" }));
  const randomized = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  for (const key of Object.keys(options) as (keyof typeof options)[]) expect(options[key]).toContain(randomized[key]);
  expect(randomized.mono).toBe("geist-mono");
  fireEvent.click(screen.getByRole("button", { name: "恢复默认风格" }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(defaults);
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("720px");
  expect(JSON.parse(localStorage.getItem("memocard-web-appearance-v1")!)).toMatchObject({ bodyFont: "geist", theme: "dark", radius: "none" });
});

it("syncs the existing typography storage key and reports a failed save without discarding the active choice", async () => {
  const user = userEvent.setup();
  mount();
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify({ ...defaults, measure: "60", leading: "1.75" }) })));
  expect(screen.getByRole("combobox", { name: "行宽" }).textContent).toBe("窄");
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("448px");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
  await choose(user, "字号", "18px 基准");
  expect(document.documentElement.style.getPropertyValue("--note-size")).toBe("var(--font-size-lg)");
  expect(screen.getByText("无法保存设置；当前已生效，重开后可能恢复默认。").getAttribute("role")).toBe("status");
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "invalid" })));
  expect(screen.getByRole("combobox", { name: "字号" }).textContent).toBe("16px 基准");
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("720px");
});
