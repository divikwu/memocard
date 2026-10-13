import { useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NameEditor } from "./name-editor";
import { EmojiPickerPanel } from "./emoji-picker-panel";

export function TagEditor({ path, initialIcon, anchor, onClose, onSave }: { path: string; initialIcon: string; anchor: HTMLElement; onClose: () => void; onSave: (name: string, icon: string) => Promise<void> }) {
  const [icon, setIcon] = useState(initialIcon);
  const [pickerOpen, setPickerOpen] = useState(false);
  return <NameEditor initialName={path} anchor={anchor} title="编辑标签" inputLabel="标签名称" description="使用 / 分隔多级标签；改名会更新笔记中的标签。" onClose={onClose} onSave={name => onSave(name, icon)} leading={busy => <Button type="button" variant="outline" size="icon" aria-label="选择 Emoji" aria-expanded={pickerOpen} disabled={busy} onClick={() => setPickerOpen(!pickerOpen)} className="text-lg">{icon || <Tag aria-hidden="true" />}</Button>}>
    {busy => pickerOpen && <div className="-mx-3 mt-3 border-t px-3 pt-3"><EmojiPickerPanel selected={icon} disabled={busy} onSelect={setIcon} /></div>}
  </NameEditor>;
}
