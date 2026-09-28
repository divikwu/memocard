import { EditorView } from "@codemirror/view";
import { act, screen } from "@testing-library/react";

export function noteEditor(element: HTMLElement = screen.getByRole("textbox", { name: "笔记内容" })) {
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error("The note textbox must belong to a real CodeMirror editor");
  return view;
}

export function readEditorText(element?: HTMLElement) {
  return noteEditor(element).state.sliceDoc();
}

export function replaceEditorText(body: string, element?: HTMLElement) {
  const view = noteEditor(element);
  act(() => view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: body },
    selection: { anchor: body.length },
  }));
}

export function moveEditorCaretToEnd(element?: HTMLElement) {
  const view = noteEditor(element);
  act(() => view.dispatch({ selection: { anchor: view.state.doc.length } }));
}
