import { describe,it,expect,vi } from 'vitest';
import { createPreviewMock } from './mock';
import { scenarios,noteId } from './catalog';
import type { DraftList } from '../src/bridge';
import type { Note, VaultStatus } from '@memocard/contracts';

describe('isolated state preview',()=>{
  it('never delegates mocked operations to a real transport',async()=>{
    const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('real network forbidden'));
    try{
      for(const scenario of scenarios){
        const mock=createPreviewMock(scenario.id);
        for(const operation of ['getStatus','getEnvironment','getDrafts','listTags','listFolders','saveDraft','saveNote','getNoteProperties','updateNoteProperty','selectVault','pickImage','resolveLink','openExternal','openWeb','setMCPEnabled']){
          if(scenario.id === 'property-loading' && operation === 'getNoteProperties')continue;
          await mock.request(operation,{id:noteId,body:'仅模拟',tags:[],name:'摘要',value:'仅模拟'}).catch(()=>undefined);
        }
      }
      expect(fetch).not.toHaveBeenCalled();
    }finally{fetch.mockRestore();}
  });
  it('keeps edits, new copies and reminder changes in their own instance',async()=>{
    const first=createPreviewMock('draft-single'),second=createPreviewMock('draft-single');
    const before=second.snapshot();
    const list=await first.request<DraftList>('getDrafts');
    await first.request('dismissDraftReminder',{draftKey:list.unscopedDrafts![0].draftKey});
    await first.request('saveDraft',{id:noteId,body:'仅内存',tags:[],baseHash:null});
    await first.request('saveNote',{id:'preview-copy',body:'仅副本'});
    expect(first.snapshot().drafts[0].reminderDismissed).toBe(true);
    expect(first.snapshot().notes[0].body).toBe('仅副本');
    expect(second.snapshot()).toEqual(before);
    expect(createPreviewMock('draft-single').snapshot()).toEqual(before);
  });
  it('preserves failed edits and lets retry succeed',async()=>{
    const mock=createPreviewMock('save-error');
    const pending={id:noteId,body:'未保存修改',tags:[],baseHash:'preview-hash'};
    await mock.request('saveDraft',pending);
    await expect(mock.request('saveNote',pending)).rejects.toMatchObject({code:'IO_ERROR'});
    expect(mock.snapshot().drafts.some(draft=>draft.body === pending.body)).toBe(true);
    mock.retry();
    expect((await mock.request<Note>('saveNote',pending)).body).toBe(pending.body);
  });
  it('blocks lossy conversion without changing properties',async()=>{
    const mock=createPreviewMock('lossy-conversion'),before=mock.snapshot();
    await expect(mock.request('updateNoteProperty',{id:noteId,name:'摘要',type:'checkbox',definition:true})).rejects.toMatchObject({code:'LOSSY_PROPERTY_CONVERSION'});
    expect(mock.snapshot()).toEqual(before);
  });
  it('models multiple versions, unreadable drafts and permissions separately',async()=>{
    const versions=await createPreviewMock('draft-versions').request<DraftList>('getDrafts');
    expect(versions.drafts).toHaveLength(2);
    expect(versions.drafts[0].id).toBe(versions.drafts[1].id);
    expect(versions.drafts[0].pendingProperties).not.toEqual(versions.drafts[1].pendingProperties);
    const corrupt=await createPreviewMock('draft-corrupt').request<DraftList>('getDrafts');
    expect(corrupt.issues).toHaveLength(1);expect(corrupt.unscopedDrafts).toHaveLength(1);
    const mock=createPreviewMock('permission');
    expect((await mock.request<VaultStatus>('getStatus')).connected).toBe(false);
    await mock.request('reauthorizeVault');
    expect((await mock.request<VaultStatus>('getStatus')).connected).toBe(true);
  });
  it('denies unknown operations instead of falling back to native APIs',async()=>{
    const mock=createPreviewMock('empty');
    for(const operation of ['openExternal','openWeb','deleteNote','importAttachment'])await expect(mock.request(operation)).rejects.toMatchObject({code:'PREVIEW_ONLY'});
  });
});
