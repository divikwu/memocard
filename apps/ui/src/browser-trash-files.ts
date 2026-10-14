import { BrowserVaultError, canonicalId, safeParts, type BrowserDirectoryHandle } from './browser-files';

export function trashParts(key:string):string[] {
  if(typeof key!=='string')throw new BrowserVaultError('INVALID_TRASH','回收记录标识无效。');
  const [token,...path]=key.split('/');
  canonicalId(token);
  if(!path.length || !/\.md$/i.test(path.at(-1)!))throw new BrowserVaultError('INVALID_TRASH','回收记录标识无效。');
  return [token,...safeParts(path.join('/'),'vault')];
}
export async function trashDirectory(root:BrowserDirectoryHandle,token:string,create=false) {
  canonicalId(token);
  let directory=root;
  for(const name of ['.memocard','trash',token])directory=await directory.getDirectoryHandle(name,{create});
  return directory;
}
export async function trashFile(root:BrowserDirectoryHandle,key:string,create=false) {
  const [token,...parts]=trashParts(key);
  let directory=await trashDirectory(root,token,create);
  for(const name of parts.slice(0,-1))directory=await directory.getDirectoryHandle(name,{create});
  return directory.getFileHandle(parts.at(-1)!,{create});
}
