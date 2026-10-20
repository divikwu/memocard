import { updateSharedTagPreferences } from './shared-tag-preferences';
import { renamedTag } from './rename-tag';
import { tagKey } from './inline-tags';
import { renameTagColors, setTagColor } from './tag-colors';

// Keep shared appearance settings with the global tag identity.
export function changeTagSettings(vaultId:string, from:string, to:string | null) {
  from = tagKey(from);
  if (to === null) setTagColor(vaultId, from, 'default');
  else renameTagColors(vaultId, from, to);
  const shared = updateSharedTagPreferences(vaultId, preferences => {
    const path = (value:string) => to === null ? tagKey(value) === from ? null : tagKey(value) : renamedTag(value, from, to);
    return {pinned:[...new Set(preferences.pinned.flatMap(value => path(value) ?? []))],icons:Object.fromEntries(Object.entries(preferences.icons).flatMap(([value,icon]) => {
      const next = path(value); return next === null ? [] : [[next,icon]];
    }))};
  });
  if (shared) return shared;
  const key = `memocard:tags:${vaultId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const preferences = JSON.parse(raw);
  const path = (value:string) => to === null ? tagKey(value) === from ? null : tagKey(value) : renamedTag(value, from, to);
  preferences.pinned = [...new Set((preferences.pinned || []).flatMap((value:string) => path(value) ?? []))];
  preferences.icons = Object.fromEntries(Object.entries(preferences.icons || {}).flatMap(([value, icon]) => {
    const next = path(value);
    return next === null ? [] : [[next, icon]];
  }));
  localStorage.setItem(key, JSON.stringify(preferences));
  window.dispatchEvent(new Event('memocard:tag-preferences'));
}
