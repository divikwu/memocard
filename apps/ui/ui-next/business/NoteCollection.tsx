import { lazy, Suspense, type ReactNode } from "react";
import type { Note } from "@memocard/contracts";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import Clock03Icon from "@hugeicons/core-free-icons/Clock03Icon";
import GridViewIcon from "@hugeicons/core-free-icons/GridViewIcon";
import LeftToRightListBulletIcon from "@hugeicons/core-free-icons/LeftToRightListBulletIcon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import { useCollectionLayout } from "../../src/hooks/use-collection-layout";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { Card, CardContent } from "../components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/empty";
import { Input } from "../components/input";
import { Skeleton } from "../components/skeleton";
import { Spinner } from "../components/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants, tabsTriggerStyles } from "../components/tabs";
import { AddIcon, CloseIcon, DocumentIcon, SearchIcon } from "../icons";
import { cn } from "../lib/utils";
import "./NoteCollection.css";
const NotePreview = lazy(() => import("./NotePreview").then(module => ({ default: module.NotePreview })));

export type NoteCollectionProps = {
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

function CollectionSkeleton({ cards }: { cards: boolean }) {
  return <div className={cn("next-note-items", cards ? "next-note-cards" : "next-note-list")} data-slot="collection-skeleton" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5].map(item => <Card key={item} className={cn("next-note-card", !cards && "next-note-list-card")}>
      <CardContent className="next-note-skeleton-content">
        <Skeleton className={item % 2 ? "h-5 w-3/4" : "h-5 w-2/3"} />
        {cards && <><Skeleton className="h-4 w-28" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /></>}
        <div className="flex gap-2"><Skeleton className="h-5 w-14 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
      </CardContent>
    </Card>)}
  </div>;
}

export function NoteCollection({ home, notes, loading = false, searching = false, query, onQueryChange, searchPlaceholder, searchDisabled, children, hasMore, paging, loadMoreDisabled, canOpen, canCreate, onNewNote, onOpen, onSelectTag, onLoadMore, onError, formatDate }: NoteCollectionProps) {
  const [layout, changeLayout] = useCollectionLayout(home ? "memocard:home-layout" : "memocard:note-layout", home ? "list" : "cards");
  const cards = layout === "cards";
  const layoutButtons = <div role="group" aria-label={home ? "主页布局" : "笔记布局"} data-variant="default" className={cn(tabsListVariants(), "next-note-layout")}>
    <button type="button" className={tabsTriggerStyles} aria-label="卡片布局" title="卡片布局" aria-pressed={cards} onClick={() => changeLayout("cards")}><HugeiconsIcon icon={GridViewIcon} aria-hidden="true" strokeWidth={2} /></button>
    <button type="button" className={tabsTriggerStyles} aria-label="列表布局" title="列表布局" aria-pressed={!cards} onClick={() => changeLayout("list")}><HugeiconsIcon icon={LeftToRightListBulletIcon} aria-hidden="true" strokeWidth={2} /></button>
  </div>;
  const content = <>
    {loading && <span role="status" aria-label={searching ? "正在搜索笔记" : "正在读取笔记库"} className="sr-only">{searching ? "正在搜索笔记…" : "正在读取笔记库…"}</span>}
    <div className="next-note-results" aria-busy={loading}>
      {notes.length ? <ul aria-label="笔记列表" data-layout={layout} className={cn("next-note-items", cards ? "next-note-cards" : "next-note-list")}>
        {notes.map(note => {
          const title = note.title?.trim() || "新内容";
          const date = home ? note.updatedAt : note.createdAt;
          return <li key={note.id} data-note-id={note.id}>
            <Card className={cn("next-note-card", !cards && "next-note-list-card shadow-none ring-0")} data-note-openable={canOpen}>
              <CardContent className={cn("next-note-content", !cards && "next-note-list-content")}>
                {cards ? <div className="next-note-heading">
                  <h2><button type="button" className="next-note-open" aria-label={`打开 ${title}`} disabled={!canOpen} onClick={() => onOpen(note.id)}>{title}</button></h2>
                  <time dateTime={date}>{formatDate(date)}</time>
                </div> : <h2 className="next-note-list-heading">
                  <button type="button" className="next-note-open next-note-row-open" aria-label={`打开 ${title}`} disabled={!canOpen} onClick={() => onOpen(note.id)}>
                    <span className="next-note-list-title">{title}</span>
                    <time className="next-note-list-date" dateTime={date}>{formatDate(date)}</time>
                  </button>
                </h2>}
                {cards && <div className="next-note-preview"><Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}><NotePreview compact showTitle={false} hiddenTags={note.tags} title={note.title} body={note.body} notePath={note.relativePath} onError={onError} /></Suspense></div>}
                {note.tags.length > 0 && <div className="next-note-tags">
                  {note.tags.slice(0, 2).map(name => <Badge key={name} variant="secondary" className="next-note-tag" render={<button type="button" />} aria-label={`筛选标签 ${name}`} title={name} data-tag={encodeURIComponent(name)} onClick={() => onSelectTag(name)}><span>{name}</span></Badge>)}
                  {note.tags.length > 2 && <span className="next-note-tag-count" aria-label={`另有 ${note.tags.length - 2} 个标签`}>+{note.tags.length - 2}</span>}
                </div>}
              </CardContent>
            </Card>
          </li>;
        })}
      </ul> : loading ? <CollectionSkeleton cards={cards} /> : children !== undefined ? children : <Empty className="next-note-empty border">
        <EmptyHeader><EmptyMedia variant="icon"><DocumentIcon aria-hidden="true" /></EmptyMedia><EmptyTitle>{query ? "没有找到相关笔记" : home?.tab === "pinned" ? "把常用笔记固定在这里" : "记下第一条笔记"}</EmptyTitle><EmptyDescription>{query ? "换一个关键词，或清空当前搜索。" : home?.tab === "pinned" ? "在笔记详情中固定后，可以从主页快速打开。" : "一句想法、一段发现，不必想好标题。"}</EmptyDescription></EmptyHeader>
        {query ? <EmptyContent><Button variant="outline" disabled={searchDisabled} onClick={() => onQueryChange("")}>清空搜索</Button></EmptyContent> : home?.tab !== "pinned" && <EmptyContent><Button disabled={!canCreate} onClick={onNewNote}><AddIcon aria-hidden="true" />新建笔记</Button></EmptyContent>}
      </Empty>}
      {hasMore && <div className="next-note-pagination"><Button variant="outline" size="sm" aria-label="加载更多" aria-busy={paging} onClick={onLoadMore} disabled={loadMoreDisabled || paging}>{paging ? <Spinner aria-hidden="true" /> : <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden="true" strokeWidth={2} />}{paging ? "正在加载…" : "加载更多"}</Button>{paging && <span role="status" className="sr-only">正在加载更多笔记…</span>}</div>}
    </div>
  </>;

  if (home) return <Tabs value={home.tab} onValueChange={value => { if (value === "recent" || value === "pinned") home.onTabChange(value); }} className="next-note-collection" data-slot="note-collection">
    <div className="next-note-toolbar"><div className="next-note-home-tabs"><TabsList variant="line" activateOnFocus aria-label="主页内容"><TabsTrigger value="recent"><HugeiconsIcon icon={Clock03Icon} aria-hidden="true" strokeWidth={2} />最近更新</TabsTrigger><TabsTrigger value="pinned"><HugeiconsIcon icon={PinIcon} aria-hidden="true" strokeWidth={2} />已固定<span className="text-xs text-secondary tabular-nums">{home.pinnedCount}</span></TabsTrigger></TabsList></div><div className="next-note-actions">{loading && notes.length > 0 && <Spinner aria-hidden="true" className="text-icon-secondary" />}{layoutButtons}</div></div>
    <TabsContent value={home.tab}>{content}</TabsContent>
  </Tabs>;

  return <section className="next-note-collection" data-slot="note-collection" aria-label="笔记集合">
    <div className="next-note-toolbar">
      <div className="next-note-search">{loading ? <Spinner aria-hidden="true" className="next-note-search-icon" /> : <SearchIcon aria-hidden="true" className="next-note-search-icon" />}<Input value={query} onChange={event => onQueryChange(event.target.value)} placeholder={searchPlaceholder} aria-label="搜索当前视图笔记" disabled={searchDisabled} className="next-note-search-input" />{query && <Button type="button" variant="ghost" size="icon-xs" className="next-note-search-clear" onClick={() => onQueryChange("")} disabled={searchDisabled} aria-label="清空当前搜索"><CloseIcon aria-hidden="true" /></Button>}</div>
      <div className="next-note-actions">{layoutButtons}<Button type="button" variant="outline" size="default" disabled={!canCreate} onClick={onNewNote}><AddIcon aria-hidden="true" />新建</Button></div>
    </div>
    {content}
  </section>;
}
