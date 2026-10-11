import { lazy, Suspense, useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NameEditor } from "./name-editor";
const EmojiPicker = lazy(() => import("./tag-emoji-picker"));

export function TagEditor({ path, initialIcon, anchor, onClose, onSave }: { path: string; initialIcon: string; anchor: HTMLElement; onClose: () => void; onSave: (name: string, icon: string) => Promise<void> }) {
  const [icon, setIcon] = useState(initialIcon);
  const [pickerOpen, setPickerOpen] = useState(false);
  return <NameEditor initialName={path} anchor={anchor} title="编辑标签" inputLabel="标签名称" description="使用 / 分隔多级标签；改名会更新笔记中的标签。" onClose={onClose} onSave={name => onSave(name, icon)} leading={busy => <Button type="button" variant="outline" size="icon" aria-label="选择 Emoji" aria-expanded={pickerOpen} disabled={busy} onClick={() => setPickerOpen(!pickerOpen)} className="text-lg">{icon || <Tag aria-hidden="true" />}</Button>}>
    {busy => pickerOpen && <div className="-mx-3 mt-3 border-t px-3 pt-3"><div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-medium text-muted-foreground">选择图标</span><Button type="button" variant="ghost" size="xs" className="text-muted-foreground" disabled={busy || !icon} onClick={() => setIcon("")}>清除</Button></div><Suspense fallback={<p role="status" className="px-1 py-3 text-sm text-muted-foreground">正在加载 Emoji…</p>}><EmojiPicker selected={icon} onSelect={setIcon} /></Suspense></div>}
  </NameEditor>;
}
