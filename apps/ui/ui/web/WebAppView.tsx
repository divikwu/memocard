import { Fragment, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import type { AppViewState } from "../../src/App";
import { noteFilterEmptyTitles, noteFilterLabels } from "../../src/note-filter-labels";
import { noteDetailPropertyPreviewRows, notePropertyPreviewKey } from "../../src/note-property-preview";
import { errorMessage } from "../../src/error-messages";
import { tagKey } from "../../src/inline-tags";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { pendingTagAppearance, subscribeTagAppearance } from "../../src/tag-settings";
import { EmptyIllustration } from "../business/EmptyIllustration";
import { HomeMascot } from "../business/HomeMascot";
import { Button } from "../components/button";
import { CreateButton } from "../business/CreateButton";
import { ActionGroup, MobileActionGroupProvider } from "../components/action-group";
import { isNative } from "../../src/bridge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/breadcrumb";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/empty";
import { useThemeScopeProps } from "../components/theme-scope";
import { Skeleton } from "../components/skeleton";
import { Spinner } from "../components/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";
import TagColorStyles from "../business/TagColorStyles";
import { MobileTagActions } from "../business/MobileTagActions";
import { NoteCollection } from "../business/NoteCollection";
import { PageNotice } from "../business/PageNotice";
import { TrashRowsLoading } from "../business/TrashLoading";
import { TagsLoading } from "../business/TagsLoading";
import { TagIcon } from "../business/property-icon-catalog";
import { AddIcon, CheckIcon, DeleteIcon, DocumentIcon, FolderIcon, SearchIcon, SettingsIcon } from "../icons";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft02Icon from "@hugeicons/core-free-icons/ArrowLeft02Icon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import TextFontIcon from "@hugeicons/core-free-icons/TextFontIcon";
import { WebTypographyProvider } from "./WebTypographyProvider";
import { localWebEntryMissing } from "./local-web-entry-missing";
import { ReopenLocalWeb } from "./ReopenLocalWeb";
import { useNoteAppearance } from "./note-appearance";
import { recoverableLazy } from "../components/recoverable-lazy";
import { WorkspaceFrame, LayoutDetailNavigation, LayoutNavigationControls } from "./WorkspaceFrame";
import { useWorkspaceAppearance } from "./appearance/AppearanceRuntime";
import { HomeCaptureLoading, SettingsLoading } from "./WorkspaceLoading";
import "../business/NotePageTitle.css";
import "./web-app.css";

function lazyWorkspaceFeature<Props extends object>(title: string, load: () => Promise<ComponentType<Props>>) {
  return recoverableLazy(async () => {
    try {
      return { default: await load() };
    } catch (error) {
      if (!await localWebEntryMissing()) throw error;
      return { default: () => <PageNotice tone="info" title="本机服务已更新" actions={
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>刷新页面</Button>
      }>刷新后即可使用{title}。</PageNotice> };
    }
  }, title, (_, retry) => <PageNotice title={`${title}未能打开`} actions={<>
    <Button variant="outline" size="sm" onClick={retry}>重新加载{title}</Button>
    <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>刷新页面</Button>
  </>}>如果重新加载后仍无法打开，请刷新页面。</PageNotice>);
}

const WebSettings = lazyWorkspaceFeature("设置页", async () => (await import("./WebSettings")).WebSettings);
const QuickCapture = lazyWorkspaceFeature("快速记录", async () => (await import("../business/QuickCapture")).QuickCapture);
const EditorLoadErrorToast = recoverableLazy(() => import("./EditorLoadErrorToast"), "编辑器加载提示",
  ({ retry }) => <PageNotice title="笔记编辑器加载失败" actions={<>
    <Button variant="outline" size="sm" onClick={retry}>重试加载</Button>
    <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>刷新页面</Button>
  </>}>如果重试后仍无法打开，请刷新当前页面。</PageNotice>);
const Editor = recoverableLazy(() => import("../business/Editor").then(module => ({ default: module.Editor })), "笔记编辑器",
  (_props, retry) => <Suspense fallback={null}><EditorLoadErrorToast retry={retry} /></Suspense>);
const NoteSearchDialog = recoverableLazy(() => import("../business/NoteSearchDialog").then(module => ({ default: module.NoteSearchDialog })), "搜索");
const TrashPage = recoverableLazy(() => import("../business/TrashPage").then(module => ({ default: module.TrashPage })), "回收站");
const WorkspaceTags = recoverableLazy(() => import("../business/TagsPage").then(module => ({ default: module.WorkspaceTags })), "标签");
const TagEditor = recoverableLazy(() => import("../business/tag-navigation-editor").then(module => ({ default: module.TagEditor })), "标签编辑");
const TagAppearanceNotice = recoverableLazy(() => import("../business/tag-navigation-editor").then(module => ({ default: module.TagAppearanceNotice })), "标签外观重试");
const NoteDeleteDialog = recoverableLazy(() => import("../business/NoteDeleteDialog").then(module => ({ default: module.NoteDeleteDialog })), "删除确认");
const Drafts = lazyWorkspaceFeature("草稿列表", async () => (await import("./WebDraftsDialog")).WebDraftsDialog);
const DraftReminderToast = recoverableLazy(() => import("./DraftReminderToast"), "草稿提醒", () => null);
const NoteAppearanceMenu = recoverableLazy(() => import("./NoteAppearanceMenu").then(module => ({ default: module.NoteAppearanceMenu })), "笔记外观",
  (_props, retry) => <DropdownMenuItem closeOnClick={false} onClick={retry}>重试加载笔记外观</DropdownMenuItem>);

export const preloadWebEditor = () => import("../business/Editor");
export const renderWebApp = (state: AppViewState) => <WebTypographyProvider><WebAppView state={state} /></WebTypographyProvider>;

export function Notice({ title, children, action, error = false }: { title: string; children?: ReactNode; action?: ReactNode; error?: boolean }) {
  if (error) return <PageNotice title={title} actions={action}>{children}</PageNotice>;
  return <section className="web-notice" role="status"><div><p className="font-medium">{title}</p>{children && <div className="mt-1 text-sm text-secondary">{children}</div>}</div>{action && <div className="web-notice-actions">{action}</div>}</section>;
}

function NoteDetail({ title, titleKnown, showProperties, propertyRows, children }: { title: string; titleKnown: boolean; showProperties: boolean; propertyRows: number; children?: ReactNode }) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    // Keep one delay across the note read and the editor's lazy load.
    const timeout = window.setTimeout(() => setShowSkeleton(true), 150);
    return () => window.clearTimeout(timeout);
  }, []);

  const loading = <div className="web-note-loading">
    <h1 className={titleKnown ? "note-page-title" : "sr-only"}>{title}</h1>
    <span className="sr-only" role="status" aria-label="正在读取内容">正在读取内容…</span>
    {showSkeleton && <div data-slot="note-detail-skeleton" aria-hidden="true">
      {!titleKnown && <div className="note-page-title web-note-loading-title"><Skeleton className="h-6 w-1/2" /></div>}
      {showProperties && propertyRows > 0 && <div className="web-note-loading-properties">
        {Array.from({ length: propertyRows }, (_, row) => <div className="web-note-loading-property" key={row}>
          <Skeleton className="h-4 w-20 max-w-full" /><Skeleton className={row % 2 ? "h-4 w-24 max-w-full" : "h-4 w-32 max-w-full"} />
        </div>)}
      </div>}
      {!showProperties && <div className="web-note-loading-body">
        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" />
      </div>}
    </div>}
  </div>;
  return children ? <Suspense fallback={loading}>{children}</Suspense> : loading;
}

function WorkspaceEmpty({ title, description, children, guide = false, role, connection = false, illustration }: { title: string; description: string; children?: ReactNode; guide?: boolean; role?: "alert" | "status"; connection?: boolean; illustration?: "plug" | "query" }) {
  return <Empty className="web-workspace-empty" data-guide={guide || undefined} role={role}><EmptyHeader>{illustration ? <EmptyIllustration kind={illustration} /> : <EmptyMedia variant="icon">{connection ? <HugeiconsIcon icon={AlertCircleIcon} aria-hidden="true" /> : <FolderIcon aria-hidden="true" />}</EmptyMedia>}<EmptyTitle><h2>{title}</h2></EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{children && <EmptyContent>{children}</EmptyContent>}{guide && children && <p className="text-xs text-secondary">只访问你授权的文件夹</p>}</Empty>;
}

function CoverageNotice({ state: s }: { state: AppViewState }) {
  const c = s.status!.coverage;
  return <Notice title="部分文件暂时无法读取" action={<Button variant="outline" size="sm" disabled={s.refreshingPages || s.switchingVault || s.collection.paging} onClick={() => void s.readCoverage.onReread()}>{s.readCoverage.rereading && <Spinner aria-hidden="true" />}重新读取</Button>}>
    <p>已读入 {c.indexed} 篇笔记，待读取 {c.pending} 项，需要处理 {c.issues} 项。列表和搜索结果可能不完整，已加载的笔记仍可使用。</p>
    <p className="mt-1">当前未提供具体文件和失败原因。请确认笔记文件夹可访问、文件能在系统中正常打开，再重新读取。</p>
  </Notice>;
}

function CollectionEmpty({ state: s }: { state: AppViewState }) {
  const pinned = s.collection.home?.tab === "pinned";
  const filtered = Boolean(s.sidebar.tag || s.collection.filters?.activeTags.length || (s.collection.filters?.quickFilters.length ?? 0) > 1);
  const filter = s.sidebar.quickFilter;
  const title = s.status?.indexing ? "笔记正在陆续载入" : pinned ? "把常用笔记固定在这里" : filtered ? "没有找到相关笔记" : filter ? noteFilterEmptyTitles[filter] : "记下第一条笔记";
  const description = s.status?.indexing ? "已读取的笔记可以打开，也可以新建笔记继续记录。" : pinned ? "在笔记详情右上角点击大头钉，即可固定到主页。" : filtered ? "可以调整筛选条件，或查看所有笔记。" : filter === "images" ? "在笔记中插入图片后，会自动出现在这里。" : filter === "links" ? "在笔记中添加网址后，会自动出现在这里。" : filter === "untagged" ? "当前笔记都已有标签，新的无标签笔记会出现在这里。" : "一句想法、一段发现，不必想好标题。";
  return <Empty className="ui-note-empty border"><EmptyHeader>{s.status?.indexing ? <EmptyMedia variant="icon"><DocumentIcon aria-hidden="true" /></EmptyMedia> : <EmptyIllustration kind={pinned ? "rail" : "drawer"} />}<EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader><EmptyContent>{pinned ? <Button variant="outline" onClick={() => void s.onNavigate("notes")}>浏览笔记</Button> : filter || filtered ? <Button variant="outline" onClick={() => void s.onNavigate("notes")}>查看所有笔记</Button> : <CreateButton disabled={!s.canCreate} onClick={() => void s.onNew()}>新建笔记</CreateButton>}</EmptyContent></Empty>;
}

function DraftReminder({ state: s }: { state: AppViewState }) {
  const layoutId = useWorkspaceAppearance()?.applied.layoutId;
  if (!s.drafts.reminderVisible) return null;
  const compactNavigation = layoutId === "rail" || layoutId === "topbar";
  const toastLayout = compactNavigation && !s.isMobile && s.status?.connected;
  const inline = !s.detailView && s.view !== "settings" && !(toastLayout && s.view === "notes")
    && !(compactNavigation && s.view === "home" && !s.connectionState && s.listTimeout !== "initial" && (s.loading || s.capture));
  return <>
    {toastLayout && <Suspense fallback={null}>
      <DraftReminderToast key={s.status?.vaultId} active={s.view === "notes" && !s.detailView && !s.drafts.open && !s.search.open} count={s.drafts.records.length} onOpen={() => s.drafts.onOpenChange(true)} onDismiss={s.drafts.onDismissReminder} />
    </Suspense>}
    {inline && <Notice title="有尚未完成的草稿" action={<><Button variant="outline" size="sm" onClick={() => s.drafts.onOpenChange(true)}>查看草稿</Button><Button variant="ghost" size="sm" onClick={s.drafts.onDismissReminder}>稍后处理</Button></>}>可继续编辑，稍后处理不会删除草稿。</Notice>}
  </>;
}

function WorkspaceContent({ state: s, heading }: { state: AppViewState; heading?: ReactNode }) {
  const { "data-interface-theme": themeId, "data-workspace-layout": layoutId } = useThemeScopeProps();
  const compactNavigation = layoutId === "rail" || layoutId === "topbar";
  if (s.openingNote && s.error) return <><h1 className="sr-only">{s.title}</h1>{s.detailReadFailed && <WorkspaceEmpty role="alert" connection illustration={(s.error as { code?: string })?.code === "NOTE_NOT_FOUND" ? "query" : undefined} title={(s.error as { code?: string })?.code === "NOTE_NOT_FOUND" ? "笔记不存在" : "无法打开笔记"} description={errorMessage(s.error)}><div className="web-workspace-actions">{s.canRetryDetail && <Button disabled={s.loading || s.working || s.switchingVault} onClick={s.onRetryDetail}>重试</Button>}<Button variant="outline" onClick={s.onBack}>{s.backLabel}</Button></div></WorkspaceEmpty>}</>;
  const editor = s.editor;
  const previewKey = notePropertyPreviewKey(s.status?.vaultId, editor?.initial.id ?? s.openingNoteId, editor?.initial.baseHash ?? s.openingContentHash);
  if (s.openingNote || editor) return <NoteDetail
    key={editor?.initial.id ?? s.openingNoteId}
    title={s.title}
    titleKnown={Boolean(editor ? editor.initial.title?.trim() : s.openingTitle)}
    showProperties={!s.status || s.capabilities.has("getNoteProperties")}
    propertyRows={noteDetailPropertyPreviewRows(previewKey)}
  >
    {editor && <><h1 className="sr-only">{s.title}</h1><Editor {...editor} waitForPropertyLayout /></>}
  </NoteDetail>;
  if (s.view === "settings") return <Suspense fallback={<SettingsLoading connected={Boolean(s.status?.connected)} />}><WebSettings state={s} /></Suspense>;
  if (s.view === "trash") {
    if (!s.trash) return <><h1 className="sr-only">回收站</h1><WorkspaceEmpty title={s.status?.connected ? "当前服务暂不支持回收站" : "连接笔记库后查看回收站"} description={s.status?.connected ? "更新 MemoCard 后重试。" : "请选择或重新连接笔记文件夹。"} /></>;
    return <Suspense fallback={<section className="ui-trash" aria-label="回收站">
      <header><h1>回收站</h1><Button variant="outline" disabled><Spinner aria-hidden="true" />刷新回收站</Button></header>
      <div role="status" aria-label="正在读取回收站"><span className="sr-only">正在读取回收站…</span><TrashRowsLoading canPermanentlyDelete={Boolean(s.trash.canPermanentlyDelete)} /></div>
    </section>}>
      <TrashPage key={`${s.trash.vaultId}:${s.trash.vaultBinding ?? ""}`} {...s.trash} />
    </Suspense>;
  }
  const pageHeading = heading && <div className="web-collection-heading">{heading}</div>;
  if (s.connectionState) return <>{pageHeading}<WorkspaceEmpty role="status" illustration={s.localWebReconnectRequired ? "plug" : undefined} title={s.localWebReconnectRequired ? "需要重新连接本机服务" : s.needsPermission ? "需要文件夹访问权限" : "文件夹授权未完成"} description={[s.selectionNotice, s.localWebReconnectRequired ? "从 MemoCard 本机服务重新打开此页面，恢复访问。" : s.needsPermission ? "重新授权笔记文件夹后，可继续读取与保存。" : "重新选择笔记文件夹后，可继续读取与保存。"].filter(Boolean).join("\n")}>
    {s.localWebReconnectRequired ? <ReopenLocalWeb /> : <Button onClick={s.needsPermission ? s.sidebar.onReauthorize : () => s.sidebar.onSelectVault(false)} disabled={s.working}>{s.needsPermission ? "重新授权" : "重新选择文件夹"}</Button>}
  </WorkspaceEmpty></>;
  if (s.listTimeout === "initial") return <>{pageHeading}<WorkspaceEmpty role="alert" connection title="笔记加载超时" description="暂时无法读取笔记列表，请重试。"><Button onClick={s.onRefresh} disabled={s.refreshingPages || s.switchingVault}>重试</Button></WorkspaceEmpty></>;
  if (!s.loading && !s.status?.connected && !(s.view === "tags" ? s.sidebar.tags : s.collection.notes).length) return <>{pageHeading}<WorkspaceEmpty guide title={s.unsupportedBrowser ? "通过本机服务连接笔记库" : "打开你的笔记文件夹"} description={s.unsupportedBrowser ? "此浏览器无法直接读写文件夹。请从 MemoCard 菜单栏打开，或使用 memocard serve。" : "打开已有的 Markdown / Obsidian 文件夹，或创建一个新笔记库。内容保存在你授权的文件夹中。"}>
    {!s.unsupportedBrowser && <div className="web-workspace-actions">{s.sidebar.canCreateVault && <CreateButton disabled={s.working} onClick={() => s.sidebar.onSelectVault(true)}>创建笔记库</CreateButton>}<Button variant="outline" disabled={!s.sidebar.canChooseVault || s.working} onClick={() => s.sidebar.onSelectVault(false)}><FolderIcon aria-hidden="true" />打开已有笔记库</Button></div>}
  </WorkspaceEmpty></>;
  if (s.view === "tags") {
    const docked = s.isMobile && layoutId === "drawer" && (themeId === "classic" || themeId === "minimal");
    return <Suspense fallback={<TagsLoading heading={heading} docked={docked} minimal={themeId === "minimal" && layoutId !== "sidebar"} />}><WorkspaceTags state={s} heading={heading} /></Suspense>;
  }
  const headingInToolbar = !s.collection.filters && s.collection.recentTags === undefined;
  return <>
    {!s.isMobile && s.view === "home" && (s.capture
      ? <Suspense fallback={<HomeCaptureLoading />}><QuickCapture key={`${s.capture.vaultId}:${s.capture.vaultBinding ?? ""}`} {...s.capture} draftCount={compactNavigation ? s.drafts.records.length : s.capture.draftCount} draftLabel={compactNavigation ? "草稿" : undefined} /></Suspense>
      : s.loading && <HomeCaptureLoading />)}
    {!headingInToolbar && pageHeading}
    <NoteCollection key={s.view === "home" ? "home" : "notes"} {...s.collection} heading={headingInToolbar ? pageHeading : undefined}
      showCreateInToolbar={!compactNavigation}>{s.error ? null : <CollectionEmpty state={s} />}</NoteCollection>
  </>;
}

const IOSAppChrome = recoverableLazy(() => import("../native/IOSAppChrome").then(module => ({ default: module.IOSAppChrome })), "导航");

function TagCollectionHeading({ tag, state: s }: { tag: string; state: AppViewState }) {
  const { preferences, saveAppearance } = useTagPreferences(s.sidebar.vaultId);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const icon = preferences.icons[tag] ?? "";
  const iconClass = "web-collection-tag-icon inline-flex size-element-md shrink-0 items-center justify-center rounded-[var(--radius-element)] bg-clip-border text-2xl [&_svg]:size-6";
  const tagId = encodeURIComponent(tagKey(tag));
  const leading = <TagIcon value={icon} />;
  return <>
    {s.canCreate || anchor
      ? <Button variant="ghost" size="icon" className={iconClass} data-tag={tagId} aria-label={`编辑标签图标 ${tag}`} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} disabled={!s.canCreate || s.working} onClick={event => setAnchor(event.currentTarget)}>{leading}</Button>
      : <span className={iconClass} data-tag={tagId} aria-hidden="true">{leading}</span>}
    <h1 className="capitalize" aria-label={s.title}>{tag}</h1>
    {anchor && <Suspense fallback={null}>
      <TagEditor path={tag} anchor={anchor} icon={icon} mobile={false} anchorIsTrigger initialPickerOpen
        onClose={() => setAnchor(null)} onSave={(name, nextIcon) => saveAppearance(tag, name, nextIcon, s.sidebar.onRenameTag)} />
    </Suspense>}
  </>;
}

export function WebAppView({ state: s }: { state: AppViewState }) {
  const pendingAppearance = useSyncExternalStore(subscribeTagAppearance, () => pendingTagAppearance(s.status?.vaultId, s.environment?.vaultBinding));
  const menuDelete = useRef(false);
  const [draftsMounted, setDraftsMounted] = useState(false);
  const showDrafts = s.drafts.open || Boolean(s.drafts.deleteTarget);
  useEffect(() => { if (showDrafts) setDraftsMounted(true); }, [showDrafts]);
  const savedNoteId = s.editor?.initial.baseHash ? s.editor.initial.id : undefined;
  const loadingNoteId = s.openingNoteId === "new" ? undefined : s.openingNoteId;
  const noteAppearance = useNoteAppearance(s.status?.vaultId, savedNoteId ?? loadingNoteId);
  const showNoteAppearance = Boolean(savedNoteId && noteAppearance.available);
  const detailBreadcrumbs = s.view === "home" ? ["主页"] : ["所有笔记", ...(s.sidebar.quickFilter ? [noteFilterLabels[s.sidebar.quickFilter]] : []), ...(s.sidebar.tag ? [s.sidebar.tag] : [])];
  const showBreadcrumb = s.isMobile || s.detailView;
  const mobileActions = s.isMobile && !s.nativeChrome && !isNative;
  const HeaderActions = mobileActions ? ActionGroup : "div";
  const navigationState = { view: s.view, detail: s.detailView, mobile: s.isMobile, native: isNative || Boolean(s.nativeChrome), sidebarOpen: s.sidebarOpen };
  const showTagHeading = !s.detailView && s.view === "tags" && !s.isMobile;
  const showNoteHeading = !s.detailView && s.view === "notes" && !s.isMobile && !s.nativeChrome;
  const collectionTag = showNoteHeading && !s.sidebar.quickFilter ? s.sidebar.tag : null;
  const collectionHeading = <><LayoutNavigationControls position="collection" {...navigationState} />
    {collectionTag ? <TagCollectionHeading key={JSON.stringify([s.sidebar.vaultId, collectionTag])} tag={collectionTag} state={s} /> : <h1>{s.title}</h1>}
  </>;
  const navigationControls = <>
    {s.detailView && <LayoutDetailNavigation state={s} />}
    <LayoutNavigationControls position="header" {...navigationState} />
    {s.isMobile && s.detailView && <Button variant="ghost" size="icon" className="web-header-icon" aria-label={s.backLabel} onClick={s.onBack}><HugeiconsIcon icon={ArrowLeft02Icon} className="size-5" aria-hidden="true" /></Button>}
  </>;
  const searchControl = <Button variant={mobileActions ? "ghost" : "outline"} size="icon-lg" disabled={!s.search.available} onClick={s.onSearch} aria-label="搜索全部笔记" aria-haspopup="dialog" aria-expanded={s.search.open}><SearchIcon aria-hidden="true" /></Button>;
  return <MobileActionGroupProvider enabled={mobileActions}><WorkspaceFrame state={s} leading={<>
    <TagColorStyles />
    {s.nativeChrome && <Suspense fallback={null}><IOSAppChrome {...s.nativeChrome} /></Suspense>}
    <a className="web-skip-link" href="#web-main-content" onClick={event => { event.preventDefault(); s.scrollContainer.current?.focus(); }}>跳到笔记内容</a>
  </>} overlays={<>
    {s.searchMounted && <Suspense fallback={null}><NoteSearchDialog key={s.status?.vaultId} {...s.search} /></Suspense>}
    {s.deletion && <Suspense fallback={null}><NoteDeleteDialog {...s.deletion} /></Suspense>}
    {!s.nativeChrome && (showDrafts || draftsMounted) && <Suspense fallback={null}><Drafts state={s} /></Suspense>}
    {s.nativeChrome && s.capture && <Suspense fallback={null}><QuickCapture key={`${s.capture.vaultId}:${s.capture.vaultBinding ?? ""}`} {...s.capture} /></Suspense>}
    {s.notice && <div className="web-toast" data-record-bar={s.isMobile && !s.detailView && (s.view === "home" || s.view === "notes") || undefined} role="status"><CheckIcon aria-hidden="true" />{s.notice}</div>}
  </>}>
        {!s.nativeChrome && <header className="web-app-header">
          <div className="web-header-leading">
            {mobileActions ? <ActionGroup aria-label="页面导航" className="web-header-navigation">{navigationControls}</ActionGroup> : navigationControls}
            {showBreadcrumb && <Breadcrumb aria-label="当前位置" className="web-crumb" data-detail={s.detailView || undefined}><BreadcrumbList>{s.detailView ? <>
              {detailBreadcrumbs.map((label, index) => <Fragment key={index}>{index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}<BreadcrumbItem><BreadcrumbLink className="h-6 rounded-element px-1 hover:bg-overlay-hover" render={<button type="button" />} onClick={() => index === detailBreadcrumbs.length - 1 ? s.onBack() : void s.onNavigate("notes", null, index ? s.sidebar.quickFilter : null)}>{label}</BreadcrumbLink></BreadcrumbItem></Fragment>)}
              <BreadcrumbSeparator>/</BreadcrumbSeparator><BreadcrumbItem><BreadcrumbPage className="px-1" data-ui-tooltip={s.title} data-ui-tooltip-overflow>{s.title}</BreadcrumbPage></BreadcrumbItem>
            </> : <BreadcrumbItem>{s.isMobile && (s.view === "home" || s.view === "notes") ? <MobileTagActions key={`${s.status?.vaultId}:${s.view}`} tag={s.view === "notes" && !s.collection.filters?.quickFilters.length && !s.sidebar.quickFilter ? s.sidebar.tag : null} title={s.title} vaultId={s.status?.vaultId} onRename={s.sidebar.onRenameTag} /> : <BreadcrumbPage>{s.title}</BreadcrumbPage>}</BreadcrumbItem>}</BreadcrumbList></Breadcrumb>}
          </div>
          <HeaderActions aria-label={mobileActions ? "页面操作组" : undefined} className="web-header-actions">
            {s.editor && s.capabilities.has("setNotePinned") && <TooltipProvider><Tooltip><TooltipTrigger render={<span className="web-pin-tooltip-trigger" tabIndex={s.pinDisabled ? 0 : undefined} />}><Button variant="ghost" size="icon" className={`web-header-icon${s.pinned ? " text-accent" : ""}`} aria-label={s.pinned ? "取消固定" : "固定到主页"} aria-description={!s.editor.initial.baseHash ? "保存笔记后可固定到主页" : undefined} aria-pressed={s.pinned} disabled={s.pinDisabled} onClick={s.onTogglePin}><HugeiconsIcon icon={PinIcon} fill={s.pinned ? "currentColor" : "none"} aria-hidden="true" /></Button></TooltipTrigger><TooltipContent>{!s.editor.initial.baseHash ? "保存笔记后可固定到主页" : s.pinned ? "取消固定" : "固定到主页"}</TooltipContent></Tooltip></TooltipProvider>}
            {(s.isMobile || s.detailView && (showNoteAppearance || Boolean(s.onRequestDelete))) && <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="web-header-icon" aria-label="页面操作" />}><HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56" finalFocus={() => { if (menuDelete.current) { menuDelete.current = false; s.onRequestDelete?.(); return false; } return true; }}>
              {s.isMobile && <><DropdownMenuItem disabled={!s.canCreate} onClick={() => void s.onNew()}><AddIcon aria-hidden="true" />新建笔记</DropdownMenuItem><DropdownMenuItem disabled={!s.canRefresh} onClick={s.onRefresh}><HugeiconsIcon icon={RefreshIcon} className={s.loading ? "animate-spin motion-reduce:animate-none" : undefined} aria-hidden="true" />刷新笔记库</DropdownMenuItem></>}
              {showNoteAppearance && <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><HugeiconsIcon icon={TextFontIcon} strokeWidth={2} aria-hidden="true" />外观和布局</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent aria-label="外观和布局" side={s.isMobile ? "bottom" : "left"} align={s.isMobile ? "end" : "start"} sideOffset={4} className="w-72 max-w-[calc(100dvw-1.5rem)] p-2">
                    <Suspense fallback={<p className="px-2 py-2.5 text-xs text-secondary" role="status">正在读取笔记外观…</p>}><NoteAppearanceMenu appearance={noteAppearance} /></Suspense>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {s.onRequestDelete && <DropdownMenuSeparator />}
              </>}
              {s.onRequestDelete && <DropdownMenuItem variant="destructive" disabled={!s.canDeleteNote} onClick={() => { menuDelete.current = true; }}><DeleteIcon aria-hidden="true" />移入回收站</DropdownMenuItem>}
              {s.isMobile && <>{s.drafts.records.length > 0 && <DropdownMenuItem onClick={() => s.drafts.onOpenChange(true)}>保留草稿（{s.drafts.records.length}）</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem onClick={() => void s.onNavigate("settings")}><SettingsIcon aria-hidden="true" />设置</DropdownMenuItem></>}
            </DropdownMenuContent></DropdownMenu>}
          </HeaderActions>
        </header>}
        <div ref={s.scrollContainer} id="web-main-content" tabIndex={-1} className={`web-app-scroll${s.detailView ? " note-page-scroll" : ""}`} data-detail={s.detailView || undefined} data-settings={s.view === "settings" || undefined}><div className="web-page-content" data-detail={s.detailView || undefined} data-settings={s.view === "settings" || undefined} data-view={s.view} data-small-text={noteAppearance.value.smallText || undefined} style={noteAppearance.available ? noteAppearance.style : undefined}>
          {s.switchingVault && <Notice title="正在打开笔记库"><Spinner aria-hidden="true" className="mr-2 inline" />首次读取可能需要一些时间。</Notice>}
          {Boolean(s.error) && !s.detailReadFailed && !(s.localWebReconnectRequired && (s.connectionState || s.view === "settings")) && <Notice title={s.localWebReconnectRequired ? "连接已断开" : "操作未完成"} error action={s.localWebReconnectRequired ? <ReopenLocalWeb inline /> : s.retryableError && <Button variant="outline" size="sm" disabled={!s.canRefresh || s.switchingVault} onClick={s.openingNote ? s.onRetryDetail : s.onRefresh}>重试</Button>}>{errorMessage(s.error)}</Notice>}
          {pendingAppearance && <Suspense fallback={null}><TagAppearanceNotice appearance={pendingAppearance}
            disabled={!s.status?.connected || s.switchingVault} /></Suspense>}
          {s.pinReadError != null && <Notice title="固定状态暂不可用" error action={<Button variant="outline" size="sm" disabled={s.pinRetryDisabled} onClick={s.onRefreshBackground}>重试</Button>}>{errorMessage(s.pinReadError)}</Notice>}
          {s.selectionNotice && !s.switchingVault && !s.connectionState && <Notice title="文件夹授权未完成" action={<Button variant="outline" size="sm" disabled={s.working} onClick={() => s.sidebar.onSelectVault(false)}>重新选择</Button>}>{s.selectionNotice}</Notice>}
          {s.needsPermission && !s.connectionState && <Notice title="重新授权笔记文件夹" action={<Button variant="outline" size="sm" disabled={s.working} onClick={s.sidebar.onReauthorize}>重新授权</Button>}>文件夹访问权限已失效，请重新授权以读取和保存。</Notice>}
          {s.status?.indexing && <Notice title={s.status.indexing.phase === "reading" ? "正在读取笔记库" : "正在建立索引"}>已处理 {s.status.indexing.processed}{s.status.indexing.total === null ? "" : ` / ${s.status.indexing.total}`} 篇，可继续使用已加载的笔记。草稿先保存在本机，校验后写入文件；搜索和筛选会逐步补齐。</Notice>}
          {s.status?.connected && !s.status.indexing && !s.status.coverage.complete && <CoverageNotice state={s} />}
          {s.drafts.issues.length > 0 && <Notice title="部分草稿无法读取">{s.drafts.issues.map((issue, i) => <p className="break-words not-last:mb-2" key={i}>{issue.message}{issue.path && <code className="block break-all">{issue.path}</code>}</p>)}</Notice>}
          <DraftReminder state={s} />
          {s.listTimeout === "refresh" && <Notice title="刷新超时" error action={<Button variant="outline" size="sm" disabled={s.refreshingPages || s.switchingVault} onClick={s.onRefreshBackground}>重试</Button>}>继续显示上次读取的内容。</Notice>}
          {!s.detailView && s.view !== "settings" && s.view !== "trash" && !showTagHeading && !showNoteHeading && (s.view === "home" ? <div className="web-home-mascot"><h1 className="sr-only">{s.title}</h1><HomeMascot /></div> : <div className={s.isMobile ? "sr-only" : "web-collection-heading"}>{collectionHeading}</div>)}
          <WorkspaceContent state={s} heading={showNoteHeading || showTagHeading ? collectionHeading : undefined} />
        </div></div>
        {s.isMobile && !s.nativeChrome && <footer className="web-mobile-record" hidden={s.detailView || (s.view !== "home" && s.view !== "notes") || s.search.open} aria-label="快捷记录">{mobileActions ? <ActionGroup size="lg">{searchControl}</ActionGroup> : searchControl}<div>{s.capture ? <Suspense fallback={<Button disabled className="w-full">记下此刻的想法…</Button>}><QuickCapture key={`${s.capture.vaultId}:${s.capture.vaultBinding ?? ""}`} {...s.capture} /></Suspense> : <Button disabled className="w-full">连接笔记库后开始记录</Button>}</div></footer>}
  </WorkspaceFrame></MobileActionGroupProvider>;

}
