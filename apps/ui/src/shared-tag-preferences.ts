import type { TagPreferences, TagPreferenceState } from '@memocard/contracts';
import { tagKey } from './inline-tags';
import { request } from './bridge';

export const tagPreferenceEvent = 'memocard:tag-preferences';
export const tagPreferenceKey = (vaultId?: string | null) => `memocard:tags:${vaultId || 'disconnected'}`;
type Change = (current: TagPreferences) => TagPreferences;
type Shared = { active: boolean; revision: number; raw?: string; error: string; ready: Promise<void>; writing: boolean; pending: Promise<unknown>; confirmed?: TagPreferenceState; cached?: TagPreferences; optimistic: Change[] };
const shared = new Map<string, Shared>();
const changed = () => window.dispatchEvent(new Event(tagPreferenceEvent));
export const sharedTagPreferences = (vaultId: string) => shared.get(vaultId)?.active ? shared.get(vaultId) : undefined;

function updateVisible(state: Shared) {
  if (!state.confirmed && !state.optimistic.length) { state.raw = undefined; return; }
  const { pinned, icons } = state.confirmed ?? state.cached ?? {pinned:[], icons:{}};
  state.raw = JSON.stringify(state.optimistic.reduce((current, change) => change(current), {pinned, icons}));
}

function publish(vaultId: string, state: Shared, value: TagPreferenceState) {
  if (!state.active) return;
  state.confirmed = value;
  updateVisible(state);
  state.error = '';
  // This remains a browser cache; the vault is authoritative, including empty settings.
  try { localStorage.setItem(tagPreferenceKey(vaultId), JSON.stringify({pinned:value.pinned, icons:value.icons})); } catch { /* The shared setting is already saved. */ }
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
  const state: Shared = {active:true,revision:0,error:'',ready:Promise.resolve(),writing:true,pending:Promise.resolve(),optimistic:[]};
  shared.set(vaultId, state);
  let reading = false;
  async function refresh() {
    if (reading || state.writing || !state.active) return;
    reading = true;
    const revision = state.revision;
    try {
      if (!state.confirmed) {
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
      state.cached = legacy ?? undefined;
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

export function updateSharedTagPreferences(vaultId: string, change: Change, { optimistic = false } = {}) {
  const state = sharedTagPreferences(vaultId);
  if (!state) return undefined;
  const removeOptimisticChange = () => {
    if (optimistic) state.optimistic = state.optimistic.filter(entry => entry !== change);
  };
  const pending = state.pending.catch(() => undefined).then(async () => {
    try {
      await state.ready;
      check(state);
      if (!state.confirmed) throw new Error(state.error || '标签设置尚未加载，请重试。');
      let current = state.confirmed;
      state.writing = true;
      state.revision++;
      for (let attempt = 0; attempt < 3; attempt++) {
        const next = change({pinned:current.pinned,icons:current.icons});
        try {
          const saved = await request<TagPreferenceState>('setTagPreferences', {...next,baseHash:current.contentHash,vaultId});
          check(state);
          removeOptimisticChange();
          publish(vaultId, state, saved);
          return;
        } catch (cause) {
          if ((cause as {code?:string}).code !== 'HASH_CONFLICT' || attempt === 2) throw cause;
          current = await request<TagPreferenceState>('getTagPreferences', {vaultId});
          check(state);
        }
      }
    } catch (cause) {
      removeOptimisticChange();
      updateVisible(state);
      fail(state, cause);
      throw cause;
    }
    finally { state.writing = false; }
  });
  state.pending = pending;
  if (optimistic) {
    state.optimistic.push(change);
    state.error = '';
    updateVisible(state);
    changed();
  }
  return pending;
}
