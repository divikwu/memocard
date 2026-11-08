import type { TagGroup, TagPreferences, TagPreferenceState } from '@memocard/contracts';
import { tagKey } from './inline-tags';
import { request } from './bridge';
import { isTagColor } from './tag-colors';

export const tagPreferenceEvent = 'memocard:tag-preferences';
export const tagPreferenceKey = (vaultId?: string | null) => `memocard:tags:${vaultId || 'disconnected'}`;
export function parseTagPreferences(raw: string | null): TagPreferences {
  const icons: Record<string, string> = Object.create(null);
  try {
    const value = JSON.parse(raw || "null");
    for (const [tag, icon] of Object.entries(value?.icons ?? {})) {
      if (typeof icon === "string") icons[tagKey(tag)] = icon;
    }
    return { pinned: Array.isArray(value?.pinned) ? [...new Set<string>(value.pinned.filter((x: unknown) => typeof x === "string").map(tagKey))] : [], icons,
      groups: Array.isArray(value?.groups) ? value.groups.filter((group: TagGroup) =>
        typeof group?.id === "string" && typeof group.name === "string" &&
        (group.description === undefined || typeof group.description === "string") &&
        isTagColor(group.color ?? "default") &&
        (group.icon === undefined || typeof group.icon === "string") && Array.isArray(group.tags) && group.tags.every(tag => typeof tag === "string")) : undefined,
      labels: value?.labels && Object.fromEntries(Object.entries(value.labels).filter(([, description]) => typeof description === "string")) as Record<string, string> | undefined };
  } catch { return { pinned: [], icons }; }
}

function values({pinned, icons, groups, labels}: TagPreferences): TagPreferences {
  return {pinned, icons, groups, labels};
}

function requireTagMetadataSupport(current: TagPreferenceState, next: TagPreferences) {
  if ((next.groups !== undefined && current.groups === undefined) || (next.labels !== undefined && current.labels === undefined)) {
    throw new Error('请更新应用后再保存标签群组和说明。');
  }
}

function verifyTagMetadata(saved: TagPreferenceState, next: TagPreferences) {
  requireTagMetadataSupport(saved, next);
  if (next.groups && (saved.groups?.length !== next.groups.length || next.groups.some((group, index) => {
    const item = saved.groups?.[index];
    return !item || item.id !== group.id || item.name !== group.name || item.icon !== group.icon ||
      item.description !== group.description || item.color !== group.color ||
      item.tags.length !== group.tags.length || item.tags.some((tag, index) => tag !== group.tags[index]);
  })) || next.labels && (Object.keys(saved.labels ?? {}).length !== Object.keys(next.labels).length ||
    Object.entries(next.labels).some(([tag, description]) => !Object.hasOwn(saved.labels ?? {}, tag) || saved.labels?.[tag] !== description))) {
    throw new Error('标签群组或说明未完整保存，请重试。');
  }
}
type Change = (current: TagPreferences) => TagPreferences;
type Shared = { active: boolean; revision: number; raw?: string; error: string; ready: Promise<void>; writing: boolean; pending: Promise<unknown>; confirmed?: TagPreferenceState; cached?: TagPreferences; optimistic: Change[] };
const shared = new Map<string, Shared>();
const changed = () => window.dispatchEvent(new Event(tagPreferenceEvent));
export const sharedTagPreferences = (vaultId: string) => shared.get(vaultId)?.active ? shared.get(vaultId) : undefined;

function updateVisible(state: Shared) {
  if (!state.confirmed && !state.optimistic.length) { state.raw = undefined; return; }
  const initial = values(state.confirmed ?? state.cached ?? {pinned:[], icons:{}});
  state.raw = JSON.stringify(state.optimistic.reduce<TagPreferences>((current, change) => change(current), initial));
}

function publish(vaultId: string, state: Shared, value: TagPreferenceState) {
  if (!state.active) return;
  state.confirmed = value;
  updateVisible(state);
  state.error = '';
  // This remains a browser cache; the vault is authoritative, including empty settings.
  try { localStorage.setItem(tagPreferenceKey(vaultId), JSON.stringify(values(value))); } catch { /* The shared setting is already saved. */ }
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
      let legacy = parseTagPreferences(null);
      try { legacy = parseTagPreferences(localStorage.getItem(tagPreferenceKey(vaultId))); }
      catch { /* Browser caches must not block the vault settings. */ }
      if (!legacy.groups?.length) delete legacy.groups;
      if (!Object.keys(legacy.labels ?? {}).length) delete legacy.labels;
      state.cached = legacy;
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await request<TagPreferenceState>('getTagPreferences', {vaultId});
        check(state);
        requireTagMetadataSupport(current, legacy);
        if (current.initialized || (!legacy.pinned.length && !Object.keys(legacy.icons).length && !legacy.groups && !legacy.labels)) {
          publish(vaultId, state, current); return;
        }
        try {
          const saved = await request<TagPreferenceState>('setTagPreferences', {...legacy,baseHash:current.contentHash,vaultId});
          verifyTagMetadata(saved, legacy);
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
        const next = change(values(current));
        try {
          requireTagMetadataSupport(current, next);
          const saved = await request<TagPreferenceState>('setTagPreferences', {...next,baseHash:current.contentHash,vaultId});
          check(state);
          verifyTagMetadata(saved, next);
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
