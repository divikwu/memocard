import type { Note } from '@memocard/contracts';
import { encodeObsidianNote, encodeBrowserNote, parseObsidianNote, parseBrowserNote, type ParsedBrowserNote } from './browser-files';
import { rewriteNoteLinks } from './note-files';
import { propertyDefinitionPath } from './property-definitions';
import { BrowserVaultError, fileAt, readBytes, sha256, type BrowserDirectoryHandle } from './browser-files';
import type { BrowserVaultStorage, RenameJournal } from './browser-storage';
import type { FileIdentity } from './browser-files';

const decode = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
async function transactionFile(root:BrowserDirectoryHandle, path:string, compatible:boolean, create = false) {
  if (path === propertyDefinitionPath) return (await root.getDirectoryHandle('.memocard',{create})).getFileHandle('property-definitions.json',{create});
  return fileAt(root,path,compatible ? 'vault' : 'notes',create);
}
export async function renameSource(root: BrowserDirectoryHandle, path: string, compatible: boolean): Promise<string | null> {
  try { return decode(await readBytes(await transactionFile(root,path,compatible))); }
  catch (error) { if (error instanceof Error && error.name === 'NotFoundError') return null; throw error; }
}

async function write(root: BrowserDirectoryHandle, path: string, before: string | null, after: string | null, compatible: boolean, active: () => Promise<unknown>) {
  const verify = async () => {
    await active();
    if (await renameSource(root, path, compatible) !== before) throw new BrowserVaultError('HASH_CONFLICT', '重命名期间文件被外部修改，备份和草稿已保留。');
  };
  await verify();
  if (after === null) {
    const parts = path.split('/'); let directory = root;
    for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
    await directory.removeEntry(parts.at(-1)!); return;
  }
  const file = await transactionFile(root,path,compatible,true);
  const stream = await file.createWritable({ mode: 'exclusive' });
  try {
    const check = async () => {
      await active();
      const current = await transactionFile(root,path,compatible);
      if (!await current.isSameEntry(file) || await renameSource(root, path, compatible) !== (before ?? '')) throw new BrowserVaultError('HASH_CONFLICT', '重命名目标已改变，备份和草稿已保留。');
    };
    await check(); await stream.write(after); await check(); await stream.close();
  } catch (error) { await stream.abort().catch(() => undefined); throw error; }
}

// Callers hold the index lock so another tab cannot recover an active transaction.
export async function recoverRename(root: BrowserDirectoryHandle, compatible: boolean, storage: BrowserVaultStorage, scope: string, active: () => Promise<unknown>) {
  const journal = await storage.renameJournal(scope); if (!journal) return;
  for (const change of journal.changes) {
    const current = await renameSource(root, change.path, compatible);
    if (current !== change.before && current !== change.after && !(change.before === null && current === '')) throw new BrowserVaultError('RENAME_RECOVERY_REQUIRED', '重命名期间出现外部修改，恢复备份已保留。');
  }
  for (const change of [...journal.changes].reverse()) {
    const current = await renameSource(root, change.path, compatible);
    if (current !== change.before) await write(root, change.path, current, change.before, compatible, active);
  }
  if (compatible) await storage.saveIdentities(scope, journal.identities);
  await storage.saveRenameJournal(scope, undefined);
}

export async function commitRename(root: BrowserDirectoryHandle, compatible: boolean, storage: BrowserVaultStorage, scope: string, journal: RenameJournal, active: () => Promise<unknown>, move = true) {
  await storage.saveRenameJournal(scope, journal);
  try {
    for (const change of journal.changes) await write(root, change.path, change.before, change.after, compatible, active);
    if (compatible) {
      const from = journal.changes.at(-1)!.path, to = journal.changes[0].path;
      await storage.saveIdentities(scope, await Promise.all(journal.identities.map(async item => {
        const path = move && item.path === from ? to : item.path, changed = journal.changes.find(change => change.path === path && change.after !== null);
        return { ...item, path, hash: changed ? await sha256(new TextEncoder().encode(changed.after!)) : item.hash };
      })));
    }
    await storage.saveRenameJournal(scope, undefined);
  } catch (error) { await recoverRename(root, compatible, storage, scope, active); throw error; }
}

// The caller holds the index lock across the source write and local identity commit.
export async function commitSource(root: BrowserDirectoryHandle, compatible: boolean, storage: BrowserVaultStorage, scope: string, change: RenameJournal['changes'][number], identity: FileIdentity, active: () => Promise<unknown>, writeSource: () => Promise<void>) {
  if (!compatible) return writeSource();
  const identities = await storage.identities(scope);
  // Autosave needs one recoverable transaction, without accumulating permanent full-note backups.
  await storage.saveRenameJournal(scope,{changes:[change],identities},false);
  try {
    await writeSource();
    await storage.saveIdentities(scope,[...identities.filter(item=>item.id!==identity.id),identity]);
    await storage.saveRenameJournal(scope,undefined);
  } catch (error) { await recoverRename(root,compatible,storage,scope,active); throw error; }
}

export async function renameNote(root: BrowserDirectoryHandle, compatible: boolean, storage: BrowserVaultStorage, scope: string, vaultId: string, save: { id: string; body: string; baseHash: string | null }, existing: ParsedBrowserNote, notes: ParsedBrowserNote[], path: string, active: () => Promise<unknown>): Promise<Note> {
  const textBytes = (value: string) => new TextEncoder().encode(value), now = () => new Date().toISOString();
  const old = existing.note.relativePath, paths = notes.map(item => item.note.relativePath);
  const before = await renameSource(root, old, compatible);
  if (before === null || await sha256(textBytes(before)) !== save.baseHash) throw new BrowserVaultError('HASH_CONFLICT', '原文件已改变，原文与草稿已保留。');
  if (await renameSource(root, path, compatible) !== null) throw new BrowserVaultError('HASH_CONFLICT', '目标文件已存在。');
  const sourceFile = await fileAt(root, old, compatible ? 'vault' : 'notes');
  const original = compatible ? await parseObsidianNote(textBytes(before), old, vaultId, { id: save.id, path: old, hash: save.baseHash!, createdAt: existing.note.createdAt }, (await sourceFile.getFile()).lastModified) : await parseBrowserNote(textBytes(before), old, vaultId);
  if (!compatible) original.frontmatter.set('updatedAt', now());
  const encoded = compatible ? encodeObsidianNote(original, save.body) : encodeBrowserNote(original.frontmatter, save.body);
  const after = rewriteNoteLinks(decode(encoded), old, paths, { [old]: path });
  if (textBytes(after).length > 8 * 1024 * 1024) throw new BrowserVaultError('NOTE_TOO_LARGE', '单条 Markdown 最大支持 8 MiB。');
  const changes: import('./browser-storage').RenameJournal['changes'] = [{ path, before: null, after }];
  for (const item of notes) {
    if (item.note.relativePath === old) continue;
    const source = await renameSource(root, item.note.relativePath, compatible);
    if (source === null) throw new BrowserVaultError('HASH_CONFLICT', '引用文件已移除。');
    const next = rewriteNoteLinks(source, item.note.relativePath, paths, { [old]: path });
    if (source !== next) {
      if (textBytes(next).length > 8 * 1024 * 1024) throw new BrowserVaultError("NOTE_TOO_LARGE", "引用文件超出大小限制，重命名未提交。");
      if (await sha256(textBytes(source)) !== item.note.contentHash) throw new BrowserVaultError('HASH_CONFLICT', '引用文件已改变。');
      changes.push({ path: item.note.relativePath, before: source, after: next });
    }
  }
  changes.push({ path: old, before, after: null });
  await commitRename(root, compatible, storage, scope, { changes, identities: await storage.identities(scope) }, active);
  const saved = compatible ? await parseObsidianNote(textBytes(after), path, vaultId, { id: save.id, path, hash: await sha256(textBytes(after)), createdAt: existing.note.createdAt }, Date.now()) : await parseBrowserNote(textBytes(after), path, vaultId);
  return saved.note;
}
export { propertyOperation } from './browser-properties';
