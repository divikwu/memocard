import { closeHistory } from '@tiptap/pm/history';
import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';
export type RichBlock = { pos: number; parent: number; node: Node; index: number };
export function richBlock(editor: Editor, position: number): RichBlock | null {
  const resolved = editor.state.doc.resolve(Math.max(0, Math.min(position, editor.state.doc.content.size)));
  let depth = resolved.depth;
  while (depth > 1 && !['listItem', 'taskItem'].includes(resolved.node(depth).type.name)) depth--;
  if (!depth) {
    const node = resolved.nodeAfter;
    return node ? { pos: resolved.pos, parent: -1, node, index: resolved.index() } : null;
  }
  return { pos: resolved.before(depth), parent: depth === 1 ? -1 : resolved.before(depth - 1), node: resolved.node(depth), index: resolved.index(depth - 1) };
}
export function moveRichBlock(editor: Editor, source: RichBlock, target: RichBlock, after: boolean): boolean {
  if (!editor.isEditable || editor.view.composing || source.parent !== target.parent || source.pos === target.pos) return false;
  const destination = target.pos + (after ? target.node.nodeSize : 0);
  if (destination === source.pos || destination === source.pos + source.node.nodeSize) return false;
  const tr = editor.state.tr.delete(source.pos, source.pos + source.node.nodeSize);
  const mapped = tr.mapping.map(destination);
  tr.insert(mapped, source.node).setSelection(NodeSelection.create(tr.doc, mapped));
  editor.view.dispatch(tr.scrollIntoView()); editor.view.focus(); return true;
}

export function richBlockAt(editor: Editor, pos: number): RichBlock | null {
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return null;
  const resolved = editor.state.doc.resolve(pos);
  return { pos, node, parent: resolved.depth ? resolved.before(resolved.depth) : -1, index: resolved.index() };
}

export function editRichStructure(editor: Editor, operation: () => void) {
  if (editor.view.composing) return;
  editor.view.dispatch(closeHistory(editor.state.tr));
  operation();
  editor.view.dispatch(closeHistory(editor.state.tr));
}
