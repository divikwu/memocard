import { useState } from "react";
import emojiData from "@/lib/emoji-zh.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const categoryNames: Record<string, string> = { smileys_people: "表情与人物", animals_nature: "动物与自然", food_drink: "食物与饮料", travel_places: "旅行与地点", activities: "活动", objects: "物品", symbols: "符号", flags: "旗帜" };
const categories = Object.entries(categoryNames);
const emojis = emojiData.emojis as Record<string, { n: string[]; u: string }[]>;
export default function TagEmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(categories[0][0]);
  const needle = query.trim().toLocaleLowerCase();
  const items = (needle ? Object.values(emojis).flat() : emojis[category]).filter(item => !needle || item.n.some(name => name.toLocaleLowerCase().includes(needle)));
  return <div className="space-y-3">
    <Input aria-label="搜索 Emoji" placeholder="搜索 Emoji" value={query} onChange={event => setQuery(event.target.value)} />
    <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-full" aria-label="Emoji 分类"><SelectValue /></SelectTrigger><SelectContent>{categories.map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}</SelectContent></Select>
    <div aria-label="Emoji" className="grid max-h-60 grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1 overflow-y-auto">
      {items.map(item => { const emoji = String.fromCodePoint(...item.u.split("-").map(code => parseInt(code, 16))); return <Button key={item.u} type="button" variant="ghost" size="icon-sm" className="text-xl" aria-label={item.n.join("、")} title={item.n.join("、")} onClick={() => onSelect(emoji)}>{emoji}</Button>; })}
    </div>
    {!items.length && <p role="status" className="text-sm text-muted-foreground">没有匹配的 Emoji</p>}
  </div>;
}
