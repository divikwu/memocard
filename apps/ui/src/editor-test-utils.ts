import type { Editor } from '@tiptap/react';
import { act, screen, within } from '@testing-library/react';
import { closeHistory } from '@tiptap/pm/history';

export function noteEditor(element: HTMLElement = screen.getByRole('textbox', { name: '笔记内容' })) {
  const editor = (element as HTMLElement & { editor?: Editor }).editor;
  if (!editor) throw new Error('The note textbox must belong to a real Tiptap editor');
  return editor;
}
export function readEditorText(element?: HTMLElement) { return noteEditor(element).getMarkdown(); }
export function noteSourceButton() {
  return within(screen.getByRole('navigation', { name: '当前位置' })).getAllByRole('button').at(-1)!;
}
export function replaceEditorText(body: string, element?: HTMLElement) {
  const editor = noteEditor(element);
  act(() => { editor.commands.setContent(body, { contentType: 'markdown' }); });
}
export function moveEditorCaretToEnd(element?: HTMLElement) {
  const editor = noteEditor(element);
  act(() => { editor.commands.setTextSelection(editor.state.doc.content.size - 1); });
}
export function replaceCaptureText(element:HTMLElement, value:string, caret=value.length, end=caret) {
  const editor=noteEditor(element);
  act(()=>{editor.commands.setContent({type:'doc',content:value ? [{type:'text',text:value}] : []});editor.commands.setTextSelection({from:caret,to:end});editor.view.dispatch(closeHistory(editor.state.tr));});
}
