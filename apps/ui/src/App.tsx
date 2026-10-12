import { TagColorProvider } from './TagColorProvider';
import { renamedTag } from "./rename-tag";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, CircleAlert, FolderOpen, Info, Layers2, LoaderCircle, Plus, Search, ShieldCheck, X } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { NavActions } from "@/components/nav-actions";
import { AppSidebar } from "@/components/app-sidebar";
import { noteFilterEmptyTitles, noteFilterLabels } from "./note-filter-labels";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageNotice } from "@/components/page-notice";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Note, NoteFilterCounts, NotePage, NoteQuickFilter, VaultStatus } from "@memocard/contracts";
import { errorMessage, isBrowserVault, isConnectedClient, isLocalWeb, isNative, reconnectVault, request, type Draft, type DraftList, type DraftIssue, type Environment, type RegisteredVault, type SelectVaultResult } from "./bridge";
import type { EditorHandle } from "./Editor";
import { createId } from "./uuid";
import { subscribeToOpenNotes } from "./open-note";
import { cn } from "@/lib/utils";

type View = "notes" | "settings";
type TagCount = { name: string; count: number };
const getView = (): View => window.location.hash === "#/settings" ? "settings" : "notes";
const bridgeErrorCode = (error: unknown): string | null => typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
const bridgeErrorRetryable = (error: unknown): boolean | null => typeof error === "object" && error !== null && "retryable" in error && typeof error.retryable === "boolean" ? error.retryable : null;
const loadEditor = () => import("./Editor").then((module) => ({ default: module.Editor }));
const Editor = lazy(loadEditor);
const NoteCollection = lazy(() => import("./components/note-collection").then((module) => ({ default: module.NoteCollection })));
const ThemeSettings = lazy(() => import("@/features/theme/ThemeSettings").then((module) => ({ default: module.ThemeSettings })));
const Switch = lazy(() => import("@/components/ui/switch").then(module => ({ default: module.Switch })));

export function App() {
  const [view, setView] = useState<View>(getView);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchField = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const returnScroll = useRef(0);
  const refreshAnchor = useRef<{id: string; top: number} | null>(null);
  const editorHandle = useRef<EditorHandle | null>(null);
  const editorHash = useRef('');
  const routeHandler = useRef<() => void>(() => {});
  const routeLoading = useRef('');
  const attemptedRoute = useRef('');
  const [pendingRoute, setPendingRoute] = useState<string | null>(() => /^#\/notes\/[^/]+$/.test(window.location.hash) ? window.location.hash : null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [reminderWorking, setReminderWorking] = useState(false);
  const [recoveryError, setRecoveryError] = useState<unknown>(null);
  const [routeReady, setRouteReady] = useState(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const loadedVaultId = useRef<string | null>(null);
  const loadedListKey = useRef<string | null>(null);
  const [readDetailsOpen, setReadDetailsOpen] = useState(false);
  const [rereading, setRereading] = useState(false);
  const [listTimeout, setListTimeout] = useState<"initial" | "refresh" | null>(null);
  useLayoutEffect(() => {
    const anchor = refreshAnchor.current, container = scrollContainer.current;
    refreshAnchor.current = null;
    if (!anchor || !container) return;
    const row = Array.from(container.querySelectorAll<HTMLElement>("[data-note-id]")).find(item => item.dataset.noteId === anchor.id);
    if (row) container.scrollTop += row.getBoundingClientRect().top - anchor.top;
  }, [notes]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftIssues, setDraftIssues] = useState<DraftIssue[]>([]);
  const recoveryRecords = drafts.filter(draft => (draft.unscoped || !draft.baseHash || drafts.some(other => other !== draft && other.id === draft.id)) && (draft.baseHash || draft.title?.trim() || draft.body.trim() || draft.pendingProperties?.length));
  const recoveryChoices = recoveryRecords.filter(draft => !draft.reminderDismissed);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [registeredVaults, setRegisteredVaults] = useState<RegisteredVault[]>([]);
  const [tag, setTag] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<NoteQuickFilter | null>(null);
  const [filterCounts, setFilterCounts] = useState<NoteFilterCounts>();
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(isConnectedClient);
  const [webConnected, setWebConnected] = useState(false);
  const [working, setWorking] = useState(false);
  const [switchingVault, setSwitchingVault] = useState(false);
  const [paging, setPaging] = useState(false);
  const [refreshingPages, setRefreshingPages] = useState(false);
  const [error, setError] = useState<unknown>("");
  const [notice, setNotice] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const [editing, setEditing] = useState<(Draft & { note?: Note }) | null>(null);
  const [pendingOpenNote, setPendingOpenNote] = useState<string | null>(null);
  const generation = useRef(0);
  const refreshCount = useRef(0);
  const pendingRefresh = useRef(false);
  const loadingMore = useRef(false);
  const loadedPages = useRef(1);
  const connectionLost = useRef(false);
  const editorGeneration = useRef(0);
  const routeNoteRequest = useRef<{ id: string; generation: number; promise: Promise<Note & { vaultBinding?: string }> } | null>(null);
  const editingRef = useRef<Draft | null>(null);
  const openingLink = useRef<string | null>(null);
  const readySent = useRef(false);
  const selectingVault = useRef(false);
  const leaveEditor = useCallback(async () => {
    if (editingRef.current && (!editorHandle.current || !(await editorHandle.current.flush()))) return false;
    editorGeneration.current++;
    editingRef.current = null; setEditing(null);
    setPendingRoute(null); setWorking(false);
    editorHash.current = '';
    attemptedRoute.current = '';
    window.history.replaceState(null, '', '#/notes');
    return true;
  }, []);
  const restoreListPosition = useCallback(() => {
    requestAnimationFrame(() => {
      const container = scrollContainer.current;
      if (container) container.scrollTop = returnScroll.current;
      const previous = returnFocus.current;
      const id = previous?.closest<HTMLElement>('[data-note-id]')?.dataset.noteId;
      const row = id && container ? Array.from(container.querySelectorAll<HTMLElement>('[data-note-id]')).find(item => item.dataset.noteId === id) : undefined;
      (previous?.isConnected ? previous : row?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    });
  }, []);
  const capabilities = useMemo(() => new Set([...(status?.capabilities ?? []), ...(environment?.capabilities ?? [])]), [status, environment]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 240);
    return () => clearTimeout(timer);
  }, [query]);

  const refresh = useCallback(async (background = false, resetFilters = false) => {
    if (!isConnectedClient || (background && (refreshCount.current > 0 || loadingMore.current || selectingVault.current))) return;
    pendingRefresh.current = false;
    refreshCount.current++;
    setRefreshingPages(true);
    const current = ++generation.current;
    let serviceResponded = false;
    let listReadTimedOut = false;
    let listKey = "";
    if (!background) { setLoading(true); setRouteReady(false); setError(""); setListTimeout(null); }
    try {
      const environmentResult = request<Environment>("getEnvironment").then((value) => {
        if (current === generation.current) setEnvironment(value);
        return value;
      });
      const [nextStatus, nextEnvironment] = await Promise.all([request<VaultStatus>("getStatus", {background: true}), environmentResult]);
      if (current !== generation.current) return;
      setStatus(nextStatus); setEnvironment(nextEnvironment); setWebConnected(true);
      serviceResponded = true;
      listKey = JSON.stringify([nextStatus.vaultId, resetFilters ? "" : debouncedQuery, resetFilters ? null : tag, resetFilters ? null : quickFilter]);
      if (connectionLost.current) { connectionLost.current = false; setError(""); }
      const allowed = new Set([...nextStatus.capabilities, ...nextEnvironment.capabilities]);
      const deepLink = /^#\/notes\/([^/]+)$/.exec(window.location.hash);
      if (nextStatus.connected && !editingRef.current && deepLink && deepLink[1] !== "new" && allowed.has("getNote")) {
        const id = decodeURIComponent(deepLink[1]);
        const promise = request<Note & { vaultBinding?: string }>("getNote", { id });
        void promise.catch(() => undefined);
        routeNoteRequest.current = { id, generation: current, promise };
      }
      const vaultResult = allowed.has("listVaults") ? request<{ vaults: RegisteredVault[] }>("listVaults") : Promise.resolve({ vaults: [] });
      // Attach rejection handling now; the registry does not gate note recovery.
      const registry = vaultResult.then(value => { if (current === generation.current) setRegisteredVaults(value.vaults); });
      void registry.catch(() => undefined);
      if (!nextStatus.connected) {
        await registry;
        if (current !== generation.current) return;
        // Keep the last list only when the same vault needs its permission renewed.
        if (!allowed.has("reauthorizeVault") || !nextStatus.vaultId || nextStatus.vaultId !== loadedVaultId.current) {
          loadedListKey.current = null;
          setNotes([]); setDrafts([]); setDraftIssues([]); setTags([]); setFolders([]); setFilterCounts(undefined);
        }
        setCursor(null); return;
      }
      let recovered: DraftList = {drafts: []};
      try { if (allowed.has("getDrafts")) recovered = await request<DraftList>("getDrafts"); }
      catch (cause) { recovered.issues = [{code:"RECOVERY_UNAVAILABLE",message:errorMessage(cause)}]; }
      if (current !== generation.current) return;
      setDrafts([...recovered.drafts,...recovered.unscopedDrafts ?? []].filter(draft => draft.baseHash || draft.title?.trim() || draft.body.trim() || draft.pendingProperties?.length));
      setDraftIssues(recovered.issues ?? []);
      setRouteReady(true);
      // Replay the loaded extent using one fresh cursor chain; never merge two snapshots.
      const pageCount = background && !resetFilters ? loadedPages.current : 1;
      const readPages = async (): Promise<NotePage | null> => {
        if (!allowed.has("queryNotes")) return null;
        for (let attempt = 0; ; attempt++) {
          try {
            let page: NotePage | null = null;
            let nextCursor: string | null = null;
            const refreshed: Note[] = [];
            for (let index = 0; index < pageCount; index++) {
              if (current !== generation.current) return null;
              page = await request<NotePage>("queryNotes", { query: resetFilters ? "" : debouncedQuery, tags: !resetFilters && tag ? [tag] : [], ...(quickFilter && !resetFilters ? { quickFilter } : {}), limit: 30, ...(nextCursor ? {cursor: nextCursor} : {}) });
              refreshed.push(...page.notes);
              nextCursor = page.nextCursor;
              if (!nextCursor) break;
            }
            return page && {...page, notes: refreshed};
          } catch (cause) {
            if (bridgeErrorCode(cause) === "TIMEOUT") listReadTimedOut = true;
            if (bridgeErrorCode(cause) !== "STALE_CURSOR" || attempt >= 2 || current !== generation.current) throw cause;
          }
        }
      };
      const [page, tagResult, folderResult] = await Promise.all([
        readPages(),
        allowed.has("listTags") ? request<{ tags: TagCount[] }>("listTags") : Promise.resolve({ tags: [] }),
        allowed.has("listFolders") ? request<{ folders: string[] }>("listFolders") : Promise.resolve({ folders: [] }),
        registry,
      ]);
      if (current !== generation.current) return;
      if (background && !editingRef.current && scrollContainer.current && scrollContainer.current.scrollTop > 0) {
        const container = scrollContainer.current;
        const row = Array.from(container.querySelectorAll<HTMLElement>("[data-note-id]")).find(item => item.getBoundingClientRect().bottom > container.getBoundingClientRect().top);
        if (row?.dataset.noteId) refreshAnchor.current = {id: row.dataset.noteId, top: row.getBoundingClientRect().top};
      }
      loadedVaultId.current = nextStatus.vaultId ?? null;
      loadedListKey.current = page ? listKey : null;
      setListTimeout(null);
      setNotes(page?.notes ?? []); setCursor(page?.nextCursor ?? null);
      setError((previous: unknown) => bridgeErrorCode(previous) === "STALE_CURSOR" ? "" : previous);
      setFilterCounts(page?.filterCounts);
      setTags(tagResult.tags); setFolders(folderResult.folders);
      if (!background || resetFilters) loadedPages.current = 1;
    } catch (cause) { if (current === generation.current) {
      if (listReadTimedOut) setListTimeout(loadedListKey.current === listKey ? "refresh" : "initial");
      else setError(cause);
      if (!serviceResponded || ["BRIDGE_UNAVAILABLE", "WEB_UNAUTHORIZED"].includes(bridgeErrorCode(cause) ?? "")) { setWebConnected(false); connectionLost.current = true; }
    } }
    finally {
      refreshCount.current--;
      if (refreshCount.current === 0) setRefreshingPages(false);
      if (current === generation.current) {
        setLoading(false);
        if (pendingRefresh.current && !loadingMore.current && !selectingVault.current) void refresh(true);
      }
    }
  }, [debouncedQuery, tag, quickFilter]);

  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void refresh(); return invalidateRequests; }, [refresh, invalidateRequests]);
  useEffect(() => { if (/^#\/notes\/[^/]+$/.test(window.location.hash)) void loadEditor().catch(() => undefined); }, []);
  useEffect(() => {
    const onHash = () => routeHandler.current();
    const onNativeEvent = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail;
      if (detail && typeof detail === "object" && "type" in detail && ["notesChanged", "statusChanged"].includes(String(detail.type))) {
        if (refreshCount.current > 0 || loadingMore.current || selectingVault.current) pendingRefresh.current = true;
        else void refresh(true);
      }
    };
    const onVisible = () => { if (document.visibilityState === "visible" && !selectingVault.current) void refresh(true); };
    const onFocus = () => { if (isLocalWeb || isBrowserVault) void refresh(true); };
    const poll = isLocalWeb || isBrowserVault ? setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, 5000) : undefined;
    window.addEventListener("hashchange", onHash);
    window.addEventListener("memocard:event", onNativeEvent);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(poll); window.removeEventListener("hashchange", onHash); window.removeEventListener("memocard:event", onNativeEvent); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  useEffect(() => {
    if (!status?.indexing) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, 1000);
    return () => clearInterval(timer);
  }, [status?.indexing, refresh]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);

  async function selectVault(create: boolean) {
    if (selectingVault.current || ((editingRef.current || editorHash.current) && !(await leaveEditor()))) return;
    setSelectionNotice("");
    selectingVault.current = true;
    setSwitchingVault(true);
    generation.current++;
    editorGeneration.current++;
    setWorking(true); setLoading(false); setError("");
    try {
      const result = await request<SelectVaultResult>("selectVault", { create });
      if ("cancelled" in result) {
        if (isBrowserVault && result.diagnostic) setSelectionNotice(result.diagnostic);
        return;
      }
      if ("reconnectUrl" in result) {
        reconnectVault(result.reconnectUrl);
        return;
      }
      setQuery(""); setDebouncedQuery(""); setTag(null); setQuickFilter(null); setFilterCounts(undefined);
      setRecoveryDismissed(false); setRecoveryOpen(false);
      loadedListKey.current = null;
      setNotes([]); setDrafts([]); setDraftIssues([]); setTags([]); setFolders([]); setCursor(null);
      setPendingOpenNote(null); openingLink.current = null;
      loadedPages.current = 1;
      await refresh(false, true);
    }
    catch (cause) { setError(cause); }
    finally { selectingVault.current = false; setSwitchingVault(false); setWorking(false); }
  }

  const activateVault = useCallback(async (vaultId: string) => {
    if (selectingVault.current || vaultId === status?.vaultId || ((editingRef.current || editorHash.current) && !(await leaveEditor()))) return;
    selectingVault.current = true;
    setSwitchingVault(true); setWorking(true); setError("");
    generation.current++; editorGeneration.current++;
    try {
      const result = await request<SelectVaultResult>("activateVault", { vaultId });
      if ("reconnectUrl" in result) { reconnectVault(result.reconnectUrl); return; }
      setQuery(""); setDebouncedQuery(""); setTag(null); setQuickFilter(null); setFilterCounts(undefined);
      loadedListKey.current = null;
      loadedPages.current = 1;
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

  const showEditor = useCallback((draft: Draft, note?: Note) => {
    editorGeneration.current++;
    if (openingLink.current && openingLink.current !== draft.id) setPendingOpenNote(openingLink.current);
    openingLink.current = null;
    if (!editingRef.current && !editorHash.current) { returnScroll.current = scrollContainer.current?.scrollTop ?? 0; returnFocus.current = document.activeElement as HTMLElement; }
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = 0; });
    const hash = `#/notes/${draft.baseHash ? draft.id : 'new'}`;
    editorHash.current = hash;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setView('notes');
    editingRef.current = draft;
    setEditing({ ...draft, note });
    setPendingRoute(null);
    setWorking(false);
  }, []);

  const openNote = useCallback(async (id: string, fromLink = false, draft?: Draft) => {
    if (selectingVault.current) return;
    const wasDetail = Boolean(editingRef.current || editorHash.current);
    if (editingRef.current) {
      if (editingRef.current.id === id) return;
      if (!(await leaveEditor())) { if (fromLink) setPendingOpenNote(id); return; }
    }
    if (openingLink.current && openingLink.current !== id && !fromLink) setPendingOpenNote(openingLink.current);
    openingLink.current = fromLink ? id : null;
    const currentRequest = ++editorGeneration.current;
    if (!wasDetail) { returnScroll.current = scrollContainer.current?.scrollTop ?? 0; returnFocus.current = document.activeElement as HTMLElement; }
    const hash = `#/notes/${id}`;
    editorHash.current = hash; attemptedRoute.current = hash;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setPendingRoute(hash); setView('notes'); setMenuOpen(false);
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = 0; });
    const candidates = drafts.filter(item => item.id === id && !item.unscoped);
    const pending = draft ?? (candidates.length === 1 ? candidates[0] : undefined);
    void loadEditor().catch(() => undefined);
    setWorking(true); setError("");
    try {
      const prefetched = routeNoteRequest.current;
      routeNoteRequest.current = null;
      const current = await (prefetched?.id === id && prefetched.generation === generation.current ? prefetched.promise : request<Note & { vaultBinding?: string }>("getNote", { id }));
      if (currentRequest !== editorGeneration.current) return;
      showEditor({ ...(pending ? { ...pending, updatedAt: pending.updatedAt ?? new Date().toISOString() } : { id: current.id, ...(current.title === undefined ? {} : { title: current.title }), body: current.body, tags: current.tags, baseHash: current.contentHash }), relativePath: current.relativePath, ...(isBrowserVault ? { vaultBinding: pending?.vaultBinding ?? current.vaultBinding ?? environment?.vaultBinding } : {}) }, current);
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
    setPendingRoute(null);
    editorHash.current = '';
    attemptedRoute.current = '';
    window.history.replaceState(null, '', '#/notes');
    setView('notes');
    restoreListPosition();
    if (quickFilter) loadedPages.current = 1;
    void refresh(true);
    if (pendingOpenNote) {
      const id = pendingOpenNote;
      setPendingOpenNote(null);
      void openNote(id, true);
    }
  }

  async function loadMore() {
    if (!cursor || paging || refreshCount.current > 0) return;
    loadingMore.current = true;
    setPaging(true);
    const current = generation.current;
    try {
      const page = await request<NotePage>("queryNotes", { query: debouncedQuery, tags: tag ? [tag] : [], ...(quickFilter ? { quickFilter } : {}), limit: 30, cursor });
      if (generation.current !== current) return;
      setNotes((previous) => [...previous, ...page.notes.filter((note) => !previous.some((item) => item.id === note.id))]); setCursor(page.nextCursor);
      loadedPages.current++;
    } catch (cause) {
      if (generation.current === current) {
        if (bridgeErrorCode(cause) === "STALE_CURSOR") {
          loadingMore.current = false;
          await refresh(true);
        } else setError(cause);
      }
    }
    finally {
      loadingMore.current = false; setPaging(false);
      if (pendingRefresh.current && generation.current === current) void refresh(true);
    }
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
    : status.indexing ? "正在整理笔记库"
    : status.coverage.issues > 0 ? `${status.coverage.issues} 个文件需处理`
    : status.coverage.pending > 0 ? `${status.coverage.pending} 个文件待读取`
    : !status.coverage.complete ? "部分文件待读取" : "已连接文件夹";
  const openingNote = !editing && pendingRoute !== null && (loading || Boolean(status?.connected));
  const detailView = Boolean(editing) || openingNote;
  const detailReadFailed = openingNote && Boolean(error) && !localWebReconnectRequired;
  const canRetryDetail = retryableError && bridgeErrorCode(error) !== "NOTE_NOT_FOUND";
  const openingTitle = pendingRoute ? notes.find(note => note.id === decodeURIComponent(pendingRoute.slice("#/notes/".length)))?.title?.trim() : undefined;
  const connectionState = !detailView && view === "notes" && !loading && notes.length === 0 && (localWebReconnectRequired || needsPermission || (Boolean(selectionNotice) && !status?.connected));
  const listTimeoutVisible = !detailView && view === "notes" && status?.connected && !localWebReconnectRequired && !needsPermission && listTimeout;
  const title = editing ? (editing.title?.trim() || "新内容") : openingNote ? openingTitle || (error ? "笔记" : "正在打开笔记") : view === "settings" ? "设置" : tag ? `# ${tag}` : quickFilter ? noteFilterLabels[quickFilter] : "所有笔记";
  const newNote = async () => {
    if (selectingVault.current || ((editingRef.current || editorHash.current) && !(await leaveEditor()))) return;
    setError('');
    editorGeneration.current++;
    if (openingLink.current) setPendingOpenNote(openingLink.current);
    openingLink.current = null;
    const id = createId();
    showEditor({ id, title: '', body: '', tags: [], ...(tag ? { inheritedTags: [tag] } : {}), baseHash: null, relativePath: `${folders.includes('') ? '' : 'notes/'}${id}.md`, ...(isBrowserVault ? { vaultBinding: environment?.vaultBinding } : {}) });
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = 0; });
  };

  const resumeDraft = async (draft: Draft) => {
    if (selectingVault.current || ((editingRef.current || editorHash.current) && !(await leaveEditor()))) return;
    setRecoveryOpen(false);
    if (draft.baseHash) void openNote(draft.id, false, draft);
    else showEditor({ ...draft, ...(isBrowserVault ? { vaultBinding: draft.vaultBinding ?? environment?.vaultBinding } : {}) });
  };

  const refreshDrafts = async () => {
    if (reminderWorking || selectingVault.current) return;
    const current = generation.current;
    setReminderWorking(true);
    try {
      const recovered = await request<DraftList>("getDrafts");
      if (current !== generation.current) return;
      setDrafts([...recovered.drafts,...recovered.unscopedDrafts ?? []].filter(draft => draft.baseHash || draft.title?.trim() || draft.body.trim() || draft.pendingProperties?.length));
      setDraftIssues(recovered.issues ?? []); setRecoveryError(null);
    } catch (cause) { if (current === generation.current) setRecoveryError(cause); }
    finally { setReminderWorking(false); }
  };

  const dismissDraftReminder = async (draft: Draft) => {
    if (reminderWorking || !draft.draftKey || !draft.revision) return;
    const current = generation.current;
    setReminderWorking(true); setRecoveryError(null);
    try {
      await request("dismissDraftReminder", {id: draft.id, draftKey: draft.draftKey, revision: draft.revision, unscoped: draft.unscoped, ...(draft.recoveryScope ? {scope: draft.recoveryScope} : {})});
      if (current === generation.current) setDrafts(items => items.map(item => item.draftKey === draft.draftKey && item.revision === draft.revision && item.unscoped === draft.unscoped && item.recoveryScope === draft.recoveryScope ? {...item, reminderDismissed: true} : item));
    } catch (cause) { if (current === generation.current) setRecoveryError(cause); }
    finally { setReminderWorking(false); }
  };

  const navigate = async (nextView: View, nextTag: string | null = null, nextFilter: NoteQuickFilter | null = null) => {
    const returningFromDetail = Boolean(editorHash.current);
    if (!(await leaveEditor())) return;
    openingLink.current = null;
    setError('');
    setView(nextView);
    if (nextView === "notes") {
      if (nextTag !== tag || nextFilter !== quickFilter) {
        generation.current++; loadedPages.current = 1;
        loadedListKey.current = null; setListTimeout(null);
        setNotes([]); setCursor(null); setLoading(true);
      }
      setTag(nextTag); setQuickFilter(nextFilter);
    }
    window.location.hash = `#/${nextView}`;
    setMenuOpen(false);
    if (returningFromDetail && nextView === 'notes') restoreListPosition();
  };

  const searchNotes = async () => {
    if (editingRef.current && !(await leaveEditor())) return;
    void navigate("notes", tag, quickFilter);
    setSearchOpen(true);
  };

  useEffect(() => {
    routeHandler.current = () => {
      const requested = window.location.hash || '#/notes';
      if (requested === editorHash.current || routeLoading.current === requested) return;
      routeLoading.current = requested;
      attemptedRoute.current = requested;
      setPendingRoute(/^#\/notes\/[^/]+$/.test(requested) ? requested : null);
      void (async () => {
        if (!(await leaveEditor())) { setPendingRoute(null); window.history.replaceState(null, '', editorHash.current); return; }
        openingLink.current = null;
        window.history.replaceState(null, '', requested);
        const match = /^#\/notes\/([^/]+)$/.exec(requested);
        if (match && status?.connected) {
          if (match[1] === 'new') await newNote();
          else await openNote(decodeURIComponent(match[1]));
        } else { setView(getView()); setMenuOpen(false); if (requested === '#/notes') restoreListPosition(); }
      })().finally(() => { routeLoading.current = ''; });
    };
    if (!editingRef.current && routeReady && status?.connected && attemptedRoute.current !== window.location.hash && /^#\/notes\//.test(window.location.hash)) routeHandler.current();
  });

  const navigation = <AppSidebar
    view={view} tag={tag} quickFilter={quickFilter} filterCounts={filterCounts} tags={tags} onRenameTag={async (from, to) => {
      if (!status?.vaultId || !canCreate || editing) throw new Error("请先完成当前编辑并连接笔记库。");
      try {
        await (await import("./rename-tag-operation")).renameTag(from, to, status.vaultId, request);
        if (tag) setTag(renamedTag(tag, from, to));
      } finally { await refresh(); }
    }}
    connected={Boolean(status?.connected)}
    vaultId={status?.vaultId} vaultName={status?.vaultName || "记忆卡"} registeredVaults={registeredVaults} vaultStatusText={vaultStatusText}
    hasVaultIssue={Boolean(error || needsPermission || (status?.connected && !status.indexing && !status.coverage.complete))}
    canCreate={canCreate} canChooseVault={chooseAllowed} canCreateVault={createAllowed}
    needsPermission={needsPermission} working={switchingVault}
    onNavigate={navigate} onNewNote={() => { newNote(); setMenuOpen(false); }}
    onSearch={searchNotes} onSelectVault={(create) => void selectVault(create)}
    onActivateVault={(vaultId) => void activateVault(vaultId)}
    onReauthorize={() => void reauthorizeVault()}
  />;

  return <TagColorProvider vaultId={status?.vaultId}><SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} openMobile={menuOpen} onOpenMobileChange={setMenuOpen} className="h-dvh min-h-0 overflow-hidden bg-background pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] text-foreground">
    {navigation}
    <SidebarInset className="min-w-0 min-h-0">
      <header className="flex h-14 shrink-0 items-center gap-2 bg-background">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-3 text-sm">
          {detailView && <Button variant="ghost" size="icon" className={cn("shrink-0", editing && "md:hidden")} onClick={() => openingNote ? void navigate('notes', tag, quickFilter) : void editorHandle.current?.finish()} aria-label="返回笔记列表"><ArrowLeft className="size-4" /></Button>}
          <SidebarTrigger className={`shrink-0 ${editing ? "hidden md:inline-flex" : ""}`} />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb aria-label="当前位置" className="min-w-0"><BreadcrumbList><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="line-clamp-1">{title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 px-3">
          {!isConnectedClient && <span className="hidden text-xs text-muted-foreground sm:inline">浏览器预览</span>}
          <NavActions canCreate={canCreate} canRefresh={isConnectedClient && !loading && !working} refreshing={loading} onNewNote={newNote} onRefresh={() => void refresh()} onSettings={() => navigate("settings")} />
        </div>
      </header>
      <div ref={scrollContainer} className={cn("min-h-0 flex-1 overflow-y-auto", detailView ? "note-page-scroll" : view === "notes" ? "px-4 md:px-[104px]" : "px-4 md:px-16")}>
        <div className={cn("page-content mx-auto w-full space-y-4", detailView ? "note-page-width" : view === "notes" ? "max-w-none py-6 md:py-8" : "max-w-3xl py-6 md:py-8")}>
          {switchingVault && <Alert role="status"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /><AlertTitle>正在打开笔记库</AlertTitle><AlertDescription>请选择文件夹并允许访问，首次读取可能需要一些时间。</AlertDescription></Alert>}
          {selectionNotice && !switchingVault && !connectionState && <Alert role="status"><Info className="size-4" /><AlertTitle>文件夹授权未完成</AlertTitle><AlertDescription><p>笔记库未切换，请重新选择并允许访问文件夹。</p><details className="w-full"><summary className="w-fit cursor-pointer">查看详情</summary><p className="mt-2 break-words">{selectionNotice}</p></details><div className="mt-2 flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => void selectVault(false)} disabled={working}>重新选择</Button></div></AlertDescription></Alert>}
          {needsPermission && !connectionState && <Alert><FolderOpen className="size-4" /><AlertTitle>重新授权笔记文件夹</AlertTitle><AlertDescription className="flex flex-col items-start gap-3"><p>文件夹访问权限已失效，请重新授权以读取和保存。</p><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => void reauthorizeVault()} disabled={working}>重新授权</Button></div></AlertDescription></Alert>}
          {Boolean(error) && !detailReadFailed && !(connectionState && localWebReconnectRequired) && <PageNotice title={localWebReconnectRequired ? "连接已断开" : openingNote ? "无法打开笔记" : "操作未完成"} actions={<>{localWebReconnectRequired ? <Button render={<a href="memocard-service://open-web">重新打开</a>} variant="outline" size="sm" /> : retryableError && <Button variant="outline" size="sm" onClick={() => { if (openingNote && pendingRoute) void openNote(decodeURIComponent(pendingRoute.slice('#/notes/'.length))); else void refresh(); }} disabled={!isConnectedClient || loading || switchingVault}>重试</Button>}{openingNote && <Button variant="outline" size="sm" onClick={() => void navigate("notes", tag, quickFilter)}>返回列表</Button>}</>}>{errorMessage(error)}</PageNotice>}
          {status?.indexing && <Alert role="status"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /><AlertTitle>{status.indexing.phase === "reading" ? "正在读取笔记库" : "正在建立索引"}</AlertTitle><AlertDescription>{status.indexing.total === null ? `已读取 ${status.indexing.processed} 篇笔记。` : `已整理 ${status.indexing.processed} / ${status.indexing.total} 篇笔记。`}{status.indexing.phase === "reading" ? "正在后台读取，可继续使用已加载的笔记。" : "正在后台整理，可继续使用已加载的笔记。"}草稿先保存在本机，校验后写入文件。搜索和筛选会逐步补齐。</AlertDescription></Alert>}
          {status?.connected && !status.indexing && !status.coverage.complete && <Alert role="status"><Info className="size-4" /><AlertTitle>部分文件暂时无法读取</AlertTitle><AlertDescription className="gap-3">
            <p>{status.coverage.pending > 0 ? `还有 ${status.coverage.pending} 个文件未读入。` : "部分文件尚未进入索引。"}列表和搜索结果可能不完整，已加载的笔记可以继续编辑。请确认文件可正常打开后重新读取。</p>
            <div className="flex flex-wrap items-center gap-2 text-foreground">
              <Button variant="outline" size="sm" disabled={refreshingPages || switchingVault || paging} onClick={async () => {
                setRereading(true); setError("");
                try { await refresh(true); } finally { setRereading(false); }
              }}>{rereading && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}重新读取</Button>
              <Button variant="outline" size="sm" aria-expanded={readDetailsOpen} aria-controls="read-coverage-details" onClick={() => setReadDetailsOpen(open => !open)}>查看详情</Button>
            </div>
            {readDetailsOpen && <div id="read-coverage-details" className="w-full space-y-2 border-t pt-3">
              <dl><StatusRow label="已读入笔记" value={status.coverage.indexed} /><StatusRow label="待读取文件" value={status.coverage.pending} /><StatusRow label="需要处理的文件" value={status.coverage.issues} /></dl>
              <p>当前未提供具体文件和失败原因。</p>
              <p>请确认笔记文件夹可访问、文件能在系统中正常打开，再点击“重新读取”。若仍未恢复，请检查文件内容和访问权限。</p>
            </div>}
          </AlertDescription></Alert>}

          {draftIssues.length > 0 && <Alert role="status"><Info className="size-4" /><AlertTitle>部分草稿无法读取</AlertTitle><AlertDescription><p>原记录已保留，其他草稿仍可恢复。</p><details className="w-full"><summary className="w-fit cursor-pointer">查看详情</summary><div className="mt-2 space-y-2">{draftIssues.map((issue,index) => <div key={`${issue.path ?? issue.code}:${index}`}><p>{issue.message}</p>{issue.path && <p className="break-all select-text text-xs">{issue.path}</p>}</div>)}</div></details></AlertDescription></Alert>}

            {!detailView && view === "notes" && status?.connected && recoveryChoices.length > 0 && !recoveryDismissed && <Alert>
              <CircleAlert className="size-4" /><AlertTitle>发现 {recoveryChoices.length} 条{recoveryChoices.some(draft => draft.unscoped) ? "历史草稿" : "未保存内容"}</AlertTitle>
              <AlertDescription>可继续编辑，稍后处理不会删除草稿。
                <div className="mt-2 flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => { if (recoveryChoices.length === 1 && !recoveryChoices[0].unscoped) void resumeDraft(recoveryChoices[0]); else setRecoveryOpen(true); }}>{recoveryChoices.some(draft => draft.unscoped) ? "查看草稿" : "恢复内容"}</Button><Button variant="outline" size="sm" onClick={() => setRecoveryDismissed(true)}>稍后处理</Button></div>
              </AlertDescription>
            </Alert>}

          {listTimeoutVisible === "refresh" && <PageNotice title="刷新超时" actions={<Button variant="outline" size="sm" disabled={refreshingPages || switchingVault} onClick={() => void refresh(true)}>重试</Button>}>当前显示上次读取的内容。</PageNotice>}
          <div className={detailView || view === "settings" ? "sr-only" : "min-w-0 px-2 pb-2"}>
            <h1 className="truncate text-[32px] font-bold leading-[1.2] tracking-tight">{title}</h1>
          </div>
          {openingNote ? (detailReadFailed ? <EmptyState compact role="alert" icon="connection" title={bridgeErrorCode(error) === "NOTE_NOT_FOUND" ? "笔记不存在" : "无法打开笔记"} description={errorMessage(error)}>
            <div className="flex flex-wrap justify-center gap-2">
              {canRetryDetail && <Button disabled={loading || working || switchingVault} onClick={() => {
                // A retry must read the file again, including after a failed deep-link prefetch.
                routeNoteRequest.current = null;
                if (pendingRoute) void openNote(decodeURIComponent(pendingRoute.slice("#/notes/".length)));
              }}>重试</Button>}
              <Button variant={canRetryDetail ? "outline" : "default"} onClick={() => void navigate("notes", tag, quickFilter)}>返回列表</Button>
            </div>
          </EmptyState> : error ? null : <LoadingNote />) : editing ? <Suspense fallback={<LoadingNote />}><Editor key={editing.id} initial={editing} initialNote={editing.note} onTagsChanged={() => { void refresh(true); }} handle={editorHandle} capabilities={capabilities} pendingLink={Boolean(pendingOpenNote)} onClose={finishEditing} onSaved={finishEditing} onTitleChange={title => setEditing(current => current?.id === editing.id && current.title !== title ? { ...current, title } : current)} onCommitted={(note) => {
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
                  <CollapsibleTrigger render={<Button variant="ghost" className="group h-14 w-full justify-between px-0 has-[>svg]:px-0"><span>文件状态</span><ChevronDown aria-hidden="true" className="size-4 text-muted-foreground group-data-[panel-open]:rotate-180" /></Button>} />
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
              <div className="flex items-start justify-between gap-4"><div className="space-y-1"><p className="text-sm font-medium"><label htmlFor="mcp-enabled">允许本机工具读取</label></p><p className="text-pretty text-sm leading-6 text-muted-foreground">{environment.mcpEnabled ? "已开启，只允许本机工具读取。" : "允许本机工具搜索和读取笔记。"}</p></div><Suspense fallback={<Skeleton className="h-5 w-8" />}><Switch id="mcp-enabled" checked={environment.mcpEnabled} onCheckedChange={() => void toggleMCP()} disabled={!status?.connected || working} aria-label="MCP 本机读取" /></Suspense></div>
              <p className="text-pretty text-sm leading-6 text-muted-foreground">开启时选择连接配置的保存位置。读取期间请保持记忆卡运行，工具不会修改你的笔记。</p>{working && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />正在更新连接…</p>}
            </CardContent></Card></section>}
          </div> : <>
            {status?.connected && recoveryRecords.length > 0 && (recoveryDismissed || recoveryChoices.length === 0) && <Button variant="ghost" size="sm" onClick={() => setRecoveryOpen(true)}>保留草稿（{recoveryRecords.length}）</Button>}
            <Dialog open={recoveryOpen} onOpenChange={open => { setRecoveryOpen(open); setRecoveryError(null); }}><DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto sm:max-w-md"><div className="pr-6"><DialogTitle className="text-balance">草稿</DialogTitle><DialogDescription className="sr-only">可继续编辑保留的草稿。不再提醒不会删除草稿。历史草稿请先确认所属笔记库。</DialogDescription></div>
              {recoveryError != null && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{errorMessage(recoveryError)}</p><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={reminderWorking} onClick={() => void refreshDrafts()}>刷新草稿</Button></div></div>}
              <div className="max-h-64 space-y-3 overflow-auto sm:max-h-80">{recoveryRecords.map(draft => <article className="space-y-3 rounded-lg border p-3" key={`${draft.recoveryScope ?? (draft.unscoped ? 'legacy' : 'current')}:${draft.draftKey ?? draft.id}`}>
                <div className="space-y-1.5"><p className="line-clamp-2 text-pretty text-sm font-medium leading-6">{draft.title || draft.body.slice(0, 100) || "空正文"}</p>
                  {draft.title && draft.body && <p className="line-clamp-2 text-pretty text-sm leading-6 text-muted-foreground">{draft.body.slice(0,100)}</p>}
                  {(draft.updatedAt || draft.unscoped) && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {draft.updatedAt && <time className="tabular-nums" dateTime={draft.updatedAt}>{new Date(draft.updatedAt).toLocaleString('zh-CN', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</time>}
                    {draft.unscoped && <span>所属库待确认</span>}
                  </div>}
                  {draft.pendingProperties?.length ? <p className="text-pretty text-xs text-muted-foreground">{draft.pendingProperties.map(change => `${change.name}：${change.value === undefined ? '属性更改' : Array.isArray(change.value) ? change.value.join('、') : String(change.value)}`).join('；')}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" aria-label={`继续编辑：${draft.title || draft.body.slice(0,100) || '空正文'}`} onClick={() => void resumeDraft(draft)}>继续编辑</Button>
                  {draft.reminderDismissed ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-3.5" aria-hidden="true" />已关闭提醒</span> : draft.unscoped && draft.draftKey && draft.revision && capabilities.has("dismissDraftReminder") && <Button variant="outline" size="sm" disabled={reminderWorking} onClick={() => void dismissDraftReminder(draft)}>不再提醒</Button>}
                </div>
              </article>)}</div>
            </DialogContent></Dialog>

            {connectionState ? <EmptyState compact icon={localWebReconnectRequired ? "connection" : "folder"}
              title={localWebReconnectRequired ? bridgeErrorCode(error) === "WEB_UNAUTHORIZED" ? "访问授权已失效" : "本机服务未连接" : needsPermission ? "需要文件夹访问权限" : "文件夹授权未完成"}
              description={localWebReconnectRequired ? bridgeErrorCode(error) === "WEB_UNAUTHORIZED" ? "从 MemoCard 重新打开此页面以恢复访问。" : "重新打开 MemoCard，继续读取和保存笔记。" : needsPermission ? "重新授权后，即可读取和保存笔记。" : "重新选择笔记文件夹，并允许访问。"}>
              {selectionNotice && !localWebReconnectRequired && !needsPermission && <details className="mb-3 max-w-sm text-sm text-muted-foreground"><summary className="mx-auto w-fit cursor-pointer">查看详情</summary><p className="mt-2 break-words text-pretty">{selectionNotice}</p></details>}
              <div className="flex flex-wrap justify-center gap-2">{localWebReconnectRequired ? <Button render={<a href="memocard-service://open-web">重新打开</a>} /> : <Button onClick={() => needsPermission ? void reauthorizeVault() : void selectVault(false)} disabled={working || switchingVault}>{needsPermission ? "重新授权" : "重新选择"}</Button>}</div>
            </EmptyState> : listTimeoutVisible === "initial" ? <EmptyState compact role="alert" icon="connection" title="笔记加载超时" description="暂时无法读取笔记列表，请重试。"><Button disabled={refreshingPages || switchingVault} onClick={() => void refresh()}>重试</Button></EmptyState> : loading && notes.length === 0 ? <LoadingNotes /> : !status?.connected && notes.length === 0 ? !localWebReconnectRequired && !needsPermission && !selectionNotice && <Card className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:py-16">
                <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"><FolderOpen className="size-6" strokeWidth={1.5} /></span>
                <h2 className="text-lg font-semibold">{unsupportedBrowser ? "需要启动 MemoCard 本机服务" : isBrowserVault ? "打开你的笔记文件夹" : "连接你的笔记文件夹"}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{unsupportedBrowser ? "此浏览器无法直接读写文件夹。请从 MemoCard 菜单栏打开，或运行 memocard serve。" : isBrowserVault ? "选择这台电脑上的 Obsidian / Markdown 笔记文件夹，或在空文件夹中创建一个。笔记与图片直接保存在文件夹里。" : isLocalWeb ? "使用本机文件夹选择器打开已有笔记库，或在空文件夹中创建一个。" : "选择 iCloud Drive 中的笔记库，在 Mac 和 iPhone 上继续记录。首次使用可在 Mac 上创建。"}</p>
                {!unsupportedBrowser && <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {createAllowed && <Button onClick={() => void selectVault(true)} disabled={working || Boolean(editing)}>{working ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus className="size-4" />}创建笔记库</Button>}
                  <Button variant={createAllowed ? "outline" : "default"} onClick={() => void selectVault(false)} disabled={!chooseAllowed || working || Boolean(editing)}><FolderOpen className="size-4" />{isBrowserVault ? "打开已有笔记库" : "选择已有文件夹"}</Button>
                </div>}
                <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />{isBrowserVault || isNative ? "只访问你授权的文件夹" : "只访问你通过 MemoCard 本机宿主授权的文件夹"}</p>
              </CardContent>
            </Card> : <Suspense fallback={<LoadingNotes />}><NoteCollection notes={notes} query={query} onQueryChange={setQuery} searchPlaceholder={tag ? "搜索当前标签内容" : "搜索笔记内容"} searchDisabled={switchingVault || !status?.connected || (isLocalWeb && !webConnected) || !capabilities.has("queryNotes")} canCreate={canCreate} onNewNote={() => void newNote()} hasMore={Boolean(cursor)} paging={paging} loadMoreDisabled={paging || switchingVault || refreshingPages || localWebReconnectRequired || needsPermission} canOpen={!working && Boolean(status?.connected) && (!isLocalWeb || webConnected) && capabilities.has("getNote")} onOpen={id => void openNote(id)} onSelectTag={name => navigate("notes", name)} onLoadMore={() => void loadMore()} onError={setError} formatDate={formatDate}>{loading && notes.length === 0 ? <LoadingNotes /> : error ? null : <EmptyState icon={query || tag || quickFilter ? "search" : "note"} title={status?.indexing ? "笔记正在陆续载入" : query || tag ? "没有找到相关笔记" : quickFilter ? noteFilterEmptyTitles[quickFilter] : "记下第一条笔记"} description={status?.indexing ? "已读取的笔记可以打开，也可以新建笔记继续记录。" : query || tag ? "换一个关键词，或清除筛选。" : quickFilter === "images" ? "在笔记中插入图片后，会自动出现在这里。" : quickFilter === "links" ? "在笔记中添加网页或笔记链接后，会自动出现在这里。" : quickFilter === "untagged" ? "当前笔记都已有标签，新的无标签笔记会出现在这里。" : "一句想法、一段发现，不必想好标题。"}>{quickFilter ? <Button variant="outline" onClick={() => { setQuery(""); setDebouncedQuery(""); void navigate("notes"); }}>查看所有笔记</Button> : !query && !tag && <Button disabled={!canCreate} onClick={newNote}><Plus className="size-4" />新建笔记</Button>}</EmptyState>}</NoteCollection></Suspense>}
          </>}
          </>}
        </div>
      </div>
    </SidebarInset>
    {notice && <div role="status" className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground"><Check className="size-4" />{notice}</div>}
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent initialFocus={searchField}><DialogTitle>搜索笔记</DialogTitle><DialogDescription>输入关键词筛选笔记，关闭后查看结果。</DialogDescription>
      <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={searchField} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索笔记内容" aria-label="搜索笔记" disabled={!status?.connected || switchingVault} className="h-9 bg-background pl-9 pr-10 shadow-none" />{query && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" onClick={() => setQuery("")} aria-label="清空搜索"><X className="size-3.5" /></Button>}</div>
      <Button onClick={() => setSearchOpen(false)}>查看结果</Button>
    </DialogContent></Dialog>

  </SidebarProvider></TagColorProvider>;
}

function StatusRow({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right tabular-nums">{value}</dd></div>;
}

function LoadingNotes() {
  return <div role="status" aria-label="正在读取笔记库" className="space-y-3"><span className="sr-only">正在读取笔记库…</span>{[0, 1, 2].map((item) => <Card key={item} className="rounded-xl border-0 bg-muted/50 shadow-none"><CardContent className="space-y-4"><Skeleton className="h-3 w-28" /><div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div><Skeleton className="h-5 w-16" /></CardContent></Card>)}</div>;
}

function LoadingNote() {
  return <div role="status" aria-label="正在打开笔记" className="space-y-6"><span className="sr-only">正在打开笔记…</span><Skeleton className="h-9 w-3/4" /><Skeleton className="h-5 w-20" /><Separator /><div className="space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div></div>;
}

function EmptyState({ icon, title, description, children, compact = false, role }: { icon: "note" | "search" | "folder" | "connection"; title: string; description: string; children?: React.ReactNode; compact?: boolean; role?: "alert" | "status" }) {
  const Icon = icon === "search" ? Search : icon === "folder" ? FolderOpen : icon === "connection" ? CircleAlert : Layers2;
  return <Card role={role ?? (compact ? "status" : undefined)} className="gap-0 rounded-xl border-0 bg-muted/50 py-0 shadow-none"><CardContent className={cn("flex flex-col items-center px-6 text-center", compact ? "py-10" : "py-14")}><span className={cn("flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground", compact ? "mb-4" : "mb-5")}><Icon className="size-6" strokeWidth={1.5} /></span><h2 className="text-balance text-lg font-semibold">{title}</h2><p className="mt-2 max-w-sm text-pretty text-sm leading-6 text-muted-foreground">{description}</p>{children && <div className={compact ? "mt-4" : "mt-6"}>{children}</div>}</CardContent></Card>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
