import { renameTag, renamedTag } from "./rename-tag";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleAlert, FolderOpen, Info, Layers2, LoaderCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { NavActions } from "@/components/nav-actions";
import { AppSidebar } from "@/components/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Note, NotePage, VaultStatus } from "@memocard/contracts";
import { errorMessage, isBrowserVault, isConnectedClient, isLocalWeb, isNative, reconnectVault, request, type Draft, type Environment, type RegisteredVault, type SelectVaultResult } from "./bridge";
import type { EditorHandle } from "./Editor";
import { createId } from "./uuid";
import { subscribeToOpenNotes } from "./open-note";
import { cn } from "@/lib/utils";

type View = "notes" | "settings";
type TagCount = { name: string; count: number };
const getView = (): View => window.location.hash === "#/settings" ? "settings" : "notes";
const bridgeErrorCode = (error: unknown): string | null => typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
const bridgeErrorRetryable = (error: unknown): boolean | null => typeof error === "object" && error !== null && "retryable" in error && typeof error.retryable === "boolean" ? error.retryable : null;
const Editor = lazy(() => import("./Editor").then((module) => ({ default: module.Editor })));
const NotePreview = lazy(() => import("./NotePreview").then((module) => ({ default: module.NotePreview })));
const ThemeSettings = lazy(() => import("@/features/theme/ThemeSettings").then((module) => ({ default: module.ThemeSettings })));

export function App() {
  const [view, setView] = useState<View>(getView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchField = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const returnScroll = useRef(0);
  const editorHandle = useRef<EditorHandle | null>(null);
  const editorHash = useRef('');
  const routeHandler = useRef<() => void>(() => {});
  const routeLoading = useRef('');
  const attemptedRoute = useRef('');
  const returnFocus = useRef<HTMLElement | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const unfiledRecovery = drafts.filter(draft => !draft.baseHash && (draft.title !== undefined || draft.body.trim()));
  const [tags, setTags] = useState<TagCount[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [registeredVaults, setRegisteredVaults] = useState<RegisteredVault[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(isConnectedClient);
  const [webConnected, setWebConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [switchingVault, setSwitchingVault] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<unknown>("");
  const [notice, setNotice] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [pendingOpenNote, setPendingOpenNote] = useState<string | null>(null);
  const generation = useRef(0);
  const refreshCount = useRef(0);
  const loadingMore = useRef(false);
  const hasLoadedMore = useRef(false);
  const connectionLost = useRef(false);
  const editorGeneration = useRef(0);
  const editingRef = useRef<Draft | null>(null);
  const openingLink = useRef<string | null>(null);
  const readySent = useRef(false);
  const selectingVault = useRef(false);
  const leaveEditor = useCallback(async () => {
    if (!editingRef.current) return true;
    if (!editorHandle.current || !(await editorHandle.current.flush())) return false;
    editorGeneration.current++;
    editingRef.current = null; setEditing(null);
    editorHash.current = '';
    attemptedRoute.current = '';
    window.history.replaceState(null, '', '#/notes');
    return true;
  }, []);
  const capabilities = useMemo(() => new Set([...(status?.capabilities ?? []), ...(environment?.capabilities ?? [])]), [status, environment]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 240);
    return () => clearTimeout(timer);
  }, [query]);

  const refresh = useCallback(async (background = false, resetFilters = false) => {
    if (!isConnectedClient || (background && (refreshCount.current > 0 || loadingMore.current || selectingVault.current))) return;
    refreshCount.current++;
    const current = ++generation.current;
    if (!background) { setLoading(true); setError(""); }
    try {
      const environmentResult = request<Environment>("getEnvironment").then((value) => {
        if (current === generation.current) setEnvironment(value);
        return value;
      });
      const [nextStatus, nextEnvironment] = await Promise.all([request<VaultStatus>("getStatus"), environmentResult]);
      if (current !== generation.current) return;
      setStatus(nextStatus); setEnvironment(nextEnvironment); setWebConnected(true);
      if (connectionLost.current) { connectionLost.current = false; setError(""); }
      const allowed = new Set([...nextStatus.capabilities, ...nextEnvironment.capabilities]);
      const vaultResult = allowed.has("listVaults") ? await request<{ vaults: RegisteredVault[] }>("listVaults") : { vaults: [] };
      if (current !== generation.current) return;
      setRegisteredVaults(vaultResult.vaults);
      if (!nextStatus.connected) { setNotes([]); setDrafts([]); setTags([]); setFolders([]); setCursor(null); return; }
      // Poll connection health without collapsing the pages the reader has loaded.
      if (background && hasLoadedMore.current) return;
      const recovered = allowed.has("getDrafts") ? await request<{ drafts: Draft[] }>("getDrafts") : { drafts: [] };
      const [page, tagResult, folderResult] = await Promise.all([
        allowed.has("queryNotes") ? request<NotePage>("queryNotes", { query: resetFilters ? "" : debouncedQuery, tags: !resetFilters && tag ? [tag] : [], limit: 30 }) : Promise.resolve(null),
        allowed.has("listTags") ? request<{ tags: TagCount[] }>("listTags") : Promise.resolve({ tags: [] }),
        allowed.has("listFolders") ? request<{ folders: string[] }>("listFolders") : Promise.resolve({ folders: [] }),
      ]);
      if (current !== generation.current) return;
      setNotes(page?.notes ?? []); setCursor(page?.nextCursor ?? null);
      setDrafts(recovered.drafts.filter(draft => draft.baseHash || draft.title !== undefined || draft.body.trim())); setTags(tagResult.tags); setFolders(folderResult.folders);
      hasLoadedMore.current = false;
    } catch (cause) { if (current === generation.current) { setError(cause); setWebConnected(false); connectionLost.current = true; } }
    finally { refreshCount.current--; if (current === generation.current) setLoading(false); }
  }, [debouncedQuery, tag]);

  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void refresh(); return invalidateRequests; }, [refresh, invalidateRequests]);
  useEffect(() => {
    const onHash = () => routeHandler.current();
    const onNativeEvent = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail;
      if (detail && typeof detail === "object" && "type" in detail && ["notesChanged", "statusChanged"].includes(String(detail.type))) void refresh();
    };
    const onVisible = () => { if (document.visibilityState === "visible" && !selectingVault.current) void refresh(); };
    const onFocus = () => { if (isLocalWeb || isBrowserVault) void refresh(true); };
    const poll = isLocalWeb || isBrowserVault ? setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, 5000) : undefined;
    window.addEventListener("hashchange", onHash);
    window.addEventListener("memocard:event", onNativeEvent);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(poll); window.removeEventListener("hashchange", onHash); window.removeEventListener("memocard:event", onNativeEvent); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);

  async function selectVault(create: boolean) {
    if (selectingVault.current || (editingRef.current && !(await leaveEditor()))) return;
    setSelectionNotice("");
    selectingVault.current = true;
    setSwitchingVault(true);
    generation.current++;
    editorGeneration.current++;
    setWorking(true); setLoading(false); setError("");
    try {
      const result = await request<SelectVaultResult>("selectVault", { create });
      if ("cancelled" in result) {
        if (isBrowserVault && result.diagnostic) setSelectionNotice("未完成文件夹授权，笔记库没有切换。请检查浏览器的文件夹访问授权后重试。" + `（${result.diagnostic}）`);
        return;
      }
      if ("reconnectUrl" in result) {
        reconnectVault(result.reconnectUrl);
        return;
      }
      setQuery(""); setDebouncedQuery(""); setTag(null);
      setRecoveryDismissed(false); setRecoveryOpen(false);
      setNotes([]); setDrafts([]); setTags([]); setFolders([]); setCursor(null);
      setPendingOpenNote(null); openingLink.current = null;
      hasLoadedMore.current = false;
      await refresh(false, true);
    }
    catch (cause) { setError(cause); }
    finally { selectingVault.current = false; setSwitchingVault(false); setWorking(false); }
  }

  const activateVault = useCallback(async (vaultId: string) => {
    if (selectingVault.current || vaultId === status?.vaultId || (editingRef.current && !(await leaveEditor()))) return;
    selectingVault.current = true;
    setSwitchingVault(true); setWorking(true); setError("");
    generation.current++; editorGeneration.current++;
    try {
      const result = await request<SelectVaultResult>("activateVault", { vaultId });
      if ("reconnectUrl" in result) { reconnectVault(result.reconnectUrl); return; }
      await refresh(false, true);
    } catch (cause) { setError(cause); }
    finally { selectingVault.current = false; setSwitchingVault(false); setWorking(false); }
  }, [refresh, status?.vaultId, leaveEditor]);

  useEffect(() => {
    const onVaultShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || event.repeat || event.isComposing || working) return;
      const match = /^Digit([1-9])$/.exec(event.code);
      if (!match) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const vault = registeredVaults[Number(match[1]) - 1];
      if (!vault) return;
      event.preventDefault();
      if (!vault.active) void activateVault(vault.vaultId);
    };
    window.addEventListener("keydown", onVaultShortcut);
    return () => window.removeEventListener("keydown", onVaultShortcut);
  }, [activateVault, registeredVaults, working]);

  async function reauthorizeVault() {
    setWorking(true); setError("");
    try { await request("reauthorizeVault"); await refresh(); }
    catch (cause) { setError(cause); }
    finally { setWorking(false); }
  }

  const showEditor = useCallback((draft: Draft) => {
    editorGeneration.current++;
    if (openingLink.current && openingLink.current !== draft.id) setPendingOpenNote(openingLink.current);
    openingLink.current = null;
    if (!editingRef.current) { returnScroll.current = scrollContainer.current?.scrollTop ?? 0; returnFocus.current = document.activeElement as HTMLElement; }
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = 0; });
    const hash = `#/notes/${draft.baseHash ? draft.id : 'new'}`;
    editorHash.current = hash;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setView('notes');
    editingRef.current = draft;
    setEditing(draft);
    setWorking(false);
  }, []);

  const openNote = useCallback(async (id: string, fromLink = false, draft?: Draft) => {
    if (selectingVault.current) return;
    if (editingRef.current) {
      if (editingRef.current.id === id) return;
      if (!(await leaveEditor())) { if (fromLink) setPendingOpenNote(id); return; }
    }
    if (openingLink.current && openingLink.current !== id && !fromLink) setPendingOpenNote(openingLink.current);
    openingLink.current = fromLink ? id : null;
    const currentRequest = ++editorGeneration.current;
    const pending = draft ?? drafts.find((item) => item.id === id);
    setWorking(true); setError("");
    try {
      const current = await request<Note & { vaultBinding?: string }>("getNote", { id });
      if (currentRequest !== editorGeneration.current) return;
      showEditor({ ...(pending ? { ...pending, updatedAt: pending.updatedAt ?? new Date().toISOString() } : { id: current.id, ...(current.title === undefined ? {} : { title: current.title }), body: current.body, tags: current.tags, baseHash: current.contentHash }), relativePath: current.relativePath, ...(isBrowserVault ? { vaultBinding: pending?.vaultBinding ?? current.vaultBinding ?? environment?.vaultBinding } : {}) });
    } catch (cause) {
      if (currentRequest !== editorGeneration.current) return;
      if (pending) showEditor({ ...pending, updatedAt: pending.updatedAt ?? new Date().toISOString() });
      else setError(cause);
    } finally {
      if (currentRequest === editorGeneration.current) { setWorking(false); openingLink.current = null; }
    }
  }, [drafts, showEditor, environment?.vaultBinding, leaveEditor]);

  useEffect(() => () => { editorGeneration.current++; }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOpenNotes(window, (id) => { void openNote(id, true); });
    if (isNative && !readySent.current) {
      readySent.current = true;
      void request("uiReady").catch((cause: unknown) => setError(cause));
    }
    return unsubscribe;
  }, [openNote]);

  function finishEditing() {
    editorGeneration.current++;
    editingRef.current = null;
    setEditing(null);
    editorHash.current = '';
    attemptedRoute.current = '';
    window.history.replaceState(null, '', '#/notes');
    setView('notes');
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = returnScroll.current; if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); });
    void refresh(true);
    if (pendingOpenNote) {
      const id = pendingOpenNote;
      setPendingOpenNote(null);
      void openNote(id, true);
    }
  }

  async function loadMore() {
    if (!cursor || paging) return;
    loadingMore.current = true;
    setPaging(true);
    const current = generation.current;
    try {
      const page = await request<NotePage>("queryNotes", { query: debouncedQuery, tags: tag ? [tag] : [], limit: 30, cursor });
      if (generation.current !== current) return;
      setNotes((previous) => [...previous, ...page.notes.filter((note) => !previous.some((item) => item.id === note.id))]); setCursor(page.nextCursor);
      hasLoadedMore.current = true;
    } catch (cause) { if (generation.current === current) setError(cause); }
    finally { loadingMore.current = false; setPaging(false); }
  }

  async function toggleMCP() {
    setWorking(true); setError("");
    try { await request("setMCPEnabled", { enabled: !environment?.mcpEnabled }); await refresh(); }
    catch (cause) { setError(cause); }
    finally { setWorking(false); }
  }

  async function openLocalWeb() {
    setWorking(true); setError("");
    try { await request("openWeb"); }
    catch (cause) { setError(cause); }
    finally { setWorking(false); }
  }

  const canCreate = Boolean(status?.connected && capabilities.has("saveNote") && (!isLocalWeb || webConnected) && (!isBrowserVault || !loading) && !switchingVault);
  const localWebReconnectRequired = isLocalWeb && ["BRIDGE_UNAVAILABLE", "WEB_UNAUTHORIZED"].includes(bridgeErrorCode(error) ?? "");
  const retryableError = bridgeErrorRetryable(error) ?? true;
  const chooseAllowed = capabilities.has("selectVault");
  const createAllowed = chooseAllowed && (environment?.platform === "mac" || capabilities.has("createVault"));
  const needsPermission = isBrowserVault && capabilities.has("reauthorizeVault");
  const unsupportedBrowser = isBrowserVault && environment !== null && !chooseAllowed;
  const vaultStatusText = isLocalWeb && !webConnected ? "等待连接本机服务" : needsPermission ? "需要重新授权" : !status?.connected ? "尚未连接"
    : status.coverage.issues > 0 ? `${status.coverage.issues} 个文件需处理`
    : status.coverage.pending > 0 ? `${status.coverage.pending} 个文件待读取`
    : !status.coverage.complete ? "部分文件尚未就绪" : "已连接文件夹";
  const title = editing ? (editing.title?.trim() || "新页面") : view === "settings" ? "设置" : tag ? `# ${tag}` : "所有笔记";
  const newNote = async () => {
    if (selectingVault.current || (editingRef.current && !(await leaveEditor()))) return;
    editorGeneration.current++;
    if (openingLink.current) setPendingOpenNote(openingLink.current);
    openingLink.current = null;
    const id = createId();
    showEditor({ id, title: '', body: tag ? `#${tag}\n\n` : '', tags: tag ? [tag] : [], baseHash: null, relativePath: `${folders.includes('') ? '' : 'notes/'}${id}.md`, ...(isBrowserVault ? { vaultBinding: environment?.vaultBinding } : {}) });
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = 0; });
  };

  const resumeDraft = async (draft: Draft) => {
    if (selectingVault.current || (editingRef.current && !(await leaveEditor()))) return;
    setRecoveryOpen(false);
    if (draft.baseHash) void openNote(draft.id, false, draft);
    else showEditor({ ...draft, ...(isBrowserVault ? { vaultBinding: draft.vaultBinding ?? environment?.vaultBinding } : {}) });
  };

  const navigate = async (nextView: View, nextTag: string | null = null) => {
    if (editingRef.current && !(await leaveEditor())) return;
    setView(nextView);
    if (nextView === "notes") { setTag(nextTag); }
    window.location.hash = `#/${nextView}`;
    setMenuOpen(false);
  };

  const searchNotes = async () => {
    if (editingRef.current && !(await leaveEditor())) return;
    void navigate("notes", tag);
    setSearchOpen(true);
  };

  useEffect(() => {
    routeHandler.current = () => {
      const requested = window.location.hash || '#/notes';
      if (requested === editorHash.current || routeLoading.current === requested) return;
      routeLoading.current = requested;
      attemptedRoute.current = requested;
      void (async () => {
        if (!(await leaveEditor())) { window.history.replaceState(null, '', editorHash.current); return; }
        window.history.replaceState(null, '', requested);
        const match = /^#\/notes\/([^/]+)$/.exec(requested);
        if (match && status?.connected) {
          if (match[1] === 'new') await newNote();
          else await openNote(decodeURIComponent(match[1]));
        } else { setView(getView()); setMenuOpen(false); }
      })().finally(() => { routeLoading.current = ''; });
    };
    if (!editingRef.current && !loading && status?.connected && attemptedRoute.current !== window.location.hash && /^#\/notes\//.test(window.location.hash)) routeHandler.current();
  });

  const navigation = <AppSidebar
    view={view} tag={tag} tags={tags} onRenameTag={async (from, to) => {
      if (!status?.vaultId || !canCreate || editing) throw new Error("请先完成当前编辑并连接笔记库。");
      try {
        await renameTag(from, to, status.vaultId);
        if (tag) setTag(renamedTag(tag, from, to));
      } finally { await refresh(); }
    }}
    connected={Boolean(status?.connected)}
    vaultId={status?.vaultId} vaultName={status?.vaultName || "记忆卡"} registeredVaults={registeredVaults} vaultStatusText={vaultStatusText}
    hasVaultIssue={Boolean(error || needsPermission || (status?.connected && !status.coverage.complete))}
    canCreate={canCreate} canChooseVault={chooseAllowed} canCreateVault={createAllowed}
    needsPermission={needsPermission} working={switchingVault}
    onNavigate={navigate} onNewNote={() => { newNote(); setMenuOpen(false); }}
    onSearch={searchNotes} onSelectVault={(create) => void selectVault(create)}
    onActivateVault={(vaultId) => void activateVault(vaultId)}
    onReauthorize={() => void reauthorizeVault()}
  />;

  return <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} openMobile={menuOpen} onOpenMobileChange={setMenuOpen} className="h-dvh min-h-0 overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-foreground">
    {navigation}
    <SidebarInset className="min-w-0 min-h-0">
      <header className="flex h-14 shrink-0 items-center gap-2 bg-background">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-sm">
          {editing && <Button variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => void editorHandle.current?.finish()} aria-label="返回笔记列表"><ArrowLeft className="size-4" /></Button>}
          <SidebarTrigger className={`shrink-0 ${editing ? "hidden md:inline-flex" : ""}`} />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb aria-label="当前位置" className="min-w-0"><BreadcrumbList><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="line-clamp-1">{title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 px-3">
          {!isConnectedClient && <span className="hidden text-xs text-muted-foreground sm:inline">浏览器预览</span>}
          <NavActions canCreate={canCreate} canRefresh={isConnectedClient && !loading && !working} refreshing={loading} onNewNote={newNote} onRefresh={() => void refresh()} onSettings={() => navigate("settings")} />
        </div>
      </header>
      <div ref={scrollContainer} className={cn("min-h-0 flex-1 overflow-y-auto", editing ? "note-page-scroll" : view === "notes" ? "px-4 md:px-[104px]" : "px-4 md:px-16")}>
        <div className={cn("mx-auto w-full space-y-4", editing ? "note-page-width" : view === "notes" ? "max-w-none py-10" : "max-w-3xl py-10")}>
          <div className={editing || view === "settings" ? "sr-only" : "min-w-0 pb-2"}>
            <h1 className="truncate text-[32px] font-bold leading-[1.2] tracking-tight">{title}</h1>
          </div>
          {switchingVault && <Alert role="status"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /><AlertTitle>正在打开笔记库</AlertTitle><AlertDescription>请完成文件夹选择及浏览器访问授权，随后读取笔记库。首次读取可能需要一些时间。</AlertDescription></Alert>}
          {selectionNotice && !switchingVault && <Alert role="status"><Info className="size-4" /><AlertTitle>文件夹授权未完成</AlertTitle><AlertDescription>{selectionNotice}</AlertDescription></Alert>}
          {unsupportedBrowser && <Alert><Info className="size-4" /><AlertTitle>需要启动 MemoCard 本机服务</AlertTitle><AlertDescription>Safari 和 Codex 通过本机服务读写笔记库；Chrome 和 Edge 也可以直接授权本地文件夹。请先运行 <code>memocard serve</code>，再从服务打开此页面。</AlertDescription></Alert>}
          {needsPermission && <Alert><FolderOpen className="size-4" /><AlertTitle>重新授权笔记文件夹</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><p>浏览器需要你确认文件夹访问权限，才能继续读取和保存笔记。</p><Button size="sm" onClick={() => void reauthorizeVault()} disabled={working}>重新授权</Button></AlertDescription></Alert>}
          {Boolean(error) && <Alert variant="destructive"><CircleAlert className="size-4" /><AlertTitle>{localWebReconnectRequired ? "本机 Web 已断开" : "操作未完成"}</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><p>{errorMessage(error)}</p><div className="flex flex-wrap gap-2">{localWebReconnectRequired ? <Button asChild variant="outline" size="sm"><a href="memocard-service://open-web">重新打开本机 Web</a></Button> : retryableError && <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={!isConnectedClient || loading || switchingVault}>重试</Button>}</div></AlertDescription></Alert>}
          {status?.connected && !status.coverage.complete && <Alert role="status"><Info className="size-4" /><AlertTitle>部分文件尚未就绪</AlertTitle><AlertDescription>{status.coverage.pending > 0 ? `还有 ${status.coverage.pending} 个文件待读取。` : "部分文件尚未进入索引。"}当前结果可能不完整。</AlertDescription></Alert>}

          {editing ? <Suspense fallback={<Skeleton className="h-80" />}><Editor key={editing.id} initial={editing} handle={editorHandle} capabilities={capabilities} pendingLink={Boolean(pendingOpenNote)} onClose={finishEditing} onSaved={finishEditing} onTitleChange={title => setEditing(current => current?.id === editing.id && current.title !== title ? { ...current, title } : current)} onCommitted={(note) => {
            setNotes(current => current.map(item => item.id === note.id ? note : item));
            editorHash.current = `#/notes/${note.id}`;
            window.history.replaceState(null, '', editorHash.current);
            // Keep the session and undo history mounted after the first commit.
            if (editingRef.current) editingRef.current = { ...editingRef.current, id: note.id, baseHash: note.contentHash };
          }} /></Suspense> : <>
          {view === "settings" ? <div className="space-y-8">
            <section aria-labelledby="vault-settings-heading" className="space-y-3">
              <h2 id="vault-settings-heading" className="text-balance text-base font-medium">笔记库</h2>
              <Card className="gap-0 py-0 shadow-none"><CardContent className="divide-y divide-border/60 px-4">
                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">当前笔记库</p>
                    <p className="truncate text-sm text-muted-foreground" title={status?.vaultName || undefined}>{status?.vaultName || "尚未连接笔记库"}</p>
                    <p className="text-pretty text-sm text-muted-foreground">{isLocalWeb ? "由 MemoCard 本机宿主授权，笔记与图片直接保存在所选文件夹中。" : isBrowserVault ? "笔记与图片保存在所选文件夹中。" : "笔记保存在所选文件夹中；iCloud Drive 文件夹由系统同步。"}</p>
                  </div>
                  {!unsupportedBrowser && <Button variant="outline" className="shrink-0 self-start shadow-none sm:self-center" onClick={() => void selectVault(false)} disabled={!chooseAllowed || working || Boolean(editing)}>{status?.connected ? "切换笔记库" : "打开已有笔记库"}</Button>}
                </div>
                {!unsupportedBrowser && createAllowed && <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0 space-y-1"><p className="text-sm font-medium">新笔记库</p><p className="text-pretty text-sm text-muted-foreground">在空文件夹中创建，不会移动或删除现有笔记。</p></div>
                  <Button variant="outline" className="shrink-0 self-start shadow-none sm:self-center" onClick={() => void selectVault(true)} disabled={working || Boolean(editing)}>创建新笔记库</Button>
                </div>}
                {status?.connected && <Collapsible>
                  <CollapsibleTrigger asChild><Button variant="ghost" className="group h-14 w-full justify-between px-0 has-[>svg]:px-0 hover:bg-transparent"><span>文件状态</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground group-data-[state=open]:rotate-180" /></Button></CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pb-4">
                    <p className="text-pretty text-sm text-muted-foreground">仅反映此设备的文件读取情况，不代表其他设备已完成同步。</p>
                    <dl className="divide-y divide-border/60 text-sm"><StatusRow label="已索引笔记" value={status.coverage.indexed} /><StatusRow label="待读取文件" value={status.coverage.pending} /><StatusRow label="需要处理的文件" value={status.coverage.issues} /><StatusRow label="最近索引时间" value={status.coverage.indexedAt ? formatDate(status.coverage.indexedAt) : "—"} /></dl>
                  </CollapsibleContent>
                </Collapsible>}
              </CardContent></Card>
            </section>
            <Suspense fallback={<Skeleton className="h-44 rounded-xl" />}><ThemeSettings /></Suspense>
            {capabilities.has("openWeb") && <section aria-labelledby="web-settings-heading" className="space-y-3"><h2 id="web-settings-heading" className="text-balance text-base font-medium">本机 Web</h2><Card className="shadow-none"><CardContent className="space-y-4">
              <div className="space-y-1"><p className="text-sm font-medium">浏览器访问</p><p className="text-pretty text-sm leading-6 text-muted-foreground">通过 MemoCard 菜单栏服务，在浏览器中打开统一的多笔记库界面。</p></div>
              <div className="flex flex-wrap gap-2"><Button onClick={() => void openLocalWeb()} disabled={working}>在浏览器中打开<ArrowUpRight className="size-4" /></Button></div>
            </CardContent></Card></section>}
            {environment?.platform === "mac" && capabilities.has("setMCPEnabled") && <section aria-labelledby="mcp-settings-heading" className="space-y-3"><h2 id="mcp-settings-heading" className="text-balance text-base font-medium">MCP 本机读取</h2><Card className="shadow-none"><CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4"><div className="space-y-1"><p className="text-sm font-medium"><label htmlFor="mcp-enabled">允许本机工具读取</label></p><p className="text-pretty text-sm leading-6 text-muted-foreground">{environment.mcpEnabled ? "已开启，只允许本机工具读取。" : "允许本机工具搜索和读取笔记。"}</p></div><Switch id="mcp-enabled" checked={environment.mcpEnabled} onCheckedChange={() => void toggleMCP()} disabled={!status?.connected || working} aria-label="MCP 本机读取" /></div>
              <p className="text-pretty text-sm leading-6 text-muted-foreground">开启时选择连接配置的保存位置。读取期间请保持记忆卡运行，工具不会修改你的笔记。</p>{working && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />正在更新连接…</p>}
            </CardContent></Card></section>}
          </div> : <>
            {view === "notes" && status?.connected && <div className="space-y-3">
              {query && <div className="flex items-center gap-2 text-sm"><span>搜索：{query}</span><Button variant="ghost" size="icon" className="size-6" onClick={() => setQuery("")} aria-label="清空搜索"><X className="size-3" /></Button></div>}
              {tag && <div className="flex items-center gap-2 text-sm"><Badge variant="secondary" className="h-5 gap-1 bg-sky-50 py-0 text-sky-700">#{tag}<Button variant="ghost" size="icon" className="-mr-1 size-5" onClick={() => setTag(null)} aria-label="清除标签筛选"><X className="size-3" /></Button></Badge><span className="text-xs text-muted-foreground">标签筛选</span></div>}
            </div>}
            {status?.connected && unfiledRecovery.length > 0 && !recoveryDismissed && <Alert>
              <CircleAlert className="size-4" /><AlertTitle>发现 {unfiledRecovery.length} 条未保存内容</AlertTitle>
              <AlertDescription>这些内容尚未保存为笔记，可以继续编辑并保存。稍后处理不会删除内容。
                <div className="mt-2 flex gap-2"><Button variant="outline" size="sm" onClick={() => { if (unfiledRecovery.length === 1) void resumeDraft(unfiledRecovery[0]); else setRecoveryOpen(true); }}>恢复内容</Button><Button variant="ghost" size="sm" onClick={() => setRecoveryDismissed(true)}>稍后处理</Button></div>
              </AlertDescription>
            </Alert>}
            <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}><DialogContent><DialogTitle>恢复未保存内容</DialogTitle><DialogDescription>选择要恢复的内容，继续编辑并保存。</DialogDescription><div className="max-h-80 space-y-2 overflow-auto">{unfiledRecovery.map(draft => <Button className="h-auto w-full justify-start whitespace-normal text-left" variant="ghost" key={draft.draftKey ?? draft.id} onClick={() => void resumeDraft(draft)}>{draft.title || draft.body.slice(0, 100) || "新页面"}</Button>)}</div></DialogContent></Dialog>

            {loading && notes.length === 0 && !drafts.length ? <LoadingNotes /> : !status?.connected ? <Card className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
                <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><FolderOpen className="size-6" strokeWidth={1.5} /></span>
                <h2 className="text-lg font-semibold">{unsupportedBrowser ? "连接 MemoCard 本机服务" : isBrowserVault ? "打开你的笔记文件夹" : "连接你的笔记文件夹"}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{unsupportedBrowser ? "运行 memocard serve，从菜单栏服务打开经过授权的本机页面。" : isBrowserVault ? "选择这台电脑上的 Obsidian / Markdown 笔记文件夹，或在空文件夹中创建一个。笔记与图片直接保存在文件夹里。" : isLocalWeb ? "使用本机文件夹选择器打开已有笔记库，或在空文件夹中创建一个。" : "选择 iCloud Drive 中的笔记库，在 Mac 和 iPhone 上继续记录。首次使用可在 Mac 上创建。"}</p>
                {!unsupportedBrowser && <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {createAllowed && <Button onClick={() => void selectVault(true)} disabled={working || Boolean(editing)}>{working ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus className="size-4" />}创建笔记库</Button>}
                  <Button variant={createAllowed ? "outline" : "default"} onClick={() => void selectVault(false)} disabled={!chooseAllowed || working || Boolean(editing)}><FolderOpen className="size-4" />{isBrowserVault ? "打开已有笔记库" : "选择已有文件夹"}</Button>
                </div>}
                <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />{isBrowserVault || isNative ? "只访问你授权的文件夹" : "只访问你通过 MemoCard 本机宿主授权的文件夹"}</p>
              </CardContent>
            </Card> : notes.length ? <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{debouncedQuery ? `“${debouncedQuery}” 的搜索结果` : "按创建时间排列"}</span><span className="tabular-nums">已加载 {notes.length} 条{loading ? " · 更新中" : ""}</span></div>
              <ul aria-label="笔记列表" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
                {notes.map((note) => <li key={note.id} className="min-w-0"><Card className="h-64 gap-0 overflow-hidden rounded-xl border border-border bg-card py-0 shadow-[0_4px_12px_rgba(25,25,25,0.027),0_1px_2px_rgba(25,25,25,0.02)] transition-colors hover:bg-accent focus-within:ring-2 focus-within:ring-ring/40"><CardContent className="flex h-full min-h-0 flex-col p-0">
                  <button type="button" className="flex min-h-0 flex-1 flex-col text-left outline-none disabled:cursor-default" aria-label={`打开 ${formatDate(note.createdAt)} 的笔记`} onClick={() => void openNote(note.id)} disabled={working || !capabilities.has("getNote")}>
                    <div className="w-full px-4 pb-2 pt-4"><span className="block truncate text-base font-medium">{note.title?.trim() || "新页面"}</span><time className="mt-1 block text-xs text-muted-foreground/80" dateTime={note.createdAt}>{formatDate(note.createdAt)}</time></div>
                    <div className="min-h-0 w-full flex-1 overflow-hidden px-4 pb-2"><Suspense fallback={<Skeleton className="h-full" />}><NotePreview compact showTitle={false} hiddenTags={note.tags} title={note.title} body={note.body} notePath={note.relativePath} onError={setError} /></Suspense></div>
                  </button>
                  {note.tags.length > 0 && <div className="flex min-h-10 items-center gap-2 overflow-hidden px-4 pb-3">{note.tags.slice(0, 2).map((name) => <Badge key={name} asChild variant="secondary" className="h-5 bg-sky-50 px-1.5 py-0 font-normal text-sky-700 hover:text-sky-800"><button type="button" onClick={() => navigate("notes", name)}>#{name}</button></Badge>)}{note.tags.length > 2 && <span className="shrink-0 text-xs text-muted-foreground/60">+{note.tags.length - 2}</span>}</div>}
                </CardContent></Card></li>)}
              </ul>
              {cursor && <div className="flex justify-center pt-3"><Button variant="outline" onClick={() => void loadMore()} disabled={paging || switchingVault}>{paging ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowDown className="size-4" />}加载更多</Button></div>}
            </div> : <EmptyState icon={query || tag ? "search" : "note"} title={query || tag ? "没有找到相关笔记" : "记下第一条笔记"} description={query || tag ? "换一个关键词，或清除标签筛选。" : "一句想法、一段发现，不必想好标题。"}>{!query && !tag && <Button disabled={!canCreate} onClick={newNote}><Plus className="size-4" />新建笔记</Button>}</EmptyState>}
          </>}
          </>}
        </div>
      </div>
    </SidebarInset>
    {notice && <div role="status" className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground"><Check className="size-4" />{notice}</div>}
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); searchField.current?.focus(); }}><DialogTitle>搜索笔记</DialogTitle><DialogDescription>输入关键词筛选笔记，关闭后查看结果。</DialogDescription>
      <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={searchField} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记内容" aria-label="搜索笔记" disabled={!status?.connected || switchingVault} className="h-9 bg-background pl-9 pr-10 shadow-none" />{query && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setQuery("")} aria-label="清空搜索"><X className="size-3.5" /></Button>}</div>
      <Button onClick={() => setSearchOpen(false)}>查看结果</Button>
    </DialogContent></Dialog>

  </SidebarProvider>;
}

function StatusRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right tabular-nums">{value}</dd></div>;
}

function LoadingNotes() {
  return <div role="status" aria-label="正在读取笔记库" className="space-y-3"><span className="sr-only">正在读取笔记库…</span>{[0, 1, 2].map((item) => <Card key={item} className="rounded-xl border-0 bg-muted/50 shadow-none"><CardContent className="space-y-4"><Skeleton className="h-3 w-28" /><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div><Skeleton className="h-5 w-16" /></CardContent></Card>)}</div>;
}

function EmptyState({ icon, title, description, children }: { icon: "note" | "search"; title: string; description: string; children?: React.ReactNode }) {
  const Icon = icon === "search" ? Search : Layers2;
  return <Card className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-6" strokeWidth={1.5} /></span><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{children && <div className="mt-6">{children}</div>}</CardContent></Card>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
