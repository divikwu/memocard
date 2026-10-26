// @vitest-environment jsdom
import { Editor, Node, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { DecorationSet } from '@tiptap/pm/view';
import { afterEach, expect, it, vi } from 'vitest';
import { inlineTags } from './inline-tags';
import { RichInlineTags } from './rich-inline-tags';
import { blockMoveTransaction, richBlockAt } from './rich-blocks';

vi.mock('./inline-tags', async original => {
  const actual = await original<typeof import('./inline-tags')>();
  return { ...actual, inlineTags: vi.fn(actual.inlineTags) };
});
const editors: Editor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); vi.clearAllMocks(); });
function setup(content: string | JSONContent) {
  const editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false }), RichInlineTags], content });
  editors.push(editor);
  return editor;
}

it('reuses untouched text blocks and does no tag parsing for selection-only transactions', () => {
  const editor = setup({ type: 'doc', content: Array.from({ length: 1000 }, (_, index) => ({ type: 'paragraph', content: [{ type: 'text', text: `正文 #topic${index}` }] })) });
  expect(editor.view.dom.querySelectorAll('.rich-inline-tag')).toHaveLength(1000);
  const decorations = () => editor.state.plugins.map(plugin => plugin.getState(editor.state)).find(value => value instanceof DecorationSet) as DecorationSet;
  const last = editor.state.doc.lastChild!, lastPosition = editor.state.doc.content.size - last.nodeSize;
  const untouched = decorations().forChild(lastPosition, last);
  vi.mocked(inlineTags).mockClear();
  const textBetween = vi.spyOn(editor.state.doc, 'textBetween');
  editor.commands.insertContentAt(2, '新');
  expect(editor.view.dom.querySelectorAll('.rich-inline-tag')).toHaveLength(1000);
  expect(inlineTags).toHaveBeenCalledTimes(1);
  expect(textBetween).not.toHaveBeenCalled();
  expect(decorations().forChild(lastPosition + 1, last)).toBe(untouched);
  vi.mocked(inlineTags).mockClear();
  editor.commands.setTextSelection(4);
  editor.commands.setTextSelection(3);
  expect(inlineTags).not.toHaveBeenCalled();
  textBetween.mockRestore();
});

it('respects boundaries across marks and rechecks them when the preceding inline text changes', () => {
  const editor = setup({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'word', marks: [{ type: 'bold' }] }, { type: 'text', text: '#NotTag' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '(', marks: [{ type: 'bold' }] }, { type: 'text', text: '#Work' }, { type: 'hardBreak' }, { type: 'text', text: '#After' }] },
    { type: 'paragraph', content: [{ type: 'text', text: '#Code', marks: [{ type: 'code' }] }, { type: 'text', text: ' #Link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] },
  ] });
  const tags = () => [...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent);
  expect(tags()).toEqual(['#Work', '#After']);
  const second = editor.state.doc.firstChild!.nodeSize + 1;
  editor.commands.insertContentAt({ from: second, to: second + 1 }, 'x');
  expect(tags()).toEqual(['#After']);
  editor.commands.undo();
  expect(tags()).toEqual(['#Work', '#After']);
  editor.commands.redo();
  expect(tags()).toEqual(['#After']);
});

it('updates decorations when an inline-only capture document is replaced', () => {
  const editor = new Editor({ extensions: [
    Node.create({ name: 'doc', topNode: true, content: 'text*', whitespace: 'pre' }),
    Node.create({ name: 'text', group: 'inline' }), RichInlineTags,
  ], content: { type: 'doc' } });
  editors.push(editor);
  const replace = (text: string) => editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, editor.schema.text(text)).setMeta('preventUpdate', true));
  const tags = () => [...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent);
  replace('想法 #area/ai #area/design `#code`');
  expect(tags()).toEqual(['#area/ai', '#area/design']);
  replace('已编辑 #area/design');
  expect(tags()).toEqual(['#area/design']);
});

it('keeps tags on a moved block when its content matches the unchanged prefix', () => {
  const editor = setup('<p>#same</p><p>body</p><p>#same</p>');
  const last = editor.state.doc.content.size - editor.state.doc.lastChild!.nodeSize;
  editor.view.dispatch(blockMoveTransaction(editor, [richBlockAt(editor, last)!], richBlockAt(editor, 0)!, false)!);
  expect(editor.state.doc.child(0).textContent).toBe('#same');
  expect(editor.state.doc.child(1).textContent).toBe('#same');
  expect(editor.state.doc.child(2).textContent).toBe('body');
  expect([...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent)).toEqual(['#same', '#same']);
  editor.commands.undo();
  expect([...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent)).toEqual(['#same', '#same']);
  editor.commands.redo();
  expect([...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent)).toEqual(['#same', '#same']);
});

it('retains unchanged tags when a document replacement changes only the middle block', () => {
  const editor = setup('<p>#first</p><p>middle</p><p>#last</p>');
  editor.chain().setMeta('addToHistory', false).setContent('<p>#first</p><p>changed</p><p>#last</p>', { emitUpdate: false }).run();
  expect(editor.state.doc.child(1).textContent).toBe('changed');
  expect([...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent)).toEqual(['#first', '#last']);
});

it('refreshes tag decorations for mark-only changes without position mappings', () => {
  const editor = setup('<p>#work</p><p>#other</p>');
  editor.commands.setTextSelection({ from: 1, to: 6 });
  editor.commands.toggleCode();
  expect([...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent)).toEqual(['#other']);
  editor.commands.undo();
  expect([...editor.view.dom.querySelectorAll('.rich-inline-tag')].map(element => element.textContent)).toEqual(['#work', '#other']);
});
