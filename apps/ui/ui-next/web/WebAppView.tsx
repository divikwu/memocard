import { Suspense, useId, useRef, type ReactNode } from "react";
import type { AppViewState } from "../../src/App";
import { noteFilterEmptyTitles } from "../../src/note-filter-labels";
import { errorMessage } from "../../src/error-messages";
import { HomeMascot } from "../business/HomeMascot";
import { Button } from "../components/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "../components/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/empty";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/sidebar";
import { Separator } from "../components/separator";
import { Skeleton } from "../components/skeleton";
import { Spinner } from "../components/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";
import TagColorStyles from "../business/TagColorStyles";
import { AppSidebar } from "../business/sidebar";
import { MobileTagActions } from "../business/MobileTagActions";
import { NoteCollection } from "../business/NoteCollection";
import { AddIcon, CheckIcon, DeleteIcon, DocumentIcon, FolderIcon, SearchIcon, SettingsIcon } from "../icons";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import { usePreviewMode } from "../preview-mode";
import { WebTypographyProvider } from "./WebTypographyProvider";
import { recoverableLazy } from "../components/recoverable-lazy";
import "./web-app.css";

const WebSettings = recoverableLazy(() => import("./WebSettings").then(module => ({ default: module.WebSettings })), "设置");
const Editor = recoverableLazy(() => import("../business/Editor").then(module => ({ default: module.Editor })), "笔记编辑器");
const QuickCapture = recoverableLazy(() => import("../business/QuickCapture").then(module => ({ default: module.QuickCapture })), "快速记录");
const NoteSearchDialog = recoverableLazy(() => import("../business/NoteSearchDialog").then(module => ({ default: module.NoteSearchDialog })), "搜索");
const TrashPage = recoverableLazy(() => import("../business/TrashPage").then(module => ({ default: module.TrashPage })), "回收站");
const NoteDeleteDialog = recoverableLazy(() => import("../business/NoteDeleteDialog").then(module => ({ default: module.NoteDeleteDialog })), "删除确认");

export const preloadWebEditor = () => import("../business/Editor");
export const renderWebApp = (state: AppViewState) => <WebTypographyProvider><WebAppView state={state} /></WebTypographyProvider>;

export function Notice({ title, children, action, error = false }: { title: string; children?: ReactNode; action?: ReactNode; error?: boolean }) {
  return <section className="web-notice" role={error ? "alert" : "status"} data-error={error || undefined}><div><p className="font-medium">{title}</p>{children && <div className="mt-1 text-sm text-secondary">{children}</div>}</div>{action && <div className="web-notice-actions">{action}</div>}</section>;
}

function PageLoading() {
  return <div className="web-page-loading" role="status" aria-label="正在读取内容"><Skeleton className="h-8 w-40" /><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-5/6" /><span className="sr-only">正在读取内容…</span></div>;
}

function WorkspaceEmpty({ title, description, children, guide = false, role, connection = false }: { title: string; description: string; children?: ReactNode; guide?: boolean; role?: "alert" | "status"; connection?: boolean }) {
  return <Empty className="web-workspace-empty" data-guide={guide || undefined} role={role}><EmptyHeader><EmptyMedia variant="icon">{connection ? <HugeiconsIcon icon={AlertCircleIcon} aria-hidden="true" /> : <FolderIcon aria-hidden="true" />}</EmptyMedia><EmptyTitle><h2>{title}</h2></EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{children && <EmptyContent>{children}</EmptyContent>}{guide && <p className="text-xs text-secondary">只访问你授权的文件夹</p>}</Empty>;
}

function CoverageNotice({ state: s }: { state: AppViewState }) {
  const id = useId();
  const c = s.status!.coverage;
  return <Notice title="部分文件暂时无法读取" action={<><Button variant="outline" size="sm" disabled={s.refreshingPages || s.switchingVault || s.collection.paging} onClick={() => void s.readCoverage.onReread()}>{s.readCoverage.rereading && <Spinner aria-hidden="true" />}重新读取</Button><Button variant="outline" size="sm" aria-expanded={s.readCoverage.open} aria-controls={id} onClick={() => s.readCoverage.onOpenChange(!s.readCoverage.open)}>查看详情</Button></>}>
    <p>待读取 {c.pending} 项，需要处理 {c.issues} 项。列表和搜索结果可能不完整，已加载的笔记仍可使用。</p>
    {s.readCoverage.open && <div id={id} className="web-coverage-details"><dl><div><dt>已读入笔记</dt><dd>{c.indexed}</dd></div><div><dt>待读取文件</dt><dd>{c.pending}</dd></div><div><dt>需要处理的文件</dt><dd>{c.issues}</dd></div></dl><p>当前未提供具体文件和失败原因。请确认笔记文件夹可访问、文件能在系统中正常打开，再重新读取。</p></div>}
  </Notice>;
}

function CollectionEmpty({ state: s }: { state: AppViewState }) {
  const pinned = s.collection.home?.tab === "pinned";
  const filtered = Boolean(s.collection.query || s.sidebar.tag);
  const filter = s.sidebar.quickFilter;
  const title = s.status?.indexing ? "笔记正在陆续载入" : pinned ? "把常用笔记固定在这里" : filtered ? "没有找到相关笔记" : filter ? noteFilterEmptyTitles[filter] : "记下第一条笔记";
  const description = s.status?.indexing ? "已读取的笔记可以打开，也可以新建笔记继续记录。" : pinned ? "在笔记详情右上角点击大头钉，即可固定到主页。" : filtered ? "换一个关键词，或清除筛选。" : filter === "images" ? "在笔记中插入图片后，会自动出现在这里。" : filter === "links" ? "在笔记中添加网页或笔记链接后，会自动出现在这里。" : filter === "untagged" ? "当前笔记都已有标签，新的无标签笔记会出现在这里。" : "一句想法、一段发现，不必想好标题。";
  return <Empty className="next-note-empty border"><EmptyHeader><EmptyMedia variant="icon"><DocumentIcon aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader><EmptyContent>{pinned ? <Button variant="outline" onClick={() => void s.onNavigate("notes")}>浏览笔记</Button> : filter || filtered ? <Button variant="outline" onClick={() => { s.collection.onQueryChange(""); void s.onNavigate("notes"); }}>查看所有笔记</Button> : <Button disabled={!s.canCreate} onClick={() => void s.onNew()}><AddIcon aria-hidden="true" />新建笔记</Button>}</EmptyContent></Empty>;
}

function WorkspaceContent({ state: s }: { state: AppViewState }) {
  if (s.openingNote) return <><h1 className="sr-only">{s.title}</h1>{s.detailReadFailed ? <WorkspaceEmpty role="alert" connection title={(s.error as { code?: string })?.code === "NOTE_NOT_FOUND" ? "笔记不存在" : "无法打开笔记"} description={errorMessage(s.error)}><div className="flex flex-wrap justify-center gap-2">{s.canRetryDetail && <Button disabled={s.loading || s.working || s.switchingVault} onClick={s.onRetryDetail}>重试</Button>}<Button variant="outline" onClick={s.onBack}>{s.backLabel}</Button></div></WorkspaceEmpty> : s.error ? null : <PageLoading />}</>;
  if (s.editor) return <><h1 className="sr-only">{s.title}</h1><Suspense fallback={<PageLoading />}><Editor key={s.editor.initial.id} {...s.editor} /></Suspense></>;
  if (s.view === "settings") return <Suspense fallback={<PageLoading />}><WebSettings state={s} /></Suspense>;
  if (s.view === "trash") return s.trash ? <Suspense fallback={<PageLoading />}><TrashPage key={`${s.trash.vaultId}:${s.trash.vaultBinding ?? ""}`} {...s.trash} /></Suspense> : <><h1 className="sr-only">回收站</h1><WorkspaceEmpty title={s.status?.connected ? "当前服务暂不支持回收站" : "连接笔记库后查看回收站"} description={s.status?.connected ? "更新 MemoCard 后重试。" : "请选择或重新连接笔记文件夹。"} /></>;
  if (s.connectionState) return <WorkspaceEmpty role="status" connection={s.localWebReconnectRequired} title={s.localWebReconnectRequired ? "需要重新连接本机服务" : s.needsPermission ? "需要文件夹访问权限" : "文件夹授权未完成"} description={s.localWebReconnectRequired ? "从 MemoCard 本机服务重新打开此页面，恢复访问。" : "重新授权笔记文件夹后，可继续读取与保存。"}>
    {s.selectionNotice && <details><summary>查看详情</summary><p className="break-words">{s.selectionNotice}</p></details>}
    {s.localWebReconnectRequired ? <Button role="link" nativeButton={false} render={<a href="memocard-service://open-web" />}>重新打开</Button> : <Button onClick={s.needsPermission ? s.sidebar.onReauthorize : () => s.sidebar.onSelectVault(false)} disabled={s.working}>{s.needsPermission ? "重新授权" : "重新选择文件夹"}</Button>}
  </WorkspaceEmpty>;
  if (s.listTimeout === "initial") return <WorkspaceEmpty role="alert" connection title="笔记加载超时" description="暂时无法读取笔记列表，请重试。"><Button onClick={s.onRefresh} disabled={s.refreshingPages || s.switchingVault}>重试</Button></WorkspaceEmpty>;
  if (!s.loading && !s.status?.connected && !s.collection.notes.length) return <WorkspaceEmpty guide title={s.unsupportedBrowser ? "通过本机服务连接笔记库" : "打开你的笔记文件夹"} description={s.unsupportedBrowser ? "此浏览器无法直接读写文件夹。请从 MemoCard 菜单栏打开，或使用 memocard serve。" : "打开已有的 Markdown / Obsidian 文件夹，或创建一个新笔记库。内容保存在你授权的文件夹中。"}>
    {!s.unsupportedBrowser && <div className="flex flex-wrap justify-center gap-2">{s.sidebar.canCreateVault && <Button disabled={s.working} onClick={() => s.sidebar.onSelectVault(true)}><AddIcon aria-hidden="true" />创建笔记库</Button>}<Button variant="outline" disabled={!s.sidebar.canChooseVault || s.working} onClick={() => s.sidebar.onSelectVault(false)}><FolderIcon aria-hidden="true" />打开已有笔记库</Button></div>}
  </WorkspaceEmpty>;
  return <>
    {!s.isMobile && s.view === "home" && s.capture && <Suspense fallback={<PageLoading />}><QuickCapture key={`${s.capture.vaultId}:${s.capture.vaultBinding ?? ""}`} {...s.capture} /></Suspense>}
    <NoteCollection key={s.view === "home" ? "home" : "notes"} {...s.collection}>{s.error ? null : <CollectionEmpty state={s} />}</NoteCollection>
  </>;
}

const IOSAppChrome = recoverableLazy(() => import("../native/IOSAppChrome").then(module => ({ default: module.IOSAppChrome })), "导航");

export function WebAppView({ state: s }: { state: AppViewState }) {
  const mode = usePreviewMode();
  const menuDelete = useRef(false);
  return <div className="ui-next-theme web-app sb-unstyled" data-ui-theme={mode} data-native-chrome={s.nativeChrome ? "true" : undefined}>
    <TagColorStyles />
    {s.nativeChrome && <Suspense fallback={null}><IOSAppChrome {...s.nativeChrome} /></Suspense>}
    <a className="web-skip-link" href="#web-main-content" onClick={event => { event.preventDefault(); s.scrollContainer.current?.focus(); }}>跳到笔记内容</a>
    <SidebarProvider open={s.sidebarOpen} onOpenChange={s.onSidebarOpenChange} openMobile={s.menuOpen} onOpenMobileChange={s.onMenuOpenChange} persistState={false} className="web-app-shell">
      {!s.nativeChrome && <AppSidebar {...s.sidebar} />}
      <SidebarInset className="web-app-main">
        {!s.nativeChrome && <header className="web-app-header">
          <div className="web-header-leading">{s.detailView && <Button variant="ghost" size="icon-sm" className="web-header-icon" aria-label={s.backLabel} onClick={s.onBack}><HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" /></Button>}
            {(s.isMobile ? !s.detailView : !s.sidebarOpen) && <><SidebarTrigger className="web-header-icon" />{!s.isMobile && <Separator orientation="vertical" className="web-header-separator" />}</>}
            <Breadcrumb aria-label="当前位置" className="web-header-breadcrumb" data-detail={s.detailView || undefined}><BreadcrumbList><BreadcrumbItem>{s.isMobile && !s.detailView && (s.view === "home" || s.view === "notes") ? <MobileTagActions key={`${s.status?.vaultId}:${s.view}`} tag={s.view === "notes" ? s.sidebar.tag : null} title={s.title} home={s.view === "home"} vaultId={s.status?.vaultId} onRename={s.sidebar.onRenameTag} /> : <BreadcrumbPage>{s.title}</BreadcrumbPage>}</BreadcrumbItem></BreadcrumbList></Breadcrumb>
          </div>
          <div className="web-header-actions">
            {s.editor && s.capabilities.has("setNotePinned") && <TooltipProvider><Tooltip><TooltipTrigger render={<span className="web-pin-tooltip-trigger" tabIndex={s.pinDisabled ? 0 : undefined} />}><Button variant="ghost" size="icon-sm" className={`web-header-icon${s.pinned ? " text-accent" : ""}`} aria-label={s.pinned ? "取消固定" : "固定到主页"} aria-description={!s.editor.initial.baseHash ? "保存笔记后可固定到主页" : undefined} aria-pressed={s.pinned} disabled={s.pinDisabled} onClick={s.onTogglePin}><HugeiconsIcon icon={PinIcon} fill={s.pinned ? "currentColor" : "none"} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{!s.editor.initial.baseHash ? "保存笔记后可固定到主页" : s.pinned ? "取消固定" : "固定到主页"}</TooltipContent></Tooltip></TooltipProvider>}
            <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="web-header-icon" aria-label="页面操作" />}><HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56" finalFocus={() => { if (menuDelete.current) { menuDelete.current = false; s.onRequestDelete?.(); return false; } return true; }}>
              <DropdownMenuItem disabled={!s.canCreate} onClick={() => void s.onNew()}><AddIcon aria-hidden="true" />新建笔记</DropdownMenuItem><DropdownMenuItem disabled={!s.canRefresh} onClick={s.onRefresh}><HugeiconsIcon icon={RefreshIcon} className={s.loading ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden="true" />刷新笔记库</DropdownMenuItem>
              {s.onRequestDelete && <DropdownMenuItem variant="destructive" disabled={!s.canDeleteNote} onClick={() => { menuDelete.current = true; }}><DeleteIcon aria-hidden="true" />移入回收站</DropdownMenuItem>}
              {s.drafts.records.length > 0 && <DropdownMenuItem onClick={() => s.drafts.onOpenChange(true)}>保留草稿（{s.drafts.records.length}）</DropdownMenuItem>}
              <DropdownMenuSeparator /><DropdownMenuItem onClick={() => void s.onNavigate("settings")}><SettingsIcon aria-hidden="true" />设置</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu>
          </div>
        </header>}
        <div ref={s.scrollContainer} id="web-main-content" tabIndex={-1} className={`web-app-scroll${s.detailView ? " note-page-scroll" : ""}`} data-detail={s.detailView || undefined} data-settings={s.view === "settings" || undefined}><div className="web-page-content" data-detail={s.detailView || undefined} data-settings={s.view === "settings" || undefined} data-view={s.view}>
          {s.switchingVault && <Notice title="正在打开笔记库"><Spinner aria-hidden="true" className="mr-2 inline" />首次读取可能需要一些时间。</Notice>}
          {Boolean(s.error) && !s.detailReadFailed && !(s.connectionState && s.localWebReconnectRequired) && <Notice title={s.localWebReconnectRequired ? "连接已断开" : "操作未完成"} error action={s.localWebReconnectRequired ? <Button role="link" nativeButton={false} variant="outline" size="sm" render={<a href="memocard-service://open-web" />}>重新打开</Button> : s.retryableError && <Button variant="outline" size="sm" disabled={!s.canRefresh || s.switchingVault} onClick={s.openingNote ? s.onRetryDetail : s.onRefresh}>重试</Button>}>{errorMessage(s.error)}</Notice>}
          {s.pinReadError != null && <Notice title="固定状态暂不可用" error action={<Button variant="outline" size="sm" disabled={s.pinRetryDisabled} onClick={s.onRefreshBackground}>重试</Button>}>{errorMessage(s.pinReadError)}</Notice>}
          {s.selectionNotice && !s.switchingVault && !s.connectionState && <Notice title="文件夹授权未完成" action={<Button variant="outline" size="sm" disabled={s.working} onClick={() => s.sidebar.onSelectVault(false)}>重新选择</Button>}>{s.selectionNotice}</Notice>}
          {s.needsPermission && !s.connectionState && <Notice title="重新授权笔记文件夹" action={<Button variant="outline" size="sm" disabled={s.working} onClick={s.sidebar.onReauthorize}>重新授权</Button>}>文件夹访问权限已失效，请重新授权以读取和保存。</Notice>}
          {s.status?.indexing && <Notice title={s.status.indexing.phase === "reading" ? "正在读取笔记库" : "正在建立索引"}>已处理 {s.status.indexing.processed}{s.status.indexing.total === null ? "" : ` / ${s.status.indexing.total}`} 篇，可继续使用已加载的笔记。草稿先保存在本机，校验后写入文件；搜索和筛选会逐步补齐。</Notice>}
          {s.status?.connected && !s.status.indexing && !s.status.coverage.complete && <CoverageNotice state={s} />}
          {s.drafts.issues.length > 0 && <Notice title="部分草稿无法读取"><details><summary>查看详情</summary>{s.drafts.issues.map((issue, i) => <p className="break-words" key={i}>{issue.message}{issue.path && <code className="block break-all">{issue.path}</code>}</p>)}</details></Notice>}
          {s.drafts.reminderVisible && !s.detailView && s.view !== "settings" && <Notice title="有尚未完成的草稿" action={<><Button variant="outline" size="sm" onClick={() => s.drafts.onOpenChange(true)}>查看草稿</Button><Button variant="ghost" size="sm" onClick={s.drafts.onDismissReminder}>稍后处理</Button></>}>可继续编辑，稍后处理不会删除草稿。</Notice>}
          {s.listTimeout === "refresh" && <Notice title="刷新超时" error action={<Button variant="outline" size="sm" disabled={s.refreshingPages || s.switchingVault} onClick={s.onRefreshBackground}>重试</Button>}>继续显示上次读取的内容。</Notice>}
          {!s.detailView && s.view !== "settings" && s.view !== "trash" && (s.view === "home" ? <div className="web-home-mascot"><h1 className="sr-only">{s.title}</h1><HomeMascot /></div> : <div className={s.isMobile ? "sr-only" : "web-collection-heading"}><h1>{s.title}</h1></div>)}
          <WorkspaceContent state={s} />
        </div></div>
        {s.isMobile && !s.nativeChrome && <footer className="web-mobile-record" hidden={s.detailView || (s.view !== "home" && s.view !== "notes") || s.search.open} aria-label="快捷记录"><Button variant="outline" size="icon-lg" disabled={!s.search.available} onClick={s.onSearch} aria-label="搜索全部笔记" aria-haspopup="dialog" aria-expanded={s.search.open}><SearchIcon aria-hidden="true" /></Button><div>{s.capture ? <Suspense fallback={<Button disabled className="w-full">记下此刻的想法…</Button>}><QuickCapture key={`${s.capture.vaultId}:${s.capture.vaultBinding ?? ""}`} {...s.capture} /></Suspense> : <Button disabled className="w-full">连接笔记库后开始记录</Button>}</div></footer>}
      </SidebarInset>
    </SidebarProvider>
    {s.searchMounted && <Suspense fallback={null}><NoteSearchDialog key={s.status?.vaultId} {...s.search} /></Suspense>}
    {s.deletion && <Suspense fallback={null}><NoteDeleteDialog {...s.deletion} /></Suspense>}
    {!s.nativeChrome && <Drafts state={s} />}
    {s.nativeChrome && s.capture && <Suspense fallback={null}><QuickCapture key={`${s.capture.vaultId}:${s.capture.vaultBinding ?? ""}`} {...s.capture} /></Suspense>}
    {s.notice && <div className="web-toast" data-record-bar={s.isMobile && !s.detailView && (s.view === "home" || s.view === "notes") || undefined} role="status"><CheckIcon aria-hidden="true" />{s.notice}</div>}
  </div>;
}

function Drafts({ state: s }: { state: AppViewState }) {
  const d = s.drafts;
  const deleteFocus = useRef<HTMLButtonElement | null>(null);
  const doneFocus = useRef<HTMLButtonElement | null>(null);
  const name = (draft: (typeof d.records)[number]) => draft.title || draft.body.slice(0, 80) || "空正文";
  return <><Dialog open={d.open} onOpenChange={d.onOpenChange}><DialogContent className="web-drafts-dialog"><DialogHeader><DialogTitle>保留的草稿</DialogTitle><DialogDescription>继续未完成的记录。关闭提醒会保留内容。</DialogDescription></DialogHeader>
    {d.error != null && <Notice title="草稿操作未完成" error>{errorMessage(d.error)}</Notice>}
    <div className="web-drafts-list">{d.records.length ? d.records.map(draft => <article key={`${draft.recoveryScope ?? (draft.unscoped ? "legacy" : "current")}:${draft.draftKey ?? draft.id}`}><DocumentIcon aria-hidden="true" /><div>
      <h3>{name(draft)}</h3>{draft.title && <p>{draft.body.slice(0, 120)}</p>}
      {draft.updatedAt && Number.isFinite(Date.parse(draft.updatedAt)) && <p><time dateTime={draft.updatedAt}>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(draft.updatedAt))}</time></p>}
      {draft.unscoped && <p className="text-warning">所属笔记库待确认</p>}
      {draft.pendingProperties?.length ? <p>未保存属性：{draft.pendingProperties.map(change => `${change.name}：${change.value === undefined ? "属性更改" : Array.isArray(change.value) ? change.value.join("、") : String(change.value)}`).join("；")}</p> : null}
      <div className="flex flex-wrap gap-2"><Button size="sm" aria-label={`继续编辑：${name(draft)}`} disabled={d.busy} onClick={() => void d.onResume(draft)}>继续编辑</Button>{draft.reminderDismissed ? <span className="text-sm text-secondary">已关闭提醒</span> : draft.unscoped && draft.draftKey && draft.revision && s.capabilities.has("dismissDraftReminder") && <Button size="sm" variant="ghost" disabled={d.busy} onClick={() => void d.onDismiss(draft)}>不再提醒</Button>}{draft.draftKey && draft.revision && s.status?.vaultId && s.capabilities.has("deleteDraft") && <Button size="sm" aria-label={`删除草稿：${name(draft)}`} variant="ghost" disabled={d.busy} onClick={event => { deleteFocus.current = event.currentTarget; d.onDelete(draft); }}>删除草稿</Button>}</div>
    </div></article>) : <p>暂无保留草稿。</p>}</div>
    <DialogFooter><Button variant="outline" disabled={d.busy} onClick={() => void d.onRefresh()}>刷新草稿</Button><Button ref={doneFocus} onClick={() => d.onOpenChange(false)} disabled={d.busy}>完成</Button></DialogFooter>
  </DialogContent></Dialog><Dialog open={!!d.deleteTarget} onOpenChange={open => { if (!open) d.onCancelDelete(); }}><DialogContent finalFocus={() => deleteFocus.current?.isConnected ? deleteFocus.current : doneFocus.current ?? true}><DialogHeader><DialogTitle>删除这条草稿？</DialogTitle><DialogDescription>草稿删除后无法恢复，已保存的笔记不受影响。</DialogDescription></DialogHeader><p>{d.deleteTarget ? name(d.deleteTarget) : "空正文"}</p><DialogFooter><Button variant="outline" autoFocus disabled={d.busy} onClick={d.onCancelDelete}>取消</Button><Button variant="destructive" disabled={d.busy} onClick={() => void d.onConfirmDelete()}>{d.busy ? "正在删除…" : "确认删除"}</Button></DialogFooter></DialogContent></Dialog></>;
}
