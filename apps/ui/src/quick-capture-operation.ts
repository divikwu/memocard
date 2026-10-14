import type { Note } from '@memocard/contracts';
import type { Draft } from './bridge';
import { inlineTags, tagKey } from './inline-tags';

type Transport = <T>(operation: string, params?: Record<string, unknown>) => Promise<T>;
export async function commitQuickCapture(draft: Draft & {vaultId:string}, transport: Transport): Promise<Note> {
  try { return await transport<Note>('saveNote', {...draft}); }
  catch (error) {
    // A lost reply can follow a successful commit. Verify this same ID instead of creating another note.
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (['TIMEOUT', 'BRIDGE_UNAVAILABLE', 'HASH_CONFLICT'].includes(String(code))) {
      try {
        const saved = await transport<Note>('getNote', {id:draft.id,vaultId:draft.vaultId,...(draft.vaultBinding ? {vaultBinding:draft.vaultBinding} : {})});
        const expectedTags = new Set([...inlineTags(draft.body), ...draft.inheritedTags ?? []].map(tagKey));
        if (saved.id === draft.id && saved.body === draft.body && saved.tags.length === expectedTags.size && saved.tags.every(tag => expectedTags.has(tagKey(tag)))) return saved;
      } catch { /* Keep the original write error and the user's input. */ }
    }
    throw error;
  }
}
