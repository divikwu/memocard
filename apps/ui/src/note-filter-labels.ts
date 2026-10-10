import type { NoteQuickFilter } from "@memocard/contracts";

export const noteFilterLabels: Record<NoteQuickFilter, string> = { untagged: "无标签", images: "有图片", links: "有链接" };
export const noteFilterEmptyTitles: Record<NoteQuickFilter, string> = { untagged: "所有笔记都已添加标签", images: "还没有包含图片的笔记", links: "还没有包含链接的笔记" };
