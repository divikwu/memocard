// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { RichMarkdownEditor } from '@ui/business/RichMarkdownEditor';

vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
vi.mock('./bridge', () => ({ request: vi.fn() }));
const markdown = '开头\n\n| A | B |\n| --- | --- |\n| one | two |\n| three | four |\n\n中间\n\n| X | Y |\n| --- | --- |\n| five | six |\n\n结尾';

beforeEach(() => {
  vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerId = 1; pointerType = 'mouse'; });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('scrollBy', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  // JSDOM has no layout; keep the cells in view while testing menu behavior.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 100, 600, 300));
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function setup(disabled = false) {
  const change = vi.fn();
  const content = (disabled: boolean, value = markdown) => <><RichMarkdownEditor value={value} disabled={disabled} notePath="notes/a.md" onChange={change} onSave={vi.fn()} onError={vi.fn()} /><button>属性</button></>;
  const rendered = render(content(disabled));
  const field = await screen.findByRole('textbox', { name: '笔记内容' });
  const editor = (field as HTMLElement & { editor: Editor }).editor;
  await waitFor(() => expect(field.querySelectorAll('table')).toHaveLength(2));
  vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 60, right: 160, top: 100, bottom: 126 });
  return { editor, field, change, tables: () => field.querySelectorAll('table'), rerender: (disabled: boolean, value = markdown) => rendered.rerender(content(disabled, value)) };
}
function position(editor: Editor, text: string) {
  let result = -1;
  editor.state.doc.descendants((node, pos) => { if (node.isText && node.text === text) result = pos; });
  expect(result).toBeGreaterThan(0);
  return result;
}
function selectCell(editor: Editor, text: string) {
  act(() => { editor.commands.setTextSelection(position(editor, text)); editor.view.focus(); });
}
async function choose(trigger: string, command: string) {
  fireEvent.click(await screen.findByRole('button', { name: trigger }));
  fireEvent.click(await screen.findByRole('menuitem', { name: command }));
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
}

it.each([
  ['在上方插入行', 1],
  ['在下方插入行', 2],
] as const)('inserts a row in the requested direction and keeps typing in a separate undo step: %s', async (command, blankRow) => {
  const { editor, tables } = await setup();
  selectCell(editor, 'one');
  act(() => { editor.commands.insertContent('typed '); });
  const typed = editor.state.doc.toJSON();
  await choose('第 2 行操作', command);
  expect(tables()[0].rows).toHaveLength(4);
  expect(tables()[0].rows[blankRow].textContent).toBe('');
  expect(tables()[1].rows).toHaveLength(2);
  act(() => { editor.commands.undo(); });
  expect(editor.state.doc.toJSON()).toEqual(typed);
  act(() => { editor.commands.undo(); });
  expect(tables()[0].rows[1].cells[0].textContent).toBe('one');
});

it.each([
  ['在左侧插入列', 0],
  ['在右侧插入列', 1],
] as const)('targets the current table when inserting a column: %s', async (command, blankColumn) => {
  const { editor, tables } = await setup();
  selectCell(editor, 'five');
  const before = editor.state.doc.toJSON();
  await choose('第 1 列操作', command);
  expect(tables()[0].rows[0].cells).toHaveLength(2);
  expect(tables()[1].rows[1].cells).toHaveLength(3);
  expect(tables()[1].rows[1].cells[blankColumn].textContent).toBe('');
  act(() => { editor.commands.undo(); });
  expect(editor.state.doc.toJSON()).toEqual(before);
});

it.each([
  ['第 2 行操作', '删除当前行'],
  ['第 1 列操作', '删除当前列'],
] as const)('deletes only the active row or column and restores it with one undo: %s', async (trigger, command) => {
  const { editor, tables } = await setup();
  selectCell(editor, 'five');
  const firstTable = tables()[0].outerHTML;
  const before = editor.state.doc.toJSON();
  await choose(trigger, command);
  expect(tables()[0].outerHTML).toBe(firstTable);
  expect(tables()[1].textContent).not.toContain('five');
  act(() => { editor.commands.undo(); });
  expect(editor.state.doc.toJSON()).toEqual(before);
});

it('selects the complete table block from its handle without converting it to selected cells', async () => {
  const { editor, field, change } = await setup();
  selectCell(editor, 'one');
  fireEvent.click(screen.getByRole('button', { name: '内容块操作' }));
  await screen.findByRole('menu', { name: '内容块操作菜单' });
  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
  expect((editor.state.selection as NodeSelection).node.type.name).toBe('table');
  expect(field.querySelector('.rich-table-block.ProseMirror-selectednode')).not.toBeNull();
  expect(field.querySelectorAll('.selectedCell')).toHaveLength(0);
  expect(change).not.toHaveBeenCalled();
});

it('preserves the selected cell range while opening the table menu, merging and splitting', async () => {
  const { editor, tables } = await setup();
  const anchorCell = position(editor, 'one') - 2, headCell = position(editor, 'two') - 2;
  act(() => { editor.commands.setCellSelection({ anchorCell, headCell }); editor.view.focus(); });
  expect(editor.state.selection).toBeInstanceOf(CellSelection);
  fireEvent.click(screen.getByRole('button', { name: '表格选项' }));
  expect(editor.state.selection).toBeInstanceOf(CellSelection);
  const merge = await screen.findByRole('menuitem', { name: '合并单元格' });
  await waitFor(() => expect(merge.getAttribute('aria-disabled')).not.toBe('true'));
  fireEvent.click(merge);
  await waitFor(() => expect(tables()[0].rows[1].cells).toHaveLength(1));
  expect(tables()[0].rows[1].cells[0].colSpan).toBe(2);
  expect(tables()[0].rows[1].textContent).toContain('one');
  expect(tables()[0].rows[1].textContent).toContain('two');
  await waitFor(() => expect(editor.isFocused).toBe(true));
  await choose('表格选项', '拆分单元格');
  expect(tables()[0].rows[1].cells).toHaveLength(2);
});

it('closes the menu with Escape and restores the exact cell caret without a write', async () => {
  const { editor, field, change } = await setup();
  selectCell(editor, 'six');
  const selection = editor.state.selection.toJSON();
  const user = userEvent.setup();
  fireEvent.click(screen.getByRole('button', { name: '第 2 列操作' }));
  await screen.findByRole('menu', { name: '列操作菜单' });
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(change).not.toHaveBeenCalled();
});

it('opens and executes row operations entirely from the keyboard', async () => {
  const { editor, tables } = await setup();
  selectCell(editor, 'one');
  const user = userEvent.setup();
  act(() => screen.getByRole('button', { name: '第 2 行操作' }).focus());
  await user.keyboard('{ArrowDown}');
  await screen.findByRole('menu', { name: '行操作菜单' });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: '在上方插入行' })));
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(tables()[0].rows).toHaveLength(4);
  expect(tables()[0].rows[1].textContent).toBe('');
  expect(tables()[0].rows[2].cells[0].textContent).toBe('one');
});

it('opens table options from a cell with Shift-F10 while preserving its caret', async () => {
  const { editor, field, change } = await setup();
  selectCell(editor, 'six');
  const selection = editor.state.selection.toJSON();
  expect(screen.getByRole('button', { name: '表格选项' }).getAttribute('aria-keyshortcuts')).toBe('Shift+F10');
  fireEvent.keyDown(field, { key: 'F10', shiftKey: true });
  await screen.findByRole('menu', { name: '表格操作菜单' });
  expect(editor.state.selection.toJSON()).toEqual(selection);
  await userEvent.setup().keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(document.activeElement).toBe(field);
  expect(change).not.toHaveBeenCalled();
});

it('dismisses on an outside click without stealing focus back from that control', async () => {
  const { editor, change } = await setup();
  selectCell(editor, 'one');
  fireEvent.click(screen.getByRole('button', { name: '表格选项' }));
  await screen.findByRole('menu', { name: '表格操作菜单' });
  const outside = screen.getByRole('button', { name: '属性' });
  await userEvent.setup().click(outside);
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(document.activeElement).toBe(outside);
  expect(change).not.toHaveBeenCalled();
});

it('keeps Tab, Shift-Tab and the last-cell new-row shortcut working', async () => {
  const { editor, field, tables } = await setup();
  selectCell(editor, 'one');
  fireEvent.keyDown(field, { key: 'Tab' });
  expect(editor.state.selection.$from.parent.textContent).toBe('two');
  fireEvent.keyDown(field, { key: 'Tab', shiftKey: true });
  expect(editor.state.selection.$from.parent.textContent).toBe('one');
  selectCell(editor, 'four');
  fireEvent.keyDown(field, { key: 'Tab' });
  expect(tables()[0].rows).toHaveLength(4);
  expect(editor.state.selection.$from.parent.textContent).toBe('');
  expect(tables()[1].rows).toHaveLength(2);
});

it('hides table operations when disabled and when the caret leaves all tables', async () => {
  const { editor } = await setup(true);
  selectCell(editor, 'one');
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  cleanup();
  const enabled = await setup();
  selectCell(enabled.editor, 'one');
  expect(screen.getByRole('group', { name: '表格操作' })).toBeTruthy();
  selectCell(enabled.editor, '结尾');
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
});

it('closes stale table menus after an external document update and allows text formatting', async () => {
  const { editor, rerender } = await setup();
  selectCell(editor, 'one');
  fireEvent.click(screen.getByRole('button', { name: '表格选项' }));
  await screen.findByRole('menu', { name: '表格操作菜单' });
  rerender(false, markdown.replace('开头', '外部更新'));
  await waitFor(() => expect(editor.getText()).toContain('外部更新'));
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  const from = position(editor, '外部更新');
  act(() => { editor.commands.setTextSelection({ from, to: from + 4 }); editor.view.focus(); });
  expect(await screen.findByRole('toolbar', { name: '文字格式' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '粗体' }));
  expect(editor.isActive('bold')).toBe(true);
});

it('clears an open table menu when disabled and restores text formatting after enabling', async () => {
  const { editor, rerender } = await setup();
  selectCell(editor, 'one');
  fireEvent.click(screen.getByRole('button', { name: '表格选项' }));
  await screen.findByRole('menu', { name: '表格操作菜单' });
  rerender(true);
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  rerender(false);
  await waitFor(() => expect(editor.isEditable).toBe(true));
  const from = position(editor, '开头');
  act(() => { editor.commands.setTextSelection({ from, to: from + 2 }); editor.view.focus(); });
  expect(await screen.findByRole('toolbar', { name: '文字格式' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '粗体' }));
  expect(editor.isActive('bold')).toBe(true);
});

it('gives selected cell text to the format toolbar without overlapping table controls', async () => {
  const { editor } = await setup();
  const from = position(editor, 'one');
  act(() => { editor.commands.setTextSelection({ from, to: from + 3 }); editor.view.focus(); });
  expect(await screen.findByRole('toolbar', { name: '文字格式' })).toBeTruthy();
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '粗体' }));
  expect(editor.isActive('bold')).toBe(true);
});
