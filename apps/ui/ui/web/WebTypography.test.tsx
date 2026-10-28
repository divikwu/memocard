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
import { defaults, STORAGE_KEY } from "../../src/features/typography/preferences";
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
  for (const element of content) expect(getComputedStyle(element).getPropertyValue("--typeset-font-body")).toContain("--font-family-body");
  expect(getComputedStyle(content[1]).getPropertyValue("--typeset-size")).toContain("--font-size-sm");
  web.unmount();
  for (const [index, element] of content.entries()) {
    expect(getComputedStyle(element).getPropertyValue("--typeset-font-body")).toBe("");
    expect(getComputedStyle(element).getPropertyValue("--typeset-size")).toBe("");
    expect(getComputedStyle(element).maxWidth).toBe(originalWidths[index]);
  }
});

it("restores reading layout, ignores retired font choices and uses UI font roles for real Typeset content", async () => {
  const value = { ...defaults, measure: "60", heading: "lora", body: "inter", mono: "jetbrains-mono", size: "18", leading: "1.9", flow: "2em" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  mount();
  fireEvent.click(screen.getByText("高级排版"));
  for (const [label, text] of [["行宽", "窄"], ["字号", "标准（16px）"], ["行高", "更宽松（30px）"], ["段落间距", "随字号（2em）"]]) expect(screen.getByRole("combobox", { name: label }).textContent).toBe(text);
  const root = document.documentElement.style;
  expect(root.getPropertyValue("--note-measure")).toBe("448px");
  expect(root.getPropertyValue("--note-size")).toBe("var(--font-size-base)");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).size).toBe("16");
  for (const label of ["笔记标题字体", "笔记正文字体", "笔记等宽字体"]) expect(screen.queryByRole("combobox", { name: label })).toBeNull();
  expect(within(screen.getByRole("region", { name: "内容风格" })).getAllByRole("combobox")).toHaveLength(4);
  for (const role of ["body", "heading", "mono"]) expect(root.getPropertyValue(`--note-${role}-font`)).toBe("");
  const markdown = within(screen.getByRole("region", { name: "笔记排版预览" })).getByRole("heading", { name: "把一闪而过的想法留下来" }).closest(".ui-note-markdown")!;
  const computed = getComputedStyle(markdown);
  expect(computed.getPropertyValue("--typeset-font-body")).toContain("--font-family-body");
  expect(computed.getPropertyValue("--typeset-size")).toContain("--note-size");
  expect(computed.getPropertyValue("--typeset-leading")).toContain("--note-leading");
  expect(computed.getPropertyValue("--typeset-flow")).toContain("--note-flow");
  await waitFor(() => expect(loadPreviewFonts).toHaveBeenCalled());
  const loaded = vi.mocked(loadPreviewFonts).mock.calls.flatMap(([fonts]) => fonts);
  for (const retired of ["inter", "lora", "jetbrains-mono"]) expect(loaded).not.toContain(retired);
});

it("persists note styles independently, retains a live editor and undo history, and restores the same choices on remount", async () => {
  const user = userEvent.setup();
  const view = mount(true);
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const editor = noteEditor(field);
  await waitFor(() => expect(editor.getText()).toBe("正文"));
  act(() => editor.commands.insertContentAt(3, "修改"));
  await user.click(screen.getByText("高级外观"));
  await choose(user, "正文字体", "系统默认");
  await choose(user, "标题字体", "Noto Serif");
  expect(document.documentElement.style.getPropertyValue("--ui-preview-body")).toContain("system-ui");
  expect(document.documentElement.style.getPropertyValue("--ui-preview-heading")).toContain("Noto Serif Variable");
  const uiBody = document.documentElement.style.getPropertyValue("--ui-preview-body");
  const uiHeading = document.documentElement.style.getPropertyValue("--ui-preview-heading");
  await choose(user, "字号", "小字号（14px）");
  await choose(user, "行宽", "适中");
  await user.click(screen.getByText("高级排版"));
  await choose(user, "行高", "更宽松（28px）");
  await choose(user, "段落间距", "随字号（2em）");
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ measure: "70", size: "14", leading: "1.9", flow: "2em" });
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("528px");
  expect(document.documentElement.style.getPropertyValue("--ui-preview-body")).toBe(uiBody);
  expect(document.documentElement.style.getPropertyValue("--ui-preview-heading")).toBe(uiHeading);
  expect(screen.getByRole("textbox", { name: "笔记内容" })).toBe(field);
  expect(noteEditor(field)).toBe(editor);
  expect(getComputedStyle(field).getPropertyValue("--typeset-font-mono")).toContain("--font-family-code");
  expect(getComputedStyle(screen.getByRole("textbox", { name: "页面标题" })).fontFamily).toContain("--font-family-heading");
  act(() => editor.commands.undo());
  expect(editor.getText()).toBe("正文");
  view.unmount();
  mount();
  expect(screen.getByRole("combobox", { name: "行宽" }).textContent).toBe("适中");
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("528px");
});

it("offers two sizes and advanced rhythm choices, and resets without changing UI appearance", async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults, size:"14", leading:"1.9", flow:"2em" }));
  localStorage.setItem("memocard-web-appearance-v1", JSON.stringify({ bodyFont: "geist", theme: "dark", radius: "none" }));
  mount();
  expect(screen.queryByRole("button",{name:"随机搭配"})).toBeNull();
  const section=screen.getByRole("region", {name:"内容风格"});
  expect(section.querySelector("details")?.open).toBe(false);
  expect(within(section.querySelector('[data-slot="card"]')!).getAllByRole("combobox")).toHaveLength(2);
  const user=userEvent.setup();
  await user.click(screen.getByRole("combobox",{name:"字号"}));
  expect((await screen.findAllByRole("option")).map(el=>el.textContent)).toEqual(["小字号（14px）","标准（16px）"]);
  await user.keyboard("{Escape}");
  fireEvent.click(screen.getByRole("button", { name: "恢复默认风格" }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(defaults);
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("720px");
  expect(document.documentElement.style.getPropertyValue("--note-leading")).toBe("1.5");
  expect(document.documentElement.style.getPropertyValue("--note-flow")).toBe("16px");
  expect(JSON.parse(localStorage.getItem("memocard-web-appearance-v1")!)).toMatchObject({ bodyFont: "geist", theme: "dark", radius: "none" });
});

it("labels each leading preset with its even pixel height for the selected size", async () => {
  mount();
  const user = userEvent.setup();
  await user.click(screen.getByText("高级排版"));
  for (const [size, labels] of [["小字号（14px）", ["标准（22px）", "舒适（24px）", "宽松（26px）", "更宽松（28px）"]], ["标准（16px）", ["标准（24px）", "舒适（26px）", "宽松（28px）", "更宽松（30px）"]]] as const) {
    await choose(user, "字号", size);
    await user.click(screen.getByRole("combobox", { name: "行高" }));
    expect((await screen.findAllByRole("option")).map(option => option.textContent)).toEqual(labels);
    await user.keyboard("{Escape}");
  }
});

it("syncs the existing typography storage key and reports a failed save without discarding the active choice", async () => {
  const user = userEvent.setup();
  mount();
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify({ ...defaults, measure: "60", leading: "1.75" }) })));
  expect(screen.getByRole("combobox", { name: "行宽" }).textContent).toBe("窄");
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("448px");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
  await choose(user, "字号", "小字号（14px）");
  expect(document.documentElement.style.getPropertyValue("--note-size")).toBe("var(--font-size-sm)");
  expect(screen.getByText("无法保存设置；当前已生效，重开后可能恢复默认。").getAttribute("role")).toBe("status");
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "invalid" })));
  expect(screen.getByRole("combobox", { name: "字号" }).textContent).toBe("标准（16px）");
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("720px");
});
