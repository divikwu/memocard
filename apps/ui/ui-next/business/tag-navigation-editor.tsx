import { useId, useLayoutEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import Airplane01Icon from "@hugeicons/core-free-icons/Airplane01Icon";
import BulbIcon from "@hugeicons/core-free-icons/BulbIcon";
import Flag01Icon from "@hugeicons/core-free-icons/Flag01Icon";
import PawPrintIcon from "@hugeicons/core-free-icons/PawPrintIcon";
import ShapesIcon from "@hugeicons/core-free-icons/ShapesIcon";
import SmileIcon from "@hugeicons/core-free-icons/SmileIcon";
import SpoonAndForkIcon from "@hugeicons/core-free-icons/SpoonAndForkIcon";
import TrophyIcon from "@hugeicons/core-free-icons/TrophyIcon";
import emojiData from "../../src/lib/emoji-zh.json";
import { tagKey } from "../../src/inline-tags";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { Popover, PopoverContent } from "../components/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";
import { SidebarIcon } from "./sidebar-icons";
import { cn } from "../lib/utils";

const categories = {
  smileys_people: { label: "表情与人物", icon: SmileIcon },
  animals_nature: { label: "动物与自然", icon: PawPrintIcon },
  food_drink: { label: "食物与饮料", icon: SpoonAndForkIcon },
  travel_places: { label: "旅行与地点", icon: Airplane01Icon },
  activities: { label: "活动", icon: TrophyIcon },
  objects: { label: "物品", icon: BulbIcon },
  symbols: { label: "符号", icon: ShapesIcon },
  flags: { label: "旗帜", icon: Flag01Icon },
};
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
  const grid = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const updateEdges = () => {
      element.toggleAttribute("data-overflow-top", element.scrollTop > 1);
      element.toggleAttribute("data-overflow-bottom", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
    };
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    element.addEventListener("scroll", updateEdges, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", updateEdges); };
  }, [items.length]);
  return <section aria-label="选择图标" className="next-sidebar-emoji-picker">
    <div className="flex items-center justify-between"><span className="text-xs font-medium text-secondary">选择图标</span><Button type="button" size="xs" variant="ghost" aria-label="清除图标" disabled={disabled || !selected} onClick={() => onSelect("")}>清除</Button></div>
    <Input autoFocus={autoFocus} aria-label="搜索 Emoji" placeholder="搜索 Emoji" value={query} disabled={disabled} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && customEmoji && !disabled) onSelect(custom); } }} />
    {customEmoji && !items.length && <Button type="button" variant="outline" disabled={disabled} onClick={() => onSelect(custom)}>使用 <span className="next-sidebar-emoji">{custom}</span></Button>}
    <div ref={grid} aria-label="Emoji" className="next-sidebar-emoji-grid">{items.map(item => {
      const emoji = nativeEmoji(item.u);
      return <Button key={item.u} type="button" size="icon" variant="ghost" className={cn("text-xl", selected === emoji && "bg-control")} aria-label={item.n.join("、")} aria-pressed={selected === emoji} title={item.n.join("、")} disabled={disabled} onClick={() => onSelect(emoji)}><span className="next-sidebar-emoji">{emoji}</span></Button>;
    })}</div>
    {!items.length && !customEmoji && <p role="status" className="text-sm text-secondary">没有匹配的 Emoji</p>}
    <TooltipProvider><div role="group" aria-label="Emoji 分类" className="next-sidebar-emoji-categories">{Object.entries(categories).map(([key, { label, icon }]) => <Tooltip key={key}><TooltipTrigger render={<Button type="button" size="icon" variant="ghost" className={cn("text-icon-secondary", category === key && !needle && "bg-control text-primary")} aria-label={`Emoji 分类：${label}`} aria-pressed={category === key && !needle} disabled={disabled} onClick={() => { setCategory(key); setQuery(""); }}><HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" /></Button>} /><TooltipContent>{label}</TooltipContent></Tooltip>)}</div></TooltipProvider>
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
  const content = <div className="next-sidebar-tag-editor-content"><form className="grid gap-2" onSubmit={async event => {
    event.preventDefault();
    if (submitting.current || !name.trim()) return;
    submitting.current = true; setSaving(true); setError("");
    try { await onSave(name.trim(), icon); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请重试。"); }
    finally { submitting.current = false; setSaving(false); }
  }}>
    <Label htmlFor={id} className="sr-only">标签名称</Label>
    <div className="next-sidebar-tag-editor-controls"><Button type="button" variant="outline" size="icon" aria-label="选择 Emoji" aria-expanded={pickerOpen} disabled={saving} className="text-xl" onClick={() => setPickerOpen(!pickerOpen)}>{icon ? <span className="next-sidebar-emoji">{icon}</span> : <SidebarIcon name="hash" />}</Button><Input ref={input} id={id} value={name} disabled={saving} aria-describedby={`${id}-description`} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} /><Button type="submit" disabled={saving || !name.trim()}>{saving ? "保存中…" : "保存"}</Button></div>
    <p id={`${id}-description`} className="px-1 text-pretty text-xs leading-normal text-secondary">使用 / 分隔多级标签；改名会更新笔记中的标签。</p>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
  </form>{pickerOpen && <EmojiPicker selected={icon} disabled={saving} autoFocus={!mobile} onSelect={setIcon} />}</div>;
  if (mobile) return <Sheet open onOpenChange={(open, details) => { if (!open) { if (saving) details.cancel(); else onClose(); } }}><SheetContent side="bottom" className="next-sidebar-vault-sheet next-sidebar-tag-editor" showCloseButton={false} swipeToClose swipeDisabled={saving} initialFocus={input} finalFocus={returnFocus}><SheetHeader className="flex-row items-center justify-between p-0"><div><SheetTitle>编辑标签</SheetTitle><SheetDescription>调整标签名称与图标。</SheetDescription></div><SheetClose render={<Button type="button" variant="ghost" size="icon-sm" aria-label="关闭编辑标签" disabled={saving} />}><SidebarIcon name="close" /></SheetClose></SheetHeader>{content}</SheetContent></Sheet>;
  return <Popover open onOpenChange={(open, details) => { if (!open) { if (saving) details.cancel(); else onClose(); } }}><PopoverContent anchor={anchor} side="right" align="start" sideOffset={8} collisionPadding={12} aria-label="编辑标签" className="next-sidebar-tag-editor" initialFocus={input} finalFocus={returnFocus}>{content}</PopoverContent></Popover>;
}
