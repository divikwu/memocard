// @vitest-environment node
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { BridgeRequest, Note, NotePage, NotePins, TagPreferenceState, VaultStatus, PropertyLabels, PropertyLayout } from "@memocard/contracts";
import { BrowserVault } from "./browser-vault";
import { parseBrowserNote } from "./browser-files";
import type { BrowserDirectoryHandle, BrowserFileHandle, BrowserWritable } from "./browser-files";
import type { BrowserDraft, BrowserVaultStorage, StoredSelection } from "./browser-storage";
import { createId } from "./uuid";

const vaultId = "22222222-2222-4222-8222-222222222222";
const noteId = "11111111-1111-4111-8111-111111111111";
const secondId = "11111111-1111-4111-8111-111111111112";
const source = (id = noteId, body = "中文 test\n", extra = "") => `---\nid: "${id}"\ncreatedAt: "2026-09-28T04:00:00Z"\nupdatedAt: "2026-09-28T04:00:00Z"\ntags: ["日常", "machine learning", "C#,F#", "#literal"]\n${extra}---\n${body}`;
const bytes = (text: string) => new TextEncoder().encode(text);
const error = (name: string) => new DOMException(name, name);

it('rejects capture operations from a different vault before reading or writing files', async () => {
  const h=harness(await fixture());await call(h.core,'selectVault');
  for(const operation of ['getNote','saveNote','saveDraft','getTrash','getTrashedNote','restoreNote','permanentlyDeleteNote','importAttachment']) await expect(call(h.core,operation,{vaultId:'other-vault'})).rejects.toMatchObject({code:'VAULT_CHANGED'});
  expect((await call<NotePage>(h.core,'queryNotes')).notes).toHaveLength(1);
  expect((await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts).toHaveLength(0);
});

it('shares tag pins and emoji across independent clients, guards conflicts and preserves corrupt metadata', async () => {
  const root = await fixture(), h = harness(root); await call(h.core,'selectVault');
  const initial = await call<TagPreferenceState>(h.core,'getTagPreferences');
  expect(initial.initialized).toBe(false);
  const value = {pinned:['area/coffee'],icons:{'area/coffee':'☕','area/ai':'🧑🏽‍💻'}};
  const saved = await call<TagPreferenceState>(h.core,'setTagPreferences',{...value,baseHash:initial.contentHash});
  const other = harness(root); await call(other.core,'selectVault');
  expect(await call(other.core,'getTagPreferences')).toEqual(saved);
  await expect(call(other.core,'setTagPreferences',{pinned:[],icons:{},baseHash:initial.contentHash})).rejects.toMatchObject({code:'HASH_CONFLICT'});
  await expect(call(other.core,'getTagPreferences',{vaultId:'other'})).rejects.toMatchObject({code:'VAULT_CHANGED'});
  await expect(call(other.core,'setTagPreferences',{pinned:['bad\ntag'],icons:{},baseHash:saved.contentHash})).rejects.toMatchObject({code:'INVALID_TAG_PREFERENCES'});
  const empty = await call<TagPreferenceState>(other.core,'setTagPreferences',{pinned:[],icons:{},baseHash:saved.contentHash});
  expect(empty.initialized).toBe(true);
  expect((await call<TagPreferenceState>(h.core,'getTagPreferences')).pinned).toEqual([]);
  const file = await (await root.getDirectoryHandle('.memocard')).getFileHandle('tag-preferences.json');
  file.bytes = bytes('{broken');
  await expect(call(h.core,'setTagPreferences',{...value,baseHash:empty.contentHash})).rejects.toMatchObject({code:'INVALID_TAG_PREFERENCES'});
  expect(file.text).toBe('{broken');
});

it('can retry a tag preference write after the first file creation is interrupted', async () => {
  const root=await fixture(),h=harness(root);await call(h.core,'selectVault');
  const initial=await call<TagPreferenceState>(h.core,'getTagPreferences');
  const directory=await root.getDirectoryHandle('.memocard');
  directory.createdFile=file=>{if(file.name==='tag-preferences.json')file.closeError=true;};
  const input={pinned:['work'],icons:{work:'☕'},baseHash:initial.contentHash};
  await expect(call(h.core,'setTagPreferences',input)).rejects.toThrow();
  const file=await directory.getFileHandle('tag-preferences.json');file.closeError=false;
  expect((await call<TagPreferenceState>(h.core,'getTagPreferences')).initialized).toBe(false);
  expect(await call(h.core,'setTagPreferences',input)).toMatchObject({pinned:['work'],initialized:true});
});

it.each([false, true])('persists pins independently of Markdown, edits and vault selection (shared=%s)', async shared => {
  const root = shared ? new TestDirectory('shared') : await fixture();
  const directory = shared ? root : await root.getDirectoryHandle('notes');
  const file = await directory.getFileHandle(shared ? 'Original.md' : `${noteId}.md`, { create: true });
  file.bytes = bytes(shared ? 'Body' : source());
  const h = harness(root); await call(h.core, 'selectVault');
  const note = (await call<NotePage>(h.core, 'queryNotes')).notes[0];
  const original = file.text;
  const initial = await call<NotePins>(h.core, 'getNotePins');
  const pinned = await call<NotePins>(h.core, 'setNotePinned', { id: note.id, pinned: true, baseHash: initial.contentHash });
  expect(file.text).toBe(original);
  expect(await call<NotePins>(h.core, 'setNotePinned', { id: note.id, pinned: true, baseHash: pinned.contentHash })).toEqual(pinned);
  await expect(call(h.core, 'setNotePinned', { id: note.id, pinned: false, baseHash: initial.contentHash })).rejects.toMatchObject({ code: 'HASH_CONFLICT' });
  await call(h.core, 'saveNote', { id: note.id, title: 'Renamed', body: 'Edited', tags: [], baseHash: note.contentHash });
  const reopened = harness(root, h.storage); await call(reopened.core, 'selectVault');
  const persisted = await call<NotePins>(reopened.core, 'getNotePins');
  expect(persisted.pins).toEqual(pinned.pins);
  if (shared) {
    const independent = harness(root); await call(independent.core, 'selectVault');
    const sameFile = (await call<NotePage>(independent.core, 'queryNotes')).notes[0];
    expect(sameFile.id).not.toBe(note.id);
    expect((await call<NotePins>(independent.core, 'getNotePins')).pins).toEqual({ [sameFile.id]: pinned.pins[note.id] });
  }
  expect((await call<NotePage>(reopened.core, 'queryNotes', { pinned: true, sort: 'pinnedAt' })).notes.map(note => note.id)).toEqual([note.id]);
  const other = await fixture('other', '33333333-3333-4333-8333-333333333333');
  h.choose(other); await call(h.core, 'selectVault');
  expect((await call<NotePins>(h.core, 'getNotePins')).pins).toEqual({});
  h.choose(root); await call(h.core, 'selectVault');
  expect(await call(h.core, 'getNotePins')).toEqual(persisted);
  await call(h.core, 'setNotePinned', { id: note.id, pinned: false, baseHash: persisted.contentHash });
  expect((await call<NotePage>(h.core, 'queryNotes', { pinned: true })).notes).toHaveLength(0);
});

it('sorts the whole browser vault by update time and invalidates pinned pagination on changes', async () => {
  const root = await fixture(), directory = await root.getDirectoryHandle('notes');
  (await directory.getFileHandle(`${noteId}.md`)).bytes = bytes(source().replace('updatedAt: "2026-09-28T04:00:00Z"', 'updatedAt: "2026-10-14T04:00:00Z"'));
  (await directory.getFileHandle(`${secondId}.md`, { create: true })).bytes = bytes(source(secondId).replaceAll('2026-09-28T04:00:00Z', '2026-10-13T04:00:00Z'));
  const h = harness(root); await call(h.core, 'selectVault');
  const page = await call<NotePage>(h.core, 'queryNotes', { sort: 'updatedAt', limit: 1 });
  expect(page.notes[0].id).toBe(noteId);
  expect((await call<NotePage>(h.core, 'queryNotes', { sort: 'updatedAt', limit: 1, cursor: page.nextCursor })).notes[0].id).toBe(secondId);
  await expect(call(h.core, 'queryNotes', { limit: 1, cursor: page.nextCursor })).rejects.toMatchObject({ code: 'CURSOR_QUERY_MISMATCH' });
  const meta = await root.getDirectoryHandle('.memocard'), file = await meta.getFileHandle('pins.json', { create: true });
  file.bytes = bytes(JSON.stringify({ [noteId]: '2026-10-14T10:00:00Z', [secondId]: '2026-10-14T10:00:00Z' }));
  const pinned = await call<NotePage>(h.core, 'queryNotes', { sort: 'pinnedAt', pinned: true, limit: 1 });
  expect(pinned.notes[0].id).toBe(noteId);
  expect((await call<NotePage>(h.core, 'queryNotes', { sort: 'pinnedAt', pinned: true, limit: 1, cursor: pinned.nextCursor })).notes[0].id).toBe(secondId);
  const state = await call<NotePins>(h.core, 'getNotePins');
  await call(h.core, 'setNotePinned', { id: noteId, pinned: false, baseHash: state.contentHash });
  await expect(call(h.core, 'queryNotes', { sort: 'pinnedAt', pinned: true, limit: 1, cursor: pinned.nextCursor })).rejects.toMatchObject({ code: 'STALE_CURSOR' });
  file.bytes = bytes('{broken');
  await expect(call(h.core, 'setNotePinned', { id: secondId, pinned: true, baseHash: state.contentHash })).rejects.toMatchObject({ code: 'INVALID_PINS' });
  expect(file.text).toBe('{broken');
});

it.each([false,true])('preserves numbers and complete date times through browser saves and reopen (shared=%s)',async shared => {
  const root = shared ? new TestDirectory('shared') : await fixture();
  const notes = shared ? root : await root.getDirectoryHandle('notes');
  const file = await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true});
  file.bytes = bytes(shared ? 'Body #keep' : source(noteId,'Body #keep'));
  const h = harness(root); await call(h.core,'selectVault');
  let note = (await call<NotePage>(h.core,'queryNotes')).notes.find(n=>n.body==='Body #keep')!;
  for (const [name,type,value] of [['weight','number','3.0000000000000001'],['due','date','2026-10-13T09:30:42.123+08:00']]) {
    note = await call<Note>(h.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,name,type,value,create:true});
  }
  note = await call<Note>(h.core,'saveNote',{id:note.id,baseHash:note.contentHash,body:'Edited #keep',tags:[]});
  const reopened = harness(root,h.storage); await call(reopened.core,'selectVault');
  const fields = await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:note.id});
  expect(fields.properties.find(p=>p.name==='weight')).toMatchObject({type:'number',value:'3.0000000000000001'});
  expect(fields.properties.find(p=>p.name==='due')).toMatchObject({type:'date',value:'2026-10-13T09:30:42.123+08:00'});
  expect(file.text).toContain('3.0000000000000001'); expect(file.text.endsWith('Edited #keep')).toBe(true);
  for (const name of ['weight','due']) {
    note = await call<Note>(reopened.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,name,type:name==='weight'?'number':'date',value:''});
  }
  expect((await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:note.id})).properties.filter(p=>['weight','due'].includes(p.name)).every(p=>p.value==='')).toBe(true);
});

it.each(['body','property','new'])('rolls back a browser source commit when identity persistence fails (%s)',async operation => {
  const root = new TestDirectory('shared');
  const file = await root.getFileHandle('A.md',{create:true});
  file.bytes = bytes('---\nsummary: before\n---\nOriginal');
  const h = harness(root); await call(h.core,'selectVault');
  const note = (await call<NotePage>(h.core,'queryNotes')).notes[0];
  const before = file.text;
  const input = {id:operation === 'new' ? secondId : note.id,body:'Pending newest',tags:[],baseHash:operation === 'new' ? null : note.contentHash};
  await call(h.core,'saveDraft',input);
  const change = {id:note.id,baseHash:note.contentHash,name:'summary',type:'text',value:'changed'};
  const commit = () => call<Note>(h.core,operation === 'property' ? 'updateNoteProperty' : 'saveNote',operation === 'property' ? change : input);
  const persist = h.storage.saveIdentities.bind(h.storage);
  const failure = vi.spyOn(h.storage,'saveIdentities').mockImplementation(async (scope,items) => {
    if (JSON.stringify(items) !== JSON.stringify(h.storage.identitiesByScope.get(scope))) throw error('QuotaExceededError');
    await persist(scope,items);
  });
  await expect(commit()).rejects.toBeDefined();
  expect(file.text).toBe(before);
  if (operation === 'new') expect([...root.children].filter(([name])=>name.endsWith('.md')).map(([name])=>name)).toEqual(['A.md']);
  expect((await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts.some(d=>d.body===input.body)).toBe(true);
  failure.mockRestore();
  const committed = await commit();
  const reopened = harness(root,h.storage); await call(reopened.core,'selectVault');
  const loaded = await call<Note>(reopened.core,'getNote',{id:committed.id});
  expect(loaded.contentHash).toBe(committed.contentHash);
  expect(loaded.body).toBe(operation === 'property' ? 'Original' : input.body);
});

it('defers a browser index refresh until an active source transaction finishes',async () => {
  const root = new TestDirectory('shared'), file = await root.getFileHandle('A.md',{create:true});
  file.bytes = bytes('Original');
  const h = harness(root); await call(h.core,'selectVault');
  const note = (await call<NotePage>(h.core,'queryNotes')).notes[0];
  let refresh!: Promise<NotePage>;
  file.writeHook = () => {file.writeHook=undefined; refresh=call<NotePage>(h.core,'queryNotes');};
  const committed = await call<Note>(h.core,'saveNote',{id:note.id,body:'Committed',tags:[],baseHash:note.contentHash});
  const refreshed = await refresh;
  expect(refreshed.notes[0]).toMatchObject({body:'Committed',contentHash:committed.contentHash});
  expect(file.text).toBe('Committed'); expect(h.storage.journals.size).toBe(0);
});

it.each([false,true])('returns the committed property snapshot for value and definition changes (shared=%s)',async shared => {
 const root = shared ? new TestDirectory('shared') : await fixture();
 const notes = shared ? root : await root.getDirectoryHandle('notes');
 const file = await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true});
 file.bytes = bytes(shared ? '---\naliases: [One]\nsummary: before\n---\nBody #keep' : source(noteId,'Body #keep','aliases: [One]\nsummary: before\n'));
 const h = harness(root); await call(h.core,'selectVault');
 let note = (await call<NotePage>(h.core,'queryNotes')).notes.find(note=>note.body==='Body #keep')!;
 for (const change of [
   {name:'summary',type:'text',value:'after'},
   {name:'aliases',type:'multiSelect',value:['Two'],options:[{name:'Two',color:'red'}]},
   {name:'aliases',type:'multiSelect',value:['One','Two'],options:[{name:'One',color:'blue'},{name:'Two',color:'red'}],definition:true},
   {name:'aliases',type:'text',definition:true},
   {name:'summary',remove:true},
 ]) {
   const result = await call<import('@memocard/contracts').PropertyUpdateResult>(h.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,...change});
   const loaded = await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:note.id});
   expect(result.propertyData).toEqual(loaded);
   expect(result.propertyData?.contentHash).toBe(result.contentHash);
   note = result;
 }
});

it.each([false,true])('saves inherited tags as properties and recovers them without adding body text (shared=%s)', async shared => {
  const root = shared ? new TestDirectory('shared') : await fixture();
  const h = harness(root); await call(h.core,'selectVault');
  const input = {id:secondId,title:'实际标题',body:'实际正文 #手动',tags:['手动'],inheritedTags:['生活/记录'],baseHash:null};
  await call(h.core,'saveDraft',input);
  const reopened = harness(root,h.storage); await call(reopened.core,'selectVault');
  const recovered = (await call<{drafts:BrowserDraft[]}>(reopened.core,'getDrafts')).drafts.find(draft=>draft.id===secondId)!;
  expect(recovered.inheritedTags).toEqual(['生活/记录']);
  const saved = await call<Note>(reopened.core,'saveNote',recovered);
  expect(saved.body).toBe(input.body); expect(saved.tags).toEqual(['生活/记录','手动']);
  const properties = await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:secondId});
  expect(properties.tagProperty?.value).toEqual(['生活/记录']);
  expect((await call<{drafts:BrowserDraft[]}>(reopened.core,'getDrafts')).drafts).toEqual([]);
  const edited = await call<Note>(reopened.core,'saveNote',{id:secondId,body:'继续写',tags:[],baseHash:saved.contentHash});
  expect(edited.body).toBe('继续写'); expect(edited.tags).toEqual(['生活/记录']);
  expect((await call<NotePage>(reopened.core,'queryNotes',{tags:['生活']})).notes.map(note=>note.id)).toContain(secondId);
});

it.each([false,true])('edits legacy YAML lists as multi-select without rewriting on read or losing original values (shared=%s)',async shared => {
 const root = shared ? new TestDirectory('shared') : await fixture();
 const notes = shared ? root : await root.getDirectoryHandle('notes');
 const values = ['One',' One ','','One','[[项目]]','x'.repeat(101),'two\nlines'];
 const extra = `aliases: ${JSON.stringify(values)}\nunknown: {nested: keep}\n`;
 const file = await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true});
 file.bytes = bytes(shared ? `---\n${extra}---\nBody #keep` : source(noteId,'Body #keep',extra));
 const config = await (await root.getDirectoryHandle('.memocard',{create:true})).getFileHandle('property-definitions.json',{create:true});
 config.bytes = bytes(JSON.stringify({aliases:{type:'list'}}));
 const original = file.text, h = harness(root); await call(h.core,'selectVault');
 const note = (await call<NotePage>(h.core,'queryNotes')).notes.find(note=>note.body==='Body #keep')!;
 const get = () => call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:note.id});
 const fields = await get(), property = fields.properties.find(p=>p.name==='aliases')!;
 expect(property).toMatchObject({type:'multiSelect',value:values});
 expect(file.text).toBe(original);
 expect(JSON.parse(config.text).aliases.type).toBe('list');
 const options = [...property.options!,{name:'Added',color:'blue'}];
 const saved = await call<Note>(h.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,definitionHash:fields.definitionHash,name:'aliases',type:'multiSelect',value:[...values,'Added'],options,definition:true});
 expect(saved.body).toBe('Body #keep');
 expect((await get()).properties.find(p=>p.name==='aliases')!.value).toEqual([...values,'Added']);
 expect(file.text).toContain('unknown: {nested: keep}');
 const other=await notes.getFileHandle('Outside.md',{create:true}), otherId=createId();
 other.bytes=bytes(shared ? '---\naliases: [External]\n---\nOutside' : source(otherId,'Outside','aliases: [External]\n'));
 const outside=(await call<NotePage>(h.core,'queryNotes')).notes.find(note=>note.body==='Outside')!;
 const recolored=options.map(option=>({...option,color:'green'}));
 const changed=await call<Note>(h.core,'updateNoteProperty',{id:note.id,baseHash:saved.contentHash,name:'aliases',type:'multiSelect',value:[...values,'Added'],options:recolored,definition:true});
 const external=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:outside.id});
 expect(external.properties.find(p=>p.name==='aliases')!.value).toEqual(['External']);
 const reopened = harness(root,h.storage); await call(reopened.core,'selectVault');
 await call(reopened.core,'saveNote',{id:note.id,body:'Edited body',tags:[],baseHash:changed.contentHash});
 const after = await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:note.id});
 expect(after.properties.find(p=>p.name==='aliases')).toMatchObject({type:'multiSelect',value:[...values,'Added']});
});

it.each([false,true])('caps inferred options across legacy notes without blocking new notes or pruning values (registered=%s)',async registered => {
 const h=await open(), values=Array.from({length:210},(_,i)=>`Option ${i}`);
 const a=await h.notes.getFileHandle(`${noteId}.md`), b=await h.notes.getFileHandle(`${secondId}.md`,{create:true});
 a.bytes=bytes(source(noteId,'A',`field: ${JSON.stringify(values.slice(0,105))}\n`));
 b.bytes=bytes(source(secondId,'B',`field: ${JSON.stringify(values.slice(105))}\n`));
 if (registered) (await (await h.root.getDirectoryHandle('.memocard')).getFileHandle('property-definitions.json',{create:true})).bytes=bytes(JSON.stringify({field:{type:'list'}}));
 const preview=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties');
 expect(preview.properties.find(p=>p.name==='field')!.options).toHaveLength(200);
 const created=await call<Note>(h.core,'saveNote',{id:createId(),body:'New body',tags:[],baseHash:null});
 expect(created.body).toBe('New body');
 const note=await call<Note>(h.core,'getNote',{id:noteId});
 const fields=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:noteId});
 const property=fields.properties.find(p=>p.name==='field')!;
 await call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,definitionHash:fields.definitionHash,name:'field',type:'multiSelect',value:property.value,options:property.options,definition:true});
 const after=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:secondId});
 expect(after.properties.find(p=>p.name==='field')!.value).toEqual(values.slice(105));
});

it.each([false,true])('treats prototype-like YAML names as ordinary properties (shared=%s)',async shared=>{
 const root=shared ? new TestDirectory('shared') : await fixture(), notes=shared ? root : await root.getDirectoryHandle('notes');
 const file=await notes.getFileHandle(shared ? 'Names.md' : `${noteId}.md`,{create:true});
 const fields='constructor: text\ntoString: text\n__proto__: text\n';
 file.bytes=bytes(shared ? `---\n${fields}---\nNames` : source(noteId,'Names',fields));
 const h=harness(root); await call(h.core,'selectVault');
 const note=(await call<NotePage>(h.core,'queryNotes')).notes.find(n=>n.body==='Names')!;
 let props=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:note.id});
 for (const name of ['constructor','toString','__proto__']) expect(props.properties.find(p=>p.name===name)).toMatchObject({type:'text',value:'text'});
 const updated=await call<Note>(h.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,name:'constructor',type:'text',value:'edited'});
 await call(h.core,'updateNoteProperty',{id:note.id,baseHash:updated.contentHash,name:'__proto__',type:'multiSelect',definition:true});
 props=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:note.id});
 expect(props.properties.find(p=>p.name==='__proto__')).toMatchObject({type:'multiSelect',value:['text']});
 expect(props.properties.find(p=>p.name==='constructor')).toMatchObject({type:'text',value:'edited'});
});

it.each([false,true])('copies and renames legacy list values without losing duplicates or blanks (shared=%s)',async shared=>{
 const root=shared ? new TestDirectory('shared') : await fixture(), notes=shared ? root : await root.getDirectoryHandle('notes');
 const values=['One','One','',' spaced '];
 for (const [id,path,body] of [[noteId,shared?'A.md':`${noteId}.md`,'A'],[secondId,shared?'B.md':`${secondId}.md`,'B']]) {
  const file=await notes.getFileHandle(path,{create:true}), fields=`aliases: ${JSON.stringify(values)}\n`;
  file.bytes=bytes(shared ? `---\n${fields}---\n${body}` : source(id,body,fields));
 }
 const h=harness(root);await call(h.core,'selectVault');
 const page=await call<NotePage>(h.core,'queryNotes'), a=page.notes.find(n=>n.body==='A')!, b=page.notes.find(n=>n.body==='B')!;
 const fields=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:a.id});
 const property=fields.properties.find(p=>p.name==='aliases')!;
 const copied=await call<Note>(h.core,'updateNoteProperty',{id:a.id,baseHash:a.contentHash,name:'aliases copy',type:'multiSelect',value:values,options:property.options,create:true,copyFrom:'aliases'});
 const afterCopy=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:a.id});
 expect(afterCopy.properties.find(p=>p.name==='aliases copy')!.value).toEqual(values);
 const changed=await call<Note>(h.core,'updateNoteProperty',{id:a.id,baseHash:copied.contentHash,name:'aliases',type:'multiSelect',value:['Two','Two','',' spaced '],options:[{name:'Two',color:'blue'}],definition:true,optionRename:{from:'One',to:'Two'}});
 for (const id of [a.id,b.id]) {
  const after=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id});
  expect(after.properties.find(p=>p.name==='aliases')!.value).toEqual(['Two','Two','',' spaced ']);
 }
 await expect(call(h.core,'updateNoteProperty',{id:a.id,baseHash:changed.contentHash,name:'bad copy',type:'multiSelect',value:['','',''],options:[],create:true,copyFrom:'aliases'})).rejects.toMatchObject({code:'INVALID_PROPERTY'});
});

it('saves property tags independently, merges filters and counts once, and checks stale hashes', async () => {
  const h = await open();
  const file = await h.notes.getFileHandle(`${noteId}.md`);
  const body = '正文 #共享 #正文/分类\n\n`#忽略`\n';
  file.bytes = bytes(source(noteId,body).replace('["日常", "machine learning", "C#,F#", "#literal"]','[共享]'));
  const before = await call<Note>(h.core,'getNote',{id:noteId});
  const saved = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:before.contentHash,name:'tags',type:'list',value:['#共享','属性/分类','共享']});
  expect(saved.body).toBe(body);
  expect(saved.tags).toEqual(['共享','属性/分类','正文/分类']);
  expect((await call<NotePage>(h.core,'queryNotes',{tags:['属性']})).notes.map(note=>note.id)).toEqual([noteId]);
  const list = await call<{tags:{name:string;count:number}[]}>(h.core,'listTags');
  expect(list.tags.find(tag=>tag.name==='共享')?.count).toBe(1);
  await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:before.contentHash,name:'tags',type:'list',value:[]})).rejects.toMatchObject({code:'HASH_CONFLICT'});
  const cleared = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:saved.contentHash,name:'tags',type:'list',value:[]});
  expect(cleared.tags).toEqual(['共享','正文/分类']);
  expect(cleared.body).toBe(body);
  expect((await call<NotePage>(h.core,'queryNotes',{quickFilter:'untagged'})).notes).toEqual([]);
  const untouched = file.text;
  await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:cleared.contentHash,name:'tags',type:'list',value:['bad tag']})).rejects.toMatchObject({code:'INVALID_PROPERTY'});
  expect(file.text).toBe(untouched);
  const reopened = harness(h.root,h.storage);
  expect((await call<Note>(reopened.core,'getNote',{id:noteId})).tags).toEqual(cleared.tags);
});

class TestFile implements BrowserFileHandle {
  readonly kind = "file" as const;
  private contents: Uint8Array;
  lastModified = Date.now();
  readError?: string;
  writeHook?: () => Promise<void> | void;
  closeError = false;
  writable = false;
  constructor(public name: string, text: string | Uint8Array) { this.contents = typeof text === "string" ? bytes(text) : text; }
  get bytes(): Uint8Array { return this.contents; }
  set bytes(value: Uint8Array) { this.contents = value; this.lastModified = Date.now(); }
  async isSameEntry(other: BrowserFileHandle | BrowserDirectoryHandle): Promise<boolean> { return this === other; }
  async getFile(): Promise<File> {
    if (this.readError) throw error(this.readError);
    return new File([this.bytes as Uint8Array<ArrayBuffer>], this.name, {lastModified:this.lastModified});
  }
  async createWritable(options?: { mode?: "exclusive" }): Promise<BrowserWritable> {
    if (this.writable && options?.mode === "exclusive") throw error("NoModificationAllowedError");
    this.writable = true;
    let staged = this.bytes;
    return {
      write: async (data) => {
        staged = typeof data === "string" ? bytes(data) : data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
        await this.writeHook?.();
      },
      close: async () => { if (this.closeError) throw error("NotReadableError"); this.bytes = staged; this.writable = false; },
      abort: async () => { this.writable = false; },
    };
  }
  get text(): string { return new TextDecoder().decode(this.bytes); }
}

it('keeps fixture modification times stable across reads and staged or aborted writes', async () => {
  const clock = vi.spyOn(Date,'now').mockReturnValue(10);
  try {
    const file = new TestFile('Stable.md','initial');
    expect((await file.getFile()).lastModified).toBe(10);
    clock.mockReturnValue(20);
    expect((await file.getFile()).lastModified).toBe(10);
    const aborted = await file.createWritable(); await aborted.write('discard');
    expect((await file.getFile()).lastModified).toBe(10);
    await aborted.abort!();
    expect((await file.getFile()).lastModified).toBe(10);
    const saved = await file.createWritable(); await saved.write('saved'); await saved.close();
    expect((await file.getFile()).lastModified).toBe(20);
    expect(file.text).toBe('saved');
  } finally { clock.mockRestore(); }
});

class TestDirectory implements BrowserDirectoryHandle {
  readonly kind = "directory" as const;
  children = new Map<string, TestDirectory | TestFile>();
  permission: PermissionState = "granted";
  requested = 0;
  enumerationError = false;
  createdFile?: (file: TestFile) => void;
  entriesCalls = 0;
  constructor(public name: string) {}
  async isSameEntry(other: BrowserFileHandle | BrowserDirectoryHandle): Promise<boolean> { return this === other; }
  async queryPermission() { return this.permission; }
  async requestPermission() { this.requested++; this.permission = "granted"; return this.permission; }
  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<TestDirectory> {
    let child = this.children.get(name);
    if (!child && options?.create) { child = new TestDirectory(name); this.children.set(name, child); }
    if (!child) throw error("NotFoundError");
    if (!(child instanceof TestDirectory)) throw error("TypeMismatchError");
    return child;
  }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<TestFile> {
    let child = this.children.get(name);
    if (!child && options?.create) { child = new TestFile(name, ""); this.children.set(name, child); this.createdFile?.(child); }
    if (!child) throw error("NotFoundError");
    if (!(child instanceof TestFile)) throw error("TypeMismatchError");
    return child;
  }
  async removeEntry(name: string) { this.children.delete(name); }
  async *entries(): AsyncIterableIterator<[string, TestDirectory | TestFile]> {
    this.entriesCalls++;
    if (this.enumerationError) throw error("NotReadableError");
    yield* this.children;
  }
}

class TestStorage implements BrowserVaultStorage {
  journals = new Map<string, import('./browser-storage').RenameJournal>();
  async renameJournal(scope: string) { return this.journals.get(scope); }
  async saveRenameJournal(scope: string, journal: import('./browser-storage').RenameJournal | undefined) {
    if (this.failWrites) throw error("QuotaExceededError");
    if (journal) this.journals.set(scope, structuredClone(journal)); else this.journals.delete(scope);
  }
  selection?: StoredSelection;
  registry: StoredSelection[] = [];
  records = new Map<string, BrowserDraft>();
  identitiesByScope = new Map<string, import("./browser-files").FileIdentity[]>();
  async identities(scope: string) { return this.identitiesByScope.get(scope) ?? []; }
  async saveIdentities(scope: string, items: import("./browser-files").FileIdentity[]) { this.identitiesByScope.set(scope, items); }
  failWrites = false;
  async loadSelection() { return this.selection; }
  async remember(handle: BrowserDirectoryHandle, id: string) {
    const existing = this.registry.find((entry) => entry.handle === handle);
    const selected = { handle, vaultId: id, directoryId: existing?.directoryId ?? createId() };
    if (!existing) this.registry.push(selected);
    this.selection = selected;
    return selected;
  }
  async drafts(scope: string) { return [...this.records].filter(([key]) => key.startsWith(scope + ":")).map(([, draft]) => structuredClone(draft)); }
  async putDraft(scope: string, draft: BrowserDraft) {
    if (this.failWrites) throw error("QuotaExceededError");
    this.records.set(`${scope}:${draft.draftKey}`, structuredClone(draft));
  }
  async removeMatchingDraft(scope: string, draft: BrowserDraft) {
    const key = `${scope}:${draft.draftKey}`, existing = this.records.get(key);
    if (existing?.title === draft.title && existing?.id === draft.id && existing?.body === draft.body && existing.baseHash === draft.baseHash && existing.revision === draft.revision && existing.updatedAt === draft.updatedAt && JSON.stringify(existing.tags) === JSON.stringify(draft.tags) && JSON.stringify(existing.inheritedTags ?? []) === JSON.stringify(draft.inheritedTags ?? []) && JSON.stringify(existing.pendingProperties ?? []) === JSON.stringify(draft.pendingProperties ?? [])) return this.records.delete(key);
    return false;
  }
}

const locks = new Map<string, Promise<unknown>>();
async function lock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(name) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(task);
  locks.set(name, pending);
  try { return await pending; } finally { if (locks.get(name) === pending) locks.delete(name); }
}

async function fixture(name = "vault", id = vaultId): Promise<TestDirectory> {
  const root = new TestDirectory(name);
  const meta = await root.getDirectoryHandle(".memocard", { create: true });
  meta.children.set("vault.json", new TestFile("vault.json", JSON.stringify({ formatVersion: 1, vaultId: id })));
  const notes = await root.getDirectoryHandle("notes", { create: true });
  notes.children.set(`${noteId}.md`, new TestFile(`${noteId}.md`, source()));
  await root.getDirectoryHandle("assets", { create: true });
  return root;
}

function harness(root: TestDirectory, storage = new TestStorage()) {
  let next: TestDirectory | Error = root;
  let pickerCalls = 0;
  const core = new BrowserVault({ storage, lock, supported: () => true, picker: () => {
    pickerCalls++;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }, decodeImage: async () => undefined });
  return { core, storage, pickerCalls: () => pickerCalls, choose: (value: TestDirectory | Error) => { next = value; } };
}

async function call<T = unknown>(core: BrowserVault, operation: string, params: Record<string, unknown> = {}): Promise<T> {
  const message: BridgeRequest = { version: 1, requestId: createId(), operation, params };
  const reply = await core.request(message);
  if (!reply.ok) throw Object.assign(new Error(reply.error.message), reply.error);
  return reply.data as T;
}

async function open(selected?: TestDirectory, storage?: TestStorage) {
  const root = selected ?? await fixture();
  const value = harness(root, storage);
  await call(value.core, "selectVault", { create: false });
  return { ...value, root, notes: await root.getDirectoryHandle("notes") };
}

function save(note: Note, body = "changed") { return { id: note.id, body, tags: note.tags, baseHash: note.contentHash }; }


describe("independent browser vault", () => {
  it("updates YAML properties with hash checks and preserves raw body and unknown fields", async () => {
    const h = await open();
    const file = await h.notes.getFileHandle(`${noteId}.md`);
    file.bytes = bytes(source(noteId, '# Body\n\n<!-- raw -->\n', '# keep\nsummary: old\nunknown: {nested: [1, two]}\n'));
    const note = await call<Note>(h.core, 'getNote', {id:noteId});
    const before = file.text;
    const updated = await call<Note>(h.core, 'updateNoteProperty', {id:noteId,baseHash:note.contentHash,name:'summary',type:'text',value:'new: #literal'});
    expect(updated.body).toBe(note.body);
    expect(file.text).toContain('# keep\n"summary": "new: #literal"\nunknown: {nested: [1, two]}');
    const properties = await call<import('@memocard/contracts').NoteProperties>(h.core, 'getNoteProperties', {id:noteId});
    expect(properties.properties.find(item => item.name === 'summary')?.value).toBe('new: #literal');
    await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'summary',remove:true})).rejects.toMatchObject({code:'HASH_CONFLICT'});
    expect(file.text).not.toBe(before);
    await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:updated.contentHash,name:'id',type:'text',value:'bad'})).rejects.toMatchObject({code:'INVALID_PROPERTY'});
  });
  it("preserves choice options, colors and types after body saves and reopen", async () => {
    const h = await open();
    let note = await call<Note>(h.core,'getNote',{id:noteId});
    const options = [{name:'设计',color:'blue'},{name:'AI Design',color:'purple'}];
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'阶段',type:'select',value:'设计',options,create:true});
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'领域',type:'multiSelect',value:['设计','AI Design'],options,create:true});
    note = await call<Note>(h.core,'saveNote',save(note,'Body saved'));
    let properties = await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:noteId});
    expect(properties.properties.find(property=>property.name==='领域')).toMatchObject({type:'multiSelect',value:['设计','AI Design'],options});
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'阶段',type:'select',value:''});
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'领域',type:'multiSelect',value:[]});
    await call<Note>(h.core,'saveNote',save(note,'Empty choices'));
    const reopened = await open(h.root,h.storage);
    properties = await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:noteId});
    expect(properties.properties.find(property=>property.name==='阶段')).toMatchObject({type:'select',value:'',options});
    expect(properties.properties.find(property=>property.name==='领域')).toMatchObject({type:'multiSelect',value:[],options});
  });
  it("keeps date-shaped text as text after type switch, body save and reopen", async () => {
    const h = await open();
    let note = await call<Note>(h.core,'getNote',{id:noteId});
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'日期',type:'date',value:'2028-02-29',create:true});
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'日期',type:'text',value:'2028-02-29'});
    await call(h.core,'saveNote',save(note,'Saved after conversion'));
    const reopened = await open(h.root,h.storage);
    const fields = await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:noteId});
    expect(fields.properties.find(field=>field.name==='日期')).toMatchObject({type:'text',value:'2028-02-29'});
  });
  it("renames a choice property atomically and retains its definition through body save and reopen", async () => {
    const h = await open();
    let note = await call<Note>(h.core,'getNote',{id:noteId});
    const options = [{name:'设计',color:'purple'}];
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'领域',type:'multiSelect',value:['设计'],options,create:true});
    const before = note;
    note = await call<Note>(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'领域',renameTo:'工作领域'});
    expect(note.body).toBe(before.body);
    await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:before.contentHash,name:'工作领域',renameTo:'stale'})).rejects.toMatchObject({code:'HASH_CONFLICT'});
    await call(h.core,'saveNote',save(note,'Saved after rename'));
    const reopened = await open(h.root,h.storage);
    const fields = await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:noteId});
    expect(fields.properties).toContainEqual({name:'工作领域',type:'multiSelect',value:['设计'],options,editable:true});
    expect(fields.properties.some(field=>field.name==='领域')).toBe(false);
  });
  it("refuses an external change while staging a property write", async () => {
    const h = await open();
    const note = await call<Note>(h.core,'getNote',{id:noteId});
    const file = await h.notes.getFileHandle(`${noteId}.md`);
    const external = source(noteId,'external');
    file.writeHook = () => { file.bytes = bytes(external); };
    await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'done',type:'checkbox',value:true,create:true})).rejects.toMatchObject({code:'HASH_CONFLICT'});
    expect(file.text).toBe(external);
  });

  it("reuses one scan for a refresh batch and rescans the next query", async () => {
    const h = await open();
    expect(h.notes.entriesCalls).toBe(0);
    await call(h.core, "getStatus");
    expect(h.notes.entriesCalls).toBe(1);
    await Promise.all([
      call(h.core, "queryNotes"),
      call(h.core, "listTags"),
      call(h.core, "listFolders"),
    ]);
    expect(h.notes.entriesCalls).toBe(1);
    await call(h.core, "queryNotes");
    expect(h.notes.entriesCalls).toBe(2);
  });

  it("reuses exact-hash parse results across scans and drops deleted paths", async () => {
    const root = await fixture(), storage = new TestStorage();
    let parses = 0;
    const core = new BrowserVault({ storage, lock, supported: () => true, picker: async () => root,
      decodeImage: async () => undefined, parseLegacy: async (...args) => { parses++; return parseBrowserNote(...args); } });
    await call(core, "selectVault");
    await call(core, "getStatus");
    expect(parses).toBe(1);
    await call(core, "queryNotes");
    await call(core, "queryNotes");
    expect(parses).toBe(1);

    const notes = await root.getDirectoryHandle("notes");
    const file = await notes.getFileHandle(`${noteId}.md`);
    file.bytes = bytes(source(noteId, "changed"));
    await call(core, "queryNotes");
    expect(parses).toBe(2);
    notes.children.delete(`${noteId}.md`);
    await call(core, "queryNotes");
    notes.children.set(`${noteId}.md`, file);
    await call(core, "queryNotes");
    expect(parses).toBe(3);
  });

  it("enters picker synchronously and creates an empty vault that can be opened after reload", async () => {
    const root = new TestDirectory("new vault"), h = harness(root);
    const pending = call(h.core, "selectVault", { create: true });
    expect(h.pickerCalls()).toBe(1);
    await pending;
    expect((await call<VaultStatus>(h.core, "getStatus")).connected).toBe(true);
    const restored = harness(root, h.storage);
    expect((await call<VaultStatus>(restored.core, "getStatus")).vaultName).toBe("new vault");
    expect(restored.pickerCalls()).toBe(0);
    const metadata = await (await root.getDirectoryHandle(".memocard")).getFileHandle("vault.json");
    expect(JSON.parse(metadata.text).formatVersion).toBe(2);
  });

  it("rejects creating in nonempty folders and preserves the previous selection on cancel or invalid selection", async () => {
    const h = await open(), before = h.core.binding;
    h.choose(error("AbortError"));
    expect(await call(h.core, "selectVault", {})).toEqual({ cancelled: true, diagnostic: "选择文件夹并授权 / AbortError" });
    const nonempty = new TestDirectory("documents");
    nonempty.children.set("existing.txt", new TestFile("existing.txt", "keep"));
    h.choose(nonempty);
    await expect(call(h.core, "selectVault", { create: true })).rejects.toMatchObject({ code: "VAULT_NOT_EMPTY" });
    expect(h.core.binding).toBe(before);
    expect((await call<VaultStatus>(h.core, "getStatus")).vaultName).toBe("vault");
  });

  it("reports the failing opening stage without leaking file paths and preserves the active vault", async () => {
    const h = await open(), before = h.core.binding;
    h.choose(error("NotAllowedError"));
    await expect(call(h.core, "selectVault", {})).rejects.toMatchObject({
      code: "UNAUTHORIZED", message: expect.stringContaining("选择文件夹并授权 / NotAllowedError"),
    });
    expect(h.core.binding).toBe(before);
  });

  it("distinguishes handle persistence failure from picker failure", async () => {
    const storage = new TestStorage();
    storage.remember = async () => { throw error("DataCloneError"); };
    const h = harness(await fixture(), storage);
    await expect(call(h.core, "selectVault", {})).rejects.toMatchObject({
      message: expect.stringContaining("保存文件夹授权到浏览器 / DataCloneError"),
    });
    expect(h.core.binding).toBeNull();
  });

  it("matches the shared Swift contract and hashes raw CRLF bytes", async () => {
    const fixturePath = new URL("../../../tests/fixtures/", import.meta.url);
    const bridge = JSON.parse(readFileSync(new URL("bridge-v1.json", fixturePath), "utf8"));
    const raw = readFileSync(new URL(`vault/notes/${noteId}.md`, fixturePath));
    expect((await parseBrowserNote(raw, `notes/${noteId}.md`, vaultId)).note).toEqual(bridge.note.data);
    const crlf = bytes(source().replace(/\n/g, "\r\n"));
    const parsed = (await parseBrowserNote(crlf, "notes/renamed.md", vaultId)).note;
    expect(parsed.body).toBe("中文 test\n");
    expect(parsed.contentHash).toBe(createHash("sha256").update(crlf).digest("hex"));
  });

  it("merges YAML tags on reads and preserves them independently of body drafts", async () => {
    const h = await open();
    const file = await h.notes.getFileHandle(`${noteId}.md`);
    const original = source(noteId, '#工作/项目\n\n句中 #工作/项目\n\n#生活');
    file.bytes = bytes(original);
    const note = await call<Note>(h.core, "getNote", { id: noteId });
    expect(note.tags).toEqual(['日常', 'literal', '工作/项目', '生活']);
    expect(file.text).toBe(original);
    expect((await call<NotePage>(h.core, "queryNotes", { tags: ['日常'] })).notes.map(note => note.id)).toEqual([noteId]);
    const draft = await call<BrowserDraft>(h.core, 'saveDraft', { ...save(note, '正文 #生活'), tags: ['日常'] });
    expect(draft.tags).toEqual(['生活']);
    const saved = await call<Note>(h.core, 'saveNote', { ...save(note, '正文 #生活'), tags: ['日常'] });
    expect(saved.tags).toEqual(['日常', 'literal', '生活']);
    const cleared = await call<Note>(h.core, 'saveNote', { ...save(saved, '正文'), tags: ['日常'] });
    expect(cleared.tags).toEqual(['日常', 'literal']);
    expect((await call<{ tags: {name:string}[] }>(h.core, 'listTags')).tags.map(tag => tag.name)).toEqual(['literal','日常']);
    const reopened = harness(h.root, h.storage);
    expect((await call<Note>(reopened.core, 'getNote', { id: noteId })).tags).toEqual(['日常', 'literal']);
    const raw = source(noteId, '#保留').replace('["日常", "machine learning", "C#,F#", "#literal"]', '[yes]');
    expect((await parseBrowserNote(bytes(raw), 'notes/a.md', vaultId)).note.tags).toEqual(['保留']);
  });

  it.each([
    source().replace("2026-09-28T04:00:00Z", "2026-02-30T04:00:00Z"),
    source().replace("2026-09-28T04:00:00Z", "2026-09-28T24:00:00Z"),
    source(noteId, "", "deletedAt: ''\n"),
    source(noteId, "", "id: different\n"),
    "\ufeff" + source(),
  ])("keeps malformed metadata out of normal notes", async (raw) => {
    await expect(parseBrowserNote(bytes(raw), "notes/bad.md", vaultId)).rejects.toHaveProperty("code");
  });

  it("preserves unknown YAML data and original createdAt across external nested rename", async () => {
    const h = await open();
    const original = await h.notes.getFileHandle(`${noteId}.md`);
    original.bytes = bytes(source(noteId, "before", "custom: &custom\n  enabled: yes\n  value: 3\nother: *custom\ndeletedAt: null\n"));
    const note = await call<Note>(h.core, "getNote", { id: noteId });
    const nested = await h.notes.getDirectoryHandle("folder", { create: true });
    h.notes.children.delete(`${noteId}.md`); nested.children.set("renamed.md", original);
    const saved = await call<Note>(h.core, "saveNote", save(note));
    expect(saved.relativePath).toBe("notes/folder/renamed.md");
    expect(saved.createdAt).toBe(note.createdAt);
    expect(saved.tags).toEqual(note.tags);
    expect(original.text).toContain("custom: &custom");
    expect(original.text).toContain("other: *custom");
    expect(original.text).toContain("enabled: yes");
    expect(saved.body).toBe("changed");
  });

  it("does not overwrite an external change and retains the local draft", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`);
    file.bytes = bytes(source(noteId, "external"));
    await expect(call(h.core, "saveNote", save(note, "my draft"))).rejects.toMatchObject({ code: "HASH_CONFLICT" });
    expect(file.text).toContain("external");
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("my draft");
  });

  it("rechecks source after staging and aborts without clobbering an external write", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`);
    file.writeHook = () => { file.bytes = bytes(source(noteId, "external while staging")); };
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "HASH_CONFLICT" });
    expect(file.text).toContain("external while staging");
    expect(file.writable).toBe(false);
  });

  it("does not resurrect a physically deleted note", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    h.notes.children.delete(`${noteId}.md`);
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "NOTE_NOT_FOUND" });
    expect(h.notes.children.size).toBe(0);
  });

  it("excludes all duplicate IDs and pauses writes for incomplete scans", async () => {
    const h = await open();
    h.notes.children.set("copy.md", new TestFile("copy.md", source(noteId.toUpperCase())));
    const page = await call<NotePage>(h.core, "queryNotes");
    expect(page.notes).toEqual([]);
    expect(page.coverage).toMatchObject({ complete: false, issues: 2 });
    await expect(call(h.core, "getNote", { id: noteId })).rejects.toMatchObject({ code: "DUPLICATE_ID" });
    await expect(call(h.core, "saveNote", { id: secondId, body: "new", tags: [], baseHash: null })).rejects.toMatchObject({ code: "SCAN_INCOMPLETE" });
  });

  it("reports unreadable and missing metadata as incomplete rather than empty or deleted", async () => {
    const h = await open();
    (await h.notes.getFileHandle(`${noteId}.md`)).readError = "NotReadableError";
    h.notes.children.set("plain.md", new TestFile("plain.md", "external note without id"));
    expect((await call<NotePage>(h.core, "queryNotes")).coverage).toMatchObject({ complete: false, pending: 1, issues: 1 });
    await expect(call(h.core, "getNote", { id: noteId })).rejects.toMatchObject({ code: "NOTE_UNAVAILABLE" });
  });

  it("keeps drafts available after permission loss and asks for permission only on explicit reauthorization", async () => {
    const h = await open(), binding = h.core.binding;
    h.root.permission = "prompt";
    const status = await call<VaultStatus>(h.core, "getStatus");
    expect(status).toMatchObject({ connected: false, vaultName: "vault", syncState: "unauthorized" });
    expect(h.root.requested).toBe(0);
    await call(h.core, "saveDraft", { id: secondId, body: "offline", tags: [], baseHash: null, vaultBinding: binding });
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("offline");
    await call(h.core, "reauthorizeVault");
    expect(h.root.requested).toBe(1);
    expect(h.core.binding).toBe(binding);
  });

  it("isolates restored folders with the same vaultId and rejects stale editor writes after switching", async () => {
    const h = await open(), firstBinding = h.core.binding;
    await call(h.core, "saveDraft", { id: secondId, body: "first folder", tags: [], baseHash: null, vaultBinding: firstBinding });
    const clone = await fixture("restored clone"); h.choose(clone);
    await call(h.core, "selectVault");
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts).toEqual([]);
    await expect(call(h.core, "saveDraft", { id: secondId, body: "stale", tags: [], baseHash: null, vaultBinding: firstBinding })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(h.core.asset("assets/a.png", firstBinding!)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    h.choose(h.root); await call(h.core, "selectVault");
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("first folder");
  });

  it("rejects a queued save if selection changes while its staged write is in progress", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`), original = file.text;
    const clone = await fixture("other");
    file.writeHook = async () => { h.choose(clone); await call(h.core, "selectVault"); };
    await expect(call(h.core, "saveNote", { ...save(note), vaultBinding: h.core.binding })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(file.text).toBe(original);
    expect((await (await clone.getDirectoryHandle("notes")).getFileHandle(`${noteId}.md`)).text).toBe(source());
  });

  it("keeps separate drafts for two tabs resuming the same recovered draft", async () => {
    const h = await open();
    const original = await call<BrowserDraft>(h.core, "saveDraft", { id: secondId, body: "recover", tags: [], baseHash: null });
    const one = harness(h.root, h.storage), two = harness(h.root, h.storage);
    await call(one.core, "getStatus"); await call(two.core, "getStatus");
    await call(one.core, "saveDraft", { ...original, body: "tab one", vaultBinding: one.core.binding });
    await call(two.core, "saveDraft", { ...original, body: "tab two", vaultBinding: two.core.binding });
    const drafts = (await call<{ drafts: BrowserDraft[] }>(one.core, "getDrafts")).drafts;
    expect(drafts.map((draft) => draft.body).sort()).toEqual(["recover", "tab one", "tab two"]);
    await call(one.core, "saveNote", { ...original, body: "tab one", vaultBinding: one.core.binding });
    expect((await call<{ drafts: BrowserDraft[] }>(two.core, "getDrafts")).drafts.map((draft) => draft.body)).toEqual(["tab two"]);
  });

  it("requires durable drafts before touching source and preserves them when closing the stream fails", async () => {
    const h = await open(), note = await call<Note>(h.core, "getNote", { id: noteId });
    const file = await h.notes.getFileHandle(`${noteId}.md`), original = file.text;
    h.storage.failWrites = true;
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "STORAGE_FULL" });
    expect(file.text).toBe(original);
    h.storage.failWrites = false; file.closeError = true;
    await expect(call(h.core, "saveNote", save(note))).rejects.toMatchObject({ code: "FILE_PENDING" });
    expect(file.text).toBe(original);
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("changed");
  });

  it("removes only the new empty placeholder after ordinary commit failure, retaining its draft", async () => {
    const h = await open();
    h.notes.createdFile = (file) => { file.closeError = true; };
    await expect(call(h.core, "saveNote", { id: secondId, body: "new draft", tags: [], baseHash: null })).rejects.toMatchObject({ code: "FILE_PENDING" });
    expect(h.notes.children.has(`${secondId}.md`)).toBe(false);
    expect((await call<{ drafts: BrowserDraft[] }>(h.core, "getDrafts")).drafts[0]?.body).toBe("new draft");
  });

  it("serializes two tabs saving the same base version and keeps the losing draft", async () => {
    const h = await open(), other = harness(h.root, h.storage);
    await call(other.core, "getStatus");
    const note = await call<Note>(h.core, "getNote", { id: noteId });
    const results = await Promise.allSettled([
      call(h.core, "saveNote", save(note, "first tab")),
      call(other.core, "saveNote", save(note, "second tab")),
    ]);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1]).toMatchObject({ status: "rejected", reason: { code: "HASH_CONFLICT" } });
    expect((await call<Note>(h.core, "getNote", { id: noteId })).body).toBe("first tab");
    expect((await call<{ drafts: BrowserDraft[] }>(other.core, "getDrafts")).drafts.map((draft) => draft.body)).toEqual(["second tab"]);
  });

  it("matches Chinese/case-insensitive substrings, AND tags, date interval, and invalidates stale cursors", async () => {
    const h = await open();
    (await h.notes.getFileHandle(`${noteId}.md`)).bytes = bytes(source(noteId, "中文 test #日常 #技术"));
    h.notes.children.set("second.md", new TestFile("second.md", source(secondId, "中文 TEST two").replaceAll("2026-09-28T04:00:00Z", "2026-09-29T04:00:00Z")));
    expect((await call<NotePage>(h.core, "queryNotes", { query: "中文 TEST", tags: ["日常", "技术"], from: "2026-09-28T04:00:00Z", to: "2026-09-29T04:00:00Z" })).notes.map((note) => note.id)).toEqual([noteId]);
    const first = await call<NotePage>(h.core, "queryNotes", { limit: 1 });
    expect(first.notes[0]?.id).toBe(secondId);
    expect((await call<NotePage>(h.core, "queryNotes", { limit: 1, cursor: first.nextCursor })).notes[0]?.id).toBe(noteId);
    (await h.notes.getFileHandle(`${noteId}.md`)).bytes = bytes(source(noteId, "updated"));
    await expect(call(h.core, "queryNotes", { limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ code: "STALE_CURSOR" });
  });

  it("filters the whole vault before paging, keeps global counts and binds cursors to the quick filter", async () => {
    const h = await open();
    (await h.notes.getFileHandle(`${noteId}.md`)).bytes = bytes(source(noteId, "#工作 ![照片](photo.png) https://example.com").replace(/tags: .*\n/, "tags: []\n"));
    h.notes.children.set("second.md", new TestFile("second.md", source(secondId, "![照片](https://example.com/photo.png)").replace(/tags: .*\n/, "tags: []\n")));
    const codeId = createId();
    h.notes.children.set("code.md", new TestFile("code.md", source(codeId, "```md\n![代码](photo.png) https://example.com\n```").replace(/tags: .*\n/, "tags: []\n")));
    const first = await call<NotePage>(h.core, "queryNotes", { quickFilter: "images", limit: 1 });
    expect(first.notes).toHaveLength(1);
    expect(first.filterCounts).toEqual({ untagged: 2, images: 2, links: 1 });
    expect(first.nextCursor).toBeTruthy();
    const next = await call<NotePage>(h.core, "queryNotes", { quickFilter: "images", limit: 1, cursor: first.nextCursor });
    expect(next.notes).toHaveLength(1);
    expect(next.notes[0].id).not.toBe(first.notes[0].id);
    expect(next.nextCursor).toBeNull();
    expect((await call<NotePage>(h.core, "queryNotes", { quickFilter: "links", query: "example", tags: ["工作"] })).notes.map(note => note.id)).toEqual([noteId]);
    expect((await call<NotePage>(h.core, "queryNotes", { quickFilter: "untagged" })).notes.map(note => note.id).sort()).toEqual([secondId, codeId].sort());
    await expect(call(h.core, "queryNotes", { quickFilter: "links", limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ code: "CURSOR_QUERY_MISMATCH" });
    await expect(call(h.core, "queryNotes", { quickFilter: "voice" })).rejects.toMatchObject({ code: "INVALID_PARAMS" });
    const current = await call<Note>(h.core, "getNote", { id: noteId });
    await call(h.core, "saveNote", save(current, "#工作 移除图片和链接"));
    expect((await call<NotePage>(h.core, "queryNotes", { quickFilter: "links" })).filterCounts).toEqual({ untagged: 2, images: 1, links: 0 });
  });

  it("invalidates pagination when switching to an identical restored folder with the same vaultId", async () => {
    const h = await open();
    h.notes.children.set("second.md", new TestFile("second.md", source(secondId)));
    const first = await call<NotePage>(h.core, "queryNotes", { limit: 1 });
    const clone = await fixture("restored clone");
    (await clone.getDirectoryHandle("notes")).children.set("second.md", new TestFile("second.md", source(secondId)));
    h.choose(clone); await call(h.core, "selectVault");
    await expect(call(h.core, "queryNotes", { limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ code: "STALE_CURSOR" });
  });

  it("imports image relative to the moved note and refuses asset traversal/non-images", async () => {
    const h = await open(), file = await h.notes.getFileHandle(`${noteId}.md`);
    const nested = await h.notes.getDirectoryHandle("folder", { create: true });
    h.notes.children.delete(`${noteId}.md`); nested.children.set("renamed.md", file);
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8]);
    const attachment = await call<{ relativePath: string; markdownPath: string }>(h.core, "importAttachment", { name: "picture.png", base64: Buffer.from(png).toString("base64"), noteId });
    expect(attachment.markdownPath).toBe(`../../${attachment.relativePath}`);
    expect((await h.core.asset(attachment.relativePath)).type).toBe("image/png");
    await expect(h.core.asset("assets/../.memocard/vault.json")).rejects.toMatchObject({ code: "PATH_NOT_ALLOWED" });
    await expect(call(h.core, "importAttachment", { name: "fake.png", base64: btoa("not an image"), noteId })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
  });

  it("requires successful image decoding before creating an attachment file", async () => {
    const root = await fixture();
    const core = new BrowserVault({ storage: new TestStorage(), lock, supported: () => true, picker: async () => root,
      decodeImage: async () => { throw new Error("truncated image"); } });
    await call(core, "selectVault");
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8]);
    await expect(call(core, "importAttachment", { name: "broken.png", base64: Buffer.from(png).toString("base64"), noteId })).rejects.toMatchObject({ code: "INVALID_ATTACHMENT" });
    expect((await root.getDirectoryHandle("assets")).children.size).toBe(0);
  });
});

it("lists empty nested folders and filters descendants without prefix collisions", async () => {
  const { core, notes } = await open();
  const folder = await notes.getDirectoryHandle("工作", { create: true });
  await folder.getDirectoryHandle("空目录", { create: true });
  const child = await folder.getDirectoryHandle("项目", { create: true });
  child.children.set("nested.md", new TestFile("nested.md", source(secondId)));
  const result = await call<{folders: string[]}>(core, "listFolders");
  expect(result.folders).toEqual(["notes", "notes/工作", "notes/工作/空目录", "notes/工作/项目"]);
  const page = await call<NotePage>(core, "queryNotes", { folder: "notes/工作" });
  expect(page.notes.map(note => note.id)).toEqual([secondId]);
  expect((await call<NotePage>(core, "queryNotes", { folder: "notes/工" })).notes).toEqual([]);
  await expect(call(core, "queryNotes", { folder: "notes/../assets" })).rejects.toBeTruthy();
});

it("creates new notes and attachment references in the selected nested folder", async () => {
  const h = await open();
  const work = await h.notes.getDirectoryHandle("工作", { create: true });
  const project = await work.getDirectoryHandle("项目", { create: true });
  const path = `notes/工作/项目/图片记录.md`;
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8]);
  const image = await call<{markdownPath: string; relativePath: string; notePath: string}>(h.core, "importAttachment", {
    name: "image.png", base64: Buffer.from(png).toString("base64"), noteId: secondId, notePath: path,
  });
  expect(image.notePath).toBe(path);
  expect(image.markdownPath).toBe(`../../../${image.relativePath}`);
  const saved = await call<Note>(h.core, "saveNote", { id: secondId, body: `![图片](${image.markdownPath})`, tags: [], baseHash: null, relativePath: path });
  expect(saved.relativePath).toBe(path);
  expect((await project.getFileHandle("图片记录.md")).text).toContain(image.markdownPath);
  expect(h.notes.children.has(`${secondId}.md`)).toBe(false);
});

it("keeps the draft when a destination folder disappears and never falls back to root", async () => {
  const h = await open();
  const save = { id: secondId, body: "保留草稿", tags: [], baseHash: null, relativePath: `notes/missing/${secondId}.md` };
  await expect(call(h.core, "saveNote", save)).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND" });
  expect(h.notes.children.has(`${secondId}.md`)).toBe(false);
  const result = await call<{drafts: BrowserDraft[]}>(h.core, "getDrafts");
  expect(result.drafts[0]?.body).toBe("保留草稿");
  await expect(call(h.core, "saveNote", { ...save, relativePath: "notes/../outside.md" })).rejects.toMatchObject({ code: "PATH_NOT_ALLOWED" });
});

describe("Obsidian shared folders", () => {
  it('merges tag case across YAML, body, counts and query without changing source', async () => {
    const root = new TestDirectory('Obsidian');
    const source = '---\ntags: [Work, WORK]\n---\n#work #WORK/Design';
    const file = new TestFile('Tag case.md',source); root.children.set(file.name,file);
    const h = harness(root); await call(h.core,'selectVault');
    const page = await call<NotePage>(h.core,'queryNotes',{tags:['WORK']});
    expect(page.notes).toHaveLength(1);
    expect(page.notes[0].tags).toEqual(['work','work/design']);
    const listed = await call<{tags:{name:string;count:number}[]}>(h.core,'listTags');
    expect(listed.tags.find(tag=>tag.name==='work')?.count).toBe(1);
    expect(file.text).toBe(source);
  });
  it("opens plain files, preserves custom properties byte-for-byte, follows rename and rejects stale writes", async () => {
    const root = new TestDirectory("Obsidian");
    const header = '---\r\nid: my-own-id\r\ncreatedAt: yesterday\r\n# Keep this comment\r\naliases: [Example]\r\ntags: [work]\r\n---\r\n';
    const file = new TestFile("Example.md", header + "Original #inline/topic\r\n");
    root.children.set(file.name, file);
    const plain = new TestFile("Plain.md", "No properties"); root.children.set(plain.name, plain);
    const h = harness(root); await call(h.core, "selectVault");
    const page = await call<NotePage>(h.core, "queryNotes");
    expect(page.coverage.complete).toBe(true);
    const note = page.notes.find(note => note.relativePath === "Example.md")!;
    expect(note.tags).toEqual(["work", "inline/topic"]);
    expect(file.text).toBe(header + "Original #inline/topic\r\n");
    const saved = await call<Note>(h.core, "saveNote", { id: note.id, body: "Updated #inline/topic\r\n", tags: note.tags, baseHash: note.contentHash });
    expect(file.text).toBe(header + "Updated #inline/topic\r\n");
    const folder = await root.getDirectoryHandle("Projects", { create: true });
    root.children.delete(file.name); folder.children.set("Renamed.md", file);
    const reopened = harness(root, h.storage); await call(reopened.core, "selectVault");
    const moved = await call<Note>(reopened.core, "getNote", { id: note.id });
    expect(moved.relativePath).toBe("Projects/Renamed.md");
    file.bytes = bytes(header + "External edit");
    await expect(call(reopened.core, "saveNote", { id: note.id, body: "Stale", tags: note.tags, baseHash: saved.contentHash })).rejects.toMatchObject({ code: "HASH_CONFLICT" });
    expect(file.text).toBe(header + "External edit");
    const plainNote = page.notes.find(note => note.relativePath === "Plain.md")!;
    await call(reopened.core, "saveNote", { id: plainNote.id, body: "Still plain", tags: [], baseHash: plainNote.contentHash });
    expect(plain.text).toBe("Still plain");
  });

  it("resolves root, relative and short-name links, rejecting ambiguous and private targets", async () => {
    const root = new TestDirectory("Obsidian");
    const folder = await root.getDirectoryHandle("Projects", { create: true });
    folder.children.set("Target.md", new TestFile("Target.md", "Target"));
    folder.children.set("pic.png", new TestFile("pic.png", "image"));
    const h = harness(root); await call(h.core, "selectVault");
    expect(await call(h.core, "resolveLink", { target: "Target", sourcePath: "Home.md", wiki: true })).toMatchObject({ kind: "note", path: "Projects/Target.md" });
    expect(await call(h.core, "resolveLink", { target: "pic.png", sourcePath: "Projects/Target.md", wiki: false })).toEqual({ kind: "image", path: "Projects/pic.png" });
    const second = await root.getDirectoryHandle("Other", { create: true }); second.children.set("Target.md", new TestFile("Target.md", "Other"));
    await expect(call(h.core, "resolveLink", { target: "Target", sourcePath: "Home.md", wiki: true })).rejects.toMatchObject({ code: "AMBIGUOUS_LINK" });
    await expect(h.core.asset(".obsidian/secret.png")).rejects.toMatchObject({ code: "PATH_NOT_ALLOWED" });
    await expect(call(h.core, "resolveLink", { target: "../../secret.png", sourcePath: "Home.md", wiki: true })).rejects.toMatchObject({ code: "LINK_NOT_FOUND" });
  });
});

it("creates readable plain Markdown and serializes simultaneous first scans", async () => {
  const root = new TestDirectory("shared"), h = harness(root);
  root.children.set("A.md", new TestFile("A.md", "same"));
  root.children.set("B.md", new TestFile("B.md", "same"));
  await call(h.core, "selectVault");
  const [a, b] = await Promise.all([call<NotePage>(h.core, "queryNotes"), call<NotePage>(h.core, "queryNotes")]);
  expect(a.notes.map(note => note.id)).toEqual(b.notes.map(note => note.id));
  expect(new Set(a.notes.map(note => note.id)).size).toBe(2);
  const note = await call<Note>(h.core, "saveNote", { id: secondId, body: "# 我的记录\n\n正文", tags: [], baseHash: null });
  expect(note.relativePath).toBe(`新内容.md`);
  expect((await root.getFileHandle(note.relativePath)).text).toBe("# 我的记录\n\n正文");
});

it.each(['invalid', 'pending', 'enumeration'] as const)('keeps readable compatible note IDs stable through an incomplete %s scan', async failure => {
  const root = new TestDirectory('shared'), h = harness(root);
  root.children.set('Readable.md', new TestFile('Readable.md', 'Readable body'));
  const unavailable = new TestDirectory('Unavailable');
  root.children.set('Unavailable', unavailable);
  const file = new TestFile('Other.md', failure === 'invalid' ? '---\nbroken: [unclosed\n---\nBody' : 'Other body');
  unavailable.children.set('Other.md', file);
  if (failure === 'pending') file.readError = 'NotReadableError';
  if (failure === 'enumeration') unavailable.enumerationError = true;
  await call(h.core, 'selectVault');
  const first = await call<NotePage>(h.core, 'queryNotes');
  expect(first.coverage.complete).toBe(false);
  const readable = first.notes.find(note => note.relativePath === 'Readable.md')!;
  expect(readable).toBeTruthy();
  const reopened = harness(root, h.storage);
  const next = await call<NotePage>(reopened.core, 'queryNotes');
  expect(next.notes.find(note => note.relativePath === 'Readable.md')?.id).toBe(readable.id);
  expect(await call(reopened.core, 'getNote', {id: readable.id})).toMatchObject({id: readable.id, body: 'Readable body'});
  await expect(call(reopened.core, 'saveNote', {id: readable.id, body: 'Edited', tags: [], baseHash: readable.contentHash})).rejects.toMatchObject({code: 'SCAN_INCOMPLETE'});
});

it.each(['pending', 'enumeration'] as const)('retains unknown compatible identities without mistaking an unreadable %s source for a move', async failure => {
  const root = new TestDirectory('shared'), h = harness(root);
  const folder = await root.getDirectoryHandle('Unavailable', {create: true});
  const original = new TestFile('Original.md', 'Same body');
  folder.children.set('Original.md', original);
  await call(h.core, 'selectVault');
  const first = (await call<NotePage>(h.core, 'queryNotes')).notes[0];
  if (failure === 'pending') original.readError = 'NotReadableError';
  else folder.enumerationError = true;
  root.children.set('New.md', new TestFile('New.md', 'Same body'));
  const added = (await call<NotePage>(h.core, 'queryNotes')).notes[0];
  expect(added.relativePath).toBe('New.md');
  expect(added.id).not.toBe(first.id);
  original.readError = undefined; folder.enumerationError = false;
  const reopened = harness(root, h.storage), page = await call<NotePage>(reopened.core, 'queryNotes');
  expect(page.notes.find(note => note.relativePath === 'Unavailable/Original.md')?.id).toBe(first.id);
  expect(page.notes.find(note => note.relativePath === 'New.md')?.id).toBe(added.id);
});

it("indexes both sources without rewriting YAML when the body is saved", async () => {
  const root = new TestDirectory("shared"), h = harness(root);
  const file = new TestFile("A.md", '---\r\n# header\r\ntags: [old]\r\ncustom: "keep spelling"\r\n---\r\nBody #inline');
  root.children.set("A.md", file);
  await call(h.core, "selectVault");
  const note = (await call<NotePage>(h.core, "queryNotes")).notes[0];
  expect(note.tags).toEqual(["old", "inline"]);
  expect((await call<NotePage>(h.core, "queryNotes", { tags: ["old"] })).notes.map(note => note.id)).toEqual([note.id]);
  const saved = await call<Note>(h.core, "saveNote", { id: note.id, body: note.body, tags: ["new", "inline"], baseHash: note.contentHash });
  expect(file.text).toBe('---\r\n# header\r\ntags: [old]\r\ncustom: "keep spelling"\r\n---\r\nBody #inline');
  expect(saved.tags).toEqual(["old", "inline"]);
  const cleared = await call<Note>(h.core, "saveNote", { id: note.id, body: "Body", tags: ["old"], baseHash: saved.contentHash });
  expect(cleared.tags).toEqual(["old"]);
  expect((await call<{ tags: {name:string}[] }>(h.core, "listTags")).tags.map(tag => tag.name)).toEqual(["old"]);
  const reopened = harness(root, h.storage);
  expect((await call<Note>(reopened.core, "getNote", { id: note.id })).tags).toEqual(["old"]);
});

it("includes descendants in tag queries and counts each note once per ancestor", async () => {
  const h = await open();
  await call(h.core, "saveNote", { id: secondId, body: "Nested #工作 #工作/项目/设计 #工作/项目/开发", tags: [], baseHash: null });
  await call(h.core, "saveNote", { id: createId(), body: "Boundary #工作室", tags: [], baseHash: null });
  for (const tag of ["工作", "工作/项目", "工作/项目/设计"]) {
    const page = await call<NotePage>(h.core, "queryNotes", { tags: [tag] });
    expect(page.notes.map(note => note.id)).toEqual([secondId]);
  }
  const result = await call<{ tags: { name: string; count: number }[] }>(h.core, "listTags");
  expect(result.tags).toContainEqual({ name: "工作/项目", count: 1 });
  expect(result.tags).toContainEqual({ name: "工作", count: 1 });
});

it("uses filename titles and renames without changing identity", async () => {
  const h = await open();
  const id = "dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  let page = await call<Note>(h.core, "saveNote", { id, title: "", body: "", tags: [], baseHash: null });
  expect(page.title).toBe("新内容"); expect(page.body).toBe("");
  for (const [title, body] of [["只有标题", ""], ["", "只有正文"], ["", ""]]) {
    page = await call<Note>(h.core, "saveNote", { id, title, body, tags: [], baseHash: page.contentHash });
    expect(page).toMatchObject({ id, title: title || "新内容", body, relativePath: `notes/${title || "新内容"}.md` });
    expect(await call<Note>(h.core, "getNote", { id })).toMatchObject({ title: title || "新内容", body });
  }
});

it.each([true, false])('keeps body-only notes unnamed until a title is entered (legacy: %s)', async legacy => {
  const root = legacy ? await fixture() : new TestDirectory('plain'), h = harness(root);
  await call(h.core, 'selectVault');
  let page = await call<Note>(h.core, 'saveNote', { id: secondId, title: '', body: '# 正文标题\n\n正文', tags: [], inheritedTags: ['work'], baseHash: null });
  const path = `${legacy ? 'notes/' : ''}新内容.md`;
  expect(page).toMatchObject({ title: '新内容', relativePath: path, tags: ['work'] });
  const duplicate = await call<Note>(h.core, 'saveNote', { id: createId(), title: '', body: '另一条正文', tags: [], baseHash: null });
  expect(duplicate).toMatchObject({ title: '新内容 (2)', relativePath: `${legacy ? 'notes/' : ''}新内容 (2).md` });
  expect(await call<Note>(h.core, 'saveNote', { id: duplicate.id, title: duplicate.title, body: '继续写另一条正文', tags: [], baseHash: duplicate.contentHash })).toMatchObject({ title: '新内容 (2)', relativePath: duplicate.relativePath });
  page = await call<Note>(h.core, 'saveNote', { id: secondId, body: '修改正文', tags: [], baseHash: page.contentHash });
  expect(page).toMatchObject({ title: '新内容', relativePath: path, body: '修改正文' });
  const reopened = harness(root, h.storage);
  expect(await call<Note>(reopened.core, 'getNote', { id: secondId })).toMatchObject({ title: '新内容', relativePath: path });
  page = await call<Note>(reopened.core, 'saveNote', { id: secondId, title: '手动标题', body: page.body, tags: [], baseHash: page.contentHash });
  expect(page).toMatchObject({ id: secondId, title: '手动标题', relativePath: `${legacy ? 'notes/' : ''}手动标题.md`, body: '修改正文', tags: ['work'] });
  page = await call<Note>(reopened.core, 'saveNote', { id: secondId, body: '再次修改正文', tags: [], baseHash: page.contentHash });
  expect(page).toMatchObject({ title: '手动标题', relativePath: `${legacy ? 'notes/' : ''}手动标题.md` });
});

it('renames with collision suffix, updates references, preserves properties and stable identity after reopen', async () => {
  const root = new TestDirectory('rename'), h = harness(root);
  const original = '---\r\ntitle: independent\r\ncustom: keep\r\n---\r\n# Heading\n[[Old]]';
  root.children.set('Old.md', new TestFile('Old.md', original));
  root.children.set('New.md', new TestFile('New.md', 'occupied'));
  root.children.set('Ref.md', new TestFile('Ref.md', '[[Old#Heading|alias]] [text](Old.md) `[[Old]]`'));
  await call(h.core, 'selectVault');
  const note = (await call<NotePage>(h.core, 'queryNotes')).notes.find(note => note.title === 'Old')!;
  const saved = await call<Note>(h.core, 'saveNote', { ...save(note, note.body), title: 'New' });
  expect(saved.relativePath).toBe('New (2).md'); expect(saved.title).toBe('New (2)'); expect(saved.id).toBe(note.id);
  expect((await root.getFileHandle(saved.relativePath)).text).toBe(original.replace('[[Old]]', '[[New (2)]]'));
  expect((await root.getFileHandle('Ref.md')).text).toBe('[[New (2)#Heading|alias]] [text](New%20%282%29.md) `[[Old]]`');
  expect(root.children.has('Old.md')).toBe(false);
  const reopened = harness(root, h.storage);
  expect((await call<Note>(reopened.core, 'getNote', { id: note.id })).relativePath).toBe(saved.relativePath);
  await expect(call(h.core, 'saveNote', { ...save(note), title: 'Stale' })).rejects.toMatchObject({ code: 'HASH_CONFLICT' });
});

it('recovers an interrupted rename before scanning and preserves external edits', async () => {
  const h = await open();
  const scope = `${h.storage.selection!.directoryId}:${h.storage.selection!.vaultId}`;
  // Legacy scopes have no identity records; derive the journal scope from the saved draft key prefix.
  const note = await call<Note>(h.core, 'getNote', { id: noteId });
  await call(h.core, 'saveDraft', save(note));
  const draftScope = scope;
  const before = (await h.notes.getFileHandle(`${noteId}.md`)).text;
  h.notes.children.set('New.md', new TestFile('New.md', before));
  await h.storage.saveRenameJournal(draftScope, { identities: [], changes: [{ path: 'notes/New.md', before: null, after: before }, { path: note.relativePath, before, after: null }] });
  expect((await call<NotePage>(h.core, 'queryNotes')).notes).toHaveLength(1);
  expect(h.notes.children.has('New.md')).toBe(false);
  h.notes.children.set('New.md', new TestFile('New.md', 'external'));
  await h.storage.saveRenameJournal(draftScope, { identities: [], changes: [{ path: 'notes/New.md', before: null, after: before }] });
  await expect(call(h.core, 'queryNotes')).rejects.toMatchObject({ code: 'RENAME_RECOVERY_REQUIRED' });
  expect((await h.notes.getFileHandle('New.md')).text).toBe('external');
});

it('rolls back an unsuccessful staged rename without deleting the source', async () => {
  const h = await open();
  const original = (await h.notes.getFileHandle(`${noteId}.md`)).text;
  h.notes.createdFile = file => { if (file.name === 'Renamed.md') file.closeError = true; };
  const note = await call<Note>(h.core, 'getNote', { id: noteId });
  await expect(call(h.core, 'saveNote', { ...save(note, note.body), title: 'Renamed' })).rejects.toBeDefined();
  expect((await h.notes.getFileHandle(`${noteId}.md`)).text).toBe(original);
  expect(h.notes.children.has('Renamed.md')).toBe(false);
  expect(h.storage.journals.size).toBe(0);
  expect((await call<{ drafts: BrowserDraft[] }>(h.core, 'getDrafts')).drafts[0].title).toBe('Renamed');
});

it('persists property display names per vault without rewriting any note and detects config conflicts', async () => {
 const h=await open();
 const first=await h.notes.getFileHandle(`${noteId}.md`); first.bytes=bytes(source(noteId,'First','summary: One\n'));
 const second=await h.notes.getFileHandle(`${secondId}.md`,{create:true}); second.bytes=bytes(source(secondId,'Second','summary: Two\n'));
 const originals=[first.text,second.text];
 const initial=await call<PropertyLabels>(h.core,'getPropertyLabels');
 let labels=await call<PropertyLabels>(h.core,'renamePropertyLabel',{key:'system:tags',label:'分类',baseHash:initial.contentHash});
 labels=await call<PropertyLabels>(h.core,'renamePropertyLabel',{key:'property:summary',label:'摘要',baseHash:labels.contentHash});
 expect(labels.labels).toEqual({'system:tags':'分类','property:summary':'摘要'});
 expect([first.text,second.text]).toEqual(originals);
 await expect(call(h.core,'renamePropertyLabel',{key:'system:createdAt',label:'时间',baseHash:initial.contentHash})).rejects.toMatchObject({code:'HASH_CONFLICT'});
 for (const [key,label] of [['system:createdAt','摘要'],['system:createdAt','文件名'],['system:createdAt',' '],['property:missing','缺失']]) await expect(call(h.core,'renamePropertyLabel',{key,label,baseHash:labels.contentHash})).rejects.toMatchObject({code:'INVALID_PROPERTY'});
 const reopened=harness(h.root,h.storage);
 expect(await call(reopened.core,'getPropertyLabels')).toEqual(labels);
 const other=await open(await fixture('other','33333333-3333-4333-8333-333333333333'));
 expect((await call<PropertyLabels>(other.core,'getPropertyLabels')).labels).toEqual({});
 const config=await (await h.root.getDirectoryHandle('.memocard')).getFileHandle('property-labels.json');
 config.closeError=true;
 await expect(call(h.core,'renamePropertyLabel',{key:'system:createdAt',label:'时间',baseHash:labels.contentHash})).rejects.toBeTruthy();
 expect(await call(h.core,'getPropertyLabels')).toEqual(labels);
 config.closeError=false; config.bytes=bytes('{broken');
 await expect(call(h.core,'getPropertyLabels')).rejects.toMatchObject({code:'INVALID_PROPERTY'});
 expect(config.text).toBe('{broken');
});

it.each([false,true])('persists property order and visibility without rewriting notes or timestamps (shared=%s)', async shared => {
 const root=shared ? new TestDirectory('Shared') : await fixture();
 const notes=shared ? root : await root.getDirectoryHandle('notes');
 if (shared) notes.children.set('Original.md',new TestFile('Original.md','---\nsummary: First\n---\nBody'));
 const h=harness(root); await call(h.core,'selectVault');
 const page=await call<NotePage>(h.core,'queryNotes');
 const before=page.notes.map(note=>({...note}));
 const files=await Promise.all(page.notes.map(async note => {
   let directory=root; const parts=note.relativePath.split('/');
   for (const part of parts.slice(0,-1)) directory=await directory.getDirectoryHandle(part);
   return (await directory.getFileHandle(parts.at(-1)!)).text;
 }));
 const initial=await call<PropertyLayout>(h.core,'getPropertyLayout');
 expect(initial).toEqual({order:[],visibility:{},contentHash:createHash('sha256').update('').digest('hex')});
 const settings={order:['property:unseen','system:filename','system:tags'],visibility:{'property:summary':'hide-empty','system:updatedAt':'hidden','property:unseen':'always'}};
 const saved=await call<PropertyLayout>(h.core,'setPropertyLayout',{...settings,baseHash:initial.contentHash});
 expect(saved).toEqual({...settings,contentHash:expect.any(String)});
 expect((await call<VaultStatus>(h.core,'getStatus')).capabilities).toEqual(expect.arrayContaining(['getPropertyLayout','setPropertyLayout']));
 expect((await call<NotePage>(h.core,'queryNotes')).notes).toEqual(before);
 for (const [index,note] of page.notes.entries()) {
   let directory=root; const parts=note.relativePath.split('/');
   for (const part of parts.slice(0,-1)) directory=await directory.getDirectoryHandle(part);
   expect((await directory.getFileHandle(parts.at(-1)!)).text).toBe(files[index]);
 }
 const reopened=harness(root,h.storage); await call(reopened.core,'selectVault');
 expect(await call(reopened.core,'getPropertyLayout')).toEqual(saved);
 expect(await call(reopened.core,'setPropertyLayout',{...settings,baseHash:saved.contentHash})).toEqual(saved);
 const other=await fixture('Other','33333333-3333-4333-8333-333333333333');
 h.choose(other); await call(h.core,'selectVault');
 expect(await call(h.core,'getPropertyLayout')).toMatchObject({order:[],visibility:{}});
 await expect(call(h.core,'setPropertyLayout',{...settings,baseHash:initial.contentHash,vaultId})).rejects.toMatchObject({code:'VAULT_CHANGED'});
});

it('rejects stale layout writes, invalid settings and malformed configuration without overwriting it', async () => {
 const h=await open();
 const initial=await call<PropertyLayout>(h.core,'getPropertyLayout');
 const saved=await call<PropertyLayout>(h.core,'setPropertyLayout',{order:['system:tags'],visibility:{'system:tags':'always'},baseHash:initial.contentHash});
 await expect(call(h.core,'setPropertyLayout',{order:[],visibility:{},baseHash:initial.contentHash})).rejects.toMatchObject({code:'HASH_CONFLICT'});
 for (const next of [
   {order:['system:tags','system:tags'],visibility:{}},
   {order:['unknown'],visibility:{}}, {order:[],visibility:{'system:tags':'never'}},
   {order:[],visibility:JSON.parse('{"__proto__":"hidden"}')},
 ]) await expect(call(h.core,'setPropertyLayout',{...next,baseHash:saved.contentHash})).rejects.toMatchObject({code:'INVALID_PROPERTY_LAYOUT'});
 const file=await (await h.root.getDirectoryHandle('.memocard')).getFileHandle('property-layout.json');
 file.bytes=bytes('{broken');
 await expect(call(h.core,'getPropertyLayout')).rejects.toMatchObject({code:'INVALID_PROPERTY_LAYOUT'});
 await expect(call(h.core,'setPropertyLayout',{order:[],visibility:{},baseHash:createHash('sha256').update('{broken').digest('hex')})).rejects.toMatchObject({code:'INVALID_PROPERTY_LAYOUT'});
 expect(file.text).toBe('{broken');
});

it('preserves layout settings on failed close and can retry an interrupted first file creation', async () => {
 const h=await open();
 const initial=await call<PropertyLayout>(h.core,'getPropertyLayout');
 const directory=await h.root.getDirectoryHandle('.memocard');
 directory.createdFile=file=>{if(file.name==='property-layout.json')file.closeError=true;};
 const settings={order:['system:tags'],visibility:{'system:filename':'hidden'},baseHash:initial.contentHash};
 await expect(call(h.core,'setPropertyLayout',settings)).rejects.toBeTruthy();
 const file=await directory.getFileHandle('property-layout.json');
 expect(file.text).toBe('');expect(await call(h.core,'getPropertyLayout')).toEqual(initial);
 file.closeError=false;
 const saved=await call<PropertyLayout>(h.core,'setPropertyLayout',settings);
 file.closeError=true;
 await expect(call(h.core,'setPropertyLayout',{order:[],visibility:{},baseHash:saved.contentHash})).rejects.toBeTruthy();
 expect(await call(h.core,'getPropertyLayout')).toEqual(saved);
});

it.each(['bytes','file','directory','vault'])('aborts a staged layout write when %s changes before commit', async change => {
 const h=await open();
 const initial=await call<PropertyLayout>(h.core,'getPropertyLayout');
 const saved=await call<PropertyLayout>(h.core,'setPropertyLayout',{order:['system:tags'],visibility:{},baseHash:initial.contentHash});
 const directory=await h.root.getDirectoryHandle('.memocard');
 const file=await directory.getFileHandle('property-layout.json');
 const original=file.text;
 const external=JSON.stringify({order:['system:filename'],visibility:{}});
 const other=await fixture('Other','33333333-3333-4333-8333-333333333333');
 file.writeHook=async()=>{
   if(change==='bytes')file.bytes=bytes(external);
   if(change==='file')directory.children.set(file.name,new TestFile(file.name,original));
   if(change==='directory') {
     const replacement=new TestDirectory('.memocard');
     replacement.children.set('vault.json',await directory.getFileHandle('vault.json'));
     replacement.children.set(file.name,new TestFile(file.name,original));
     h.root.children.set('.memocard',replacement);
   }
   if(change==='vault') {h.choose(other);await call(h.core,'selectVault');}
 };
 await expect(call(h.core,'setPropertyLayout',{order:['system:createdAt'],visibility:{},baseHash:saved.contentHash})).rejects.toMatchObject({code:change==='vault'?'UNAUTHORIZED':'HASH_CONFLICT'});
 expect(file.text).toBe(change==='bytes'?external:original);
 expect(file.writable).toBe(false);
});

it('shares property labels for Obsidian notes while preserving YAML and individual values', async () => {
 const root=new TestDirectory('shared');
 const a=new TestFile('A.md','---\r\nsummary: One # keep\r\n---\r\nFirst');
 const b=new TestFile('B.md','---\nsummary: Two\n---\nSecond');
 root.children.set(a.name,a); root.children.set(b.name,b);
 const h=harness(root); await call(h.core,'selectVault');
 const initial=await call<PropertyLabels>(h.core,'getPropertyLabels');
 const saved=await call<PropertyLabels>(h.core,'renamePropertyLabel',{key:'property:summary',label:'摘要',baseHash:initial.contentHash});
 expect(saved.labels).toEqual({'property:summary':'摘要'});
 expect(a.text).toBe('---\r\nsummary: One # keep\r\n---\r\nFirst'); expect(b.text).toBe('---\nsummary: Two\n---\nSecond');
 const reopened=harness(root,h.storage); await call(reopened.core,'selectVault');
 expect(await call(reopened.core,'getPropertyLabels')).toEqual(saved);
});

it.each([false,true])('synchronizes property types and option definitions across the vault (shared=%s)',async shared => {
 const root=shared ? new TestDirectory('shared') : await fixture();
 const notes=shared ? root : await root.getDirectoryHandle('notes');
 const choice=(name:string,color:string)=>`field: "${name}" # memocard:choice=${JSON.stringify({type:'select',options:[{name,color}]})}\n`;
 const text=(id:string,field:string,body:string)=>shared ? `---\n${field}other: keep\n---\n${body}` : source(id,body,field+'other: keep\n');
 const a=await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true});a.bytes=bytes(text(noteId,choice('设计','blue'),'Body A'));
 const b=await notes.getFileHandle(shared ? 'B.md' : `${secondId}.md`,{create:true});b.bytes=bytes(text(secondId,choice('开发','green'),'Body B'));
 const c=await notes.getFileHandle('Unrelated.md',{create:true});c.bytes=bytes(text('11111111-1111-4111-8111-111111111113','unrelated: keep\n','Unrelated'));
 const untouched=c.text;
 const h=harness(root);await call(h.core,'selectVault');
 const page=await call<NotePage>(h.core,'queryNotes');
 const aid=page.notes.find(note=>note.relativePath.endsWith(a.name))!.id,bid=page.notes.find(note=>note.relativePath.endsWith(b.name))!.id;
 const get=async(id:string)=>call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id});
 let fields=await get(aid), options=fields.properties.find(p=>p.name==='field')!.options!;
 expect(options).toEqual([{name:'设计',color:'blue'},{name:'开发',color:'green'}]);
 const change=async(type:string,nextOptions:unknown[],value:string[],extra={})=>{
  const note=await call<Note>(h.core,'getNote',{id:aid});
  const fields=await get(aid);
  return call<Note>(h.core,'updateNoteProperty',{id:aid,baseHash:note.contentHash,name:'field',type,options:nextOptions,value,definition:true,definitionHash:fields.definitionHash,...extra});
 };
 const staleB=await call<Note>(h.core,'getNote',{id:bid});
 const staleDefinition=fields.definitionHash;
 await change('multiSelect',options,['设计']);
 expect((await get(aid)).properties.find(p=>p.name==='field')).toMatchObject({type:'multiSelect',value:['设计']});
 expect((await get(bid)).properties.find(p=>p.name==='field')).toMatchObject({type:'multiSelect',value:['开发']});
 await expect(call(h.core,'updateNoteProperty',{id:bid,baseHash:staleB.contentHash,name:'field',type:'multiSelect',options,value:[]})).rejects.toMatchObject({code:'HASH_CONFLICT'});
 const freshB=await call<Note>(h.core,'getNote',{id:bid});
 await expect(call(h.core,'updateNoteProperty',{id:bid,baseHash:freshB.contentHash,definitionHash:staleDefinition,name:'field',type:'multiSelect',options,value:[]})).rejects.toMatchObject({code:'HASH_CONFLICT'});
 options=[{name:'设计',color:'purple'},{name:'开发',color:'green'}] as typeof options;
 await change('multiSelect',options,['设计']);
 expect((await get(bid)).properties.find(p=>p.name==='field')!.options).toEqual(options);
 options=[{name:'设计',color:'purple'},{name:'工程',color:'green'}] as typeof options;
 await change('multiSelect',options,['设计'],{optionRename:{from:'开发',to:'工程'}});
 expect((await get(bid)).properties.find(p=>p.name==='field')!.value).toEqual(['工程']);
 await change('multiSelect',[options[1]],[]);
 expect((await get(aid)).properties.find(p=>p.name==='field')!.value).toEqual([]);
 expect((await get(bid)).properties.find(p=>p.name==='field')!.value).toEqual(['工程']);
 await change('multiSelect',[options[1],{name:'写作',color:'blue'}],['写作']);
 const currentB=await call<Note>(h.core,'getNote',{id:bid}); fields=await get(bid);
 await call(h.core,'updateNoteProperty',{id:bid,baseHash:currentB.contentHash,name:'field',type:'multiSelect',value:[],options:fields.properties.find(p=>p.name==='field')!.options,definitionHash:fields.definitionHash});
 expect((await get(aid)).properties.find(p=>p.name==='field')!.value).toEqual(['写作']);
 expect((await get(bid)).properties.find(p=>p.name==='field')!.value).toEqual([]);
 expect((await call<Note>(h.core,'getNote',{id:aid})).body).toBe('Body A');
 expect((await get(bid)).properties.find(p=>p.name==='other')!.value).toBe('keep');
 expect(c.text).toBe(untouched);
 const reopened=harness(root,h.storage);await call(reopened.core,'selectVault');
 expect((await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:bid})).properties.find(p=>p.name==='field')).toMatchObject({type:'multiSelect',value:[],options:[options[1],{name:'写作',color:'blue'}]});
 const unrelatedNote=(await call<NotePage>(h.core,'queryNotes')).notes.find(note=>note.relativePath.endsWith(c.name))!;
 await call(h.core,'updateNoteProperty',{id:unrelatedNote.id,baseHash:unrelatedNote.contentHash,name:'field',type:'multiSelect',value:[],options:[],create:true});
 expect((await get(unrelatedNote.id)).properties.find(p=>p.name==='field')!.options).toEqual([options[1],{name:'写作',color:'blue'}]);
});
it('preserves mixed source types while creating a shared multi-select definition',async()=>{
 const h=await open(), a=await h.notes.getFileHandle(`${noteId}.md`), b=await h.notes.getFileHandle(`${secondId}.md`,{create:true});
 a.bytes=bytes(source(noteId,'A','field: One # memocard:choice={"type":"select","options":[{"name":"One","color":"blue"}]}\n'));
 b.bytes=bytes(source(secondId,'B','field: Two\n'));
 const note=await call<Note>(h.core,'getNote',{id:noteId});
 await call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'field',type:'multiSelect',definition:true});
 const fields=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:secondId});
 expect(fields.properties.find(p=>p.name==='field')!.value).toEqual(['Two']);
});
it('retains list values beyond the choice menu option limit',async()=>{
 const h=await open(), a=await h.notes.getFileHandle(`${noteId}.md`);
 a.bytes=bytes(source(noteId,'A',`field: ${JSON.stringify(Array.from({length:201},(_,i)=>`Option ${i}`))}\n`));
 const original=a.text,note=await call<Note>(h.core,'getNote',{id:noteId});
 await call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'field',type:'multiSelect',definition:true});
 const fields=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:noteId});
 expect(fields.properties.find(p=>p.name==='field')!.value).toEqual(Array.from({length:201},(_,i)=>`Option ${i}`));
 expect(a.text.split('---\n').at(-1)).toBe(original.split('---\n').at(-1));
});
it.each([
 ['date','field: 2026-10-12\n','field: important-beta\n'],
 ['checkbox','field: true\n','field: important-beta\n'],
 ['select','field: [One]\n','field: [One, Two]\n'],
])('rejects lossy %s conversion without touching any note or definition',async(type,first,second)=>{
 const h=await open(), a=await h.notes.getFileHandle(`${noteId}.md`), b=await h.notes.getFileHandle(`${secondId}.md`,{create:true});
 a.bytes=bytes(source(noteId,'A',first));b.bytes=bytes(source(secondId,'B',second));
 const originals=[a.text,b.text],note=await call<Note>(h.core,'getNote',{id:noteId});
 await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'field',type,definition:true})).rejects.toMatchObject({code:'LOSSY_PROPERTY_CONVERSION'});
 expect([a.text,b.text]).toEqual(originals);
 expect((await h.root.getDirectoryHandle('.memocard')).children.has('property-definitions.json')).toBe(false);
});
it('rolls back every note and the definition when a batch write fails',async()=>{
 const h=await open(), a=await h.notes.getFileHandle(`${noteId}.md`), b=await h.notes.getFileHandle(`${secondId}.md`,{create:true});
 a.bytes=bytes(source(noteId,'A','field: One\n'));b.bytes=bytes(source(secondId,'B','field: Two\n'));
 const originals=[a.text,b.text];
 const note=await call<Note>(h.core,'getNote',{id:noteId});
 b.closeError=true;
 await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'field',type:'multiSelect',value:['One'],definition:true})).rejects.toBeTruthy();
 b.closeError=false;
 expect([a.text,b.text]).toEqual(originals);
 expect((await h.root.getDirectoryHandle('.memocard')).children.has('property-definitions.json')).toBe(false);
 expect((await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:noteId})).properties.find(p=>p.name==='field')!.type).toBe('text');
});
it('rejects a batch containing an unsupported property without any partial updates',async()=>{
 const h=await open(), a=await h.notes.getFileHandle(`${noteId}.md`), b=await h.notes.getFileHandle(`${secondId}.md`,{create:true});
 a.bytes=bytes(source(noteId,'A','field: One\n'));b.bytes=bytes(source(secondId,'B','field: {nested: Two}\n'));
 const originals=[a.text,b.text], note=await call<Note>(h.core,'getNote',{id:noteId});
 await expect(call(h.core,'updateNoteProperty',{id:noteId,baseHash:note.contentHash,name:'field',type:'multiSelect',value:['One'],definition:true})).rejects.toMatchObject({code:'INVALID_PROPERTY'});
 expect([a.text,b.text]).toEqual(originals);
});

it.each([false,true])('inherits library fields on first save, with empty values and shared options (shared=%s)',async shared => {
 const root=shared ? new TestDirectory('shared') : await fixture();
 const notes=shared ? root : await root.getDirectoryHandle('notes');
 const extra='summary: Existing\naliases: [One]\nwhen: 2026-10-11\nchecked: true\nchoice: One # memocard:choice={"type":"select","options":[{"name":"One","color":"purple"}]}\nmultiple: [One] # memocard:choice={"type":"multiSelect","options":[{"name":"One","color":"blue"}]}\nadvanced: {nested: keep}\n';
 const a=await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true});
 a.bytes=bytes(shared ? `---\n${extra}---\nBody A` : source(noteId,'Body A',extra));
 const h=harness(root);await call(h.core,'selectVault');
 const before=a.text,count=notes.children.size;
 const config=await (await root.getDirectoryHandle('.memocard')).getFileHandle('property-definitions.json',{create:true});
 config.bytes=bytes(JSON.stringify({choice:{type:'multiSelect',options:[{name:'Shared','color':'green'}]},registered:{type:'text'}}));
 const preview=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties');
 expect(preview.properties.map(p=>[p.name,p.type,p.value])).toEqual([
  ['aliases','multiSelect',[]],['checked','checkbox',false],['choice','multiSelect',[]],['multiple','multiSelect',[]],['registered','text',''],['summary','text',''],['when','date','']
 ]);
 expect(preview.properties.find(p=>p.name==='choice')!.options).toEqual([{name:'Shared',color:'green'}]);
 expect(a.text).toBe(before);expect(notes.children.size).toBe(count);
 const saved=await call<Note>(h.core,'saveNote',{id:secondId,body:'New content',tags:[],baseHash:null});
 const fields=await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:saved.id});
 expect(fields.properties).toEqual(preview.properties);
 expect(saved.body).toBe('New content');expect(a.text).toBe(before);
 const reopened=harness(root,h.storage);await call(reopened.core,'selectVault');
 expect((await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:saved.id})).properties).toEqual(preview.properties);
 // Later body saves keep inherited type metadata and the note's own values.
 await call(h.core,'saveNote',{id:saved.id,body:'Edited',tags:[],baseHash:saved.contentHash});
 expect((await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:saved.id})).properties).toEqual(preview.properties);
});
it.each([false,true])('shows missing library fields without writing them and saves only edited values (shared=%s)',async shared => {
 const root=shared ? new TestDirectory('shared') : await fixture();
 const notes=shared ? root : await root.getDirectoryHandle('notes');
 const a=await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true});
 const b=await notes.getFileHandle(shared ? 'B.md' : `${secondId}.md`,{create:true});
 a.bytes=bytes(shared ? '---\nsummary: Original\n---\nBody A' : source(noteId,'Body A','summary: Original\n'));
 b.bytes=bytes(shared ? 'Body B' : source(secondId,'Body B'));
 const config=await (await root.getDirectoryHandle('.memocard',{create:true})).getFileHandle('property-definitions.json',{create:true});
 config.bytes=bytes(JSON.stringify({choice:{type:'select',options:[{name:'One',color:'blue'}]},checked:{type:'checkbox'},when:{type:'date'}}));
 const h=harness(root);await call(h.core,'selectVault');
 const page=await call<NotePage>(h.core,'queryNotes'), aid=page.notes.find(n=>n.body==='Body A')!.id,bid=page.notes.find(n=>n.body==='Body B')!.id;
 const original=[a.text,b.text];
 const get=async(id=bid)=>call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id});
 let fields=await get();
 expect(fields.properties.map(p=>[p.name,p.type,p.value])).toEqual([['checked','checkbox',false],['choice','select',''],['summary','text',''],['when','date','']]);
 expect((await get(aid)).properties.find(p=>p.name==='summary')!.value).toBe('Original');
 expect([a.text,b.text]).toEqual(original);
 let note=await call<Note>(h.core,'getNote',{id:bid});
 note=await call<Note>(h.core,'saveNote',{id:bid,body:'Edited body',tags:[],baseHash:note.contentHash});
 expect(b.text).not.toMatch(/summary:|choice:|checked:|when:/);
 const change=async(change:Record<string,unknown>)=>{
  fields=await get();note=await call<Note>(h.core,'getNote',{id:bid});
  return call<import('@memocard/contracts').PropertyUpdateResult>(h.core,'updateNoteProperty',{id:bid,baseHash:note.contentHash,definitionHash:fields.definitionHash,...change});
 };
 // Changing options for a virtual field must not create an empty source field.
 const beforeOptions=b.text;
 await change({name:'choice',type:'select',value:'',options:[{name:'One',color:'purple'}],definition:true});
 expect(b.text).toBe(beforeOptions);
 await change({name:'summary copy',type:'text',value:'',create:true,copyFrom:'summary'});
 expect(b.text).toContain('"summary copy": ""');expect(b.text).not.toContain('"summary":');
 const result=await change({name:'choice',type:'select',value:'One',options:[{name:'One',color:'purple'}]});
 expect(result.propertyData).toEqual(await get());
 expect(b.text).toContain('"choice": "One"');expect(b.text).not.toMatch(/summary"?:|checked"?:|when"?:/);
 expect(a.text).toBe(original[0]);
 await change({name:'when',type:'date',value:'2026-10-13'});
 await change({name:'checked',type:'checkbox',value:true});
 expect((await get()).properties.find(p=>p.name==='when')!.value).toBe('2026-10-13');
 expect((await get()).properties.find(p=>p.name==='checked')!.value).toBe(true);
 await change({name:'choice',remove:true});
 expect((await get()).properties.some(p=>p.name==='choice')).toBe(false);
 const cleared=b.text;await expect(change({name:'choice',remove:true})).rejects.toMatchObject({code:'INVALID_PROPERTY'});expect(b.text).toBe(cleared);
 await change({name:'new field',type:'text',value:'Value',create:true});
 expect((await get(aid)).properties.find(p=>p.name==='new field')!.value).toBe('');
 expect(a.text).toBe(original[0]);
 const reopened=harness(root,h.storage);await call(reopened.core,'selectVault');
 expect((await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:bid})).properties).toEqual((await get()).properties);
});
it.each([false,true])('deletes a library field from every note and the schema, including from a virtual row (shared=%s)',async shared => {
 const root=shared ? new TestDirectory('shared') : await fixture(), notes=shared ? root : await root.getDirectoryHandle('notes');
 const cId='11111111-1111-4111-8111-111111111113';
 const files=await Promise.all((shared ? ['A','B','C'] : [noteId,secondId,cId]).map(name=>notes.getFileHandle(`${name}.md`,{create:true})));
 for (const [index,file] of files.entries()) file.bytes=bytes(shared ? `---\n${index<2 ? `field: Value ${index}\n` : ''}keep: Keep\n---\nBody ${index}` : source([noteId,secondId,cId][index],`Body ${index}`,`${index<2 ? `field: Value ${index}\n` : ''}keep: Keep\n`));
 const config=await (await root.getDirectoryHandle('.memocard',{create:true})).getFileHandle('property-definitions.json',{create:true});
 config.bytes=bytes(JSON.stringify({field:{type:'text'},onlySchema:{type:'date'},keep:{type:'text'}}));
 const h=harness(root);await call(h.core,'selectVault');
 const page=await call<NotePage>(h.core,'queryNotes'), c=page.notes.find(n=>n.body==='Body 2')!, b=page.notes.find(n=>n.body==='Body 1')!;
 const get=async(id=c.id)=>call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id});
 const before=files[2].text, fields=await get(), staleHash=fields.definitionHash;
 expect(fields.properties.find(p=>p.name==='field')!.value).toBe('');
 const result=await call<import('@memocard/contracts').PropertyUpdateResult>(h.core,'updateNoteProperty',{id:c.id,baseHash:c.contentHash,definitionHash:staleHash,name:'field',remove:true});
 expect(result.propertyData).toEqual(await get());
 for (const note of page.notes) {
  const data=await get(note.id);expect(data.properties.some(p=>p.name==='field')).toBe(false);
  expect(data.properties.find(p=>p.name==='keep')!.value).toBe('Keep');
 }
 expect(files[2].text).toBe(before);expect(files.every(file=>!file.text.includes('field:'))).toBe(true);
 expect(JSON.parse(config.text)).toEqual({onlySchema:{type:'date'},keep:{type:'text'}});
 const freshB=await call<Note>(h.core,'getNote',{id:b.id});
 await expect(call(h.core,'updateNoteProperty',{id:b.id,baseHash:freshB.contentHash,definitionHash:staleHash,name:'field',type:'text',value:'Stale'})).rejects.toMatchObject({code:'HASH_CONFLICT'});
 await call(h.core,'updateNoteProperty',{id:c.id,baseHash:c.contentHash,definitionHash:(await get()).definitionHash,name:'onlySchema',remove:true});
 expect(files[2].text).toBe(before);expect(JSON.parse(config.text)).toEqual({keep:{type:'text'}});
 expect((await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties')).properties.map(p=>p.name)).toEqual(['keep']);
 const saved=await call<Note>(h.core,'saveNote',{id:'11111111-1111-4111-8111-111111111114',body:'New',tags:[],baseHash:null});
 expect((await get(saved.id)).properties.map(p=>p.name)).toEqual(['keep']);
 const reopened=harness(root,h.storage);await call(reopened.core,'selectVault');
 expect((await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:b.id})).properties.map(p=>p.name)).toEqual(['keep']);
});
it.each([false,true])('rejects readonly library deletion and rolls back a failed batch write (shared=%s)',async shared => {
 const root=shared ? new TestDirectory('shared') : await fixture(), notes=shared ? root : await root.getDirectoryHandle('notes');
 const a=await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true}), b=await notes.getFileHandle(shared ? 'B.md' : `${secondId}.md`,{create:true});
 const noteSource=(id:string,field:string)=>shared ? `---\nfield: ${field}\n---\nBody` : source(id,'Body',`field: ${field}\n`);
 a.bytes=bytes(noteSource(noteId,'One'));b.bytes=bytes(noteSource(secondId,'{nested: keep}'));
 const config=await (await root.getDirectoryHandle('.memocard',{create:true})).getFileHandle('property-definitions.json',{create:true});config.bytes=bytes('{"field":{"type":"text"}}');
 const h=harness(root);await call(h.core,'selectVault');
 const remove=async()=>{
  const note=(await call<NotePage>(h.core,'queryNotes')).notes.find(n=>n.relativePath.endsWith(a.name))!;
  return call(h.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,name:'field',remove:true});
 };
 let originals=[a.text,b.text,config.text];
 await expect(remove()).rejects.toMatchObject({code:'INVALID_PROPERTY'});expect([a.text,b.text,config.text]).toEqual(originals);
 b.bytes=bytes(noteSource(secondId,'Two'));originals=[a.text,b.text,config.text];
 b.closeError=true;await expect(remove()).rejects.toBeTruthy();b.closeError=false;
 expect([a.text,b.text,config.text]).toEqual(originals);
});
it('keeps a new-note draft and creates no file when the shared schema is corrupt',async()=>{
 const h=await open(),count=h.notes.children.size;
 const config=await (await h.root.getDirectoryHandle('.memocard')).getFileHandle('property-definitions.json',{create:true});config.bytes=bytes('{broken');
 await expect(call(h.core,'saveNote',{id:secondId,body:'Retain draft',tags:[],baseHash:null})).rejects.toMatchObject({code:'INVALID_PROPERTY'});
 expect(h.notes.children.size).toBe(count);
 expect((await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts.some(d=>d.id===secondId)).toBe(true);
});

it.each([false,true])('recovers property intents and serializes twenty edits with real file parsing (shared=%s)',async shared => {
  const {EditorSession} = await import('./editor-session');
  const root = shared ? new TestDirectory('shared') : await fixture();
  const folder = shared ? root : await root.getDirectoryHandle('notes');
  const file = await folder.getFileHandle(shared ? 'Queue.md' : `${noteId}.md`,{create:true}) as TestFile;
  file.bytes = bytes(shared ? '---\nsummary: before\nchecked: false\n---\nBody' : source(noteId,'Body','summary: before\nchecked: false\n'));
  let h = harness(root); await call(h.core,'selectVault');
  const note = (await call<NotePage>(h.core,'queryNotes')).notes.find(note=>note.body==='Body')!;
  let fail = true;
  const transport = async <T>(operation:string,params?:Record<string,unknown>):Promise<T> => {
    if (fail && operation === 'updateNoteProperty') throw new Error('模拟服务不可写');
    return call<T>(h.core,operation,params);
  };
  let session = new EditorSession({id:note.id,title:note.title,body:note.body,tags:note.tags,baseHash:note.contentHash},transport,true,()=>undefined,()=>undefined);
  await expect(session.changeProperty({name:'summary',type:'text',value:'recovered'})).rejects.toThrow('模拟服务不可写');
  const reopened = harness(root,h.storage); await call(reopened.core,'selectVault'); h = reopened;
  const draft = (await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts.find(draft=>draft.id===note.id)!;
  expect(draft.pendingProperties?.[0].value).toBe('recovered'); session.dispose();
  fail = false;
  session = new EditorSession(draft,transport,true,()=>undefined,()=>undefined);
  await session.flush();
  const mutations:Promise<void>[] = [];
  for (let index=0; index<20; index++) {
    mutations.push(session.changeProperty({name:'summary',type:'text',value:`edit-${index}`}));
    session.update(`Body ${index}`,undefined,`Queue ${index}`);
  }
  mutations.push(session.changeProperty({name:'checked',type:'checkbox',value:true}));
  await Promise.all(mutations); await session.flush();
  const actual = await call<Note>(h.core,'getNote',{id:note.id});
  const fields = await call<import('@memocard/contracts').NoteProperties>(h.core,'getNoteProperties',{id:note.id});
  expect(actual).toMatchObject({body:'Body 19',title:'Queue 19',contentHash:session.current.baseHash});
  expect(fields.properties.find(property=>property.name==='summary')?.value).toBe('edit-19');
  expect(fields.properties.find(property=>property.name==='checked')?.value).toBe(true);
  expect((await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts.filter(draft=>draft.baseHash || draft.body || draft.title)).toEqual([]);
  expect(session.dirty).toBe(false); session.dispose();
});


it.each([false,true])('persists a single image property through body saves, reopen and inheritance (shared=%s)', async shared => {
  const root = shared ? new TestDirectory('shared') : await fixture();
  const notes = shared ? root : await root.getDirectoryHandle('notes');
  const file = await notes.getFileHandle(shared ? 'A.md' : `${noteId}.md`,{create:true});
  file.bytes = bytes(shared ? '---\nunknown: {nested: value}\n---\nBody #keep' : source(noteId,'Body #keep','unknown: {nested: value}\n'));
  const h = harness(root); await call(h.core,'selectVault');
  let note = (await call<NotePage>(h.core,'queryNotes')).notes.find(note => note.body === 'Body #keep')!;
  note = await call<Note>(h.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,name:'cover',type:'image',value:'',create:true});
  note = await call<Note>(h.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,name:'cover',type:'image',value:'../assets/cover.png'});
  note = await call<Note>(h.core,'saveNote',{id:note.id,baseHash:note.contentHash,body:'Edited #keep',tags:note.tags});
  const reopened = harness(root,h.storage); await call(reopened.core,'selectVault');
  const read = () => call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties',{id:note.id});
  expect((await read()).properties.find(item => item.name === 'cover')).toMatchObject({type:'image',value:'../assets/cover.png'});
  expect(file.text).toContain('nested'); expect(file.text.endsWith('Edited #keep')).toBe(true);
  const inherited = await call<import('@memocard/contracts').NoteProperties>(reopened.core,'getNoteProperties');
  expect(inherited.properties.find(item => item.name === 'cover')).toMatchObject({type:'image',value:''});
  note = await call<Note>(reopened.core,'updateNoteProperty',{id:note.id,baseHash:note.contentHash,name:'cover',type:'image',value:''});
  expect((await read()).properties.find(item => item.name === 'cover')).toMatchObject({type:'image',value:''});
});


it('deletes only the reviewed browser draft and rejects stale revisions and another vault', async()=>{
  const h=harness(await fixture()); await call(h.core,'selectVault');
  const saved=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  const first=await call<BrowserDraft>(h.core,'saveDraft',{id:saved.id,body:'First edit',tags:[],baseHash:saved.contentHash});
  const otherId=createId();
  await call(h.core,'saveDraft',{id:otherId,body:'Other draft',tags:[],baseHash:null});
  const changed=await call<BrowserDraft>(h.core,'saveDraft',{id:saved.id,body:'Newer edit',tags:[],baseHash:saved.contentHash});
  await expect(call(h.core,'deleteDraft',{id:first.id,draftKey:first.draftKey,revision:first.revision})).rejects.toMatchObject({code:'DRAFT_CHANGED'});
  await expect(call(h.core,'deleteDraft',{id:changed.id,draftKey:changed.draftKey,revision:changed.revision,vaultId:'other'})).rejects.toMatchObject({code:'VAULT_CHANGED'});
  expect(await call(h.core,'deleteDraft',{id:changed.id,draftKey:changed.draftKey,revision:changed.revision})).toEqual({deleted:true});
  const remaining=await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts');
  expect(remaining.drafts.map(draft=>draft.id)).toEqual([otherId]);
  expect((await call<Note>(h.core,'getNote',{id:saved.id})).body).toBe(saved.body);
});

it('exposes a stable revision for legacy browser drafts and protects concurrent updates',async()=>{
  const h=harness(await fixture()); await call(h.core,'selectVault');
  const draft=await call<BrowserDraft>(h.core,'saveDraft',{id:createId(),body:'Legacy draft',tags:[],baseHash:null});
  for(const stored of h.storage.records.values())delete stored.revision;
  const {drafts}=await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts');
  expect(drafts[0].revision).toBeTruthy();
  const implementation=h.storage.removeMatchingDraft.bind(h.storage);
  h.storage.removeMatchingDraft=async(scope,reviewed)=>{
    const stored=h.storage.records.get(`${scope}:${reviewed.draftKey}`)!;
    stored.body='Concurrent edit';
    return implementation(scope,reviewed);
  };
  await expect(call(h.core,'deleteDraft',{id:draft.id,draftKey:draft.draftKey,revision:drafts[0].revision})).rejects.toMatchObject({code:'DRAFT_CHANGED'});
  expect((await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts[0].body).toBe('Concurrent edit');
  h.storage.removeMatchingDraft=implementation;
  const fresh=(await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts[0];
  await call(h.core,'deleteDraft',{id:fresh.id,draftKey:fresh.draftKey,revision:fresh.revision});
  expect((await call<{drafts:BrowserDraft[]}>(h.core,'getDrafts')).drafts).toEqual([]);
});


it.each([false,true])('archives exact browser note bytes and excludes them from collections (compatible=%s)',async compatible=>{
  const root=compatible ? new TestDirectory('Shared') : await fixture();
  if(compatible)root.children.set('Raw.md',new TestFile('Raw.md','\ufeff---\r\nid: user-owned\r\ndeletedAt: user-owned\r\ntags: [work]\r\n---\r\nBody\r\n'));
  const h=harness(root);await call(h.core,'selectVault');
  const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  let directory=root;for(const part of note.relativePath.split('/').slice(0,-1))directory=await directory.getDirectoryHandle(part);
  const original=(await directory.getFileHandle(note.relativePath.split('/').at(-1)!)).bytes.slice();
  const pins=await call<NotePins>(h.core,'getNotePins');await call(h.core,'setNotePinned',{id:note.id,pinned:true,baseHash:pins.contentHash});
  await expect(call(h.core,'deleteNote',{id:note.id,baseHash:'wrong'})).rejects.toMatchObject({code:'HASH_CONFLICT'});
  await expect(call(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash,vaultId:'other'})).rejects.toMatchObject({code:'VAULT_CHANGED'});
  const deleted=await call<{trashPath:string}>(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash});
  let archive=root;for(const part of deleted.trashPath.split('/').slice(0,-1))archive=await archive.getDirectoryHandle(part);
  expect((await archive.getFileHandle(deleted.trashPath.split('/').at(-1)!)).bytes).toEqual(original);
  expect((await call<NotePage>(h.core,'queryNotes')).notes).toEqual([]);
  expect((await call<NotePins>(h.core,'getNotePins')).pins).toEqual({});
  expect((await call<{tags:unknown[]}>(h.core,'listTags')).tags).toEqual([]);
  await expect(call(h.core,'getNote',{id:note.id})).rejects.toMatchObject({code:'NOTE_NOT_FOUND'});
  await expect(call(h.core,'saveNote',{id:note.id,body:'Stale save',baseHash:note.contentHash,tags:[]})).rejects.toMatchObject({code:'NOTE_NOT_FOUND'});
});

it('keeps the original browser note if creating its recovery copy fails',async()=>{
  const root=await fixture(),h=harness(root);await call(h.core,'selectVault');
  const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  const write=vi.spyOn(TestFile.prototype,'createWritable').mockRejectedValueOnce(error('NoModificationAllowedError'));
  await expect(call(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash})).rejects.toBeTruthy();
  write.mockRestore();
  expect((await call<Note>(h.core,'getNote',{id:note.id})).contentHash).toBe(note.contentHash);
});


it.each([false,true])('lists, previews and restores exact archived bytes and identity after reopening (compatible=%s)',async compatible=>{
  const root=compatible ? new TestDirectory('Shared') : await fixture();
  if(compatible)root.children.set('Raw.md',new TestFile('Raw.md','\ufeff---\r\ntags: [work]\r\n---\r\nBody ![image](assets/keep.png)\r\n'));
  const h=harness(root);await call(h.core,'selectVault');
  const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  let directory=root;for(const part of note.relativePath.split('/').slice(0,-1))directory=await directory.getDirectoryHandle(part);
  const original=(await directory.getFileHandle(note.relativePath.split('/').at(-1)!)).bytes.slice();
  await call(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash});
  const reopened=harness(root,h.storage);await call(reopened.core,'selectVault');
  const list=await call<import('@memocard/contracts').TrashList>(reopened.core,'getTrash');
  expect(list.notes).toHaveLength(1);expect(list.issues).toEqual([]);const item=list.notes[0];expect(item.id).toBe(note.id);
  expect((await call<import('@memocard/contracts').TrashNote>(reopened.core,'getTrashedNote',{trashKey:item.trashKey})).note.body).toBe(note.body);
  await expect(call(reopened.core,'restoreNote',{trashKey:item.trashKey,baseHash:'stale'})).rejects.toMatchObject({code:'HASH_CONFLICT'});
  await expect(call(reopened.core,'restoreNote',{trashKey:item.trashKey,baseHash:item.contentHash,vaultId:'other'})).rejects.toMatchObject({code:'VAULT_CHANGED'});
  const restored=await call<Note>(reopened.core,'restoreNote',{trashKey:item.trashKey,baseHash:item.contentHash});
  expect(restored.id).toBe(note.id);expect(restored.contentHash).toBe(note.contentHash);
  expect((await directory.getFileHandle(note.relativePath.split('/').at(-1)!)).bytes).toEqual(original);
  expect((await call<import('@memocard/contracts').TrashList>(reopened.core,'getTrash')).notes).toEqual([]);
  expect((await call<Note>(reopened.core,'getNote',{id:note.id})).body).toBe(note.body);
});

it('restores under a new filename without overwriting a same-name file or directory',async()=>{
  const root=new TestDirectory('Shared');root.children.set('Raw.md',new TestFile('Raw.md','Old #work'));
  const h=harness(root);await call(h.core,'selectVault');const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  await call(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash});
  const item=(await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes[0];
  root.children.set('Raw.md',new TestFile('Raw.md','Keep this'));root.children.set('Raw (2).md',new TestDirectory('Raw (2).md'));
  const restored=await call<Note>(h.core,'restoreNote',{trashKey:item.trashKey,baseHash:item.contentHash});
  expect(restored.relativePath).toBe('Raw (3).md');expect((await root.getFileHandle('Raw.md')).text).toBe('Keep this');expect(restored.body).toBe('Old #work');
});

it.each(['journal','identity'])('retains the archive and rolls back restored files on %s write failure',async failure=>{
  const root=new TestDirectory('Shared');root.children.set('Raw.md',new TestFile('Raw.md','Original'));
  const h=harness(root);await call(h.core,'selectVault');const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  await call(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash});
  const item=(await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes[0];
  // Let the scan prune the deleted identity before injecting commit failure.
  await call(h.core,'queryNotes');
  if(failure==='journal')h.storage.failWrites=true;
  const persist=h.storage.saveIdentities.bind(h.storage);
  const spy=failure==='identity' ? vi.spyOn(h.storage,'saveIdentities').mockImplementation(async(scope,items)=>{
    if(items.some(identity=>identity.id===note.id))throw error('QuotaExceededError');await persist(scope,items);
  }) : undefined;
  await expect(call(h.core,'restoreNote',{trashKey:item.trashKey,baseHash:item.contentHash})).rejects.toBeTruthy();
  h.storage.failWrites=false;spy?.mockRestore();expect(root.children.has('Raw.md')).toBe(false);
  expect((await call<import('@memocard/contracts').TrashNote>(h.core,'getTrashedNote',{trashKey:item.trashKey})).note.body).toBe('Original');
  const restored=await call<Note>(h.core,'restoreNote',{trashKey:item.trashKey,baseHash:item.contentHash});expect(restored.id).toBe(note.id);
});

it('supports old metadata-free archives, rejects traversal, and leaves corrupt entries intact',async()=>{
  const root=await fixture(),h=harness(root);await call(h.core,'selectVault');const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  const receipt=await call<{trashPath:string}>(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash});
  const trash=await (await root.getDirectoryHandle('.memocard')).getDirectoryHandle('trash'),entry=await trash.getDirectoryHandle(receipt.trashPath.split('/')[2]);entry.children.delete('entry.json');
  const corrupt=new TestDirectory(createId());corrupt.children.set('Broken.md',new TestFile('Broken.md',new Uint8Array([255])));trash.children.set(corrupt.name,corrupt);
  const list=await call<import('@memocard/contracts').TrashList>(h.core,'getTrash');expect(list.notes).toHaveLength(1);expect(list.issues).toHaveLength(1);
  await expect(call(h.core,'getTrashedNote',{trashKey:createId()+'/../outside.md'})).rejects.toBeTruthy();
  await call(h.core,'restoreNote',{trashKey:list.notes[0].trashKey,baseHash:list.notes[0].contentHash});expect(corrupt.children.has('Broken.md')).toBe(true);
});


it.each([false,true])('permanently deletes only the reviewed browser archive and preserves attachments (compatible=%s)',async compatible=>{
  const root=compatible ? new TestDirectory('Shared') : await fixture();
  if(compatible)root.children.set('Raw.md',new TestFile('Raw.md','Erase this'));
  const h=harness(root);await call(h.core,'selectVault');const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  const other=await call<Note>(h.core,'saveNote',{id:createId(),title:'Other',body:'Keep archive',tags:[],baseHash:null});
  const live=await call<Note>(h.core,'saveNote',{id:createId(),title:'Live',body:'Keep live',tags:[],baseHash:null});
  const assets=await root.getDirectoryHandle('assets',{create:true});assets.children.set('shared.png',new TestFile('shared.png',new Uint8Array([1,2,3])));
  for(const item of [note,other])await call(h.core,'deleteNote',{id:item.id,baseHash:item.contentHash});
  const item=(await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes.find(item=>item.id===note.id)!;
  await expect(call(h.core,'permanentlyDeleteNote',{trashKey:item.trashKey,baseHash:'stale'})).rejects.toMatchObject({code:'HASH_CONFLICT'});
  await expect(call(h.core,'permanentlyDeleteNote',{trashKey:createId()+'/../Live.md',baseHash:item.contentHash})).rejects.toBeTruthy();
  expect(await call(h.core,'permanentlyDeleteNote',{trashKey:item.trashKey,baseHash:item.contentHash})).toEqual({deleted:true});
  expect((await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes.map(item=>item.id)).toEqual([other.id]);
  await expect(call(h.core,'restoreNote',{trashKey:item.trashKey,baseHash:item.contentHash})).rejects.toBeTruthy();
  expect((await call<Note>(h.core,'getNote',{id:live.id})).body).toBe('Keep live');expect((await assets.getFileHandle('shared.png')).bytes).toEqual(new Uint8Array([1,2,3]));
});

it('retains the browser archive when permanent deletion is denied and permits retry',async()=>{
  const h=harness(await fixture());await call(h.core,'selectVault');const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  await call(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash});const item=(await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes[0];
  const spy=vi.spyOn(TestDirectory.prototype,'removeEntry').mockRejectedValueOnce(error('NoModificationAllowedError'));
  await expect(call(h.core,'permanentlyDeleteNote',{trashKey:item.trashKey,baseHash:item.contentHash})).rejects.toBeTruthy();spy.mockRestore();
  expect((await call<import('@memocard/contracts').TrashNote>(h.core,'getTrashedNote',{trashKey:item.trashKey})).note.contentHash).toBe(item.contentHash);
  await call(h.core,'permanentlyDeleteNote',{trashKey:item.trashKey,baseHash:item.contentHash});expect((await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes).toEqual([]);
});

it('settles an interrupted archive transaction before permanent deletion so later scans cannot restore it',async()=>{
  const root=await fixture(),h=harness(root);await call(h.core,'selectVault');const note=(await call<NotePage>(h.core,'queryNotes')).notes[0];
  const receipt=await call<{trashPath:string}>(h.core,'deleteNote',{id:note.id,baseHash:note.contentHash});
  const item=(await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes[0];
  let directory=root;for(const part of receipt.trashPath.split('/').slice(0,-1))directory=await directory.getDirectoryHandle(part);
  const archive=await directory.getFileHandle(receipt.trashPath.split('/').at(-1)!);
  const scope=`${h.storage.selection!.directoryId}:${h.storage.selection!.vaultId}`;
  await h.storage.saveRenameJournal(scope,{identities:[],changes:[{path:receipt.trashPath,before:archive.text,after:null}]});
  await call(h.core,'permanentlyDeleteNote',{trashKey:item.trashKey,baseHash:item.contentHash});
  expect(h.storage.journals.size).toBe(0);
  await call(h.core,'queryNotes');expect((await call<import('@memocard/contracts').TrashList>(h.core,'getTrash')).notes).toEqual([]);
});
