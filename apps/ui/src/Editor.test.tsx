// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRef, useState } from 'react';
import { Editor, type EditorHandle } from '@ui/business/Editor';
import { noteEditor, readEditorText, replaceEditorText } from './editor-test-utils';
import { request, type Draft } from './bridge';
import type { Note, NoteProperties, PropertyChange } from '@memocard/contracts';
import { TagColorProvider } from './TagColorProvider';
import * as tagOperations from './rename-tag-operation';
vi.mock('./bridge', () => ({ request: vi.fn(), errorMessage: (error: unknown) => error instanceof Error ? error.message : '文件冲突' }));
vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
const nativeChrome = vi.hoisted(() => ({enabled:false}));
vi.mock('./ios-mode', () => ({get isIOSNative(){return nativeChrome.enabled;}}));
const initial: Draft = { id: 'test-note', body: '', tags: [], baseHash: null };
const saved = { id: initial.id, contentHash: 'saved-hash', relativePath: 'notes/test-note.md' };
const native = vi.mocked(request);
async function editor(draft = initial, capabilities = new Set(['saveNote', 'saveDraft', 'pickImage'])) {
  const onClose = vi.fn(), onSaved = vi.fn(), onCommitted = vi.fn();
  render(<Editor initial={draft} capabilities={capabilities} onClose={onClose} onSaved={onSaved} onCommitted={onCommitted} />);
  await screen.findByRole('textbox', { name: '笔记内容' });
  await screen.findByRole('button', { name: '更多属性' });
  return { onClose, onSaved, onCommitted };
}
function finishEditor() {
  fireEvent.keyDown(screen.getByRole('textbox', { name: '笔记内容' }), { key: 'Enter', metaKey: true });
}
beforeEach(() => {
  nativeChrome.enabled=false;
  native.mockReset(); native.mockImplementation(async op => op === 'saveNote' ? saved : undefined);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('DragEvent', MouseEvent);
  vi.stubGlobal('matchMedia', vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();

});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mobile() {
  vi.stubGlobal('innerWidth',390);
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
}

it('opens an existing mobile note without focusing editable fields and still permits editing',async()=>{
  mobile();
  await editor({...initial,title:'已有笔记',body:'正文',baseHash:'original'});
  expect(document.activeElement).toBe(screen.getByRole('region',{name:'编辑笔记'}));
  expect(document.activeElement).not.toBe(screen.getByRole('textbox',{name:'页面标题'}));
  expect(document.activeElement).not.toBe(screen.getByRole('textbox',{name:'笔记内容'}));
  expect(screen.queryByRole('status')).toBeNull();
  act(()=>{screen.getByRole('textbox',{name:'笔记内容'}).focus();});
  replaceEditorText('手动编辑');
  await waitFor(()=>expect(native).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:'手动编辑'})));
  expect(screen.queryByRole('status')).toBeNull();
});

it('retains title autofocus for a new mobile note and body autofocus without mobile status on desktop',async()=>{
  mobile();await editor({...initial,title:''});
  expect(document.activeElement).toBe(screen.getByRole('textbox',{name:'页面标题'}));
  expect(screen.queryByRole('status')).toBeNull();
  cleanup();
  vi.stubGlobal('innerWidth',1024);
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  await editor({...initial,body:'桌面正文',baseHash:'original'});
  await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('textbox',{name:'笔记内容'})));
  expect(screen.queryByRole('status')).toBeNull();
});

it('hides routine mobile save hints while retaining failure feedback and retry',async()=>{
  mobile();
  let rejectSave!:(error:unknown)=>void;
  native.mockImplementation(async op=>op==='saveNote' ? new Promise((_resolve,reject)=>{rejectSave=reject;}) : undefined);
  await editor({...initial,body:'原文',baseHash:'original'});
  replaceEditorText('未完成保存');
  expect(screen.queryByRole('status')).toBeNull();
  await waitFor(()=>expect(native).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:'未完成保存'})));
  expect(screen.queryByRole('status')).toBeNull();
  await act(async()=>{rejectSave(new Error('磁盘只读'));});
  expect(screen.getByRole('status').textContent).toBe('保存失败，请重试');
  expect(readEditorText()).toBe('未完成保存');
  native.mockImplementation(async op=>op==='saveNote' ? saved : undefined);
  fireEvent.click(screen.getByRole('button',{name:'重试保存'}));
  await waitFor(()=>expect(screen.queryByRole('status')).toBeNull());
});

it('hides routine save hints on iOS while retaining failure feedback and retry',async()=>{
  mobile();nativeChrome.enabled=true;
  let rejectSave!:(error:unknown)=>void;
  native.mockImplementation(async op=>op==='saveNote' ? new Promise((_resolve,reject)=>{rejectSave=reject;}) : undefined);
  await editor({...initial,body:'原文',baseHash:'original'});
  expect(screen.queryByRole('status')).toBeNull();
  replaceEditorText('保留状态反馈');
  expect(screen.queryByRole('status')).toBeNull();
  await waitFor(()=>expect(native).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:'保留状态反馈'})));
  expect(screen.queryByRole('status')).toBeNull();
  await act(async()=>{rejectSave(new Error('磁盘只读'));});
  expect(screen.getByRole('status').textContent).toBe('保存失败，请重试');
  native.mockImplementation(async op=>op==='saveNote' ? saved : undefined);
  fireEvent.click(screen.getByRole('button',{name:'重试保存'}));
  await waitFor(()=>expect(screen.queryByRole('status')).toBeNull());
  expect(readEditorText()).toBe('保留状态反馈');
});

it.each([false,true])('retains mobile conflict feedback and recovery actions without overwriting local content (native=%s)',async(isNative)=>{
  mobile();nativeChrome.enabled=isNative;
  native.mockImplementation(async op=>{if(op==='saveNote')throw {code:'REVISION_CONFLICT'};});
  await editor({...initial,baseHash:'old'});
  replaceEditorText('本地未保存内容');finishEditor();
  expect(await screen.findByRole('button',{name:'另存副本'})).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('存在冲突，尚未保存');
  expect(screen.getByRole('button',{name:'重新加载'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'继续编辑'})).toBeTruthy();
  expect(readEditorText()).toBe('本地未保存内容');
});

async function historyEditor(waitForProperty?: () => Promise<void>) {
 let note: Note = { ...saved, title:'原题', body:'正文', tags:[], createdAt:'', updatedAt:'', sourceUrl:'' };
 let properties: NoteProperties = { contentHash:note.contentHash, writable:true, definitionHash:'definition',
   tagProperty:{name:'tags',type:'list',value:['work'],editable:true},
   properties:[{name:'已验证',type:'checkbox',value:false,editable:true},{name:'摘要',type:'text',value:'原值',editable:true},
     {name:'状态',type:'multiSelect',value:['设计'],editable:true,options:[{name:'设计',color:'blue'},{name:'开发',color:'green'}]}] };
 let revision = 0;
 native.mockImplementation(async (operation, params) => {
   if (operation === 'getPropertyLabels') return {labels:{},contentHash:'labels'};
   if (operation === 'listTags') return {tags:[{name:'work'},{name:'life'}]};
   if (operation === 'getNoteProperties') return properties;
   if (operation === 'saveNote') note = {...note,title:String(params!.title ?? note.title),body:String(params!.body),contentHash:`body-${++revision}`};
   if (operation === 'updateNoteProperty') {
     await waitForProperty?.();
     const change = params as PropertyChange;
     note = {...note,contentHash:`property-${++revision}`};
     properties = {...properties,contentHash:note.contentHash,...(change.definition ? {definitionHash:`definition-${revision}`} : {}),
       ...(change.name === 'tags' ? {tagProperty:{...properties.tagProperty!,value:change.value!}} : {properties:properties.properties.map(property => property.name === change.name ? {...property,value:change.value!,...(change.options ? {options:change.options} : {})} : property)})};
     return {...note,propertyData:properties};
   }
   if (operation === 'saveNote') return note;
 });
 const handle = createRef<EditorHandle>();
 render(<Editor initial={{...initial,title:note.title,body:note.body,baseHash:note.contentHash}} initialNote={note}
   capabilities={new Set(['saveNote','saveDraft','getNoteProperties','updateNoteProperty'])} handle={handle} onClose={vi.fn()} onSaved={vi.fn()} />);
 await waitFor(()=>expect(noteEditor().getText()).toBe('正文'));
 fireEvent.click(screen.getByRole('button',{name:'更多属性'}));
 await screen.findByRole('checkbox',{name:'切换属性 已验证'});
 return {handle,stored:()=>({note,properties})};
}

it('undoes title, body and property edits in chronological order and persists their redo', async () => {
 const {handle,stored}=await historyEditor();
 const title=screen.getByRole('textbox',{name:'页面标题'});
 fireEvent.change(title,{target:{value:'新'}});fireEvent.change(title,{target:{value:'新题'}});fireEvent.blur(title);
 act(()=>{noteEditor().commands.insertContentAt(3,'改');});
 fireEvent.click(screen.getByRole('checkbox',{name:'切换属性 已验证'}));
 await waitFor(()=>expect(stored().properties.properties[0].value).toBe(true));
 const grip=screen.getByRole('button',{name:'内容块操作'});
 fireEvent.keyDown(grip,{key:'z',metaKey:true});
 expect(screen.getByRole('checkbox',{name:'切换属性 已验证'}).getAttribute('aria-checked')).toBe('false');
 expect(readEditorText()).toBe('正文改');expect(title).toHaveProperty('value','新题');
 fireEvent.keyDown(grip,{key:'z',metaKey:true});expect(readEditorText()).toBe('正文');
 fireEvent.keyDown(title,{key:'z',metaKey:true});expect(title).toHaveProperty('value','原题');
 for(let i=0;i<3;i++) fireEvent.keyDown(grip,{key:'z',metaKey:true,shiftKey:true});
 expect(title).toHaveProperty('value','新题');expect(readEditorText()).toBe('正文改');
 await act(async()=>{await handle.current!.flush();});
 expect(stored().note).toMatchObject({title:'新题',body:'正文改'});expect(stored().properties.properties[0].value).toBe(true);
});

it('queues property undo and redo behind an in-flight write using the latest saved hashes', async () => {
 let release!:()=>void;
 const first=new Promise<void>(resolve=>{release=resolve;});let writes=0;
 const {handle,stored}=await historyEditor(()=>++writes===1 ? first : Promise.resolve());
 const checkbox=screen.getByRole('checkbox',{name:'切换属性 已验证'});
 fireEvent.click(checkbox);
 await waitFor(()=>expect(writes).toBe(1));
 fireEvent.keyDown(checkbox,{key:'z',ctrlKey:true});expect(checkbox.getAttribute('aria-checked')).toBe('false');
 fireEvent.keyDown(checkbox,{key:'y',ctrlKey:true});expect(checkbox.getAttribute('aria-checked')).toBe('true');
 await act(async()=>{release();await handle.current!.flush();});
 const changes=native.mock.calls.filter(([op])=>op==='updateNoteProperty').map(([,params])=>params!);
 expect(changes.map(change=>change.value)).toEqual([true,false,true]);
 expect(changes.map(change=>change.baseHash)).toEqual(['saved-hash','property-1','property-2']);
 expect(changes.map(change=>change.definitionHash)).toEqual(['definition','definition','definition']);
 expect(stored().properties.properties[0].value).toBe(true);
});

it('keeps unsubmitted property text local, ignores composition undo and clears redo after a new title edit', async () => {
 await historyEditor();
 const title=screen.getByRole('textbox',{name:'页面标题'});
 fireEvent.change(title,{target:{value:'改题'}});fireEvent.blur(title);
 fireEvent.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 const input=screen.getByRole('textbox',{name:'属性值'});
 fireEvent.change(input,{target:{value:'未提交'}});
 expect(fireEvent.keyDown(input,{key:'z',metaKey:true})).toBe(true);
 expect(title).toHaveProperty('value','改题');
 fireEvent.keyDown(title,{key:'z',metaKey:true,isComposing:true});expect(title).toHaveProperty('value','改题');
 fireEvent.keyDown(input,{key:'Escape'});
 fireEvent.keyDown(title,{key:'z',metaKey:true});expect(title).toHaveProperty('value','原题');
 fireEvent.change(title,{target:{value:'新分支'}});
 fireEvent.keyDown(title,{key:'z',metaKey:true,shiftKey:true});expect(title).toHaveProperty('value','新分支');
});

it('updates open choice and tag popups when their committed values are undone and redone', async () => {
 const {handle,stored}=await historyEditor();
 fireEvent.click(screen.getByRole('button',{name:'编辑属性 状态'}));
 fireEvent.click(await screen.findByRole('option',{name:'选项 开发'}));
 await waitFor(()=>expect(stored().properties.properties[2].value).toEqual(['设计','开发']));
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'z',metaKey:true});
 await waitFor(()=>expect(screen.queryByRole('button',{name:'移除选项 开发'})).toBeNull());
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'z',metaKey:true,shiftKey:true});
 await screen.findByRole('button',{name:'移除选项 开发'});
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'Escape'});
 fireEvent.click(screen.getByRole('button',{name:'编辑标签'}));
 fireEvent.click(await screen.findByRole('button',{name:'移除属性标签 work'}));
 await waitFor(()=>expect(stored().properties.tagProperty!.value).toEqual([]));
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'z',metaKey:true});
 await screen.findByRole('button',{name:'移除属性标签 work'});
 await act(async()=>{await handle.current!.flush();});
 expect(stored().properties.tagProperty!.value).toEqual(['work']);
});

it('retains an undo intent after a property write fails and retries to the undone value', async () => {
 let fail=true;
 const {handle,stored}=await historyEditor(async()=>{if(fail) throw new Error('暂时不可写');});
 const checkbox=screen.getByRole('checkbox',{name:'切换属性 已验证'});
 fireEvent.click(checkbox);
 await screen.findByText('暂时不可写');
 fireEvent.keyDown(checkbox,{key:'z',metaKey:true});
 expect(checkbox.getAttribute('aria-checked')).toBe('false');
 fail=false;
 await act(async()=>{await handle.current!.flush();});
 expect(stored().properties.properties[0].value).toBe(false);
 expect(stored().note.body).toBe('正文');
 expect(native.mock.calls.filter(([op])=>op==='updateNoteProperty').map(([,change])=>change!.value)).toEqual([true,true,false]);
});

it('undoes a submitted property while focus is on the page and leaves unrelated search input alone', async () => {
 const {handle,stored}=await historyEditor();
 fireEvent.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 const input=screen.getByRole('textbox',{name:'属性值'});
 fireEvent.change(input,{target:{value:'修改摘要'}});fireEvent.submit(input.closest('form')!);
 await waitFor(()=>expect(stored().properties.properties[1].value).toBe('修改摘要'));
 const search=document.createElement('input');document.body.append(search);
 fireEvent.keyDown(search,{key:'z',metaKey:true});expect(stored().properties.properties[1].value).toBe('修改摘要');search.remove();
 fireEvent.keyDown(document.body,{key:'z',metaKey:true});
 await act(async()=>{await handle.current!.flush();});
 expect(stored().properties.properties[1].value).toBe('原值');
});

it('separates title typing after a pause, omits no-op changes and leaves saved content free of history metadata', async () => {
 const {handle,stored}=await historyEditor();
 const title=screen.getByRole('textbox',{name:'页面标题'});
 vi.useFakeTimers();
 fireEvent.change(title,{target:{value:'第一段'}});
 vi.setSystemTime(Date.now()+600);
 fireEvent.change(title,{target:{value:'第二段'}});
 fireEvent.change(title,{target:{value:'第二段'}});
 fireEvent.keyDown(title,{key:'z',metaKey:true});expect(title).toHaveProperty('value','第一段');
 fireEvent.keyDown(title,{key:'z',metaKey:true});expect(title).toHaveProperty('value','原题');
 fireEvent.keyDown(title,{key:'z',metaKey:true,shiftKey:true});
 await act(async()=>{await handle.current!.flush();});
 expect(stored().note).toMatchObject({title:'第一段',body:'正文'});
 expect(native.mock.calls.find(([op])=>op==='saveNote')?.[1]).not.toHaveProperty('noteEdit');
});

it.each(['choice','tags'])('keeps the %s popup on the undone value when the earlier save completes', async kind => {
 let release!:()=>void;let writes=0;
 const first=new Promise<void>(resolve=>{release=resolve;});
 const {handle,stored}=await historyEditor(()=>++writes===1 ? first : Promise.resolve());
 if(kind==='choice') {
   fireEvent.click(screen.getByRole('button',{name:'编辑属性 状态'}));
   fireEvent.click(await screen.findByRole('option',{name:'选项 开发'}));
 } else {
   fireEvent.click(screen.getByRole('button',{name:'编辑标签'}));
   fireEvent.click(await screen.findByRole('button',{name:'移除属性标签 work'}));
 }
 await waitFor(()=>expect(writes).toBe(1));
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'z',metaKey:true});
 await act(async()=>{release();await handle.current!.flush();});
 if(kind==='choice') {
   expect(screen.queryByRole('button',{name:'移除选项 开发'})).toBeNull();
   expect(stored().properties.properties[2].value).toEqual(['设计']);
 } else {
   expect(screen.getByRole('button',{name:'移除属性标签 work'})).toBeTruthy();
   expect(stored().properties.tagProperty!.value).toEqual(['work']);
 }
});

it('undoes selecting a newly created choice while retaining its library option and history boundary', async () => {
 const {handle,stored}=await historyEditor();
 fireEvent.change(screen.getByRole('textbox',{name:'页面标题'}),{target:{value:'边界前的标题'}});
 fireEvent.click(screen.getByRole('button',{name:'编辑属性 状态'}));
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'新选项'}});
 fireEvent.click(await screen.findByRole('option',{name:'创建选项 新选项'}));
 await waitFor(()=>expect(stored().properties.properties[2].value).toEqual(['设计','新选项']));
 await waitFor(()=>expect(screen.getByRole('combobox').getAttribute('aria-readonly')).not.toBe('true'));
 fireEvent.keyDown(screen.getByRole('combobox'),{key:'z',metaKey:true});
 await act(async()=>{await handle.current!.flush();});
 expect(stored().properties.properties[2].value).toEqual(['设计']);
 expect(stored().properties.properties[2].options!.map(option=>option.name)).toContain('新选项');
 fireEvent.keyDown(screen.getByRole('textbox',{name:'页面标题'}),{key:'z',metaKey:true});
 expect(screen.getByRole('textbox',{name:'页面标题'})).toHaveProperty('value','边界前的标题');
 fireEvent.keyDown(screen.getByRole('textbox',{name:'页面标题'}),{key:'z',metaKey:true,shiftKey:true});
 await act(async()=>{await handle.current!.flush();});
 expect(stored().properties.properties[2].value).toEqual(['设计','新选项']);
});

it('redoes only the changed field without rewriting another field restored by earlier undo', async () => {
 const {handle}=await historyEditor();
 fireEvent.click(screen.getByRole('checkbox',{name:'切换属性 已验证'}));
 fireEvent.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 const input=screen.getByRole('textbox',{name:'属性值'});
 fireEvent.change(input,{target:{value:'新值'}});fireEvent.submit(input.closest('form')!);
 await act(async()=>{await handle.current!.flush();});
 fireEvent.keyDown(document.body,{key:'z',metaKey:true});fireEvent.keyDown(document.body,{key:'z',metaKey:true});
 await act(async()=>{await handle.current!.flush();});
 const writes=native.mock.calls.filter(([op])=>op==='updateNoteProperty').length;
 fireEvent.keyDown(document.body,{key:'z',metaKey:true,shiftKey:true});
 await act(async()=>{await handle.current!.flush();});
 const changes=native.mock.calls.filter(([op])=>op==='updateNoteProperty').slice(writes).map(([,change])=>change!);
 expect(changes).toHaveLength(1);expect(changes[0]).toMatchObject({name:'已验证',value:true});
});
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
it('preserves source identity and forks native recovery without restoring property tags', async () => {
  const source = '# 原始\r\n\r\n<!-- raw -->\n\n[^one]: footnote\n';
  await editor({ ...initial, body: source, tags: ['C#,F#', 'two words'], baseHash: 'old', relativePath: 'notes/工作/a.md', vaultBinding: 'bound', draftKey: 'recovered', revision:'recovery-version', updatedAt: '2026-10-09T00:00:00Z' });
  expect(screen.queryByRole('button', { name: '添加标签' })).toBeNull();
  expect(screen.queryByLabelText('笔记标签')).toBeNull();
  expect(screen.queryByRole('button', { name: '移除标签 two words' })).toBeNull();
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ id: initial.id, body: source, tags: [], baseHash: 'old', relativePath: 'notes/工作/a.md', vaultBinding: 'bound', draftKey:expect.stringMatching(/:test-note$/), recoveredFrom:{draftKey:'recovered',revision:'recovery-version'} })));
  expect(native.mock.calls.find(([op])=>op==='saveNote')?.[1]?.draftKey).not.toBe('recovered');
});
it('does not close after a failed write and retries the same content', async () => {
  const { onSaved } = await editor(); native.mockImplementation(async op => { if (op === 'saveNote') throw new Error('不可写'); });
  const title=screen.getByRole('textbox',{name:'页面标题'}), field=screen.getByRole('textbox',{name:'笔记内容'});
  replaceEditorText('不能丢'); finishEditor();
  expect((await screen.findByRole('alert')).textContent).toContain('不可写'); expect(onSaved).not.toHaveBeenCalled(); expect(readEditorText()).toBe('不能丢');
  expect(screen.getByRole('textbox',{name:'页面标题'})).toBe(title);
  expect(screen.getByRole('textbox',{name:'笔记内容'})).toBe(field);
  native.mockImplementation(async op => op === 'saveNote' ? saved : undefined);
  fireEvent.click(screen.getByRole('button', { name: '重试保存' })); await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});
it('protects unload until the source is committed, not just recovery', async () => {
  let complete!: (value: unknown) => void;
  native.mockImplementation(async op => op === 'saveNote' ? new Promise(resolve => { complete = resolve; }) : undefined);
  await editor(); replaceEditorText('尚未保存'); finishEditor();
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  expect(screen.queryByText('保存中…')).toBeNull();
  fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'z',metaKey:true});expect(readEditorText()).toBe('尚未保存');
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
it('retires pending property recovery only after a conflict copy commits both body and properties', async () => {
  const pendingProperties = [{name:'summary',type:'text' as const,value:'保留属性',create:true}];
  native.mockImplementation(async op => { if (op === 'saveNote' || op === 'updateNoteProperty') throw {code:'HASH_CONFLICT'}; });
  await editor({...initial,body:'本地正文',baseHash:'old',pendingProperties},new Set(['saveNote','saveDraft','updateNoteProperty']));
  finishEditor();
  const copy = await screen.findByRole('button',{name:'另存副本'});
  let complete!: (value: unknown) => void;
  native.mockClear();
  native.mockImplementation(async (op,params) => op === 'saveNote' ? {...saved,id:params!.id} : op === 'updateNoteProperty' ? new Promise(resolve => {complete=resolve;}) : undefined);
  fireEvent.click(copy);
  await waitFor(() => expect(complete).toBeTypeOf('function'));
  expect(native.mock.calls.some(([op,params]) => op === 'saveDraft' && params?.id === initial.id && params?.baseHash === null)).toBe(false);
  const copied = native.mock.calls.find(([op]) => op === 'updateNoteProperty')![1]!;
  expect(copied).toMatchObject({name:'summary',value:'保留属性',baseHash:'saved-hash'});
  await act(async () => {complete({...saved,id:copied.id,contentHash:'property-hash'});});
  expect(native).toHaveBeenLastCalledWith('saveDraft',expect.objectContaining({id:initial.id,body:'',baseHash:null,pendingProperties:[]}));
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
  expect(title.getAttribute('placeholder')).toBe('新内容');
  fireEvent.change(title, { target: { value: '只有标题' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '只有标题', body: '', baseHash: null }));
});
it('closes an untouched new page without creating a note', async () => {
  const { onClose, onSaved } = await editor({ ...initial, title: '' });
  finishEditor(); await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onSaved).not.toHaveBeenCalled(); expect(native).not.toHaveBeenCalled();
});
it.each([{inheritedTags:[]}, {inheritedTags:['生活']}])('retains tags on a new page without requiring a title or body (%j)', async ({inheritedTags}) => {
  let propertyTags: string[] = [];
  const propertyData = () => ({properties:[],tagProperty:{name:'tags',type:'list',value:propertyTags,editable:true},writable:true,contentHash:'tag-hash'});
  native.mockImplementation(async (operation, params) => {
    if (operation === 'getPropertyLabels') return {labels:{},contentHash:'labels'};
    if (operation === 'getNoteProperties') return params?.id ? propertyData() : {properties:[],tagProperty:{name:'tags',type:'list',value:[],editable:false},writable:false,contentHash:''};
    if (operation === 'listTags') return {tags:[{name:'工作'}]};
    if (operation === 'saveNote') return {...saved,title:params!.title,body:'',tags:[],contentHash:'created-hash'};
    if (operation === 'updateNoteProperty') { propertyTags = params!.value as string[]; return {...saved,title:'新内容',body:'',tags:propertyTags,contentHash:'tag-hash',propertyData:propertyData()}; }
  });
  const user = userEvent.setup();
  await editor({...initial,title:'',inheritedTags}, new Set(['saveNote','saveDraft','getNoteProperties','updateNoteProperty']));
  await user.click(screen.getByRole('button',{name:'更多属性'}));
  await user.click(await screen.findByRole('button',{name:'编辑标签'}));
  await screen.findByRole('combobox',{name:'搜索或新建属性标签'});
  expect(native.mock.calls.some(([op]) => op === 'saveNote' || op === 'updateNoteProperty')).toBe(false);
  await user.keyboard('{Escape}');
  expect(native.mock.calls.some(([op]) => op === 'saveNote' || op === 'updateNoteProperty')).toBe(false);
  await user.click(screen.getByRole('button',{name:'编辑标签'}));
  await user.click(await screen.findByRole('option',{name:'属性标签 工作'}));
  await screen.findByRole('button',{name:'移除属性标签 工作'});
  await user.keyboard('{Escape}');
  expect(screen.getByRole('textbox',{name:'页面标题'})).toHaveProperty('value','');
  expect(readEditorText()).toBe('');
  await waitFor(() => expect(native).toHaveBeenCalledWith('updateNoteProperty',expect.objectContaining({name:'tags',value:[...inheritedTags,'工作'],baseHash:'created-hash'})));
  expect(native.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(1);
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(screen.getByRole('button',{name:'收起'}).getAttribute('aria-expanded')).toBe('true');
  expect(await screen.findByRole('button',{name:'添加属性'})).toBeTruthy();
});
it('retains a new page when a custom property is added before title or body input', async () => {
  let properties: NoteProperties['properties'] = [];
  const propertyData = () => ({properties,tagProperty:{name:'tags',type:'list',value:[],editable:true},writable:true,contentHash:'property-hash'});
  native.mockImplementation(async (operation, params) => {
    if (operation === 'getPropertyLabels') return {labels:{},contentHash:'labels'};
    if (operation === 'getNoteProperties') return params?.id ? propertyData() : {properties:[],writable:false,contentHash:''};
    if (operation === 'saveNote') return {...saved,title:'新内容',body:'',tags:[],contentHash:'created-hash'};
    if (operation === 'updateNoteProperty') {
      properties = [{name:'摘要',type:'text',value:'',editable:true}];
      return {...saved,title:'新内容',body:'',tags:[],contentHash:'property-hash',propertyData:propertyData()};
    }
  });
  const user = userEvent.setup();
  await editor({...initial,title:''},new Set(['saveNote','saveDraft','getNoteProperties','updateNoteProperty']));
  await user.click(screen.getByRole('button',{name:'更多属性'}));
  await user.click(await screen.findByRole('button',{name:'添加属性'}));
  await user.type(screen.getByRole('textbox',{name:'属性名'}),'摘要');
  await user.click(screen.getByRole('button',{name:'文本'}));
  await waitFor(() => expect(native).toHaveBeenCalledWith('updateNoteProperty',expect.objectContaining({name:'摘要',type:'text',value:'',create:true,baseHash:'created-hash'})));
  expect(native.mock.calls.filter(([operation]) => operation === 'saveNote')).toHaveLength(1);
  expect(screen.getByRole('textbox',{name:'页面标题'})).toHaveProperty('value','');
  expect(readEditorText()).toBe('');
  await waitFor(()=>expect(screen.queryByRole('textbox',{name:'属性名'})).toBeNull());
  expect(screen.getByRole('button',{name:'收起'}).getAttribute('aria-expanded')).toBe('true');
  expect(await screen.findByRole('button',{name:'添加属性'})).toBeTruthy();
});
it.each([{type:'text' as const,value:'直接填写'}, {type:'number' as const,value:'0'}])('edits an inherited $type property before entering title or body', async ({type,value}) => {
  const properties = [{name:'摘要',type,value:'',editable:true}];
  native.mockImplementation(async operation => {
    if (operation === 'getPropertyLabels') return {labels:{},contentHash:'labels'};
    if (operation === 'getNoteProperties') return {properties,writable:false,contentHash:''};
    if (operation === 'saveNote') return {...saved,title:'新内容',body:'',tags:[],contentHash:'created-hash'};
    if (operation === 'updateNoteProperty') return {...saved,title:'新内容',body:'',tags:[],contentHash:'property-hash',propertyData:{properties:[{...properties[0],value}],writable:true,contentHash:'property-hash'}};
  });
  const user = userEvent.setup();
  await editor({...initial,title:''},new Set(['saveNote','saveDraft','getNoteProperties','updateNoteProperty']));
  await user.click(screen.getByRole('button',{name:'更多属性'}));
  await user.click(await screen.findByRole('button',{name:'编辑属性 摘要'}));
  expect(screen.getByRole('button',{name:'属性菜单 摘要'})).toHaveProperty('disabled',true);
  expect(native.mock.calls.some(([operation]) => operation === 'saveNote')).toBe(false);
  await user.type(screen.getByRole('textbox',{name:'属性值'}),value);
  await user.keyboard('{Enter}');
  await waitFor(() => expect(native).toHaveBeenCalledWith('updateNoteProperty',expect.objectContaining({name:'摘要',type,value,baseHash:'created-hash'})));
  expect(screen.getByRole('textbox',{name:'页面标题'})).toHaveProperty('value','');
  expect(readEditorText()).toBe('');
});
it.each(['新内容', '新内容 (2)', '未命名', '未命名 (2)'])('shows a title placeholder for a reopened default filename without renaming it (%s)', async filename => {
  await editor({ ...initial, title: filename, body: '原文', relativePath: `notes/${filename}.md`, baseHash: 'old' });
  const title = screen.getByRole('textbox', { name: '页面标题' }) as HTMLTextAreaElement;
  expect(title.value).toBe('');
  expect(title.placeholder).toBe('新内容');
  vi.useFakeTimers(); replaceEditorText('继续编辑正文');
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: filename, relativePath: `notes/${filename}.md`, body: '继续编辑正文' }));
  expect(title.value).toBe('');
  fireEvent.change(title, { target: { value: '手动标题' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(title.value).toBe('手动标题');
  expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '手动标题' }));
});
it('keeps the title input empty after body-only autosave assigns a default filename', async () => {
  native.mockImplementation(async op => op === 'saveNote' ? { ...saved, title: '新内容 (2)', relativePath: 'notes/新内容 (2).md' } : undefined);
  await editor({ ...initial, title: '' });
  const title = screen.getByRole('textbox', { name: '页面标题' }) as HTMLTextAreaElement;
  vi.useFakeTimers(); replaceEditorText('仅输入正文');
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(title.value).toBe('');
  expect(title.placeholder).toBe('新内容');
  replaceEditorText('继续编辑正文');
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ title: '新内容 (2)', relativePath: 'notes/新内容 (2).md', body: '继续编辑正文' }));
  expect(title.value).toBe('');
});
it('allows a default-looking title to be entered manually without clearing it while typing', async () => {
  await editor({ ...initial, title: '' });
  const title = screen.getByRole('textbox', { name: '页面标题' }) as HTMLTextAreaElement;
  fireEvent.change(title, { target: { value: '新内容' } });
  expect(title.value).toBe('新内容');
});
it('keeps a manually entered default-looking title visible after a filename collision', async () => {
  native.mockImplementation(async op => op === 'saveNote' ? { ...saved, title: '新内容 (2)', relativePath: 'notes/新内容 (2).md' } : undefined);
  await editor({ ...initial, title: '' });
  const title = screen.getByRole('textbox', { name: '页面标题' }) as HTMLTextAreaElement;
  vi.useFakeTimers();
  fireEvent.change(title, { target: { value: '新内容' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(title.value).toBe('新内容 (2)');
  fireEvent.change(title, { target: { value: '' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(title.value).toBe('');
});
it('shows inherited tags in the default property row and preserves the caret when typing the first body text', async () => {
  await editor({ ...initial, title: '', tags: ['生活'] });
  expect(screen.getByLabelText('笔记属性').textContent).toContain('生活');
  expect(screen.queryByLabelText('继承标签')).toBeNull();
  expect(screen.getByText('更新时间')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '更多属性' }));
  expect(screen.getAllByText('生活')).toHaveLength(1);
  expect(readEditorText()).toBe('');
  const rich = noteEditor();
  act(() => { rich.commands.focus('start'); rich.commands.insertContent('第一句'); });
  expect(readEditorText()).toBe('第一句');
  expect(rich.state.selection.from).toBe(4);
  act(() => { rich.commands.insertContent('继续'); });
  expect(readEditorText()).toBe('第一句继续');
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '', body: '第一句继续', tags: [], inheritedTags: ['生活'] })));
});
it('keeps the body empty when a title is entered first and retains inherited tag properties', async () => {
  await editor({ ...initial, title: '', tags: ['生活'] });
  fireEvent.change(screen.getByRole('textbox', { name: '页面标题' }), { target: { value: '实际标题' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: '页面标题' }), { key: 'Enter' });
  act(() => { noteEditor().commands.insertContent('实际正文'); });
  expect(readEditorText()).toBe('实际正文');
  finishEditor();
  await waitFor(() => expect(native).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: '实际标题', body: '实际正文', tags: [], inheritedTags: ['生活'] })));
});
it('preserves undo and avoids creating a file when all input is undone', async () => {
  const { onClose } = await editor({ ...initial, title: '', tags: ['生活'] });
  act(() => { noteEditor().commands.insertContent('临时正文'); });
  expect(readEditorText()).toBe('临时正文');
  act(() => { noteEditor().commands.undo(); });
  expect(readEditorText().trim()).toBe('');
  finishEditor(); await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(native).not.toHaveBeenCalledWith('saveNote', expect.anything());
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
 expect(screen.getByLabelText('笔记属性').textContent).toContain('测试/笔记');
 fireEvent.click(await screen.findByRole('button', {name:'更多属性'}));
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
 expect((await screen.findByLabelText('笔记属性')).querySelectorAll('dt')).toHaveLength(4);
 expect(screen.getByLabelText('笔记属性').textContent).not.toContain('2030');
 expect(screen.getByText('笔记.md')).toBeTruthy();
 expect(screen.getByText('更新时间')).toBeTruthy();
 fireEvent.click(await screen.findByRole('button', {name:'更多属性'}));
 const panel = screen.getByLabelText('笔记属性');
 expect(panel.textContent).toContain('笔记.md');expect(panel.textContent).not.toContain('所在目录');expect(panel.textContent).not.toContain('项目');
 expect(panel.textContent).toContain('10/01/2026');expect(panel.textContent).toContain('10/02/2026');
 expect(Array.from(panel.querySelectorAll('dt'), node => node.textContent)).toEqual(['标签','更新时间','创建时间','文件名']);
 expect(native).not.toHaveBeenCalled();
 fireEvent.click(await screen.findByRole('button', {name:'收起'}));
 expect(screen.getByText('笔记.md')).toBeTruthy();
 native.mockResolvedValue({ ...note, relativePath:'根笔记.md', updatedAt:'2026-10-10T10:00:00Z', contentHash:'new' });
 replaceEditorText('更新正文 #生活');
 await act(async () => { await handle.current!.flush(); });
 fireEvent.click(await screen.findByRole('button', {name:'更多属性'}));
 expect(screen.getByLabelText('笔记属性').textContent).toContain('10/10/2026');
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
 fireEvent.click(await screen.findByRole('button', {name:'更多属性'}));
 const panel = screen.getByLabelText('笔记属性');
 expect(panel.textContent).toContain('尚未保存');expect(panel.textContent).toContain('未提供');
 expect(panel.textContent).not.toContain('test-note.md');expect(screen.queryByRole('dialog')).toBeNull();
 await act(async () => { await handle.current!.flush(); });
 expect(native).not.toHaveBeenCalled();
});
it('persists a keyboard undo after moving a heading section', async () => {
  const original = '## Alpha\n\nFirst\n\n## Beta\n\nSecond';
  const moved = '## Beta\n\nSecond\n\n## Alpha\n\nFirst';
  await editor({ ...initial, title: 'Sections', body: original, baseHash: 'original' });
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: '内容块操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '下移章节' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: moved }));
  fireEvent.keyDown(screen.getByRole('textbox', { name: '笔记内容' }), { key: 'z', metaKey: true });
  await act(async () => { await vi.advanceTimersByTimeAsync(650); });
  expect(native).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: original }));
});
it('reopens the saved section order after undoing a move before autosave', async () => {
  const original = '## Alpha\n\nFirst\n\n## Beta\n\nSecond';
  const moved = '## Beta\n\nSecond\n\n## Alpha\n\nFirst';
  const drafts = new Map<string, Draft>();
  native.mockImplementation(async (op, params) => {
    if (op === 'saveDraft') {
      if (params?.baseHash === null && params.body === '' && params.title === '') drafts.delete(String(params.draftKey));
      else drafts.set(String(params?.draftKey), { ...params, updatedAt: '2026-10-15T00:00:00Z' } as Draft);
    }
    return op === 'saveNote' ? { ...saved, ...params } : undefined;
  });
  const handle = createRef<EditorHandle>();
  const source = { ...initial, title: 'Sections', body: original, baseHash: 'original' };
  const props = { capabilities: new Set(['saveNote', 'saveDraft']), onClose: vi.fn(), onSaved: vi.fn() };
  const view = render(<Editor initial={source} handle={handle} {...props} />);
  await screen.findByRole('textbox', { name: '笔记内容' });
  fireEvent.click(screen.getByRole('button', { name: '内容块操作' }));
  fireEvent.click(screen.getByRole('menuitem', { name: '下移章节' }));
  await waitFor(() => expect([...drafts.values()][0]?.body).toBe(moved));
  fireEvent.keyDown(screen.getByRole('textbox', { name: '笔记内容' }), { key: 'z', metaKey: true });
  await act(async () => { await handle.current!.flush(); });
  view.unmount();
  render(<Editor initial={[...drafts.values()][0] ?? source} {...props} />);
  const field = await screen.findByRole('textbox', { name: '笔记内容' });
  await waitFor(() => expect([...field.querySelectorAll('h2')].map(node => node.textContent)).toEqual(['Alpha', 'Beta']));
  expect(drafts.size).toBe(0);
  expect(native.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(0);
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
it('uses committed property data without another read and keeps subsequent writes on the new hash', async () => {
 const note = {...saved,title:'标题',body:'正文',tags:[],createdAt:'',updatedAt:'',sourceUrl:''};
 const propertyData = {properties:[{name:'摘要',type:'text',value:'原值',editable:true}],writable:true,contentHash:note.contentHash,definitionHash:'definition'};
 let revision = 0;
 native.mockImplementation(async (op, params) => {
   if (op === 'getNoteProperties') return propertyData;
   if (op === 'getPropertyLabels') return {labels:{},contentHash:'labels'};
   if (op === 'updateNoteProperty') {
     const contentHash = `property-${++revision}`;
     return {...note,contentHash,propertyData:{...propertyData,contentHash,properties:[{...propertyData.properties[0],value:params?.value}]}};
   }
 });
 render(<Editor initial={{...initial,body:note.body,baseHash:note.contentHash}} initialNote={note} capabilities={new Set(['saveNote','getNoteProperties','updateNoteProperty'])} onClose={vi.fn()} onSaved={vi.fn()} />);
 fireEvent.click(await screen.findByRole('button',{name:'更多属性'}));
 for (const value of ['新值','再次修改']) {
   fireEvent.click(await screen.findByRole('button',{name:'编辑属性 摘要'}));
   const input = screen.getByRole('textbox',{name:'属性值'});
   fireEvent.change(input,{target:{value}});
   fireEvent.submit(input.closest('form')!);
   await waitFor(() => expect(screen.getByRole('button',{name:'编辑属性 摘要'}).textContent).toBe(value));
   expect(screen.getByRole('button',{name:'编辑属性 摘要'})).toHaveProperty('disabled',false);
 }
 expect(native.mock.calls.filter(([op]) => op === 'getNoteProperties')).toHaveLength(1);
 expect(native).toHaveBeenLastCalledWith('updateNoteProperty',expect.objectContaining({baseHash:'property-1',definitionHash:'definition',value:'再次修改'}));
 expect(readEditorText()).toBe('正文');
});

it('flushes pending body edits before creating an empty property and retains the form after a conflict', async () => {
 const note = {...saved,title:'标题',body:'正文',tags:[],createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',sourceUrl:''};
 const properties = {properties:[],writable:true,contentHash:note.contentHash};
 native.mockImplementation(async op => op === 'getNoteProperties' ? properties : op === 'saveNote' ? {...note,body:'更新正文',contentHash:'body-hash'} : op === 'updateNoteProperty' ? {...note,body:'更新正文',contentHash:'property-hash'} : undefined);
 render(<Editor initial={{...initial,body:note.body,baseHash:note.contentHash}} initialNote={note} capabilities={new Set(['saveNote','getNoteProperties','updateNoteProperty'])} onClose={vi.fn()} onSaved={vi.fn()} />);
 fireEvent.click(await screen.findByRole('button',{name:'更多属性'}));
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
 await waitFor(() => expect(screen.getAllByRole('alert').some(alert=>alert.textContent?.includes('文件已在其他位置修改'))).toBe(true));
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
  fireEvent.click(await screen.findByRole('button',{name:'更多属性'}));
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

it('keeps the page editable during property saves, preserves newer input and retries without losing intent', async () => {
 const note = {...saved,title:'标题',body:'正文',tags:[],createdAt:'',updatedAt:'',sourceUrl:''};
 const properties = {properties:[{name:'已验证',type:'checkbox',value:false,editable:true},{name:'摘要',type:'text',value:'',editable:true}],writable:true,contentHash:note.contentHash};
 let complete!: (value:unknown)=>void;
 let stored = {...note}, checked = false, summary = '';
 let first = true, fail = false;
 const mutations: string[] = [];
 native.mockImplementation(async (op, params) => {
   if (op === 'getStatus') return {capabilities:[]};
   if (op === 'getNoteProperties') return {...properties,contentHash:stored.contentHash};
   if (op === 'getPropertyLabels') return {labels:{},contentHash:'labels'};
   if (op === 'saveDraft') return;
   expect(params?.baseHash).toBe(stored.contentHash);
   mutations.push(op);
   if (op === 'updateNoteProperty' && first) { first = false; await new Promise(resolve=>{complete=resolve;}); }
   if (fail && op === 'updateNoteProperty') throw new Error('磁盘暂不可写');
   if (op === 'saveNote') stored = {...stored,body:params!.body as string,title:params!.title as string};
   else if (params?.name === '已验证') checked = params.value as boolean;
   else summary = params?.value as string;
   stored = {...stored,contentHash:stored.contentHash+'x'};
   return {...stored,propertyData:{...properties,contentHash:stored.contentHash,properties:[{...properties.properties[0],value:checked},{...properties.properties[1],value:summary}]}};
 });
 const handle = createRef<EditorHandle>();
 render(<Editor initial={{...initial,title:note.title,body:note.body,baseHash:note.contentHash}} initialNote={note} capabilities={new Set(['saveNote','saveDraft','getNoteProperties','updateNoteProperty'])} onClose={vi.fn()} onSaved={vi.fn()} handle={handle} />);
 fireEvent.click(await screen.findByRole('button',{name:'更多属性'}));
 const checkbox = await screen.findByRole('checkbox',{name:'切换属性 已验证'});
 fireEvent.click(checkbox);
 await waitFor(()=>expect(complete).toBeTypeOf('function'));
 expect(checkbox.getAttribute('aria-checked')).toBe('true'); expect(checkbox).toHaveProperty('disabled',false);
 expect(noteEditor().isEditable).toBe(true);
 const title = screen.getByRole('textbox',{name:'页面标题'});
 expect(title).toHaveProperty('readOnly',false);
 replaceEditorText('保存期间继续输入'); fireEvent.change(title,{target:{value:'新标题'}});
 fireEvent.click(checkbox);
 fireEvent.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 let input = screen.getByRole('textbox',{name:'属性值'});
 fireEvent.change(input,{target:{value:'第一版'}}); fireEvent.submit(input.closest('form')!);
 fireEvent.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 input = screen.getByRole('textbox',{name:'属性值'});
 fireEvent.change(input,{target:{value:'最终版'}}); fireEvent.submit(input.closest('form')!);
 expect(screen.getByRole('button',{name:'编辑属性 摘要'}).textContent).toBe('最终版');
 await act(async()=>{complete(undefined); await handle.current!.flush();});
 expect(stored).toMatchObject({body:'保存期间继续输入',title:'新标题'}); expect(checked).toBe(false); expect(summary).toBe('最终版');
 expect(readEditorText()).toBe(stored.body); expect(mutations).toEqual(['updateNoteProperty','saveNote','updateNoteProperty','updateNoteProperty','updateNoteProperty']);
 fail = true; fireEvent.click(checkbox);
 await screen.findByRole('button',{name:'重试保存'});
 expect(checkbox.getAttribute('aria-checked')).toBe('true'); expect(noteEditor().isEditable).toBe(true);
 expect(native.mock.calls.some(([op,params])=>op==='saveDraft' && (params?.pendingProperties as unknown[])?.length)).toBe(true);
 fail = false; fireEvent.click(screen.getByRole('button',{name:'重试保存'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'重试保存'})).toBeNull());
 expect(checked).toBe(true); expect(readEditorText()).toBe(stored.body);
 await waitFor(()=>expect(screen.queryAllByRole('alert')).toHaveLength(0));
});
