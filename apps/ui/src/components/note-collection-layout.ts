export type Layout = "cards" | "list";
export const layoutKey = "memocard:note-layout";
export function savedLayout(key = layoutKey, fallback: Layout = "cards"): Layout {
  try { const saved = localStorage.getItem(key); return saved === "list" || saved === "cards" ? saved : fallback; }
  catch { return fallback; }
}
