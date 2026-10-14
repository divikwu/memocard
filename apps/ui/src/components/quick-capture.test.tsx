// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note } from '@memocard/contracts';
import { QuickCapture } from './quick-capture';

const bridge=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../bridge',()=>({request:bridge.request,errorMessage:(cause:unknown)=>cause instanceof Error ? cause.message : '操作未完成'}));
vi.mock('../NoteImage',()=>({NoteImage:({source,alt}:{source:string;alt:string})=><img src={source} alt={alt} />}));
const note=(params:Record<string,unknown>):Note=>({id:params.id as string,title:'新内容',body:params.body as string,tags:params.inheritedTags as string[] ?? [],createdAt:'2026-10-14T08:00:00Z',updatedAt:'2026-10-14T08:00:00Z',contentHash:'saved',relativePath:'新内容.md',sourceUrl:'memocard://note/test'});
const props={vaultId:'vault-a',vaultBinding:'binding-a',rootNotes:true,tags:['工作','生活'],disabled:false,canImage:true,onRecorded:vi.fn(),handle:{current:null}};
beforeEach(()=>{
  bridge.request.mockReset(); props.onRecorded.mockReset();
  bridge.request.mockImplementation(async(operation:string,params:Record<string,unknown>)=>operation==='saveNote' ? note(params) : operation==='pickImage' ? {relativePath:'assets/image.png',markdownPath:'assets/image.png',notePath:params.notePath} : {});
  vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('creates a source only on record and clears content, tags and images only after success',async()=>{
  const user=userEvent.setup();render(<QuickCapture {...props} />);
  expect(screen.getByRole('button',{name:'记录'}).hasAttribute('disabled')).toBe(true);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'一个值得记下的想法');
  await new Promise(resolve=>setTimeout(resolve,400));
  expect(bridge.request).not.toHaveBeenCalled();
  expect(bridge.request.mock.calls.some(([op])=>op==='saveNote')).toBe(false);
  await user.click(screen.getByRole('button',{name:'选择标签'}));
  await user.click(within(screen.getByRole('dialog',{name:'选择标签'})).getByRole('button',{name:'工作'}));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button',{name:'添加图片'}));
  await screen.findByRole('img',{name:'待记录图片 1'});
  expect(bridge.request.mock.calls.map(([op])=>op)).toEqual(['pickImage']);
  await user.click(screen.getByRole('button',{name:'记录'}));
  await waitFor(()=>expect(props.onRecorded).toHaveBeenCalledOnce());
  expect(bridge.request).toHaveBeenCalledWith('saveNote',expect.objectContaining({title:'',body:'一个值得记下的想法\n\n![图片](assets/image.png)',inheritedTags:['工作'],baseHash:null,vaultId:'vault-a',vaultBinding:'binding-a'}));
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLTextAreaElement).value).toBe('');
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
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLTextAreaElement).value).toBe('保存失败也保留');
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

it('opens retained drafts without submitting or clearing the current capture',async()=>{
  const user=userEvent.setup();const onOpenDrafts=vi.fn();
  render(<QuickCapture {...props} draftCount={2} onOpenDrafts={onOpenDrafts} />);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'继续保留当前想法');
  await user.click(screen.getByRole('button',{name:'保留草稿（2）'}));
  expect(onOpenDrafts).toHaveBeenCalledOnce();
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLTextAreaElement).value).toBe('继续保留当前想法');
  expect(bridge.request.mock.calls.some(([op])=>op==='saveNote')).toBe(false);
});

it('keeps unsubmitted content only in the current page and never persists on unmount',async()=>{
  const user=userEvent.setup();const page=render(<QuickCapture {...props} />);
  await user.type(screen.getByRole('textbox',{name:'快速输入内容'}),'未点击记录');
  await new Promise(resolve=>setTimeout(resolve,400));
  page.unmount();
  render(<QuickCapture {...props} />);
  expect((screen.getByRole('textbox',{name:'快速输入内容'}) as HTMLTextAreaElement).value).toBe('');
  expect(bridge.request).not.toHaveBeenCalled();
});
