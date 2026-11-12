import { useState, type RefObject } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Separator } from "../components/separator";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "../components/drawer";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/accordion";
import { useIsMobile } from "../../src/hooks/use-mobile";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { TagDirectoryList } from "./TagDirectoryList";
import { TagIcon } from "./property-icon-catalog";
import { FilterChip, NoteTypeFilters } from "./NoteCollectionFilterChips";
import type { NoteCollectionFiltersProps } from "./NoteCollectionFilters";

export default function NoteCollectionFilterDrawer({ tags, vaultId, activeTags, quickFilters, filterCounts, disabled, onChange, open, onOpenChange, finalFocus }: NoteCollectionFiltersProps & { open: boolean; onOpenChange: (open: boolean) => void; finalFocus: RefObject<HTMLButtonElement | null> }) {
  const isMobile = useIsMobile();
  const { preferences } = useTagPreferences(vaultId);
  const [query, setQuery] = useState("");
  const count = activeTags.length + quickFilters.length;
  const known = new Set(tags.map(tag => tag.name));
  const unused = Object.keys(preferences.labels ?? {}).filter(name => !known.has(name)).map(name => ({ name, count: 0 }));
  const matchingTags = [...tags, ...unused].filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const sectionTriggerClass = "h-12 items-center border-0 px-2 py-0 text-secondary hover:no-underline";
  return <Drawer open={open} onOpenChange={onOpenChange} swipeDirection={isMobile ? "down" : "right"} showSwipeHandle={isMobile} onOpenChangeComplete={open => { if (!open) setQuery(""); }}>
    <DrawerContent finalFocus={finalFocus}>
      <DrawerHeader className="flex-row items-center justify-between gap-2 pl-6 pr-3.5 text-start group-data-[swipe-axis=y]/drawer-popup:pb-2">
        <DrawerTitle>筛选笔记</DrawerTitle>
        <DrawerDescription className="sr-only">类型单选，标签可多选；标签满足任一项，类型与标签同时满足，选择后立即生效。</DrawerDescription>
        <DrawerClose render={<Button variant="ghost" size="icon" aria-label="关闭筛选" />}><HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" strokeWidth={2} /></DrawerClose>
      </DrawerHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">
      <Accordion multiple defaultValue={["type", "tags"]} className="gap-2 rounded-none border-0">
      <AccordionItem value="type" className="flex flex-col gap-2 gap-y-1 border-0 not-last:border-0 data-open:bg-transparent">
        <AccordionTrigger className={sectionTriggerClass}>类型</AccordionTrigger>
        <AccordionContent className={() => "px-0 motion-reduce:transition-none"}>
        <NoteTypeFilters activeTags={activeTags} quickFilters={quickFilters} filterCounts={filterCounts} disabled={disabled} onChange={onChange} />
        </AccordionContent>
      </AccordionItem>
      <Separator />
      <AccordionItem value="tags" className="flex flex-col gap-2 gap-y-1 border-0 not-last:border-0 data-open:bg-transparent">
        <AccordionTrigger className={sectionTriggerClass}>标签</AccordionTrigger>
        <AccordionContent className={() => "px-0 motion-reduce:transition-none"}>
        <div role="group" aria-label="标签" className="flex flex-col gap-2">
        <Input aria-label="搜索筛选标签" placeholder="搜索标签…" value={query} onChange={event => setQuery(event.target.value)} />
          <TagDirectoryList className="ui-tag-directory-groups-flush" tags={matchingTags} renderTag={tag => <FilterChip label={tag.name} count={tag.count} icon={<TagIcon value={preferences.icons[tag.name]} />}
            ariaLabel={`筛选标签 ${tag.name}`} description={`${tag.count} 条笔记`} selected={activeTags.includes(tag.name)} disabled={disabled}
            onSelect={() => onChange(activeTags.includes(tag.name) ? activeTags.filter(value => value !== tag.name) : [...activeTags, tag.name], quickFilters)} />} />
          {matchingTags.length === 0 && <p role="status" className="px-2 py-3 text-sm text-secondary">{query.trim() ? "没有匹配的标签" : "暂无标签"}</p>}
        </div>
        </AccordionContent>
      </AccordionItem>
      </Accordion>
      </div>
      <DrawerFooter className="flex-row gap-2">
        <Button variant="outline" className="flex-1" disabled={disabled || count === 0} onClick={() => { setQuery(""); onChange([], []); }}>清除筛选</Button>
        <DrawerClose render={<Button className="flex-1" />}>完成</DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>;
}
