import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, CornerDownLeft, FileText, LoaderCircle, Search, X } from "lucide-react";
import type { NotePage } from "@memocard/contracts";
import { request, errorMessage } from "../bridge";
import { Markdown } from "../markdown";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { cn } from "@/lib/utils";
import "./note-search-dialog.css";

function dateGroup(value: string) {
  const date = new Date(value), today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const week = new Date(today); week.setDate(today.getDate() - 7);
  return date >= today ? "今天" : date >= yesterday ? "昨天" : date >= week ? "过去 7 天" : "更早";
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  return index < 0 ? text : <>{text.slice(0, index)}<mark className="note-search-mark rounded-xs">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  available: boolean;
  returnFocus: RefObject<HTMLElement | null>;
  onOpenNote: (id: string) => void;
};

export function NoteSearchDialog({ open, onOpenChange, vaultName, available, returnFocus, onOpenNote }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
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
    pagingLock.current = false;
    if (!open || !available) { setLoading(false); return; }
    const timer = setTimeout(() => {
      void request<NotePage>("queryNotes", { query: searchQuery, tags: [], sort: "updatedAt", limit: 30 }).then(result => {
        if (epoch.current === current) setPage(result);
      }).catch(cause => {
        if (epoch.current === current) setError(errorMessage(cause));
      }).finally(() => { if (epoch.current === current) setLoading(false); });
    }, searchQuery ? 200 : 0);
    return () => { clearTimeout(timer); epoch.current = current + 1; };
  }, [open, available, searchQuery, retry]);

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

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent initialFocus={input} finalFocus={() => returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>('main header button') ?? false} showCloseButton={false} data-keyboard-focus={keyboardFocus || undefined} onKeyDownCapture={() => setKeyboardFocus(true)} onPointerDownCapture={() => setKeyboardFocus(false)} className="note-search-dialog flex flex-col gap-0 overflow-hidden rounded-xl border-border p-0">
      <DialogTitle className="sr-only">搜索笔记</DialogTitle>
      <DialogDescription className="sr-only">搜索当前笔记库的标题与正文。用上下方向键选择，回车打开，Escape 关闭。</DialogDescription>
      <div className="note-search-field flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <Search aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <Input ref={input} role="combobox" name="note-search" autoComplete="off" aria-label="搜索笔记" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={active ? `${listId}-${selected}` : undefined} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(event.key === "ArrowDown" ? 1 : -1); }
          if (event.key === "Enter" && active && !loading && available) { event.preventDefault(); onOpenNote(active.id); }
        }} disabled={!available} placeholder={`在 ${vaultName} 中搜索…`} className="note-search-input h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
        {query && <Button variant="ghost" size="icon-sm" aria-label="清空搜索" onClick={() => { setQuery(""); input.current?.focus(); }}><X aria-hidden="true" /></Button>}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <p role="status" className={loading || !notes.length ? "note-search-status text-center text-sm text-muted-foreground" : "sr-only"}>
              {!available ? "请先连接笔记库，再搜索内容。" : loading ? <><LoaderCircle aria-hidden="true" className="mx-auto mb-3 size-5 animate-spin motion-reduce:animate-none" />正在搜索笔记…</> : error && !notes.length ? "搜索未完成" : notes.length ? `已显示 ${notes.length} 条${page?.nextCursor ? "，还有更多结果" : "结果"}` : searchQuery ? "没有找到相关笔记" : "笔记库中还没有笔记"}
            </p>
            {!loading && available && !notes.length && !error && searchQuery && <p className="pb-8 text-center text-xs text-muted-foreground">试试其他关键词，搜索标题或正文。</p>}
            <div id={listId} role="listbox" aria-label={searchQuery ? "搜索结果" : "最近更新的笔记"} aria-busy={loading} className="space-y-2">
              {Array.from(groups, ([label, items]) => <div key={label} role="group" aria-label={label}>
                <p aria-hidden="true" className="px-3 pb-2 pt-3 text-xs font-medium text-muted-foreground">{label}</p>
                {items.map(({ note, index }) => <button key={note.id} type="button" role="option" aria-selected={selected === index} aria-label={note.title?.trim() || "新内容"} id={`${listId}-${index}`} data-result-index={index} tabIndex={-1} onPointerMove={event => { if (event.pointerType === "mouse" && selected !== index) setSelected(index); }} onClick={() => onOpenNote(note.id)} className={cn("flex w-full items-center rounded-lg px-3 py-2.5 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring", selected === index && "bg-accent")}>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium"><Highlight text={note.title?.trim() || "新内容"} query={searchQuery} /></span>
                </button>)}
              </div>)}
            </div>
            {error && <div role="alert" className="space-y-2 px-3 py-4 text-sm"><p className="text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => page?.nextCursor ? void loadMore() : setRetry(value => value + 1)}>重试</Button></div>}
            {page?.nextCursor && !error && <div className="p-3 text-center"><Button variant="ghost" size="sm" disabled={paging} onClick={() => void loadMore()}>{paging ? "正在加载…" : "加载更多结果"}</Button></div>}
            {page && !page.coverage.complete && <p className="px-3 py-3 text-xs text-muted-foreground">部分文件尚未读入，搜索结果可能不完整。</p>}
          </div>
        </div>
        <aside aria-label="笔记预览" className="note-search-preview min-h-0 shrink-0 p-4">
          {active && available ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background">
            <div className="note-search-preview-content min-h-0 flex-1 p-5" key={active.id}>
              <div className="typeset-content break-words">
                <div className="note-search-preview-heading flex items-start justify-between gap-3">
                  {(active.title || !active.body.trim()) && <h2 className="note-search-preview-title min-w-0 flex-1">{active.title || "新内容"}</h2>}
                  <Button variant="outline" size="icon-sm" className="ml-auto" aria-label="打开笔记" title="打开笔记" onClick={() => onOpenNote(active.id)}><ArrowUpRight aria-hidden="true" /></Button>
                </div>
                <div inert><Markdown body={active.body || "还没有正文"} notePath={active.relativePath} onError={setPreviewError} /></div>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">更新于 {new Date(active.updatedAt).toLocaleString()}</p>
              {previewError && <p role="alert" className="mt-3 text-sm text-destructive">{previewError}</p>}
            </div>
          </div> : <div className="note-search-empty text-center text-sm text-muted-foreground"><FileText aria-hidden="true" className="mx-auto mb-3 size-7 opacity-50" />选择笔记以预览</div>}
        </aside>
      </div>
      <div className="note-search-footer flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="note-search-keyboard-hints flex items-center gap-3"><span className="flex items-center gap-1"><ArrowUp aria-hidden="true" className="size-3" /><ArrowDown aria-hidden="true" className="size-3" />选择</span><span className="flex items-center gap-1"><CornerDownLeft aria-hidden="true" className="size-3" />打开</span></span>
        <span className="note-search-escape ml-auto shrink-0">Esc 关闭</span>
        <Button variant="ghost" size="sm" className="note-search-dismiss ml-auto" aria-label="关闭搜索" onClick={() => onOpenChange(false)}>取消</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
