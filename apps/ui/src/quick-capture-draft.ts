import type { Attachment } from './bridge';

export type Capture = {id:string; text:string; tags:string[]; images:Attachment[]; relativePath:string};
const storageKey = (vaultId:string) => `memocard:quick-capture:v1:${encodeURIComponent(vaultId)}`;
export const hasCapture = (capture:Capture) => Boolean(capture.text || capture.tags.length || capture.images.length);

export function readQuickCaptureDraft(vaultId:string):Capture | null {
  const raw = localStorage.getItem(storageKey(vaultId));
  if (!raw) return null;
  const value = JSON.parse(raw);
  const capture = value?.capture;
  if (value?.version !== 1 || !capture || typeof capture.id !== 'string' || !capture.id || typeof capture.text !== 'string'
    || typeof capture.relativePath !== 'string' || !capture.relativePath
    || !Array.isArray(capture.tags) || !capture.tags.every((tag:unknown) => typeof tag === 'string')
    || !Array.isArray(capture.images) || !capture.images.every((image:Attachment) => image && typeof image.relativePath === 'string' && typeof image.markdownPath === 'string' && (image.notePath === undefined || typeof image.notePath === 'string'))) {
    throw new Error('无法恢复快速输入草稿');
  }
  return capture;
}

export function writeQuickCaptureDraft(vaultId:string, capture:Capture) {
  if (hasCapture(capture)) localStorage.setItem(storageKey(vaultId), JSON.stringify({version:1,capture}));
  else localStorage.removeItem(storageKey(vaultId));
}
