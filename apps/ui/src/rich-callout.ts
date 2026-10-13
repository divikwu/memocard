import type { Editor } from '@tiptap/react';
import { Fragment } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { editRichStructure, type RichBlock } from './rich-blocks';

export const newCallout = { color: 'gray', icon: '💡' };

export function updateCallout(editor: Editor, pos: number, attrs: Record<string, string | null>) {
  const node = editor.state.doc.nodeAt(pos);
  if (!editor.isEditable || node?.type.name !== 'aside' || Object.entries(attrs).every(([key, value]) => node.attrs[key] === value)) return;
  editRichStructure(editor, () => editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs })));
}

export function canWrapCallout(editor: Editor, blocks: RichBlock[]): boolean {
  const first = blocks[0], last = blocks.at(-1);
  if (!first || !last || blocks.some(block => block.parent !== first.parent)) return false;
  const type = editor.schema.nodes.aside;
  const content = Fragment.fromArray(blocks.map(block => block.node));
  const parent = editor.state.doc.resolve(first.pos).parent;
  return type.validContent(content) && parent.canReplace(first.index, last.index + 1, Fragment.from(type.create(newCallout, content)));
}

export function wrapCallout(editor: Editor, blocks: RichBlock[]) {
  if (!editor.isEditable || !canWrapCallout(editor, blocks)) return;
  const first = blocks[0], last = blocks.at(-1)!;
  const node = editor.schema.nodes.aside.create(newCallout, blocks.map(block => block.node));
  editRichStructure(editor, () => {
    const tr = editor.state.tr.replaceWith(first.pos, last.pos + last.node.nodeSize, node);
    tr.setSelection(TextSelection.near(tr.doc.resolve(first.pos + 2)));
    editor.view.dispatch(tr.scrollIntoView());
  });
}

export function unwrapCallout(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (!editor.isEditable || node?.type.name !== 'aside') return;
  const resolved = editor.state.doc.resolve(pos);
  if (!resolved.parent.canReplace(resolved.index(), resolved.index() + 1, node.content)) return;
  editRichStructure(editor, () => {
    const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, node.content);
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
    editor.view.dispatch(tr.scrollIntoView());
  });
}
