import { useState, type ReactNode } from "react";
import { ArrowDown, Clock3, LayoutGrid, List, LoaderCircle, Pin, Plus, Search, X } from "lucide-react";
import type { Note } from "@memocard/contracts";
import { NotePreview } from "../NotePreview";
import TagPill from "../TagPill";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "@/lib/utils";

import { collectionClasses, layoutKey, savedLayout, type Layout } from "./note-collection-layout";
import { LoadingCollectionItems } from "./loading-states";

type NoteCollectionProps = {
  home?: { tab: "recent" | "pinned"; pinnedCount: number; onTabChange: (tab: "recent" | "pinned") => void };
  notes: Note[];
  loading?: boolean;
  searching?: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  searchDisabled: boolean;
  children?: ReactNode;
  hasMore: boolean;
  paging: boolean;
  loadMoreDisabled: boolean;
  canOpen: boolean;
  canCreate: boolean;
  onNewNote: () => void;
  onOpen: (id: string) => void;
  onSelectTag: (tag: string) => void;
  onLoadMore: () => void;
  onError: (message: string) => void;
  formatDate: (value: string) => string;
};

export function NoteCollection({ home, notes, loading = false, searching = false, query, onQueryChange, searchPlaceholder, searchDisabled, children, hasMore, paging, loadMoreDisabled, canOpen, canCreate, onNewNote, onOpen, onSelectTag, onLoadMore, onError, formatDate }: NoteCollectionProps) {
  const storageKey = home ? "memocard:home-layout" : layoutKey;
  const [layout, setLayout] = useState<Layout>(() => savedLayout(storageKey, home ? "list" : "cards"));
  const cards = layout === "cards";
  const { gridClass, cardClass } = collectionClasses(cards);
  function changeLayout(next: Layout) {
    setLayout(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep switching available when browser storage is unavailable. */ }
  }
  const collection = <>
    {loading && <span role="status" aria-label={searching ? "正在搜索笔记" : "正在读取笔记库"} className="sr-only">{searching ? "正在搜索笔记…" : "正在读取笔记库…"}</span>}
    <div className="space-y-4" aria-busy={loading}>{notes.length ? <ul aria-label="笔记列表" data-layout={layout} className={gridClass}>
      {notes.map(note => <li key={note.id} data-note-id={note.id} className="min-w-0">
        <Card className={cn(cardClass, "transition-colors hover:bg-hover has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40")}>
          <CardContent className={cn("flex h-full min-h-0 p-0", cards ? "flex-col" : "flex-row flex-wrap items-center sm:flex-nowrap")}>
            <button type="button" className={cn("flex min-h-0 min-w-0 flex-1 flex-col text-left outline-none disabled:cursor-default", !cards && "basis-full sm:basis-auto")} aria-label={`打开 ${note.title?.trim() || "新内容"}`} onClick={() => onOpen(note.id)} disabled={!canOpen}>
              <div className={cn("w-full", cards ? "px-4 pb-2 pt-4" : "px-2 py-2")}>
                <span className={cn("block min-w-0 truncate font-medium", cards ? "text-base" : "text-sm")}>{note.title?.trim() || "新内容"}</span>
                {cards && <time className="mt-1 block text-xs tabular-nums text-muted-foreground/80" dateTime={home ? note.updatedAt : note.createdAt}>{formatDate(home ? note.updatedAt : note.createdAt)}</time>}
              </div>
              {cards && <div className="min-h-0 w-full flex-1 overflow-hidden px-4 pb-4">
                <NotePreview compact showTitle={false} hiddenTags={note.tags} title={note.title} body={note.body} notePath={note.relativePath} onError={onError} />
              </div>}
            </button>
            {note.tags.length > 0 && <div className={cn("flex items-center gap-2 overflow-hidden", cards ? "min-h-10 px-4 pb-3" : "min-w-0 max-w-[calc(100%-7rem)] shrink-0 px-2 pb-2 sm:max-w-1/3 sm:pb-0 sm:pl-0")}>
              {note.tags.slice(0, 2).map(name => <TagPill key={name} name={name} render={<button type="button" aria-label={`筛选标签 ${name}`} onClick={() => onSelectTag(name)} />} className={cn("h-5 px-1.5 py-0 font-normal", !cards && "min-w-0 shrink")}><span className="truncate">{name}</span></TagPill>)}
              {note.tags.length > 2 && <span className="shrink-0 text-xs text-muted-foreground/60">+{note.tags.length - 2}</span>}
            </div>}
            {!cards && <time className="ml-auto w-28 shrink-0 whitespace-nowrap pb-2 pr-2 text-right text-xs tabular-nums text-muted-foreground/80 sm:ml-0 sm:pb-0" dateTime={home ? note.updatedAt : note.createdAt}>{formatDate(home ? note.updatedAt : note.createdAt)}</time>}
          </CardContent>
        </Card>
      </li>)}
    </ul> : loading ? <LoadingCollectionItems cards={cards} /> : children}
    {hasMore && <div className="flex justify-center pt-3"><Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadMoreDisabled}>{paging ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowDown className="size-4" />}加载更多</Button></div>}
  </div></>;
  if (home) return <Tabs value={home.tab} onValueChange={value => { if (value === "recent" || value === "pinned") home.onTabChange(value); }} className="gap-4">
    <div className="flex items-center justify-between gap-3">
      <TabsList variant="line" aria-label="主页内容" className="gap-2">
        <TabsTrigger value="recent" className="px-1"><Clock3 aria-hidden="true" />最近更新</TabsTrigger>
        <TabsTrigger value="pinned"><Pin aria-hidden="true" />已固定<span className="text-xs tabular-nums text-muted-foreground">{home.pinnedCount}</span></TabsTrigger>
      </TabsList>
      <div role="group" aria-label="主页布局" className="relative flex shrink-0 rounded-lg bg-muted p-[3px]">
        {loading && notes.length > 0 && <LoaderCircle aria-hidden="true" style={{left:-24}} className="absolute top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground motion-reduce:animate-none" />}
        <Button variant="ghost" size="icon-sm" aria-label="卡片布局" title="卡片布局" aria-pressed={cards} className="text-foreground/60 hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground" onClick={() => changeLayout("cards")}><LayoutGrid /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="列表布局" title="列表布局" aria-pressed={!cards} className="text-foreground/60 hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground" onClick={() => changeLayout("list")}><List /></Button>
      </div>
    </div>
    <TabsContent value={home.tab}>{collection}</TabsContent>
  </Tabs>;
  return <Tabs value={layout} onValueChange={value => { if (value === "cards" || value === "list") changeLayout(value); }} className="@container gap-4">
    <div className="grid grid-cols-1 items-center gap-3 text-xs text-muted-foreground @xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="relative min-w-0 @xl:w-60">
        {loading ? <LoaderCircle aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin motion-reduce:animate-none" /> : <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />}
        <Input value={query} onChange={event => onQueryChange(event.target.value)} placeholder={searchPlaceholder} aria-label="搜索当前视图笔记" disabled={searchDisabled} className="h-8 bg-background pl-8 pr-8 text-foreground" />
        {query && <Button type="button" variant="ghost" size="icon-xs" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => onQueryChange("")} disabled={searchDisabled} aria-label="清空当前搜索"><X className="size-3" /></Button>}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <TabsList aria-label="笔记布局" className="group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger value="cards" aria-label="卡片布局" title="卡片布局" className="size-8 flex-none p-0 hover:bg-hover"><LayoutGrid aria-hidden="true" className="size-4" /></TabsTrigger>
          <TabsTrigger value="list" aria-label="列表布局" title="列表布局" className="size-8 flex-none p-0 hover:bg-hover"><List aria-hidden="true" className="size-4" /></TabsTrigger>
        </TabsList>
        <Button type="button" variant="outline" size="sm" className="text-foreground" disabled={!canCreate} onClick={onNewNote}><Plus aria-hidden="true" className="size-4" />新建</Button>
      </div>
    </div>
    <TabsContent value={layout} className="space-y-4">{collection}</TabsContent>
  </Tabs>;
}
