import type { Note, TrashItem, TrashList, TrashNote, Coverage } from '@memocard/contracts';
import { BrowserVaultError, canonicalId, parseBrowserNote, parseObsidianNote, readBytes, sha256, type BrowserDirectoryHandle, type FileIdentity, type ParsedBrowserNote } from './browser-files';
import { trashDirectory, trashFile, trashParts } from './browser-trash-files';
import type { BrowserVaultStorage } from './browser-storage';
import { commitRename } from './browser-rename';

type Metadata={id:string;relativePath:string;createdAt:string;deletedAt:string};
type Context={root:BrowserDirectoryHandle;vaultId:string;compatible:boolean;active:()=>Promise<unknown>};
const decode=(bytes:Uint8Array)=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
const missing=(cause:unknown)=>cause instanceof Error && cause.name==='NotFoundError';
export async function writeTrashMetadata(root:BrowserDirectoryHandle,token:string,note:Note) {
  const directory=await trashDirectory(root,token),file=await directory.getFileHandle('entry.json',{create:true}),stream=await file.createWritable({mode:'exclusive'});
  try{await stream.write(JSON.stringify({id:note.id,relativePath:note.relativePath,createdAt:note.createdAt,deletedAt:new Date().toISOString()}));await stream.close();}
  catch(cause){await stream.abort().catch(()=>undefined);throw cause;}
}
export async function readTrashedNote(context:Context,key:string):Promise<TrashNote> {
  const [token,...parts]=trashParts(key),relativePath=parts.join('/');
  await context.active();
  const file=await trashFile(context.root,key),bytes=await readBytes(file),directory=await trashDirectory(context.root,token);
  let record:Metadata | undefined;
  try{record=JSON.parse(decode(await readBytes(await directory.getFileHandle('entry.json'))));}
  catch(cause){if(!missing(cause))throw cause;}
  if(record && (canonicalId(record.id)!==record.id || record.relativePath!==relativePath))throw new BrowserVaultError('INVALID_TRASH','回收记录与文件不匹配。');
  const modified=(await file.getFile()).lastModified,deletedAt=record?.deletedAt ?? new Date(modified || 0).toISOString();
  const identity={id:record?.id ?? token,path:relativePath,hash:await sha256(bytes),createdAt:record?.createdAt ?? deletedAt};
  const note=context.compatible ? (await parseObsidianNote(bytes,relativePath,context.vaultId,identity,modified)).note : (await parseBrowserNote(bytes,relativePath,context.vaultId)).note;
  if(record && note.id!==record.id)throw new BrowserVaultError('INVALID_TRASH','回收记录与笔记身份不匹配。');
  await context.active();
  return {trashKey:key,deletedAt,note};
}
export async function getTrash(context:Context):Promise<TrashList> {
  const result:TrashList={notes:[],issues:[]};
  await context.active();
  let directory:BrowserDirectoryHandle;
  try{directory=await (await context.root.getDirectoryHandle('.memocard')).getDirectoryHandle('trash');}
  catch(cause){if(missing(cause))return result;throw cause;}
  async function walk(folder:BrowserDirectoryHandle,prefix='') {
    await context.active();
    for await(const [name,entry] of folder.entries()) {
      if(name.startsWith('.'))continue;
      const key=prefix ? `${prefix}/${name}` : name;
      try {
        if(entry.kind==='directory'){if(!prefix)canonicalId(name);await walk(entry,key);}
        else if(/\.md$/i.test(name)) {
          const value=await readTrashedNote(context,key),note=value.note;
          result.notes.push({trashKey:key,id:note.id,title:note.title,relativePath:note.relativePath,deletedAt:value.deletedAt,contentHash:note.contentHash,preview:note.body.slice(0,200)} satisfies TrashItem);
        }
      } catch{result.issues.push({path:key,message:'此回收记录无法读取，原文件已保留。'});}
    }
  }
  await walk(directory);await context.active();
  result.notes.sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt)||a.trashKey.localeCompare(b.trashKey));
  return result;
}
export async function restoreNote(context:Context,key:string,baseHash:string,storage:BrowserVaultStorage,scope:string,snapshot:{parsed:ParsedBrowserNote[];duplicateIds:Set<string>;coverage:Coverage}):Promise<Note> {
  const value=await readTrashedNote(context,key),bytes=await readBytes(await trashFile(context.root,key));
  if(value.note.contentHash!==baseHash || await sha256(bytes)!==baseHash)throw new BrowserVaultError('HASH_CONFLICT','回收笔记已变化，请刷新后重试。');
  if(!snapshot.coverage.complete)throw new BrowserVaultError('SCAN_INCOMPLETE','笔记库尚未完成校验，请稍后重试。');
  if(snapshot.parsed.some(item=>item.note.id===value.note.id))throw new BrowserVaultError('DUPLICATE_ID','此笔记身份已存在，回收记录已保留。');
  const [, ...parts]=trashParts(key),original=parts.at(-1)!,prefix=parts.slice(0,-1);
  let directory=context.root;
  for(const part of prefix){await context.active();directory=await directory.getDirectoryHandle(part,{create:true});}
  const names=new Set<string>();for await(const [name]of directory.entries())names.add(name.normalize('NFC').toLowerCase());
  let name=original,count=2;
  while(names.has(name.normalize('NFC').toLowerCase()))name=original.replace(/(\.md)$/i,` (${count++})$1`);
  const path=[...prefix,name].join('/'),source=decode(bytes),identity:FileIdentity={id:value.note.id,path,hash:baseHash,createdAt:value.note.createdAt};
  const journal={changes:[{path,before:null,after:source},{path:'.memocard/trash/'+key,before:source,after:null}],identities:await storage.identities(scope)};
  await commitRename(context.root,context.compatible,storage,scope,journal,context.active,false,identity);
  const restored=context.compatible ? await parseObsidianNote(bytes,path,context.vaultId,identity,Date.now()) : await parseBrowserNote(bytes,path,context.vaultId);
  return restored.note;
}

export async function permanentlyDeleteNote(context:Context,key:string,baseHash:string) {
  const [token,...parts]=trashParts(key);
  await context.active();
  const source=await trashFile(context.root,key);
  if(await sha256(await readBytes(source))!==baseHash)throw new BrowserVaultError('HASH_CONFLICT','回收笔记已变化，请刷新后重新确认。');
  let directory=await trashDirectory(context.root,token);
  for(const part of parts.slice(0,-1))directory=await directory.getDirectoryHandle(part);
  await context.active();
  const current=await directory.getFileHandle(parts.at(-1)!);
  if(!await current.isSameEntry(source) || await sha256(await readBytes(current))!==baseHash)throw new BrowserVaultError('HASH_CONFLICT','回收笔记已变化，请刷新后重新确认。');
  await context.active();
  await directory.removeEntry(parts.at(-1)!);
  return {deleted:true};
}
