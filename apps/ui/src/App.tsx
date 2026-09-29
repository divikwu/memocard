import { renameTag, renamedTag } from "./rename-tag";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Check, CircleAlert, FilePenLine, FolderOpen, Info, Layers2, LoaderCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { NavActions } from "@/components/nav-actions";
import { AppSidebar } from "@/components/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ThemeSettings } from "@/features/theme/ThemeSettings";
import type { Note, NotePage, VaultStatus } from "@memocard/contracts";
import { errorMessage, isBrowserVault, isConnectedClient, isLocalWeb, isNative, request, type Draft, type Environment } from "./bridge";
import { Editor } from "./Editor";
import { NotePreview } from "./NotePreview";
import { createId } from "./uuid";
import { subscribeToOpenNotes } from "./open-note";

type View = "notes" | "drafts" | "settings";
type TagCount = { name: string; count: number };
const getView = (): View => window.location.hash === "#/drafts" ? "drafts" : window.location.hash === "#/settings" ? "settings" : "notes";

export function App() {
  const [view, setView] = useState<View>(getView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchField = useRef<HTMLInputElement>(null);
  const searchRequested = useRef(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(isConnectedClient);
  const [webConnected, setWebConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [switchingVault, setSwitchingVault] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
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
      if (!nextStatus.connected) { setNotes([]); setDrafts([]); setTags([]); setFolders([]); setCursor(null); return; }
      // Poll connection health without collapsing the pages the reader has loaded.
      if (background && hasLoadedMore.current) return;
      const allowed = new Set([...nextStatus.capabilities, ...nextEnvironment.capabilities]);
      const [page, draftResult, tagResult, folderResult] = await Promise.all([
        allowed.has("queryNotes") ? request<NotePage>("queryNotes", { query: resetFilters ? "" : debouncedQuery, tags: !resetFilters && tag ? [tag] : [], limit: 30 }) : Promise.resolve(null),
        allowed.has("getDrafts") ? request<{ drafts: Draft[] }>("getDrafts") : Promise.resolve({ drafts: [] }),
        allowed.has("listTags") ? request<{ tags: TagCount[] }>("listTags") : Promise.resolve({ tags: [] }),
        allowed.has("listFolders") ? request<{ folders: string[] }>("listFolders") : Promise.resolve({ folders: [] }),
      ]);
      if (current !== generation.current) return;
      setNotes(page?.notes ?? []); setCursor(page?.nextCursor ?? null);
      setDrafts(draftResult.drafts); setTags(tagResult.tags); setFolders(folderResult.folders);
      hasLoadedMore.current = false;
    } catch (cause) { if (current === generation.current) { setError(errorMessage(cause)); setWebConnected(false); connectionLost.current = true; } }
    finally { refreshCount.current--; if (current === generation.current) setLoading(false); }
  }, [debouncedQuery, tag]);

  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void refresh(); return invalidateRequests; }, [refresh, invalidateRequests]);
  useEffect(() => {
    const onHash = () => { setView(getView()); setMenuOpen(false); };
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
    if (editingRef.current || selectingVault.current) return;
    setSelectionNotice("");
    selectingVault.current = true;
    setSwitchingVault(true);
    generation.current++;
    editorGeneration.current++;
    setWorking(true); setLoading(false); setError("");
    try {
      const result = await request<{ cancelled?: boolean; diagnostic?: string }>("selectVault", { create });
      if (result?.cancelled) {
        setSelectionNotice(isBrowserVault ? "未完成文件夹授权，笔记库没有切换。如果你已点击“打开”，请检查浏览器后续的访问授权提示；如果文件夹选择按钮灰色或仍无法打开，请在桌面 Chrome 或 Edge 的新窗口中打开当前地址再试。" + (result.diagnostic ? `（${result.diagnostic}）` : "") : "已取消选择文件夹，笔记库没有切换。");
        return;
      }
      setQuery(""); setDebouncedQuery(""); setTag(null);
      setNotes([]); setDrafts([]); setTags([]); setFolders([]); setCursor(null);
      setPendingOpenNote(null); openingLink.current = null;
      hasLoadedMore.current = false;
      await refresh(false, true);
    }
    catch (cause) { setError(errorMessage(cause)); }
    finally { selectingVault.current = false; setSwitchingVault(false); setWorking(false); }
  }

  async function reauthorizeVault() {
    setWorking(true); setError("");
    try { await request("reauthorizeVault"); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setWorking(false); }
  }

  const showEditor = useCallback((draft: Draft) => {
    editorGeneration.current++;
    if (openingLink.current && openingLink.current !== draft.id) setPendingOpenNote(openingLink.current);
    openingLink.current = null;
    editingRef.current = draft;
    setEditing(draft);
    setWorking(false);
  }, []);

  const openNote = useCallback(async (id: string, fromLink = false, draft?: Draft) => {
    if (selectingVault.current) return;
    if (editingRef.current) {
      if (fromLink && editingRef.current.id !== id) setPendingOpenNote(id);
      return;
    }
    if (openingLink.current && openingLink.current !== id && !fromLink) setPendingOpenNote(openingLink.current);
    openingLink.current = fromLink ? id : null;
    const currentRequest = ++editorGeneration.current;
    const pending = draft ?? drafts.find((item) => item.id === id);
    setWorking(true); setError("");
    try {
      const current = await request<Note & { vaultBinding?: string }>("getNote", { id });
      if (currentRequest !== editorGeneration.current) return;
      showEditor({ ...(pending ?? { id: current.id, body: current.body, tags: current.tags, baseHash: current.contentHash }), relativePath: current.relativePath, ...(isBrowserVault ? { vaultBinding: pending?.vaultBinding ?? current.vaultBinding ?? environment?.vaultBinding } : {}) });
    } catch (cause) {
      if (currentRequest !== editorGeneration.current) return;
      if (pending) showEditor(pending);
      else setError(errorMessage(cause));
    } finally {
      if (currentRequest === editorGeneration.current) { setWorking(false); openingLink.current = null; }
    }
  }, [drafts, showEditor, environment?.vaultBinding]);

  useEffect(() => () => { editorGeneration.current++; }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOpenNotes(window, (id) => { void openNote(id, true); });
    if (isNative && !readySent.current) {
      readySent.current = true;
      void request("uiReady").catch((cause: unknown) => setError(errorMessage(cause)));
    }
    return unsubscribe;
  }, [openNote]);

  function finishEditing() {
    editorGeneration.current++;
    editingRef.current = null;
    setEditing(null);
    void refresh();
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
    } catch (cause) { if (generation.current === current) setError(errorMessage(cause)); }
    finally { loadingMore.current = false; setPaging(false); }
  }

  async function toggleMCP() {
    setWorking(true); setError("");
    try { await request("setMCPEnabled", { enabled: !environment?.mcpEnabled }); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setWorking(false); }
  }

  async function changeWeb(operation: "openWeb" | "copyWebLink" | "stopWeb") {
    setWorking(true); setError("");
    try { await request(operation); if (operation === "copyWebLink") setNotice("访问链接已复制，请在 2 分钟内打开"); await refresh(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setWorking(false); }
  }

  const canCreate = Boolean(status?.connected && capabilities.has("saveNote") && (!isLocalWeb || webConnected) && (!isBrowserVault || !loading) && !switchingVault);
  const chooseAllowed = capabilities.has("selectVault");
  const createAllowed = chooseAllowed && (environment?.platform === "mac" || capabilities.has("createVault"));
  const needsPermission = isBrowserVault && capabilities.has("reauthorizeVault");
  const unsupportedBrowser = isBrowserVault && environment !== null && !chooseAllowed;
  const vaultStatusText = isLocalWeb && !webConnected ? "等待连接 Mac App" : needsPermission ? "需要重新授权" : !status?.connected ? "尚未连接"
    : status.coverage.issues > 0 ? `${status.coverage.issues} 个文件需处理`
    : status.coverage.pending > 0 ? `${status.coverage.pending} 个文件待读取`
    : !status.coverage.complete ? "部分文件尚未就绪" : "已连接文件夹";
  const title = view === "drafts" ? "草稿" : view === "settings" ? "设置" : tag ? `# ${tag}` : "所有笔记";
  const newNote = () => {
    if (selectingVault.current) return;
    const id = createId();
    showEditor({ id, body: "", tags: tag ? [tag] : [], baseHash: null, relativePath: `${folders.includes("") ? "" : "notes/"}${id}.md`, ...(isBrowserVault ? { vaultBinding: environment?.vaultBinding } : {}) });
  };

  const resumeDraft = (draft: Draft) => {
    if (selectingVault.current) return;
    if (draft.baseHash) void openNote(draft.id, false, draft);
    else showEditor({ ...draft, ...(isBrowserVault ? { vaultBinding: draft.vaultBinding ?? environment?.vaultBinding } : {}) });
  };

  const navigate = (nextView: View, nextTag: string | null = null) => {
    setView(nextView);
    if (nextView === "notes") { setTag(nextTag); }
    window.location.hash = `#/${nextView}`;
    setMenuOpen(false);
  };

  const searchNotes = () => {
    searchRequested.current = true;
    navigate("notes");
    requestAnimationFrame(() => {
      searchRequested.current = false;
      searchField.current?.focus();
    });
  };

  const navigation = <AppSidebar
    view={view} tag={tag} tags={tags} onRenameTag={async (from, to) => {
      if (!status?.vaultId || !canCreate || editing) throw new Error("请先完成当前编辑并连接笔记库。");
      try {
        await renameTag(from, to, status.vaultId);
        if (tag) setTag(renamedTag(tag, from, to));
      } finally { await refresh(); }
    }}
    draftCount={drafts.length}
    connected={Boolean(status?.connected)} modeLabel={isBrowserVault ? "浏览器 · 直接读写文件夹" : isLocalWeb ? "浏览器 · 由 Mac App 连接" : "本机 App"}
    vaultId={status?.vaultId} vaultName={status?.vaultName || "记忆卡"} vaultStatusText={vaultStatusText}
    hasVaultIssue={Boolean(error || needsPermission || (status?.connected && !status.coverage.complete))}
    canCreate={canCreate} canChooseVault={chooseAllowed} canCreateVault={createAllowed}
    needsPermission={needsPermission} working={switchingVault || Boolean(editing)}
    onNavigate={navigate} onNewNote={() => { newNote(); setMenuOpen(false); }}
    onSearch={searchNotes} onSelectVault={(create) => void selectVault(create)}
    onReauthorize={() => void reauthorizeVault()}
  />;

  return <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} openMobile={menuOpen} onOpenMobileChange={setMenuOpen} className="h-dvh min-h-0 overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-foreground">
    {navigation}
    <SidebarInset className="min-w-0 min-h-0">
      <header className="flex h-14 shrink-0 items-center gap-2 bg-background">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-sm">
          <SidebarTrigger className="shrink-0" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb aria-label="当前位置" className="min-w-0"><BreadcrumbList><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="line-clamp-1">{title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 px-3">
          {!isConnectedClient && <span className="hidden text-xs text-muted-foreground sm:inline">浏览器预览</span>}
          <NavActions canCreate={canCreate} canRefresh={isConnectedClient && !loading && !working} refreshing={loading} onNewNote={newNote} onRefresh={() => void refresh()} onSettings={() => navigate("settings")} />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="mx-auto w-full max-w-3xl space-y-4 py-10">
          <div className="sr-only"><div className="min-w-0"><h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>{view === "drafts" && <p className="mt-2 text-sm text-muted-foreground">继续编辑保存在这台设备上的草稿。</p>}</div>
          </div>
          {switchingVault && <Alert role="status"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /><AlertTitle>正在打开笔记库</AlertTitle><AlertDescription>请完成文件夹选择及浏览器访问授权，随后读取笔记库。首次读取可能需要一些时间。</AlertDescription></Alert>}
          {selectionNotice && !switchingVault && <Alert role="status"><Info className="size-4" /><AlertTitle>未打开笔记库</AlertTitle><AlertDescription>{selectionNotice}</AlertDescription></Alert>}
          {unsupportedBrowser && <Alert><Info className="size-4" /><AlertTitle>当前浏览器无法直接读写文件夹</AlertTitle><AlertDescription>请使用桌面版 Chrome 或 Edge，通过 HTTPS 网站或本机 localhost 地址打开记忆卡。笔记保存在你授权的本地文件夹中，不需要 Mac App。</AlertDescription></Alert>}
          {needsPermission && <Alert><FolderOpen className="size-4" /><AlertTitle>重新授权笔记文件夹</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><p>浏览器需要你确认文件夹访问权限，才能继续读取和保存笔记。</p><Button size="sm" onClick={() => void reauthorizeVault()} disabled={working}>重新授权</Button></AlertDescription></Alert>}
          {error && <Alert variant="destructive"><CircleAlert className="size-4" /><AlertTitle>操作未完成</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><p>{error}</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={!isConnectedClient || loading || switchingVault}>重试</Button>{isLocalWeb && <Button variant="outline" size="sm" asChild><a href="memocard://web">从 App 重新连接<ArrowUpRight className="size-3.5" /></a></Button>}</div></AlertDescription></Alert>}
          {status?.connected && !status.coverage.complete && <Alert role="status"><Info className="size-4" /><AlertTitle>部分文件尚未就绪</AlertTitle><AlertDescription>{status.coverage.pending > 0 ? `还有 ${status.coverage.pending} 个文件待读取。` : "部分文件尚未进入索引。"}当前结果可能不完整。</AlertDescription></Alert>}

          {view === "settings" ? <div className="space-y-4">
            <Card aria-labelledby="vault-settings-heading"><CardContent className="space-y-4">
              <div className="space-y-1">
                <h2 id="vault-settings-heading" className="text-sm font-medium">笔记文件夹</h2>
                <p className="text-sm leading-6 text-muted-foreground">{isBrowserVault ? "笔记与图片保存在所选文件夹中。跨设备使用时，先同步文件夹，再在各台电脑上授权。" : "笔记与图片保存在所选文件夹中，iCloud Drive 文件夹由系统同步。"}</p>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{status?.vaultName || "尚未连接笔记库"}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{status?.connected ? "已连接" : "未连接"}</span>
              </div>
              {isLocalWeb ? <p className="text-sm leading-6 text-muted-foreground">当前使用 Mac App 授权的文件夹。切换笔记库请在 App 中操作。</p> : !unsupportedBrowser && <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => void selectVault(false)} disabled={!chooseAllowed || working || Boolean(editing)}><FolderOpen className="size-4" />{isBrowserVault ? status?.connected ? "切换笔记库" : "打开已有笔记库" : "选择文件夹"}</Button>{createAllowed && <Button variant="ghost" onClick={() => void selectVault(true)} disabled={working || Boolean(editing)}>创建新笔记库</Button>}</div>}
              {isBrowserVault && !unsupportedBrowser && <p className="text-xs leading-5 text-muted-foreground">创建时请选择空文件夹。切换不会移动或删除原文件，草稿按笔记库保存在此浏览器中。</p>}
            </CardContent></Card>
            {status?.connected && <Card aria-labelledby="file-status-heading"><CardContent className="space-y-4">
              <div className="space-y-1"><h2 id="file-status-heading" className="text-sm font-medium">文件状态</h2><p className="text-sm leading-6 text-muted-foreground">本机文件可读取，不代表其他设备已经完成同步。</p></div>
              <dl className="divide-y divide-border/60 text-sm"><StatusRow label="已索引笔记" value={status?.connected ? status.coverage.indexed : "—"} /><StatusRow label="待读取文件" value={status?.connected ? status.coverage.pending : "—"} /><StatusRow label="需要处理的文件" value={status?.connected ? status.coverage.issues : "—"} /><StatusRow label="最近索引时间" value={status?.coverage.indexedAt ? formatDate(status.coverage.indexedAt) : "—"} /></dl>
            </CardContent></Card>}
            <ThemeSettings />
            {(capabilities.has("openWeb") || isLocalWeb) && <Card aria-labelledby="web-settings-heading"><CardContent className="space-y-4">
              <div className="space-y-1"><h2 id="web-settings-heading" className="text-sm font-medium">本机 Web</h2><p className="text-sm leading-6 text-muted-foreground">在这台 Mac 的浏览器中查看和编辑同一个笔记库，使用期间请保持记忆卡 App 运行。</p></div>
              <div className="flex flex-wrap gap-2">{isLocalWeb ? <Button variant="outline" asChild><a href="memocard://web">从 App 重新连接<ArrowUpRight className="size-4" /></a></Button> : <><Button onClick={() => void changeWeb("openWeb")} disabled={!status?.connected || working}>在浏览器中打开<ArrowUpRight className="size-4" /></Button>{capabilities.has("copyWebLink") && <Button variant="outline" onClick={() => void changeWeb("copyWebLink")} disabled={!status?.connected || working}>复制访问链接</Button>}{environment?.webEnabled && capabilities.has("stopWeb") && <Button variant="outline" onClick={() => void changeWeb("stopWeb")} disabled={working}>关闭本机 Web</Button>}</>}</div>
            </CardContent></Card>}
            {environment?.platform === "mac" && capabilities.has("setMCPEnabled") && <Card aria-labelledby="mcp-settings-heading"><CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4"><div className="space-y-1"><h2 id="mcp-settings-heading" className="text-sm font-medium"><label htmlFor="mcp-enabled">MCP 本机读取</label></h2><p className="text-sm leading-6 text-muted-foreground">{environment.mcpEnabled ? "已开启，只允许本机工具读取。" : "允许本机工具搜索和读取笔记。"}</p></div><Switch id="mcp-enabled" checked={environment.mcpEnabled} onCheckedChange={() => void toggleMCP()} disabled={!status?.connected || working} aria-label="MCP 本机读取" /></div>
              <p className="text-sm leading-6 text-muted-foreground">开启时选择连接配置的保存位置。读取期间请保持记忆卡运行，工具不会修改你的笔记。</p>{working && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />正在更新连接…</p>}
            </CardContent></Card>}
          </div> : <>
            {view === "notes" && status?.connected && <div className="space-y-3">
              <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={searchField} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记内容" aria-label="搜索笔记" disabled={!status?.connected || switchingVault} className="h-9 bg-background pl-9 pr-10 shadow-none" />{query && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setQuery("")} aria-label="清空搜索"><X className="size-3.5" /></Button>}</div>
              {tag && <div className="flex items-center gap-2 text-sm"><Badge variant="secondary" className="gap-1">#{tag}<Button variant="ghost" size="icon" className="-mr-1 size-5" onClick={() => setTag(null)} aria-label="清除标签筛选"><X className="size-3" /></Button></Badge><span className="text-xs text-muted-foreground">标签筛选</span></div>}
            </div>}
            {loading && notes.length === 0 && !drafts.length ? <LoadingNotes /> : !status?.connected ? <Card className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
                <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><FolderOpen className="size-6" strokeWidth={1.5} /></span>
                <h2 className="text-lg font-semibold">{isBrowserVault ? "打开你的笔记文件夹" : "连接你的笔记文件夹"}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{isBrowserVault ? "选择这台电脑上的 Obsidian / Markdown 笔记文件夹，或在空文件夹中创建一个。笔记与图片直接保存在文件夹里。" : "选择 iCloud Drive 中的笔记库，在 Mac 和 iPhone 上继续记录。首次使用可在 Mac 上创建。"}</p>
                {!unsupportedBrowser && <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {createAllowed && <Button onClick={() => void selectVault(true)} disabled={working || Boolean(editing)}>{working ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus className="size-4" />}创建笔记库</Button>}
                  <Button variant={createAllowed ? "outline" : "default"} onClick={() => void selectVault(false)} disabled={!chooseAllowed || working || Boolean(editing)}><FolderOpen className="size-4" />{isBrowserVault ? "打开已有笔记库" : "选择已有文件夹"}</Button>
                </div>}
                <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />{isBrowserVault || isNative ? "只访问你授权的文件夹" : "请在 App 中授权文件夹访问"}</p>
              </CardContent>
            </Card> : view === "drafts" ? drafts.length ? <div className="space-y-3">{drafts.map((draft) => <Card key={draft.draftKey ?? draft.id} className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none"><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><FilePenLine className="size-3.5" />本机草稿</span><time dateTime={draft.updatedAt}>{draft.updatedAt ? formatDate(draft.updatedAt) : "尚未提交"}</time></div><NotePreview body={draft.body} notePath={draft.relativePath} onError={setError} /><div className="flex items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5">{draft.tags.map((name) => <Badge variant="secondary" key={name}>#{name}</Badge>)}</div><Button variant="outline" size="sm" className="shrink-0" onClick={() => resumeDraft(draft)} disabled={!capabilities.has("saveNote")}>继续编辑</Button></div></CardContent></Card>)}</div> : <EmptyState icon="draft" title="没有未完成的草稿" description="编辑中的内容会自动保存在本机，下次可以接着写。" /> : notes.length ? <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{debouncedQuery ? `“${debouncedQuery}” 的搜索结果` : "按创建时间排列"}</span><span className="tabular-nums">已加载 {notes.length} 条{loading ? " · 更新中" : ""}</span></div>
              {notes.map((note) => <Card key={note.id} className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none"><CardContent className="p-5"><div className="mb-3 text-xs text-muted-foreground"><time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time></div><NotePreview body={note.body} notePath={note.relativePath} onError={setError} /><div className="mt-4 flex items-center justify-between gap-3"><div className="flex flex-wrap gap-1">{note.tags.map((name) => <Button key={name} variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal text-muted-foreground" onClick={() => navigate("notes", name)}>#{name}</Button>)}</div><Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" aria-label={`打开 ${formatDate(note.createdAt)} 的笔记`} onClick={() => void openNote(note.id)} disabled={working || !capabilities.has("getNote")}><span>编辑</span></Button></div></CardContent></Card>)}
              {cursor && <div className="flex justify-center pt-3"><Button variant="outline" onClick={() => void loadMore()} disabled={paging || switchingVault}>{paging ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowDown className="size-4" />}加载更多</Button></div>}
            </div> : <EmptyState icon={query || tag ? "search" : "note"} title={query || tag ? "没有找到相关笔记" : "记下第一条笔记"} description={query || tag ? "换一个关键词，或清除标签筛选。" : "一句想法、一段发现，不必想好标题。"}>{!query && !tag && <Button disabled={!canCreate} onClick={newNote}><Plus className="size-4" />新建笔记</Button>}</EmptyState>}
          </>}
        </div>
      </div>
    </SidebarInset>
    {notice && <div role="status" className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"><Check className="size-4" />{notice}</div>}
    {editing && <Editor key={editing.id} initial={editing} capabilities={capabilities} pendingLink={Boolean(pendingOpenNote)} onClose={finishEditing} onSaved={() => { setNotice("已保存"); finishEditing(); }} />}
  </SidebarProvider>;
}

function StatusRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right tabular-nums">{value}</dd></div>;
}

function LoadingNotes() {
  return <div role="status" aria-label="正在读取笔记库" className="space-y-3"><span className="sr-only">正在读取笔记库…</span>{[0, 1, 2].map((item) => <Card key={item} className="rounded-xl border-0 bg-muted/50 shadow-none"><CardContent className="space-y-4"><Skeleton className="h-3 w-28" /><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div><Skeleton className="h-5 w-16" /></CardContent></Card>)}</div>;
}

function EmptyState({ icon, title, description, children }: { icon: "note" | "draft" | "search"; title: string; description: string; children?: React.ReactNode }) {
  const Icon = icon === "search" ? Search : icon === "draft" ? FilePenLine : Layers2;
  return <Card className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none"><CardContent className="flex flex-col items-center px-6 py-14 text-center"><span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-6" strokeWidth={1.5} /></span><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{children && <div className="mt-6">{children}</div>}</CardContent></Card>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
