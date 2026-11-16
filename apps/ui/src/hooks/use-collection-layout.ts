import { useEffect, useState } from "react";
import { layoutKey, savedLayout, type Layout } from "@/components/note-collection-layout";

const layoutEvent = "memocard:collection-layout";
type LayoutChange = { key: string; layout: Layout };

export function useCollectionLayout(key = layoutKey, fallback: Layout = "cards") {
  const [layout, setLayout] = useState(() => savedLayout(key, fallback));
  useEffect(() => {
    const sync = (event: Event) => {
      const change = (event as CustomEvent<LayoutChange>).detail;
      if (change.key === key) setLayout(change.layout);
    };
    const syncStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === key || event.key === null)) setLayout(savedLayout(key, fallback));
    };
    window.addEventListener(layoutEvent, sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener(layoutEvent, sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, [key, fallback]);
  function changeLayout(next: Layout) {
    setLayout(next);
    try { localStorage.setItem(key, next); } catch { /* Keep switching available when browser storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent<LayoutChange>(layoutEvent, { detail: { key, layout: next } }));
  }
  return [layout, changeLayout] as const;
}
