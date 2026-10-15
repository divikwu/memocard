import { cn } from "@/lib/utils";

export type Layout = "cards" | "list";
export const layoutKey = "memocard:note-layout";
export function savedLayout(key = layoutKey, fallback: Layout = "cards"): Layout {
  try { const saved = localStorage.getItem(key); return saved === "list" || saved === "cards" ? saved : fallback; }
  catch { return fallback; }
}
export function collectionClasses(cards: boolean) {
  return {
    gridClass: cards ? "grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4" : "@container flex flex-col",
    cardClass: cn("gap-0 overflow-hidden bg-card py-0", cards ? "h-64 rounded-[16px] border border-border shadow-[0_4px_12px_rgba(25,25,25,0.027),0_1px_2px_rgba(25,25,25,0.02)]" : "rounded-lg border-0 shadow-none"),
  };
}
