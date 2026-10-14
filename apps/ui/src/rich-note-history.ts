import { Extension, type Editor } from '@tiptap/react';
import { EditorState } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import type { Node } from '@tiptap/pm/model';
import type { PropertyChange } from '@memocard/contracts';
import { editRichStructure } from './rich-blocks';

export type NoteEdit = { title?: string; properties: Record<string, PropertyChange> };
export const noteEdit = (doc: Node): NoteEdit => doc.attrs.noteEdit ?? { properties: {} };
export const RichNoteHistory = Extension.create({
  name: 'noteHistory',
  addGlobalAttributes: () => [{ types: ['doc'], attributes: { noteEdit: { default: null, rendered: false } } }],
});

let composition = -1;
const titleGroups = new WeakMap<Editor, { doc: Node; time: number; composition: number }>();

export function changeNoteTitle(editor: Editor, title: string) {
  if (!editor.isEditable || editor.view.composing) return;
  const before = noteEdit(editor.state.doc);
  if (before.title === title) return;
  const previous = titleGroups.get(editor), time = Date.now();
  const grouped = previous && previous.doc === editor.state.doc && time - previous.time < 500;
  if (!grouped) editor.view.dispatch(closeHistory(editor.state.tr));
  const group = grouped ? previous.composition : composition--;
  editor.view.dispatch(editor.state.tr.setDocAttribute('noteEdit', { ...before, title }).setMeta('composition', group));
  titleGroups.set(editor, { doc: editor.state.doc, time, composition: group });
}

export function endNoteTyping(editor: Editor) {
  titleGroups.delete(editor);
  editor.view.dispatch(closeHistory(editor.state.tr));
}

export function changeNoteProperty(editor: Editor, change: PropertyChange, previous: PropertyChange) {
  if (!editor.isEditable || editor.view.composing) return false;
  const before = noteEdit(editor.state.doc);
  if (JSON.stringify(previous.value) === JSON.stringify(change.value)) return false;
  // Seed only the first value, outside history; later undo restores this exact baseline.
  if (!Object.hasOwn(before.properties, change.name)) {
    editor.view.dispatch(editor.state.tr.setDocAttribute('noteEdit', {
      ...before, properties: { ...before.properties, [change.name]: previous },
    }).setMeta('addToHistory', false).setMeta('noteHistorySeed', true));
  }
  editRichStructure(editor, () => editor.view.dispatch(editor.state.tr.setDocAttribute('noteEdit', {
    ...noteEdit(editor.state.doc), properties: { ...noteEdit(editor.state.doc).properties, [change.name]: change },
  })));
  return true;
}

// A reload, copy, or library schema operation establishes a new page history boundary.
export function resetNoteHistory(editor: Editor, title?: string) {
  titleGroups.delete(editor);
  const { doc, selection, plugins } = editor.state;
  const next = doc.type.create({ ...doc.attrs, noteEdit: { title, properties: {} } }, doc.content, doc.marks);
  editor.view.updateState(EditorState.create({ doc: next, selection: selection.map(next, editor.state.tr.mapping), plugins }));
}
