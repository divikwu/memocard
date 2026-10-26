// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note, NoteProperties, PropertyChange } from '@memocard/contracts';
import { setStorybookRequestHandler, resetStorybookBridge } from '../../test-support/bridge';
import { noteEditor, readEditorText } from '../../src/editor-test-utils';
import { Editor, type EditorHandle } from './Editor';
import { RichMarkdownEditor, type RichEditorProps } from './RichMarkdownEditor';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('DragEvent', MouseEvent);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
});
afterEach(() => { cleanup(); resetStorybookBridge(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function rich(value: string, extra: Partial<RichEditorProps> = {}, withScrollSurface = false) {
  const onChange = vi.fn();
  const props = { value, notePath: 'notes/a.md', disabled: false, onChange, onSave: vi.fn(), onError: vi.fn(), ...extra };
  const content = <RichMarkdownEditor {...props} />;
  const view = render(withScrollSurface ? <div className="note-page-scroll" style={{ overflowY: 'auto', scrollPaddingTop: 80, scrollPaddingBottom: 24 }}>{content}</div> : content);
  const field = await screen.findByRole('textbox', { name: '笔记内容' });
  const editor = noteEditor(field);
  vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 60, right: 160, top: 100, bottom: 126 });
  await waitFor(() => expect(editor.getText()).not.toBe(''));
  return { editor, field, onChange, props, rerender: view.rerender, unmount: view.unmount };
}

async function scrollCaret() {
  const view = await rich('正文内容', { autoFocus: false }, true);
  const surface = view.field.closest<HTMLElement>('.note-page-scroll')!;
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 40, 600, 400));
  Object.defineProperty(surface, 'clientHeight', { configurable: true, value: 400 });
  surface.scrollTop = 200;
  act(() => view.editor.view.focus());
  const pending = new Map<number, FrameRequestCallback>();
  let frame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { pending.set(++frame, callback); return frame; });
  const cancel = vi.fn((id: number) => pending.delete(id));
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const flush = () => act(() => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(0)); });
  return { ...view, surface, pending, cancel, flush };
}

it.each([
  { edge: 'top', caretTop: 100, expected: 180 },
  { edge: 'bottom', caretTop: 430, expected: 240 },
])('keeps the caret inside the scroll surface padded $edge edge without writing or changing selection', async ({ caretTop, expected }) => {
  const { editor, surface, onChange, flush } = await scrollCaret();
  vi.mocked(editor.view.coordsAtPos).mockReturnValue({ left: 60, right: 60, top: caretTop, bottom: caretTop + 26 });
  act(() => editor.commands.setTextSelection(2));
  const selection = editor.state.selection.toJSON();
  flush();
  expect(surface.scrollTop).toBe(expected);
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(editor.getText()).toBe('正文内容');
  expect(onChange).not.toHaveBeenCalled();
  act(() => { expect(editor.commands.undo()).toBe(false); });
});

it('leaves legacy unpadded surfaces and ranged text selections alone', async () => {
  const { editor, surface, onChange, flush } = await scrollCaret();
  vi.mocked(editor.view.coordsAtPos).mockReturnValue({ left: 60, right: 60, top: 50, bottom: 76 });
  surface.style.scrollPaddingTop = '';
  surface.style.scrollPaddingBottom = '';
  act(() => editor.commands.setTextSelection(2));
  flush();
  expect(surface.scrollTop).toBe(200);
  surface.style.scrollPaddingTop = '80px';
  act(() => editor.commands.setTextSelection({ from: 2, to: 4 }));
  const selection = editor.state.selection.toJSON();
  flush();
  expect(surface.scrollTop).toBe(200);
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(onChange).not.toHaveBeenCalled();
});

it('reveals the caret after native navigation keyup without a selection change', async () => {
  const { editor, field, surface, flush, onChange } = await scrollCaret();
  vi.mocked(editor.view.coordsAtPos).mockReturnValue({ left: 60, right: 60, top: 50, bottom: 76 });
  const selection = editor.state.selection.toJSON();
  fireEvent.keyUp(field, { key: 'ArrowUp' });
  flush();
  expect(surface.scrollTop).toBe(130);
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(onChange).not.toHaveBeenCalled();
  surface.scrollTop = 200;
  fireEvent.keyUp(field, { key: 'a' });
  flush();
  expect(surface.scrollTop).toBe(200);
});

it('reveals the caret for scroll-into-view transactions with an unchanged selection', async () => {
  const { editor, surface, flush, onChange } = await scrollCaret();
  vi.mocked(editor.view.coordsAtPos).mockReturnValue({ left: 60, right: 60, top: 430, bottom: 456 });
  // Native scrolling has already run when Tiptap emits the transaction event.
  editor.view.setProps({ handleScrollToSelection: () => true });
  const selection = editor.state.selection.toJSON();
  act(() => editor.view.dispatch(editor.state.tr.scrollIntoView()));
  flush();
  expect(surface.scrollTop).toBe(240);
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(onChange).not.toHaveBeenCalled();
  act(() => { expect(editor.commands.undo()).toBe(false); });
});

it('cancels stale caret work and does not scroll after blur or unmount', async () => {
  const { editor, field, surface, pending, cancel, flush, unmount, onChange } = await scrollCaret();
  vi.mocked(editor.view.coordsAtPos).mockReturnValue({ left: 60, right: 60, top: 50, bottom: 76 });
  act(() => { editor.commands.setTextSelection(2); editor.commands.setTextSelection(3); });
  expect(pending.size).toBe(1);
  act(() => field.blur());
  flush();
  expect(surface.scrollTop).toBe(200);
  act(() => { editor.view.focus(); editor.commands.setTextSelection(4); });
  expect(pending.size).toBe(1);
  const frame = [...pending.keys()][0];
  unmount();
  expect(cancel).toHaveBeenCalledWith(frame);
  expect(pending.size).toBe(0);
  expect(surface.scrollTop).toBe(200);
  expect(onChange).not.toHaveBeenCalled();
});

it('keeps semantic Markdown, tables, tasks and math in the shared editor without an opening write', async () => {
  const value = '# 标题\n\n正文 **重点**\n\n- [ ] 任务\n\n| 名称 | 状态 |\n| --- | --- |\n| 项目 | 完成 |\n\n$E=mc^2$';
  const { editor, field, onChange } = await rich(value);
  expect(field.querySelector('h1')?.textContent).toBe('标题');
  expect(field.querySelector('table')).not.toBeNull();
  expect(screen.getByRole('checkbox', { name: '待办：任务' })).toHaveProperty('checked', false);
  expect(field.querySelector('.rich-math')).not.toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  act(() => { editor.commands.insertContentAt(2, '新'); });
  expect(onChange.mock.lastCall?.[0]).toContain('# 标新题');
  act(() => { editor.commands.undo(); });
  expect(onChange).toHaveBeenLastCalledWith(value);
});

it('tracks keyboard tag suggestions with a visible state contract and inserts the selected tag', async () => {
  setStorybookRequestHandler(operation => operation === 'listTags' ? { tags: [{ name: 'design' }, { name: 'development' }] } : undefined);
  const { editor, field, onChange } = await rich('正文');
  act(() => { editor.commands.insertContentAt(3, ' #de'); editor.commands.setTextSelection(7); });
  const options = within(await screen.findByRole('group', { name: '标签建议' }));
  await waitFor(() => expect(options.getByRole('button', { name: '#design' }).hasAttribute('data-highlighted')).toBe(true));
  fireEvent.keyDown(field, { key: 'ArrowDown' });
  expect(options.getByRole('button', { name: '#development' }).hasAttribute('data-highlighted')).toBe(true);
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(onChange.mock.lastCall?.[0]).toContain('#development');
  expect(screen.queryByRole('group', { name: '标签建议' })).toBeNull();
});

it('folds headings with the current view without adding a Markdown write or undo entry', async () => {
  const value = '# 标题\n\n章节正文\n\n# 其他\n\n后文';
  const { editor, field, onChange } = await rich(value);
  fireEvent.click(await screen.findByRole('button', { name: '收起“标题”章节' }));
  expect(field.querySelector('.rich-folded-content')?.hasAttribute('hidden')).toBe(true);
  expect(screen.getByRole('button', { name: '展开“标题”章节' }).getAttribute('aria-expanded')).toBe('false');
  expect(onChange).not.toHaveBeenCalled();
  act(() => { editor.commands.setTextSelection(6); });
  await waitFor(() => expect(field.querySelector('.rich-folded-content')).toBeNull());
  expect(onChange).not.toHaveBeenCalled();
});

it.each(['pointer', 'keyboard'] as const)('keeps the block handle on the heading whose fold button receives %s input', async input => {
  let resizeEditor = () => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) { if (target.matches('.rich-editor')) resizeEditor = () => this.callback([], this as unknown as ResizeObserver); }
    disconnect() {}
    unobserve() {}
  });
  const { editor, field, onChange } = await rich('# 一级标题\n\n## 二级标题\n\n### 三级标题\n\n正文');
  const headings = Array.from(field.querySelectorAll<HTMLElement>('h1, h2, h3'));
  headings.forEach((heading, index) => vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(new DOMRect(64, 100 + index * 80, 400, 26)));
  vi.spyOn(field.closest('.rich-editor')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 500, 500));
  const second = editor.view.posAtDOM(headings[1], 0);
  act(() => { editor.commands.setTextSelection(second); });
  vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: second, inside: second - 1 });
  fireEvent.mouseMove(headings[1], { clientX: 80, clientY: 190 });
  const grip = screen.getByRole('button', { name: '内容块操作' });
  expect(grip.parentElement!.style.top).toBe('193px');
  const fold = screen.getByRole('button', { name: '收起“三级标题”章节' });
  if (input === 'pointer') fireEvent.mouseMove(fold, { clientX: 50, clientY: 270 });
  else fireEvent.focus(fold);
  expect(grip.parentElement!.style.top).toBe('273px');
  fireEvent.click(fold);
  act(() => { resizeEditor(); });
  expect(grip.parentElement!.style.top).toBe('273px');
  fireEvent.click(grip);
  expect(editor.state.selection.from).toBe(editor.view.posAtDOM(headings[2], 0) - 1);
  expect(onChange).not.toHaveBeenCalled();
});

it('retargets the block handle when scrolling puts another heading under a stationary pointer', async () => {
  const { editor, field, onChange } = await rich('# 一级标题\n\n## 二级标题\n\n### 三级标题\n\n正文');
  const headings = Array.from(field.querySelectorAll<HTMLElement>('h1, h2, h3'));
  headings.forEach((heading, index) => vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(new DOMRect(64, 100 + index * 80, 400, 26)));
  vi.spyOn(field.closest('.rich-editor')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 500, 500));
  const second = editor.view.posAtDOM(headings[1], 0), third = editor.view.posAtDOM(headings[2], 0);
  const coordinates = vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: second, inside: second - 1 });
  fireEvent.mouseMove(headings[1], { clientX: 80, clientY: 190 });
  const grip = screen.getByRole('button', { name: '内容块操作' });
  expect(grip.parentElement!.style.top).toBe('193px');
  const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => headings[2] });
  try {
    coordinates.mockReturnValue({ pos: third, inside: third - 1 });
    fireEvent.scroll(document);
    expect(grip.parentElement!.style.top).toBe('273px');
    expect(onChange).not.toHaveBeenCalled();
  } finally {
    if (original) Object.defineProperty(document, 'elementFromPoint', original);
    else Reflect.deleteProperty(document, 'elementFromPoint');
  }
});

it('uses the current link controls while preserving the text selection and undoing the saved mark', async () => {
  const { editor, onChange } = await rich('alpha beta');
  act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
  fireEvent.click(await screen.findByRole('button', { name: /^链接$/ }, { timeout: 5000 }));
  const input = await screen.findByRole('textbox', { name: '链接地址' });
  expect(input.dataset.slot).toBe('input');
  fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
  fireEvent.click(screen.getByRole('button', { name: /^保存$/ }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', '请输入有效的网页地址或相对路径。');
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'https://example.com/notes' } });
  fireEvent.click(screen.getByRole('button', { name: /^保存$/ }));
  expect(onChange).toHaveBeenLastCalledWith('[alpha](https://example.com/notes) beta');
  act(() => { editor.commands.undo(); });
  expect(onChange).toHaveBeenLastCalledWith('alpha beta');
});

it('keeps the mobile link-type portal in the editor style scope and cancels without changing content', async () => {
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const { editor, field, onChange } = await rich('alpha beta');
  act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }); });
  fireEvent.click(await screen.findByRole('button', { name: /^链接$/ }, { timeout: 5000 }));
  const dialog = await screen.findByRole('dialog', { name: '编辑链接' });
  expect(dialog.dataset.slot).toBe('sheet-content');
  expect(dialog.dataset.side).toBe('bottom');
  expect(within(dialog).getByRole('button', { name: '关闭弹窗' }).classList.contains('ui-sheet-close-button')).toBe(true);
  const user = userEvent.setup();
  await user.click(within(dialog).getByRole('combobox', { name: '链接类型' }));
  const option = await screen.findByRole('option', { name: 'Wiki 笔记链接' });
  expect(option.closest('.ui-rich-ui.rich-type-options')).not.toBeNull();
  expect(dialog.contains(option)).toBe(false);
  await user.click(option);
  expect(within(dialog).getByRole('textbox', { name: '搜索目标笔记' })).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: '取消' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '编辑链接' })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect(editor.state.selection.toJSON()).toMatchObject({ anchor: 1, head: 6 });
  expect(onChange).not.toHaveBeenCalled();
});

it('keeps the same editor and undo history across disabled view updates', async () => {
  const { editor, field, props, rerender } = await rich('原文');
  act(() => { editor.commands.insertContentAt(3, '修改'); });
  rerender(<RichMarkdownEditor {...props} disabled />);
  await waitFor(() => expect(field.getAttribute('contenteditable')).toBe('false'));
  expect(noteEditor(field)).toBe(editor);
  expect(screen.getByRole('button', { name: '内容块操作' })).toHaveProperty('disabled', true);
  rerender(<RichMarkdownEditor {...props} />);
  await waitFor(() => expect(editor.isEditable).toBe(true));
  act(() => { editor.commands.undo(); });
  expect(readEditorText()).toBe('原文');
});

function transport() {
  let note: Note = { id: 'note', title: '原题', body: '正文', tags: [], contentHash: 'original', relativePath: 'notes/note.md', sourceUrl: '', createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-22T08:00:00Z' };
  let properties: NoteProperties = { contentHash: note.contentHash, writable: true, definitionHash: 'definition', properties: [{ name: '已验证', type: 'checkbox', value: false, editable: true }] };
  let revision = 0;
  const request = vi.fn(async (operation: string, params: Record<string, unknown>) => {
    if (operation === 'getPropertyLabels') return { labels: {}, contentHash: 'labels' };
    if (operation === 'listTags') return { tags: [] };
    if (operation === 'getNoteProperties') return properties;
    if (operation === 'saveNote') return note = { ...note, title: String(params.title ?? note.title), body: String(params.body), contentHash: `body-${++revision}` };
    if (operation === 'getNote') return note;
    if (operation === 'updateNoteProperty') {
      const change = params as PropertyChange;
      note = { ...note, contentHash: `property-${++revision}` };
      properties = { ...properties, contentHash: note.contentHash, properties: properties.properties.map(property => property.name === change.name ? { ...property, value: change.value! } : property) };
      return { ...note, propertyData: properties };
    }
    if (operation === 'pickImage') return { markdownPath: '../assets/photo.png', notePath: note.relativePath };
  });
  setStorybookRequestHandler(request);
  return { request, stored: () => ({ note, properties }) };
}
async function page(withScrollSurface = false) {
  const fixture = transport();
  const note = fixture.stored().note;
  const handle = createRef<EditorHandle>();
  const onSaved = vi.fn();
  const content = <Editor initial={{ id: note.id, title: note.title, body: note.body, tags: [], baseHash: note.contentHash, relativePath: note.relativePath }} initialNote={note} capabilities={new Set(['saveNote', 'saveDraft', 'getNoteProperties', 'updateNoteProperty', 'pickImage'])} handle={handle} onClose={vi.fn()} onSaved={onSaved} />;
  render(withScrollSurface ? <div className="note-page-scroll" style={{ overflowY: 'auto' }}>{content}</div> : content);
  await screen.findByRole('textbox', { name: '笔记内容' });
  await waitFor(() => expect(noteEditor().getText()).toBe('正文'));
  return { ...fixture, handle, onSaved };
}

it('starts a block range beside the page title before reaching the document and cancels without a write', async () => {
  vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerId = 1; pointerType = 'mouse'; });
  const { request } = await page(true);
  const field = screen.getByRole('textbox', { name: '笔记内容' });
  const root = field.closest<HTMLElement>('.rich-editor')!;
  const section = screen.getByRole('region', { name: '编辑笔记' });
  const surface = field.closest<HTMLElement>('.note-page-scroll')!;
  Object.assign(root, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true });
  vi.spyOn(section, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 20, 500, 300));
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 120, 500, 200));
  vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(new DOMRect(64, 120, 400, 100));
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 600, 600));
  fireEvent.pointerDown(section, { button: 0, clientX: 10, clientY: 60 });
  expect(root.hasAttribute('data-selecting')).toBe(true);
  expect(root.querySelector('.rich-selection-box')).not.toBeNull();
  fireEvent.pointerCancel(root);
  expect(root.hasAttribute('data-selecting')).toBe(false);
  expect(root.querySelector('.rich-selection-box')).toBeNull();
  expect(readEditorText()).toBe('正文');
  expect(request.mock.calls.some(([operation]) => operation === 'saveNote')).toBe(false);
});

it('undoes title, body and real property controls in order, then persists redo through the public handle', async () => {
  const { handle, stored } = await page();
  fireEvent.click(screen.getByRole('button', { name: /^属性$/ }));
  const checkbox = await screen.findByRole('checkbox', { name: '切换属性 已验证' });
  const title = screen.getByRole('textbox', { name: '页面标题' });
  fireEvent.change(title, { target: { value: '新题' } }); fireEvent.blur(title);
  act(() => { noteEditor().commands.insertContentAt(3, '改'); });
  fireEvent.click(checkbox);
  await waitFor(() => expect(stored().properties.properties[0].value).toBe(true));
  const grip = screen.getByRole('button', { name: '内容块操作' });
  fireEvent.keyDown(grip, { key: 'z', metaKey: true });
  expect(checkbox.getAttribute('aria-checked')).toBe('false');
  fireEvent.keyDown(grip, { key: 'z', metaKey: true });
  expect(readEditorText()).toBe('正文');
  fireEvent.keyDown(title, { key: 'z', metaKey: true });
  expect(title).toHaveProperty('value', '原题');
  for (let index = 0; index < 3; index++) fireEvent.keyDown(grip, { key: 'z', metaKey: true, shiftKey: true });
  await act(async () => { expect(await handle.current!.flush()).toBe(true); });
  expect(stored().note).toMatchObject({ title: '新题', body: '正文改' });
  expect(stored().properties.properties[0].value).toBe(true);
});

it('inserts a picked attachment through the current block menu and keeps its insertion undoable', async () => {
  const { request } = await page();
  vi.spyOn(noteEditor().view, 'coordsAtPos').mockReturnValue({ left: 60, right: 160, top: 100, bottom: 126 });
  fireEvent.click(screen.getByRole('button', { name: '内容块操作' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: '在下方插入' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /^图片$/ }));
  await waitFor(() => expect(request).toHaveBeenCalledWith('pickImage', expect.objectContaining({ noteId: 'note', notePath: 'notes/note.md' })));
  await waitFor(() => expect(readEditorText()).toContain('![图片](../assets/photo.png)'));
  expect(screen.getByRole('img', { name: /^图片$/ })).toHaveProperty('draggable', true);
  act(() => { noteEditor().commands.undo(); });
  expect(readEditorText()).toBe('正文');
});

it('reports a failed save, retains the draft and retries before allowing deletion or finish', async () => {
  const { request, handle, onSaved } = await page();
  const normal = request.getMockImplementation()!;
  request.mockImplementation(async (operation, params) => { if (operation === 'saveNote') throw new Error('磁盘只读'); return normal(operation, params); });
  act(() => { noteEditor().commands.insertContentAt(3, '改'); });
  await act(async () => { expect(await handle.current!.prepareDelete()).toBeNull(); });
  expect(screen.getByRole('alert').textContent).toContain('磁盘只读');
  expect(readEditorText()).toBe('正文改');
  request.mockImplementation(normal);
  fireEvent.click(screen.getByRole('button', { name: '重试保存' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await act(async () => { expect(await handle.current!.prepareDelete()).toMatchObject({ id: 'note', contentHash: expect.stringMatching(/^body-/) }); await handle.current!.finish(); });
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ body: '正文改' }));
});

it('closes an open block menu when editing is disabled and refuses its stale delete action', async () => {
  const { editor, props, rerender, onChange } = await rich('待保存内容');
  fireEvent.click(screen.getByRole('button', { name: '内容块操作' }));
  const remove = await screen.findByRole('menuitem', { name: '删除' });
  rerender(<RichMarkdownEditor {...props} disabled />);
  fireEvent.click(remove);
  expect(editor.getText()).toBe('待保存内容');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole('menu', { name: '内容块操作菜单' })).toBeNull();
});
