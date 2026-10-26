import type { Attachment } from './bridge';
import { createId } from './uuid';
import { restoreCaptureTags } from './quick-capture-tags';

export type Capture = {id:string; text:string; tags:string[]; images:Attachment[]; relativePath:string};
const storageKey = (vaultId:string) => `memocard:quick-capture:v1:${encodeURIComponent(vaultId)}`;
const revisionPrefix = (vaultId:string) => `memocard:quick-capture:v2:${encodeURIComponent(vaultId)}:`;
export const hasCapture = (capture:Capture) => Boolean(capture.text || capture.tags.length || capture.images.length);

function validatedCapture(capture:Capture):Capture {
  if (!capture || typeof capture.id !== 'string' || !capture.id || typeof capture.text !== 'string'
    || typeof capture.relativePath !== 'string' || !capture.relativePath
    || !Array.isArray(capture.tags) || !capture.tags.every((tag:unknown) => typeof tag === 'string')
    || !Array.isArray(capture.images) || !capture.images.every((image:Attachment) => image && typeof image.relativePath === 'string' && typeof image.markdownPath === 'string' && (image.notePath === undefined || typeof image.notePath === 'string'))) {
    throw new Error('无法恢复快速输入草稿');
  }
  return capture;
}

type Revision = {key:string; capture:Capture; updatedAt:number; legacyOrigin?:string};
const snapshotKey = (capture:Capture) => {
  const restored = restoreCaptureTags(capture);
  return JSON.stringify([restored.id, restored.text, restored.tags, restored.images.map(image => [image.relativePath, image.markdownPath, image.notePath]), restored.relativePath]);
};
function parseRevision(prefix:string, key:string, raw:string):Revision {
  const value = JSON.parse(raw);
  if (value?.version !== 2 || !Number.isFinite(value.updatedAt) || !key.startsWith(`${prefix}record:`)) throw new Error('无法恢复快速输入草稿');
  return {key, capture:validatedCapture(value.capture), updatedAt:value.updatedAt, legacyOrigin:typeof value.legacyOrigin === 'string' ? value.legacyOrigin : undefined};
}
function readRevision(vaultId:string, preferred?:string | null):Revision | {legacy:string; capture:Capture} | null {
  if (preferred === '') return null;
  const prefix = revisionPrefix(vaultId), revisions:Revision[] = [], retired = new Set<string>(), completed = new Set<string>();
  const own = preferred?.startsWith(`${prefix}record:`) ? localStorage.getItem(preferred) : null;
  if (own) return parseRevision(prefix, preferred!, own);
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key === null) continue;
    if (key.startsWith(`${prefix}legacy:`)) retired.add(localStorage.getItem(key)!);
    if (key.startsWith(`${prefix}retired:`)) for (const value of JSON.parse(localStorage.getItem(key)!)) completed.add(value);
    if (!key.startsWith(`${prefix}record:`)) continue;
    const raw = localStorage.getItem(key);
    if (raw !== null) revisions.push(parseRevision(prefix, key, raw));
  }
  const remaining = revisions.filter(item => !completed.has(item.key));
  const latest = localStorage.getItem(`${prefix}latest`);
  const current = remaining.find(item => item.key === latest) ?? remaining.sort((a,b) => b.updatedAt - a.updatedAt)[0];
  const legacy = localStorage.getItem(storageKey(vaultId));
  if (legacy && !retired.has(legacy)) {
    const value = JSON.parse(legacy);
    if (value?.version !== 1) throw new Error('无法恢复快速输入草稿');
    return current?.legacyOrigin === legacy ? current : {legacy, capture:validatedCapture(value.capture)};
  }
  if (preferred !== undefined && preferred !== null) return null;
  return current ?? null;
}

export function readQuickCaptureDraft(vaultId:string):Capture | null {
  return readRevision(vaultId)?.capture ?? null;
}

/** Each page advances immutable revisions, so another page can only retire its own snapshot. */
export function createQuickCaptureDraftProtection(vaultId:string) {
  const prefix = revisionPrefix(vaultId), pageKey = `${prefix}current`, owned = new Set<string>();
  let page:Storage | undefined;
  try { page = sessionStorage; } catch { /* Local protection still works if page storage is unavailable. */ }
  const pageRevision = () => { try { return page?.getItem(pageKey) ?? null; } catch { page = undefined; return null; } };
  const rememberPage = (key:string) => { try { page?.setItem(pageKey, key); } catch { page = undefined; } };
  let legacyOrigin:string | undefined, unprotected = false;
  const store = (capture:Capture, updatedAt:number) => {
    const key = `${prefix}record:${createId()}`;
    localStorage.setItem(key, JSON.stringify({version:2, capture, updatedAt, ...(legacyOrigin ? {legacyOrigin} : {})}));
    owned.add(key);
    rememberPage(key);
    return key;
  };
  function write(capture:Capture) {
    let current:string | undefined;
    if (hasCapture(capture)) {
      current = store(capture, Date.now());
      localStorage.setItem(`${prefix}latest`, current);
    }
    for (const key of owned) if (key !== current) { localStorage.removeItem(key); owned.delete(key); }
    if (!current) rememberPage('');
    unprotected = false;
  }
  return {
    read():Capture | null {
      const revision = readRevision(vaultId, pageRevision());
      if (!revision) return null;
      legacyOrigin = 'legacy' in revision ? revision.legacy : revision.legacyOrigin;
      // A session pointer can be copied to a new tab. Protect a new snapshot;
      // an inherited pointer never grants permission to delete its source.
      unprotected = false;
      if ('legacy' in revision || !owned.has(revision.key)) {
        try { store(revision.capture, 'legacy' in revision ? Date.now() : revision.updatedAt); }
        catch { unprotected = true; }
      }
      return revision.capture;
    },
    get unprotected() { return unprotected; },
    write,
    complete(capture:Capture) {
      const fingerprint = snapshotKey(capture), matching = new Set<string>();
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key?.startsWith(`${prefix}record:`)) continue;
        const raw = localStorage.getItem(key);
        if (raw && snapshotKey(parseRevision(prefix, key, raw).capture) === fingerprint) matching.add(key);
      }
      // Retirement affects global discovery, not another page's explicit pointer.
      // Different-content snapshots remain recoverable even if their ids match.
      for (const key of owned) if (matching.has(key)) { localStorage.removeItem(key); owned.delete(key); }
      if (matching.size) localStorage.setItem(`${prefix}retired:${createId()}`, JSON.stringify([...matching]));
      const legacy = localStorage.getItem(storageKey(vaultId));
      if (legacy) {
        const value = JSON.parse(legacy);
        if (value?.version === 1 && snapshotKey(validatedCapture(value.capture)) === fingerprint) localStorage.setItem(`${prefix}legacy:${createId()}`, legacy);
      }
      if (matching.has(pageRevision() ?? '')) rememberPage('');
    },
  };
}

// Compatibility writer for callers storing the previous v1 envelope.
export function writeQuickCaptureDraft(vaultId:string, capture:Capture) {
  if (hasCapture(capture)) localStorage.setItem(storageKey(vaultId), JSON.stringify({version:1,capture}));
  else localStorage.removeItem(storageKey(vaultId));
}
