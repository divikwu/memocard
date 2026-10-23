import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import type { NotePage } from "@memocard/contracts";
import { request, errorMessage } from "./bridge";

function dateGroup(value: string) {
  const date = new Date(value), today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - 7);
  return date >= today ? "今天" : date >= yesterday ? "昨天" : date >= week ? "过去 7 天" : "更早";
}

export type NoteSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  available: boolean;
  returnFocus: RefObject<HTMLElement | null>;
  onOpenNote: (id: string) => void;
  preserveSession?: boolean;
};

export function useNoteSearch({ open, available, preserveSession = false, isMobile }: Pick<NoteSearchProps, "open" | "available" | "preserveSession"> & { isMobile: boolean }) {
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
  const epoch = useRef(0);
  const pagingLock = useRef(false);
  const searchQuery = query.trim();
  const searchActive = open || preserveSession;
  const notes = page?.notes ?? [];
  const active = notes[selected];
  const groups = new Map<string, { note: NotePage["notes"][number]; index: number }[]>();
  notes.forEach((note, index) => {
    const label = dateGroup(note.updatedAt);
    const items = groups.get(label);
    if (items) items.push({ note, index });
    else groups.set(label, [{ note, index }]);
  });

  useEffect(() => {
    const current = ++epoch.current;
    setPage(null); setSelected(0); setError(""); setPreviewError(""); setLoading(true); setPaging(false);
    resultScroll.current = 0;
    if (list.current) list.current.scrollTop = 0;
    pagingLock.current = false;
    if (!searchActive || !available) { setLoading(false); return; }
    const timer = setTimeout(() => {
      void request<NotePage>("queryNotes", { query: searchQuery, tags: [], sort: "updatedAt", limit: 30 }).then(result => {
        if (epoch.current === current) setPage(result);
      }).catch(cause => {
        if (epoch.current === current) setError(errorMessage(cause));
      }).finally(() => { if (epoch.current === current) setLoading(false); });
    }, searchQuery ? 200 : 0);
    return () => { clearTimeout(timer); epoch.current = current + 1; };
  }, [searchActive, available, searchQuery, retry]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-result-index="${selected}"]`)?.scrollIntoView?.({ block: "nearest" });
    setPreviewError("");
  }, [selected]);

  async function loadMore() {
    if (!page?.nextCursor || pagingLock.current || loading || !available) return;
    const current = epoch.current;
    pagingLock.current = true; setPaging(true); setError("");
    try {
      const next = await request<NotePage>("queryNotes", { query: searchQuery, tags: [], sort: "updatedAt", limit: 30, cursor: page.nextCursor });
      if (epoch.current === current) setPage(previous => previous && ({ ...next, notes: [...previous.notes, ...next.notes] }));
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

  return { input, list, resultScroll, attachList, mobileViewport, listId, query, setQuery, keyboardFocus, setKeyboardFocus, page, selected, setSelected, loading, paging, error, previewError, setPreviewError, setRetry, searchQuery, notes, active, groups, loadMore, moveSelection };
}
