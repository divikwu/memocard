// Development-only visual fixture. All data stays in memory; no vault files are read or written.
import { createRoot } from "react-dom/client";
import { WebAppearanceProvider } from "../ui-next/web/WebAppearance";
import "../ui-next/styles.css";
import { inlineTags } from "../src/inline-tags";
const fixture = new URLSearchParams(location.search).get("fixture");
const note = { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", title: "", body: "# 给想法留一点空间\n\n这是 UI 验收的模拟笔记。支持 **Markdown**、[链接](https://example.com) 和多级标签。\n\n- 整理灵感\n- 继续写作", tags: ["工作/设计", "生活"], relativePath: "notes/设计/灵感.md", createdAt: "2026-09-29T08:00:00Z", updatedAt: "2026-09-29T08:00:00Z", contentHash: "fixture" };
if (fixture === "block-range") note.body = "## 范围拖选验收\n\n- [ ] 第一条待办\n- [ ] 第二条待办\n- [ ] 第三条待办\n- [ ] 第四条待办\n\n末尾段落";
const gallerySamples = [
  { title: "今天的三件小事", body: "- [ ] 整理桌面上的笔记\n- [ ] 完成画廊布局的检查\n- [x] 出门走一走", tags: ["生活", "工作/设计"] },
  { title: "让内容成为界面的主角", body: "## 关于留白\n\n合适的留白让不同信息自然分组。标题给出方向，正文提供线索，标签帮助我们再次找到它。\n\n先把最重要的内容摆清楚，再决定需要多少装饰。", tags: ["工作/设计/界面"] },
  { title: "周末去海边", body: "找一条人少的路，带相机和一本书。\n\n- 早上出发\n- 午后喝咖啡\n- 日落前散步", tags: ["旅行", "生活"] },
  { title: "产品观察：记录应该足够轻松", body: "打开就能写，不需要先决定标题和分类。\n\n当一段内容值得留下时，再补充细节。好的工具应该能接住还没成形的想法。", tags: ["产品", "工作/设计"] },
  { title: "读书摘记", body: "> 注意力在哪里，生活就在哪里。\n\n读到这句话时，想起最近一直搁置的散步计划。每天留一点不被消息打断的时间。", tags: ["阅读", "生活"] },
  { title: "一闪而过的想法", body: "把零散的灵感收进同一个地方。", tags: [] },
  { title: "响应式画廊：从窄屏到超宽屏的内容组织与卡片布局观察", body: "观察同一组内容在不同窗口宽度下的变化：\n\n1. 标题始终与卡片左边缘对齐\n2. 列数根据实际可用宽度变化\n3. 少量内容也保持清晰的节奏\n4. 长标题不影响整行卡片的高度", tags: ["工作/设计/界面", "技术", "产品"] },
  { title: "下周工作清单", body: "- [ ] 补齐不同尺寸的页面截图\n- [ ] 复查键盘打开笔记\n- [ ] 检查标签筛选\n- [ ] 整理设计反馈\n- [ ] 记录待跟进的问题", tags: ["工作", "工作/设计"] },
  { title: "Markdown 小技巧", body: "用 **加粗** 标记重点，用列表整理思路。\n\n```css\ngrid-template-columns: repeat(auto-fill, minmax(320px, 1fr));\n```\n\n格式服务于阅读。", tags: ["技术"] },
  { title: "咖啡与一个安静的下午", body: "窗边的光慢慢移到桌面上。今天不赶时间，只想把最近想到的事情写下来。", tags: ["生活"] },
  { title: "关于笔记的回访", body: "一条笔记的价值不止在写下的那一刻。\n\n它可以成为下一次思考的起点，也可以只是帮我们记住当时的感受。\n\n保持简洁的预览，让回访不需要重新读完整篇内容。", tags: ["产品", "阅读"] },
  { title: "", body: "", tags: [] },
];
const notes = fixture === "gallery" ? gallerySamples.map((sample, index) => ({ ...note, ...sample, id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(index + 1).padStart(12, "0")}`, relativePath: `notes/模拟笔记-${index + 1}.md`, createdAt: new Date(Date.parse(note.createdAt) - index * 86400000).toISOString() })) : [note];
for (const item of notes) {
  if (item.tags.length) item.body += `\n\n${item.tags.map(name => `#${name}`).join(' ')}`;
  item.tags = inlineTags(item.body);
}
const coverage = { complete: true, indexed: notes.length, pending: 0, issues: 0, indexedAt: note.updatedAt };
const capabilities = ["queryNotes", "getNote", "getDrafts", "listTags", "saveNote", "saveDraft", "selectVault"];
window.webkit = { messageHandlers: { memocard: { postMessage: async message => {
  let data: unknown = {};
  switch (message.operation) {
    case "getEnvironment": data = { platform: "mac", phase: "M1", mcpEnabled: false, capabilities }; break;
    case "getStatus": data = { connected: true, vaultId: "ui-fixture", vaultName: "UI 验收 · 模拟数据", phase: "M1", syncState: "local", coverage, capabilities }; break;
    case "queryNotes": {
      const { query = "", tags = [] } = message.params as { query?: string; tags?: string[] };
      data = { notes: notes.filter(item => `${item.title}\n${item.body}`.toLowerCase().includes(query.toLowerCase()) && tags.every(tag => item.tags.some(name => name === tag || name.startsWith(`${tag}/`)))), nextCursor: null, coverage };
      break;
    }
    case "getNote": data = notes.find(item => item.id === message.params.id) ?? note; break;
    case "getDrafts": data = { drafts: [] }; break;
    case "listTags": data = { tags: [...new Set(notes.flatMap(item => item.tags.flatMap(name => name.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/')))))].map(name => ({ name, count: notes.filter(item => item.tags.some(tag => tag === name || tag.startsWith(`${name}/`))).length })) }; break;
    case "saveNote": { const saved = notes.find(item => item.id === message.params.id) ?? note; Object.assign(saved, message.params); saved.tags = inlineTags(saved.body); data = saved; break; }
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
createRoot(document.getElementById("root")!).render(<WebAppearanceProvider><App /></WebAppearanceProvider>);
