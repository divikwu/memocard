import type { Note, NotePage } from "@memocard/contracts";

export type SearchFixtureMode = "normal" | "loading" | "empty" | "retry-paging" | "paging";

export function createSearchFixture(mode: SearchFixtureMode) {
  const date = (days: number) => {
    const value = new Date();
    value.setHours(12, 0, 0, 0);
    value.setDate(value.getDate() - days);
    return value.toISOString();
  };
  const note = (id: string, title: string, body: string, days: number): Note => ({
    id, title, body, tags: ["示例"], relativePath: `fixtures/${id}.md`,
    createdAt: date(days + 7), updatedAt: date(days), contentHash: `storybook-${id}`, sourceUrl: "",
  });
  const notes = [
    note("search-plan", "项目计划", "## 实施安排\n\n这是项目计划正文，包含 **本周目标**。", 0),
    note("search-checklist", "计划清单", "## 交付清单\n\n这是计划清单正文。\n\n- 核对实现\n- 记录结果", 1),
    note("search-review", "计划复盘", "这是计划复盘正文，记录可验证的结果。", 3),
    note("search-walk", "周末散步", "这是周末散步正文，与项目关键词不同。", 9),
  ];
  const calls: { operation: string; params: Record<string, unknown> }[] = [];
  const page = (items: Note[], nextCursor: string | null = null): NotePage => ({
    notes: items, nextCursor,
    coverage: { complete: !nextCursor, indexed: items.length, pending: nextCursor ? 1 : 0, issues: 0, indexedAt: date(0) },
  });
  let release!: (result: NotePage) => void;
  const pending = new Promise<NotePage>(resolve => { release = resolve; });
  let initialAttempts = 0;
  let pagingAttempts = 0;
  return {
    notes, calls,
    releaseLoading: () => { release(page(notes)); return pending; },
    request: async (operation: string, params: Record<string, unknown>): Promise<NotePage> => {
      calls.push({ operation, params: { ...params } });
      if (operation !== "queryNotes") throw new Error(`Search fixture does not support: ${operation}`);
      if (mode === "loading" && params.query === "" && initialAttempts++ === 0) return pending;
      if (mode === "empty") return page([]);
      if (mode === "retry-paging" && !params.cursor && initialAttempts++ === 0) throw new Error("示例搜索读取失败");
      if (mode === "retry-paging" && params.cursor && pagingAttempts++ === 0) throw new Error("示例下一页读取失败");
      const query = String(params.query ?? "").toLocaleLowerCase();
      const source = mode === "paging" || mode === "retry-paging" ? notes.slice(0, 3) : notes;
      const matches = source.filter(item => `${item.title}\n${item.body}`.toLocaleLowerCase().includes(query));
      if (mode === "paging" || mode === "retry-paging") {
        return params.cursor ? page(matches.slice(2)) : page(matches.slice(0, 2), matches.length > 2 ? "search-page-2" : null);
      }
      return page(matches);
    },
  };
}
