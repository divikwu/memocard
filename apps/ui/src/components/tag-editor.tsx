import { lazy, Suspense, useRef, useState } from "react";
import { Tag } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
const EmojiPicker = lazy(() => import("./tag-emoji-picker"));

export function TagEditor({ path, initialIcon, anchor, onClose, onSave }: { path: string; initialIcon: string; anchor: HTMLElement; onClose: () => void; onSave: (name: string, icon: string) => Promise<void> }) {
  const isMobile = useIsMobile();
  const [name, setName] = useState(path);
  const [icon, setIcon] = useState(initialIcon);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  return <Popover open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <PopoverAnchor virtualRef={{ current: anchor }} />
    <PopoverContent side={isMobile ? "bottom" : "right"} align={isMobile ? "end" : "start"} collisionPadding={12} sideOffset={8} aria-label="编辑标签" className="w-96 max-w-[calc(100vw-24px)] max-h-(--radix-popover-content-available-height) overflow-y-auto p-3 shadow-md" onOpenAutoFocus={event => { event.preventDefault(); nameInput.current?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); anchor.focus(); }}>
        <form className="space-y-2" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { await onSave(name.trim(), icon); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请重试。"); } finally { setBusy(false); } }}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="选择 Emoji" aria-expanded={pickerOpen} disabled={busy} onClick={() => setPickerOpen(!pickerOpen)} className="text-lg">{icon || <Tag aria-hidden="true" />}</Button><Input ref={nameInput} aria-label="标签名称" value={name} onChange={event => setName(event.target.value)} disabled={busy} /><Button type="submit" className="px-3" disabled={busy || !name.trim()}>{busy ? "保存中…" : "保存"}</Button></div>
          <p className="px-1 text-pretty text-xs leading-5 text-muted-foreground">使用 / 分隔多级标签；改名会更新笔记中的标签。</p>
          {error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}
        </form>
        {pickerOpen && <div className="mt-3 border-t pt-3"><div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-medium text-muted-foreground">选择图标</span><Button type="button" variant="ghost" size="xs" className="text-muted-foreground" disabled={busy || !icon} onClick={() => setIcon("")}>清除</Button></div><Suspense fallback={<p role="status" className="px-1 py-3 text-sm text-muted-foreground">正在加载 Emoji…</p>}><EmojiPicker selected={icon} onSelect={setIcon} /></Suspense></div>}
    </PopoverContent>
  </Popover>;
}
