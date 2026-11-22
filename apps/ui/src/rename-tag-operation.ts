import type { Note, NotePage, NoteProperties } from "@memocard/contracts";
import type { request } from "./bridge";
import { renamedTag } from './rename-tag';
import { inlineTagMatches, tagKey } from './inline-tags';
import { getTagAppearance, requireTagAppearanceReady, setTagAppearance, type TagAppearance, type TagScope } from './tag-settings';

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
type RenameBatch = { pending: Set<string>; attempted: Set<string>; total: number };
const renameBatches = new Map<string, RenameBatch>();
const activeVaults = new Set<string>();

export function renameTag(from:string, to:string, vault:TagScope, transport:typeof request) {
  return changeTag(from, to, vault, transport);
}
export function deleteTag(from:string, vault:TagScope, transport:typeof request) {
  return changeTag(from, null, vault, transport);
}

export async function renameTagWithAppearance(scope: TagScope, from: string, to: string, rename: () => Promise<void>, save: TagAppearance["save"]) {
  const source = tagKey(from), target = tagKey(to);
  const key = JSON.stringify([scope.vaultId, scope.vaultBinding, source, target]);
  const pending = getTagAppearance(key);
  if (pending) return retryTagAppearance(pending);
  requireTagAppearanceReady(scope, source, target);
  const appearance = {...scope, key, source, target, save};
  const request = Promise.resolve().then(rename).then(() => persistTagAppearance(appearance), error => {
    setTagAppearance(key);
    throw error;
  });
  setTagAppearance(key, {...appearance, request});
  return request;
}

export function retryTagAppearance(appearance: TagAppearance): Promise<void> {
  const current = getTagAppearance(appearance.key);
  if (!current) return Promise.resolve();
  if (current.request) return current.request;
  const request = persistTagAppearance(current);
  setTagAppearance(current.key, {...current, request});
  return request;
}

function persistTagAppearance(appearance: TagAppearance) {
  return Promise.resolve().then(appearance.save).then(() => {
    setTagAppearance(appearance.key);
  }, cause => {
    const error = new Error('标签已改名，外观设置未能保存。请重试标签外观。', {cause});
    setTagAppearance(appearance.key, {...appearance, error});
    throw error;
  });
}

async function taggedNotes(tag: string, vault: TagScope, transport: typeof request, action: string) {
  const notes: Note[] = [];
  let cursor: string | null = null;
  do {
    const page: NotePage = await transport('queryNotes', {...vault, tags:[tag], exactTags:true, limit:100, ...(cursor ? {cursor} : {})});
    if (!page.coverage.complete) throw new Error(`请等待笔记库完整读取后再${action}。`);
    notes.push(...page.notes);
    cursor = page.nextCursor;
  } while (cursor);
  return notes;
}

async function changeTag(from:string, to:string | null, vault:TagScope, transport:typeof request) {
  from = tagKey(from); to = to === null ? null : tagKey(to);
  const action = to === null ? '删除' : '重命名';
  if (to !== null && (!to || !/^[\p{L}\p{N}_-]+$/u.test(to) || !/[\p{L}_-]/u.test(to))) {
    throw new Error('标签名称可包含文字、数字、下划线和连字符，不能包含 / 或使用纯数字。');
  }
  if (from === to) return;
  if (!vault.vaultBinding) throw new Error('无法确认当前笔记库，请重新连接后再编辑标签。');
  if (to === null) requireTagAppearanceReady(vault, from);
  const key = to === null ? undefined : JSON.stringify([vault.vaultId, vault.vaultBinding, from, to]);
  if (activeVaults.has(vault.vaultBinding)) throw new Error('请等待当前标签操作完成。');
  activeVaults.add(vault.vaultBinding);
  try {
    const previous = key ? renameBatches.get(key) : undefined;
    if (to !== null) {
      const listed = await transport<{tags:{name:string}[]}>('listTags', {...vault, flat:true});
      if (listed.tags.some(tag => tagKey(tag.name) === to)) {
        const destinations = previous ? await taggedNotes(to, vault, transport, action) : [];
        if (!previous || destinations.some(note => !previous.attempted.has(note.id))) {
          throw new Error('目标标签已存在，请使用其他名称。');
        }
      }
    }
    const notes = await taggedNotes(from, vault, transport, action);
    const sourceIds = new Set(notes.map(note => note.id));
    const batch = previous ?? {pending:sourceIds, attempted:new Set<string>(), total:notes.length};
    // A write may have committed before its reply was lost. Reread the remaining
    // source tag in the original batch before making any additional changes.
    if (previous) for (const id of batch.pending) if (!sourceIds.has(id)) batch.pending.delete(id);
    const updateTags = (tags:string[]) => [...new Set(tags.flatMap(tag => to === null ? tagKey(tag) === from ? [] : [tag] : [renamedTag(tag, from, to)]))];
    let propertySaved = false;
    try {
      for (const note of notes) {
        if (!batch.pending.has(note.id)) continue;
        const current = await transport<Note>('getNote', {...vault, id:note.id});
        if (current.contentHash !== note.contentHash) throw new Error('笔记已在其他位置修改，请重新尝试。');
        const fields = await transport<NoteProperties>('getNoteProperties', {...vault, id:note.id});
        if (fields.contentHash !== note.contentHash) throw new Error('笔记已在其他位置修改，请重新尝试。');
        const propertyTags = Array.isArray(fields.tagProperty?.value) ? fields.tagProperty.value : [];
        const next = updateTags(propertyTags);
        const changingProperty = JSON.stringify(next) !== JSON.stringify(propertyTags);
        const body = changeBodyTags(note.body, from, to);
        if (changingProperty && !fields.tagProperty?.editable) throw new Error('此笔记的 YAML 标签需在源文件中修改。');
        if (key && (changingProperty || body !== note.body)) {
          batch.attempted.add(note.id);
          renameBatches.set(key, batch);
        }
        let baseHash = current.contentHash;
        if (changingProperty) {
          const updated = await transport<Note>('updateNoteProperty', {...vault, id:note.id, name:'tags', type:'list', value:next, baseHash});
          baseHash = updated.contentHash;
          propertySaved = true;
        }
        if (body !== note.body) {
          await transport('saveNote', {...vault, id:note.id, body, tags:updateTags(note.tags), baseHash, relativePath:current.relativePath});
        }
        batch.pending.delete(note.id);
        propertySaved = false;
      }
      if (key) renameBatches.delete(key);
    } catch (error) {
      const partial = propertySaved ? '当前笔记的属性标签已更新，正文尚未更新。' : '';
      const resume = key && renameBatches.has(key) ? '可在此页面使用相同名称继续。' : '';
      throw new Error(`已更新 ${batch.total - batch.pending.size}/${batch.total} 篇笔记，${action}已停止。${partial}${error instanceof Error ? error.message : '请检查笔记库状态。'}${resume}`, {cause:error});
    }
  } finally {
    activeVaults.delete(vault.vaultBinding);
  }
}
