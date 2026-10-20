import { expect, it } from 'vitest';
import * as language from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { history, undo, redo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import type { EditorView } from '@codemirror/view';
import { blocks, blockAction, moveBlock } from './markdown-blocks';
function editor(doc: string) {
  const target = { state: EditorState.create({ doc, extensions: [EditorState.lineSeparator.of('\n'), markdown({ base: markdownLanguage, extensions: [GFM] }), history()] }), dispatch(transaction: Parameters<EditorState['update']>[0]) { target.state = target.state.update(transaction).state; }, focus() {} };
  return target as unknown as EditorView;
}
it('moves complete paragraphs without rewriting unrelated source and supports undo/redo', () => {
  const text = 'first\r\n\r\nsecond\r\n\r\n<!-- untouched -->\r\n';
  const view = editor(text); const list = blocks(view.state);
  expect(moveBlock(view, list[0], list[1])).toBe(true);
  expect(view.state.doc.toString()).toBe('second\r\n\r\nfirst\r\n\r\n<!-- untouched -->\r\n');
  undo(view); expect(view.state.doc.toString()).toBe(text); redo(view); expect(view.state.doc.toString()).toContain('second\r\n\r\nfirst');
});
it('moves a list item with its descendants and rejects cross-container movement', () => {
  const view = editor('- one\n  - child\n- two\n\nlast');
  const list = blocks(view.state); const one = list.find(b => b.kind === 'ListItem' && b.from === 0)!;
  const two = list.find(b => b.kind === 'ListItem' && b.from === 16)!;
  expect(two).toBeTruthy(); expect(moveBlock(view, one, two)).toBe(true);
  expect(view.state.doc.toString()).toBe('- two\n- one\n  - child\n\nlast');
  const next = blocks(view.state); expect(moveBlock(view, next.find(b => b.kind === 'ListItem')!, next.at(-1)!)).toBe(false);
});
it('indents after a preceding sibling and outdents a nested final item', () => {
  const view = editor('- one\n- two'); let list = blocks(view.state).filter(b => b.kind === 'ListItem');
  expect(blockAction(view, list[0], 'indent')).toBe(false);
  expect(blockAction(view, list[1], 'indent')).toBe(true); expect(view.state.doc.toString()).toBe('- one\n  - two');
  list = blocks(view.state).filter(b => b.kind === 'ListItem'); expect(blockAction(view, list[1], 'outdent')).toBe(true); expect(view.state.doc.toString()).toBe('- one\n- two');
});
it('finds and moves blocks past 10000 characters', () => {
  const view = editor('a'.repeat(12000) + '\n\nlast\n\nend');
  // This verifies block boundaries, not parser speed under runner contention.
  // Prepare the real syntax tree before exercising the bounded production read.
  expect(language.ensureSyntaxTree(view.state, view.state.doc.length, Infinity)).not.toBeNull();
  const list = blocks(view.state);
  expect(blockAction(view, list.at(-1)!, 'up')).toBe(true); expect(view.state.doc.toString().endsWith('\n\nend\n\nlast')).toBe(true);
});
it('leaves the document unchanged without an available syntax tree', () => {
  const text='first\n\nsecond',view=editor(text),block=blocks(view.state)[1];
  // An unconfigured parser produces the same unavailable-tree result.
  const unavailable={...view,state:EditorState.create({doc:text})} as EditorView;
  expect(blocks(unavailable.state)).toEqual([]);
  expect(blockAction(unavailable,block,'up')).toBe(false);
  expect(unavailable.state.doc.toString()).toBe(text);
});
it('converts list markers while retaining children and does not convert code', () => {
  const view = editor('- parent\n  - child\n\n```\ncode\n```');
  const list = blocks(view.state); expect(blockAction(view, list.find(b => b.kind === 'ListItem')!, 'ordered')).toBe(true);
  expect(view.state.doc.toString()).toContain('1. parent\n   - child');
  expect(blockAction(view, blocks(view.state).find(b => b.kind === 'FencedCode')!, 'heading1')).toBe(false);
});
it('duplicates CRLF blocks without introducing stray carriage returns', () => {
  const view = editor('one\r\n\r\ntwo\r\n');
  blockAction(view, blocks(view.state)[0], 'duplicate');
  expect(view.state.doc.toString()).toBe('one\r\n\r\none\r\n\r\ntwo\r\n');
});
it('outdents a middle child without adopting following siblings', () => {
  const view = editor('- parent\n  - first\n  - second');
  const child = blocks(view.state).find(block => block.kind === 'ListItem' && block.from === 9)!;
  blockAction(view, child, 'outdent');
  expect(view.state.doc.toString()).toBe('- parent\n  - second\n- first');
});
