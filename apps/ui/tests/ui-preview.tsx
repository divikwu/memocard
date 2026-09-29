// Development-only visual fixture. All data stays in memory; no vault files are read or written.
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../src/features/theme/ThemeProvider";
import "../src/styles.css";
const note = { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", body: "# 给想法留一点空间\n\n这是 UI 验收的模拟笔记。支持 **Markdown**、[链接](https://example.com) 和多级标签。\n\n- 整理灵感\n- 继续写作", tags: ["工作/设计", "生活"], relativePath: "notes/设计/灵感.md", createdAt: "2026-09-29T08:00:00Z", updatedAt: "2026-09-29T08:00:00Z", contentHash: "fixture" };
const coverage = { complete: true, indexed: 1, pending: 0, issues: 0, indexedAt: note.updatedAt };
const capabilities = ["queryNotes", "getNote", "getDrafts", "listTags", "saveNote", "saveDraft", "selectVault"];
window.webkit = { messageHandlers: { memocard: { postMessage: async message => {
  let data: unknown = {};
  switch (message.operation) {
    case "getEnvironment": data = { platform: "mac", phase: "M1", mcpEnabled: false, capabilities }; break;
    case "getStatus": data = { connected: true, vaultId: "ui-fixture", vaultName: "UI 验收 · 模拟数据", phase: "M1", syncState: "local", coverage, capabilities }; break;
    case "queryNotes": data = { notes: [note], nextCursor: null, coverage }; break;
    case "getNote": data = note; break;
    case "getDrafts": data = { drafts: [] }; break;
    case "listTags": data = { tags: ["工作", "工作/设计", "工作/设计/界面", "生活"].map(name => ({ name, count: 1 })) }; break;
    case "saveNote": Object.assign(note, message.params); data = note; break;
    case "selectVault": return {
      ok: false,
      error: {
        code: "PREVIEW_ONLY",
        message: "当前页面是 UI 模拟预览，不会打开或读写本地文件夹。请运行 memocard serve，并使用服务打开的页面。",
        retryable: false,
      },
    };
  }
  return { ok: true, data };
} } } };
const { App } = await import("../src/App");
createRoot(document.getElementById("root")!).render(<ThemeProvider><App /></ThemeProvider>);
