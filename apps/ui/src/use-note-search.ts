import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
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
type SearchTag = { name: string; count: number };
export type SearchResult =
  | { kind: "tag"; key: string; title: string; tag: SearchTag }
  | { kind: "note"; key: string; title: string; note: NotePage["notes"][number] };
const emptyTags: SearchTag[] = [];
const emptyNotes: NotePage["notes"] = [];

export type NoteSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  available: boolean;
  returnFocus: RefObject<HTMLElement | null>;
  onShortcutFocusBlur?: () => void;
  onOpenNote: (id: string) => void;
  tags?: SearchTag[];
  onOpenTag?: (name: string) => void;
  preserveSession?: boolean;
  sessionRef?: RefObject<NoteSearchSession | null>;
};

export function useNoteSearch({ open, available, tags = emptyTags, preserveSession = false, sessionRef, isMobile }: Pick<NoteSearchProps, "open" | "available" | "tags" | "preserveSession" | "sessionRef"> & { isMobile: boolean }) {
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
  const [query, setQueryValue] = useState("");
  const [page, setPage] = useState<NotePage | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState<typeof import("./tag-search") | null>();
  const [notesLoading, setLoading] = useState(true);
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
  const searchNotes = searchActive && available;
  const hasTagQuery = searchNotes && Boolean(searchQuery) && tags.length > 0;
  const loading = notesLoading || (hasTagQuery && tagSearch === undefined);
  useEffect(() => {
    if (!hasTagQuery || tagSearch !== undefined) return;
    let current = true;
    void import("./tag-search").then(module => { if (current) setTagSearch(module); }).catch(() => {
      // Keep original-name matches if the optional pinyin dictionary cannot load.
      if (current) setTagSearch(null);
    });
    return () => { current = false; };
  }, [hasTagQuery, tagSearch]);
  const tagKeys = useMemo(() => tagSearch && new Map(tags.map(tag => [tag.name, tagSearch.tagSearchKeys(tag.name)])), [tagSearch, tags]);
  const tagResults = useMemo(() => {
    if (!hasTagQuery) return [];
    const needle = searchQuery.toLocaleLowerCase();
    const rank = tagSearch?.tagSearchRank(searchQuery);
    return tags.map(tag => {
      const original = tag.name.toLocaleLowerCase();
      const keys = tagKeys?.get(tag.name);
      return {tag, rank: rank && keys ? rank(keys) : original === needle ? 0 : original.includes(needle) ? 2 : -1};
    }).filter(match => match.rank >= 0).sort((a, b) => a.rank - b.rank || b.tag.count - a.tag.count || a.tag.name.localeCompare(b.tag.name));
  }, [hasTagQuery, searchQuery, tagKeys, tagSearch, tags]);
  const notes = searchNotes && page ? page.notes : emptyNotes;
  const results = useMemo<SearchResult[]>(() => {
    const needle = searchQuery.toLocaleLowerCase();
    const ranked = notes.map((note, position) => {
      const title = note.title?.trim() || "新内容";
      const name = title.toLocaleLowerCase();
      const rank = name === needle ? 0 : name.includes(needle) ? 2 : 3;
      const result: SearchResult = {kind: "note", key: `note:${note.id}`, title, note};
      return {rank, position, result};
    });
    if (!needle) return ranked.map(item => item.result);
    const rankedTags = tagResults.map(({tag, rank}, position) => {
      const result: SearchResult = {kind: "tag", key: `tag:${tag.name}`, title: tag.name, tag};
      return {rank, position, result};
    });
    return [...rankedTags, ...ranked].sort((a, b) => a.rank - b.rank || a.position - b.position).map(item => item.result);
  }, [tagResults, notes, searchQuery]);
  const selected = Math.max(0, results.findIndex(result => result.key === selectedKey));
  const active = results[selected];
  const selection = useRef<{ key?: string; noteIndex: number }>({noteIndex: 0});
  useEffect(() => { selection.current = {key: active?.key, noteIndex: active?.kind === "note" ? notes.indexOf(active.note) : -1}; }, [active, notes]);
  const groups = new Map<string, { result: SearchResult; index: number }[]>();
  results.forEach((result, index) => {
    const label = !searchQuery && result.kind === "note" ? dateGroup(result.note.updatedAt) : "";
    const items = groups.get(label);
    if (items) items.push({result, index});
    else groups.set(label, [{result, index}]);
  });

  const setSelected = (index: number) => setSelectedKey(results[index]?.key ?? null);
  const setQuery = (value: string) => { setQueryValue(value); setSelectedKey(null); };

  const removeNote = useCallback((id: string) => {
    const remaining = results.filter(result => result.key !== `note:${id}`);
    const activeIndex = remaining.findIndex(result => result.key === active?.key);
    const next = activeIndex >= 0 ? activeIndex : Math.max(0, Math.min(selected, remaining.length - 1));
    retainScroll.current = next !== selected;
    setSelectedKey(remaining[next]?.key ?? null);
    setPage(previous => previous && ({ ...previous, notes: previous.notes.filter(note => note.id !== id) }));
    // Invalidate in-flight pages immediately, then obtain fresh cursors without
    // resetting the query, loaded extent or return position.
    epoch.current++;
    retainSession.current = true;
    setMutation(value => value + 1);
  }, [active?.key, results, selected]);
  useImperativeHandle(sessionRef, () => ({ removeNote }), [removeNote]);

  useEffect(() => {
    const current = ++epoch.current;
    const retain = retainSession.current;
    retainSession.current = false;
    retainedRefreshFailed.current = false;
    const pageCount = retain ? loadedPages.current : 1;
    if (!retain) {
      if (!searchNotes) { setPage(null); setSelectedKey(null); }
      loadedPages.current = 1;
    }
    setError(""); setPreviewError(""); setLoading(!retain); setPaging(retain);
    pagingLock.current = retain;
    if (!searchNotes) { setLoading(false); setPaging(false); pagingLock.current = false; return; }
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
            if (anchor.key?.startsWith("note:")) {
              const activeIndex = result.notes.findIndex(note => `note:${note.id}` === anchor.key);
              const next = activeIndex >= 0 ? activeIndex : Math.max(0, Math.min(anchor.noteIndex, result.notes.length - 1));
              retainScroll.current = next !== anchor.noteIndex;
              const note = result.notes[next];
              setSelectedKey(note ? `note:${note.id}` : null);
            }
          } else {
            resultScroll.current = 0;
            if (list.current) list.current.scrollTop = 0;
            setSelectedKey(null);
          }
          setPage(result);
        }
      }).catch(cause => {
        if (epoch.current === current) {
          if (!retain) { setPage(null); setSelectedKey(null); }
          retainedRefreshFailed.current = retain;
          setError(errorMessage(cause));
        }
      }).finally(() => { if (epoch.current === current) { setLoading(false); setPaging(false); pagingLock.current = false; } });
    }, retain ? 0 : searchQuery ? 200 : 0);
    return () => { clearTimeout(timer); epoch.current += 1; };
  }, [searchNotes, searchQuery, retry, mutation]);

  useEffect(() => {
    if (!retainScroll.current) list.current?.querySelector<HTMLElement>(`[data-result-index="${selected}"]`)?.scrollIntoView?.({ block: "nearest" });
    retainScroll.current = false;
    setPreviewError("");
  }, [active?.key, selected]);

  async function loadMore() {
    if (!page?.nextCursor || pagingLock.current || loading || !available) return;
    const current = epoch.current;
    setSelectedKey(active?.key ?? null);
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
    if (!results.length || loading) return;
    setSelected(Math.max(0, Math.min(results.length - 1, selected + direction)));
  }

  async function retrySearch() {
    if (retainedRefreshFailed.current) { retainSession.current = true; setRetry(value => value + 1); }
    else if (page?.nextCursor) await loadMore();
    else setRetry(value => value + 1);
  }

  return { input, list, resultScroll, attachList, mobileViewport, listId, query, setQuery, page, selected, setSelected, loading, paging, error, previewError, setPreviewError, searchQuery, results, active, groups, loadMore, moveSelection, retrySearch };
}
