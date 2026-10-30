import type { PropertyLayout, PropertyLayoutPreferences } from '@memocard/contracts';
import { BrowserVaultError, readBytes, sha256, type BrowserDirectoryHandle } from './browser-files';
import { parsePropertyLayout, validatePropertyLayout } from './property-layout';

async function read(root:BrowserDirectoryHandle) {
  try { return await readBytes(await (await root.getDirectoryHandle('.memocard')).getFileHandle('property-layout.json')); }
  catch (error) { if (error instanceof Error && error.name === 'NotFoundError') return new Uint8Array(); throw error; }
}

export async function propertyLayoutOperation(operation:string, params:Record<string,unknown>, root:BrowserDirectoryHandle, active:()=>Promise<unknown>):Promise<PropertyLayout> {
  await active();
  const before = await read(root), contentHash = await sha256(before);
  let current:PropertyLayoutPreferences;
  try { current = parsePropertyLayout(new TextDecoder('utf-8',{fatal:true}).decode(before)); }
  catch { throw new BrowserVaultError('INVALID_PROPERTY_LAYOUT','属性布局配置无法读取，请检查 .memocard/property-layout.json。'); }
  await active();
  if (operation === 'getPropertyLayout') return {...current,contentHash};
  let next:PropertyLayoutPreferences;
  try { next = validatePropertyLayout({order:params.order,visibility:params.visibility}); }
  catch { throw new BrowserVaultError('INVALID_PROPERTY_LAYOUT','属性布局设置无效。'); }
  if (contentHash !== params.baseHash) throw new BrowserVaultError('HASH_CONFLICT','属性布局已在其他位置修改，请重新打开后重试。',true);
  if (JSON.stringify(current) === JSON.stringify(next)) return {...current,contentHash};
  const bytes = new TextEncoder().encode(JSON.stringify(next));
  const directory = await root.getDirectoryHandle('.memocard',{create:true});
  const file = await directory.getFileHandle('property-layout.json',{create:true});
  const stream = await file.createWritable({mode:'exclusive'});
  try {
    const verify = async () => {
      await active();
      const currentDirectory = await root.getDirectoryHandle('.memocard');
      if (!await currentDirectory.isSameEntry(directory) || !await (await currentDirectory.getFileHandle('property-layout.json')).isSameEntry(file)
        || await sha256(await read(root)) !== contentHash) throw new BrowserVaultError('HASH_CONFLICT','属性布局已在其他位置修改，请重新打开后重试。',true);
    };
    await verify(); await stream.write(bytes); await verify(); await stream.close();
  } catch (error) { await stream.abort().catch(() => undefined); throw error; }
  return {...next,contentHash:await sha256(bytes)};
}
