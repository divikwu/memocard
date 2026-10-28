// @vitest-environment jsdom
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableCell } from '@tiptap/extension-table';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { alignRichColumn, richTable, RichTableHeader, RichTableRow } from './rich-table';
import { MarkdownSource, PreservedMarkdown, SourceMetadata } from './wysiwyg-markdown';

const editors: Editor[] = [];
const markdown = '| A | B |\n| --- | --- |\n| one | two |';
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); vi.unstubAllGlobals(); });
function setup(body: string) {
  const editor: Editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false }), Markdown, SourceMetadata, PreservedMarkdown, richTable(() => editor), RichTableRow, RichTableHeader, TableCell] });
  editors.push(editor);
  const source = new MarkdownSource();
  editor.commands.setContent(source.parse(editor, body), { emitUpdate: false });
  return { editor, text: () => source.serialize(editor) };
}
function position(editor: Editor, text: string) {
  let position = 0;
  editor.state.doc.descendants((node, pos) => { if (node.isText && node.text === text) position = pos; });
  expect(position).toBeGreaterThan(0);
  return position;
}
function cellTypes(editor: Editor) {
  return Array.from(editor.view.dom.querySelectorAll('tr'), row => Array.from(row.cells, cell => cell.tagName));
}

it('keeps a removed header row removed without inserting a blank row on reopen', () => {
  const { editor, text } = setup(markdown);
  editor.commands.setTextSelection(position(editor, 'one'));
  expect(editor.commands.toggleHeaderRow()).toBe(true);
  expect(text()).toContain('<table');
  const reopened = setup(text()).editor;
  expect(cellTypes(reopened)).toEqual([['TD', 'TD'], ['TD', 'TD']]);
  expect(reopened.view.dom.querySelectorAll('tr')).toHaveLength(2);
  expect(reopened.getText()).toBe(editor.getText());
});

it('preserves a header column together with its existing header row', () => {
  const { editor, text } = setup(markdown);
  editor.commands.setTextSelection(position(editor, 'one'));
  expect(editor.commands.toggleHeaderColumn()).toBe(true);
  expect(cellTypes(editor)).toEqual([['TH', 'TH'], ['TH', 'TD']]);
  expect(text()).toContain('<table');
  const reopened = setup(text()).editor;
  expect(cellTypes(reopened)).toEqual([['TH', 'TH'], ['TH', 'TD']]);
  expect(reopened.getText()).toBe(editor.getText());
});

it('preserves a partially headed first row after editing a cell', () => {
  const { editor, text } = setup('<table><tr><th>A</th><td>B</td></tr><tr><td>one</td><td>two</td></tr></table>');
  editor.commands.insertContentAt(position(editor, 'two'), 'new ');
  expect(text()).toContain('<table');
  const reopened = setup(text()).editor;
  expect(cellTypes(reopened)).toEqual([['TH', 'TD'], ['TD', 'TD']]);
  expect(reopened.view.dom.querySelector('tr:last-child td:last-child')?.textContent).toBe('new two');
});

it('continues saving an ordinary header row as Markdown after editing', () => {
  const { editor, text } = setup(markdown);
  editor.commands.insertContentAt(position(editor, 'one'), 'new ');
  expect(text()).toMatch(/^\| A/);
  expect(text()).not.toContain('<table');
  const reopened = setup(text()).editor;
  expect(cellTypes(reopened)).toEqual([['TH', 'TH'], ['TD', 'TD']]);
  expect(reopened.view.dom.querySelector('td')?.textContent).toBe('new one');
});

it.each([
  { anchor: 'one', head: 'four', column: 0 },
  { anchor: 'four', head: 'one', column: 1 },
])('aligns the anchor column shown by the menu for a rectangular range from $anchor to $head', ({ anchor, head, column }) => {
  const { editor, text } = setup(markdown + '\n| three | four |');
  editor.commands.setCellSelection({ anchorCell: position(editor, anchor) - 2, headCell: position(editor, head) - 2 });
  alignRichColumn(editor, 'center');
  const alignment = Array.from(editor.view.dom.querySelectorAll('tr'), row => Array.from(row.cells, cell => cell.style.textAlign));
  expect(alignment).toEqual(Array.from({ length: 3 }, () => column === 0 ? ['center', ''] : ['', 'center']));
  const reopened = setup(text()).editor;
  expect(Array.from(reopened.view.dom.querySelectorAll('tr'), row => row.cells[column].style.textAlign)).toEqual(['center', 'center', 'center']);
});

it('retains merged spans, caption, header scope and footer through an edited round trip', () => {
  const body = '<table><caption>Summary</caption><tbody><tr><th scope="col">A</th><th>B</th><th>C</th></tr><tr><td rowspan="2">one</td><td colspan="2">two</td></tr><tr><td>three</td><td>four</td></tr></tbody><tfoot><tr><td>End</td><td>5</td><td>6</td></tr></tfoot></table>';
  const { editor, text } = setup(body);
  editor.commands.insertContentAt(position(editor, 'two'), 'new ');
  expect(text()).toContain('<tfoot>');
  const reopened = setup(text()).editor;
  expect(text()).toContain('<caption>Summary</caption>');
  expect(reopened.state.doc.firstChild?.attrs.caption).toBe('Summary');
  expect(reopened.view.dom.querySelector('th')?.getAttribute('scope')).toBe('col');
  expect(reopened.view.dom.querySelector('td[rowspan="2"]')?.textContent).toBe('one');
  expect(reopened.view.dom.querySelector('td[colspan="2"]')?.textContent).toBe('new two');
  expect(reopened.state.doc.firstChild?.lastChild?.attrs.footer).toBe(true);
  expect(cellTypes(reopened)).toEqual(cellTypes(editor));
});
