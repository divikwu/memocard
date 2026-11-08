import type { TagPreferences } from "@memocard/contracts";
import { useMemo, useState, useSyncExternalStore } from "react";
import { tagKey } from "@/inline-tags";
import { updatedTagReferences } from "@/tag-settings";
import { renameTagColors } from "@/tag-colors";

import { parseTagPreferences, sharedTagPreferences, tagPreferenceEvent, tagPreferenceKey, updateSharedTagPreferences } from "@/shared-tag-preferences";

type Preferences = TagPreferences;
const changeEvent = tagPreferenceEvent;
function subscribe(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(changeEvent, callback); window.removeEventListener("storage", callback); };
}
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }

export function useTagPreferences(vaultId?: string | null) {
  const key = tagPreferenceKey(vaultId);
  const raw = useSyncExternalStore(subscribe, () => (vaultId && sharedTagPreferences(vaultId)?.raw) || read(key));
  const sharedError = useSyncExternalStore(subscribe, () => (vaultId && sharedTagPreferences(vaultId)?.error) || "");
  const preferences = useMemo(() => parseTagPreferences(raw), [raw]);
  const [error, setError] = useState("");
  function save(next: Preferences) {
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(changeEvent)); setError(""); return true; }
    catch { setError("无法保存标签设置，请检查浏览器存储权限。"); return false; }
  }
  return {
    preferences, error: sharedError || error,
    updatePreferences: async (change: (current: Preferences) => Preferences) => {
      const pending = vaultId && updateSharedTagPreferences(vaultId, change);
      if (pending) await pending;
      else if (!save(change(parseTagPreferences(read(key))))) throw new Error("无法保存标签设置，请检查浏览器存储权限。");
    },
    togglePinned: (path: string) => {
      const pinned = !preferences.pinned.includes(path);
      const change = (current: Preferences) => ({...current,pinned:pinned ? [...new Set([...current.pinned,path])] : current.pinned.filter(x => x !== path)});
      const pending = vaultId && updateSharedTagPreferences(vaultId, change);
      if (pending) return pending.then(() => true, () => false);
      return save(change(preferences));
    },
    saveAppearance: async (from: string, name: string, icon: string | undefined, onRename?: (from: string, to: string) => Promise<void>) => {
      name = tagKey(name);
      const renamed = name !== tagKey(from);
      if (renamed) {
        if (!onRename) throw new Error("当前连接不支持标签重命名。");
        await onRename(from, name);
        renameTagColors(vaultId, from, name);
      }
      const change = (current: Preferences) => {
        if (!renamed) return icon === undefined ? current : {...current, icons:{...current.icons, [name]:icon}};
        const next = updatedTagReferences(current, from, name);
        return icon === undefined ? next : {...next, icons:{...next.icons, [name]:icon}};
      };
      const pending = vaultId && updateSharedTagPreferences(vaultId, change, {optimistic:!renamed});
      if (pending) await pending;
      else if (!save(change(parseTagPreferences(read(key))))) throw new Error("笔记已保存，但标签外观未能保存，请检查存储权限。");
      if (renamed) window.dispatchEvent(new CustomEvent("memocard:event", {detail: {type: "tagsChanged"}}));
    },
  };
}
