// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { swipeSheet } from '@ui/components/sheet-swipe.test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { noteEditor, replaceCaptureText } from '../editor-test-utils';
import type { Note } from '@memocard/contracts';
import { QuickCapture } from '@ui/business/QuickCapture';
import { createQuickCaptureDraftProtection, readQuickCaptureDraft, writeQuickCaptureDraft } from '../quick-capture-draft';
import { useQuickCapture } from '../hooks/use-quick-capture';

const bridge=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../bridge',()=>({request:bridge.request,errorMessage:(cause:unknown)=>cause instanceof Error ? cause.message : '操作未完成'}));
vi.mock('@ui/business/NoteMarkdown',()=>({VaultImage:({source,alt}:{source:string;alt:string})=><img src={source} alt={alt} />}));
const note=(params:Record<string,unknown>):Note=>({id:params.id as string,title:'新内容',body:params.body as string,tags:params.inheritedTags as string[] ?? [],createdAt:'2026-10-14T08:00:00Z',updatedAt:'2026-10-14T08:00:00Z',contentHash:'saved',relativePath:'新内容.md',sourceUrl:'memocard://note/test'});
function changeCaptureInput(element:HTMLElement, event:{target:{value:string;selectionStart?:number;selectionEnd?:number}}) {
  replaceCaptureText(element,event.target.value,event.target.selectionStart ?? event.target.value.length,event.target.selectionEnd ?? event.target.selectionStart ?? event.target.value.length);
}
const props={vaultId:'vault-a',vaultBinding:'binding-a',rootNotes:true,tags:['工作','生活'],disabled:false,canImage:true,onRecorded:vi.fn(),handle:{current:null}};
beforeEach(()=>{
  document.elementFromPoint=()=>null;
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('innerWidth',1024);
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  bridge.request.mockReset(); props.onRecorded.mockReset();
  bridge.request.mockImplementation(async(operation:string,params:Record<string,unknown>)=>operation==='saveNote' ? note(params) : operation==='pickImage' ? {relativePath:'assets/image.png',markdownPath:'assets/image.png',notePath:params.notePath} : {});
  Range.prototype.getClientRects=()=>[] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect=()=>new DOMRect();
  vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('renders editable page-style tags in the body and restores them with undo',()=>{
  render(<QuickCapture {...props}/>);
  const field=screen.getByRole('textbox',{name:'快速输入内容'});
  replaceCaptureText(field,'想法 #area/ai #area/design `#code`');
  expect([...field.querySelectorAll('.rich-inline-tag')].map(tag=>[tag.textContent,tag.getAttribute('data-tag')])).toEqual([['#area/ai','area%2Fai'],['#area/design','area%2Fdesign']]);
  expect(field.textContent).toBe('想法 #area/ai #area/design `#code`');
  const editor=noteEditor(field);
  act(()=>{editor.commands.insertContentAt({from:3,to:11},'已编辑');});
  expect([...field.querySelectorAll('.rich-inline-tag')].map(tag=>tag.textContent)).toEqual(['#area/design']);
  act(()=>{editor.commands.undo();});
  expect([...field.querySelectorAll('.rich-inline-tag')].map(tag=>tag.textContent)).toEqual(['#area/ai','#area/design']);
  expect(screen.queryByLabelText('已选标签')).toBeNull();
});

it('inserts picker tags into the body, deduplicates them and removes exact occurrences',async()=>{
  const user=userEvent.setup();render(<QuickCapture {...props} />);
  const input=screen.getByLabelText('快速输入内容') as HTMLDivElement;
  await user.click(screen.getByRole('button',{name:'选择标签'}));
  await user.click(screen.getByRole('button',{name:'工作'}));
  expect(input.textContent).toBe('#工作 ');
  expect(document.activeElement).toBe(input);
  expect(screen.getByRole('button',{name:'记录'})).toHaveProperty('disabled',true);
  changeCaptureInput(input,{target:{value:'正文 #工作 #工作 #工作/子项 `#工作`'}});
  expect(screen.queryByLabelText('已选标签')).toBeNull();
  expect(screen.queryByRole('button',{name:'移除标签 工作'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'选择标签'}));
  expect(screen.getByRole('button',{name:'工作'}).getAttribute('aria-pressed')).toBe('true');
  await user.click(screen.getByRole('button',{name:'工作'}));
  expect(input.textContent).toBe('正文   #工作/子项 `#工作`');
  expect(screen.getByRole('button',{name:'工作/子项'}).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button',{name:'工作'}).getAttribute('aria-pressed')).toBe('false');
  expect(bridge.request).not.toHaveBeenCalled();
});

it('completes an existing tag with Enter and creates new body tags from suggestions',async()=>{
  const user=userEvent.setup();render(<QuickCapture {...props} />);
  const input=screen.getByLabelText('快速输入内容') as HTMLDivElement;
  await user.type(input,'正文 #工');
  expect(await screen.findByRole('button',{name:'#工作'})).toBeTruthy();
  await user.keyboard('{Enter}');
  expect(input.textContent).toBe('正文 #工作 ');
  expect(screen.queryByLabelText('已选标签')).toBeNull();
  await user.type(input,'#project/new');
  await user.click(await screen.findByRole('button',{name:/#project\/new.*新标签/}));
  expect(input.textContent).toBe('正文 #工作 #project/new ');
  expect(screen.queryByLabelText('已选标签')).toBeNull();
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(bridge.request).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:'正文 #工作 #project/new',tags:['工作','project/new'],inheritedTags:[]}));
});

it('replaces only the tag at the caret and keeps newline and Escape behavior',async()=>{
  const user=userEvent.setup();render(<QuickCapture {...props} />);
  const input=screen.getByLabelText('快速输入内容') as HTMLDivElement;
  changeCaptureInput(input,{target:{value:'前文 #工 后文',selectionStart:5,selectionEnd:5}});
  await user.click(await screen.findByRole('button',{name:'#工作'}));
  expect(input.textContent).toBe('前文 #工作 后文');
  expect(noteEditor(input).state.selection.from).toBe(6);
  await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
  act(()=>{const editor=noteEditor(input);editor.commands.setTextSelection(editor.state.doc.content.size);});
  fireEvent.keyDown(input,{key:'Enter'});
  act(()=>{noteEditor(input).commands.insertContent({type:'text',text:'新段落 #'});});
  expect(input.textContent).toContain('\n新段落 #');
  expect(await screen.findByRole('group',{name:'标签建议'})).toBeTruthy();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('group',{name:'标签建议'})).toBeNull();
  expect(bridge.request).not.toHaveBeenCalled();
});

it('restores separate legacy draft tags into the body without losing content or identity',()=>{
  mobile();writeQuickCaptureDraft('vault-a',{id:'legacy',text:'旧草稿 #生活',tags:['工作','生活'],images:[],relativePath:'legacy.md'});
  render(<QuickCapture {...props} />);
  expect(screen.getByLabelText('快速输入内容')).toHaveProperty('textContent','旧草稿 #生活 #工作 ');
  expect(screen.queryByLabelText('已选标签')).toBeNull();
});

it('skips suggestions in code and keeps composition Enter from selecting or recording',()=>{
  render(<QuickCapture {...props} />);
  const input=screen.getByLabelText('快速输入内容') as HTMLDivElement;
  for(const text of ['`#工作`','```\n#工作\n```','[链接](#工作)','\\#工作']) {
    const caret=text.indexOf('#工作')+3;
    changeCaptureInput(input,{target:{value:text,selectionStart:caret,selectionEnd:caret}});
    expect(screen.queryByRole('group',{name:'标签建议'})).toBeNull();
  }
  fireEvent.compositionStart(input);
  changeCaptureInput(input,{target:{value:'正文 #工作'}});
  fireEvent.keyDown(input,{key:'Enter',isComposing:true,keyCode:229});
  expect(screen.queryByRole('group',{name:'标签建议'})).toBeNull();
  expect(bridge.request).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  expect(input.textContent).toBe('正文 #工作');
});

it('creates a source only on record and clears content, tags and images only after success',async()=>{
  const user=userEvent.setup();render(<QuickCapture {...props} onContinue={vi.fn()} />);
  expect(screen.queryByRole('button',{name:'切换为页面'})).toBeNull();
  expect(screen.getByRole('button',{name:'记录'}).hasAttribute('disabled')).toBe(true);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'一个值得记下的想法');
  await new Promise(resolve=>setTimeout(resolve,400));
  expect(bridge.request).not.toHaveBeenCalled();
  expect(bridge.request.mock.calls.some(([op])=>op==='saveNote')).toBe(false);
  await user.click(screen.getByRole('button',{name:'选择标签'}));
  await user.click(within(screen.getByRole('dialog',{name:'选择标签'})).getByRole('button',{name:'工作'}));
  await user.click(screen.getByRole('button',{name:'添加图片'}));
  await screen.findByRole('img',{name:'待记录图片 1'});
  expect(bridge.request.mock.calls.map(([op])=>op)).toEqual(['pickImage']);
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(bridge.request).toHaveBeenCalledWith('saveNote',expect.objectContaining({title:'',body:'一个值得记下的想法 #工作\n\n![图片](assets/image.png)',inheritedTags:[],baseHash:null,vaultId:'vault-a',vaultBinding:'binding-a'}));
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLDivElement).textContent).toBe('');
  act(()=>{noteEditor(screen.getByRole('textbox',{name:'快速输入内容'})).commands.undo();});
  expect(screen.getByRole('textbox',{name:'快速输入内容'}).textContent).toBe('');
  expect(screen.queryByRole('img',{name:'待记录图片 1'})).toBeNull();
  expect(screen.queryByRole('button',{name:'移除标签 工作'})).toBeNull();
  expect(bridge.request.mock.calls.some(([op])=>op==='saveDraft')).toBe(false);
});

it('retains input and attachment on failure and retries with the same note identity',async()=>{
  const user=userEvent.setup();const implementation=bridge.request.getMockImplementation()!;
  let fail=true;
  bridge.request.mockImplementation((op,params)=>op==='saveNote' && fail ? Promise.reject(new Error('磁盘只读')) : implementation(op,params));
  render(<QuickCapture {...props} />);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'保存失败也保留');
  await user.click(screen.getByRole('button',{name:'添加图片'}));
  await screen.findByRole('img',{name:'待记录图片 1'});
  await user.click(screen.getByRole('button',{name:'记录'}));
  await screen.findByText('磁盘只读');
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLDivElement).textContent).toBe('保存失败也保留');
  expect(screen.getByRole('img',{name:'待记录图片 1'})).toBeTruthy();
  expect(props.onRecorded).not.toHaveBeenCalled();
  fail=false;await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  const writes=bridge.request.mock.calls.filter(([op])=>op==='saveNote');
  expect(writes).toHaveLength(2);expect(writes[0][1].id).toBe(writes[1][1].id);
});

it('blocks duplicate submissions and supports the shortcut',async()=>{
  const user=userEvent.setup();let finish!:(note:Note)=>void;
  bridge.request.mockImplementation((op,params)=>op==='saveNote' ? new Promise(resolve=>{finish=()=>resolve(note(params));}) : Promise.resolve({}));
  render(<QuickCapture {...props} />);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'只记录一次');
  await user.keyboard('{Control>}{Enter}{/Control}');
  await waitFor(()=>expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(1));
  await user.keyboard('{Control>}{Enter}{/Control}');
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(1);
  finish(note({id:'test',body:'只记录一次'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
});

it('restores desktop focus after the saved input is enabled, even when a frame precedes the DOM commit',async()=>{
  const frames:FrameRequestCallback[]=[];
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.push(callback);return frames.length;});
  let finish!:()=>void, delivered!:()=>void;
  const recorded=new Promise<void>(resolve=>{delivered=resolve;});
  const onRecorded=vi.fn(()=>delivered());
  bridge.request.mockImplementation((operation,params)=>operation === 'saveNote' ? new Promise(resolve=>{finish=()=>resolve(note(params));}) : Promise.reject(new Error(`Unexpected operation: ${operation}`)));
  const user=userEvent.setup();render(<QuickCapture {...props} onRecorded={onRecorded} />);
  const input=screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLDivElement;
  await user.type(input,'保存后继续输入');
  await user.click(screen.getByRole('button',{name:'记录'}));
  expect(input.getAttribute('contenteditable')).toBe('false');
  await act(async()=>{
    finish();await recorded;
    // A browser frame can run before React commits the pending busy=false update.
    expect(input.getAttribute('contenteditable')).toBe('false');
    frames.splice(0).forEach(callback=>callback(performance.now()));
  });
  expect(onRecorded).toHaveBeenCalledOnce();
  expect(input.getAttribute('contenteditable')).toBe('true');
  expect(input.textContent).toBe('');
  expect(document.activeElement).toBe(input);
});

it('opens retained drafts without submitting or clearing the current capture',async()=>{
  const user=userEvent.setup();const onOpenDrafts=vi.fn();
  render(<QuickCapture {...props} draftCount={2} onOpenDrafts={onOpenDrafts} />);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'继续保留当前想法');
  await user.click(screen.getByRole('button',{name:'保留草稿（2）'}));
  expect(onOpenDrafts).toHaveBeenCalledOnce();
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLDivElement).textContent).toBe('继续保留当前想法');
  expect(bridge.request.mock.calls.some(([op])=>op==='saveNote')).toBe(false);
});

it('keeps unsubmitted content only in the current page and never persists on unmount',async()=>{
  const user=userEvent.setup();const page=render(<QuickCapture {...props} />);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'未点击记录');
  await new Promise(resolve=>setTimeout(resolve,400));
  page.unmount();
  render(<QuickCapture {...props} />);
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLDivElement).textContent).toBe('');
  expect(bridge.request).not.toHaveBeenCalled();
});

function mobile() {
  vi.stubGlobal('innerWidth',390);
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
}

function pageStorage(): Storage {
  const values = new Map<string, string>();
  return {get length() { return values.size; }, clear: () => values.clear(), getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null, removeItem: key => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); }};
}

it.each(['record', 'continue'] as const)('keeps another mobile page draft protected after %s', async action => {
  mobile();
  vi.stubGlobal('sessionStorage', pageStorage());
  const first = renderHook(() => useQuickCapture({...props, handle: {current: null}, onContinue: vi.fn()}));
  vi.stubGlobal('sessionStorage', pageStorage());
  const second = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  act(() => first.result.current.changeCapture({...first.result.current.capture, text: 'Page A'}));
  act(() => second.result.current.changeCapture({...second.result.current.capture, text: 'Page B'}));
  await act(async () => { if (action === 'record') await first.result.current.record(); else await first.result.current.continueInPage(); });
  expect(second.result.current.capture.text).toBe('Page B');
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Page B');
  second.unmount();
  const reopened = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(reopened.result.current.capture.text).toBe('Page B');
});

it('restores each mobile page own draft after refresh and reclaims replaced revisions', () => {
  mobile();
  const pageA = pageStorage(), pageB = pageStorage();
  vi.stubGlobal('sessionStorage', pageA);
  const first = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  vi.stubGlobal('sessionStorage', pageB);
  const second = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  for (let index = 0; index < 20; index++) {
    act(() => first.result.current.changeCapture({...first.result.current.capture, text: `Page A ${index}`}));
    act(() => second.result.current.changeCapture({...second.result.current.capture, text: `Page B ${index}`}));
  }
  expect(localStorage.length).toBeLessThanOrEqual(3);
  first.unmount(); second.unmount();
  vi.stubGlobal('sessionStorage', pageA);
  const reopenedA = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(reopenedA.result.current.capture.text).toBe('Page A 19');
  vi.stubGlobal('sessionStorage', pageB);
  const reopenedB = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(reopenedB.result.current.capture.text).toBe('Page B 19');
});

it('retires only the restored legacy snapshot while retaining a later legacy page update', () => {
  mobile();
  const original = {id: 'legacy', text: 'Legacy A', tags: [], images: [], relativePath: 'legacy.md'};
  writeQuickCaptureDraft(props.vaultId, original);
  const first = createQuickCaptureDraftProtection(props.vaultId);
  expect(first.read()?.text).toBe('Legacy A');
  writeQuickCaptureDraft(props.vaultId, {...original, text: 'Legacy B'});
  first.write({...original, text: ''});
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Legacy B');
});

it('forks a copied page revision before editing so the original page cannot clear it', async () => {
  mobile();
  const pageA = pageStorage(), pageB = pageStorage();
  vi.stubGlobal('sessionStorage', pageA);
  const first = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  act(() => first.result.current.changeCapture({...first.result.current.capture, text: 'Shared starting point'}));
  for (let index = 0; index < pageA.length; index++) { const key = pageA.key(index)!; pageB.setItem(key, pageA.getItem(key)!); }
  vi.stubGlobal('sessionStorage', pageB);
  const second = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(second.result.current.capture.text).toBe('Shared starting point');
  act(() => second.result.current.changeCapture({...second.result.current.capture, text: 'Copied page changes'}));
  await act(async () => { await first.result.current.record(); });
  second.unmount();
  const reopened = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(reopened.result.current.capture.text).toBe('Copied page changes');
});

it.each(['copied', 'latest'] as const)('retains the original page after a %s borrower edits or clears its snapshot', mode => {
  mobile();
  const pageA = pageStorage(), pageB = pageStorage();
  vi.stubGlobal('sessionStorage', pageA);
  const first = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  act(() => first.result.current.changeCapture({...first.result.current.capture, text: 'Shared starting point'}));
  if (mode === 'copied') for (let index = 0; index < pageA.length; index++) { const key = pageA.key(index)!; pageB.setItem(key, pageA.getItem(key)!); }
  vi.stubGlobal('sessionStorage', pageB);
  const second = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(second.result.current.capture.text).toBe('Shared starting point');
  act(() => second.result.current.changeCapture({...second.result.current.capture, text: 'Borrowed page changes'}));
  first.unmount(); vi.stubGlobal('sessionStorage', pageA);
  const refreshed = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(refreshed.result.current.capture.text).toBe('Shared starting point');
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Borrowed page changes');
  act(() => second.result.current.changeCapture({...second.result.current.capture, text: '', images: []}));
  refreshed.unmount();
  const reopened = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(reopened.result.current.capture.text).toBe('Shared starting point');
});

it.each(['record', 'continue'] as const)('does not revive an unchanged snapshot after two reloads and successful %s', async action => {
  mobile(); vi.stubGlobal('sessionStorage', pageStorage());
  let current = renderHook(() => useQuickCapture({...props, handle: {current: null}, onContinue: vi.fn()}));
  act(() => current.result.current.changeCapture({...current.result.current.capture, text: 'Complete this snapshot'}));
  for (let index = 0; index < 2; index++) {
    current.unmount();
    current = renderHook(() => useQuickCapture({...props, handle: {current: null}, onContinue: vi.fn()}));
    expect(current.result.current.capture.text).toBe('Complete this snapshot');
  }
  await act(async () => { if (action === 'record') await current.result.current.record(); else await current.result.current.continueInPage(); });
  expect(readQuickCaptureDraft(props.vaultId)).toBeNull();
  vi.stubGlobal('sessionStorage', pageStorage());
  const fresh = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(fresh.result.current.capture.text).toBe('');
});

it('keeps a different borrowed source globally discoverable after recording the edited copy', async () => {
  mobile(); vi.stubGlobal('sessionStorage', pageStorage());
  const first = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  act(() => first.result.current.changeCapture({...first.result.current.capture, text: 'Original unsaved content'}));
  first.unmount(); vi.stubGlobal('sessionStorage', pageStorage());
  const second = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  act(() => second.result.current.changeCapture({...second.result.current.capture, text: 'Different completed content'}));
  await act(async () => { await second.result.current.record(); });
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Original unsaved content');
  vi.stubGlobal('sessionStorage', pageStorage());
  const fresh = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(fresh.result.current.capture.text).toBe('Original unsaved content');
});

it('keeps a borrowed legacy snapshot after manual clearing but retires completed legacy tags', async () => {
  mobile(); vi.stubGlobal('sessionStorage', pageStorage());
  const legacy = {id: 'legacy-tags', text: 'Legacy content', tags: ['工作'], images: [], relativePath: 'legacy.md'};
  writeQuickCaptureDraft(props.vaultId, legacy);
  const borrower = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  act(() => borrower.result.current.changeCapture({...borrower.result.current.capture, text: '', images: []}));
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Legacy content');
  borrower.unmount();
  const cleared = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(cleared.result.current.capture.text).toBe('');
  cleared.unmount();
  vi.stubGlobal('sessionStorage', pageStorage());
  const recording = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(recording.result.current.capture.text).toBe('Legacy content #工作 ');
  await act(async () => { await recording.result.current.record(); });
  expect(readQuickCaptureDraft(props.vaultId)).toBeNull();
});

it('protects new input on retry after both prior completion cleanup and the new write failed', async () => {
  mobile(); vi.stubGlobal('sessionStorage', pageStorage());
  const current = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  act(() => current.result.current.changeCapture({...current.result.current.capture, text: 'Already recorded A'}));
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Cleanup unavailable'); });
  await act(async () => { await current.result.current.record(); });
  remove.mockRestore();
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Write unavailable'); });
  act(() => current.result.current.changeCapture({...current.result.current.capture, text: 'Still unsaved B'}));
  expect(current.result.current.draftError).not.toBe('');
  write.mockRestore();
  act(() => current.result.current.retryProtection());
  expect(current.result.current.draftError).toBe('');
  current.unmount();
  const reopened = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(reopened.result.current.capture.text).toBe('Still unsaved B');
});

it('shows a readable restored draft when quota prevents creating its initial page snapshot', async () => {
  mobile(); vi.stubGlobal('sessionStorage', pageStorage());
  writeQuickCaptureDraft(props.vaultId, {id: 'quota-draft', text: 'Readable protected content', tags: [], images: [], relativePath: 'quota.md'});
  const original = localStorage.getItem('memocard:quick-capture:v1:vault-a');
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
  render(<QuickCapture {...props} />);
  expect(screen.getByRole('textbox', {name: '快速输入内容'})).toHaveProperty('textContent', 'Readable protected content');
  expect(screen.getByRole('status').textContent).toContain('草稿保护暂不可用');
  expect(localStorage.getItem('memocard:quick-capture:v1:vault-a')).toBe(original);
  write.mockRestore();
  await userEvent.setup().click(screen.getByRole('button', {name: '重试草稿保护'}));
  expect(screen.getByRole('status').textContent).not.toContain('草稿保护暂不可用');
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Readable protected content');
});

it('keeps protection failure visible when recovery succeeds but its new snapshot cannot be stored', () => {
  mobile(); vi.stubGlobal('sessionStorage', pageStorage());
  localStorage.setItem('memocard:quick-capture:v1:vault-a', 'unreadable');
  const capture = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(capture.result.current.draftError).toContain('无法恢复');
  writeQuickCaptureDraft(props.vaultId, {id: 'recovered-quota', text: 'Recovered content', tags: [], images: [], relativePath: 'recovered.md'});
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
  act(() => capture.result.current.retryProtection());
  expect(capture.result.current.capture.text).toBe('Recovered content');
  expect(capture.result.current.draftError).toContain('草稿保护暂不可用');
  write.mockRestore();
  act(() => capture.result.current.retryProtection());
  expect(capture.result.current.draftError).toBe('');
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Recovered content');
});

it('retains a different page revision written during successful record cleanup', () => {
  const capture = {id: 'first', text: 'Page A', tags: [], images: [], relativePath: 'first.md'};
  vi.stubGlobal('sessionStorage', pageStorage());
  const first = createQuickCaptureDraftProtection(props.vaultId); first.write(capture);
  vi.stubGlobal('sessionStorage', pageStorage());
  const second = createQuickCaptureDraftProtection(props.vaultId); second.write({...capture, id: 'second', text: 'Page B'});
  const remove = Storage.prototype.removeItem;
  let interleaved = false;
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function(this:Storage, key) {
    if (!interleaved) { interleaved = true; second.write({...capture, id: 'second', text: 'Page B latest'}); }
    remove.call(this, key);
  });
  first.write({...capture, text: ''});
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Page B latest');
  expect(second.read()?.text).toBe('Page B latest');
});

it('keeps local draft recovery available when session storage rejects its page pointer', () => {
  mobile();
  const page = pageStorage();
  page.setItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
  vi.stubGlobal('sessionStorage', page);
  writeQuickCaptureDraft(props.vaultId, {id: 'legacy', text: 'Recover locally', tags: [], images: [], relativePath: 'legacy.md'});
  const capture = renderHook(() => useQuickCapture({...props, handle: {current: null}}));
  expect(capture.result.current.capture.text).toBe('Recover locally');
  act(() => capture.result.current.changeCapture({...capture.result.current.capture, text: 'Still protected'}));
  expect(readQuickCaptureDraft(props.vaultId)?.text).toBe('Still protected');
  expect(capture.result.current.draftError).toBe('');
});

it('restores mobile text, selected tags and attachments after remount without creating a source',async()=>{
  mobile();
  const user=userEvent.setup();const page=render(<QuickCapture {...props} />);
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'随手记下的想法'}});
  await user.click(screen.getByRole('button',{name:'选择标签'}));
  await user.click(within(screen.getByRole('dialog',{name:'选择标签'})).getByRole('button',{name:'工作'}));
  await user.click(screen.getByRole('button',{name:'添加图片'}));
  await screen.findByRole('img',{name:'待记录图片 1'});
  const draft=readQuickCaptureDraft('vault-a')!;
  expect(draft).toMatchObject({text:'随手记下的想法 #工作 ',tags:['工作'],images:[{relativePath:'assets/image.png'}]});
  expect(bridge.request.mock.calls.map(([op])=>op)).toEqual(['pickImage']);
  page.unmount();
  render(<QuickCapture {...props} vaultBinding="reopened-binding" />);
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent',draft.text);
  expect(screen.queryByLabelText('已选标签')).toBeNull();
  expect(screen.getByRole('img',{name:'待记录图片 1'})).toBeTruthy();
  expect(screen.getByRole('status').textContent).not.toContain('草稿保护暂不可用');
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(bridge.request).toHaveBeenCalledWith('saveNote',expect.objectContaining({id:draft.id,vaultBinding:'reopened-binding',tags:['工作'],inheritedTags:[]}));
  expect(readQuickCaptureDraft('vault-a')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('已保存到本机');
});

it('isolates mobile drafts by vault and persists the last input before unmount',()=>{
  mobile();
  const page=render(<QuickCapture {...props} />);
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'库 A 的内容'}});
  page.unmount();
  const other=render(<QuickCapture {...props} vaultId="vault-b" />);
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','');
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'库 B 的内容'}});
  other.unmount();
  render(<QuickCapture {...props} />);
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','库 A 的内容');
  expect(readQuickCaptureDraft('vault-b')?.text).toBe('库 B 的内容');
  expect(bridge.request).not.toHaveBeenCalled();
});

it('keeps the protected mobile draft and note identity after a failed record, then clears only after success',async()=>{
  mobile();const user=userEvent.setup();const implementation=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='saveNote' ? Promise.reject(new Error('磁盘只读')) : implementation(op,params));
  const page=render(<QuickCapture {...props} />);
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'需要恢复'}});
  await user.click(screen.getByRole('button',{name:'记录'}));
  await screen.findByText('磁盘只读');
  const draft=readQuickCaptureDraft('vault-a')!;
  page.unmount();
  bridge.request.mockImplementation(implementation);
  const reopened=render(<QuickCapture {...props} />);
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','需要恢复');
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote').map(([,params])=>params.id)).toEqual([draft.id,draft.id]);
  reopened.unmount();render(<QuickCapture {...props} />);
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','');
});

it('reports storage failure without losing input or claiming protection and retries on mobile',async()=>{
  mobile();const user=userEvent.setup();
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('Quota exceeded');});
  render(<QuickCapture {...props} />);
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'仍留在输入框'}});
  expect(screen.getByRole('status').textContent).toContain('草稿保护暂不可用');
  expect(screen.queryByText(/草稿已保存在本机/)).toBeNull();
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','仍留在输入框');
  write.mockRestore();
  await user.click(screen.getByRole('button',{name:'重试草稿保护'}));
  expect(readQuickCaptureDraft('vault-a')?.text).toBe('仍留在输入框');
  expect(screen.getByRole('status').textContent).not.toContain('草稿保护暂不可用');
});

it('leaves an unreadable mobile draft intact even when retrying restoration',async()=>{
  mobile();
  localStorage.setItem('memocard:quick-capture:v1:vault-a','{"version":1,"capture":{}}');
  render(<QuickCapture {...props} />);
  expect(screen.getByRole('status').textContent).toContain('无法恢复本机草稿');
  await userEvent.setup().click(screen.getByRole('button',{name:'重试恢复草稿'}));
  expect(localStorage.getItem('memocard:quick-capture:v1:vault-a')).toBe('{"version":1,"capture":{}}');
});

it('reports cleanup failure after a successful mobile record and retries without creating another note',async()=>{
  mobile();const user=userEvent.setup();render(<QuickCapture {...props} />);
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'已记录的想法'}});
  const remove=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('Storage unavailable');});
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(screen.getByRole('status').textContent).toContain('记录已保存，临时草稿未清除');
  expect(readQuickCaptureDraft('vault-a')).not.toBeNull();
  remove.mockRestore();await user.click(screen.getByRole('button',{name:'重试清理草稿'}));
  expect(readQuickCaptureDraft('vault-a')).toBeNull();
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(1);
});

it('does not restore or overwrite a mobile draft on desktop',()=>{
  writeQuickCaptureDraft('vault-a',{id:'mobile-id',text:'手机草稿',tags:[],images:[],relativePath:'mobile.md'});
  const page=render(<QuickCapture {...props} />);
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','');
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'桌面输入'}});
  page.unmount();
  expect(readQuickCaptureDraft('vault-a')?.text).toBe('手机草稿');
  expect(screen.queryByRole('status')).toBeNull();
});

it('restores a protected mobile draft when the desktop memory is empty',()=>{
  mobile();
  const capture={id:'mobile-id',text:'手机草稿',tags:[],images:[],relativePath:'mobile.md'};
  writeQuickCaptureDraft('vault-a',capture);
  const memory={current:{vaultId:'vault-a',vaultBinding:'binding-a',capture:{...capture,text:''}}};
  render(<QuickCapture {...props} memory={memory} />);
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','手机草稿');
  expect(readQuickCaptureDraft('vault-a')?.text).toBe('手机草稿');
});

it('opens docked capture with focus, keeps text when closed and restores it after remount',async()=>{
  mobile();const user=userEvent.setup();const page=render(<QuickCapture {...props} docked />);
  const entry=screen.getByRole('button',{name:'打开快速记录'});
  expect(screen.queryByRole('textbox',{name:'快速输入内容'})).toBeNull();
  await user.click(entry);
  const input=await screen.findByRole('textbox',{name:'快速输入内容'});
  await waitFor(()=>expect(document.activeElement).toBe(input));
  changeCaptureInput(input,{target:{value:'收起后继续'}});
  const popup=screen.getByRole('dialog',{name:'快速记录'});
  await waitFor(()=>expect(popup.hasAttribute('data-swipe-ready')).toBe(true));
  swipeSheet(popup.querySelector('[data-slot="sheet-handle"]')!,160);
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'快速记录'})).toBeNull());
  expect(document.activeElement).toBe(entry);
  expect(entry.textContent).toBe('收起后继续');
  page.unmount();render(<QuickCapture {...props} docked />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  expect(await screen.findByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','收起后继续');
  expect(bridge.request).not.toHaveBeenCalled();
});

it('retains docked input in memory when protection fails and the sheet is closed',async()=>{
  mobile();const user=userEvent.setup();render(<QuickCapture {...props} docked />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  const set=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage full');});
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'仍保留在页面'}});
  await user.click(screen.getByRole('button',{name:'收起快速记录'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'快速记录'})).toBeNull());
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','仍保留在页面');
  expect(screen.getByRole('status').textContent).toContain('草稿保护暂不可用');
  set.mockRestore();
});

it('keeps a failed docked record open, blocks dismissal while saving and closes only after success',async()=>{
  mobile();const user=userEvent.setup();let finish!:(note:Note)=>void;
  const original=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='saveNote' ? Promise.reject(new Error('保存失败')) : original(op,params));
  render(<QuickCapture {...props} docked />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'记录这条想法'}});
  await user.click(screen.getByRole('button',{name:'记录'}));
  await screen.findByText('保存失败');
  expect(screen.getByRole('dialog',{name:'快速记录'})).toBeTruthy();
  bridge.request.mockImplementation((op,params)=>op==='saveNote' ? new Promise(resolve=>{finish=()=>resolve(note(params));}) : original(op,params));
  await user.click(screen.getByRole('button',{name:'记录'}));
  const savingPopup=screen.getByRole('dialog',{name:'快速记录'});
  await waitFor(()=>expect(savingPopup.hasAttribute('data-swipe-ready')).toBe(true));
  swipeSheet(screen.getByRole('heading',{name:'快速记录'}),160);
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog',{name:'快速记录'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'收起快速记录'})).toHaveProperty('disabled',true);
  finish(note({id:'test',body:'记录这条想法'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'快速记录'})).toBeNull());
  expect(props.onRecorded).toHaveBeenCalledOnce();
  expect(readQuickCaptureDraft('vault-a')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button',{name:'打开快速记录'}));
});

it('closes docked capture on a detail or settings transition without discarding its draft',async()=>{
  mobile();const user=userEvent.setup();const page=render(<QuickCapture {...props} docked active />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'切换页面保留'}});
  page.rerender(<QuickCapture {...props} docked active={false} />);
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'快速记录'})).toBeNull());
  page.rerender(<QuickCapture {...props} docked active />);
  expect(screen.queryByRole('dialog',{name:'快速记录'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','切换页面保留');
});

it('keeps the capture sheet within the visible viewport when the mobile keyboard opens',async()=>{
  mobile();vi.stubGlobal('innerHeight',800);
  const viewport=Object.assign(new EventTarget(),{height:300,offsetTop:0});
  vi.stubGlobal('visualViewport',viewport);
  render(<QuickCapture {...props} docked />);
  await userEvent.setup().click(screen.getByRole('button',{name:'打开快速记录'}));
  const sheet=screen.getByRole('dialog',{name:'快速记录'});
  expect(sheet.style.bottom).toBe('500px');
  expect(sheet.style.maxHeight).toBe('284px');
  act(()=>{viewport.height=360;viewport.offsetTop=10;viewport.dispatchEvent(new Event('resize'));});
  expect(sheet.style.bottom).toBe('430px');
  expect(sheet.style.maxHeight).toBe('344px');
});

it('hands content, tags and images to a page only after protecting the draft',async()=>{
  mobile();const user=userEvent.setup(),onContinue=vi.fn();
  let finish!:()=>void;
  const original=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='saveDraft' ? new Promise(resolve=>{finish=()=>resolve({draftKey:'handoff',revision:'version-1'});}) : original(op,params));
  render(<QuickCapture {...props} docked onContinue={onContinue} />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'    继续写这段正文'}});
  await user.click(screen.getByRole('button',{name:'选择标签'}));
  await user.click(screen.getByRole('button',{name:'工作'}));
  await user.click(screen.getByRole('button',{name:'添加图片'}));
  await screen.findByRole('img',{name:'待记录图片 1'});
  const id=readQuickCaptureDraft('vault-a')!.id;
  await user.click(screen.getByRole('button',{name:'切换为页面'}));
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'切换为页面'})).toHaveProperty('disabled',true);
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog',{name:'快速记录'})).toBeTruthy();
  expect(readQuickCaptureDraft('vault-a')?.id).toBe(id);
  finish();
  await waitFor(()=>expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({id,title:undefined,body:'    继续写这段正文 #工作 \n\n![图片](assets/image.png)',inheritedTags:[],baseHash:null,vaultId:'vault-a',vaultBinding:'binding-a',recoveredFrom:{draftKey:'handoff',revision:'version-1'}})));
  expect(bridge.request.mock.calls.some(([op])=>op==='saveNote')).toBe(false);
  expect(readQuickCaptureDraft('vault-a')).toBeNull();
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','');
});

it('keeps the capture intact when protecting the page draft fails',async()=>{
  mobile();const user=userEvent.setup(),onContinue=vi.fn();
  const original=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='saveDraft' ? Promise.reject(new Error('草稿写入失败')) : original(op,params));
  render(<QuickCapture {...props} docked onContinue={onContinue} />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'不能丢失的内容'}});
  await user.click(screen.getByRole('button',{name:'切换为页面'}));
  expect((await screen.findByRole('alert')).textContent).toBe('草稿写入失败');
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','不能丢失的内容');
  expect(readQuickCaptureDraft('vault-a')?.text).toBe('不能丢失的内容');
});

it('retains the original capture if local cleanup fails after protecting the page draft',async()=>{
  mobile();const user=userEvent.setup(),onContinue=vi.fn();
  render(<QuickCapture {...props} docked onContinue={onContinue} />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'交接失败后保留'}});
  const remove=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('storage unavailable');});
  await user.click(screen.getByRole('button',{name:'切换为页面'}));
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox',{name:'快速输入内容'})).toHaveProperty('textContent','交接失败后保留');
  expect(readQuickCaptureDraft('vault-a')?.text).toBe('交接失败后保留');
  remove.mockRestore();
});

it('does not discard an unreadable capture when continuing into a page',async()=>{
  mobile();const user=userEvent.setup(),onContinue=vi.fn();
  localStorage.setItem('memocard:quick-capture:v1:vault-a','unreadable');
  render(<QuickCapture {...props} docked onContinue={onContinue} />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  expect(screen.getByRole('button',{name:'切换为页面'})).toHaveProperty('disabled',true);
  await user.click(screen.getByRole('button',{name:'切换为页面'}));
  expect(onContinue).not.toHaveBeenCalled();
  expect(localStorage.getItem('memocard:quick-capture:v1:vault-a')).toBe('unreadable');
});

it('leaves docked cleanup failures visible after recording without submitting a duplicate',async()=>{
  mobile();const user=userEvent.setup();render(<QuickCapture {...props} docked />);
  await user.click(screen.getByRole('button',{name:'打开快速记录'}));
  changeCaptureInput(screen.getByRole('textbox',{name:'快速输入内容'}),{target:{value:'已经记录'}});
  const remove=vi.spyOn(Storage.prototype,'removeItem').mockImplementation(()=>{throw new Error('storage unavailable');});
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(screen.getByRole('status').textContent).toContain('记录已保存，临时草稿未清除');
  expect(screen.getByRole('dialog',{name:'快速记录'})).toBeTruthy();
  remove.mockRestore();await user.click(screen.getByRole('button',{name:'重试清理草稿'}));
  expect(readQuickCaptureDraft('vault-a')).toBeNull();
  expect(bridge.request.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(1);
});
