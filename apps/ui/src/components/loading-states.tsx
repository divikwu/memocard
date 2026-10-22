import { CalendarDays, ChevronDown, Clock3, Hash, House, Layers, LayoutGrid, List, Notebook, Pin, Plus, Search } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { collectionClasses, layoutKey, savedLayout } from "./note-collection-layout";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from "./ui/sidebar";

export function LoadingTags() {
  return <SidebarGroup><div role="status" aria-label="正在读取标签" className="sr-only">正在读取标签…</div><div aria-hidden="true"><div className="flex h-8 items-center px-2 text-xs text-muted-foreground">标签</div>{[0, 1, 2].map(item => <div key={item} className="flex h-9 items-center gap-2 px-2"><Skeleton className="size-4" /><Skeleton className={item === 1 ? "h-4 w-28" : "h-4 w-20"} /></div>)}</div></SidebarGroup>;
}

export function LoadingSidebar({ vaultName }: { vaultName: string }) {
  return <Sidebar aria-label="笔记导航" className="border-r-0">
    <SidebarHeader><div className="flex items-center gap-2"><div className="flex h-10 min-w-0 flex-1 items-center gap-2 px-1.5"><img src="./favicon.png" alt="" className="size-9 shrink-0 object-contain" /><span className="text-base font-semibold">MemoCard</span></div><SidebarTrigger className="shrink-0" /></div>
      <SidebarMenu>{([[Search, "搜索"], [Plus, "新建笔记"], [House, "主页"], [Notebook, "所有笔记"], [CalendarDays, "日历"]] as const).map(([Icon, label]) => <SidebarMenuItem key={String(label)}><SidebarMenuButton disabled><Icon /><span>{String(label)}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
    </SidebarHeader>
    <SidebarContent><LoadingTags /></SidebarContent>
    <SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton disabled><Layers /><span className="min-w-0 flex-1 truncate font-medium">{vaultName}</span><ChevronDown className="opacity-50" /></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
  </Sidebar>;
}

export function LoadingNote() {
  return <div role="status" aria-label="正在打开笔记">
    <span className="sr-only">正在打开笔记…</span>
    <div aria-hidden="true">
      <div className="flex items-center px-2" style={{height:41}}><Skeleton className="h-8 w-3/4" /></div>
      <div className="mt-2 border-b pb-3 text-sm text-muted-foreground" style={{paddingInline:2}}>
        <div className="grid h-8 gap-2" style={{marginBottom:4,gridTemplateColumns:"min(160px,40%) minmax(0,1fr)"}}>
          <div className="flex items-center gap-1 px-1.5"><Hash className="size-4" />Tags</div>
          <div className="flex items-center px-1.5"><Skeleton className="h-5" style={{width:96}} /></div>
        </div>
        <div className="flex h-8 items-center gap-1 px-1.5"><ChevronDown className="size-4" />属性</div>
      </div>
      <div className="mt-8 space-y-3 px-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /></div>
    </div>
  </div>;
}

export function LoadingCapture() {
  return <div role="status" aria-label="正在准备快速输入" style={{marginBottom:28}}>
    <span className="sr-only">正在准备快速输入…</span>
    <div aria-hidden="true" style={{borderRadius:24}} className="overflow-hidden border shadow-(--surface-shadow)">
      <div className="loading-capture-textarea p-4"><Skeleton className="h-5" style={{width:144}} /></div>
      <div className="flex h-12 items-center gap-4 px-4" style={{paddingBottom:4}}><Skeleton className="h-5" style={{width:48}} /><Skeleton className="h-5" style={{width:48}} /><Skeleton className="ml-auto h-9 rounded-full" style={{width:72}} /></div>
    </div>
  </div>;
}

export function LoadingTrash({ canPermanentlyDelete = false, toolbar = true }: { canPermanentlyDelete?: boolean; toolbar?: boolean }) {
  return <div role="status" aria-label="正在读取回收站" className="grid gap-4">
    <span className="sr-only">正在读取回收站…</span>
    {toolbar && <div aria-hidden="true" className="flex items-center justify-between gap-3 pb-2 pl-2"><h1 className="type-title tracking-tight">回收站</h1><Skeleton className="h-8" style={{width:96}} /></div>}
    <div aria-hidden="true" className="grid gap-2">{[0, 1, 2].map(item => <Card key={item} className="gap-0 px-4 py-3 shadow-none"><CardContent className="flex flex-col items-start justify-between gap-3 px-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-5" style={{width:160,maxWidth:"100%"}} /><Skeleton className="h-4" style={{width:192,maxWidth:"100%"}} /><Skeleton className="h-4" style={{width:144,maxWidth:"100%"}} /><Skeleton className="h-5 w-4/5" /></div>
      <div className="flex shrink-0 gap-3"><Skeleton className="h-8" style={{width:72}} />{canPermanentlyDelete && <Skeleton className="h-8" style={{width:96}} />}</div>
    </CardContent></Card>)}</div>
  </div>;
}

export function LoadingThemeSettings() {
  return <div role="status" aria-label="正在读取外观设置" className="@container space-y-8">
    <span className="sr-only">正在读取外观设置…</span>
    {["外观", "内容风格"].map((title, section) => <section key={title} aria-hidden="true" className="space-y-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2"><h2 className="text-base font-medium">{title}</h2><Skeleton className="ml-auto h-8" style={{width:96}} /></div>
      {section === 1 && <p className="text-sm text-muted-foreground">用于笔记正文和编辑区域，不改变导航与工具栏。保存在当前设备的浏览器中。</p>}
      <Card className="gap-0 py-0 shadow-none"><CardContent className="divide-y divide-border/60 px-4">
        {(section === 0 ? ["显示模式", "强调色"] : ["行宽", "笔记标题字体", "笔记正文字体", "笔记等宽字体", "字号", "行高", "段落间距"]).map(label => <div key={label} className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 space-y-1"><p className="text-sm">{label}</p>{section === 0 && <Skeleton className="h-5" style={{width:192,maxWidth:"100%"}} />}</div><Skeleton className="h-9 w-full shrink-0 sm:w-48" />
        </div>)}
        {section === 0 && <div className="-mx-4 flex h-14 items-center justify-between px-4 text-sm">高级外观<ChevronDown className="size-4 text-muted-foreground" /></div>}
      </CardContent></Card>
      {section === 1 && <div className="rounded-xl border" style={{minHeight:"clamp(454.5px, calc(664.5px - 27.4cqw), 566.5px)"}}><div className="border-b px-4 py-3 text-sm font-medium">实时预览</div><div className="space-y-4 px-5 py-6 sm:p-8"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div></div>}
    </section>)}
  </div>;
}

export function LoadingCollectionItems({ cards }: { cards: boolean }) {
  const { gridClass, cardClass } = collectionClasses(cards);
  return <div aria-hidden="true" data-layout={cards ? "cards" : "list"} data-slot="collection-skeleton" className={gridClass}>{[0, 1, 2, 3, 4, 5].map(item => <Card key={item} className={cardClass}>
      <CardContent className={cn("flex h-full min-h-0 p-0", cards ? "flex-col" : "flex-row items-center")}>
        <div className={cn("min-w-0 flex-1", cards ? "px-4 pt-4" : "px-2 py-2")}>
          <div className={cn("flex items-center", cards ? "h-6" : "h-5")}><Skeleton className={cn("h-4", item % 2 ? "w-3/4" : "w-2/3")} /></div>
          {cards && <><Skeleton className="mt-1 h-4 w-28" /><div className="mt-3 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /></div></>}
        </div>
        <div className={cn("flex items-center gap-2", cards ? "min-h-10 px-4 pb-3" : "collection-list-meta pr-2")}><Skeleton className="h-5 rounded-full" style={{width:48}} /><Skeleton className="h-5 w-16 rounded-full" /></div>
        {!cards && <div className="collection-list-meta ml-auto flex w-28 shrink-0 pr-2" style={{justifyContent:"flex-end"}}><Skeleton className="h-4" style={{width:88}} /></div>}
      </CardContent>
    </Card>)}</div>;
}

export function LoadingCollection({ home = false }: { home?: boolean }) {
  const cards = savedLayout(home ? "memocard:home-layout" : layoutKey, home ? "list" : "cards") === "cards";
  return <div role="status" aria-label="正在读取笔记库" className="@container space-y-4"><span className="sr-only">正在读取笔记库…</span>
    {home ? <div aria-hidden="true" className="home-toolbar flex items-center justify-between gap-3"><div className="flex h-9 items-center gap-2 p-[3px] text-sm"><span className="flex items-center gap-1.5 px-1"><Clock3 className="size-4" />最近更新</span><span className="flex items-center gap-1.5 px-2 text-muted-foreground"><Pin className="size-4" />已固定</span></div><div className="collection-layout-switch flex rounded-lg bg-muted p-[3px]"><span className="flex size-8 items-center justify-center"><LayoutGrid className="size-4" /></span><span className="flex size-8 items-center justify-center"><List className="size-4" /></span></div></div> : <div aria-hidden="true" className="collection-toolbar grid grid-cols-1 items-center gap-3 @xl:grid-cols-[minmax(0,1fr)_auto]"><Skeleton className="collection-toolbar-search h-8 w-full @xl:w-60" /><div className="collection-toolbar-actions ml-auto flex items-center gap-3"><Skeleton className="collection-layout-placeholder h-8" style={{height:38}} /><Skeleton className="collection-toolbar-create h-8" style={{width:72}} /></div></div>}
    <LoadingCollectionItems cards={cards} />
  </div>;
}
