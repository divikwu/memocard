// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRef, useState } from 'react';
import { Editor, type EditorHandle } from './Editor';
import { noteEditor, readEditorText, replaceEditorText } from './editor-test-utils';
import { request, type Draft } from './bridge';
import { TagColorProvider } from './TagColorProvider';
import * as tagOperations from './rename-tag-operation';
vi.mock('./bridge', () => ({ request: vi.fn(), errorMessage: (error: unknown) => error instanceof Error ? error.message : '文件冲突' }));
vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
const initial: Draft = { id: 'test-note', body: '', tags: [], baseHash: null };
const saved = { id: initial.id, contentHash: 'saved-hash', relativePath: 'notes/test-note.md' };
const native = vi.mocked(request);
async function editor(draft = initial, capabilities = new Set(['saveNote', 'saveDraft', 'pickImage'])) {
  const onClose = vi.fn(), onSaved = vi.fn(), onCommitted = vi.fn();
  render(<Editor initial={draft} capabilities={capabilities} onClose={onClose} onSaved={onSaved} onCommitted={onCommitted} />);
  await screen.findByRole('textbox', { name: '笔记内容' });
  await screen.findByRole('button', { name: '属性' });
  return { onClose, onSaved, onCommitted };
}
function finishEditor() {
  fireEvent.keyDown(screen.getByRole('textbox', { name: '笔记内容' }), { key: 'Enter', metaKey: true });
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
  finishEditor(); await waitFor(() => expect(onClose).toHaveBeenCalledOnce()); expect(native).not.toHaveBeenCalled();
});
it('autosaves without leaving and saves empty existing notes', async () => {
  const { onClose, onSaved } = await editor({ ...initial, body: '原文', baseHash: 'original' });
  vi.useFakeTimers(); replaceEditorText(''); await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '', baseHash: 'original' }));
  expect(onClose).not.toHaveBeenCalled(); expect(onSaved).not.toHaveBeenCalled(); expect(screen.queryByText('已保存到本地库')).toBeNull();
});
it('preserves source and draft identity without restoring property tags', async () => {
  const source = '# 原始\r\n\r\n<!-- raw -->\n\n[^one]: footnote\n';
  await editor({ ...initial, body: source, tags: ['C#,F#', 'two words'], baseHash: 'old', relativePath: 'notes/工作/a.md', vaultBinding: 'bound', draftKey: 'recovered', updatedAt: '2026-10-09T00:00:00Z' });
  expect(screen.queryByRole('button', { name: '添加标签' })).toBeNull();
  expect(screen.queryByLabelText('笔记标签')).toBeNull();
  expect(screen.queryByRole('button', { name: '移除标签 two words' })).toBeNull();
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', { id: initial.id, body: source, tags: [], baseHash: 'old', relativePath: 'notes/工作/a.md', vaultBinding: 'bound', draftKey: 'recovered' }));
});
it('does not close after a failed write and retries the same content', async () => {
  const { onSaved } = await editor(); native.mockImplementation(async op => { if (op === 'saveNote') throw new Error('不可写'); });
  replaceEditorText('不能丢'); finishEditor();
  expect((await screen.findByRole('alert')).textContent).toContain('不可写'); expect(onSaved).not.toHaveBeenCalled(); expect(readEditorText()).toBe('不能丢');
  native.mockImplementation(async op => op === 'saveNote' ? saved : undefined);
  fireEvent.click(screen.getByRole('button', { name: '重试保存' })); await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});
it('protects unload until the source is committed, not just recovery', async () => {
  let complete!: (value: unknown) => void;
  native.mockImplementation(async op => op === 'saveNote' ? new Promise(resolve => { complete = resolve; }) : undefined);
  await editor(); replaceEditorText('尚未保存'); finishEditor();
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  expect(screen.queryByText('保存中…')).toBeNull();
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
  await editor(); fireEvent.click(screen.getByRole('button', { name: '内容块操作' })); fireEvent.click(screen.getByRole('menuitem', { name: '在下方插入' })); fireEvent.click(screen.getByRole('menuitem', { name: '图片' }));
  await waitFor(() => expect(readEditorText()).toContain('![图片](../../assets/a.png)'));
  finishEditor();
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
  await editor({ ...initial, baseHash: 'old' }); replaceEditorText('本地内容'); finishEditor();
  expect(await screen.findByRole('button', { name: '另存副本' })).toBeTruthy(); expect(readEditorText()).toBe('本地内容');
});
it('commits a conflict copy before retiring recovery for the original note', async () => {
  native.mockImplementation(async op => { if (op === 'saveNote') throw { code: 'REVISION_CONFLICT' }; });
  await editor({ ...initial, title: '冲突测试', body: '原文', baseHash: 'old', relativePath: 'work/source.md' });
  replaceEditorText('本地未保存内容');finishEditor();
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
  expect(readEditorText()).toBe('本地未保存内容');expect(screen.queryByText('已保存到本地库')).toBeNull();
});
it('checks tasks and saves their Markdown representation', async () => {
  await editor({ ...initial, body: '- [ ] 阅读', baseHash: 'old' });
  fireEvent.click(screen.getByRole('checkbox', { name: '待办：阅读' }));
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '- [x] 阅读' })));
});
it('saves cell edits through the same session and retains unrelated raw source', async () => {
  const body = '| A | B |\n| --- | --- |\n| 一 | 二 |\n\n<!-- keep -->';
  await editor({ ...initial, body, baseHash: 'old' }); const e = noteEditor();
  let pos=0; e.state.doc.descendants((node,p)=>{if(node.isText && node.text==='一')pos=p;});
  act(()=>{e.commands.insertContentAt(pos,'新');});
  finishEditor();
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

it('synchronizes only body tags and removes the last occurrence without restoring properties', async () => {
  await editor({ ...initial, body: '原文 #旧标签', tags: ['C#,F#', '旧标签'], baseHash: 'old' });
  replaceEditorText('新的内容 #工作/项目 ');
  expect(screen.queryByRole('button', { name: '添加标签' })).toBeNull();
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ tags: ['工作/项目'] })));
  replaceEditorText('#工作/项目 开头\n\n句中 #工作/项目\n\n结尾 #生活'); finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ tags: ['工作/项目', '生活'] })));
  replaceEditorText('开头\n\n句中\n\n结尾 #生活'); finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ tags: ['生活'] })));
});
it('does not save or migrate an untouched note with only property tags', async () => {
  await editor({ ...initial, title: '旧测试', body: '正文', tags: ['切库验收'], baseHash: 'old' });
  expect(screen.queryByLabelText('笔记标签')).toBeNull();
  finishEditor();
  await waitFor(() => expect(native).not.toHaveBeenCalled());
  expect(readEditorText()).toBe('正文');
});
it('focuses a new page title without saving and autosaves title-only changes', async () => {
  await editor({ ...initial, title: '' });
  vi.useFakeTimers();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(native).not.toHaveBeenCalled();
  const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(false);
  const title = screen.getByRole('textbox', { name: '页面标题' });
  expect(document.activeElement).toBe(title);
  fireEvent.change(title, { target: { value: '只有标题' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '只有标题', body: '', baseHash: null }));
});
it('closes an untouched new page without creating a note', async () => {
  const { onClose, onSaved } = await editor({ ...initial, title: '' });
  finishEditor(); await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onSaved).not.toHaveBeenCalled(); expect(native).not.toHaveBeenCalled();
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
  expect(retainsFocus).toBe(true);expect(screen.queryByText('已保存到本地库')).toBeNull();
});
it('grows wrapped titles without turning pasted line breaks into title paragraphs', async () => {
  await editor({ ...initial, title: '旧标题', body: '原文', baseHash: 'old' });
  const title = screen.getByRole('textbox', { name: '页面标题' });
  expect(title.tagName).toBe('TEXTAREA');
  vi.spyOn(title, 'scrollHeight', 'get').mockReturnValue(77);
  fireEvent.change(title, { target: { value: '很长的第一行\n第二行' } });
  expect(title.style.height).toBe('77px');
  expect((title as HTMLTextAreaElement).value).toBe('很长的第一行 第二行');
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '很长的第一行 第二行', body: '原文' })));
});
it('keeps composition Enter in the title and moves ordinary Enter to the body', async () => {
  await editor({ ...initial, title: '标题', body: '原文', baseHash: 'old' });
  const title = screen.getByRole('textbox', { name: '页面标题' });
  act(() => title.focus());
  fireEvent.keyDown(title, { key: 'Enter', isComposing: true });
  expect(document.activeElement).toBe(title);
  fireEvent.keyDown(title, { key: 'Enter' });
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: '笔记内容' }));
  expect(native).not.toHaveBeenCalled();
});

it('summarizes body tags above the editor without restoring property tags', async () => {
 await editor({...initial, body:'#测试/笔记', tags:['测试/笔记'], baseHash:'old'});
 expect(screen.queryByLabelText('笔记标签')).toBeNull();
 expect(screen.getByLabelText('笔记属性').textContent).not.toContain('#测试/笔记');
 fireEvent.click(await screen.findByRole('button', {name:'属性'}));
 expect(screen.getByLabelText('笔记属性').textContent).toContain('测试/笔记');
 expect(screen.getByLabelText('笔记属性').textContent).not.toContain('#测试/笔记');
 expect(screen.getByRole('textbox',{name:'笔记内容'}).querySelector('.rich-inline-tag')?.textContent).toBe('#测试/笔记');
});
it('shows source metadata read-only and updates it only after a successful save', async () => {
 const source = { ...initial, title:'标题', body:'正文 #工作', baseHash:'old', relativePath:'项目/笔记.md', updatedAt:'2030-01-01T00:00:00Z' };
 const note = { id:source.id, title:source.title, body:source.body, tags:['旧属性标签'], relativePath:source.relativePath, contentHash:'old', sourceUrl:'', createdAt:'2026-10-01T08:00:00Z', updatedAt:'2026-10-02T09:00:00Z' };
 const handle = createRef<EditorHandle>();
 render(<Editor initial={source} initialNote={note} handle={handle} capabilities={new Set(['saveNote'])} onClose={vi.fn()} onSaved={vi.fn()} />);
 expect(screen.queryByRole('dialog')).toBeNull();
 expect((await screen.findByLabelText('笔记属性')).querySelectorAll('dt')).toHaveLength(0);
 expect(screen.getByLabelText('笔记属性').textContent).not.toContain('2030');
 expect(screen.queryByText('笔记.md')).toBeNull();
 expect(screen.queryByText('更新时间')).toBeNull();
 fireEvent.click(await screen.findByRole('button', {name:'属性'}));
 const panel = screen.getByLabelText('笔记属性');
 expect(panel.textContent).toContain('笔记.md');expect(panel.textContent).not.toContain('所在目录');expect(panel.textContent).not.toContain('项目');
 expect(panel.textContent).toContain('2026/10/01');expect(panel.textContent).toContain('2026/10/02');
 expect(Array.from(panel.querySelectorAll('dt'), node => node.textContent)).toEqual(['标签','更新时间','创建时间','文件名']);
 expect(native).not.toHaveBeenCalled();
 fireEvent.click(await screen.findByRole('button', {name:'属性'}));
 await waitFor(() => expect(screen.queryByText('笔记.md')).toBeNull());
 native.mockResolvedValue({ ...note, relativePath:'根笔记.md', updatedAt:'2026-10-10T10:00:00Z', contentHash:'new' });
 replaceEditorText('更新正文 #生活');
 await act(async () => { await handle.current!.flush(); });
 fireEvent.click(await screen.findByRole('button', {name:'属性'}));
 expect(screen.getByLabelText('笔记属性').textContent).toContain('2026/10/10');
 expect(screen.getByLabelText('笔记属性').textContent).toContain('生活');
 expect(screen.getByLabelText('笔记属性').textContent).not.toContain('#生活');
 expect(screen.getByLabelText('笔记属性').textContent).not.toContain('#工作');
 expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({body:'更新正文 #生活',tags:['生活']}));
 const savedPanel = screen.getByLabelText('笔记属性');
 expect(savedPanel.textContent).toContain('根笔记.md');expect(savedPanel.textContent).not.toContain('笔记库根目录');
});
it('does not invent file dates or create a file when inspecting an empty new note', async () => {
 const handle = createRef<EditorHandle>();
 render(<Editor initial={{...initial,title:''}} handle={handle} capabilities={new Set(['saveNote','saveDraft'])} onClose={vi.fn()} onSaved={vi.fn()} />);
 fireEvent.click(await screen.findByRole('button', {name:'属性'}));
 const panel = screen.getByLabelText('笔记属性');
 expect(panel.textContent).toContain('尚未保存');expect(panel.textContent).toContain('未提供');
 expect(panel.textContent).not.toContain('test-note.md');expect(screen.queryByRole('dialog')).toBeNull();
 await act(async () => { await handle.current!.flush(); });
 expect(native).not.toHaveBeenCalled();
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
  expect(screen.queryByText('已保存到本地库')).toBeNull();
});
it('flushes pending body edits before creating an empty property and retains the form after a conflict', async () => {
 const note = {...saved,title:'标题',body:'正文',tags:[],createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',sourceUrl:''};
 const properties = {properties:[],writable:true,contentHash:note.contentHash};
 native.mockImplementation(async op => op === 'getNoteProperties' ? properties : op === 'saveNote' ? {...note,body:'更新正文',contentHash:'body-hash'} : op === 'updateNoteProperty' ? {...note,body:'更新正文',contentHash:'property-hash'} : undefined);
 render(<Editor initial={{...initial,body:note.body,baseHash:note.contentHash}} initialNote={note} capabilities={new Set(['saveNote','getNoteProperties','updateNoteProperty'])} onClose={vi.fn()} onSaved={vi.fn()} />);
 fireEvent.click(await screen.findByRole('button',{name:'属性'}));
 const add = await screen.findByRole('button',{name:'添加属性'});
 await waitFor(() => expect(add.hasAttribute('disabled')).toBe(false));
 fireEvent.click(add);
 fireEvent.change(screen.getByRole('textbox',{name:'属性名'}),{target:{value:'摘要'}});
 replaceEditorText('更新正文');
 fireEvent.click(screen.getByRole('button',{name:'文本'}));
 await waitFor(() => expect(native).toHaveBeenCalledWith('updateNoteProperty',expect.objectContaining({name:'摘要',value:'',baseHash:'body-hash',create:true})));
 await waitFor(() => expect(screen.queryByRole('textbox',{name:'属性名'})).toBeNull());
 expect(readEditorText()).toBe('更新正文');
 await waitFor(() => expect(screen.getByRole('button',{name:'添加属性'}).hasAttribute('disabled')).toBe(false));
 fireEvent.click(screen.getByRole('button',{name:'添加属性'}));
 fireEvent.change(screen.getByRole('textbox',{name:'属性名'}),{target:{value:'状态'}});
 native.mockImplementation(async op => { if(op === 'updateNoteProperty') throw new Error('文件已在其他位置修改'); return properties; });
 fireEvent.click(screen.getByRole('button',{name:'文本'}));
 expect((await screen.findByRole('alert')).textContent).toContain('文件已在其他位置修改');
 expect((screen.getByRole('textbox',{name:'属性名'}) as HTMLInputElement).value).toBe('状态');
 expect(readEditorText()).toBe('更新正文');
});

it('flushes the current note before a global tag rename and continues with the refreshed body and hash', async () => {
  let current = {...saved,title:'标题',body:'#work/child',tags:['work/child'],createdAt:'',updatedAt:'',sourceUrl:''};
  const properties = {properties:[],writable:true,contentHash:current.contentHash,tagProperty:{value:[],editable:true,type:'list'}};
  native.mockImplementation(async (op, params) => {
    if (op === 'getNoteProperties') return {...properties,contentHash:current.contentHash};
    if (op === 'listTags') return {tags:[{name:'work'},{name:'work/child'}]};
    if (op === 'saveNote') { current = {...current,body:String(params?.body),contentHash:'body-hash'}; return current; }
    if (op === 'getNote') return current;
  });
  const rename = vi.spyOn(tagOperations,'renameTag').mockImplementation(async () => {
    expect(current.body).toBe('#work/child 待保存');
    current = {...current,body:'#project/child 待保存',contentHash:'renamed-hash'};
  });
  render(<TagColorProvider vaultId="v"><Editor initial={{...initial,body:current.body,baseHash:current.contentHash}} initialNote={current} capabilities={new Set(['saveNote','getNoteProperties','updateNoteProperty'])} onClose={vi.fn()} onSaved={vi.fn()} /></TagColorProvider>);
  fireEvent.click(await screen.findByRole('button',{name:'属性'}));
  await waitFor(() => expect(screen.getByRole('button',{name:'编辑标签'}).hasAttribute('disabled')).toBe(false));
  replaceEditorText('#work/child 待保存');
  fireEvent.click(screen.getByRole('button',{name:'编辑标签'}));
  fireEvent.click(await screen.findByRole('button',{name:'管理标签 work'}));
  const input = await screen.findByRole('textbox',{name:'标签名称'});
  fireEvent.change(input,{target:{value:'Project'}});
  fireEvent.submit(input.closest('form')!);
  await waitFor(() => expect(rename).toHaveBeenCalledWith('work','project','v',request));
  await waitFor(() => expect(readEditorText()).toBe('#project/child 待保存'));
  replaceEditorText('#project/child 后续编辑');
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:'#project/child 后续编辑',baseHash:'renamed-hash'})));
});
