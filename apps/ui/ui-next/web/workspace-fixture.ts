import type { Note, NotePage, NotePins, TagPreferenceState, TrashItem, VaultStatus } from "@memocard/contracts";
import { createPreviewMock } from "../../ui-state-fixtures/mock";
import type { DraftList, Environment } from "../../src/bridge";
import { editorContentReview } from "../../stories/editor-content.fixture";

// Entirely in-memory backend used by the integrated page stories and regression tests.
export async function createWorkspaceFixture(scenario = "loading") {
  const review = scenario.startsWith("review-");
  const base = createPreviewMock(review ? "loading" : scenario);
  const seeds = [
    ["今天的手冲记录", "## 浅烘豆的另一种冲法\n\n水温 92°C，粉水比 **1:15**。记下一点日常的小发现。\n\n- 清晰的柑橘香气\n- 下次尝试更粗的研磨\n\n#生活/咖啡", ["生活/咖啡"]],
    ["让设计语言走进真实页面", "标题与正文有各自的节奏，组件共享颜色、字体与圆角。\n\n> 每一个小变化，都应该有清楚的理由。\n\n#设计 #MemoCard", ["设计", "MemoCard"]],
    ["Weekend reading list", "A short list of ideas worth returning to.\n\n1. Keep useful notes close.\n2. Make room for unfinished thoughts.\n3. Revisit what matters.\n\n#阅读", ["阅读"]],
    ["在阳台上留一点绿色", "新长出的叶子比想象中更快。周末记得换盆，给植物留出新的空间。\n\n#生活/植物", ["生活/植物"]],
    ["", "有时先把想法写下来，标题可以晚一点再说。", []],
    ["接下来想做的小事", "- [ ] 整理旅行照片\n- [ ] 听完新收藏的专辑\n- [x] 给自己留下一段空闲\n\n#计划 #生活", ["计划", "生活"]],
  ] as const;
  if (scenario === "loading" || review) {
    const existing = base.snapshot().notes;
    for (const [index, seed] of seeds.entries()) {
      await base.request("saveNote", { ...existing[index], title: seed[0], body: seed[1], tags: seed[2], inheritedTags: [] });
      await base.request("updateNoteProperty", { id: existing[index].id, name: "tags", type: "list", value: [...seed[2]] });
    }
  }
  let pins: NotePins = { pins: {}, contentHash: "fixture-pins-0" };
  let preferences: TagPreferenceState = { pinned: ["设计"], icons: { "生活": "🌱", "阅读": "📚" }, initialized: true, contentHash: "fixture-tags-0" };
  const removed = new Map<string, Note>();
  const deletedDrafts = new Set<string>();
  const trash: TrashItem[] = [];
  const extra = ["getNotePins", "setNotePinned", "getTagPreferences", "setTagPreferences", "deleteNote", "deleteDraft", "getTrash", "getTrashedNote", "restoreNote"];
  const reviewTime = "2026-10-12T09:00:00.000Z";
  if (scenario.startsWith("review-trash")) extra.push("permanentlyDeleteNote");
  if (scenario === "review-editor") {
    const note = base.snapshot().notes.find(note => note.title === "今天的手冲记录")!;
    await base.request("saveNote", { ...note, body: `${note.body}\n\n> 逐状态对照：保留原有编辑与保存行为。\n\n- [ ] 待办事项\n- [x] 已完成事项\n\n\`\`\`ts\nconst message = "MemoCard";\n\`\`\`\n\n| 项目 | 状态 | 平台 | 属性 | 正文 | 保存 | 撤销 | 预览 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| 编辑器 | 同状态对照 | Web/H5 | 保留 | 保留 | 校验 | 保留 | 保留 |\n\n[示例链接](https://example.com) 与 [[Weekend reading list]]\n\n${editorContentReview}\n\n${"这是一段用于验证长文档滚动、光标定位和窄屏换行的文字。".repeat(24)}` });
  }
  if (scenario.startsWith("review-trash")) {
    const notes = base.snapshot().notes;
    const coffee = notes.find(note => note.title === "今天的手冲记录")!;
    const long = notes.find(note => note.title === "让设计语言走进真实页面")!;
    const longNote = await base.request<Note>("saveNote", { ...long, title: "用于检查长标题截断和回收站预览的笔记".repeat(4), relativePath: `notes/${"较长的多级文件夹/".repeat(8)}设计语言.md` });
    for (const note of [coffee, longNote]) { removed.set(note.id, note); trash.push({ ...note, trashKey: `trash-${note.id}`, preview: note.body.slice(0, 120), deletedAt: reviewTime }); }
  }
  let trashReads = 0;
  async function request<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
    let result: unknown;
    switch (operation) {
      case "getStatus": { const status = await base.request<VaultStatus>(operation, params); result = { ...status, vaultName: "我的笔记库", capabilities: [...new Set([...status.capabilities, ...extra])] }; break; }
      case "getEnvironment": { const env = await base.request<Environment>(operation, params); result = { ...env, platform: "web", storage: "browser", capabilities: [...new Set([...env.capabilities, ...extra])] }; break; }
      case "queryNotes": {
        // Search review stories start on #/notes, whose collection requests omit sort.
        const searchQuery = params.limit === 30 && params.sort === "updatedAt";
        if (searchQuery && scenario === "review-search-loading") return new Promise<T>(() => {});
        if (searchQuery && scenario === "review-search-error") throw Object.assign(new Error("预览搜索读取失败"), { code: "IO_ERROR" });
        const page = await base.request<NotePage>(operation, params);
        const all = page.notes.filter(note => !removed.has(note.id));
        const matchesTag = (note: Note, tag: string) => note.tags.some(value => value === tag || value.startsWith(`${tag}/`));
        const filtered = all.filter(note => (!params.pinned || pins.pins[note.id]) && (!Array.isArray(params.tags) || params.tags.every(tag => matchesTag(note, String(tag)))) && (params.quickFilter !== "untagged" || !note.tags.length) && (params.quickFilter !== "images" || /!\[|<img/.test(note.body)) && (params.quickFilter !== "links" || /https?:|\[\[/.test(note.body)));
        const paged = scenario === "review-search" && searchQuery;
        result = { ...page, notes: paged ? params.cursor ? filtered.slice(2) : filtered.slice(0, 2) : filtered, nextCursor: paged && !params.cursor && filtered.length > 2 ? "review-search-page-2" : null, filterCounts: { untagged: all.filter(note => !note.tags.length).length, images: 0, links: 0 } }; break;
      }
      case "getNotePins": result = pins; break;
      case "setNotePinned": { const id = String(params.id); const next = { ...pins.pins }; if (params.pinned) next[id] = reviewTime; else delete next[id]; pins = { pins: next, contentHash: `${pins.contentHash}+` }; result = pins; break; }
      case "getTagPreferences": result = preferences; break;
      case "setTagPreferences": preferences = { ...preferences, pinned: params.pinned as string[], icons: params.icons as Record<string, string>, contentHash: `${preferences.contentHash}+` }; result = preferences; break;
      case "getDrafts": { const value = await base.request<DraftList>(operation, params); result = { ...value, drafts: value.drafts.filter(draft => !deletedDrafts.has(draft.draftKey ?? draft.id)), unscopedDrafts: (value.unscopedDrafts ?? []).filter(draft => !deletedDrafts.has(draft.draftKey ?? draft.id)) }; break; }
      case "deleteDraft": deletedDrafts.add(String(params.draftKey ?? params.id)); result = {}; break;
      case "deleteNote": { const note = await base.request<Note>("getNote", params); removed.set(note.id, note); trash.push({ ...note, trashKey: `trash-${note.id}`, preview: note.body.slice(0, 120), deletedAt: reviewTime }); result = {}; break; }
      case "getTrash": {
        trashReads++;
        if (scenario === "review-trash-loading" || scenario === "review-trash-refresh" && trashReads > 1) return new Promise<T>(() => {});
        if (scenario === "review-trash-error") throw Object.assign(new Error("预览回收站读取失败"), { code: "IO_ERROR" });
        result = { notes: trash, issues: scenario === "review-trash-issues" ? [{ path: ".memocard/trash/无法读取的记录.json", message: "预览损坏记录，原文件保留。" }] : [] }; break;
      }
      case "getTrashedNote": { const item = trash.find(item => item.trashKey === params.trashKey)!; result = { ...item, note: removed.get(item.id) }; break; }
      case "restoreNote": { const index = trash.findIndex(item => item.trashKey === params.trashKey); const item = trash[index]; result = removed.get(item.id); removed.delete(item.id); trash.splice(index, 1); break; }
      case "permanentlyDeleteNote": { const index = trash.findIndex(item => item.trashKey === params.trashKey); if (index >= 0) trash.splice(index, 1); result = {}; break; }
      default: return base.request<T>(operation, params);
    }
    return structuredClone(result) as T;
  }
  return { request, snapshot: base.snapshot, calls: base.calls };
}
