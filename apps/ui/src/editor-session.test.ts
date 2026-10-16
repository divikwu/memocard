import { afterEach, expect, it, vi } from 'vitest';
import { EditorSession } from './editor-session';
import type { Draft } from './bridge';
const initial: Draft = { id: 'a', body: '', tags: [], baseHash: null, relativePath: 'notes/a.md' };
const note = { id: 'a', contentHash: 'new-hash' };
afterEach(() => vi.useRealTimers());
it('keeps a quick-capture recovery reference when opening an isolated page draft',async()=>{
 const recoveredFrom={draftKey:'capture-draft',revision:'capture-revision'};
 const transport=vi.fn(async(op:string)=>op==='saveNote' ? {...note,body:'Continue writing'} : undefined);
 const session=new EditorSession({...initial,body:'Continue writing',recoveredFrom},transport as never,true,vi.fn(),vi.fn(),true);
 expect(transport).not.toHaveBeenCalled();
 await session.flush();
 expect(transport).toHaveBeenCalledWith('saveNote',expect.objectContaining({id:initial.id,recoveredFrom}));
 session.dispose();
});
it('forks native recovery per editor and retains the source identity through retries and property cleanup',async()=>{
 const recovered:Draft={...initial,body:'Recovered',baseHash:'hash',updatedAt:'2026-10-12T00:00:00Z',draftKey:'original-key',revision:'original-revision'};
 const transport=vi.fn(async(op:string)=>op==='saveNote' ? {id:'a',body:'Recovered',contentHash:'new'} : op==='updateNoteProperty' ? {id:'a',contentHash:'newer'} : undefined);
 const a=new EditorSession(recovered,transport as never,true,vi.fn(),vi.fn(),true);
 const b=new EditorSession(recovered,transport as never,true,vi.fn(),vi.fn(),true);
 expect(a.current.draftKey).not.toBe(b.current.draftKey);
 expect(a.current.draftKey).not.toBe(recovered.draftKey);
 await a.recover();
 expect(transport).toHaveBeenLastCalledWith('saveDraft',expect.objectContaining({draftKey:a.current.draftKey,recoveredFrom:{draftKey:'original-key',revision:recovered.revision}}));
 await a.changeProperty({name:'summary',type:'text',value:'Preserved'});
 expect(transport).toHaveBeenLastCalledWith('saveDraft',expect.objectContaining({body:'',pendingProperties:[],recoveredFrom:{draftKey:'original-key',revision:recovered.revision}}));
 const ownKey=a.current.draftKey;
 a.replace({...a.current,baseHash:'fresh'},true);
 expect(a.current.draftKey).toBe(ownKey);
 a.replace({...initial,id:'copy'},true);
 expect(a.current.draftKey).not.toBe(ownKey); expect(a.current.recoveredFrom).toBeUndefined();
 a.dispose();b.dispose();
});
it('retires a rejected lossy conversion without losing later input or replaying it',async()=>{
 let hash='original';
 const transport=vi.fn(async(op:string,params:Record<string,unknown>)=>{
  if(op==='updateNoteProperty') throw Object.assign(new Error('No source changed'),{code:'LOSSY_PROPERTY_CONVERSION'});
  if(op==='saveNote') return {id:'a',body:params.body,contentHash:hash+='-saved'};
 });
 const session=new EditorSession({...initial,body:'Original body',baseHash:hash},transport as never,true,vi.fn(),vi.fn());
 await expect(session.changeProperty({name:'summary',type:'date',definition:true})).rejects.toMatchObject({code:'LOSSY_PROPERTY_CONVERSION'});
 expect(session.current.pendingProperties).toEqual([]);
 session.update('Latest body');await session.flush();
 expect(session.current.body).toBe('Latest body');expect(session.dirty).toBe(false);
 expect(transport.mock.calls.filter(([op])=>op==='updateNoteProperty')).toHaveLength(1);
 expect(transport.mock.calls.filter(([op])=>op==='saveNote').at(-1)?.[1].body).toBe('Latest body');
 session.dispose();
});
it.each([false,true])('continues property edits after a rejected conversion without replaying it (queued=%s)',async queued=>{
 const transport=vi.fn(async(op:string,params:Record<string,unknown>)=>{
  if(op==='updateNoteProperty') {
   if(params.definition)throw Object.assign(new Error('No source changed'),{code:'LOSSY_PROPERTY_CONVERSION'});
   return {id:'a',contentHash:'property-saved'};
  }
 });
 const committed=vi.fn();
 const session=new EditorSession({...initial,body:'Original body',baseHash:'original'},transport as never,true,vi.fn(),committed);
 const rejected=expect(session.changeProperty({name:'summary',type:'date',definition:true})).rejects.toMatchObject({code:'LOSSY_PROPERTY_CONVERSION'});
 if(!queued)await rejected;
 const next=session.changeProperty({name:'stage',type:'select',value:'done'});
 await rejected;await next;
 expect(transport.mock.calls.filter(([op])=>op==='updateNoteProperty').map(([,params])=>[params.name,params.baseHash])).toEqual([['summary','original'],['stage','original']]);
 expect(session.current.body).toBe('Original body');expect(session.current.baseHash).toBe('property-saved');
 expect(session.current.pendingProperties).toEqual([]);expect(session.dirty).toBe(false);
 expect(session.state).toBe('saved');expect(session.error).toBeNull();expect(committed).toHaveBeenCalledTimes(1);
 expect(transport).toHaveBeenLastCalledWith('saveDraft',expect.objectContaining({body:'',pendingProperties:[],baseHash:null}));
 expect(transport.mock.calls.filter(([op])=>op==='saveNote')).toHaveLength(0);
 session.dispose();
});
it('keeps a failed recovery write blocking after retiring a rejected conversion',async()=>{
 let rejected=false;
 const draftError=Object.assign(new Error('Draft unavailable'),{code:'DRAFT_IO_ERROR'});
 const transport=vi.fn(async(op:string):Promise<unknown>=>{
  if(op==='updateNoteProperty'){rejected=true;throw Object.assign(new Error('No source changed'),{code:'LOSSY_PROPERTY_CONVERSION'});}
  if(op==='saveDraft'&&rejected)throw draftError;
  return undefined;
 });
 const session=new EditorSession({...initial,body:'Original body',baseHash:'original'},transport as never,true,vi.fn(),vi.fn());
 await expect(session.changeProperty({name:'summary',type:'date',definition:true})).rejects.toBe(draftError);
 await expect(session.changeProperty({name:'stage',type:'select',value:'done'})).rejects.toBe(draftError);
 expect(session.state).toBe('error');expect(session.current.baseHash).toBe('original');
 expect(session.current.pendingProperties).toEqual([{name:'stage',type:'select',value:'done'}]);
 expect(transport.mock.calls.filter(([op])=>op==='updateNoteProperty')).toHaveLength(1);
 transport.mockImplementation(async op=>op==='updateNoteProperty'?{id:'a',contentHash:'saved'}:undefined);
 await session.flush();expect(session.state).toBe('saved');expect(session.dirty).toBe(false);
 session.dispose();
});
it('keeps an unscoped legacy recovery reference while writing an isolated fork',async()=>{
 const transport=vi.fn(async()=>undefined);
 const session=new EditorSession({...initial,body:'Old recovery',updatedAt:'2026-10-12T00:00:00Z',revision:'old-version',unscoped:true,recoveryScope:'a'.repeat(64)},transport as never,true,vi.fn(),vi.fn(),true);
 await session.recover();
 expect(transport).toHaveBeenLastCalledWith('saveDraft',expect.objectContaining({recoveredFrom:{draftKey:initial.id,revision:'old-version',unscoped:true,scope:'a'.repeat(64)}}));
 session.dispose();
});
function setup(draft = initial) {
  const transport = vi.fn(async (op: string) => op === 'saveNote' ? note : undefined);
  const committed = vi.fn();
  const session = new EditorSession(draft, transport as never, true, vi.fn(), committed);
  return { session, transport, committed };
}
it.each([false, true])('retires a moved-section recovery after undo returns to the saved note (pending=%s)', async pending => {
  vi.useFakeTimers();
  const original = '## Alpha\n\nFirst\n\n## Beta\n\nSecond';
  const moved = '## Beta\n\nSecond\n\n## Alpha\n\nFirst';
  const drafts = new Map<string, Record<string, unknown>>();
  drafts.set('another-session', { body: 'Unrelated recovery' });
  let release!: () => void;
  let started!: () => void;
  const writing = new Promise<void>(resolve => { started = resolve; });
  const gate = pending ? new Promise<void>(resolve => { release = resolve; }) : Promise.resolve();
  const transport = vi.fn(async (op: string, params: Record<string, unknown>) => {
    if (op === 'saveDraft') {
      if (params.body === moved) started();
      await gate;
      if (params.baseHash === null && params.body === '' && params.title === '') drafts.delete(String(params.draftKey));
      else drafts.set(String(params.draftKey), params);
    }
  });
  const session = new EditorSession({ ...initial, title: 'Sections', body: original, baseHash: 'original' }, transport as never, true, vi.fn(), vi.fn(), true);
  session.update(moved);
  if (pending) await writing; else await session.recover();
  session.update(original);
  const flushed = session.flush();
  if (pending) release();
  await flushed;
  expect(session.current.body).toBe(original);expect(session.dirty).toBe(false);
  expect([...drafts.keys()]).toEqual(['another-session']);
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(0);
  session.dispose();
});
it('blocks leaving when retiring an undone recovery fails and retries the cleanup', async () => {
  const failure = new Error('Recovery unavailable');
  let failCleanup = true;
  const transport = vi.fn(async (op: string, params: Record<string, unknown>) => {
    if (op === 'saveDraft' && params.baseHash === null && failCleanup) throw failure;
  });
  const session = new EditorSession({ ...initial, body: 'Original', baseHash: 'original' }, transport as never, true, vi.fn(), vi.fn(), true);
  session.update('Moved'); await session.recover();
  session.update('Original'); await session.recover().catch(() => undefined);
  await expect(session.flush()).rejects.toBe(failure);
  expect(session.state).toBe('error');expect(session.current.body).toBe('Original');
  failCleanup = false;
  await session.flush();
  expect(session.state).toBe('saved');expect(session.dirty).toBe(false);
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ draftKey: session.current.draftKey, title: '', body: '', baseHash: null }));
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(0);
  session.dispose();
});
it('does not rewrite an untouched existing note, but saves an explicitly cleared body', async () => {
  const { session, transport } = setup({ ...initial, body: 'old', baseHash: 'original' });
  await session.flush(); expect(transport).not.toHaveBeenCalled();
  session.update(''); await session.flush();
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '', baseHash: 'original' }));
  session.dispose();
});
it('does not create a tag-only new note', async () => {
  const { session, transport } = setup({ ...initial, tags: ['标签'] }); session.update(''); await session.flush(); expect(transport).not.toHaveBeenCalled(); session.dispose();
});
it('retains inherited tags without saving an untouched new page', async () => {
  const { session, transport } = setup({ ...initial, title: '', tags: ['生活'] });
  expect(session.current.body).toBe(''); expect(session.current.inheritedTags).toEqual(['生活']);
  await session.flush(); await session.recover();
  expect(session.dirty).toBe(false); expect(transport).not.toHaveBeenCalled(); session.dispose();
});
it.each([{ title: '', body: '实际内容' }, { title: '只有标题', body: '' }])('autosaves actual input with inherited tag properties without changing the body (%j)', async content => {
  vi.useFakeTimers();
  const { session, transport } = setup({ ...initial, title: '', tags: ['生活'] });
  session.update(content.body, undefined, content.title); await vi.advanceTimersByTimeAsync(650);
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ title: content.title, body: content.body, tags: [], inheritedTags: ['生活'] }));
  expect(session.dirty).toBe(false); session.dispose();
});
it('does not duplicate inherited tags that the user typed explicitly', async () => {
  const { session, transport } = setup({ ...initial, title: '', tags: ['生活'] });
  session.update('#生活'); await session.flush();
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '#生活', tags: ['生活'], inheritedTags: ['生活'] })); session.dispose();
});
it('recovers pending inherited tag properties and stops resending them after the first commit', async () => {
  const { session, transport } = setup({ ...initial, title: '', body: '恢复的正文', tags: [], inheritedTags: ['生活'], updatedAt: '2026-10-12T00:00:00Z' });
  await session.flush();
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '恢复的正文', inheritedTags: ['生活'] }));
  expect(session.current.inheritedTags).toBeUndefined();
  session.update('继续写'); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.not.objectContaining({ inheritedTags: expect.anything() }));
  expect(session.current.body).toBe('继续写'); session.dispose();
});
it('saves an explicitly typed tag after the user clears earlier content', async () => {
  const { session, transport } = setup({ ...initial, title: '', tags: ['生活'] });
  session.update('临时内容'); session.update(''); session.update('#生活'); await session.flush();
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '#生活', tags: ['生活'] })); session.dispose();
});
it.each(['', ' \t\n'])('retires recovery if actual input is cleared before the first save (%j)', async body => {
  const { session, transport } = setup({ ...initial, title: '', tags: ['生活'] });
  session.update('临时内容'); await session.recover();
  session.update(body); await session.recover(); await session.flush();
  expect(session.dirty).toBe(false);
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: '', tags: [], baseHash: null }));
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(0); session.dispose();
});
it.each(['', ' \t\n'])('does not save a new page with only blank title and body (%j)', async blank => {
  vi.useFakeTimers();
  const { session, transport } = setup({ ...initial, title: blank, body: blank });
  await session.save(); session.update(blank, undefined, blank);
  await vi.advanceTimersByTimeAsync(1000); await session.flush();
  expect(session.dirty).toBe(false); expect(transport).not.toHaveBeenCalled(); session.dispose();
});
it.each([{ title: '只有标题', body: '' }, { title: '', body: '只有正文' }, { title: '', body: '![图片](assets/a.png)' }])('autosaves non-empty new pages (%j)', async content => {
  vi.useFakeTimers();
  const { session, transport } = setup({ ...initial, title: '' });
  session.update(content.body, undefined, content.title); await vi.advanceTimersByTimeAsync(650);
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ ...content, baseHash: null }));
  expect(session.dirty).toBe(false); session.dispose();
});
it('preserves newer recovery during an older commit and flushes with the returned hash', async () => {
  vi.useFakeTimers();
  const { session, transport, committed } = setup();
  let resolve!: (value: typeof note) => void;
  transport.mockImplementation(async op => op === 'saveNote' ? new Promise(r => { resolve = r; }) : undefined);
  session.update('first');
  const saving = session.save(); await vi.advanceTimersByTimeAsync(0);
  session.update('newer #tag');
  resolve(note); await saving;
  expect(session.dirty).toBe(true); expect(session.state).toBe('idle');
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: 'newer #tag', baseHash: 'new-hash' }));
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: 'newer #tag', baseHash: 'new-hash' }));
  expect(session.dirty).toBe(false); expect(committed).toHaveBeenCalledTimes(2); session.dispose();
});
it('stops automatic conflict retries but continues to preserve edits', async () => {
  vi.useFakeTimers(); const { session, transport } = setup({ ...initial, baseHash: 'original' });
  transport.mockImplementation(async op => { if (op === 'saveNote') throw { code: 'REVISION_CONFLICT' }; });
  session.update('first'); await vi.advanceTimersByTimeAsync(650);
  expect(session.state).toBe('conflict'); session.update('second'); await vi.advanceTimersByTimeAsync(1000);
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(1);
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: 'second', baseHash: 'original' })); session.dispose();
});
it('retries the newest content after an in-flight save fails without advancing its hash', async () => {
  vi.useFakeTimers();
  const { session, transport } = setup({ ...initial, body: 'original', baseHash: 'original-hash' });
  let fail!: (reason: Error) => void;
  transport.mockImplementation(async op => op === 'saveNote' ? new Promise((_resolve, reject) => { fail = reject; }) : undefined);
  session.update('first');
  const saving = session.save();
  const result = expect(saving).rejects.toThrow('暂时不可写');
  await vi.advanceTimersByTimeAsync(0);
  session.update('newest #tag');
  fail(new Error('暂时不可写')); await result; await session.recover();
  expect(session.current.baseHash).toBe('original-hash');expect(session.state).toBe('error');
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: 'newest #tag', baseHash: 'original-hash' }));
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: 'newest #tag', tags: ['tag'], baseHash: 'original-hash' }));
  expect(session.dirty).toBe(false);expect(session.state).toBe('saved');session.dispose();
});
it('automatically persists an undo back to the old baseline while a newer write is in flight', async () => {
  vi.useFakeTimers();
  const { session, transport } = setup({ ...initial, body: 'original order', baseHash: 'original' });
  let finish!: (value: typeof note) => void;
  transport.mockImplementation(async op => op === 'saveNote' ? new Promise(resolve => { finish = resolve; }) : undefined);
  session.update('moved order');
  await vi.advanceTimersByTimeAsync(650);
  session.update('original order');
  expect(session.state).toBe('saving');
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  finish(note);
  await vi.advanceTimersByTimeAsync(1000);
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(2);
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: 'moved order', baseHash: 'original' }));
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: 'original order', baseHash: 'new-hash' }));
  expect(session.dirty).toBe(false);
  expect(session.state).toBe('saved');
  session.dispose();
});
it('keeps unknown source intact and derives tags only from edited body text', async () => {
  const { session, transport } = setup({ ...initial, body: '<!-- x -->\r\n\n[^a]: footnote\n', tags: ['C#,F#', ' two words '], baseHash: 'original' });
  session.update(session.current.body + '\n#工作'); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: '<!-- x -->\r\n\n[^a]: footnote\n\n#工作', tags: ['工作'] })); session.dispose();
});
it('does not notify a replaced UI session after a late commit', async () => {
  const { session, committed } = setup(); session.update('pending'); session.dispose(); await session.flush(); expect(committed).not.toHaveBeenCalled();
});
it.each([undefined, ''])('retires new-note recovery when the user clears the content before creating a file (title=%j)', async title => {
  const { session, transport } = setup({ ...initial, title }); session.update('temporary'); await session.recover();
  session.update(''); await session.recover(); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: '', baseHash: null }));
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(0); session.dispose();
});
it.each(['HASH_CONFLICT', 'SOURCE_CONFLICT', 'NOTE_DELETED', 'NOTE_NOT_FOUND'])('recognizes the actual bridge conflict %s', async code => {
  const { session, transport } = setup({ ...initial, baseHash: 'old' });
  transport.mockImplementation(async op => { if (op === 'saveNote') throw { code }; });
  session.update('new'); await expect(session.flush()).rejects.toEqual({ code }); expect(session.state).toBe('conflict'); session.dispose();
});
it('does not restore obsolete property tags returned by an older file layer', async () => {
  const transport = vi.fn(async (op: string) => op === 'saveNote' ? { ...note, tags: ['工作'] } : undefined);
  const session = new EditorSession({ ...initial, body: '#工作', tags: ['工作'], baseHash: 'old' }, transport as never, false, vi.fn(), vi.fn());
  session.update('删除正文标签'); await session.flush();
  expect(session.current.tags).toEqual([]); expect(session.dirty).toBe(false);
  session.update('继续输入'); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ tags: [] }));
  session.dispose();
});
it('keeps title edits made during the first save and saves clearing both fields', async () => {
  let complete!: (value: unknown) => void;
  const transport = vi.fn(async (op: string) => op === 'saveNote' ? new Promise(resolve => { complete = resolve; }) : undefined);
  const session = new EditorSession({ ...initial, title: '初始标题' }, transport as never, true, vi.fn(), vi.fn());
  const saving = session.save();
  await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
  session.update('正文', undefined, '标题'); complete(note); await saving;
  expect(session.current.title).toBe('标题'); expect(session.current.body).toBe('正文'); expect(session.dirty).toBe(true);
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  await session.flush(); session.update('', undefined, ''); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ title: '', body: '', baseHash: 'new-hash' }));
  session.dispose();
});

it('adopts committed filename normalization and self-link edits without a dirty save loop', async () => {
  const transport = vi.fn(async (op: string) => op === 'saveNote' ? { ...note, title: 'Name (2)', body: '[[Name (2)]]', relativePath: 'notes/Name (2).md' } : undefined);
  const session = new EditorSession({ ...initial, title: 'Name', body: '[[Old]]' }, transport as never, true, vi.fn(), vi.fn());
  await session.save();
  expect(session.current).toMatchObject({ title: 'Name (2)', body: '[[Name (2)]]', relativePath: 'notes/Name (2).md' });
  expect(session.dirty).toBe(false); await session.flush();
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(1); session.dispose();
});

it('serializes rapid properties with body and title input using each committed revision', async () => {
  let release!: () => void;
  let revision = 0, active = 0, maxActive = 0;
  let stored = { body: 'before', title: 'before', contentHash: 'h0', checked: false, summary: '' };
  const transport = vi.fn(async (operation: string, params?: Record<string, unknown>) => {
    if (operation === 'saveDraft') return;
    active++; maxActive = Math.max(maxActive, active);
    expect(params?.baseHash).toBe(stored.contentHash);
    if (operation === 'updateNoteProperty' && revision === 0) await new Promise<void>(resolve => { release = resolve; });
    revision++;
    if (operation === 'saveNote') stored = {...stored, body: params!.body as string, title: params!.title as string};
    else if (params?.name === 'checked') stored.checked = params.value as boolean;
    else stored.summary = params?.value as string;
    stored.contentHash = `h${revision}`;
    active--;
    return {id:'a',...stored,propertyData:{definitionHash:`d${revision}`}};
  });
  const session = new EditorSession({...initial,body:'before',title:'before',baseHash:'h0'}, transport as never, true, vi.fn(), vi.fn());
  const first = session.changeProperty({name:'checked',type:'checkbox',value:true,definitionHash:'d0'});
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  session.update('typed while saving', undefined, 'new title');
  const second = session.changeProperty({name:'summary',type:'text',value:'one',definitionHash:'d0'});
  const third = session.changeProperty({name:'checked',type:'checkbox',value:false,definitionHash:'d0'});
  const fourth = session.changeProperty({name:'summary',type:'text',value:'latest',definitionHash:'d0'});
  expect(session.current.pendingProperties).toHaveLength(4);
  release(); await Promise.all([first,second,third,fourth]); await session.flush();
  expect(maxActive).toBe(1);
  expect(stored).toMatchObject({body:'typed while saving',title:'new title',checked:false,summary:'latest'});
  expect(session.current.body).toBe(stored.body); expect(session.dirty).toBe(false);
  expect(transport.mock.calls.filter(([operation]) => operation === 'updateNoteProperty').map(([,params]) => params?.value)).toEqual([true,'one',false,'latest']);
  expect(transport.mock.calls.filter(([operation]) => operation === 'updateNoteProperty').map(([,params]) => params?.definitionHash)).toEqual(['d0','d1','d3','d4']);
  session.dispose();
});
it('recovers failed property intents across a new session and resumes in order', async () => {
  let recovery: Draft | undefined, hash = 'h0';
  const values: unknown[] = [];
  let fail = true;
  const transport = vi.fn(async (operation: string, params?: Record<string, unknown>) => {
    if (operation === 'saveDraft') { recovery = structuredClone(params) as Draft; return; }
    expect(params?.baseHash).toBe(hash);
    if (operation === 'updateNoteProperty') {
      if (fail) throw new Error('暂时不可写');
      values.push(params?.value);
    }
    hash += 'x'; return {id:'a',body:params?.body ?? 'body',contentHash:hash};
  });
  const session = new EditorSession({...initial,body:'body',baseHash:hash},transport as never,true,vi.fn(),vi.fn());
  await expect(session.changeProperty({name:'summary',type:'text',value:'retained'})).rejects.toThrow('暂时不可写');
  await expect(session.changeProperty({name:'checked',type:'checkbox',value:true})).rejects.toThrow('暂时不可写');
  await session.recover();
  expect(recovery?.pendingProperties?.map(change=>change.value)).toEqual(['retained',true]);
  expect(session.state).toBe('error'); session.dispose();
  fail = false;
  const reopened = new EditorSession({...recovery!,updatedAt:'recovered'},transport as never,true,vi.fn(),vi.fn());
  await reopened.flush();
  expect(values).toEqual(['retained',true]); expect(reopened.dirty).toBe(false);
  expect(recovery).toMatchObject({body:'',baseHash:null,pendingProperties:[]}); reopened.dispose();
});
it('does not attempt property writes when recovery fails and retains input after conflicts', async () => {
  const transport = vi.fn(async (operation:string) => { if (operation === 'saveDraft') throw new Error('草稿不可写'); });
  const session = new EditorSession({...initial,body:'body',baseHash:'h0'},transport as never,true,vi.fn(),vi.fn());
  await expect(session.changeProperty({name:'checked',type:'checkbox',value:true})).rejects.toThrow('草稿不可写');
  expect(transport.mock.calls.every(([operation]) => operation === 'saveDraft')).toBe(true);
  transport.mockImplementation(async operation => { if (operation === 'updateNoteProperty') throw Object.assign(new Error('外部冲突'),{code:'HASH_CONFLICT'}); });
  await expect(session.flush()).rejects.toThrow('外部冲突');
  session.update('new input'); await session.recover();
  expect(session.current.pendingProperties?.[0].value).toBe(true); expect(session.current.body).toBe('new input');
  expect(session.state).toBe('conflict');
  await expect(session.flush()).rejects.toThrow('外部冲突'); session.dispose();
});

it('persists advanced definition versions for the remaining queue before recovery', async () => {
 let recovery: Draft | undefined, revision = 0;
 let fail = true;
 const transport = vi.fn(async (operation:string,params?:Record<string,unknown>) => {
   if (operation === 'saveDraft') { recovery = structuredClone(params) as Draft; return; }
   if (operation === 'saveNote') return {id:'a',contentHash:'h1'};
   if (revision && fail) throw new Error('第二项失败');
   expect(params?.definitionHash).toBe(revision ? 'd1' : 'd0');
   revision++;
   return {id:'a',contentHash:`h${revision}`,propertyData:{definitionHash:`d${revision}`}};
 });
 const session = new EditorSession({...initial,body:'body',baseHash:'h0'},transport as never,true,vi.fn(),vi.fn());
 const first = session.changeProperty({name:'status',type:'select',value:'A',definition:true,definitionHash:'d0'});
 const second = session.changeProperty({name:'summary',type:'text',value:'next',definitionHash:'d0'});
 await first; await expect(second).rejects.toThrow('第二项失败');
 expect(recovery?.pendingProperties?.[0]).toMatchObject({name:'summary',definitionHash:'d1'});
 session.dispose(); fail = false;
 const reopened = new EditorSession({...recovery!,updatedAt:'recovered'},transport as never,true,vi.fn(),vi.fn());
 await reopened.flush(); expect(reopened.dirty).toBe(false); reopened.dispose();
});

it('keeps latest drafts durable and retries source automatically while initial validation is pending', async () => {
  vi.useFakeTimers();
  let indexing = true;
  const drafts:Record<string,unknown>[] = [];
  const transport = vi.fn(async (op:string, params:Record<string,unknown>) => {
    if (op === 'saveDraft') { drafts.push(structuredClone(params)); return; }
    if (op === 'saveNote') {
      if (indexing) throw Object.assign(new Error('Initial validation pending'), {code:'INDEXING'});
      return {id:'a',body:params.body,contentHash:'indexed-hash'};
    }
  });
  const session = new EditorSession({...initial,body:'Before',baseHash:'old'},transport as never,true,vi.fn(),vi.fn());
  session.update('First during validation');
  await vi.advanceTimersByTimeAsync(700);
  expect(session.state).toBe('indexing');
  expect(session.error).toBeNull();
  session.update('Latest during validation');
  await vi.advanceTimersByTimeAsync(0);
  expect(drafts.at(-1)?.body).toBe('Latest during validation');
  await vi.advanceTimersByTimeAsync(700);
  expect(session.dirty).toBe(true);
  indexing = false;
  await vi.advanceTimersByTimeAsync(1100);
  expect(session.current.body).toBe('Latest during validation');
  expect(session.current.baseHash).toBe('indexed-hash');
  expect(session.dirty).toBe(false);
  expect(session.state).toBe('saved');
  session.dispose();
});
