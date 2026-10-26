import { connectSharedTagPreferences } from './shared-tag-preferences';
import { TagColorProvider } from './TagColorProvider';
import { noteFilterLabels } from "./note-filter-labels";
import { renamedTag } from "./rename-tag";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Note, NoteFilterCounts, NotePage, NotePins, NoteQuickFilter, VaultStatus } from "@memocard/contracts";
import { errorMessage, isBrowserVault, isConnectedClient, isLocalWeb, isNative, reconnectVault, request, type Draft, type DraftList, type DraftIssue, type Environment, type RegisteredVault, type SelectVaultResult } from "./bridge";
import type { EditorHandle, EditorProps } from "./editor-core";
import type { NoteDeleteProps, NoteDeleteTarget } from "./hooks/use-note-delete";
import type { QuickCaptureHandle, QuickCaptureMemory, QuickCaptureProps } from "./hooks/use-quick-capture";
import type { TrashPageProps } from "./hooks/use-trash";
import type { NoteSearchProps, NoteSearchSession } from "./use-note-search";
import type { AppSidebarProps } from "../ui-next/business/sidebar";
import type { NoteCollectionProps } from "../ui-next/business/NoteCollection";
import type { IOSAppChromeProps } from "../ui-next/native/IOSAppChrome";
import { preloadWebEditor, renderWebApp } from "../ui-next/web/WebAppView";
import { createId } from "./uuid";
import { subscribeToOpenNotes } from "./open-note";
import { useIsMobile } from "@/hooks/use-mobile";
import { isIOSNative } from "./ios-mode";

type View = "home" | "notes" | "settings" | "trash";
type TagCount = { name: string; count: number };
const getView = (): View => window.location.hash === "#/trash" ? "trash" : window.location.hash === "#/settings" ? "settings" : window.location.hash.startsWith("#/notes") ? "notes" : "home";
const bridgeErrorCode = (error: unknown): string | null => typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : null;
const bridgeErrorRetryable = (error: unknown): boolean | null => typeof error === "object" && error !== null && "retryable" in error && typeof error.retryable === "boolean" ? error.retryable : null;
// Web/H5 can replace the view while sharing the existing request, route and draft lifecycle.
export type AppViewState = {
  view: View; title: string; backLabel: string; isMobile: boolean; detailView: boolean; openingNote: boolean;
  loading: boolean; working: boolean; switchingVault: boolean; refreshingPages: boolean;
  status: VaultStatus | null; environment: Environment | null; capabilities: Set<string>;
  error: unknown; notice: string; selectionNotice: string; pinReadError: unknown;
  needsPermission: boolean; unsupportedBrowser: boolean; localWebReconnectRequired: boolean;
  connectionState: boolean; detailReadFailed: boolean; canRetryDetail: boolean;
  retryableError: boolean; canRefresh: boolean; pinRetryDisabled: boolean;
  readCoverage: { open: boolean; onOpenChange: (open: boolean) => void; rereading: boolean; onReread: () => Promise<void> };
  listTimeout: false | "initial" | "refresh" | null; canCreate: boolean;
  sidebarOpen: boolean; onSidebarOpenChange: (open: boolean) => void;
  menuOpen: boolean; onMenuOpenChange: (open: boolean) => void;
  scrollContainer: React.RefObject<HTMLDivElement | null>;
  sidebar: AppSidebarProps & { onRenameTag: (from: string, to: string) => Promise<void> };
  collection: NoteCollectionProps;
  editor: EditorProps | null;
  capture: QuickCaptureProps | null;
  search: NoteSearchProps;
  pinned: boolean; pinDisabled: boolean; canDeleteNote: boolean; searchMounted: boolean; onTogglePin: () => void;
  onNavigate: (view: View, tag?: string | null, filter?: NoteQuickFilter | null) => Promise<void>;
  onBack: () => void; onNew: () => Promise<void>; onSearch: () => void;
  onRefresh: () => void; onRefreshBackground: () => void; onRetryDetail: () => void;
  onToggleMCP: (enabled?: boolean) => Promise<void>; onOpenLocalWeb: () => Promise<void>;
  drafts: {
    open: boolean; onOpenChange: (open: boolean) => void; records: Draft[]; issues: DraftIssue[];
    busy: boolean; error: unknown; onRefresh: () => Promise<void>; onResume: (draft: Draft) => Promise<void>;
    onDismiss: (draft: Draft) => Promise<void>; onDelete: (draft: Draft) => void;
    deleteTarget: Draft | null; onConfirmDelete: () => Promise<void>; onCancelDelete: () => void;
    reminderVisible: boolean; onDismissReminder: () => void;
  };
  deletion: NoteDeleteProps | null;
  onRequestDelete: (() => void) | undefined;
  trash: TrashPageProps | null;
  nativeChrome?: IOSAppChromeProps;
};

export function App({ renderView = renderWebApp, preloadEditor = preloadWebEditor }: { renderView?: (state: AppViewState) => React.ReactNode; preloadEditor?: () => Promise<unknown> } = {}) {
  const isMobile = useIsMobile() || isIOSNative;
  const [view, setView] = useState<View>(getView);
  const [trashVersion,setTrashVersion] = useState(0);
  const returnView = useRef<View>(getView() === "settings" || getView() === "trash" ? "notes" : getView());
  const [homeTab, setHomeTab] = useState<"recent" | "pinned">("recent");
  const [captureOpened, setCaptureOpened] = useState(() => getView() === 'home');
  const [notePins, setNotePins] = useState<(NotePins & { vaultId: string }) | null>(null);
  const [pinReadError, setPinReadError] = useState<unknown>(null);
  const [pinWorking, setPinWorking] = useState(false);
  const pinEpoch = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const handleSidebarOpenChange = useCallback((open: boolean) => {
    const restoreToggleFocus = document.activeElement?.getAttribute("data-slot") === "sidebar-trigger";
    setSidebarOpen(open);
    if (restoreToggleFocus) requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(open ? '#desktop-sidebar [data-slot="sidebar-trigger"]' : 'main header [data-slot="sidebar-trigger"]')?.focus();
    });
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchSession = useRef<NoteSearchSession | null>(null);
  const searchReturnFocus = useRef<HTMLElement | null>(null);
  const searchPageScroll = useRef(0);
  const searchNoteReturn = useRef<string | null>(null);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const returnScroll = useRef(0);
  const refreshAnchor = useRef<{id: string; top: number} | null>(null);
  const editorHandle = useRef<EditorHandle | null>(null);
  const quickCaptureHandle = useRef<QuickCaptureHandle | null>(null);
  const quickCaptureMemory = useRef<QuickCaptureMemory | null>(null);
  const editorHash = useRef('');
  const routeHandler = useRef<() => void>(() => {});
  const routeLoading = useRef('');
  const attemptedRoute = useRef('');
  const [pendingRoute, setPendingRoute] = useState<string | null>(() => /^#\/notes\/[^/]+$/.test(window.location.hash) ? window.location.hash : null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<{draft:Draft; vaultId:string; vaultBinding?:string} | null>(null);
  const deletingDraft = useRef(false);
  const [noteToDelete, setNoteToDelete] = useState<NoteDeleteTarget | null>(null);
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
    window.history.replaceState(null, '', `#/${returnView.current}`);
    return true;
  }, []);
  const restoreListPosition = useCallback(() => {
    if (isMobile && searchNoteReturn.current && searchNoteReturn.current === status?.vaultId) {
      searchNoteReturn.current = null;
      setSearchOpen(true);
      return;
    }
    requestAnimationFrame(() => {
      const container = scrollContainer.current;
      if (container) container.scrollTop = returnScroll.current;
      const previous = returnFocus.current;
      const id = previous?.closest<HTMLElement>('[data-note-id]')?.dataset.noteId;
      const row = id && container ? Array.from(container.querySelectorAll<HTMLElement>('[data-note-id]')).find(item => item.dataset.noteId === id) : undefined;
      (previous?.isConnected ? previous : row?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    });
  }, [isMobile,status?.vaultId]);
  const capabilities = useMemo(() => new Set([...(status?.capabilities ?? []), ...(environment?.capabilities ?? [])]), [status, environment]);
  const sharedTagPreferencesEnabled = capabilities.has('getTagPreferences') && capabilities.has('setTagPreferences');
  useEffect(() => {
    if (status?.connected && status.vaultId && sharedTagPreferencesEnabled) return connectSharedTagPreferences(status.vaultId);
  }, [status?.connected, status?.vaultId, sharedTagPreferencesEnabled]);

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
      listKey = JSON.stringify([nextStatus.vaultId, resetFilters ? "" : debouncedQuery, resetFilters ? null : tag, resetFilters ? null : quickFilter, view, homeTab]);
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
          setNotes([]); setDrafts([]); setDraftIssues([]); setTags([]); setFolders([]); setFilterCounts(undefined); setNotePins(null);
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
        if (!allowed.has("queryNotes") || view === "trash") return null;
        for (let attempt = 0; ; attempt++) {
          try {
            let page: NotePage | null = null;
            let nextCursor: string | null = null;
            const refreshed: Note[] = [];
            for (let index = 0; index < pageCount; index++) {
              if (current !== generation.current) return null;
              page = await request<NotePage>("queryNotes", { query: resetFilters || view === "home" ? "" : debouncedQuery, tags: !resetFilters && view !== "home" && tag ? [tag] : [], ...(quickFilter && !resetFilters && view !== "home" ? { quickFilter } : {}), ...(view === "home" ? { sort: homeTab === "pinned" ? "pinnedAt" : "updatedAt", ...(homeTab === "pinned" ? { pinned: true } : {}) } : {}), limit: 30, ...(nextCursor ? {cursor: nextCursor} : {}) });
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
      const epoch = pinEpoch.current;
      const pinsResult = allowed.has("getNotePins") ? request<NotePins>("getNotePins").then(pins => {
        if (current === generation.current && epoch === pinEpoch.current && nextStatus.vaultId) { setNotePins({ ...pins, vaultId: nextStatus.vaultId }); setPinReadError(null); }
      }).catch(cause => { if (current === generation.current && epoch === pinEpoch.current) { setNotePins(null); setPinReadError(cause); } }) : Promise.resolve();
      const [page, tagResult, folderResult] = await Promise.all([
        readPages(),
        allowed.has("listTags") ? request<{ tags: TagCount[] }>("listTags") : Promise.resolve({ tags: [] }),
        allowed.has("listFolders") ? request<{ folders: string[] }>("listFolders") : Promise.resolve({ folders: [] }),
        registry, pinsResult,
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
  }, [debouncedQuery, tag, quickFilter, view, homeTab]);

  const invalidateRequests = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void refresh(); return invalidateRequests; }, [refresh, invalidateRequests]);
  useEffect(() => { if (/^#\/notes\/[^/]+$/.test(window.location.hash)) void preloadEditor().catch(() => undefined); }, [preloadEditor]);
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
    if (quickCaptureHandle.current?.isBusy()) return;
    if (selectingVault.current || ((editingRef.current || editorHash.current) && !(await leaveEditor()))) return;
    setSelectionNotice("");
    selectingVault.current = true; pinEpoch.current++;
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
      setQuery(""); setDebouncedQuery(""); setTag(null); setQuickFilter(null); setFilterCounts(undefined); setNotePins(null); setPinReadError(null);
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
    if (quickCaptureHandle.current?.isBusy()) return;
    if (selectingVault.current || vaultId === status?.vaultId || ((editingRef.current || editorHash.current) && !(await leaveEditor()))) return;
    selectingVault.current = true; pinEpoch.current++;
    setSwitchingVault(true); setWorking(true); setError("");
    generation.current++; editorGeneration.current++;
    try {
      const result = await request<SelectVaultResult>("activateVault", { vaultId });
      if ("reconnectUrl" in result) { reconnectVault(result.reconnectUrl); return; }
      setQuery(""); setDebouncedQuery(""); setTag(null); setQuickFilter(null); setFilterCounts(undefined); setNotePins(null); setPinReadError(null);
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
    if (!editingRef.current && !editorHash.current) { returnView.current = view === 'settings' || view === 'trash' ? 'notes' : view; returnScroll.current = scrollContainer.current?.scrollTop ?? 0; returnFocus.current = document.activeElement as HTMLElement; }
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = 0; });
    const hash = `#/notes/${draft.baseHash ? draft.id : 'new'}`;
    editorHash.current = hash;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setView(returnView.current);
    editingRef.current = draft;
    setEditing({ ...draft, note });
    setPendingRoute(null);
    setWorking(false);
  }, [view]);

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
    if (!wasDetail) { returnView.current = view === 'settings' || view === 'trash' ? 'notes' : view; returnScroll.current = scrollContainer.current?.scrollTop ?? 0; returnFocus.current = searchOpen ? searchReturnFocus.current : document.activeElement as HTMLElement; }
    const hash = `#/notes/${id}`;
    editorHash.current = hash; attemptedRoute.current = hash;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setPendingRoute(hash); setView(returnView.current); setMenuOpen(false);
    requestAnimationFrame(() => { if (scrollContainer.current) scrollContainer.current.scrollTop = 0; });
    const candidates = drafts.filter(item => item.id === id && !item.unscoped);
    const pending = draft ?? (candidates.length === 1 ? candidates[0] : undefined);
    void preloadEditor().catch(() => undefined);
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
  }, [drafts, showEditor, environment?.vaultBinding, leaveEditor, view, searchOpen, preloadEditor]);

  useEffect(() => () => { editorGeneration.current++; }, []);

  useEffect(() => {
    const unsubscribe = subscribeToOpenNotes(window, (id) => { setSearchOpen(false); void openNote(id, true); });
    if (isNative && !readySent.current) {
      readySent.current = true;
      void request("uiReady").catch((cause: unknown) => setError(cause));
    }
    return unsubscribe;
  }, [openNote]);

  function finishEditing(_saved?:Note, deleted = false) {
    editorGeneration.current++;
    editingRef.current = null;
    setEditing(null);
    setPendingRoute(null);
    editorHash.current = '';
    attemptedRoute.current = '';
    window.history.replaceState(null, '', `#/${returnView.current}`);
    setView(returnView.current);
    restoreListPosition();
    if (quickFilter) loadedPages.current = 1;
    void refresh(true);
    if (deleted) setPendingOpenNote(null);
    if (pendingOpenNote && !deleted) {
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
      const page = await request<NotePage>("queryNotes", { query: view === "home" ? "" : debouncedQuery, tags: view !== "home" && tag ? [tag] : [], ...(quickFilter && view !== "home" ? { quickFilter } : {}), ...(view === "home" ? { sort: homeTab === "pinned" ? "pinnedAt" : "updatedAt", ...(homeTab === "pinned" ? { pinned: true } : {}) } : {}), limit: 30, cursor });
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

  async function toggleMCP(enabled = !environment?.mcpWritesEnabled) {
    setWorking(true); setError("");
    try { await request("setMCPEnabled", { enabled }); await refresh(); }
    catch (cause) { setError(cause); }
    finally { setWorking(false); }
  }

  async function openLocalWeb() {
    setWorking(true); setError("");
    try { await request("openWeb"); }
    catch (cause) { setError(cause); }
    finally { setWorking(false); }
  }

  function changeHomeTab(tab: "recent" | "pinned") {
    if (tab === homeTab) return;
    generation.current++; loadedPages.current = 1; returnScroll.current = 0;
    loadedListKey.current = null; setListTimeout(null);
    setNotes([]); setCursor(null); setLoading(true); setError("");
    setHomeTab(tab);
    if (scrollContainer.current) scrollContainer.current.scrollTop = 0;
  }

  async function togglePinned() {
    if (!editing?.baseHash || !notePins || notePins.vaultId !== status?.vaultId || pinWorking || selectingVault.current) return;
    const id = editing.id, vaultId = notePins.vaultId, desired = !notePins.pins[id];
    const epoch = ++pinEpoch.current;
    setPinWorking(true); setPinReadError(null);
    try {
      let current: NotePins = notePins;
      for (let attempt = 0; ; attempt++) {
        try {
          const updated = await request<NotePins>("setNotePinned", { id, pinned: desired, baseHash: current.contentHash, vaultId, ...(isBrowserVault ? { vaultBinding: editing.vaultBinding ?? environment?.vaultBinding } : {}) });
          if (epoch === pinEpoch.current && loadedVaultId.current === vaultId && !selectingVault.current) {
            setNotePins({ ...updated, vaultId }); setNotice(desired ? "已固定到主页" : "已取消固定");
            if (refreshCount.current > 0) pendingRefresh.current = true; else void refresh(true);
          }
          break;
        } catch (cause) {
          if (bridgeErrorCode(cause) !== "HASH_CONFLICT" || attempt > 0 || epoch !== pinEpoch.current || selectingVault.current) throw cause;
          current = await request<NotePins>("getNotePins");
        }
      }
    } catch (cause) { if (epoch === pinEpoch.current) setPinReadError(cause); }
    finally { setPinWorking(false); }
  }

  const isNotePinned = Boolean(editing && notePins?.vaultId === status?.vaultId && notePins?.pins[editing.id]);
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
  const showMobileRecord = !detailView && (view === "home" || view === "notes");
  const detailReadFailed = openingNote && Boolean(error) && !localWebReconnectRequired;
  const canRetryDetail = retryableError && bridgeErrorCode(error) !== "NOTE_NOT_FOUND";
  const openingTitle = pendingRoute ? notes.find(note => note.id === decodeURIComponent(pendingRoute.slice("#/notes/".length)))?.title?.trim() : undefined;
  const connectionState = !detailView && view !== "settings" && !loading && notes.length === 0 && (localWebReconnectRequired || needsPermission || (Boolean(selectionNotice) && !status?.connected));
  const listTimeoutVisible = !detailView && view !== "settings" && status?.connected && !localWebReconnectRequired && !needsPermission && listTimeout;
  const title = editing ? (editing.title?.trim() || "新内容") : openingNote ? openingTitle || (error ? "笔记" : "正在打开笔记") : view === "settings" ? "设置" : view === "trash" ? "回收站" : view === "home" ? "主页" : tag ? `# ${tag}` : quickFilter ? noteFilterLabels[quickFilter] : "所有笔记";
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

  const deleteDraft = async () => {
    if (!draftToDelete || deletingDraft.current || reminderWorking || selectingVault.current) return;
    const {draft, vaultId, vaultBinding} = draftToDelete;
    const current = generation.current;
    deletingDraft.current = true; setReminderWorking(true); setRecoveryError(null);
    try {
      await request("deleteDraft", {id:draft.id, draftKey:draft.draftKey, revision:draft.revision, unscoped:draft.unscoped, ...(draft.recoveryScope ? {scope:draft.recoveryScope} : {}), vaultId, ...(vaultBinding ? {vaultBinding} : {})});
      if (current === generation.current) {
        setDrafts(items => items.filter(item => !(item.id === draft.id && item.draftKey === draft.draftKey && item.revision === draft.revision && item.unscoped === draft.unscoped && item.recoveryScope === draft.recoveryScope)));
        setNotice("草稿已删除");
      }
    } catch (cause) { if (current === generation.current) setRecoveryError(cause); }
    finally { deletingDraft.current = false; setReminderWorking(false); setDraftToDelete(null); }
  };

  const navigate = async (nextView: View, nextTag: string | null = null, nextFilter: NoteQuickFilter | null = null) => {
    const returningFromDetail = Boolean(editorHash.current);
    if (!(await leaveEditor())) return;
    if (nextView !== returnView.current) searchNoteReturn.current = null;
    openingLink.current = null;
    setError('');
    setView(nextView);
    if (nextView === 'home') setCaptureOpened(true);
    if (nextView !== "settings") {
      if (nextView !== view || nextTag !== tag || nextFilter !== quickFilter) {
        generation.current++; loadedPages.current = 1;
        loadedListKey.current = null; setListTimeout(null);
        setNotes([]); setCursor(null); setLoading(true);
      }
      setTag(nextTag); setQuickFilter(nextFilter);
      if (nextView === "home") { setQuery(""); setDebouncedQuery(""); }
    }
    window.location.hash = `#/${nextView}`;
    setMenuOpen(false);
    if (returningFromDetail && nextView === returnView.current) restoreListPosition();
  };

  const searchNotes = () => {
    searchReturnFocus.current = document.activeElement as HTMLElement;
    searchPageScroll.current = scrollContainer.current?.scrollTop ?? 0;
    searchNoteReturn.current = null;
    setMenuOpen(false);
    setSearchOpen(true);
  };
  const changeSearchOpen = (open: boolean) => {
    setSearchOpen(open);
    if (!open && isMobile) {
      searchNoteReturn.current = null;
      requestAnimationFrame(() => {
        if (scrollContainer.current) scrollContainer.current.scrollTop = searchPageScroll.current;
        const previous = searchReturnFocus.current;
        (previous?.isConnected ? previous : document.querySelector<HTMLElement>('main header button'))?.focus({preventScroll:true});
      });
    }
  };

  const searchAvailable = Boolean(status?.connected) && !switchingVault && (!isLocalWeb || webConnected) && capabilities.has("queryNotes") && capabilities.has("getNote");
  useEffect(() => {
    const onSearchKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.altKey && !event.shiftKey && !event.isComposing && searchAvailable) {
        event.preventDefault();
        if (!event.repeat && !searchOpen) searchNotes();
      }
    };
    window.addEventListener("keydown", onSearchKey);
    return () => window.removeEventListener("keydown", onSearchKey);
  }, [searchAvailable, searchOpen]);

  useEffect(() => {
    routeHandler.current = () => {
      const requested = window.location.hash || '#/home';
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
        } else {
          setView(getView()); setMenuOpen(false);
          if (getView() === 'home') { setCaptureOpened(true); setQuery(''); setDebouncedQuery(''); setTag(null); setQuickFilter(null); }
          if (requested === '#/notes' || requested === '#/home' || requested === '#/trash') restoreListPosition();
        }
      })().finally(() => { routeLoading.current = ''; });
    };
    if (!editingRef.current && routeReady && status?.connected && attemptedRoute.current !== window.location.hash && /^#\/notes\//.test(window.location.hash)) routeHandler.current();
  });

  const captureProps: QuickCaptureProps | null = (captureOpened || isMobile) && status?.vaultId && loadedVaultId.current === status.vaultId ? {
    handle: quickCaptureHandle, memory: quickCaptureMemory, vaultId: status.vaultId,
    vaultBinding: environment?.vaultBinding, rootNotes: folders.includes(''), tags: tags.map(tag => tag.name),
    disabled: !canCreate || (isMobile && working), canImage: capabilities.has('importAttachment') || capabilities.has('pickImage'),
    docked: isMobile, active: showMobileRecord,
    draftCount: status.connected && (recoveryDismissed || recoveryChoices.length === 0) ? recoveryRecords.length : 0,
    onOpenDrafts: () => setRecoveryOpen(true),
    onContinue: isMobile && capabilities.has('saveDraft') ? draft => { showEditor(draft); returnFocus.current = document.querySelector<HTMLElement>('.mobile-capture-entry'); } : undefined,
    onRecorded: () => {
      setNotice('已记录'); loadedPages.current = 1;
      if ((!isMobile || view === 'home') && homeTab !== 'recent') changeHomeTab('recent');
      else if (refreshCount.current > 0 || loadingMore.current) pendingRefresh.current = true;
      else void refresh(true);
    },
  } : null;
  async function renameNavigationTag(from: string, to: string) {
    if (!status?.vaultId || !canCreate || editing) throw new Error("请先完成当前编辑并连接笔记库。");
    try {
      await (await import("./rename-tag-operation")).renameTag(from, to, status.vaultId, request);
      if (tag) setTag(renamedTag(tag, from, to));
    } finally { await refresh(); }
  }
  const sidebarProps: AppViewState["sidebar"] = {
    view, tag, quickFilter, filterCounts, tags, loadingTags: loading && tags.length === 0, onRenameTag: renameNavigationTag,
    canTrash: capabilities.has("getTrash") && capabilities.has("restoreNote"), connected: Boolean(status?.connected),
    vaultId: status?.vaultId, vaultName: status?.vaultName || "记忆卡", registeredVaults, vaultStatusText,
    hasVaultIssue: Boolean(error || needsPermission || (status?.connected && !status.indexing && !status.coverage.complete)),
    canCreate, canChooseVault: chooseAllowed, canCreateVault: createAllowed, needsPermission, working: switchingVault,
    onNavigate: navigate, onNewNote: () => { void newNote(); setMenuOpen(false); }, onSearch: searchNotes,
    onSelectVault: create => void selectVault(create), onActivateVault: vaultId => void activateVault(vaultId),
    onReauthorize: () => void reauthorizeVault(),
  };
  const changeRecoveryOpen = (open:boolean) => {if(deletingDraft.current)return;setRecoveryOpen(open);setRecoveryError(null);if(!open)setDraftToDelete(null);};
  const refreshCurrentView = () => { if(view === "trash")setTrashVersion(value=>value+1);void refresh(); };
  const editorProps: EditorProps | null = editing ? {
    initial: editing, initialNote: editing.note, onTagsChanged: () => { void refresh(true); }, handle: editorHandle,
    capabilities, pendingLink: Boolean(pendingOpenNote), onClose: finishEditing, onSaved: finishEditing,
    onTitleChange: title => setEditing(current => current?.id === editing.id && current.title !== title ? { ...current, title } : current),
    onCommitted: note => {
      setNotes(current => current.map(item => item.id === note.id ? note : item));
      setEditing(current => current ? { ...current, id: note.id, baseHash: note.contentHash, note } : current);
      editorHash.current = `#/notes/${note.id}`;
      window.history.replaceState(null, '', editorHash.current);
      // Keep the session and undo history mounted after the first commit.
      if (editingRef.current) editingRef.current = { ...editingRef.current, id: note.id, baseHash: note.contentHash };
    },
  } : null;
  const collectionProps: NoteCollectionProps = {
    home: view === "home" ? { tab: homeTab, pinnedCount: notePins && notePins.vaultId === status?.vaultId ? Object.keys(notePins.pins).length : 0, onTabChange: changeHomeTab } : undefined,
    notes, loading: loading || (view !== "home" && query !== debouncedQuery), searching: view !== "home" && (query !== debouncedQuery || Boolean(query)),
    query, onQueryChange: setQuery, searchPlaceholder: tag ? "搜索当前标签内容" : "搜索笔记内容",
    searchDisabled: switchingVault || !status?.connected || (isLocalWeb && !webConnected) || !capabilities.has("queryNotes"),
    canCreate, onNewNote: () => void newNote(), hasMore: Boolean(cursor), paging,
    loadMoreDisabled: paging || switchingVault || refreshingPages || localWebReconnectRequired || needsPermission,
    canOpen: !working && Boolean(status?.connected) && (!isLocalWeb || webConnected) && capabilities.has("getNote"),
    onOpen: id => void openNote(id), onSelectTag: name => navigate("notes", name), onLoadMore: () => void loadMore(), onError: setError, formatDate,
  };
  const searchProps: NoteSearchProps = {
    open: searchOpen, preserveSession: isMobile, sessionRef: searchSession, onOpenChange: changeSearchOpen, vaultName: status?.vaultName || "笔记库",
    available: searchAvailable, returnFocus: searchReturnFocus,
    onOpenNote: id => { searchNoteReturn.current = isMobile ? status?.vaultId ?? null : null; setSearchOpen(false); void openNote(id); },
  };
  const deletionProps: NoteDeleteProps | null = noteToDelete ? {
    target: noteToDelete,
    prepareDelete: async () => loadedVaultId.current === noteToDelete.vaultId ? editorHandle.current?.prepareDelete() ?? null : null,
    onCancel: () => setNoteToDelete(null),
    onDeleted: () => {
      const target = noteToDelete; setNoteToDelete(null);
      if (editingRef.current?.id !== target.id || loadedVaultId.current !== target.vaultId) return;
      setNotes(items => items.filter(item => item.id !== target.id));
      searchSession.current?.removeNote(target.id);
      loadedPages.current = 1; setNotice("笔记已移入回收目录");
      if (refreshCount.current > 0 || loadingMore.current) pendingRefresh.current = true;
      finishEditing(undefined, true);
    },
  } : null;
  const onRequestDelete = editing?.baseHash && status?.vaultId && capabilities.has("deleteNote") ? () => setNoteToDelete({ id: editing.id, title, vaultId: status.vaultId!, vaultBinding: editing.vaultBinding ?? environment?.vaultBinding }) : undefined;
  return <TagColorProvider vaultId={status?.vaultId}>{renderView({
    view, title, backLabel: isMobile && searchNoteReturn.current ? "返回搜索结果" : returnView.current === "home" ? "返回主页" : "返回笔记列表", isMobile, detailView, openingNote, loading, working, switchingVault, refreshingPages,
    status, environment, capabilities, error, notice, selectionNotice, pinReadError, needsPermission, unsupportedBrowser,
    localWebReconnectRequired, connectionState, detailReadFailed, canRetryDetail,
    retryableError, canRefresh: isConnectedClient && !loading && !working,
    pinRetryDisabled: pinWorking || refreshingPages || switchingVault,
    readCoverage: { open: readDetailsOpen, onOpenChange: setReadDetailsOpen, rereading,
      onReread: async () => { setRereading(true); setError(""); try { await refresh(true); } finally { setRereading(false); } } },
    listTimeout: listTimeoutVisible || null, canCreate,
    sidebarOpen, onSidebarOpenChange: handleSidebarOpenChange, menuOpen, onMenuOpenChange: setMenuOpen, scrollContainer,
    sidebar: sidebarProps, collection: collectionProps, editor: editorProps, capture: captureProps, search: searchProps,
    pinned: isNotePinned, pinDisabled: !editing?.baseHash || !notePins || notePins.vaultId !== status?.vaultId || pinWorking || switchingVault || !status?.connected || (isLocalWeb && !webConnected),
    canDeleteNote: canCreate && !pinWorking && !working, searchMounted: Boolean(searchOpen || (isMobile && searchNoteReturn.current && searchNoteReturn.current === status?.vaultId)), onTogglePin: () => void togglePinned(),
    onNavigate: navigate, onBack: () => openingNote ? void navigate(returnView.current, tag, quickFilter) : void editorHandle.current?.finish(),
    onNew: newNote, onSearch: searchNotes, onRefresh: refreshCurrentView, onRefreshBackground: () => void refresh(true),
    onToggleMCP: toggleMCP, onOpenLocalWeb: openLocalWeb,
    onRetryDetail: () => { routeNoteRequest.current = null; if (pendingRoute) void openNote(decodeURIComponent(pendingRoute.slice("#/notes/".length))); },
    drafts: { open: recoveryOpen, onOpenChange: changeRecoveryOpen, records: recoveryRecords, issues: draftIssues, busy: reminderWorking,
      error: recoveryError, onRefresh: refreshDrafts, onResume: resumeDraft, onDismiss: dismissDraftReminder,
      onDelete: draft => { setRecoveryError(null); if (status?.vaultId) setDraftToDelete({draft, vaultId: status.vaultId, vaultBinding: draft.vaultBinding ?? environment?.vaultBinding}); },
      deleteTarget: draftToDelete?.draft ?? null, onConfirmDelete: deleteDraft, onCancelDelete: () => { if (!deletingDraft.current) setDraftToDelete(null); },
      reminderVisible: recoveryChoices.length > 0 && !recoveryDismissed, onDismissReminder: () => setRecoveryDismissed(true),
    },
    deletion: deletionProps, onRequestDelete,
    nativeChrome: isIOSNative ? {
      title, view, detail: detailView, tag, quickFilter, tags, filterCounts,
      hasVaultIssue: Boolean(error || needsPermission || (status?.connected && !status.indexing && !status.coverage.complete)),
      needsPermission, status, vaultBinding: environment?.vaultBinding, vaultStatus: vaultStatusText, vaults: registeredVaults,
      canCreate, canSearch: searchAvailable, loading, capabilities, editing,
      pinDisabled: !editing?.baseHash || !notePins || pinWorking || switchingVault, pinned: isNotePinned, pinWorking,
      showRecord: showMobileRecord, busy: working, error: error ? errorMessage(error) : "",
      recoveryOpen, recoveryBusy: reminderWorking, recoveryError: recoveryError ? errorMessage(recoveryError) : "",
      drafts: recoveryRecords, deleteDraftOpen: draftToDelete !== null,
      onReauthorize: reauthorizeVault, onNavigate: navigate, editor: editorHandle, openingNote, onSearch: searchNotes,
      onNew: newNote, onRefresh: refreshCurrentView, onPin: () => void togglePinned(), onDelete: setNoteToDelete,
      onChoose: () => selectVault(false), onActivate: activateVault, onRenameTag: renameNavigationTag,
      onRecoveryChange: changeRecoveryOpen, onRefreshDrafts: refreshDrafts, onResume: resumeDraft,
      onDismiss: dismissDraftReminder, onDeleteDraft: setDraftToDelete, onConfirmDeleteDraft: deleteDraft,
      onCancelDeleteDraft: () => { if (!deletingDraft.current) setDraftToDelete(null); },
    } : undefined,
    trash: status?.connected && capabilities.has("getTrash") && capabilities.has("restoreNote") ? {
      vaultId: status.vaultId ?? "", vaultBinding: environment?.vaultBinding, refreshVersion: trashVersion,
      canPermanentlyDelete: capabilities.has("permanentlyDeleteNote"), onRestored: () => { if (refreshCount.current > 0) pendingRefresh.current = true; else void refresh(true); },
    } : null,
  })}</TagColorProvider>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "时间未知" : new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
