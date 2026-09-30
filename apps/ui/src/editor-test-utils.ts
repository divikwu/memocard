import type { Editor } from '@tiptap/react';
import { act, screen } from '@testing-library/react';

export function noteEditor(element: HTMLElement = screen.getByRole('textbox', { name: '笔记内容' })) {
  const editor = (element as HTMLElement & { editor?: Editor }).editor;
  if (!editor) throw new Error('The note textbox must belong to a real Tiptap editor');
  return editor;
}
export function readEditorText(element?: HTMLElement) { return noteEditor(element).getMarkdown(); }
export function replaceEditorText(body: string, element?: HTMLElement) {
  const editor = noteEditor(element);
  act(() => { editor.commands.setContent(body, { contentType: 'markdown' }); });
}
export function moveEditorCaretToEnd(element?: HTMLElement) {
  const editor = noteEditor(element);
  act(() => { editor.commands.setTextSelection(editor.state.doc.content.size - 1); });
}
