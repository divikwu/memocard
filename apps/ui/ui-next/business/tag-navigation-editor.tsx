import { useId, useRef, useState } from "react";
import emojiData from "../../src/lib/emoji-zh.json";
import { tagKey } from "../../src/inline-tags";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/sheet";
import { SidebarIcon } from "./sidebar-icons";
import { cn } from "../lib/utils";

const categories = { smileys_people: "表情与人物", animals_nature: "动物与自然", food_drink: "食物与饮料", travel_places: "旅行与地点", activities: "活动", objects: "物品", symbols: "符号", flags: "旗帜" };
const emojis = emojiData.emojis as Record<string, { n: string[]; u: string }[]>;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const nativeEmoji = (code: string) => String.fromCodePoint(...code.split("-").map(value => parseInt(value, 16)));

export function EmojiPicker({ selected, disabled, onSelect, autoFocus = false }: { selected: string; disabled: boolean; onSelect: (emoji: string) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("smileys_people");
  const custom = query.trim();
  const needle = custom.toLocaleLowerCase();
  const customEmoji = custom.length <= 32 && [...segmenter.segment(custom)].length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(custom);
  const items = (needle ? Object.values(emojis).flat() : emojis[category]).filter(item => !needle || nativeEmoji(item.u) === custom || item.n.some(name => name.toLocaleLowerCase().includes(needle)));
  return <section aria-label="选择图标" className="grid gap-2 border-t border-border pt-3">
    <div className="flex items-center justify-between"><span className="text-sm font-medium">选择图标</span><Button type="button" size="xs" variant="ghost" disabled={disabled || !selected} onClick={() => onSelect("")}>清除图标</Button></div>
    <Input autoFocus={autoFocus} aria-label="搜索 Emoji" placeholder="搜索 Emoji" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && customEmoji && !disabled) onSelect(custom); } }} />
    {customEmoji && !items.length && <Button type="button" variant="outline" disabled={disabled} onClick={() => onSelect(custom)}>使用 <span className="next-sidebar-emoji">{custom}</span></Button>}
    <div aria-label="Emoji" className="next-sidebar-emoji-grid">{items.map(item => {
      const emoji = nativeEmoji(item.u);
      return <Button key={item.u} type="button" size="icon-sm" variant="ghost" className={cn("text-xl", selected === emoji && "bg-accent-muted")} aria-label={item.n.join("、")} aria-pressed={selected === emoji} title={item.n.join("、")} disabled={disabled} onClick={() => onSelect(emoji)}><span className="next-sidebar-emoji">{emoji}</span></Button>;
    })}</div>
    {!items.length && !customEmoji && <p role="status" className="text-sm text-secondary">没有匹配的 Emoji</p>}
    <div role="group" aria-label="Emoji 分类" className="next-sidebar-emoji-categories">{Object.entries(categories).map(([key, label]) => <Button key={key} type="button" size="xs" variant={category === key && !needle ? "secondary" : "ghost"} aria-label={`Emoji 分类：${label}`} aria-pressed={category === key && !needle} disabled={disabled} onClick={() => { setCategory(key); setQuery(""); }}>{label}</Button>)}</div>
  </section>;
}

export function TagEditor({ path, initialIcon, anchor, mobile, onClose, onSave }: { path: string; initialIcon: string; anchor: HTMLElement; mobile: boolean; onClose: () => void; onSave: (name: string, icon: string) => Promise<void> }) {
  const id = useId();
  const [name, setName] = useState(path);
  const [icon, setIcon] = useState(initialIcon);
  const [pickerOpen, setPickerOpen] = useState(mobile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const navigation = useRef(anchor.closest('[data-slot="sidebar-content"]'));
  const returnFocus = () => {
    if (anchor.isConnected) return anchor;
    const buttons = [...navigation.current?.querySelectorAll<HTMLButtonElement>("button") ?? []];
    return buttons.find(button => button.getAttribute("aria-label") === tagKey(name)) ?? buttons[0] ?? false;
  };
  const content = <form className="grid gap-3" onSubmit={async event => {
    event.preventDefault();
    if (submitting.current || !name.trim()) return;
    submitting.current = true; setSaving(true); setError("");
    try { await onSave(name.trim(), icon); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请重试。"); }
    finally { submitting.current = false; setSaving(false); }
  }}>
    <Label htmlFor={id}>标签名称</Label>
    <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="选择 Emoji" aria-expanded={pickerOpen} disabled={saving} className="text-xl" onClick={() => setPickerOpen(!pickerOpen)}>{icon ? <span className="next-sidebar-emoji">{icon}</span> : <SidebarIcon name="hash" />}</Button><Input ref={input} id={id} value={name} disabled={saving} aria-describedby={`${id}-description`} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} /></div>
    <p id={`${id}-description`} className="text-sm text-secondary">使用 / 分隔多级标签；改名会更新笔记中的标签。</p>
    {pickerOpen && <EmojiPicker selected={icon} disabled={saving} onSelect={setIcon} />}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>取消</Button><Button type="submit" disabled={saving || !name.trim()}>{saving ? "保存中…" : "保存"}</Button></div>
  </form>;
  if (mobile) return <Sheet open onOpenChange={(open, details) => { if (!open) { if (saving) details.cancel(); else onClose(); } }}><SheetContent side="bottom" className="next-sidebar-vault-sheet next-sidebar-tag-editor" showCloseButton={false} swipeToClose swipeDisabled={saving} initialFocus={input} finalFocus={returnFocus}><SheetHeader className="flex-row items-center justify-between p-0"><div><SheetTitle>编辑标签</SheetTitle><SheetDescription>调整标签名称与图标。</SheetDescription></div><SheetClose render={<Button type="button" variant="ghost" size="icon-sm" aria-label="关闭编辑标签" disabled={saving} />}><SidebarIcon name="close" /></SheetClose></SheetHeader>{content}</SheetContent></Sheet>;
  return <Dialog open onOpenChange={(open, details) => { if (!open) { if (saving) details.cancel(); else onClose(); } }}><DialogContent className="next-sidebar-tag-editor" showCloseButton={false} initialFocus={input} finalFocus={returnFocus}><DialogHeader><DialogTitle>编辑标签</DialogTitle><DialogDescription>调整标签名称与图标。</DialogDescription></DialogHeader>{content}</DialogContent></Dialog>;
}
