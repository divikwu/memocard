import type { TagPreferences, TagPreferenceState } from '@memocard/contracts';
import { tagKey } from './inline-tags';
import { request } from './bridge';

export const tagPreferenceEvent = 'memocard:tag-preferences';
export const tagPreferenceKey = (vaultId?: string | null) => `memocard:tags:${vaultId || 'disconnected'}`;
type Shared = { active: boolean; revision: number; raw?: string; error: string; ready: Promise<void>; writing: boolean; pending: Promise<unknown> };
const shared = new Map<string, Shared>();
const changed = () => window.dispatchEvent(new Event(tagPreferenceEvent));
export const sharedTagPreferences = (vaultId: string) => shared.get(vaultId)?.active ? shared.get(vaultId) : undefined;

function publish(vaultId: string, state: Shared, value: TagPreferences) {
  if (!state.active) return;
  state.raw = JSON.stringify({pinned:value.pinned, icons:value.icons});
  state.error = '';
  // This remains a browser cache; the vault is authoritative, including empty settings.
  try { localStorage.setItem(tagPreferenceKey(vaultId), state.raw); } catch { /* The shared setting is already saved. */ }
  changed();
}
function fail(state: Shared, cause: unknown) {
  if (!state.active) return;
  state.error = cause instanceof Error ? cause.message : '标签设置同步失败，请重试。';
  changed();
}
function check(state: Shared) {
  if (!state.active) throw new Error('笔记库已切换，请重新打开标签设置。');
}

export function connectSharedTagPreferences(vaultId: string) {
  const state: Shared = {active:true,revision:0,error:'',ready:Promise.resolve(),writing:true,pending:Promise.resolve()};
  shared.set(vaultId, state);
  let reading = false;
  async function refresh() {
    if (reading || state.writing || !state.active) return;
    reading = true;
    const revision = state.revision;
    try {
      if (state.raw === undefined) {
        state.writing = true;
        state.ready = initialize();
        await state.ready;
        return;
      }
      const value = await request<TagPreferenceState>('getTagPreferences', {vaultId});
      if (revision === state.revision) publish(vaultId, state, value);
    } catch (cause) { fail(state, cause); }
    finally { reading = false; }
  }
  async function initialize() {
    try {
      let legacy: TagPreferences | null = null;
      try {
        const value = JSON.parse(localStorage.getItem(tagPreferenceKey(vaultId)) || 'null');
        if (value && Array.isArray(value.pinned) && value.icons && typeof value.icons === 'object') legacy = {
          pinned:[...new Set<string>(value.pinned.filter((tag:unknown) => typeof tag === 'string').map(tagKey))],
          icons:Object.fromEntries(Object.entries(value.icons).filter(([,icon]) => typeof icon === 'string').map(([tag,icon]) => [tagKey(tag),icon])) as Record<string,string>,
        };
      } catch { /* Unreadable browser caches must not block the shared settings. */ }
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await request<TagPreferenceState>('getTagPreferences', {vaultId});
        check(state);
        if (current.initialized || !legacy || (!legacy.pinned?.length && !Object.keys(legacy.icons || {}).length)) {
          publish(vaultId, state, current); return;
        }
        try {
          const saved = await request<TagPreferenceState>('setTagPreferences', {...legacy,baseHash:current.contentHash,vaultId});
          publish(vaultId, state, saved); return;
        } catch (cause) { if ((cause as {code?:string}).code !== 'HASH_CONFLICT' || attempt === 2) throw cause; }
      }
    } catch (cause) { fail(state, cause); }
    finally { state.writing = false; }
  }
  state.ready = initialize();
  const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
  const timer = window.setInterval(visible, 5000);
  window.addEventListener('focus', visible);
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('memocard:event', visible);
  return () => {
    state.active = false;
    clearInterval(timer);
    window.removeEventListener('focus', visible);
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('memocard:event', visible);
  };
}

export function updateSharedTagPreferences(vaultId: string, change: (current: TagPreferences) => TagPreferences) {
  const state = sharedTagPreferences(vaultId);
  if (!state) return undefined;
  const pending = state.pending.catch(() => undefined).then(async () => {
    await state.ready;
    check(state);
    if (state.raw === undefined) throw new Error(state.error || '标签设置尚未加载，请重试。');
    state.writing = true;
    state.revision++;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await request<TagPreferenceState>('getTagPreferences', {vaultId});
        check(state);
        const next = change({pinned:current.pinned,icons:current.icons});
        try {
          const saved = await request<TagPreferenceState>('setTagPreferences', {...next,baseHash:current.contentHash,vaultId});
          check(state); publish(vaultId, state, saved); return;
        } catch (cause) { if ((cause as {code?:string}).code !== 'HASH_CONFLICT' || attempt === 2) throw cause; }
      }
    } catch (cause) { fail(state, cause); throw cause; }
    finally { state.writing = false; }
  });
  state.pending = pending;
  return pending;
}
