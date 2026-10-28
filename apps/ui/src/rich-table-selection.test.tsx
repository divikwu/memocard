// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { RichMarkdownEditor } from '@ui/business/RichMarkdownEditor';
import { BlockRangeSelection } from './rich-block-selection';
import { alignRichColumn } from './rich-table';

vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
vi.mock('./bridge', () => ({ request: vi.fn() }));
const markdown = '开头\n\n| A | B |\n| --- | --- |\n| one | two |\n| three | four |\n\n中间\n\n| X | Y |\n| --- | --- |\n| five | six |\n\n结尾';

beforeEach(() => {
  vi.stubGlobal('DragEvent', MouseEvent);
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId = 1;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerType = init.pointerType ?? 'mouse'; }
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('scrollBy', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  // JSDOM has no layout; drag destinations below are supplied independently.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 100, 600, 300));
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function setup(value = markdown, page = false) {
  const change = vi.fn();
  const content = <RichMarkdownEditor value={value} disabled={false} notePath="notes/a.md" onChange={change} onSave={vi.fn()} onError={vi.fn()} />;
  render(page ? <div className="note-page-scroll" style={{ overflowY: 'auto' }}>{content}</div> : content);
  const field = await screen.findByRole('textbox', { name: '笔记内容' });
  const editor = (field as HTMLElement & { editor: Editor }).editor;
  await waitFor(() => expect(field.querySelectorAll('table')).toHaveLength(2));
  vi.spyOn(editor.view, 'coordsAtPos').mockReturnValue({ left: 60, right: 160, top: 100, bottom: 126 });
  return { editor, field, root: field.closest<HTMLElement>('.rich-editor')!, change };
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
async function selectTable(editor: Editor) {
  selectCell(editor, 'one');
  fireEvent.click(screen.getByRole('button', { name: '内容块操作' }));
  await screen.findByRole('menu', { name: '内容块操作菜单' });
  await userEvent.setup().keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  // Escape schedules editor focus; settle it before a following pointer gesture.
  await act(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await waitFor(() => expect(editor.isFocused).toBe(true));
  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
}
type TableSelectionMode = 'cell caret' | 'cell text' | 'cell range' | 'table block';
async function selectTableMode(editor: Editor, selection: TableSelectionMode) {
  selectCell(editor, 'one');
  if (selection === 'table block') await selectTable(editor);
  else if (selection === 'cell range') act(() => { editor.commands.setCellSelection({ anchorCell: position(editor, 'one') - 2, headCell: position(editor, 'two') - 2 }); });
  else if (selection === 'cell text') act(() => { editor.commands.setTextSelection({ from: position(editor, 'one'), to: position(editor, 'one') + 3 }); });
}
function blockOrder(editor: Editor) {
  const result: string[] = [];
  editor.state.doc.forEach(node => result.push(node.textContent));
  return result;
}
function dragToEnd(editor: Editor) {
  const last = position(editor, '结尾') - 1;
  vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: last + 1, inside: last });
  vi.spyOn(editor.view.nodeDOM(last) as HTMLElement, 'getBoundingClientRect').mockReturnValue(new DOMRect(60, 400, 600, 30));
  return { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
}
function pageGeometry(editor: Editor, field: HTMLElement, root: HTMLElement) {
  const page = root.closest<HTMLElement>('.note-page-scroll')!;
  const bounds = new Map<HTMLElement, DOMRect>([
    [page, new DOMRect(0, 0, 700, 700)],
    [root, new DOMRect(40, 100, 600, 500)],
    [field, new DOMRect(80, 120, 500, 450)],
  ]);
  const blocks = [new DOMRect(80, 125, 500, 30), new DOMRect(80, 160, 500, 160), new DOMRect(80, 340, 500, 30), new DOMRect(80, 390, 500, 120), new DOMRect(80, 540, 500, 30)];
  editor.state.doc.forEach((_node, pos, index) => { bounds.set(editor.view.nodeDOM(pos) as HTMLElement, blocks[index]); });
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function(this: HTMLElement) { return bounds.get(this) ?? new DOMRect(80, 160, 200, 30); });
  return page;
}

it('returns from a single table block selection to editing one cell without rewriting its neighbors', async () => {
  const { editor, field, change } = await setup();
  await selectTable(editor);
  expect(field.querySelector('.rich-table-block.ProseMirror-selectednode')).not.toBeNull();
  expect(field.querySelectorAll('.selectedCell')).toHaveLength(0);
  expect(change).not.toHaveBeenCalled();
  selectCell(editor, 'one');
  expect(editor.state.selection).toBeInstanceOf(TextSelection);
  expect(field.querySelector('.rich-table-block.ProseMirror-selectednode')).toBeNull();
  act(() => { editor.commands.insertContent('edited '); });
  expect(blockOrder(editor)).toEqual(['开头', 'ABedited onetwothreefour', '中间', 'XYfivesix', '结尾']);
  act(() => { editor.commands.undo(); });
  expect(change).toHaveBeenLastCalledWith(markdown);
});

it.each(['cell range', 'cell text'] as const)('selects the complete table from its handle after selecting %s', async selection => {
  const { editor, field, change } = await setup();
  selectCell(editor, 'one');
  act(() => {
    if (selection === 'cell range') editor.commands.setCellSelection({ anchorCell: position(editor, 'one') - 2, headCell: position(editor, 'two') - 2 });
    else editor.commands.setTextSelection({ from: position(editor, 'one'), to: position(editor, 'one') + 3 });
    editor.view.focus();
  });
  fireEvent.click(screen.getByRole('button', { name: '内容块操作' }));
  await screen.findByRole('menu', { name: '内容块操作菜单' });
  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
  expect((editor.state.selection as NodeSelection).node.type.name).toBe('table');
  expect(field.querySelector('.rich-table-block.ProseMirror-selectednode')).not.toBeNull();
  expect(field.querySelectorAll('.selectedCell')).toHaveLength(0);
  expect(change).not.toHaveBeenCalled();
});

it('expands a table selection to adjacent blocks and shrinks back without selecting cells or writing', async () => {
  const { editor, field, change } = await setup();
  await selectTable(editor);
  const tableSelection = editor.state.selection.toJSON();
  fireEvent.keyDown(field, { key: 'ArrowDown', shiftKey: true });
  expect(editor.state.selection).toBeInstanceOf(BlockRangeSelection);
  expect([...field.querySelectorAll('.rich-selected-block')].map(node => node.textContent)).toEqual(['ABonetwothreefour', '中间']);
  expect(field.querySelectorAll('.selectedCell')).toHaveLength(0);
  fireEvent.keyDown(field, { key: 'ArrowUp', shiftKey: true });
  expect(editor.state.selection.toJSON()).toEqual(tableSelection);
  fireEvent.keyDown(field, { key: 'ArrowUp', shiftKey: true });
  expect(editor.state.selection).toBeInstanceOf(BlockRangeSelection);
  expect([...field.querySelectorAll('.rich-selected-block')].map(node => node.textContent)).toEqual(['开头', 'ABonetwothreefour']);
  fireEvent.keyDown(field, { key: 'ArrowDown', shiftKey: true });
  expect(editor.state.selection.toJSON()).toEqual(tableSelection);
  expect(change).not.toHaveBeenCalled();
});

it('drags only the selected table through its handle and restores source with one undo', async () => {
  const { editor, field, root, change } = await setup();
  await selectTable(editor);
  const transfer = dragToEnd(editor), grip = screen.getByRole('button', { name: '内容块操作' });
  fireEvent.dragStart(grip, { dataTransfer: transfer });
  const preview = transfer.setDragImage.mock.calls[0]?.[0] as HTMLElement;
  expect(preview.querySelectorAll('.rich-table-block')).toHaveLength(1);
  expect(preview.querySelectorAll('table')).toHaveLength(1);
  expect(preview.querySelector('.rich-selected-block, .ProseMirror-selectednode, .selectedCell')).toBeNull();
  expect(transfer.setData).toHaveBeenCalledWith('text/plain', 'ABonetwothreefour');
  fireEvent.dragOver(root, { dataTransfer: transfer, clientX: 100, clientY: 429 });
  fireEvent.drop(root, { dataTransfer: transfer, clientX: 100, clientY: 429 });
  expect(blockOrder(editor)).toEqual(['开头', '中间', 'XYfivesix', '结尾', 'ABonetwothreefour']);
  expect(field.querySelectorAll('table')).toHaveLength(2);
  expect(root.querySelector('.block-drag-preview')).toBeNull();
  expect(root.hasAttribute('data-dragging')).toBe(false);
  const saved = change.mock.lastCall![0] as string;
  expect(saved).not.toMatch(/rich-table-block|tableWrapper|selectedCell|rich-selected-block|ProseMirror-selectednode/);
  act(() => { editor.commands.undo(); });
  expect(change).toHaveBeenLastCalledWith(markdown);
  act(() => { editor.commands.redo(); });
  expect(change).toHaveBeenLastCalledWith(saved);
});

it('drags a table and its selected neighboring paragraph together while preserving the other table', async () => {
  const { editor, field, root, change } = await setup();
  await selectTable(editor);
  fireEvent.keyDown(field, { key: 'ArrowDown', shiftKey: true });
  const transfer = dragToEnd(editor), grip = screen.getByRole('button', { name: '内容块操作' });
  fireEvent.dragStart(grip, { dataTransfer: transfer });
  const preview = transfer.setDragImage.mock.calls[0]?.[0] as HTMLElement;
  expect(preview.children).toHaveLength(2);
  expect(preview.querySelectorAll('table')).toHaveLength(1);
  expect(preview.textContent).toBe('ABonetwothreefour中间');
  expect(transfer.setData).toHaveBeenCalledWith('text/plain', 'ABonetwothreefour\n\n中间');
  fireEvent.drop(root, { dataTransfer: transfer, clientX: 100, clientY: 429 });
  expect(blockOrder(editor)).toEqual(['开头', 'XYfivesix', '结尾', 'ABonetwothreefour', '中间']);
  expect(editor.state.selection).toBeInstanceOf(BlockRangeSelection);
  expect(field.querySelectorAll('table')).toHaveLength(2);
  act(() => { editor.commands.undo(); });
  expect(change).toHaveBeenLastCalledWith(markdown);
  expect(blockOrder(editor)).toEqual(['开头', 'ABonetwothreefour', '中间', 'XYfivesix', '结尾']);
});

it.each(['escape', 'dragend'] as const)('cancels a table drag with %s without editing or losing its previous caret', async cancellation => {
  const { editor, root, change } = await setup();
  selectCell(editor, 'one');
  const before = editor.state.selection.toJSON(), transfer = dragToEnd(editor), grip = screen.getByRole('button', { name: '内容块操作' });
  fireEvent.dragStart(grip, { dataTransfer: transfer });
  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
  if (cancellation === 'escape') fireEvent.keyDown(root, { key: 'Escape' });
  else fireEvent.dragEnd(grip);
  expect(editor.state.selection.toJSON()).toEqual(before);
  expect(root.querySelector('.block-drag-preview')).toBeNull();
  expect(root.hasAttribute('data-dragging')).toBe(false);
  fireEvent.drop(root, { dataTransfer: transfer, clientX: 100, clientY: 429 });
  fireEvent.dragEnd(grip);
  expect(change).not.toHaveBeenCalled();
  expect(blockOrder(editor)).toEqual(['开头', 'ABonetwothreefour', '中间', 'XYfivesix', '结尾']);
});

it('clears a cell range when resuming typing and round-trips the edit without view or selection markup', async () => {
  const { editor, field, change } = await setup();
  act(() => { editor.commands.setCellSelection({ anchorCell: position(editor, 'one') - 2, headCell: position(editor, 'two') - 2 }); editor.view.focus(); });
  expect(editor.state.selection).toBeInstanceOf(CellSelection);
  expect(field.querySelectorAll('.selectedCell')).toHaveLength(2);
  expect(field.querySelector('.rich-table-block.ProseMirror-selectednode, .rich-table-block.rich-selected-block')).toBeNull();
  selectCell(editor, 'one');
  expect(field.querySelectorAll('.selectedCell')).toHaveLength(0);
  act(() => { editor.commands.insertContent('edited '); });
  const saved = change.mock.lastCall![0] as string;
  expect(saved).not.toMatch(/rich-table-block|tableWrapper|selectedCell|rich-selected-block|ProseMirror-selectednode/);
  act(() => { editor.commands.undo(); });
  expect(change).toHaveBeenLastCalledWith(markdown);
  act(() => { editor.commands.redo(); });
  expect(change).toHaveBeenLastCalledWith(saved);
  cleanup();
  const reopened = await setup(saved);
  expect(reopened.field.querySelectorAll('table')).toHaveLength(2);
  expect(reopened.field.querySelector('td')?.textContent).toBe('edited one');
  expect(reopened.field.querySelectorAll('.selectedCell, .ProseMirror-selectednode, .rich-selected-block')).toHaveLength(0);
  expect(reopened.change).not.toHaveBeenCalled();
});

it.each([
  ['forward', 'one', 'four', 0, '左对齐', '右对齐', 'right'],
  ['backward', 'four', 'one', 1, '右对齐', '左对齐', 'left'],
] as const)('shows and changes the anchor column alignment for a %s cell range with one undo', async (_direction, anchor, head, column, checkedLabel, targetLabel, align) => {
  const { editor, field } = await setup();
  selectCell(editor, 'one');
  act(() => { alignRichColumn(editor, 'left'); });
  selectCell(editor, 'two');
  act(() => { alignRichColumn(editor, 'right'); });
  const before = editor.state.doc.toJSON(), otherTable = field.querySelectorAll('table')[1].outerHTML;
  act(() => { editor.commands.setCellSelection({ anchorCell: position(editor, anchor) - 2, headCell: position(editor, head) - 2 }); editor.view.focus(); });
  fireEvent.click(screen.getByRole('button', { name: `第 ${column + 1} 列操作` }));
  await screen.findByRole('menu', { name: '列操作菜单' });
  expect(screen.getByRole('menuitemradio', { name: checkedLabel }).getAttribute('aria-checked')).toBe('true');
  const target = screen.getByRole('menuitemradio', { name: targetLabel });
  expect(target.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(target);
  await waitFor(() => expect(screen.queryByRole('menu', { name: '列操作菜单' })).toBeNull());
  const table = editor.state.doc.child(1);
  for (let row = 0; row < table.childCount; row++) {
    expect(table.child(row).child(column).attrs.align).toBe(align);
    expect(table.child(row).child(1 - column).attrs.align).toBe(align);
  }
  expect(field.querySelectorAll('table')[1].outerHTML).toBe(otherTable);
  act(() => { editor.commands.undo(); });
  expect(editor.state.doc.toJSON()).toEqual(before);
});

it.each(['cell caret', 'cell text', 'cell range', 'table block'] as const)('dismisses table selection and tools after clicking the left page margin from a %s', async selection => {
  const { editor, field, root, change } = await setup(markdown, true);
  await selectTableMode(editor, selection);
  const page = pageGeometry(editor, field, root), before = editor.state.doc;
  fireEvent.pointerDown(page, { button: 0, clientX: 50, clientY: 200 });
  fireEvent.pointerUp(root, { clientX: 50, clientY: 200 });
  await waitFor(() => expect(editor.isFocused).toBe(false));
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  expect(root.querySelector('.rich-table-cell-outline')).toBeNull();
  expect(editor.state.selection.empty).toBe(true);
  expect(field.querySelectorAll('.selectedCell, .ProseMirror-selectednode, .rich-selected-block')).toHaveLength(0);
  expect(editor.state.doc).toBe(before);
  expect(change).not.toHaveBeenCalled();
});

it.each([[53, 202], [54, 200]] as const)('dismisses table tools after a page-margin click with small pointer jitter to %i,%i', async (x, y) => {
  const { editor, field, root, change } = await setup(markdown, true);
  selectCell(editor, 'one');
  const page = pageGeometry(editor, field, root), before = editor.state.doc;
  fireEvent.pointerDown(page, { button: 0, clientX: 50, clientY: 200 });
  fireEvent.pointerMove(root, { clientX: x, clientY: y });
  fireEvent.pointerUp(root, { clientX: x, clientY: y });
  await waitFor(() => expect(editor.isFocused).toBe(false));
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  expect(root.querySelector('.rich-table-cell-outline')).toBeNull();
  expect(editor.state.selection.empty).toBe(true);
  expect(editor.state.doc).toBe(before);
  expect(change).not.toHaveBeenCalled();
});

it.each(['cell caret', 'cell text', 'cell range', 'table block'] as const)('dismisses a %s on a touch in page whitespace without capturing scrolling', async selection => {
  const { editor, field, root, change } = await setup(markdown, true);
  await selectTableMode(editor, selection);
  const page = pageGeometry(editor, field, root), before = editor.state.doc;
  expect(fireEvent.pointerDown(page, { pointerType: 'touch', button: 0, clientX: 50, clientY: 200 })).toBe(true);
  await waitFor(() => expect(editor.isFocused).toBe(false));
  expect(editor.state.selection.empty).toBe(true);
  expect(field.querySelectorAll('.selectedCell, .ProseMirror-selectednode, .rich-selected-block')).toHaveLength(0);
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  expect(root.querySelector('.rich-table-cell-outline, .rich-selection-box')).toBeNull();
  expect(root.setPointerCapture).not.toHaveBeenCalled();
  expect(editor.state.doc).toBe(before);
  expect(change).not.toHaveBeenCalled();
});

it.each(['cell text', 'cell range', 'table block'] as const)('restores the exact %s selection when a page-margin drag is cancelled with Escape', async selection => {
  const { editor, field, root, change } = await setup(markdown, true);
  await selectTableMode(editor, selection);
  const page = pageGeometry(editor, field, root), before = editor.state.doc, previous = editor.state.selection.toJSON();
  fireEvent.pointerDown(page, { button: 0, clientX: 50, clientY: 200 });
  fireEvent.pointerMove(root, { clientX: 160, clientY: 360 });
  fireEvent.keyDown(field, { key: 'Escape' });
  expect(editor.state.selection.toJSON()).toEqual(previous);
  expect(editor.isFocused).toBe(true);
  expect(root.querySelector('.rich-selection-box')).toBeNull();
  fireEvent.pointerUp(root, { clientX: 160, clientY: 360 });
  expect(editor.state.selection.toJSON()).toEqual(previous);
  expect(editor.state.doc).toBe(before);
  expect(change).not.toHaveBeenCalled();
});

it.each([
  { side: 'right', x: 620, y: 200, selection: 'cell range' },
  { side: 'above', x: 50, y: 80, selection: 'cell range' },
  { side: 'right', x: 620, y: 200, selection: 'table block' },
  { side: 'above', x: 50, y: 80, selection: 'table block' },
] as const)('clears a $side page-margin click from a $selection', async ({ x, y, selection }) => {
  const { editor, field, root, change } = await setup(markdown, true);
  await selectTableMode(editor, selection);
  const page = pageGeometry(editor, field, root), before = editor.state.doc;
  fireEvent.pointerDown(page, { button: 0, clientX: x, clientY: y });
  fireEvent.pointerUp(page, { clientX: x, clientY: y });
  await waitFor(() => expect(editor.isFocused).toBe(false));
  expect.soft(editor.state.selection.empty).toBe(true);
  expect.soft(field.querySelectorAll('.selectedCell, .ProseMirror-selectednode, .rich-selected-block')).toHaveLength(0);
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  expect(root.querySelector('.rich-table-cell-outline')).toBeNull();
  expect(editor.state.doc).toBe(before);
  expect(change).not.toHaveBeenCalled();
});

it('still selects the table and neighboring paragraph when the same left page margin gesture is dragged into content', async () => {
  const { editor, field, root, change } = await setup(markdown, true);
  selectCell(editor, 'one');
  const page = pageGeometry(editor, field, root), before = editor.state.doc;
  fireEvent.pointerDown(page, { button: 0, clientX: 50, clientY: 200 });
  fireEvent.pointerMove(root, { clientX: 160, clientY: 360 });
  fireEvent.pointerUp(root, { clientX: 160, clientY: 360 });
  expect(editor.isFocused).toBe(true);
  expect(editor.state.selection).toBeInstanceOf(BlockRangeSelection);
  expect([...field.querySelectorAll('.rich-selected-block')].map(node => node.textContent)).toEqual(['ABonetwothreefour', '中间']);
  expect(root.querySelector('.rich-selection-box')).toBeNull();
  expect(editor.state.doc).toBe(before);
  expect(change).not.toHaveBeenCalled();
});

it('dismisses the selected table and its open block menu when clicking page whitespace', async () => {
  const { editor, field, root, change } = await setup(markdown, true);
  selectCell(editor, 'one');
  const page = pageGeometry(editor, field, root), before = editor.state.doc;
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '内容块操作' }));
  await screen.findByRole('menu', { name: '内容块操作菜单' });
  expect(editor.state.selection).toBeInstanceOf(NodeSelection);
  await user.pointer({ target: page, coords: { clientX: 50, clientY: 200 }, keys: '[MouseLeft]' });
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  await act(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await waitFor(() => expect(editor.isFocused).toBe(false));
  expect(editor.state.selection.empty).toBe(true);
  expect(field.querySelectorAll('.selectedCell, .ProseMirror-selectednode, .rich-selected-block')).toHaveLength(0);
  expect(screen.queryByRole('group', { name: '表格操作' })).toBeNull();
  expect(root.querySelector('.rich-table-cell-outline')).toBeNull();
  expect(editor.state.doc).toBe(before);
  expect(change).not.toHaveBeenCalled();
});
