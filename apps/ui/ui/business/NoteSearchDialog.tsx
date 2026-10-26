import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import ArrowTurnDownIcon from "@hugeicons/core-free-icons/ArrowTurnDownIcon";
import { useNoteSearch, type NoteSearchProps } from "../../src/use-note-search";
import { isIOSNative, useIOSSurface } from "../../src/ios-native";
import { useIsMobile } from "../../src/hooks/use-mobile";
import { Button } from "../components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/dialog";
import { SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { Input } from "../components/input";
import { Spinner } from "../components/spinner";
import { CloseIcon, DocumentIcon, SearchIcon } from "../icons";
import { cn } from "../lib/utils";
import { NoteMarkdown } from "./NoteMarkdown";
import "./note-search.css";

export type NoteSearchDialogProps = NoteSearchProps;

function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  return index < 0 ? text : <>{text.slice(0, index)}<mark className="ui-note-search-mark rounded-inner">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export function NoteSearchDialog({ open, onOpenChange, vaultName, available, returnFocus, onOpenNote, preserveSession = false, sessionRef }: NoteSearchDialogProps) {
  const isMobile = useIsMobile() || isIOSNative;
  const { input, resultScroll, attachList, mobileViewport, listId, query, setQuery, keyboardFocus, setKeyboardFocus, page, selected, setSelected, loading, paging, error, previewError, setPreviewError, retrySearch, searchQuery, notes, active, groups, loadMore, moveSelection } = useNoteSearch({ open, available, preserveSession, sessionRef, isMobile });
  const SearchContent = isMobile ? SheetContent : DialogContent;
  useIOSSurface("search", () => ({
    kind:"search",title:"搜索笔记",presented:open,loading:loading || paging,error,
    message:!available ? "请先连接笔记库，再搜索内容。" : loading ? "正在搜索笔记…" : !notes.length ? searchQuery ? "没有找到相关笔记" : "笔记库中还没有笔记" : undefined,
    sections:[{id:"query",fields:[{id:"query",title:`在 ${vaultName} 中搜索…`,value:query,disabled:!available}]},
      ...Array.from(groups,([label,items])=>({id:label,title:label,actions:items.map(({note,index})=>({id:`note:${note.id}`,title:note.title?.trim() || "新内容",selected:selected === index,disabled:loading || !available}))})),
      {id:"more",message:page && !page.coverage.complete ? "部分文件尚未读入，搜索结果可能不完整。" : undefined,actions:[
        ...(error ? [{id:"retry",title:"重试"}] : page?.nextCursor ? [{id:"more",title:paging ? "正在加载…" : "加载更多结果",disabled:paging}] : []),
        {id:"up",title:"上一条",disabled:loading || !notes.length},{id:"down",title:"下一条",disabled:loading || !notes.length},
      ]}],
  }),async(action,value)=>{
    if(action === "close")onOpenChange(false);
    if(action === "query")setQuery(value ?? "");
    if(action.startsWith("note:") && !loading && available)onOpenNote(action.slice(5));
    if(action === "more")await loadMore();
    if(action === "retry")await retrySearch();
    if(action === "up" || action === "down")moveSelection(action === "up" ? -1 : 1);
  });
  if(isIOSNative)return null;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <SearchContent {...(isMobile ? {side:"bottom" as const,swipeToClose:true} : {})} initialFocus={input} finalFocus={() => preserveSession ? false : returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>('main header button') ?? false} style={isMobile ? mobileViewport ?? undefined : undefined} showCloseButton={false} data-keyboard-focus={keyboardFocus || undefined} onKeyDownCapture={() => setKeyboardFocus(true)} onPointerDownCapture={() => setKeyboardFocus(false)} className={isMobile ? "ui-note-search-sheet gap-4 overflow-hidden" : "ui-note-search-dialog flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-surface p-0 ring-0 dark:ring-0"}>
      {isMobile ? <SheetHeader className="flex-row shrink-0 items-center justify-between p-0"><SheetTitle className="font-sans font-semibold">搜索笔记</SheetTitle><SheetCloseButton aria-label="退出搜索" /></SheetHeader> : <DialogTitle className="sr-only">搜索笔记</DialogTitle>}
      <DialogDescription className="sr-only">{isMobile ? "搜索当前笔记库的标题与正文。选择结果查看笔记，返回后可继续搜索。" : "搜索当前笔记库的标题与正文。用上下方向键选择，回车打开，Escape 关闭。"}</DialogDescription>
      <div className="ui-note-search-field flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <SearchIcon aria-hidden="true" className="size-5 shrink-0 text-icon-secondary" />
        <Input ref={input} role="combobox" name="note-search" autoComplete="off" aria-label="搜索笔记" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={active ? `${listId}-${selected}` : undefined} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(event.key === "ArrowDown" ? 1 : -1); }
          if (event.key === "Enter" && active && !loading && available) { event.preventDefault(); onOpenNote(active.id); }
        }} disabled={!available} placeholder={`在 ${vaultName} 中搜索…`} className="ui-note-search-input h-element-lg min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none" />
        {query && <Button variant="ghost" size="icon-sm" className="ui-note-search-control" aria-label="清空搜索" onClick={() => { setQuery(""); input.current?.focus(); }}><CloseIcon aria-hidden="true" /></Button>}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={attachList} onScroll={event=>{resultScroll.current=event.currentTarget.scrollTop;}} className="ui-note-search-results min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            <p role="status" className={loading || !notes.length ? "ui-note-search-status text-center text-sm text-secondary" : "sr-only"}>
              {!available ? "请先连接笔记库，再搜索内容。" : loading ? <><Spinner aria-hidden="true" className="mx-auto mb-3 size-5 animate-spin motion-reduce:animate-none" />正在搜索笔记…</> : error && !notes.length ? "搜索未完成" : notes.length ? `已显示 ${notes.length} 条${page?.nextCursor ? "，还有更多结果" : "结果"}` : searchQuery ? "没有找到相关笔记" : "笔记库中还没有笔记"}
            </p>
            {!loading && available && !notes.length && !error && searchQuery && <p className="pb-8 text-center text-xs text-secondary">试试其他关键词，搜索标题或正文。</p>}
            <div id={listId} role="listbox" aria-label={searchQuery ? "搜索结果" : "最近更新的笔记"} aria-busy={loading} className="space-y-2">
              {Array.from(groups, ([label, items]) => <div key={label} role="group" aria-label={label}>
                <p aria-hidden="true" className="px-3 pb-2 pt-3 text-xs font-medium text-secondary">{label}</p>
                {items.map(({ note, index }) => <button key={note.id} type="button" role="option" aria-selected={selected === index} aria-label={note.title?.trim() || "新内容"} id={`${listId}-${index}`} data-result-index={index} tabIndex={-1} onPointerMove={event => { if (event.pointerType === "mouse" && selected !== index) setSelected(index); }} onClick={() => onOpenNote(note.id)} className={cn("flex w-full items-center rounded-element px-3 py-2.5 text-left outline-none hover:bg-overlay-hover focus-visible:focus-ring", selected === index && "bg-muted")}>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium"><Highlight text={note.title?.trim() || "新内容"} query={searchQuery} /></span>
                </button>)}
              </div>)}
            </div>
            {error && <div role="alert" className="space-y-2 px-3 py-4 text-sm"><p className="text-error">{error}</p><Button variant="outline" size="sm" className="ui-note-search-control" onClick={() => void retrySearch()}>重试</Button></div>}
            {page?.nextCursor && !error && <div className="p-3 text-center"><Button variant="ghost" size="sm" className="ui-note-search-control" disabled={paging} onClick={() => void loadMore()}>{paging ? "正在加载…" : "加载更多结果"}</Button></div>}
            {page && !page.coverage.complete && <p className="px-3 py-3 text-xs text-secondary">部分文件尚未读入，搜索结果可能不完整。</p>}
          </div>
        </div>
        <aside aria-label="笔记预览" className="ui-note-search-preview min-h-0 shrink-0 p-4">
          {active && available ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-body">
            <div className="ui-note-search-preview-content min-h-0 flex-1 p-5" key={active.id}>
              <div className="break-words">
                <div className="ui-note-search-preview-heading flex items-start justify-between gap-3">
                  {(active.title || !active.body.trim()) && <h2 className="ui-note-search-preview-title min-w-0 flex-1">{active.title || "新内容"}</h2>}
                  <Button variant="outline" size="icon-sm" className="ui-note-search-control ml-auto" aria-label="打开笔记" title="打开笔记" onClick={() => onOpenNote(active.id)}><HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" /></Button>
                </div>
                <div inert><NoteMarkdown body={active.body || "还没有正文"} notePath={active.relativePath} onError={setPreviewError} /></div>
              </div>
              <p className="mt-6 text-xs text-secondary">更新于 {new Date(active.updatedAt).toLocaleString()}</p>
              {previewError && <p role="alert" className="mt-3 text-sm text-error">{previewError}</p>}
            </div>
          </div> : <div className="ui-note-search-empty text-center text-sm text-secondary"><DocumentIcon aria-hidden="true" className="mx-auto mb-3 size-7 opacity-50" />选择笔记以预览</div>}
        </aside>
      </div>
      {!isMobile && <div className="ui-note-search-footer flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 text-xs text-secondary">
        <span className="ui-note-search-keyboard-hints flex items-center gap-3"><span className="flex items-center gap-1"><HugeiconsIcon icon={ArrowUp01Icon} aria-hidden="true" className="size-3" /><HugeiconsIcon icon={ArrowDown01Icon} aria-hidden="true" className="size-3" />选择</span><span className="flex items-center gap-1"><HugeiconsIcon icon={ArrowTurnDownIcon} aria-hidden="true" className="size-3" />打开</span></span>
        <span className="ui-note-search-escape ml-auto shrink-0">Esc 关闭</span>
        <Button variant="ghost" size="sm" className="ui-note-search-control ui-note-search-dismiss ml-auto" aria-label="关闭搜索" onClick={() => onOpenChange(false)}>取消</Button>
      </div>}
    </SearchContent>
  </Dialog>;
}
