import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

// One blank line separates Markdown blocks. Additional blank lines remain
// editable, as do all leading/trailing lines and whitespace inside a block.
export function editorSeparators(state: EditorState) {
  const result: { from: number; to: number }[] = [];
  const tree = ensureSyntaxTree(state, state.doc.length, 50);
  tree?.iterate({ enter(ref) {
    const node = ref.node, previous = node.prevSibling;
    if (!previous || (node.parent?.name !== 'Document' && node.name !== 'ListItem')) return;
    const last = state.doc.lineAt(previous.to);
    const next = state.doc.lineAt(node.from);
    if (next.number <= last.number + 1) return;
    const blank = state.doc.line(last.number + 1);
    if (!state.sliceDoc(blank.from, next.from).trim()) result.push({ from: last.to, to: blank.to });
  } });
  return result;
}

export const separatorSelection = EditorState.transactionFilter.of(transaction => {
  if (!transaction.newSelection.main.empty) return transaction;
  const head = transaction.newSelection.main.head;
  const separator = editorSeparators(transaction.state).find(range => head > range.from && head <= range.to);
  if (!separator) return transaction;
  const backward = head < transaction.startState.selection.main.head;
  return [transaction, { selection: { anchor: backward ? separator.from : separator.to + 1 }, sequential: true }];
});
