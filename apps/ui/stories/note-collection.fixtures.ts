import type { Note } from "@memocard/contracts";

const note = (id: string, title: string, body: string, tags: string[], day: number): Note => ({
  id, title, body, tags, relativePath: `fixtures/${id}.md`, contentHash: `storybook-${id}`, sourceUrl: "",
  createdAt: `2026-10-${String(day).padStart(2, "0")}T08:00:00Z`,
  updatedAt: `2026-10-${String(day + 1).padStart(2, "0")}T08:00:00Z`,
});

export const collectionNotes = [
  note("collection-plan", "项目计划", "## 本周安排\n\n先完成 **浏览与筛选**，再检查打开笔记后的阅读体验。\n\n- 核对列表和卡片\n- 保留已有交互\n\n#产品 #写作 #思考", ["产品", "写作", "思考"], 12),
  note("collection-research", "阅读摘录", "## 阅读记录\n\n记录产品调研中值得继续验证的想法。\n\n> 让信息保持清晰，方便下次继续阅读。\n\n#产品", ["产品"], 11),
  note("collection-walk", "周末散步", "沿着河边慢慢走，记下傍晚的颜色和今天的小发现。\n\n#生活", ["生活"], 10),
  note("collection-review", "每周回顾", "## 已完成\n\n- [x] 整理笔记\n- [ ] 复盘本周的学习\n\n#学习", ["学习"], 9),
  note("collection-untitled", "", "还没来得及命名的一条记录，也可以从列表中打开。", [], 8),
];

export const pinnedCollectionIds = new Set(["collection-plan", "collection-walk"]);
export const formatCollectionDate = (value: string) => `${value.slice(5, 7)}月${value.slice(8, 10)}日 16:00`;
