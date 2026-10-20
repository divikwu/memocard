import type { TagPreferences, TagPreferenceState } from '@memocard/contracts';
import { BrowserVaultError, readBytes, sha256, type BrowserDirectoryHandle } from './browser-files';
import { tagKey } from './inline-tags';

function parse(value: unknown): TagPreferences {
  const input = value as TagPreferences | null;
  const control = (text: string) => [...text].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  const validTag = (tag: unknown): tag is string => typeof tag === 'string' && !!tag && tag === tag.trim() && tag === tagKey(tag) && !control(tag);
  if (!input || !Array.isArray(input.pinned) || !input.pinned.every(validTag) || new Set(input.pinned).size !== input.pinned.length
    || !input.icons || typeof input.icons !== 'object' || Array.isArray(input.icons)
    || !Object.entries(input.icons).every(([tag, icon]) => validTag(tag) && typeof icon === 'string' && icon.length <= 32 && !control(icon))) {
    throw new BrowserVaultError('INVALID_TAG_PREFERENCES', '标签设置无效。');
  }
  return {pinned:input.pinned,icons:input.icons};
}
async function read(root: BrowserDirectoryHandle) {
  try { return await readBytes(await (await root.getDirectoryHandle('.memocard')).getFileHandle('tag-preferences.json')); }
  catch (error) { if (error instanceof Error && error.name === 'NotFoundError') return null; throw error; }
}
export async function tagPreferenceOperation(operation: string, params: Record<string, unknown>, root: BrowserDirectoryHandle, active: () => Promise<unknown>): Promise<TagPreferenceState> {
  await active();
  const before = await read(root), contentHash = await sha256(before ?? new Uint8Array());
  let current: TagPreferences;
  // Creating a writable can leave an empty file if the first atomic close fails.
  const initialized = !!before?.length;
  try { current = !initialized ? {pinned:[],icons:{}} : parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(before!))); }
  catch { throw new BrowserVaultError('INVALID_TAG_PREFERENCES','标签设置无法读取，请检查 .memocard/tag-preferences.json。'); }
  await active();
  if (operation === 'getTagPreferences') return {...current,contentHash,initialized};
  const next = parse(params);
  if (contentHash !== params.baseHash) throw new BrowserVaultError('HASH_CONFLICT','标签设置已在其他位置修改，请重试。',true);
  if (initialized && JSON.stringify(current) === JSON.stringify(next)) return {...current,contentHash,initialized:true};
  const bytes = new TextEncoder().encode(JSON.stringify(next));
  const directory = await root.getDirectoryHandle('.memocard',{create:true});
  const file = await directory.getFileHandle('tag-preferences.json',{create:true});
  const stream = await file.createWritable({mode:'exclusive'});
  try {
    const verify = async () => {
      await active();
      if (!await (await directory.getFileHandle('tag-preferences.json')).isSameEntry(file) || await sha256((await read(root)) ?? new Uint8Array()) !== contentHash) throw new BrowserVaultError('HASH_CONFLICT','标签设置已在其他位置修改，请重试。',true);
    };
    await verify(); await stream.write(bytes); await verify(); await stream.close();
  } catch (error) { await stream.abort().catch(() => undefined); throw error; }
  return {...next,contentHash:await sha256(bytes),initialized:true};
}
