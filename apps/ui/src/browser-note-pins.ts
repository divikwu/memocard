import type { Note, NotePins } from '@memocard/contracts';
import { BrowserVaultError, canonicalId, parseDate, readBytes, safeParts, sha256, type BrowserDirectoryHandle, type ParsedBrowserNote } from './browser-files';

async function read(root: BrowserDirectoryHandle) {
  try { return await readBytes(await (await root.getDirectoryHandle('.memocard')).getFileHandle('pins.json')); }
  catch (error) { if (error instanceof Error && error.name === 'NotFoundError') return new Uint8Array(); throw error; }
}

export async function readNotePins(root: BrowserDirectoryHandle): Promise<NotePins> {
  const bytes = await read(root);
  try {
    const value: unknown = bytes.length ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid pins');
    for (const [id, date] of Object.entries(value)) {
      if (id.startsWith('path:')) { safeParts(id.slice(5), 'vault'); if (!/\.md$/i.test(id)) throw new Error('Invalid path'); }
      else if (canonicalId(id) !== id) throw new Error('Invalid identity');
      parseDate(date);
    }
    return { pins: value as Record<string, string>, contentHash: await sha256(bytes) };
  } catch { throw new BrowserVaultError('INVALID_PINS', '固定记录无法读取，请检查 .memocard/pins.json。'); }
}

export function resolvedNotePins(stored: NotePins, notes: Note[], compatible: boolean): NotePins {
  return { contentHash: stored.contentHash, pins: Object.fromEntries(notes.filter(note => !note.deletedAt && stored.pins[compatible ? `path:${note.relativePath}` : note.id]).map(note => [note.id, stored.pins[compatible ? `path:${note.relativePath}` : note.id]])) };
}

export async function setNotePinned(params: Record<string, unknown>, root: BrowserDirectoryHandle, compatible: boolean, active: () => Promise<unknown>, scan: () => Promise<{ parsed: ParsedBrowserNote[]; duplicateIds: Set<string>; coverage: { complete: boolean } }>): Promise<NotePins> {
  const id = canonicalId(params.id);
  if (typeof params.pinned !== 'boolean' || typeof params.baseHash !== 'string') throw new BrowserVaultError('INVALID_PARAMS', '固定状态参数无效。');
  const snapshot = await scan();
  if (!snapshot.coverage.complete) throw new BrowserVaultError('SCAN_INCOMPLETE', '笔记库尚未完整读取，暂时无法修改固定状态。');
  if (snapshot.duplicateIds.has(id)) throw new BrowserVaultError('DUPLICATE_ID', '多份文件使用同一个 ID，请先处理重复文件。');
  const note = snapshot.parsed.find(item => item.note.id === id && !item.note.deletedAt)?.note;
  if (!note) throw new BrowserVaultError('NOTE_NOT_FOUND', '找不到此笔记。');
  const key = compatible ? `path:${note.relativePath}` : id;
  await active();
  const current = await readNotePins(root);
  if (current.contentHash !== params.baseHash) throw new BrowserVaultError('HASH_CONFLICT', '固定状态已在其他位置修改，请重试。', true);
  const pins = { ...current.pins };
  if (params.pinned) { if (pins[key]) return resolvedNotePins(current, snapshot.parsed.map(item => item.note), compatible); pins[key] = new Date().toISOString(); }
  else { if (!pins[key]) return resolvedNotePins(current, snapshot.parsed.map(item => item.note), compatible); delete pins[key]; }
  const bytes = new TextEncoder().encode(JSON.stringify(pins));
  const directory = await root.getDirectoryHandle('.memocard', { create: true });
  const file = await directory.getFileHandle('pins.json', { create: true });
  const stream = await file.createWritable({ mode: 'exclusive' });
  try {
    const verify = async () => {
      await active();
      if (!await (await directory.getFileHandle('pins.json')).isSameEntry(file) || (await readNotePins(root)).contentHash !== current.contentHash) throw new BrowserVaultError('HASH_CONFLICT', '固定状态已在其他位置修改，请重试。', true);
    };
    await verify(); await stream.write(bytes); await verify(); await stream.close();
  } catch (error) { await stream.abort().catch(() => undefined); throw error; }
  return resolvedNotePins({ pins, contentHash: await sha256(bytes) }, snapshot.parsed.map(item => item.note), compatible);
}
