import { recoverableLazy } from "../components/recoverable-lazy";
import { Suspense, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from "react";
import type { Note } from "@memocard/contracts";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import Clock03Icon from "@hugeicons/core-free-icons/Clock03Icon";
import GridViewIcon from "@hugeicons/core-free-icons/GridViewIcon";
import LeftToRightListBulletIcon from "@hugeicons/core-free-icons/LeftToRightListBulletIcon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import { useCollectionLayout } from "../../src/hooks/use-collection-layout";
import { Button } from "../components/button";
import { CreateButton } from "./CreateButton";
import { Badge } from "../components/badge";
import { Card, CardContent } from "../components/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/empty";
import { Skeleton } from "../components/skeleton";
import { Spinner } from "../components/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants, tabsPillTriggerStyles, tabsTriggerStyles } from "../components/tabs";
import { TooltipHints } from "../components/tooltip";
import { DocumentIcon } from "../icons";
import { cn } from "../lib/utils";
import "./NoteCollection.css";
const NoteCardPreview = recoverableLazy(() => import("./NoteCardPreview").then(module => ({ default: module.NoteCardPreview })), "笔记卡片预览");

function clearCardPress(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType === "touch" && event.isPrimary) event.currentTarget.removeAttribute("data-touch-pressed");
}

export type NoteCollectionProps = {
  home?: { tab: "recent" | "pinned"; pinnedCount: number; onTabChange: (tab: "recent" | "pinned") => void };
  heading?: ReactNode;
  notes: Note[];
  activeTag?: string | null;
  recentTags?: string[];
  loading?: boolean;
  tagFiltersDisabled?: boolean;
  children?: ReactNode;
  hasMore: boolean;
  paging: boolean;
  loadMoreDisabled: boolean;
  canOpen: boolean;
  canCreate: boolean;
  showCreateInToolbar?: boolean;
  onNewNote: () => void;
  onOpen: (id: string) => void;
  onSelectTag: (tag: string) => void;
  onSelectRecentTag?: (tag: string) => void;
  onSelectAll?: () => void;
  onLoadMore: () => void;
  onError: (message: string) => void;
  formatDate: (value: string) => string;
};

function CollectionSkeleton({ cards }: { cards: boolean }) {
  return <div className={cn("ui-note-items", cards ? "ui-note-cards" : "ui-note-list")} data-slot="collection-skeleton" aria-hidden="true">
    {[0, 1, 2, 3, 4, 5].map(item => <Card key={item} className={cn("ui-note-card", !cards && "ui-note-list-card shadow-none ring-0")}>
      {cards ? <CardContent className="ui-note-skeleton-content">
        <Skeleton className={item % 2 ? "h-5 w-3/4" : "h-5 w-2/3"} />
        <Skeleton className="h-4 w-28" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" />
      </CardContent> : <CardContent className="ui-note-content ui-note-list-content">
        <div className="ui-note-list-heading">
          <div className="ui-note-row-open">
            <div className="ui-note-list-title min-h-lh content-center"><Skeleton className={item % 2 ? "h-4 w-1/2" : "h-4 w-2/5"} /></div>
            <div className="ui-note-list-date"><Skeleton className="ms-auto h-3 w-16" /></div>
          </div>
        </div>
        <div className="ui-note-tags"><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-16" /></div>
      </CardContent>}
    </Card>)}
  </div>;
}

export function NoteCollection({ home, heading, notes, activeTag, recentTags, loading = false, tagFiltersDisabled, children, hasMore, paging, loadMoreDisabled, canOpen, canCreate, showCreateInToolbar = true, onNewNote, onOpen, onSelectTag, onSelectRecentTag = onSelectTag, onSelectAll, onLoadMore, onError, formatDate }: NoteCollectionProps) {
  const [layout, changeLayout] = useCollectionLayout(home ? "memocard:home-layout" : "memocard:note-layout", home ? "list" : "cards");
  const recentTagScroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroller = recentTagScroller.current;
    if (!scroller) return;
    const updateOverflow = () => {
      const offset = Math.abs(scroller.scrollLeft);
      const remaining = scroller.scrollWidth - scroller.clientWidth - offset;
      scroller.toggleAttribute("data-overflow-start", offset > 1);
      scroller.toggleAttribute("data-overflow-end", remaining > 1);
    };
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(scroller);
    for (const tag of scroller.children) observer.observe(tag);
    scroller.addEventListener("scroll", updateOverflow, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", updateOverflow);
    };
  }, [recentTags]);
  const cards = layout === "cards";
  const recentTagButtonStyles = cn(tabsPillTriggerStyles, "ui-note-recent-tag");
  const layoutButtons = <div role="group" aria-label={home ? "主页布局" : "笔记布局"} data-variant="default" className={cn(tabsListVariants(), "ui-note-layout")}>
    <Button type="button" variant="ghost" className={cn(tabsTriggerStyles, "aria-pressed:bg-surface dark:aria-pressed:bg-surface")} aria-label="卡片布局" data-ui-tooltip="卡片布局" aria-pressed={cards} onClick={() => changeLayout("cards")}><HugeiconsIcon icon={GridViewIcon} aria-hidden="true" strokeWidth={2} /></Button>
    <Button type="button" variant="ghost" className={cn(tabsTriggerStyles, "aria-pressed:bg-surface dark:aria-pressed:bg-surface")} aria-label="列表布局" data-ui-tooltip="列表布局" aria-pressed={!cards} onClick={() => changeLayout("list")}><HugeiconsIcon icon={LeftToRightListBulletIcon} aria-hidden="true" strokeWidth={2} /></Button>
  </div>;
  const content = <TooltipHints>
    {loading && <span role="status" aria-label="正在读取笔记库" className="sr-only">正在读取笔记库…</span>}
    <div className="ui-note-results" aria-busy={loading}>
      {notes.length ? <ul aria-label="笔记列表" data-layout={layout} className={cn("ui-note-items", cards ? "ui-note-cards" : "ui-note-list")}>
        {notes.map(note => {
          const title = note.title?.trim() || "新内容";
          const date = home ? note.updatedAt : note.createdAt;
          const tags = cards ? [] : note.tags.filter(name => name !== activeTag);
          return <li key={note.id} data-note-id={note.id}>
            <Card className={cn("ui-note-card", cards && canOpen && "ui-card-hover-shadow ui-card-hover-scale", !cards && "ui-note-list-card shadow-none ring-0")} data-note-openable={canOpen}>
              <CardContent className={cn("ui-note-content", !cards && "ui-note-list-content")}>
                {cards ? <div className="ui-note-heading">
                  <h2><button type="button" className="ui-note-open" aria-label={`打开 ${title}`} disabled={!canOpen}
                    onPointerDown={event => {
                      if (event.pointerType === "touch" && event.isPrimary) event.currentTarget.setAttribute("data-touch-pressed", "");
                    }}
                    onPointerUp={clearCardPress} onPointerCancel={clearCardPress} onLostPointerCapture={clearCardPress}
                    onClick={() => onOpen(note.id)}>{title}</button></h2>
                  <time dateTime={date}>{formatDate(date)}</time>
                </div> : <h2 className="ui-note-list-heading">
                  <button type="button" className="ui-note-open ui-note-row-open" aria-label={`打开 ${title}`} disabled={!canOpen} onClick={() => onOpen(note.id)}>
                    <span className="ui-note-list-title">{title}</span>
                    <time className="ui-note-list-date" dateTime={date}>{formatDate(date)}</time>
                  </button>
                </h2>}
                {cards && <div className="ui-note-preview"><Suspense fallback={<Skeleton className="h-full w-full rounded-lg" />}>
                  <NoteCardPreview key={JSON.stringify([note.sourceUrl, note.contentHash])} note={note} onError={onError} />
                </Suspense></div>}
                {tags.length > 0 && <div className="ui-note-tags">
                  {tags.slice(0, 2).map(name => <Badge key={name} variant="secondary" className="ui-note-tag" render={<button type="button" />} aria-label={`筛选标签 ${name}`} data-ui-tooltip={name} data-tag={encodeURIComponent(name)} onClick={() => onSelectTag(name)}><span data-ui-tooltip-overflow>{name}</span></Badge>)}
                  {tags.length > 2 && <span className="ui-note-tag-count" aria-label={`另有 ${tags.length - 2} 个标签`}>+{tags.length - 2}</span>}
                </div>}
              </CardContent>
            </Card>
          </li>;
        })}
      </ul> : loading ? <CollectionSkeleton cards={cards} /> : children !== undefined ? children : <Empty className="ui-note-empty border">
        <EmptyHeader><EmptyMedia variant="icon"><DocumentIcon aria-hidden="true" /></EmptyMedia><EmptyTitle>{home?.tab === "pinned" ? "把常用笔记固定在这里" : "记下第一条笔记"}</EmptyTitle><EmptyDescription>{home?.tab === "pinned" ? "在笔记详情中固定后，可以从主页快速打开。" : "一句想法、一段发现，不必想好标题。"}</EmptyDescription></EmptyHeader>
        {home?.tab !== "pinned" && <EmptyContent><CreateButton disabled={!canCreate} onClick={onNewNote}>新建笔记</CreateButton></EmptyContent>}
      </Empty>}
      {hasMore && <div className="ui-note-pagination"><Button variant="outline" size="sm" aria-label="加载更多" aria-busy={paging} onClick={onLoadMore} disabled={loadMoreDisabled || paging}>{paging ? <Spinner aria-hidden="true" /> : <HugeiconsIcon icon={ArrowDown01Icon} aria-hidden="true" strokeWidth={2} />}{paging ? "正在加载…" : "加载更多"}</Button>{paging && <span role="status" className="sr-only">正在加载更多笔记…</span>}</div>}
    </div>
  </TooltipHints>;

  if (home) return <Tabs value={home.tab} onValueChange={value => { if (value === "recent" || value === "pinned") home.onTabChange(value); }} className="ui-note-collection" data-slot="note-collection">
    <div className="ui-note-toolbar"><div className="ui-note-home-tabs"><TabsList variant="line" activateOnFocus aria-label="主页内容"><TabsTrigger value="recent"><HugeiconsIcon icon={Clock03Icon} aria-hidden="true" strokeWidth={2} />最近更新</TabsTrigger><TabsTrigger value="pinned"><HugeiconsIcon icon={PinIcon} aria-hidden="true" strokeWidth={2} />已固定<span className="text-xs text-secondary tabular-nums">{home.pinnedCount}</span></TabsTrigger></TabsList></div><div className="ui-note-actions">{loading && notes.length > 0 && <Spinner aria-hidden="true" className="text-icon-secondary" />}{layoutButtons}</div></div>
    <TabsContent value={home.tab}>{content}</TabsContent>
  </Tabs>;

  return <section className="ui-note-collection" data-slot="note-collection" aria-label="笔记集合">
    <div className="ui-note-toolbar">
      {recentTags !== undefined && <div ref={recentTagScroller} className={cn(tabsListVariants({ variant: "pill" }), "ui-note-recent-tags w-full justify-start")} data-variant="pill" data-transparent-inactive role="group" aria-label="最近使用的笔记标签">
          <Button type="button" variant="ghost" data-slot="tabs-trigger" className={recentTagButtonStyles}
            data-active={!activeTag || undefined} aria-pressed={!activeTag} disabled={tagFiltersDisabled} onClick={onSelectAll}>all</Button>
          {recentTags.map(name => <Button key={name} type="button" variant="ghost" data-slot="tabs-trigger" className={recentTagButtonStyles}
            data-active={activeTag === name || undefined} aria-pressed={activeTag === name} data-tag={encodeURIComponent(name)} data-ui-tooltip={name}
            aria-label={`筛选最近标签 ${name}`} disabled={tagFiltersDisabled} onClick={() => onSelectRecentTag(name)}><span data-ui-tooltip-overflow>{name}</span></Button>)}
        </div>}
      {heading}
      <div className="ui-note-actions">{layoutButtons}{showCreateInToolbar && <CreateButton disabled={!canCreate} onClick={onNewNote}>新建</CreateButton>}</div>
    </div>
    {content}
  </section>;
}
