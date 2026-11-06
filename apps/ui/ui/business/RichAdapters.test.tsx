// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";
import { RichMarkdownEditor } from "./RichMarkdownEditor";
import { notionClipboardType } from "../../src/rich-notion-clipboard";

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
  expect(menu.classList.contains("ui-rich-ui")).toBe(true);
  fireEvent.click(within(menu).getByRole("menuitemradio", { name }));
  await waitFor(() => expect(screen.queryByRole("menu", { name: "标注颜色" })).toBeNull());
}

it("copies callout children as portable HTML and restores their structure when pasted back", async () => {
  const original = '开头\n\n### 标题\n\n<aside data-callout="blue" data-callout-text-color="red" data-callout-icon="💡"><p>段落</p><blockquote><p><strong>引用</strong></p></blockquote><ul><li><p>第一项</p></li><li><p>第二项</p></li></ul><table><tbody><tr><th><p>表头</p></th></tr><tr><td><p>单元格</p></td></tr></tbody></table><aside data-callout="gray"><p>嵌套标注</p></aside></aside>\n\n结尾';
  const { editor, change } = await setup(original);
  act(() => editor.commands.selectAll());
  const html = editor.getHTML();
  const { dom } = editor.view.serializeForClipboard(editor.state.selection.content());
  expect(dom.querySelector("aside")).toBeNull();
  expect(dom.querySelectorAll("div[data-memocard-aside]")).toHaveLength(2);
  expect(dom.querySelector("[data-callout=blue]")?.getAttribute("data-callout-icon")).toBe("💡");
  expect(dom.querySelector("[data-callout=blue]")?.getAttribute("data-callout-text-color")).toBe("red");
  expect(dom.querySelector("h3")?.textContent).toBe("标题");
  expect(dom.querySelector("blockquote strong")?.textContent).toBe("引用");
  expect(dom.querySelectorAll("li")).toHaveLength(2);
  expect(dom.querySelector("th")?.textContent).toBe("表头");
  expect(dom.querySelector("td")?.textContent).toBe("单元格");
  const clipboard = new Map<string, string>();
  fireEvent.copy(editor.view.dom, { clipboardData: { clearData: () => clipboard.clear(), setData: (type: string, value: string) => clipboard.set(type, value) } });
  expect(clipboard.get("text/html")).toBe(dom.innerHTML);
  const native = JSON.parse(clipboard.get(notionClipboardType)!);
  const blocks = native.blocks.flatMap((entry: { blockSubtree: { block: Record<string, { value: { type: string; format?: Record<string, unknown> } }> } }) => Object.values(entry.blockSubtree.block).map(record => record.value));
  expect(blocks.filter((block: { type: string }) => block.type === "callout")).toHaveLength(2);
  expect(blocks.find((block: { format?: Record<string, unknown> }) => block.format?.page_icon === "💡")?.format).toMatchObject({ callout_version: 2, block_color: "blue_background" });
  expect(blocks.map((block: { type: string }) => block.type)).toEqual(expect.arrayContaining(["sub_sub_header", "quote", "bulleted_list", "table", "table_row"]));
  expect(clipboard.get(notionClipboardType)).toContain('["h","red"]');
  expect(clipboard.get(notionClipboardType)).not.toMatch(/space_id|notion_user|created_by|last_edited_by/);
  expect(change).not.toHaveBeenCalled();
  act(() => editor.commands.clearContent());
  fireEvent.paste(editor.view.dom, { clipboardData: { getData: (type: string) => type === "text/html" ? dom.innerHTML : "", files: [] } });
  expect(editor.getHTML()).toBe(html);
  expect(change.mock.lastCall![0]).toContain('<aside data-callout="blue"');
  expect(change.mock.lastCall![0]).not.toContain("data-memocard-aside");
});

it.each([
  '开头\n\n普通正文',
  '开头\n\n<aside data-callout="blue" data-callout-icon="💡"><p>正文</p><img src="../assets/a.png" alt="图片"></aside>',
])("keeps standard clipboard HTML when native callouts cannot represent the selection: %s", async original => {
  const { editor, change } = await setup(original);
  act(() => editor.commands.selectAll());
  const clipboard = new Map<string, string>();
  fireEvent.copy(editor.view.dom, { clipboardData: { clearData: () => clipboard.clear(), setData: (type: string, value: string) => clipboard.set(type, value) } });
  expect(clipboard.has(notionClipboardType)).toBe(false);
  expect(clipboard.get("text/html")).toContain("开头");
  if (original.includes("<img")) expect(clipboard.get("text/html")).toContain("../assets/a.png");
  expect(change).not.toHaveBeenCalled();
});

it.each([
  '<table><caption>表格说明</caption><tbody><tr><td>数据</td></tr></tbody></table>',
  '<table><tbody><tr><th scope="col">表头</th></tr><tr><td>数据</td></tr></tbody></table>',
  '<table><tbody><tr><td align="right">数据</td></tr></tbody></table>',
  '<table><tbody><tr><td>数据</td></tr></tbody><tfoot><tr><td>合计</td></tr></tfoot></table>',
])("falls back to HTML without dropping unsupported table semantics: %s", async table => {
  const { editor, change } = await setup(`开头\n\n<aside data-callout="blue"><p>提示</p>${table}</aside>`);
  act(() => editor.commands.selectAll());
  const { dom } = editor.view.serializeForClipboard(editor.state.selection.content());
  const clipboard = new Map<string, string>();
  fireEvent.copy(editor.view.dom, { clipboardData: { clearData: () => clipboard.clear(), setData: (type: string, value: string) => clipboard.set(type, value) } });
  expect(clipboard.has(notionClipboardType)).toBe(false);
  expect(clipboard.get("text/html")).toBe(dom.innerHTML);
  expect(clipboard.get("text/plain")).toContain("数据");
  expect(change).not.toHaveBeenCalled();
});

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
  expect(saved).not.toContain("ui-rich-ui");
  expect(field.querySelector("aside strong")?.textContent).toBe("标题");
  expect(editor.state.selection.toJSON()).toEqual(selection);
  act(() => editor.commands.undo());
  expect(change).toHaveBeenLastCalledWith(original);
  cleanup();
  expect((await setup(saved)).field.querySelector("aside")?.getAttribute("data-callout-icon")).toBe("🧑🏽‍💻");
});

it("searches common icons, clears them, and returns keyboard focus on Escape without writing", async () => {
  const { editor, field, change } = await setup('开头\n\n<aside data-callout="gray" data-callout-icon="💡"><p>正文</p></aside>');
  fireEvent.click(screen.getByRole("button", { name: "更改标注图标" }));
  fireEvent.change(await screen.findByRole("textbox", { name: "搜索 Emoji" }), { target: { value: "警告" } });
  fireEvent.click(screen.getByRole("button", { name: "警告、小心" }));
  expect(field.querySelector("aside")?.getAttribute("data-callout-icon")).toBe("⚠️");
  fireEvent.click(screen.getByRole("button", { name: "更改标注图标" }));
  await screen.findByRole("textbox", { name: "搜索 Emoji" });
  fireEvent.click(screen.getByRole("button", { name: "清除图标" }));
  expect(field.querySelector("aside")?.hasAttribute("data-callout-icon")).toBe(false);
  expect(screen.queryByRole("button", { name: "添加标注图标" })).toBeNull();
  act(() => editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize + 2));
  const trigger = screen.getByRole("button", { name: "内容块操作" });
  act(() => trigger.focus()); fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name: "编辑图标" }));
  await screen.findByRole("textbox", { name: "搜索 Emoji" });
  const count = change.mock.calls.length;
  await userEvent.setup().keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标注图标" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(change).toHaveBeenCalledTimes(count);
});

it("returns keyboard focus to the editor when clearing an icon hides its trigger", async () => {
  const { editor, field } = await setup('开头\n\n<aside data-callout="gray" data-callout-icon="💡"><p>正文</p></aside>');
  const user = userEvent.setup();
  act(() => screen.getByRole("button", { name: "更改标注图标" }).focus());
  await user.keyboard("{Enter}");
  await screen.findByRole("textbox", { name: "搜索 Emoji" });
  act(() => screen.getByRole("button", { name: "清除图标" }).focus());
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标注图标" })).toBeNull());
  expect(field.querySelector("aside")?.hasAttribute("data-callout-icon")).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(field));
  act(() => editor.commands.undo());
  expect(field.querySelector("aside")?.getAttribute("data-callout-icon")).toBe("💡");
});

it("uses the shared mobile sheet for callout icons and cancels without changing content or selection", async () => {
  vi.stubGlobal("innerWidth",390);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const { editor, change } = await setup('开头\n\n<aside data-callout="blue" data-callout-icon="🧭"><p>正文</p></aside>');
  const selection = editor.state.selection.toJSON();
  const trigger = screen.getByRole("button", { name: "更改标注图标" });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "编辑标注图标" });
  expect(dialog.getAttribute("data-side")).toBe("bottom");
  expect(within(dialog).getByRole("button", { name: "关闭编辑标注图标" })).toBeTruthy();
  await userEvent.setup().keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "编辑标注图标" })).toBeNull());
  expect(change).not.toHaveBeenCalled();
  expect(editor.state.selection.toJSON()).toEqual(selection);
  await waitFor(() => expect(document.activeElement).toBe(trigger));
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
  expect(change).not.toHaveBeenCalled();
  let pos = 0;
  editor.state.doc.descendants((node, at) => { if (node.type.name === "codeBlock" && node.attrs.language === "mermaid") pos = at + node.nodeSize - 2; });
  act(() => editor.commands.insertContentAt(pos, "新"));
  const saved = change.mock.lastCall![0] as string;
  expect(saved).toContain(ordinary); expect(saved).not.toContain("<svg"); expect(saved).not.toContain("ui-note-mermaid");
  fireEvent.click(screen.getByRole("tab", { name: "源码与图形" }));
  await waitFor(() => expect(screen.getByRole("img", { name: "Mermaid 图表" }).shadowRoot?.textContent).toContain("完成新"));
  act(() => editor.commands.undo());
  expect(field.querySelector("pre code.language-mermaid")?.textContent).toBe(source);
  expect(change.mock.lastCall![0]).toContain(ordinary);
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
  expect(menu.classList.contains("ui-rich-ui")).toBe(true);
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

it.each([
  ["![甲](../assets/a.png)", "甲", null],
  ["![[a.png|甲]]", "甲", null],
  ['<figure data-image-columns="40,60"><img src="../assets/a.png" alt="甲"><img src="../assets/b.png" alt="乙"><figcaption></figcaption></figure>', "乙", "40,60"],
])("stores a caption only on the chosen image and restores it on reopen: %s", async (image, alt, columns) => {
  const original = "开头\n\n" + image + "\n\n结束";
  const { editor, field, change } = await setup(original);
  const openCaption = async (action: string) => {
    fireEvent.click(await screen.findByRole("button", { name: `图片布局 ${alt}` }));
    fireEvent.click(await screen.findByRole("menuitem", { name: action }));
    return screen.findByRole<HTMLInputElement>("textbox", { name: `图注：${alt}` });
  };
  expect(field.querySelector(".note-image-caption")).toBeNull();
  const empty = await openCaption("添加图注");
  expect(document.activeElement).toBe(empty);
  fireEvent.blur(empty);
  expect(change).not.toHaveBeenCalled();
  expect(field.querySelector(".note-image-caption")).toBeNull();
  const input = await openCaption("添加图注");
  fireEvent.change(input, { target: { value: '测试图注 <&">' } });
  fireEvent.blur(input);
  const saved = change.mock.lastCall![0] as string;
  act(() => editor.commands.undo());
  expect(change).toHaveBeenLastCalledWith(original);
  cleanup();

  const reopened = await setup(saved);
  const owner = await screen.findByRole("img", { name: alt });
  expect(owner.closest(".rich-image")?.querySelector(".note-image-caption")?.textContent).toBe('测试图注 <&">');
  expect(reopened.field.querySelectorAll(".note-image-caption")).toHaveLength(1);
  expect(owner.closest("figure")?.getAttribute("data-image-columns") ?? null).toBe(columns);
  if (image.startsWith("![[")) expect(owner.closest(".node-wikiImage")).toBeTruthy();
  const edit = await openCaption("编辑图注");
  expect(edit.value).toBe('测试图注 <&">');
  fireEvent.change(edit, { target: { value: "" } });
  fireEvent.blur(edit);
  await waitFor(() => expect(reopened.field.querySelector(".note-image-caption")).toBeNull());
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
  expect(guide?.classList.contains('ui-rich-ui')).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' }); fireEvent.drop(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  expect(change).not.toHaveBeenCalled(); expect(document.querySelector('.rich-image-drop-guide')).toBeNull();
  start(); act(() => editor.commands.insertContentAt(2, '新')); const changed = change.mock.lastCall![0];
  fireEvent.drop(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  expect(change).toHaveBeenLastCalledWith(changed);
  act(() => editor.commands.undo()); start(); fireEvent.drop(target, { clientX: 290, clientY: 500, dataTransfer: transfer });
  await waitFor(() => expect(field.querySelectorAll('figure img')).toHaveLength(2));
  act(() => editor.commands.undo()); expect(change).toHaveBeenLastCalledWith(original);
});

it("drags the current image surface and restores the moved row with undo", async () => {
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
