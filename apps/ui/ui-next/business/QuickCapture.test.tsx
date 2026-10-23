// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { swipeSheet } from '../../src/components/ui/sheet-swipe.test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { noteEditor, replaceCaptureText } from '../../src/editor-test-utils';
import type { Note } from '@memocard/contracts';
import { QuickCapture } from './QuickCapture';
import { readQuickCaptureDraft } from '../../src/quick-capture-draft';

const bridge=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../../src/bridge',()=>({isLocalWeb:false,request:bridge.request,errorMessage:(cause:unknown)=>cause instanceof Error ? cause.message : '操作未完成'}));
vi.mock('./NoteMarkdown',()=>({VaultImage:({source,alt}:{source:string;alt:string})=><img src={source} alt={alt} />}));
const note=(params:Record<string,unknown>):Note=>({id:params.id as string,title:'新内容',body:params.body as string,tags:params.inheritedTags as string[] ?? [],createdAt:'2026-10-14T08:00:00Z',updatedAt:'2026-10-14T08:00:00Z',contentHash:'saved',relativePath:'新内容.md',sourceUrl:'memocard://note/test'});
function changeCaptureInput(element:HTMLElement, event:{target:{value:string;selectionStart?:number;selectionEnd?:number}}) {
  replaceCaptureText(element,event.target.value,event.target.selectionStart ?? event.target.value.length,event.target.selectionEnd ?? event.target.selectionStart ?? event.target.value.length);
}
const props={vaultId:'vault-a',vaultBinding:'binding-a',rootNotes:true,tags:['工作','生活'],disabled:false,canImage:true,onRecorded:vi.fn(),handle:{current:null}};
beforeEach(()=>{
  document.elementFromPoint=()=>null;
  localStorage.clear();
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

function mobile() {
  vi.stubGlobal('innerWidth',390);
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
}

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
  expect(screen.getByRole('status').textContent).toContain('草稿已保存在本机');
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(bridge.request).toHaveBeenCalledWith('saveNote',expect.objectContaining({id:draft.id,vaultBinding:'reopened-binding',tags:['工作'],inheritedTags:[]}));
  expect(readQuickCaptureDraft('vault-a')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('已保存到本机');
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
  expect(screen.getByRole('status').textContent).toContain('草稿已保存在本机');
});

it('leaves an unreadable mobile draft intact even when retrying restoration',async()=>{
  mobile();
  localStorage.setItem('memocard:quick-capture:v1:vault-a','{"version":1,"capture":{}}');
  render(<QuickCapture {...props} />);
  expect(screen.getByRole('status').textContent).toContain('无法恢复本机草稿');
  await userEvent.setup().click(screen.getByRole('button',{name:'重试恢复草稿'}));
  expect(localStorage.getItem('memocard:quick-capture:v1:vault-a')).toBe('{"version":1,"capture":{}}');
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
