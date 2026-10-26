import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type RefObject } from "react";
import type { NotePage } from "@memocard/contracts";
import { request, errorMessage } from "./bridge";

function dateGroup(value: string) {
  const date = new Date(value), today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - 7);
  return date >= today ? "今天" : date >= yesterday ? "昨天" : date >= week ? "过去 7 天" : "更早";
}

export type NoteSearchSession = { removeNote: (id: string) => void };
export type NoteSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  available: boolean;
  returnFocus: RefObject<HTMLElement | null>;
  onOpenNote: (id: string) => void;
  preserveSession?: boolean;
  sessionRef?: RefObject<NoteSearchSession | null>;
};

export function useNoteSearch({ open, available, preserveSession = false, sessionRef, isMobile }: Pick<NoteSearchProps, "open" | "available" | "preserveSession" | "sessionRef"> & { isMobile: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const resultScroll = useRef(0);
  const attachList = useCallback((node:HTMLDivElement | null) => {
    list.current = node;
    if (node && preserveSession) node.scrollTop = resultScroll.current;
  },[preserveSession]);
  const [mobileViewport,setMobileViewport] = useState<{bottom:number; maxHeight:number} | null>(null);
  useEffect(()=>{
    const viewport=window.visualViewport;
    if (!isMobile || !open || !viewport) return;
    const place=()=>setMobileViewport({bottom:Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop),maxHeight:viewport.height-16});
    place();viewport.addEventListener('resize',place);viewport.addEventListener('scroll',place);
    return ()=>{viewport.removeEventListener('resize',place);viewport.removeEventListener('scroll',place);};
  },[isMobile,open]);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [page, setPage] = useState<NotePage | null>(null);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mutation, setMutation] = useState(0);
  const epoch = useRef(0);
  const pagingLock = useRef(false);
  const loadedPages = useRef(1);
  const retainSession = useRef(false);
  const retainedRefreshFailed = useRef(false);
  const retainScroll = useRef(false);
  const searchQuery = query.trim();
  const searchActive = open || preserveSession;
  const notes = page?.notes ?? [];
  const active = notes[selected];
  const selection = useRef<{ id?: string; index: number }>({ index: 0 });
  useEffect(() => { selection.current = { id: active?.id, index: selected }; }, [active?.id, selected]);
  const groups = new Map<string, { note: NotePage["notes"][number]; index: number }[]>();
  notes.forEach((note, index) => {
    const label = dateGroup(note.updatedAt);
    const items = groups.get(label);
    if (items) items.push({ note, index });
    else groups.set(label, [{ note, index }]);
  });

  const removeNote = useCallback((id: string) => {
    const remaining = (page?.notes ?? []).filter(note => note.id !== id);
    const activeID = page?.notes[selected]?.id;
    const activeIndex = remaining.findIndex(note => note.id === activeID);
    const next = activeIndex >= 0 ? activeIndex : Math.max(0, Math.min(selected, remaining.length - 1));
    retainScroll.current = next !== selected;
    setSelected(next);
    setPage(previous => previous && ({ ...previous, notes: previous.notes.filter(note => note.id !== id) }));
    // Invalidate in-flight pages immediately, then obtain fresh cursors without
    // resetting the query, loaded extent or return position.
    epoch.current++;
    retainSession.current = true;
    setMutation(value => value + 1);
  }, [page, selected]);
  useImperativeHandle(sessionRef, () => ({ removeNote }), [removeNote]);

  useEffect(() => {
    const current = ++epoch.current;
    const retain = retainSession.current;
    retainSession.current = false;
    retainedRefreshFailed.current = false;
    const pageCount = retain ? loadedPages.current : 1;
    if (!retain) {
      setPage(null); setSelected(0); loadedPages.current = 1;
      resultScroll.current = 0;
      if (list.current) list.current.scrollTop = 0;
    }
    setError(""); setPreviewError(""); setLoading(!retain); setPaging(retain);
    pagingLock.current = retain;
    if (!searchActive || !available) { setLoading(false); setPaging(false); pagingLock.current = false; return; }
    const timer = setTimeout(() => {
      const read = async (attempt = 0): Promise<NotePage | null> => {
        try {
          const notes: NotePage["notes"] = [];
          let result: NotePage | null = null;
          let cursor: string | null = null;
          let pages = 0;
          for (let index = 0; index < pageCount; index++) {
            result = await request<NotePage>("queryNotes", { query: searchQuery, tags: [], sort: "updatedAt", limit: 30, ...(cursor ? { cursor } : {}) });
            if (epoch.current !== current) return null;
            notes.push(...result.notes);
            pages = index + 1;
            cursor = result.nextCursor;
            if (!cursor) break;
          }
          loadedPages.current = pages;
          return result && { ...result, notes };
        } catch (cause) {
          if (epoch.current !== current) return null;
          if ((cause as { code?: string })?.code === "STALE_CURSOR" && attempt < 2) return read(attempt + 1);
          throw cause;
        }
      };
      void read().then(result => {
        if (epoch.current === current && result) {
          if (retain) {
            const anchor = selection.current;
            const activeIndex = result.notes.findIndex(note => note.id === anchor.id);
            const next = activeIndex >= 0 ? activeIndex : Math.max(0, Math.min(anchor.index, result.notes.length - 1));
            retainScroll.current = next !== anchor.index;
            setSelected(next);
          }
          setPage(result);
        }
      }).catch(cause => {
        if (epoch.current === current) { retainedRefreshFailed.current = retain; setError(errorMessage(cause)); }
      }).finally(() => { if (epoch.current === current) { setLoading(false); setPaging(false); pagingLock.current = false; } });
    }, retain ? 0 : searchQuery ? 200 : 0);
    return () => { clearTimeout(timer); epoch.current += 1; };
  }, [searchActive, available, searchQuery, retry, mutation]);

  useEffect(() => {
    if (!retainScroll.current) list.current?.querySelector<HTMLElement>(`[data-result-index="${selected}"]`)?.scrollIntoView?.({ block: "nearest" });
    retainScroll.current = false;
    setPreviewError("");
  }, [selected]);

  async function loadMore() {
    if (!page?.nextCursor || pagingLock.current || loading || !available) return;
    const current = epoch.current;
    pagingLock.current = true; setPaging(true); setError("");
    try {
      const next = await request<NotePage>("queryNotes", { query: searchQuery, tags: [], sort: "updatedAt", limit: 30, cursor: page.nextCursor });
      if (epoch.current === current) {
        setPage(previous => previous && ({ ...next, notes: [...previous.notes, ...next.notes] }));
        loadedPages.current++;
      }
    } catch (cause) {
      if (epoch.current === current) {
        if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "STALE_CURSOR") setRetry(value => value + 1);
        else setError(errorMessage(cause));
      }
    }
    finally { if (epoch.current === current) { pagingLock.current = false; setPaging(false); } }
  }

  function moveSelection(direction: number) {
    if (!notes.length || loading) return;
    setSelected(index => Math.max(0, Math.min(notes.length - 1, index + direction)));
  }

  async function retrySearch() {
    if (retainedRefreshFailed.current) { retainSession.current = true; setRetry(value => value + 1); }
    else if (page?.nextCursor) await loadMore();
    else setRetry(value => value + 1);
  }

  return { input, list, resultScroll, attachList, mobileViewport, listId, query, setQuery, keyboardFocus, setKeyboardFocus, page, selected, setSelected, loading, paging, error, previewError, setPreviewError, searchQuery, notes, active, groups, loadMore, moveSelection, retrySearch };
}
