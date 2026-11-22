import type { TagPreferences } from '@memocard/contracts';
import { parseTagPreferences, tagPreferenceEvent, tagPreferenceKey, updateSharedTagPreferences } from './shared-tag-preferences';
import { tagKey } from './inline-tags';
import { renameTagColors, setTagColor } from './tag-colors';

export type TagScope = {vaultId: string; vaultBinding: string};
type SaveAppearance = () => void | Promise<void>;
export type TagAppearance = TagScope & {
  key: string;
  source: string;
  target: string;
  save: SaveAppearance;
  error?: Error;
  request?: Promise<void>;
};

const pendingAppearances = new Map<string, TagAppearance>();
const appearanceListeners = new Set<() => void>();

export function subscribeTagAppearance(listener: () => void) {
  appearanceListeners.add(listener);
  return () => { appearanceListeners.delete(listener); };
}

export function pendingTagAppearance(vaultId: string | null | undefined, vaultBinding: string | undefined) {
  for (const pending of pendingAppearances.values()) {
    if (pending.error && pending.vaultId === vaultId && pending.vaultBinding === vaultBinding) return pending;
  }
}

export function getTagAppearance(key: string) {
  return pendingAppearances.get(key);
}

export function requireTagAppearanceReady({vaultId, vaultBinding}: TagScope, ...tags: string[]) {
  for (const pending of pendingAppearances.values()) {
    if (pending.vaultId === vaultId && pending.vaultBinding === vaultBinding && (tags.includes(pending.source) || tags.includes(pending.target))) {
      throw new Error('请先完成相关标签的外观保存，失败时可重试标签外观。');
    }
  }
}

export function setTagAppearance(key: string, appearance?: TagAppearance) {
  if (appearance) pendingAppearances.set(key, appearance);
  else pendingAppearances.delete(key);
  appearanceListeners.forEach(listener => listener());
}

export function updatedTagReferences(current: TagPreferences, from: string, to: string | null): TagPreferences {
  const source = tagKey(from), target = to === null ? null : tagKey(to);
  const change = (tag: string) => tagKey(tag) === source ? target : tagKey(tag);
  const updateTags = (tags: string[]) => [...new Set(tags.flatMap(tag => change(tag) ?? []))];
  const updateKeys = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).flatMap(([tag, value]) => {
    const next = change(tag);
    return next === null ? [] : [[next, value]];
  }));
  return {
    pinned: updateTags(current.pinned),
    icons: updateKeys(current.icons),
    groups: current.groups?.map(group => ({...group, tags: updateTags(group.tags)})),
    labels: current.labels && updateKeys(current.labels),
  };
}

export function changeTagSettings({vaultId, vaultBinding}: TagScope, from: string, to: string | null) {
  if (to === null) setTagColor(vaultId, from, 'default');
  else renameTagColors(vaultId, from, to);
  const change = (current: TagPreferences) => updatedTagReferences(current, from, to);
  const shared = updateSharedTagPreferences(vaultId, change, {vaultBinding});
  if (shared) return shared;
  const key = tagPreferenceKey(vaultId);
  const raw = localStorage.getItem(key);
  if (!raw) return;
  localStorage.setItem(key, JSON.stringify(change(parseTagPreferences(raw))));
  window.dispatchEvent(new Event(tagPreferenceEvent));
}
