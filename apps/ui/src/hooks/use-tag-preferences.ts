import { useState, useSyncExternalStore } from "react";
import { tagKey } from "@/inline-tags";
import { renamedTag } from "@/rename-tag";
import { renameTagColors } from "@/tag-colors";

type Preferences = { pinned: string[]; icons: Record<string, string> };
const changeEvent = "memocard:tag-preferences";
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
  const key = `memocard:tags:${vaultId || "disconnected"}`;
  const raw = useSyncExternalStore(subscribe, () => read(key));
  const preferences = parse(raw);
  const [error, setError] = useState("");
  function save(next: Preferences) {
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(changeEvent)); setError(""); return true; }
    catch { setError("无法保存标签设置，请检查浏览器存储权限。"); return false; }
  }
  return {
    preferences, error,
    togglePinned: (path: string) => save({ ...preferences, pinned: preferences.pinned.includes(path) ? preferences.pinned.filter(x => x !== path) : [...preferences.pinned, path] }),
    saveAppearance: async (from: string, name: string, icon: string, onRename?: (from: string, to: string) => Promise<void>) => {
      name = tagKey(name);
      if (name !== from) {
        if (!onRename) throw new Error("当前连接不支持标签重命名。");
        await onRename(from, name);
        renameTagColors(vaultId, from, name);
      }
      const next = { pinned: [...new Set(preferences.pinned.map(path => renamedTag(path, from, name)))], icons: Object.fromEntries(Object.entries(preferences.icons).map(([path, value]) => [renamedTag(path, from, name), value])) };
      next.icons[name] = icon;
      if (!save(next)) throw new Error("笔记已保存，但标签外观未能保存，请检查存储权限。");
    },
  };
}
