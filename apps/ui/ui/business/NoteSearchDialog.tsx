import { Suspense, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowUpRight01Icon from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
import { useNoteSearch, type NoteSearchProps, type SearchResult } from "../../src/use-note-search";
import { isIOSNative, useIOSSurface } from "../../src/ios-native";
import { useIsMobile } from "../../src/hooks/use-mobile";
import { Button } from "../components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/dialog";
import { SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { Input } from "../components/input";
import { Kbd, KbdGroup } from "../components/kbd";
import { Spinner } from "../components/spinner";
import { DocumentIcon, SearchIcon } from "../icons";
import { cn } from "../lib/utils";
import { EmptyIllustration } from "./EmptyIllustration";
import { Skeleton } from "../components/skeleton";
import { recoverableLazy } from "../components/recoverable-lazy";
import { Tag01Icon } from "./tag-01-icon";
import "./note-search.css";

export type NoteSearchDialogProps = NoteSearchProps;

const PreviewMarkdown = recoverableLazy(() => import("./NoteMarkdown").then(module => ({ default: module.NoteMarkdown })), "预览正文",
  ({ body }) => <p className="whitespace-pre-wrap">{body}</p>);

function PreviewLines() {
  return <div aria-hidden="true" className="ui-search-loading space-y-3">
    <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-2/3" />
  </div>;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
  return index < 0 ? text : <>{text.slice(0, index)}<mark className="ui-note-search-mark rounded-inner">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>;
}

export function NoteSearchDialog({ open, onOpenChange, vaultName, available, returnFocus, onShortcutFocusBlur, onOpenNote, tags, onOpenTag, preserveSession = false, sessionRef }: NoteSearchDialogProps) {
  const isMobile = useIsMobile() || isIOSNative;
  const { input, resultScroll, attachList, mobileViewport, listId, query, setQuery, page, selected, setSelected, loading, paging, error, previewError, setPreviewError, retrySearch, searchQuery, results, active, groups, loadMore, moveSelection } = useNoteSearch({ open, available, tags: onOpenTag ? tags : undefined, preserveSession, sessionRef, isMobile });
  const previewNote = active?.kind === "note" ? active.note : undefined;
  const previewTag = active?.kind === "tag" ? active.tag : undefined;
  const searchableFields = onOpenTag ? "标题、正文和标签" : "标题与正文";
  const resultType = onOpenTag ? "笔记或标签" : "笔记";
  const emptyMessage = searchQuery ? `没有找到相关${resultType}` : "笔记库中还没有笔记";
  function openResult(result: SearchResult) {
    if (loading || !available) return;
    if (result.kind === "tag") onOpenTag?.(result.tag.name);
    else onOpenNote(result.note.id);
  }
  const SearchContent = isMobile ? SheetContent : DialogContent;
  const [showPreview, setShowPreview] = useState(false);
  useEffect(() => {
    if (isIOSNative) return;
    const media = window.matchMedia("(min-width: 1024px) and (min-height: 480px)");
    const update = () => setShowPreview(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useIOSSurface("search", () => ({
    kind:"search",title:"搜索笔记",presented:open,loading:loading || paging,error,
    message:!available ? "请先连接笔记库，再搜索内容。" : loading ? "正在搜索…" : !results.length && !error ? emptyMessage : undefined,
    sections:[{id:"query",fields:[{id:"query",title:`在 ${vaultName} 中搜索…`,value:query,disabled:!available}]},
      ...Array.from(loading ? [] : groups,([label,items])=>({id:label || "results",title:label || undefined,actions:items.map(({result,index})=>({id:result.key,title:result.title,selected:selected === index,disabled:loading || !available}))})),
      {id:"more",message:page && !page.coverage.complete ? "部分文件尚未读入，搜索结果可能不完整。" : undefined,actions:[
        ...(error ? [{id:"retry",title:"重试"}] : !loading && page?.nextCursor ? [{id:"more",title:paging ? "正在加载…" : "加载更多结果",disabled:paging}] : []),
        {id:"up",title:"上一条",disabled:loading || !results.length},{id:"down",title:"下一条",disabled:loading || !results.length},
      ]}],
  }),async(action,value)=>{
    if(action === "close")onOpenChange(false);
    if(action === "query")setQuery(value ?? "");
    const result = results.find(item => item.key === action);
    if (result) openResult(result);
    if(action === "more")await loadMore();
    if(action === "retry")await retrySearch();
    if(action === "up" || action === "down")moveSelection(action === "up" ? -1 : 1);
  });
  if(isIOSNative)return null;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <SearchContent {...(isMobile ? {side:"bottom" as const,swipeToClose:true} : {})} initialFocus={input} finalFocus={() => preserveSession ? false : returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>('main header button') ?? false} style={isMobile ? mobileViewport ?? undefined : undefined} showCloseButton={false} className={isMobile ? "ui-note-search-sheet gap-4 overflow-hidden" : "ui-note-search-dialog flex flex-col gap-0 overflow-hidden rounded-xl border bg-surface p-0 ring-0 dark:ring-0"}>
      {isMobile ? <SheetHeader className="flex-row shrink-0 items-center justify-between p-0"><SheetTitle className="font-sans font-semibold">搜索笔记</SheetTitle><SheetCloseButton aria-label="退出搜索" /></SheetHeader> : <DialogTitle className="sr-only">搜索笔记</DialogTitle>}
      <DialogDescription className="sr-only">搜索当前笔记库的{searchableFields}。{isMobile ? "选择结果打开。查看笔记后可返回搜索。" : "用上下方向键选择，回车打开，Escape 关闭。"}</DialogDescription>
      <search aria-label="全局搜索" className="ui-note-search-field flex shrink-0 items-center gap-3 border-b border-divider px-4 py-2">
        <SearchIcon aria-hidden="true" className="size-5 shrink-0 text-icon-secondary" />
        <Input ref={input} role="combobox" name="note-search" autoFocus={Boolean(onShortcutFocusBlur)} autoComplete="off" aria-label="搜索笔记" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={active && !loading ? `${listId}-${selected}` : undefined} data-shortcut-focus={onShortcutFocusBlur ? "" : undefined} onBlur={onShortcutFocusBlur} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); moveSelection(event.key === "ArrowDown" ? 1 : -1); }
          if (event.key === "Enter" && event.nativeEvent.keyCode !== 229 && active && !loading && available) { event.preventDefault(); openResult(active); }
        }} disabled={!available} placeholder={`在 ${vaultName} 中搜索…`} className="ui-note-search-input h-element-lg min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none" />
        {loading && available && results.length > 0 && <span aria-hidden="true" className="ui-search-loading flex shrink-0"><Spinner className="size-4 text-secondary motion-reduce:animate-none" /></span>}
        {query && <Button variant="ghost" size="sm" className="ui-note-search-control text-secondary" aria-label="清空搜索" onClick={() => { setQuery(""); input.current?.focus(); }}>清空</Button>}
      </search>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={attachList} onScroll={event=>{resultScroll.current=event.currentTarget.scrollTop;}} className="ui-note-search-results min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {!loading && available && !results.length && !error && <div className="flex justify-center pt-8"><EmptyIllustration compact kind={searchQuery ? "loupe" : "drawer"} /></div>}
            <p role="status" className={!loading && !results.length ? cn("text-center text-sm text-secondary", available && !error ? "px-3 pb-3" : "ui-note-search-status") : "sr-only"}>
              {!available ? "请先连接笔记库，再搜索内容。" : loading ? "正在搜索…" : results.length ? `已显示 ${results.length} 条${page?.nextCursor ? "，还有更多结果" : "结果"}` : error ? "搜索未完成" : emptyMessage}
            </p>
            {!loading && available && !results.length && !error && searchQuery && <p className="pb-8 text-center text-xs text-secondary">试试其他关键词，搜索{searchableFields}。</p>}
            <div id={listId} role="listbox" aria-label={searchQuery ? "搜索结果" : "最近更新的笔记"} aria-busy={loading} className="space-y-2">
              {available && loading && !results.length && <div aria-hidden="true" className="ui-search-loading px-2">
                <div className="flex h-10 items-center"><Skeleton className="h-3 w-12" /></div>
                {["w-3/4", "w-5/6", "w-1/2", "w-2/3"].map(width => <div key={width} className="flex h-9 items-center"><Skeleton className={cn("h-3", width)} /></div>)}
              </div>}
              {Array.from(groups, ([label, items]) => <div key={label} role={label ? "group" : undefined} aria-label={label || undefined}>
                {label && <p aria-hidden="true" className="px-2 pb-2 pt-3 text-xs font-medium text-secondary">{label}</p>}
                {items.map(({ result, index }) => <button key={result.key} type="button" role="option" aria-selected={selected === index} aria-label={result.kind === "tag" ? `标签 ${result.title}` : result.title} aria-description={result.kind === "tag" ? `${result.tag.count} 条笔记` : "笔记"} id={`${listId}-${index}`} data-result-index={index} tabIndex={-1} disabled={loading} onPointerMove={event => { if (!loading && event.pointerType === "mouse" && selected !== index) setSelected(index); }} onClick={() => openResult(result)} className={cn("flex w-full items-center gap-2 rounded-element p-2 text-left outline-none hover:bg-overlay-hover focus-visible:focus-ring", selected === index && "bg-muted")}>
                  {result.kind === "tag" ? <HugeiconsIcon icon={Tag01Icon} aria-hidden="true" className="size-4 shrink-0 text-icon-secondary" /> : <DocumentIcon aria-hidden="true" className="size-4 shrink-0 text-icon-secondary" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium"><Highlight text={result.title} query={searchQuery} /></span>
                </button>)}
              </div>)}
            </div>
            {error && <div role="alert" className="space-y-2 px-3 py-4 text-sm"><p className="text-error">{error}</p><Button variant="outline" size="sm" className="ui-note-search-control" onClick={() => void retrySearch()}>重试</Button></div>}
            {!loading && page?.nextCursor && !error && <div className="p-3 text-center"><Button variant="ghost" size="sm" className="ui-note-search-control" disabled={paging} onClick={() => void loadMore()}>{paging ? "正在加载…" : "加载更多结果"}</Button></div>}
            {!loading && page && !page.coverage.complete && <p className="px-3 py-3 text-xs text-secondary">部分文件尚未读入，搜索结果可能不完整。</p>}
          </div>
        </div>
        {!isMobile && showPreview && <aside aria-label={previewTag ? "标签预览" : "笔记预览"} className="ui-note-search-preview min-h-0 shrink-0 p-4">
          {active && available ? <div className="ui-note-search-preview-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
            <div className="ui-note-search-preview-header">
              {previewTag ? <HugeiconsIcon icon={Tag01Icon} aria-hidden="true" className="ui-note-search-preview-icon" /> : <DocumentIcon aria-hidden="true" className="ui-note-search-preview-icon" />}
              <Button variant="outline" size="icon-sm" className="ui-note-search-control" disabled={loading} aria-label={previewTag ? "查看标签笔记" : "打开笔记"} data-ui-tooltip={previewTag ? "查看标签笔记" : "打开笔记"} onClick={() => openResult(active)}><HugeiconsIcon icon={ArrowUpRight01Icon} aria-hidden="true" /></Button>
            </div>
            <div className="ui-note-search-preview-content min-h-0 flex-1 p-5" key={active.key}>
              <div className="break-words">
                <div className="ui-note-search-preview-heading">
                  <p className="ui-note-search-preview-vault">{vaultName}</p>
                  {(previewTag || previewNote?.title || !previewNote?.body.trim()) && <h2 className="ui-note-search-preview-title">{previewTag?.name ?? (previewNote?.title || "新内容")}</h2>}
                </div>
                {previewNote && <Suspense fallback={<PreviewLines />}><PreviewMarkdown interactive={false} body={previewNote.body || "还没有正文"} notePath={previewNote.relativePath} onError={setPreviewError} /></Suspense>}
                {previewTag && <p className="text-sm text-secondary">{previewTag.count} 条笔记</p>}
              </div>
              {previewNote && <p className="mt-6 text-xs text-secondary">更新于 {new Date(previewNote.updatedAt).toLocaleString()}</p>}
              {previewError && <p role="alert" className="mt-3 text-sm text-error">{previewError}</p>}
            </div>
          </div> : loading && available ? <div aria-hidden="true" className="ui-search-loading ui-note-search-preview-card flex flex-1 flex-col overflow-hidden rounded-xl">
            <div className="ui-note-search-preview-header" />
            <div className="ui-note-search-preview-content space-y-4 p-5">
              <Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-3/4" /><PreviewLines />
            </div>
          </div> : <div className="ui-note-search-empty text-center text-sm text-secondary"><DocumentIcon aria-hidden="true" className="mx-auto mb-3 size-7 opacity-50" />选择结果以预览</div>}
        </aside>}
      </div>
      {!isMobile && <div className="ui-note-search-footer flex shrink-0 items-center justify-between gap-3 border-t border-divider px-4 py-2 text-xs text-secondary">
        <span className="ui-note-search-keyboard-hints flex items-center gap-4"><span className="flex items-center gap-2"><KbdGroup><Kbd aria-label="向上方向键">↑</Kbd><Kbd aria-label="向下方向键">↓</Kbd></KbdGroup>选择</span><span className="flex items-center gap-2"><Kbd aria-label="回车键">↵</Kbd>打开</span></span>
        <span className="ui-note-search-escape ml-auto flex shrink-0 items-center gap-2"><Kbd>Esc</Kbd>关闭</span>
        <Button variant="ghost" size="sm" className="ui-note-search-control ui-note-search-dismiss ml-auto" aria-label="关闭搜索" onClick={() => onOpenChange(false)}>取消</Button>
      </div>}
    </SearchContent>
  </Dialog>;
}
