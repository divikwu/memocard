import type { Note, NotePage, NoteProperties, VaultStatus } from "@memocard/contracts";
import type { request } from "./bridge";
import { renamedTag } from './rename-tag';
import { inlineTagMatches, tagKey } from './inline-tags';

export function changeBodyTags(body:string, from:string, to:string | null) {
  let next = body;
  for (const match of inlineTagMatches(body).reverse()) {
    const renamed = to === null ? match.tag : renamedTag(match.tag, from, to);
    if (to === null ? match.tag !== tagKey(from) : renamed === match.tag) continue;
    // Deleting a tag keeps its visible name as ordinary text.
    const replacement = to === null ? body.slice(match.start + 1, match.end) : '#' + renamed;
    next = next.slice(0, match.start) + replacement + next.slice(match.end);
  }
  return next;
}
export function renameBodyTags(body:string, from:string, to:string) { return changeBodyTags(body, from, to); }
export function renameTag(from:string, to:string, vaultId:string, transport:typeof request) { return changeTag(from, to, vaultId, transport); }
export function deleteTag(from:string, vaultId:string, transport:typeof request) { return changeTag(from, null, vaultId, transport); }
async function changeTag(from:string, to:string | null, vaultId:string, transport:typeof request) {
  from = tagKey(from); to = to === null ? null : tagKey(to);
  const action = to === null ? '删除' : '重命名';
  const updateTags = (tags:string[]) => [...new Set(tags.flatMap(tag => to === null ? tagKey(tag) === from ? [] : [tag] : [renamedTag(tag, from, to)]))];
  if (to !== null) {
    if (!to || to.split('/').some(part => !/^[\p{L}\p{N}_-]+$/u.test(part)) || !/[\p{L}_/-]/u.test(to)) throw new Error('标签名称可包含文字、数字、下划线和连字符，使用 / 分隔层级。');
    if (from === to) return;
    if (to.startsWith(from + '/')) throw new Error('不能将标签移入自己的子级。');
    const listed = await transport<{ tags:{name:string}[] }>('listTags');
    if (listed.tags.some(tag => (tagKey(tag.name) === to || tagKey(tag.name).startsWith(to + '/')) && renamedTag(tag.name, from, to!) === tagKey(tag.name))) throw new Error('目标标签已存在，请使用其他名称。');
  }
  const notes: Note[] = [];
  let cursor: string | null = null;
  do {
    const page: NotePage = await transport("queryNotes", { tags: [from], limit: 100, ...(cursor ? { cursor } : {}) });
    if (!page.coverage.complete) throw new Error(`请等待笔记库完整读取后再${action}。`);
    notes.push(...page.notes); cursor = page.nextCursor;
  } while (cursor);
  let saved = 0;
  let propertySaved = false;
  try {
    for (const note of notes) {
      const status = await transport<VaultStatus>("getStatus");
      if (status.vaultId !== vaultId) throw new Error(`笔记库已切换，已停止${action}。`);
      let current = await transport<Note & { vaultBinding?: string }>("getNote", { id: note.id });
      if (current.contentHash !== note.contentHash) throw new Error("笔记已在其他位置修改，请重新尝试。");
      const fields = await transport<NoteProperties>('getNoteProperties', {id:note.id});
      if (fields.contentHash !== note.contentHash) throw new Error("笔记已在其他位置修改，请重新尝试。");
      const propertyTags = Array.isArray(fields.tagProperty?.value) ? fields.tagProperty.value : [];
      const next = updateTags(propertyTags);
      propertySaved = false;
      if (JSON.stringify(next) !== JSON.stringify(propertyTags)) {
        if (!fields.tagProperty?.editable) throw new Error('此笔记的 YAML 标签需在源文件中修改。');
        const updated = await transport<Note>('updateNoteProperty', {id:note.id,name:'tags',type:'list',value:next,baseHash:current.contentHash,...(current.vaultBinding ? {vaultBinding:current.vaultBinding} : {})});
        current = {...current,...updated}; propertySaved = true;
      }
      const body = changeBodyTags(note.body, from, to);
      if (body !== note.body) {
        const active = await transport<VaultStatus>('getStatus');
        if (active.vaultId !== vaultId) throw new Error(`笔记库已切换，已停止${action}。`);
        await transport("saveNote", { id: note.id, body, tags: updateTags(note.tags), baseHash: current.contentHash, relativePath: current.relativePath, ...(current.vaultBinding ? { vaultBinding: current.vaultBinding } : {}) });
      }
      saved++;
      propertySaved = false;
    }
  } catch (error) {
    throw new Error(`已更新 ${saved}/${notes.length} 篇笔记，${action}已停止。${propertySaved ? '当前笔记的属性标签已更新，正文尚未更新。' : ''}${error instanceof Error ? error.message : "请检查笔记库状态。"}`);
  }
}
