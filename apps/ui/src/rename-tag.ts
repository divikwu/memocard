import type { Note, NotePage, VaultStatus } from "@memocard/contracts";
import { request } from "./bridge";

export function renamedTag(tag: string, from: string, to: string) {
  return tag === from || tag.startsWith(from + "/") ? to + tag.slice(from.length) : tag;
}

export function renameBodyTags(body: string, from: string, to: string) {
  // Preserve code verbatim, using the same exclusions as the vault's inline tag index.
  const code = /(^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\2\3[^\n]*$)|(`+[^`\n]*`+)/gm;
  const ranges = [...body.matchAll(code)].map(match => [match.index!, match.index! + match[0].length]);
  return body.replace(/(^|[\s(])#([\p{L}\p{N}_/-]+)/gu, (match, prefix: string, tag: string, offset: number) => {
    if (ranges.some(([start, end]) => offset + prefix.length >= start && offset + prefix.length < end)) return match;
    return prefix + "#" + renamedTag(tag, from, to);
  });
}

export async function renameTag(from: string, to: string, vaultId: string, transport = request) {
  if (!to || to.split("/").some(part => !/^[\p{L}\p{N}_-]+$/u.test(part)) || !/[\p{L}_/-]/u.test(to)) throw new Error("标签名称可包含文字、数字、下划线和连字符，使用 / 分隔层级。");
  if (from === to) return;
  if (to.startsWith(from + "/")) throw new Error("不能将标签移入自己的子级。");
  const listed = await transport<{ tags: { name: string }[] }>("listTags");
  if (listed.tags.some(tag => (tag.name === to || tag.name.startsWith(to + "/")) && renamedTag(tag.name, from, to) === tag.name)) throw new Error("目标标签已存在，请使用其他名称。");
  const notes: Note[] = [];
  let cursor: string | null = null;
  do {
    const page: NotePage = await transport("queryNotes", { tags: [from], limit: 100, ...(cursor ? { cursor } : {}) });
    if (!page.coverage.complete) throw new Error("请等待笔记库完整读取后再重命名。");
    notes.push(...page.notes); cursor = page.nextCursor;
  } while (cursor);
  let saved = 0;
  try {
    for (const note of notes) {
      const status = await transport<VaultStatus>("getStatus");
      if (status.vaultId !== vaultId) throw new Error("笔记库已切换，已停止重命名。");
      const current = await transport<Note & { vaultBinding?: string }>("getNote", { id: note.id });
      if (current.contentHash !== note.contentHash) throw new Error("笔记已在其他位置修改，请重新尝试。");
      await transport("saveNote", { id: note.id, body: renameBodyTags(note.body, from, to), tags: [...new Set(note.tags.map(tag => renamedTag(tag, from, to)))], baseHash: note.contentHash, relativePath: note.relativePath, ...(current.vaultBinding ? { vaultBinding: current.vaultBinding } : {}) });
      saved++;
    }
  } catch (error) {
    throw new Error(`已更新 ${saved}/${notes.length} 篇笔记，重命名已停止。${error instanceof Error ? error.message : "请检查笔记库状态。"}`);
  }
}
