import type { Editor } from '@tiptap/react';
import { Fragment, type Node } from '@tiptap/pm/model';
import { Selection, type Transaction } from '@tiptap/pm/state';
import { imageColumns } from './import-layout';
import { editRichStructure } from './rich-blocks';

export const isLayoutImage = (node: Node | null | undefined) => !!node && ['image', 'wikiImage'].includes(node.type.name);
export type ImageRow = { pos: number; node: Node; images: Node[]; widths: number[]; caption: Node | null; parent: Node; index: number };

export function imageRow(editor: Editor, pos: number): ImageRow | null {
  const { doc } = editor.state;
  if (pos < 0 || pos >= doc.content.size) return null;
  const resolved = doc.resolve(pos);
  if (resolved.parent.type.name === 'figure') pos = resolved.before();
  const at = doc.resolve(pos), node = at.nodeAfter;
  if (!node) return null;
  if (isLayoutImage(node)) return { pos, node, images: [node], widths: [100], caption: null, parent: at.parent, index: at.index() };
  if (node.type.name !== 'figure') return null;
  const children: Node[] = []; node.forEach(child => children.push(child));
  const caption = children.at(-1)?.type.name === 'figcaption' ? children.pop()! : null;
  if (!children.length || children.length > 3 || !children.every(isLayoutImage)) return null;
  const widths = imageColumns(node.attrs.columns);
  if (children.length > 1 && widths?.length !== children.length) return null;
  return { pos, node, images: children, widths: widths ?? [100], caption, parent: at.parent, index: at.index() };
}

export function imageIndex(row: ImageRow, pos: number): number {
  if (isLayoutImage(row.node)) return 0;
  let offset = row.pos + 1;
  for (let i = 0; i < row.images.length; i++) { if (pos === offset) return i; offset += row.images[i].nodeSize; }
  return -1;
}

function rowNodes(editor: Editor, row: ImageRow, images: Node[], widths: number[], caption = row.caption): Node[] {
  if (!images.length) return caption ? [editor.schema.nodes.figure.create({ ...row.node.attrs, columns: null }, caption)] : [];
  if (images.length === 1 && !caption) return images;
  return [editor.schema.nodes.figure.create({ ...row.node.attrs, columns: images.length > 1 ? widths.join(',') : null }, [...images, ...(caption ? [caption] : [])])];
}

function replaceRows(editor: Editor, changes: { row: Pick<ImageRow, 'pos' | 'node' | 'parent' | 'index'>; nodes: Node[] }[]): Transaction | null {
  const tr = editor.state.tr;
  for (const { row, nodes } of changes.sort((a, b) => b.row.pos - a.row.pos)) {
    const content = Fragment.fromArray(nodes);
    if (!row.parent.canReplace(row.index, row.index + 1, content)) return null;
    tr.replaceWith(row.pos, row.pos + row.node.nodeSize, content);
  }
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(changes.at(-1)!.row.pos, tr.doc.content.size))));
  return tr;
}

export function imageMoveTransaction(editor: Editor, sourcePos: number, targetPos: number, side: 'left' | 'right' | 'above' | 'below'): Transaction | null {
  if (!editor.isEditable || editor.view.composing) return null;
  const source = imageRow(editor, sourcePos), target = imageRow(editor, targetPos);
  if (!source) return null;
  if (!target) {
    if (side === 'left' || side === 'right' || source.pos === targetPos || targetPos < 0 || targetPos >= editor.state.doc.content.size) return null;
    const at = editor.state.doc.resolve(targetPos), node = at.nodeAfter, index = imageIndex(source, sourcePos);
    if (!node?.isBlock || at.parent !== source.parent || index < 0) return null;
    const image = source.images[index];
    return replaceRows(editor, [
      { row: source, nodes: rowNodes(editor, source, source.images.filter((_, i) => i !== index), source.widths.filter((_, i) => i !== index)) },
      { row: { pos: targetPos, node, parent: at.parent, index: at.index() }, nodes: side === 'above' ? [image, node] : [node, image] },
    ]);
  }
  if (source.parent !== target.parent) return null;
  const index = imageIndex(source, sourcePos), targetIndex = imageIndex(target, targetPos);
  if (index < 0 || targetIndex < 0 || sourcePos === targetPos) return null;
  const image = source.images[index], images = source.images.filter((_, i) => i !== index), widths = source.widths.filter((_, i) => i !== index);
  const horizontal = side === 'left' || side === 'right';
  if (source.pos === target.pos) {
    if (horizontal) {
      const destination = targetIndex + (side === 'right' ? 1 : 0) - (index < targetIndex ? 1 : 0);
      if (destination === index) return null;
      images.splice(destination, 0, image); widths.splice(destination, 0, source.widths[index]);
      return replaceRows(editor, [{ row: source, nodes: rowNodes(editor, source, images, widths) }]);
    }
    const remaining = rowNodes(editor, source, images, widths);
    return replaceRows(editor, [{ row: source, nodes: side === 'above' ? [image, ...remaining] : [...remaining, image] }]);
  }
  if (horizontal && target.images.length >= 3) return null;
  let targetNodes: Node[];
  if (horizontal) {
    const next = [...target.images], nextWidths = target.widths.map(width => width / target.widths.reduce((a, b) => a + b, 0) * 100 * target.images.length / (target.images.length + 1));
    const destination = targetIndex + (side === 'right' ? 1 : 0);
    next.splice(destination, 0, image); nextWidths.splice(destination, 0, 100 / next.length);
    targetNodes = rowNodes(editor, target, next, nextWidths.map(width => Math.round(width * 1000) / 1000));
  } else targetNodes = side === 'above' ? [image, target.node] : [target.node, image];
  return replaceRows(editor, [{ row: source, nodes: rowNodes(editor, source, images, widths) }, { row: target, nodes: targetNodes }]);
}

export function applyImageTransaction(editor: Editor, tr: Transaction | null): boolean {
  if (!tr) return false;
  editRichStructure(editor, () => editor.view.dispatch(tr.scrollIntoView())); editor.view.focus(); return true;
}

export function adjacentImage(editor: Editor, pos: number, direction: -1 | 1): number | null {
  const row = imageRow(editor, pos);
  if (!row) return null;
  const index = row.index + direction;
  if (index < 0 || index >= row.parent.childCount) return null;
  const targetPos = direction < 0 ? row.pos - row.parent.child(index).nodeSize : row.pos + row.node.nodeSize;
  const target = imageRow(editor, targetPos);
  return target ? target.pos + (isLayoutImage(target.node) ? 0 : 1) : null;
}

export function setImageWidths(editor: Editor, pos: number, widths: number[]): boolean {
  const row = imageRow(editor, pos);
  if (!editor.isEditable || !row || row.images.length < 2 || widths.length !== row.images.length || !widths.every(width => Number.isFinite(width) && width > 0)) return false;
  const normalize = (values: number[]) => values.map(width => Math.round(width / values.reduce((a, b) => a + b, 0) * 100000) / 1000);
  const normalized = normalize(widths);
  if (normalized.join(',') === normalize(row.widths).join(',')) return false;
  return applyImageTransaction(editor, editor.state.tr.setNodeMarkup(row.pos, undefined, { ...row.node.attrs, columns: normalized.join(',') }));
}

export function splitImageRow(editor: Editor, pos: number, onlySelected = false): boolean {
  const row = imageRow(editor, pos);
  if (!editor.isEditable || !row || row.images.length < 2) return false;
  const index = imageIndex(row, pos);
  if (onlySelected && index < 0) return false;
  const nodes = onlySelected ? [...rowNodes(editor, row, row.images.filter((_, i) => i !== index), row.widths.filter((_, i) => i !== index)), row.images[index]]
    : [...row.images, ...(row.caption ? [editor.schema.nodes.figure.create({ ...row.node.attrs, columns: null }, row.caption)] : [])];
  return applyImageTransaction(editor, replaceRows(editor, [{ row, nodes }]));
}

export function arrangeImageRows(editor: Editor, from: number, to: number, columns: 2 | 3, apply = true): boolean {
  if (!editor.isEditable) return false;
  const rows: ImageRow[] = [];
  for (let pos = from; pos < to;) {
    const row = imageRow(editor, pos);
    if (!row || row.pos !== pos || row.caption || rows.length && row.parent !== rows[0].parent) return false;
    rows.push(row); pos += row.node.nodeSize;
    if (pos > to) return false;
  }
  const images = rows.flatMap(row => row.images);
  if (images.length < 2) return false;
  if (!apply) return true;
  const nodes: Node[] = [];
  for (let i = 0; i < images.length; i += columns) {
    const chunk = images.slice(i, i + columns);
    nodes.push(...rowNodes(editor, rows[0], chunk, chunk.map(() => 1), null));
  }
  if (!rows[0].parent.canReplace(rows[0].index, rows.at(-1)!.index + 1, Fragment.fromArray(nodes))) return false;
  const tr = editor.state.tr.replaceWith(from, to, nodes);
  if (tr.doc.eq(editor.state.doc)) return false;
  tr.setSelection(Selection.near(tr.doc.resolve(from)));
  return applyImageTransaction(editor, tr);
}
