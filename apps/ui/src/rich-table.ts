import { Table, TableRow, TableHeader } from '@tiptap/extension-table';
import { DOMSerializer, DOMParser } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';
import { editRichStructure } from './rich-blocks';
import type { Editor } from '@tiptap/react';

export function richTable(getEditor: () => Editor | null) {
  return Table.extend({
    addAttributes() { return { ...this.parent?.(), caption: { default: '', rendered: false, parseHTML: element => element.querySelector(':scope > caption')?.textContent ?? '' } }; },
    parseHTML() { return [{ tag: 'table', getContent: (element, schema) => {
      const table = element.cloneNode(true) as HTMLElement;
      table.querySelector(':scope > caption')?.remove();
      return DOMParser.fromSchema(schema).parse(table, { topNode: schema.nodes.table.create() }).content;
    } }]; },
    renderHTML({ node, HTMLAttributes }) {
      return ['table', HTMLAttributes, ...(node.attrs.caption ? [['caption', { contenteditable: 'false' }, node.attrs.caption]] : []), ['tbody', 0]];
    },
    renderMarkdown(node, helpers, context) {
      const mixedAlignment = node.content?.some(row => row.content?.some((cell, index) => (cell.attrs?.align ?? null) !== (node.content?.[0]?.content?.[index]?.attrs?.align ?? null)));
      const complex = mixedAlignment || node.attrs?.caption || node.content?.some(row => row.attrs?.footer || row.content?.some(cell => cell.attrs?.scope || Number(cell.attrs?.colspan ?? 1) > 1 || Number(cell.attrs?.rowspan ?? 1) > 1));
      if (!complex) return Table.config.renderMarkdown?.call(this, node, helpers, context) ?? '';
      const editor = getEditor();
      if (!editor) return '';
      const table = DOMSerializer.fromSchema(editor.schema).serializeNode(editor.schema.nodeFromJSON(node)) as HTMLElement;
      table.querySelector('caption')?.removeAttribute('contenteditable');
      table.querySelectorAll<HTMLElement>('td, th').forEach(cell => { if (cell.style.textAlign) { cell.setAttribute('align', cell.style.textAlign); cell.removeAttribute('style'); } });
      const footer = document.createElement('tfoot');
      table.querySelectorAll('tr[data-footer]').forEach(row => { row.removeAttribute('data-footer'); footer.append(row); });
      if (footer.childNodes.length) table.append(footer);
      return table.outerHTML;
    },
  }).configure({ resizable: false });
}
export const RichTableRow = TableRow.extend({
  addAttributes() { return { ...this.parent?.(), footer: { default: false, parseHTML: element => element.parentElement?.tagName === 'TFOOT', renderHTML: attrs => attrs.footer ? { 'data-footer': '' } : {} } }; },
});
export const RichTableHeader = TableHeader.extend({
  addAttributes() { return { ...this.parent?.(), scope: { default: null, parseHTML: element => element.getAttribute('scope') } }; },
});

export function alignRichColumn(editor: Editor, align: string) {
  const { $from } = editor.state.selection;
  let tableDepth = 0, cellDepth = 0;
  for (let d = $from.depth; d > 0; d--) {
    if (['tableCell', 'tableHeader'].includes($from.node(d).type.name)) cellDepth = d;
    if ($from.node(d).type.name === 'table') { tableDepth = d; break; }
  }
  if (!tableDepth || !cellDepth) return;
  const start = $from.start(tableDepth), table = $from.node(tableDepth), map = TableMap.get(table);
  const column = map.findCell($from.before(cellDepth) - start).left;
  editRichStructure(editor, () => {
    const tr = editor.state.tr, cells = new Set<number>();
    for (let row = 0; row < map.height; row++) cells.add(start + map.map[row * map.width + column]);
    for (const pos of cells) { const cell = tr.doc.nodeAt(pos)!; tr.setNodeMarkup(pos, undefined, { ...cell.attrs, align }); }
    editor.view.dispatch(tr); editor.view.focus();
  });
}
