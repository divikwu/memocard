import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Note } from "@memocard/contracts";
import { NoteCollection } from "../business/NoteCollection";
import { NotePreview } from "../business/NotePreview";
import { Button } from "../components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/empty";
import { LumaStoryFrame } from "../LumaPage";
import { TagColorProvider } from "../../src/TagColorProvider";
import TagColorStyles from "../business/TagColorStyles";
import { expect, within } from "storybook/test";

const fixtures: Note[] = [
  ["coffee", "今天的手冲记录", "## 浅烘豆的另一种冲法\n\n水温 92°C，粉水比 **1:15**。记录一点日常的小发现。\n\n- 清晰的柑橘香气\n- 下次尝试更粗的研磨", ["area/coffee", "日常", "配方"]],
  ["design", "让设计语言走进真实页面", "标题与正文有各自的节奏，组件则共享颜色、字体与圆角。\n\n> 每一个小变化都应该有清楚的理由。", ["设计", "MemoCard"]],
  ["weekend", "Weekend reading list", "A short list of ideas worth returning to.\n\n1. Keep useful notes close.\n2. Make room for unfinished thoughts.\n3. Revisit what matters.", ["阅读"]],
  ["garden", "在阳台上留一点绿色", "新长出的叶子比想象中更快。周末记得换盆，给植物留出新的空间。", ["生活", "植物"]],
  ["untitled", "", "有时先把想法写下来，标题可以晚一点再说。", []],
  ["plans", "接下来想做的小事", "- [ ] 整理旅行照片\n- [ ] 听完新收藏的专辑\n- [x] 给自己留下一段空闲", ["计划", "生活"]],
].map(([id, title, body, tags], index) => ({ id: String(id), title: String(title), body: String(body), tags: tags as string[], createdAt: `2026-10-${String(16 + index).padStart(2, "0")}T08:00:00Z`, updatedAt: `2026-10-${String(22 - index).padStart(2, "0")}T08:00:00Z`, contentHash: `fixture-${id}`, relativePath: `notes/${id}.md`, sourceUrl: "" }));

function CollectionFixture({ home = false, empty = false, loading: initialLoading = false, error: initialError = false }: { home?: boolean; empty?: boolean; loading?: boolean; error?: boolean }) {
  const [notes, setNotes] = useState(empty ? [] : fixtures);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [tab, setTab] = useState<"recent" | "pinned">("recent");
  const [limit, setLimit] = useState(2);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(initialError ? "示例笔记暂时无法读取，请重试。" : null);
  const [opened, setOpened] = useState<string | null>(null);
  const pinned = new Set(["coffee", "design"]);
  const filtered = notes.filter(note => (!home || tab !== "pinned" || pinned.has(note.id)) && (!tag || note.tags.includes(tag)) && (!query || `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())));
  const selected = notes.find(note => note.id === opened);
  const create = () => {
    const id = `new-${notes.length + 1}`;
    const next: Note = { id, title: "新笔记", body: "从一句想法开始。", tags: [], createdAt: "2026-10-22T08:00:00Z", updatedAt: "2026-10-22T08:00:00Z", contentHash: id, relativePath: `notes/${id}.md`, sourceUrl: "" };
    setNotes(current => [next, ...current]);
    setOpened(id);
  };
  return <LumaStoryFrame><div className="mx-auto grid w-full max-w-5xl gap-6">
    <header><h1 className="type-heading-1">{home ? "主页" : "所有笔记"}</h1><p className="mt-2 text-sm text-secondary">真实的本地交互示例：搜索、标签筛选、布局、分页、打开与新建。示例不连接笔记库。</p></header>
    {loading && <div><Button variant="outline" onClick={() => setLoading(false)}>完成读取</Button></div>}
    {tag && <div className="flex items-center gap-3 text-sm"><span>当前标签：{tag}</span><Button variant="ghost" size="sm" onClick={() => { setTag(null); setLimit(2); }}>清除标签筛选</Button></div>}
    <NoteCollection home={home ? { tab, pinnedCount: notes.filter(note => pinned.has(note.id)).length, onTabChange: next => { setTab(next); setLimit(2); } } : undefined} notes={loading || error ? [] : filtered.slice(0, limit)} loading={loading} query={query} onQueryChange={value => { setQuery(value); setLimit(2); }} searchPlaceholder={tag ? "搜索当前标签内容" : "搜索笔记内容"} searchDisabled={loading || Boolean(error)} hasMore={!loading && !error && filtered.length > limit} paging={false} loadMoreDisabled={false} canOpen={!loading && !error} canCreate={!loading && !error} onNewNote={create} onOpen={setOpened} onSelectTag={name => { setTag(name); setLimit(2); }} onLoadMore={() => setLimit(current => current + 2)} onError={setError} formatDate={value => new Date(value).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}>
      {error ? <Empty className="border"><EmptyHeader><EmptyTitle>读取遇到问题</EmptyTitle><EmptyDescription><span role="alert">{error}</span></EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={() => setError(null)}>重试</Button></EmptyContent></Empty> : undefined}
    </NoteCollection>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setOpened(null); }}><DialogContent className="max-h-[85svh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.title?.trim() || "新内容"}</DialogTitle><DialogDescription>本地示例笔记</DialogDescription></DialogHeader>{selected && <NotePreview body={selected.body} title={selected.title} showTitle={false} notePath={selected.relativePath} onError={setError} />}</DialogContent></Dialog>
  </div></LumaStoryFrame>;
}

const meta = { title: "business/note collection", id: "ui-next-business-note-collection", component: CollectionFixture, parameters: { layout: "fullscreen" } } satisfies Meta<typeof CollectionFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const H5: Story = { decorators: [Story => <div style={{ maxWidth: 390, marginInline: "auto" }}><Story /></div>] };
export const Home: Story = { args: { home: true } };
export const Loading: Story = { args: { loading: true } };
export const EmptyCollection: Story = { args: { empty: true } };
export const ReadError: Story = { args: { error: true } };
export const ColoredTags: Story = {
  render: () => <TagColorProvider vaultId="ui-next-collection-color-story"><TagColorStyles /><CollectionFixture /></TagColorProvider>,
  beforeEach: () => {
    const key = "memocard:tag-colors:ui-next-collection-color-story";
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify({ "area/coffee": "blue" }));
    return () => { if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous); };
  },
  play: async ({ canvasElement }) => {
    const tag = await within(canvasElement).findByRole("button", { name: "筛选标签 area/coffee" });
    const probe = canvasElement.ownerDocument.createElement("span");
    probe.style.cssText = "color:var(--color-text-blue);background:var(--color-background-blue)";
    canvasElement.append(probe);
    await expect(getComputedStyle(tag).color).toBe(getComputedStyle(probe).color);
    await expect(getComputedStyle(tag).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    probe.remove();
  },
};
