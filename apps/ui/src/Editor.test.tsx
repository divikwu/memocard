// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Editor } from './Editor';
import { noteEditor, readEditorText, replaceEditorText } from './editor-test-utils';
import { request, type Draft } from './bridge';
vi.mock('./bridge', () => ({ request: vi.fn(), errorMessage: (error: unknown) => error instanceof Error ? error.message : '文件冲突' }));
vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
const initial: Draft = { id: 'test-note', body: '', tags: [], baseHash: null };
const saved = { id: initial.id, contentHash: 'saved-hash', relativePath: 'notes/test-note.md' };
const native = vi.mocked(request);
async function editor(draft = initial, capabilities = new Set(['saveNote', 'saveDraft', 'pickImage'])) {
  const onClose = vi.fn(), onSaved = vi.fn(), onCommitted = vi.fn();
  render(<Editor initial={draft} capabilities={capabilities} onClose={onClose} onSaved={onSaved} onCommitted={onCommitted} />);
  await screen.findByRole('textbox', { name: '笔记内容' });
  return { onClose, onSaved, onCommitted };
}
beforeEach(() => {
  native.mockReset(); native.mockImplementation(async op => op === 'saveNote' ? saved : undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('DragEvent', MouseEvent);
  vi.stubGlobal('matchMedia', vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();

});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('is a focused page, without a dialog or title field, and Escape does not leave', async () => {
  const { onClose } = await editor(); expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '笔记内容' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' }); expect(onClose).not.toHaveBeenCalled();
});
it('does not create an empty note or save selected tags alone', async () => {
  const { onClose } = await editor({ ...initial, tags: ['工作/项目'] }); expect(readEditorText()).toBe('');
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' })); await waitFor(() => expect(onClose).toHaveBeenCalledOnce()); expect(native).not.toHaveBeenCalled();
});
it('autosaves without leaving and saves empty existing notes', async () => {
  const { onClose, onSaved } = await editor({ ...initial, body: '原文', baseHash: 'original' });
  vi.useFakeTimers(); replaceEditorText(''); await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '', baseHash: 'original' }));
  expect(onClose).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); expect(screen.getByText('已保存到本地库')).toBeTruthy();
});
it('preserves source, literal tags, directory binding and draft identity on every write', async () => {
  const source = '# 原始\r\n\r\n<!-- raw -->\n\n[^one]: footnote\n';
  await editor({ ...initial, body: source, tags: ['C#,F#', 'two words'], baseHash: 'old', relativePath: 'notes/工作/a.md', vaultBinding: 'bound', draftKey: 'recovered' });
  expect(screen.queryByRole('button', { name: '添加标签' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '移除标签 two words' }));
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', { id: initial.id, body: source, tags: ['C#,F#'], baseHash: 'old', relativePath: 'notes/工作/a.md', vaultBinding: 'bound', draftKey: 'recovered' }));
});
it('does not close after a failed write and retries the same content', async () => {
  const { onSaved } = await editor(); native.mockImplementation(async op => { if (op === 'saveNote') throw new Error('不可写'); });
  replaceEditorText('不能丢'); fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  expect((await screen.findByRole('alert')).textContent).toContain('不可写'); expect(onSaved).not.toHaveBeenCalled(); expect(readEditorText()).toBe('不能丢');
  native.mockImplementation(async op => op === 'saveNote' ? saved : undefined);
  fireEvent.click(screen.getByRole('button', { name: '重试保存' })); await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});
it('protects unload until the source is committed, not just recovery', async () => {
  let complete!: (value: unknown) => void;
  native.mockImplementation(async op => op === 'saveNote' ? new Promise(resolve => { complete = resolve; }) : undefined);
  await editor(); replaceEditorText('尚未保存'); fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
  await act(async () => { complete(saved); }); const done = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(done); expect(done.defaultPrevented).toBe(false);
});
it('ignores composition Command Enter and retains native save capability checks', async () => {
  const { onSaved } = await editor(); replaceEditorText('中文');
  fireEvent.keyDown(screen.getByRole('textbox', { name: '笔记内容' }), { key: 'Enter', metaKey: true, isComposing: true });
  expect(onSaved).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('textbox', { name: '笔记内容' }), { key: 'Enter', metaKey: true });
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  cleanup(); native.mockClear(); await editor({ ...initial, body: '只读' }, new Set());
  fireEvent.keyDown(screen.getByRole('textbox', { name: '笔记内容' }), { key: 'Enter', metaKey: true }); expect(native).not.toHaveBeenCalled();
});
it('imports images through the existing native attachment capability', async () => {
  native.mockImplementation(async op => op === 'pickImage' ? { markdownPath: '../../assets/a.png', notePath: 'notes/moved/note.md' } : op === 'saveNote' ? saved : undefined);
  await editor(); fireEvent.click(screen.getByRole('button', { name: '插入内容块' })); fireEvent.click(screen.getByRole('menuitem', { name: '图片' }));
  await waitFor(() => expect(readEditorText()).toContain('![图片](../../assets/a.png)'));
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ relativePath: 'notes/moved/note.md' })));
});
it('keeps slash text and focus when image import is cancelled', async () => {
  native.mockImplementation(async op => op === 'pickImage' ? null : undefined);
  await editor(); replaceEditorText('/图片');
  fireEvent.click(screen.getByRole('menuitem', { name: '图片' }));
  await waitFor(() => expect(noteEditor().isEditable).toBe(true));
  expect(readEditorText()).toBe('/图片'); expect(document.activeElement).toBe(noteEditor().view.dom);
});
it('shows conflict actions without overwriting local content', async () => {
  native.mockImplementation(async op => { if (op === 'saveNote') throw { code: 'REVISION_CONFLICT' }; });
  await editor({ ...initial, baseHash: 'old' }); replaceEditorText('本地内容'); fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  expect(await screen.findByRole('button', { name: '另存副本' })).toBeTruthy(); expect(readEditorText()).toBe('本地内容');
});
it('commits a conflict copy before retiring recovery for the original note', async () => {
  native.mockImplementation(async op => { if (op === 'saveNote') throw { code: 'REVISION_CONFLICT' }; });
  await editor({ ...initial, title: '冲突测试', body: '原文', baseHash: 'old', relativePath: 'work/source.md' });
  replaceEditorText('本地未保存内容');fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  const copy = await screen.findByRole('button', { name: '另存副本' });
  let complete!: (value: unknown) => void;
  native.mockClear();
  native.mockImplementation(async op => op === 'saveNote' ? new Promise(resolve => { complete = resolve; }) : undefined);
  fireEvent.click(copy);
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  const copied = native.mock.calls.find(([op]) => op === 'saveNote')![1] as Draft;
  expect(copied.id).not.toBe(initial.id);expect(copied.relativePath).toBe(`work/${copied.id}.md`);
  expect(copied.body).toBe('本地未保存内容');expect(copied.baseHash).toBeNull();
  expect(native.mock.calls.some(([op, params]) => op === 'saveDraft' && (params as Draft).id === initial.id && (params as Draft).body === '')).toBe(false);
  await act(async () => { complete({ ...saved, id: copied.id, relativePath: copied.relativePath }); });
  expect(native).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ id: initial.id, body: '', baseHash: null }));
  expect(readEditorText()).toBe('本地未保存内容');expect(screen.getByText('已保存到本地库')).toBeTruthy();
});
it('checks tasks and saves their Markdown representation', async () => {
  await editor({ ...initial, body: '- [ ] 阅读', baseHash: 'old' });
  fireEvent.click(screen.getByRole('checkbox', { name: '待办：阅读' }));
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '- [x] 阅读' })));
});
it('saves cell edits through the same session and retains unrelated raw source', async () => {
  const body = '| A | B |\n| --- | --- |\n| 一 | 二 |\n\n<!-- keep -->';
  await editor({ ...initial, body, baseHash: 'old' }); const e = noteEditor();
  let pos=0; e.state.doc.descendants((node,p)=>{if(node.isText && node.text==='一')pos=p;});
  act(()=>{e.commands.insertContentAt(pos,'新');});
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(()=>expect(native).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:expect.stringContaining('新一')})));
  const call=native.mock.calls.find(([op])=>op==='saveNote')!;
  expect(call[1]).toEqual(expect.objectContaining({body:expect.stringContaining('<!-- keep -->')}));
});
it('does not lose typing that arrives during the first automatic save', async () => {
  let resolve!: (value: unknown) => void;
  native.mockImplementation(async op => op === 'saveNote' ? new Promise(r=>{resolve=r;}) : undefined);
  await editor(); vi.useFakeTimers(); replaceEditorText('first');
  await act(async()=>{await vi.advanceTimersByTimeAsync(650);});
  replaceEditorText('first newer');
  await act(async()=>{resolve(saved);});
  expect(readEditorText()).toBe('first newer'); expect(screen.queryByText('已保存到本地库')).toBeNull();
  await act(async()=>{await vi.advanceTimersByTimeAsync(650);});
  expect(native).toHaveBeenLastCalledWith('saveNote',expect.objectContaining({body:'first newer',id:initial.id,baseHash:'saved-hash'}));
  await act(async()=>{resolve(saved);});
});

it('synchronizes inline tag additions and deletions while retaining legacy properties', async () => {
  await editor({ ...initial, body: '原文 #旧标签', tags: ['C#,F#', '旧标签'], baseHash: 'old' });
  replaceEditorText('新的内容 #工作/项目 ');
  expect(screen.queryByRole('button', { name: '添加标签' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ tags: ['C#,F#', '工作/项目'] })));
});
it('creates an empty page, focuses its independent title and saves title-only changes', async () => {
  await editor({ ...initial, title: '' });
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '', body: '' })));
  const title = screen.getByRole('textbox', { name: '页面标题' });
  expect(document.activeElement).toBe(title);
  fireEvent.change(title, { target: { value: '只有标题' } });
  fireEvent.click(screen.getByRole('button', { name: '返回笔记列表' }));
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '只有标题', body: '', baseHash: 'saved-hash' })));
});
it('keeps title focus and autosaves when the parent mirrors the edited title', async () => {
  function Page() {
    const [draft, setDraft] = useState<Draft>({ ...initial, title: '旧标题', body: '原文', baseHash: 'old' });
    return <Editor initial={draft} capabilities={new Set(['saveNote', 'saveDraft'])} onClose={vi.fn()} onSaved={vi.fn()} onTitleChange={title => setDraft(current => current.title === title ? current : { ...current, title })} />;
  }
  render(<Page />);await screen.findByRole('textbox', { name: '笔记内容' });
  const title = screen.getByRole('textbox', { name: '页面标题' });
  act(() => { title.focus(); });
  vi.useFakeTimers();fireEvent.change(title, { target: { value: '新标题' } });
  const retainsFocus = document.activeElement === title;
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '新标题', body: '原文', baseHash: 'old' }));
  expect(retainsFocus).toBe(true);expect(screen.getByText('已保存到本地库')).toBeTruthy();
});

it('does not duplicate body tags above the editor', async () => {
 await editor({...initial, body:'#测试/笔记', tags:['测试/笔记'], baseHash:'old'});
 expect(screen.queryByLabelText('笔记标签')).toBeNull();
 expect(screen.getByRole('textbox',{name:'笔记内容'}).querySelector('.rich-inline-tag')?.textContent).toBe('#测试/笔记');
});
it('persists a block redo while the preceding undo is still saving', async () => {
  const { duplicateRichBlocks, richBlockAt } = await import('./rich-blocks');
  await editor({ ...initial, title: '连续块', body: 'Alpha\n\nBeta\n\nGamma', baseHash: 'original' });
  vi.useFakeTimers();
  const rich = noteEditor();
  act(() => { duplicateRichBlocks(rich, [richBlockAt(rich, 0)!, richBlockAt(rich, 7)!]); });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  const duplicated = 'Alpha\n\nBeta\n\nAlpha\n\nBeta\n\nGamma';
  expect(native).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: duplicated }));
  let complete!: (value: unknown) => void;
  native.mockImplementation(async op => op === 'saveNote' ? new Promise(resolve => { complete = resolve; }) : undefined);
  act(() => { rich.commands.undo(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(complete).toBeTypeOf('function');
  act(() => { rich.commands.redo(); });
  expect(readEditorText()).toBe(duplicated);
  native.mockImplementation(async op => op === 'saveNote' ? saved : undefined);
  await act(async () => { complete(saved); await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: duplicated }));
  expect(screen.getByText('已保存到本地库')).toBeTruthy();
});
