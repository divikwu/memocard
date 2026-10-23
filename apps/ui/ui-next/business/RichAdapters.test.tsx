// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import { RichMarkdownEditor } from "./RichMarkdownEditor";

vi.mock("../../src/bridge", () => ({ isBrowserVault: false, isLocalWeb: false, isNative: false, isConnectedClient: false, request: vi.fn(), getBrowserVaultBinding: () => null }));
beforeEach(() => {
  vi.stubGlobal('DragEvent', MouseEvent);
  vi.stubGlobal("scrollBy", vi.fn());
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function setup(value: string) {
  const change = vi.fn();
  render(<RichMarkdownEditor value={value} disabled={false} notePath="notes/a.md" onChange={change} onSave={vi.fn()} onError={vi.fn()} />);
  const field = await screen.findByRole("textbox", { name: "笔记内容" });
  const editor = (field as HTMLDivElement & { editor: Editor }).editor;
  vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({ left: 60, right: 160, top: 100, bottom: 126 });
  await waitFor(() => expect(editor.getText()).toContain("开头"));
  return { editor, field, change };
}

async function chooseColor(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "内容块操作" }));
  await act(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  act(() => screen.getByRole("menuitem", { name: "颜色" }).focus());
  await userEvent.setup().keyboard("{ArrowRight}");
  const menu = await screen.findByRole("menu", { name: "标注颜色" });
  expect(menu.classList.contains("next-rich-ui")).toBe(true);
  fireEvent.click(within(menu).getByRole("menuitemradio", { name }));
  await waitFor(() => expect(screen.queryByRole("menu", { name: "标注颜色" })).toBeNull());
}

it("edits a custom grapheme icon without moving the caret and preserves undo and reopening", async () => {
  const original = '开头\n\n<aside data-callout="blue" data-callout-icon="ℹ️"><p><strong>标题</strong></p><ul><li>正文</li></ul></aside>\n\n结尾';
  const { editor, field, change } = await setup(original);
  act(() => editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize + 3));
  const selection = editor.state.selection.toJSON();
  fireEvent.click(screen.getByRole("button", { name: "更改标注图标" }));
  const input = await screen.findByRole("textbox", { name: "搜索 Emoji" }, { timeout: 5000 });
  await waitFor(() => expect(document.activeElement).toBe(input));
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "🧑🏽‍💻" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标注图标" })).toBeNull());
  const saved = change.mock.lastCall![0] as string;
  expect(saved).toContain("🧑🏽‍💻");
  expect(saved).not.toContain("next-rich-ui");
  expect(field.querySelector("aside strong")?.textContent).toBe("标题");
  expect(editor.state.selection.toJSON()).toEqual(selection);
  act(() => editor.commands.undo());
  expect(change).toHaveBeenLastCalledWith(original);
  cleanup();
  expect((await setup(saved)).field.querySelector("aside")?.getAttribute("data-callout-icon")).toBe("🧑🏽‍💻");
});

it("searches common icons, clears them, and returns keyboard focus on Escape without writing", async () => {
  const { field, change } = await setup('开头\n\n<aside data-callout="gray" data-callout-icon="💡"><p>正文</p></aside>');
  fireEvent.click(screen.getByRole("button", { name: "更改标注图标" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "搜索 Emoji" }), { target: { value: "警告" } });
  fireEvent.click(screen.getByRole("button", { name: "警告、小心" }));
  expect(field.querySelector("aside")?.getAttribute("data-callout-icon")).toBe("⚠️");
  fireEvent.click(screen.getByRole("button", { name: "更改标注图标" }));
  await screen.findByRole("textbox", { name: "搜索 Emoji" });
  fireEvent.click(screen.getByRole("button", { name: "清除图标" }));
  expect(field.querySelector("aside")?.hasAttribute("data-callout-icon")).toBe(false);
  const trigger = screen.getByRole("button", { name: "添加标注图标" });
  act(() => trigger.focus()); fireEvent.click(trigger);
  await screen.findByRole("textbox", { name: "搜索 Emoji" });
  const count = change.mock.calls.length;
  await userEvent.setup().keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标注图标" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(change).toHaveBeenCalledTimes(count);
});

it("changes callout text/background independently and resets colors without losing icon or content", async () => {
  const original = '开头\n\n<aside data-callout="blue" data-callout-icon="🧭"><p><strong>标题</strong></p><ul><li>正文</li></ul></aside>';
  const { editor, field, change } = await setup(original);
  act(() => editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize + 2));
  await chooseColor("紫色背景");
  const purple = change.mock.lastCall![0];
  await chooseColor("棕色文字");
  const saved = change.mock.lastCall![0] as string;
  expect(field.querySelector("aside")?.getAttribute("data-callout")).toBe("purple");
  expect(field.querySelector("aside")?.getAttribute("data-callout-text-color")).toBe("brown");
  expect(field.querySelector("aside strong")?.textContent).toBe("标题");
  act(() => editor.commands.undo()); expect(change).toHaveBeenLastCalledWith(purple);
  act(() => editor.commands.undo()); expect(change).toHaveBeenLastCalledWith(original);
  cleanup();
  const reopened = await setup(saved);
  act(() => reopened.editor.commands.setTextSelection(reopened.editor.state.doc.firstChild!.nodeSize + 2));
  await chooseColor("默认文字"); await chooseColor("默认背景");
  expect(reopened.field.querySelector("aside")?.hasAttribute("data-callout-text-color")).toBe(false);
  expect(reopened.field.querySelector("aside")?.getAttribute("data-callout")).toBe("default");
  expect(reopened.field.querySelector("aside")?.getAttribute("data-callout-icon")).toBe("🧭");
  expect(reopened.field.querySelectorAll("aside li")).toHaveLength(1);
});

it("keeps Mermaid source editable across preview modes and saves fences without rendered UI", async () => {
  const source = "flowchart TD\nA[开始] --> B[完成]";
  const ordinary = "```typescript\nconst n = 1;\n```";
  const { editor, field, change } = await setup(`开头\n\n\`\`\`mermaid\n${source}\n\`\`\`\n\n${ordinary}`);
  await screen.findByRole("button", { name: "放大 Mermaid 图表" });
  const code = field.querySelector("pre code.language-mermaid");
  expect(code?.textContent).toBe(source);
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab", { name: "仅图形" }));
  expect(code?.closest<HTMLElement>(".note-mermaid-source")?.hidden).toBe(true);
  fireEvent.click(screen.getByRole("tab", { name: "仅源码" }));
  expect(field.querySelector("pre code.language-mermaid")).toBe(code);
  let pos = 0;
  editor.state.doc.descendants((node, at) => { if (node.type.name === "codeBlock" && node.attrs.language === "mermaid") pos = at + node.nodeSize - 2; });
  act(() => editor.commands.insertContentAt(pos, "新"));
  const saved = change.mock.lastCall![0] as string;
  expect(saved).toContain(ordinary); expect(saved).not.toContain("<svg"); expect(saved).not.toContain("note-mermaid-next");
  fireEvent.click(screen.getByRole("tab", { name: "源码与图形" }));
  await waitFor(() => expect(screen.getByRole("img", { name: "Mermaid 图表" }).shadowRoot?.textContent).toContain("完成新"));
  cleanup();
  const reopened = await setup(saved);
  expect(reopened.field.querySelector("pre code.language-mermaid")?.textContent).toContain("完成新");
  expect(reopened.field.querySelector("pre code.language-typescript")?.textContent).toBe("const n = 1;");
});

it("joins images through the menu, splits a row, and restores each operation with undo", async () => {
  const original = "开头\n\n![甲](../assets/a.png)\n\n![乙](../assets/b.png)\n\n结束";
  const { editor, field, change } = await setup(original);
  fireEvent.click(await screen.findByRole("button", { name: "图片布局 甲" }));
  const menu = await screen.findByRole("menu", { name: "图片布局" });
  expect(menu.classList.contains("next-rich-ui")).toBe(true);
  fireEvent.click(within(menu).getByRole("menuitem", { name: "与下一行并排" }));
  await waitFor(() => expect(field.querySelectorAll("figure img")).toHaveLength(2));
  const joined = change.mock.lastCall![0];
  act(() => editor.commands.undo()); expect(change).toHaveBeenLastCalledWith(original);
  act(() => editor.commands.redo()); expect(change).toHaveBeenLastCalledWith(joined);
  fireEvent.click(await screen.findByRole("button", { name: "图片布局 甲" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "全部拆为单行" }));
  expect(field.querySelectorAll("figure img")).toHaveLength(0);
  await waitFor(() => expect([...field.querySelectorAll("img")].map(image => image.getAttribute("alt"))).toEqual(["甲", "乙"]));
  act(() => editor.commands.undo()); expect(change).toHaveBeenLastCalledWith(joined);
});

it("keeps image menu operations attached to the mapped image after preceding edits", async () => {
  const { editor, field } = await setup("开头\n\n![甲](../assets/a.png)\n\n![乙](../assets/b.png)\n\n结束");
  fireEvent.click(screen.getByRole("button", { name: "图片布局 甲" }));
  await screen.findByRole("menuitem", { name: "与下一行并排" });
  act(() => editor.commands.insertContentAt(2, "新增文字"));
  fireEvent.click(screen.getByRole("menuitem", { name: "与下一行并排" }));
  await waitFor(() => expect([...field.querySelectorAll("figure img")].map(image => image.getAttribute("alt"))).toEqual(["甲", "乙"]));
  expect(editor.getText()).toContain("开新增文字头");
});

it("scopes image drop feedback outside the editor and consumes cancelled/stale drops", async () => {
  const original = "开头\n\n![甲](../assets/a.png)\n\n![乙](../assets/b.png)";
  const { editor, field, change } = await setup(original);
  field.getBoundingClientRect = () => new DOMRect(0, 0, 700, 800);
  const target = screen.getByRole('img', { name: '乙' }).closest('.rich-image')!;
  target.getBoundingClientRect = () => new DOMRect(0, 400, 300, 200);
  const transfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
  const start = () => { fireEvent.mouseMove(screen.getByRole('button', { name: '查看大图 甲' })); fireEvent.dragStart(screen.getByRole('button', { name: '内容块操作' }), { dataTransfer: transfer }); };
  start(); fireEvent.dragOver(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  const guide = document.querySelector('.rich-image-drop-guide');
  expect(guide?.parentElement).toBe(document.body);
  expect(guide?.classList.contains('next-rich-ui')).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' }); fireEvent.drop(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  expect(change).not.toHaveBeenCalled(); expect(document.querySelector('.rich-image-drop-guide')).toBeNull();
  start(); act(() => editor.commands.insertContentAt(2, '新')); const changed = change.mock.lastCall![0];
  fireEvent.drop(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  expect(change).toHaveBeenLastCalledWith(changed);
  act(() => editor.commands.undo()); start(); fireEvent.drop(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  await waitFor(() => expect(field.querySelectorAll('figure img')).toHaveLength(2));
  act(() => editor.commands.undo()); expect(change).toHaveBeenLastCalledWith(original);
});

it("drags the next image surface and restores the moved row with undo", async () => {
  const original = "开头\n\n![甲](../assets/a.png)\n\n![乙](../assets/b.png)";
  const { editor, field, change } = await setup(original);
  field.getBoundingClientRect = () => new DOMRect(0, 0, 700, 800);
  const source = screen.getByRole('img', { name: '甲' });
  const target = screen.getByRole('img', { name: '乙' }).closest('.rich-image')!;
  target.getBoundingClientRect = () => new DOMRect(0, 400, 300, 200);
  const transfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
  expect(source.draggable).toBe(true);
  fireEvent.dragStart(source, { dataTransfer: transfer });
  expect(transfer.setData).toHaveBeenCalledWith('application/x-memocard-image', 'move');
  fireEvent.drop(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  await waitFor(() => expect(field.querySelectorAll('figure img')).toHaveLength(2));
  act(() => editor.commands.undo()); expect(change).toHaveBeenLastCalledWith(original);
});
