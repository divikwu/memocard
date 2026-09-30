import { ensureSyntaxTree } from '@codemirror/language';
import { EditorSelection, Transaction, type EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export type Block = { from: number; to: number; kind: string; parent: number; end: number };
export function blocks(state: EditorState): Block[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 50);
  if (!tree) return [];
  const result: Block[] = [];
  tree.iterate({ enter(node) {
    const parent = node.node.parent;
    if (parent?.name === 'Document' || (node.name === 'ListItem' && /List$/.test(parent?.name ?? ''))) {
      const line = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(node.to);
      // Ignore unrecognized syntax instead of guessing destructive boundaries.
      if (!/^(Paragraph|ATXHeading[1-6]|SetextHeading[12]|BulletList|OrderedList|ListItem|Blockquote|FencedCode|CodeBlock|HorizontalRule)$/.test(node.name)) return;
      const to = last.text.endsWith('\r') ? last.to - 1 : last.to;
      result.push({ from: line.from, to, end: Math.min(state.doc.length, last.to + 1), kind: node.name, parent: parent?.name === 'Document' ? -1 : parent!.from });
    }
  } });
  return result;
}
export function blockAt(state: EditorState, position: number) {
  const candidates = blocks(state);
  return candidates.filter(block => position >= block.from && position <= block.to).sort((a, b) => (a.to - a.from) - (b.to - b.from) || Number(b.kind === 'ListItem') - Number(a.kind === 'ListItem'))[0];
}
export type BlockAction = 'up' | 'down' | 'duplicate' | 'delete' | 'indent' | 'outdent' | 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6' | 'bullet' | 'ordered' | 'task' | 'quote';
export function moveBlock(view: EditorView, source: Block, target: Block): boolean {
  const state = view.state;
  if (state.readOnly || source.from === target.from || source.parent !== target.parent || (source.from < target.to && target.from < source.to)) return false;
  const siblings = blocks(state).filter(block => block.parent === source.parent);
  const start = siblings.findIndex(block => block.from === Math.min(source.from, target.from));
  const end = siblings.findIndex(block => block.from === Math.max(source.from, target.from));
  if (start < 0 || end < 0) return false;
  const selected = siblings.slice(start, end + 1);
  const texts = selected.map(block => state.sliceDoc(block.from, block.to));
  const separators = selected.slice(0, -1).map((block, i) => state.sliceDoc(block.to, selected[i + 1].from));
  if (source.from < target.from) texts.push(texts.shift()!); else texts.unshift(texts.pop()!);
  const insert = texts.map((text, i) => text + (separators[i] ?? '')).join('');
  const from = selected[0].from, to = selected[selected.length - 1].to;
  const anchor = source.from < target.from ? from + insert.length - texts[texts.length - 1].length : from;
  view.dispatch({ changes: { from, to, insert }, selection: { anchor }, scrollIntoView: true, annotations: Transaction.userEvent.of('input.block') });
  view.focus(); return true;
}
export function canBlockAction(state: EditorState, block: Block, action: BlockAction): boolean {
  if (state.readOnly) return false;
  const siblings = blocks(state).filter(item => item.parent === block.parent);
  const index = siblings.findIndex(item => item.from === block.from && item.to === block.to);
  if (index < 0) return false;
  if (action === 'up') return index > 0;
  if (action === 'down') return index < siblings.length - 1;
  if (action === 'indent') return block.kind === 'ListItem' && index > 0;
  if (action === 'outdent') return block.kind === 'ListItem' && /^ +/.test(state.sliceDoc(block.from, block.to));
  return true;
}
export function blockAction(view: EditorView, block: Block, action: BlockAction): boolean {
  if (view.composing || !canBlockAction(view.state, block, action)) return false;
  const state = view.state, source = state.sliceDoc(block.from, block.to);
  const siblings = blocks(state).filter(item => item.parent === block.parent);
  const index = siblings.findIndex(item => item.from === block.from);
  if (action === 'up' || action === 'down') {
    const target = siblings[index + (action === 'up' ? -1 : 1)];
    return target ? moveBlock(view, block, target) : false;
  }
  const eol = source.includes('\r\n') || state.sliceDoc().includes('\r\n') ? '\r\n' : '\n';
  let from = block.from, to = block.to, insert = source;
  if (action === 'duplicate') { from = to; insert = `${block.kind === 'ListItem' ? eol : eol + eol}${source}`; }
  else if (action === 'delete') { to = block.end; insert = ''; }
  else if (action === 'indent' || action === 'outdent') {
    if (block.kind !== 'ListItem') return false;
    if (action === 'indent') {
      if (index <= 0) return false;
      const marker = /^(\s*)(?:[-+*]|\d+[.)])\s+/.exec(state.sliceDoc(siblings[index - 1].from, siblings[index - 1].to));
      const width = marker ? marker[0].length - marker[1].length : 2;
      insert = source.replace(/^/gm, ' '.repeat(width));
    } else {
      const indentation = /^ */.exec(source)![0].length;
      if (!indentation) return false;

      const parentItem = blocks(state).filter(item => item.kind === 'ListItem' && item.from < block.from && item.to >= block.to).sort((a, b) => b.from - a.from)[0];
      const targetIndent = parentItem ? /^ */.exec(state.sliceDoc(parentItem.from, parentItem.to))![0].length : 0;
      insert = source.replace(new RegExp(`^ {0,${indentation - targetIndent}}`, 'gm'), '');
      if (index < siblings.length - 1) {
        // Leave following children under their original parent instead of silently adopting them.
        const next = siblings[index + 1], last = siblings[siblings.length - 1];
        const separator = state.sliceDoc(block.to, next.from);
        insert = state.sliceDoc(next.from, last.to) + separator + insert;
        to = last.to;
      }
    }
  } else {
    const textKind = /^(Paragraph|ATXHeading[1-6]|SetextHeading[12]|ListItem)$/.test(block.kind);
    if (!textKind || (block.kind === 'ListItem' && !['bullet', 'ordered', 'task'].includes(action))) return false;
    const image = /^\s*!\[/.test(source);
    if (image) return false;
    let text = source.replace(/^ {0,3}#{1,6}\s+/, '').replace(/\r?\n[=-]+\s*$/, '');
    if (block.kind === 'ListItem') {
      const match = /^( *)(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/.exec(source);
      if (!match) return false;
      const marker = action === 'ordered' ? '1. ' : action === 'task' ? '- [ ] ' : '- ';
      const prefix = match[1] + marker;
      const delta = prefix.length - match[0].length;
      const lines = source.slice(match[0].length).split('\n');
      insert = prefix + lines[0] + lines.slice(1).map(line => '\n' + (delta >= 0 ? ' '.repeat(delta) + line : line.replace(new RegExp(`^ {0,${-delta}}`), ''))).join('');
    } else {
      const heading = /^heading([1-6])$/.exec(action);
      const prefix = heading ? '#'.repeat(Number(heading[1])) + ' ' : ({ bullet: '- ', ordered: '1. ', task: '- [ ] ', quote: '> ', paragraph: '' } as Record<string, string>)[action];
      if (prefix === undefined) return false;
      if (action === 'quote') text = text.replace(/\n/g, '\n> ');
      else if (['bullet', 'ordered', 'task'].includes(action)) text = text.replace(/\n/g, '\n' + ' '.repeat(prefix.length));
      insert = prefix + text;
    }
  }
  view.dispatch({ changes: { from, to, insert }, selection: EditorSelection.cursor(Math.min(from + insert.length, state.doc.length - (to - from) + insert.length)), scrollIntoView: true, annotations: Transaction.userEvent.of('input.block') });
  view.focus(); return true;
}
