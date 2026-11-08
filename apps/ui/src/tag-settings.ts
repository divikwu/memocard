import type { TagPreferences } from '@memocard/contracts';
import { parseTagPreferences, tagPreferenceEvent, tagPreferenceKey, updateSharedTagPreferences } from './shared-tag-preferences';
import { tagKey } from './inline-tags';
import { renameTagColors, setTagColor } from './tag-colors';

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

export function changeTagSettings(vaultId: string, from: string, to: string | null) {
  if (to === null) setTagColor(vaultId, from, 'default');
  else renameTagColors(vaultId, from, to);
  const change = (current: TagPreferences) => updatedTagReferences(current, from, to);
  const shared = updateSharedTagPreferences(vaultId, change);
  if (shared) return shared;
  const key = tagPreferenceKey(vaultId);
  const raw = localStorage.getItem(key);
  if (!raw) return;
  localStorage.setItem(key, JSON.stringify(change(parseTagPreferences(raw))));
  window.dispatchEvent(new Event(tagPreferenceEvent));
}
