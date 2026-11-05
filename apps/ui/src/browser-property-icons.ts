import type { PropertyIcons } from '@memocard/contracts';
import { BrowserVaultError, readBytes, sha256, type BrowserDirectoryHandle } from './browser-files';
import { validPropertyKey } from './property-layout';

const filename = 'property-icons.json';
const noteKey = /^note:[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;
const segmenter = new Intl.Segmenter(undefined, {granularity:'grapheme'});
function validKey(key:string) { return noteKey.test(key) || (key !== 'system:filename' && validPropertyKey(key)); }
function validIcon(key:string, icon:unknown): icon is string {
  if (typeof icon !== 'string') return false;
  if (/^icon:[a-z][a-z0-9-]{0,63}$/.test(icon)) return true;
  if (!noteKey.test(key) || !icon.startsWith('emoji:')) return false;
  const emoji = icon.slice(6);
  return emoji.length <= 32 && [...emoji].every(character => character >= ' ' && character !== '\u007f')
    && [...segmenter.segment(emoji)].length === 1
    && [...emoji].some(character => character === '\u20e3' || (character.codePointAt(0)! > 127 && /\p{Emoji}/u.test(character)));
}

async function read(root:BrowserDirectoryHandle) {
  try { return await readBytes(await (await root.getDirectoryHandle('.memocard')).getFileHandle(filename)); }
  catch (error) { if (error instanceof Error && error.name === 'NotFoundError') return new Uint8Array(); throw error; }
}

export async function propertyIconOperation(operation:string, params:Record<string,unknown>, root:BrowserDirectoryHandle, active:()=>Promise<unknown>):Promise<PropertyIcons> {
  await active();
  const bytes = await read(root), contentHash = await sha256(bytes);
  let icons:Record<string,string>;
  try {
    const value:unknown = bytes.length ? JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.entries(value).every(([key,icon]) => validKey(key) && validIcon(key,icon))) throw new Error();
    icons = value as Record<string,string>;
  } catch { throw new BrowserVaultError('INVALID_PROPERTY_ICON','无法读取属性图标设置。'); }
  await active();
  if (operation === 'getPropertyIcons') return {icons,contentHash};
  const {key, icon, baseHash} = params;
  if (typeof key !== 'string' || !validKey(key) || (icon !== null && !validIcon(key,icon))) throw new BrowserVaultError('INVALID_PROPERTY_ICON','这个位置不支持该图标。');
  const conflict = () => new BrowserVaultError('HASH_CONFLICT','图标设置已更新，请重试。',true);
  if (baseHash !== contentHash) throw conflict();
  if ((icons[key] ?? null) === icon) return {icons,contentHash};
  if (icon === null) delete icons[key]; else icons[key] = icon;
  const next = new TextEncoder().encode(JSON.stringify(icons));
  const directory = await root.getDirectoryHandle('.memocard',{create:true});
  const file = await directory.getFileHandle(filename,{create:true});
  const stream = await file.createWritable({mode:'exclusive'});
  try {
    const verify = async () => {
      await active();
      if (!await (await root.getDirectoryHandle('.memocard')).isSameEntry(directory)
        || !await (await directory.getFileHandle(filename)).isSameEntry(file)
        || await sha256(await read(root)) !== contentHash) throw conflict();
    };
    await verify(); await stream.write(next); await verify(); await stream.close();
  } catch (error) { await stream.abort().catch(() => undefined); throw error; }
  return {icons,contentHash:await sha256(next)};
}
