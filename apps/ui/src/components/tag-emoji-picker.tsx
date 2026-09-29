import { useState } from "react";
import { Flag, Lightbulb, PawPrint, Plane, Shapes, Smile, Trophy, Utensils } from "lucide-react";
import emojiData from "@/lib/emoji-zh.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const categoryNames: Record<string, string> = { smileys_people: "表情与人物", animals_nature: "动物与自然", food_drink: "食物与饮料", travel_places: "旅行与地点", activities: "活动", objects: "物品", symbols: "符号", flags: "旗帜" };
const categoryIcons = { smileys_people: Smile, animals_nature: PawPrint, food_drink: Utensils, travel_places: Plane, activities: Trophy, objects: Lightbulb, symbols: Shapes, flags: Flag };
const categories = Object.entries(categoryNames) as [keyof typeof categoryIcons, string][];
const emojis = emojiData.emojis as Record<string, { n: string[]; u: string }[]>;
export default function TagEmojiPicker({ selected = "", onSelect }: { selected?: string; onSelect: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(categories[0][0]);
  const needle = query.trim().toLocaleLowerCase();
  const items = (needle ? Object.values(emojis).flat() : emojis[category]).filter(item => !needle || item.n.some(name => name.toLocaleLowerCase().includes(needle)));
  return <div className="space-y-2">
    <Input autoFocus aria-label="搜索 Emoji" placeholder="搜索 Emoji" value={query} onChange={event => setQuery(event.target.value)} />
    <div aria-label="Emoji" className="-mx-1 grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1 overflow-y-auto overscroll-contain px-1">
      {items.map(item => { const emoji = String.fromCodePoint(...item.u.split("-").map(code => parseInt(code, 16))); return <Button key={item.u} type="button" variant="ghost" size="icon-sm" className={cn("text-lg", selected === emoji && "bg-accent text-accent-foreground")} aria-label={item.n.join("、")} aria-pressed={selected === emoji} title={item.n.join("、")} onClick={() => onSelect(emoji)}>{emoji}</Button>; })}
    </div>
    {!items.length && <p role="status" className="text-sm text-muted-foreground">没有匹配的 Emoji</p>}
    <TooltipProvider>
      <div aria-label="Emoji 分类" className="-mx-1 flex items-center justify-between border-t px-1 pt-2">
        {categories.map(([key, label]) => { const Icon = categoryIcons[key]; return <Tooltip key={key}><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" className={cn("text-muted-foreground", category === key && !needle && "bg-accent text-accent-foreground")} aria-label={`Emoji 分类：${label}`} aria-pressed={category === key && !needle} onClick={() => { setCategory(key); setQuery(""); }}><Icon /></Button></TooltipTrigger><TooltipContent side="top" sideOffset={6}>{label}</TooltipContent></Tooltip>; })}
      </div>
    </TooltipProvider>
  </div>;
}
