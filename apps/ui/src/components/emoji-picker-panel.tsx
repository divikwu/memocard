import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";

const EmojiPicker = lazy(() => import("./tag-emoji-picker"));

export function EmojiPickerPanel({ selected, disabled = false, onSelect }: { selected: string; disabled?: boolean; onSelect: (emoji: string) => void }) {
  return <>
    <div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-medium text-secondary">选择图标</span><Button type="button" variant="ghost" size="xs" className="text-secondary" disabled={disabled || !selected} onClick={() => onSelect("")}>清除</Button></div>
    <Suspense fallback={<p role="status" className="px-1 py-3 text-sm text-secondary">正在加载 Emoji…</p>}><EmojiPicker selected={selected} disabled={disabled} onSelect={onSelect} /></Suspense>
  </>;
}
