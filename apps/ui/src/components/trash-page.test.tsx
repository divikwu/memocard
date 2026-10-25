// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note, TrashItem } from '@memocard/contracts';
import { TrashPage } from '@ui-next/business/TrashPage';
const bridge=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('../bridge',()=>({request:bridge.request,errorMessage:(cause:unknown)=>cause instanceof Error ? cause.message : '失败'}));
vi.mock('@ui-next/business/NoteMarkdown',()=>({NoteMarkdown:({body,notePath}:{body:string;notePath:string})=><article data-path={notePath}>{body}</article>}));
const note:Note={id:'note',title:'旧笔记',body:'完整正文与图片',tags:['工作'],createdAt:'2026-10-14T08:00:00Z',updatedAt:'2026-10-14T08:00:00Z',contentHash:'fresh',relativePath:'Folder/旧笔记.md',sourceUrl:'memocard://note/note'};
const item:TrashItem={trashKey:'token/Folder/旧笔记.md',id:note.id,title:note.title,relativePath:note.relativePath,deletedAt:'2026-10-14T09:00:00Z',contentHash:'listed',preview:'正文预览'};
const props={vaultId:'vault',vaultBinding:'binding',refreshVersion:0,onRestored:vi.fn()};
let removed=false;
beforeEach(()=>{
  removed=false;bridge.request.mockReset();props.onRestored.mockReset();
  bridge.request.mockImplementation(async(op:string)=>{
    if(op==='getTrash')return {notes:removed ? [] : [item],issues:[]};
    if(op==='getTrashedNote')return {trashKey:item.trashKey,deletedAt:item.deletedAt,note};
    if(op==='restoreNote'){removed=true;return {...note,title:'旧笔记 (2)'};}
    throw new Error(op);
  });
  vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('previews read-only content at its original attachment path and restores using the reviewed hash',async()=>{
  const user=userEvent.setup();render(<TrashPage {...props}/>);
  await user.click(await screen.findByRole('button',{name:'查看已删除笔记：旧笔记'}));
  const dialog=await screen.findByRole('dialog',{name:'旧笔记'});
  expect((await within(dialog).findByText(note.body)).getAttribute('data-path')).toBe(note.relativePath);
  expect(within(dialog).queryByRole('textbox')).toBeNull();
  await user.click(within(dialog).getByRole('button',{name:'恢复笔记'}));
  await screen.findByText('已恢复「旧笔记 (2)」');
  expect(bridge.request).toHaveBeenCalledWith('restoreNote',{trashKey:item.trashKey,baseHash:'fresh',vaultId:'vault',vaultBinding:'binding'});
  expect(props.onRestored).toHaveBeenCalledOnce();
  await screen.findByText('回收站是空的');
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('retains entries after failure and retries with the listed hash',async()=>{
  const implementation=bridge.request.getMockImplementation()!;let fail=true;
  bridge.request.mockImplementation((op,params)=>op==='restoreNote' && fail ? Promise.reject(new Error('磁盘只读')) : implementation(op,params));
  const user=userEvent.setup();render(<TrashPage {...props}/>);
  await user.click(await screen.findByRole('button',{name:'恢复笔记：旧笔记'}));
  await screen.findByText('磁盘只读');expect(screen.getByText('正文预览')).toBeTruthy();expect(props.onRestored).not.toHaveBeenCalled();
  fail=false;await user.click(screen.getByRole('button',{name:'恢复笔记：旧笔记'}));
  await waitFor(()=>expect(props.onRestored).toHaveBeenCalledOnce());
  expect(bridge.request).toHaveBeenCalledWith('restoreNote',{trashKey:item.trashKey,baseHash:'listed',vaultId:'vault',vaultBinding:'binding'});
});
it('disables repeated restore requests while pending',async()=>{
  let resolve!:(value:Note)=>void;const implementation=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='restoreNote' ? new Promise<Note>(done=>{resolve=done;}) : implementation(op,params));
  const user=userEvent.setup();render(<TrashPage {...props}/>);const button=await screen.findByRole('button',{name:'恢复笔记：旧笔记'});
  await user.dblClick(button);expect(bridge.request.mock.calls.filter(([op])=>op==='restoreNote')).toHaveLength(1);expect(button.hasAttribute('disabled')).toBe(true);
  resolve(note);await waitFor(()=>expect(props.onRestored).toHaveBeenCalledOnce());
});

it('requires explicit confirmation and cancel leaves the archive untouched',async()=>{
  const user=userEvent.setup();render(<TrashPage {...props} canPermanentlyDelete/>);
  await user.click(await screen.findByRole('button',{name:'永久删除笔记：旧笔记'}));
  const dialog=await screen.findByRole('dialog',{name:'永久删除「旧笔记」？'});
  expect(within(dialog).getByText(/此操作无法撤销/)).toBeTruthy();
  await waitFor(()=>expect(document.activeElement).toBe(within(dialog).getByRole('button',{name:'取消'})));
  expect(bridge.request.mock.calls.some(([op])=>op==='permanentlyDeleteNote')).toBe(false);
  expect(bridge.request.mock.calls.some(([op])=>op==='getTrashedNote')).toBe(false);
  await user.click(within(dialog).getByRole('button',{name:'取消'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
  expect(screen.getByText('正文预览')).toBeTruthy();expect(bridge.request.mock.calls.some(([op])=>op==='permanentlyDeleteNote')).toBe(false);
});
it('keeps the confirmation and record on deletion failure, then removes them after confirmed retry',async()=>{
  const implementation=bridge.request.getMockImplementation()!;let fail=true;
  bridge.request.mockImplementation((op,params)=>{
    if(op==='permanentlyDeleteNote'){if(fail)return Promise.reject(new Error('记录已变化'));removed=true;return Promise.resolve({deleted:true});}
    return implementation(op,params);
  });
  const user=userEvent.setup();render(<TrashPage {...props} canPermanentlyDelete/>);
  await user.click(await screen.findByRole('button',{name:'永久删除笔记：旧笔记'}));
  await user.click(screen.getByRole('button',{name:'确认永久删除'}));
  await screen.findByRole('alert');expect(screen.getByRole('dialog')).toBeTruthy();expect(props.onRestored).not.toHaveBeenCalled();
  fail=false;await user.click(screen.getByRole('button',{name:'确认永久删除'}));
  await screen.findByText('已永久删除「旧笔记」');await screen.findByText('回收站是空的');
  expect(screen.queryByRole('dialog')).toBeNull();expect(props.onRestored).not.toHaveBeenCalled();
  expect(bridge.request).toHaveBeenCalledWith('permanentlyDeleteNote',{trashKey:item.trashKey,baseHash:'listed',vaultId:'vault',vaultBinding:'binding'});
});
it('prevents duplicate permanent deletion and cancellation while pending',async()=>{
  let resolve!:(value:{deleted:boolean})=>void;const implementation=bridge.request.getMockImplementation()!;
  bridge.request.mockImplementation((op,params)=>op==='permanentlyDeleteNote' ? new Promise(done=>{resolve=done;}) : implementation(op,params));
  const user=userEvent.setup();render(<TrashPage {...props} canPermanentlyDelete/>);
  await user.click(await screen.findByRole('button',{name:'永久删除笔记：旧笔记'}));
  await user.dblClick(screen.getByRole('button',{name:'确认永久删除'}));
  expect(bridge.request.mock.calls.filter(([op])=>op==='permanentlyDeleteNote')).toHaveLength(1);expect(screen.getByRole('button',{name:'取消'}).hasAttribute('disabled')).toBe(true);
  await user.keyboard('{Escape}');expect(screen.getByRole('dialog')).toBeTruthy();
  removed=true;resolve({deleted:true});await screen.findByText('回收站是空的');
});
it('hides permanent deletion for services without the capability',async()=>{
  render(<TrashPage {...props}/>);await screen.findByText('正文预览');expect(screen.queryByRole('button',{name:/永久删除笔记/})).toBeNull();
});


it('opens an archive with Enter and Space, returns focus to the row, and keeps restore independent',async()=>{
  const user=userEvent.setup();render(<TrashPage {...props}/>);
  const row=await screen.findByRole('button',{name:'查看已删除笔记：旧笔记'});
  expect(screen.queryByRole('button',{name:'查看'})).toBeNull();
  for(const key of ['{Enter}',' ']) {
    row.focus();await user.keyboard(key);
    const dialog=await screen.findByRole('dialog',{name:'旧笔记'});
    await within(dialog).findByText(note.body);
    await user.keyboard('{Escape}');
    await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(()=>expect(document.activeElement).toBe(row));
  }
  const reads=bridge.request.mock.calls.filter(([op])=>op==='getTrashedNote').length;
  await user.click(screen.getByRole('button',{name:'恢复笔记：旧笔记'}));
  await screen.findByText('回收站是空的');
  expect(bridge.request.mock.calls.filter(([op])=>op==='getTrashedNote')).toHaveLength(reads);
});
