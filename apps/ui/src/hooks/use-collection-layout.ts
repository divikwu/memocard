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
    window.addEventListener(layoutEvent, sync);
    return () => window.removeEventListener(layoutEvent, sync);
  }, [key]);
  function changeLayout(next: Layout) {
    setLayout(next);
    try { localStorage.setItem(key, next); } catch { /* Keep switching available when browser storage is unavailable. */ }
    window.dispatchEvent(new CustomEvent<LayoutChange>(layoutEvent, { detail: { key, layout: next } }));
  }
  return [layout, changeLayout] as const;
}
