import { useMemo, useState, useSyncExternalStore } from "react";
import { tagKey } from "@/inline-tags";
import { renamedTag } from "@/rename-tag";
import { renameTagColors } from "@/tag-colors";

import { sharedTagPreferences, tagPreferenceEvent, tagPreferenceKey, updateSharedTagPreferences } from "@/shared-tag-preferences";

type Preferences = { pinned: string[]; icons: Record<string, string> };
const changeEvent = tagPreferenceEvent;
function subscribe(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(changeEvent, callback); window.removeEventListener("storage", callback); };
}
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function parse(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw || "null");
    return { pinned: Array.isArray(value?.pinned) ? [...new Set<string>(value.pinned.filter((x: unknown) => typeof x === "string").map(tagKey))] : [], icons: Object.fromEntries(Object.entries(value?.icons || {}).filter(([, x]) => typeof x === "string").map(([tag, icon]) => [tagKey(tag), icon])) as Record<string, string> };
  } catch { return { pinned: [], icons: {} }; }
}

export function useTagPreferences(vaultId?: string | null) {
  const key = tagPreferenceKey(vaultId);
  const raw = useSyncExternalStore(subscribe, () => (vaultId && sharedTagPreferences(vaultId)?.raw) || read(key));
  const sharedError = useSyncExternalStore(subscribe, () => (vaultId && sharedTagPreferences(vaultId)?.error) || "");
  const preferences = useMemo(() => parse(raw), [raw]);
  const [error, setError] = useState("");
  function save(next: Preferences) {
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(changeEvent)); setError(""); return true; }
    catch { setError("无法保存标签设置，请检查浏览器存储权限。"); return false; }
  }
  return {
    preferences, error: sharedError || error,
    togglePinned: (path: string) => {
      const pinned = !preferences.pinned.includes(path);
      const change = (current: Preferences) => ({...current,pinned:pinned ? [...new Set([...current.pinned,path])] : current.pinned.filter(x => x !== path)});
      const pending = vaultId && updateSharedTagPreferences(vaultId, change);
      if (pending) return pending.then(() => true, () => false);
      return save(change(preferences));
    },
    saveAppearance: async (from: string, name: string, icon: string, onRename?: (from: string, to: string) => Promise<void>) => {
      name = tagKey(name);
      if (name !== from) {
        if (!onRename) throw new Error("当前连接不支持标签重命名。");
        await onRename(from, name);
        renameTagColors(vaultId, from, name);
      }
      const change = (current: Preferences) => {
        const next = { pinned: [...new Set(current.pinned.map(path => renamedTag(path, from, name)))], icons: Object.fromEntries(Object.entries(current.icons).map(([path, value]) => [renamedTag(path, from, name), value])) };
        next.icons[name] = icon;
        return next;
      };
      const pending = vaultId && updateSharedTagPreferences(vaultId, change);
      if (pending) { await pending; return; }
      if (!save(change(preferences))) throw new Error("笔记已保存，但标签外观未能保存，请检查存储权限。");
    },
  };
}
