import { useState } from "react";
import { NotePreview } from "../src/NotePreview";
import { NoteCollection } from "../src/components/note-collection";
import { Button } from "../src/components/ui/button";
import { collectionNotes, formatCollectionDate, pinnedCollectionIds } from "./note-collection.fixtures";

export type NoteCollectionExampleProps = {
  home: boolean;
  state: "ready" | "loading" | "empty" | "unavailable" | "pagination" | "paging";
  onQueryChange: (query: string) => void;
  onSelectTag: (tag: string) => void;
  onOpen: (id: string) => void;
  onNewNote: () => void;
  onLoadMore: () => void;
  onTabChange: (tab: "recent" | "pinned") => void;
  onError: (message: string) => void;
};

export function NoteCollectionExample({ home, state, onQueryChange, onSelectTag, onOpen, onNewNote, onLoadMore, onTabChange, onError }: NoteCollectionExampleProps) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [tab, setTab] = useState<"recent" | "pinned">("recent");
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(2);
  const [creationRequested, setCreationRequested] = useState(false);
  const source = state === "loading" || state === "empty" ? [] : collectionNotes;
  const matches = source.filter(note => (!home || tab === "recent" || pinnedCollectionIds.has(note.id))
    && (!tag || note.tags.includes(tag))
    && `${note.title}\n${note.body}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const paginated = state === "pagination" || state === "paging";
  const notes = paginated ? matches.slice(0, pageSize) : matches;
  const opened = collectionNotes.find(note => note.id === openedId);
  return <main className="min-h-dvh space-y-4 bg-background p-4 text-foreground md:p-6">
    <h1 className="text-xl font-semibold">{home ? "主页笔记" : "笔记集合"}</h1>
    <p className="max-w-2xl text-sm text-muted-foreground">真实 NoteCollection 与 NotePreview；查询、标签、分页和打开状态由此示例管理，只使用内存笔记。</p>
    {opened ? <section aria-label="笔记详情" className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => setOpenedId(null)}>返回笔记集合</Button>
      <NotePreview title={opened.title} body={opened.body} notePath={opened.relativePath} onError={onError} />
    </section> : <>
      {tag && <div className="flex flex-wrap items-center gap-2 text-sm">
        <span role="status">当前标签：{tag}</span>
        <Button variant="ghost" size="sm" onClick={() => setTag(null)}>清除标签筛选</Button>
      </div>}
      <NoteCollection home={home ? { tab, pinnedCount: pinnedCollectionIds.size, onTabChange: next => { setTab(next); onTabChange(next); } } : undefined}
        notes={notes} query={query} onQueryChange={next => { setQuery(next); onQueryChange(next); }}
        searchPlaceholder="搜索当前视图笔记" searchDisabled={state === "unavailable"}
        loading={state === "loading"} hasMore={paginated && notes.length < matches.length}
        paging={state === "paging"} loadMoreDisabled={state === "paging"}
        canOpen={state !== "unavailable"} canCreate={state !== "unavailable"}
        onOpen={id => { setOpenedId(id); onOpen(id); }}
        onSelectTag={next => { setTag(next); onSelectTag(next); }}
        onNewNote={() => { setCreationRequested(true); onNewNote(); }}
        onLoadMore={() => { setPageSize(size => size + 2); onLoadMore(); }}
        onError={onError} formatDate={formatCollectionDate}>
        <p className="py-8 text-center text-sm text-muted-foreground">{query || tag ? "没有找到相关笔记" : "笔记库中还没有笔记"}</p>
      </NoteCollection>
      {creationRequested && <output aria-label="新建笔记请求" className="block text-sm text-muted-foreground">已请求打开现有的新建笔记流程</output>}
    </>}
  </main>;
}
