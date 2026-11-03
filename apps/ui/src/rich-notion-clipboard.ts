import type { Node, Slice } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { calloutColor } from './import-layout';

export const notionClipboardType = 'text/_notion-blocks-v3-production';
type RichText = [string, string[][]?][];
type Block = {
  id: string; type: string; alive: true; parent_id?: string; parent_table?: 'block';
  properties?: Record<string, RichText>; format?: Record<string, unknown>; content?: string[];
};

// Notion's native clipboard format is private. Keep standard HTML as the fallback,
// and emit native blocks only when the entire selected slice is representable.
export function notionClipboard(slice: Slice): string | null {
  let hasCallout = false, supported = true;
  slice.content.descendants(node => { if (node.type.name === 'aside') hasCallout = true; });
  if (!hasCallout) return null;
  const blocks: Record<string, { value: Block }> = {};
  function inline(node: Node, color?: string): RichText {
    const text: RichText = [];
    node.forEach(child => {
      if (child.type.name === 'hardBreak') { text.push(['\n']); return; }
      if (!child.isText) { supported = false; return; }
      const annotations: string[][] = color ? [['h', color]] : [];
      for (const mark of child.marks) {
        const style = { bold: 'b', italic: 'i', strike: 's', underline: '_', code: 'c' }[mark.type.name];
        if (style) annotations.push([style]);
        else if (mark.type.name === 'link') annotations.push(['a', String(mark.attrs.href)]);
        else supported = false;
      }
      text.push(annotations.length ? [child.text!, annotations] : [child.text!]);
    });
    return text;
  }
  function add(type: string, parent?: string): Block {
    const block: Block = { id: crypto.randomUUID(), type, alive: true, ...(parent ? { parent_id: parent, parent_table: 'block' } : {}) };
    blocks[block.id] = { value: block };
    return block;
  }
  function children(node: Node, parent?: string, color?: string): string[] {
    const ids: string[] = [];
    node.forEach(child => ids.push(...convert(child, parent, color)));
    return ids;
  }
  function titled(node: Node, type: string, parent?: string, color?: string): string[] {
    const block = add(type, parent);
    block.properties = { title: inline(node, color) };
    return [block.id];
  }
  function convert(node: Node, parent?: string, color?: string): string[] {
    const name = node.type.name;
    if (name === 'paragraph') return titled(node, 'text', parent, color);
    if (name === 'heading' && node.attrs.level <= 3) return titled(node, ['header', 'sub_header', 'sub_sub_header'][node.attrs.level - 1], parent, color);
    if (name === 'horizontalRule') return [add('divider', parent).id];
    if (name === 'aside') {
      const block = add('callout', parent), background = calloutColor(node.attrs.color);
      block.format = { callout_version: 2, block_color: background && background !== 'default' ? `${background}_background` : 'default', ...(node.attrs.icon ? { page_icon: node.attrs.icon } : {}) };
      const textColor = calloutColor(node.attrs.textColor);
      block.content = children(node, block.id, textColor && textColor !== 'default' ? textColor : color);
      return [block.id];
    }
    if (name === 'bulletList' || name === 'orderedList') {
      if (name === 'orderedList' && node.attrs.start !== 1) supported = false;
      const ids: string[] = [];
      node.forEach(item => {
        const block = add(name === 'bulletList' ? 'bulleted_list' : 'numbered_list', parent);
        if (item.firstChild?.type.name !== 'paragraph') { supported = false; return; }
        block.properties = { title: inline(item.firstChild, color) };
        const rest: string[] = [];
        item.forEach((child, _offset, index) => { if (index > 0) rest.push(...convert(child, block.id, color)); });
        if (rest.length) block.content = rest;
        ids.push(block.id);
      });
      return ids;
    }
    if (name === 'blockquote') {
      const block = add('quote', parent);
      if (node.firstChild?.type.name !== 'paragraph') { supported = false; return []; }
      block.properties = { title: inline(node.firstChild, color) };
      const rest: string[] = [];
      node.forEach((child, _offset, index) => { if (index > 0) rest.push(...convert(child, block.id, color)); });
      if (rest.length) block.content = rest;
      return [block.id];
    }
    if (name === 'table') {
      if (node.attrs.caption) supported = false;
      const table = add('table', parent), width = node.firstChild?.childCount ?? 0;
      const columns = Array.from({ length: width }, () => crypto.randomUUID());
      let headers = true;
      node.firstChild?.forEach(cell => { if (cell.type.name !== 'tableHeader') headers = false; });
      table.format = { table_block_column_order: columns, table_block_column_header: headers };
      table.content = [];
      node.forEach((row, _offset, rowIndex) => {
        if (row.childCount !== width || row.attrs.footer) supported = false;
        const block = add('table_row', table.id);
        block.properties = {};
        row.forEach((cell, _cellOffset, column) => {
          if (cell.attrs.colspan !== 1 || cell.attrs.rowspan !== 1 || cell.attrs.scope || cell.attrs.align || (cell.type.name === 'tableHeader') !== (headers && rowIndex === 0)) supported = false;
          const text: RichText = [];
          cell.forEach((paragraph, _paragraphOffset, index) => {
            if (paragraph.type.name !== 'paragraph') supported = false;
            if (index) text.push(['\n']);
            text.push(...inline(paragraph, color));
          });
          block.properties![columns[column]] = text;
        });
        table.content!.push(block.id);
      });
      return [table.id];
    }
    supported = false;
    return [];
  }
  const roots: string[] = [];
  slice.content.forEach(node => roots.push(...convert(node)));
  if (!supported) return null;
  function subtree(id: string, result: typeof blocks) {
    result[id] = blocks[id];
    blocks[id].value.content?.forEach(child => subtree(child, result));
    return result;
  }
  return JSON.stringify({ blocks: roots.map(blockId => ({ blockId, blockSubtree: { __version__: 3, block: subtree(blockId, {}) } })), action: 'copy', wasContiguousSelection: true });
}

export function copyForNotion(view: EditorView, event: ClipboardEvent): boolean {
  if (!event.clipboardData || view.state.selection.empty) return false;
  const slice = view.state.selection.content(), native = notionClipboard(slice);
  if (!native) return false;
  const { dom, text } = view.serializeForClipboard(slice);
  event.clipboardData.clearData();
  event.clipboardData.setData('text/html', dom.innerHTML);
  event.clipboardData.setData('text/plain', text);
  event.clipboardData.setData(notionClipboardType, native);
  event.preventDefault();
  return true;
}
