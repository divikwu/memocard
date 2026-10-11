import { expect, it, vi } from "vitest";
import type { Note } from "@memocard/contracts";
import { renamedTag } from "./rename-tag";
import { renameTag, renameBodyTags } from "./rename-tag-operation";
import type { request } from "./bridge";
it("renames exact paths and descendants without changing code, links, or neighboring names", () => {
  const body = '#工作 #工作/设计 #工作室 #工作流\n`#工作`\n```md\n#工作/设计\n```\n[链接](page#工作)';
  expect(renameBodyTags(body, '工作', '职业')).toBe('#职业 #职业/设计 #工作室 #工作流\n`#工作`\n```md\n#工作/设计\n```\n[链接](page#工作)');
  expect(renamedTag('工作/设计/视觉', '工作', '职业')).toBe('职业/设计/视觉');
});
it('renames all case variants while preserving unrelated spellings and code', () => {
  expect(renameBodyTags('#Work #work/Design #WORKSHOP `#Work`', 'WORK', 'Project')).toBe('#project #project/design #WORKSHOP `#Work`');
});
function transport(conflict = false) {
  const note: Note = { id: 'a', body: '#工作/设计', tags: ['工作/设计', '其他'], contentHash: 'hash', relativePath: 'Projects/a.md', createdAt: '', updatedAt: '', sourceUrl: '' };
  return vi.fn(async (operation: string, params?: Record<string, unknown>) => {
    if (operation === 'listTags') return { tags: [{ name: '工作' }] };
    if (operation === 'queryNotes') return { notes: [note], nextCursor: null, coverage: { complete: true } };
    if (operation === 'getStatus') return { vaultId: 'vault' };
    if (operation === 'getNote') return { ...note, contentHash: conflict ? 'changed' : 'hash', vaultBinding: 'binding' };
    if (operation === 'getNoteProperties') return {properties:[],contentHash:'hash',writable:true,tagProperty:{name:'tags',type:'list',value:[],editable:true}};
    if (operation === 'saveNote') return { ...note, ...params };
  });
}
it("uses existing conditional saves and keeps file paths and unrelated tags", async () => {
  const mock = transport();
  await renameTag('工作', '职业', 'vault', mock as typeof request);
  expect(mock).toHaveBeenCalledWith('saveNote', { id: 'a', body: '#职业/设计', tags: ['职业/设计', '其他'], baseHash: 'hash', relativePath: 'Projects/a.md', vaultBinding: 'binding' });
});
it('renames both sources and uses the updated property hash for the body write', async () => {
  const base = transport();
  const mock = vi.fn(async (operation:string,params?:Record<string,unknown>) => {
    if (operation === 'getNoteProperties') return {properties:[],contentHash:'hash',tagProperty:{value:['工作/设计','保留'],editable:true}};
    if (operation === 'updateNoteProperty') return {id:'a',body:'#工作/设计',contentHash:'property-hash',relativePath:'Projects/a.md'};
    return base(operation,params);
  });
  await renameTag('工作','职业','vault',mock as typeof request);
  expect(mock).toHaveBeenCalledWith('updateNoteProperty',expect.objectContaining({value:['职业/设计','保留'],baseHash:'hash',vaultBinding:'binding'}));
  expect(mock).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:'#职业/设计',baseHash:'property-hash',vaultBinding:'binding'}));
});
it('reports a partial rename if a body write conflicts after property tags were saved', async () => {
  const base = transport();
  const mock = vi.fn(async (operation:string,params?:Record<string,unknown>) => {
    if (operation === 'getNoteProperties') return {properties:[],contentHash:'hash',tagProperty:{value:['工作/设计'],editable:true}};
    if (operation === 'updateNoteProperty') return {contentHash:'property-hash'};
    if (operation === 'saveNote') throw new Error('文件冲突');
    return base(operation,params);
  });
  await expect(renameTag('工作','职业','vault',mock as typeof request)).rejects.toThrow('属性标签已更新，正文尚未更新');
});
it("does not overwrite a changed source", async () => {
  const mock = transport(true);
  await expect(renameTag('工作', '职业', 'vault', mock as typeof request)).rejects.toThrow('已更新 0/1');
  expect(mock.mock.calls.some(([op]) => op === 'saveNote')).toBe(false);
});
it("rejects malformed names before touching files", async () => {
  const mock = transport();
  await expect(renameTag('工作', '职业//设计', 'vault', mock as typeof request)).rejects.toThrow('标签名称');
  expect(mock).not.toHaveBeenCalled();
});

it('changes only indexed tags, preserving invalid tags and excluded Markdown verbatim', async () => {
  const { changeBodyTags } = await import('./rename-tag-operation');
  const protectedText = '`#Work`\n    #Work\n[ref #Work](file.md) [[#Work]] <i title="#Work"> $x #Work$\n```\n#Work\n';
  expect(renameBodyTags('#Work #Work/Design #Work//bad #/Work #123\n' + protectedText, 'work', 'project'))
    .toBe('#project #project/design #Work//bad #/Work #123\n' + protectedText);
  expect(changeBodyTags('#Work (#WORK) #work/design #workshop\n' + protectedText, 'work', null))
    .toBe('Work (WORK) #work/design #workshop\n' + protectedText);
});
it('deletes both sources without deleting notes, children, or unrelated properties', async () => {
  const { deleteTag } = await import('./rename-tag-operation');
  const base = transport();
  const mock = vi.fn(async (operation:string, params?:Record<string,unknown>) => {
    if (operation === 'queryNotes') return {notes:[{id:'a',body:'#Work #work/child',tags:['work','work/child'],contentHash:'hash'}],nextCursor:null,coverage:{complete:true}};
    if (operation === 'getNoteProperties') return {contentHash:'hash',tagProperty:{value:['WORK','work/child','other'],editable:true}};
    if (operation === 'updateNoteProperty') return {contentHash:'property-hash'};
    return base(operation,params);
  });
  await deleteTag('work','vault',mock as typeof request);
  expect(mock).toHaveBeenCalledWith('updateNoteProperty',expect.objectContaining({name:'tags',type:'list',value:['work/child','other'],baseHash:'hash'}));
  expect(mock).toHaveBeenCalledWith('saveNote',expect.objectContaining({body:'Work #work/child',tags:['work/child'],baseHash:'property-hash'}));
});
it('does not delete tags from an incomplete index or a switched vault', async () => {
  const { deleteTag } = await import('./rename-tag-operation');
  const base = transport();
  const incomplete = vi.fn(async (op:string,p?:Record<string,unknown>) => op === 'queryNotes' ? {notes:[],coverage:{complete:false}} : base(op,p));
  await expect(deleteTag('work','vault',incomplete as typeof request)).rejects.toThrow('完整读取');
  expect(incomplete).toHaveBeenCalledTimes(1);
  const switched = vi.fn(async (op:string,p?:Record<string,unknown>) => op === 'getStatus' ? {vaultId:'another'} : base(op,p));
  await expect(deleteTag('工作','vault',switched as typeof request)).rejects.toThrow('笔记库已切换');
  expect(switched.mock.calls.some(([op]) => op === 'saveNote' || op === 'updateNoteProperty')).toBe(false);
});
it('paginates before writing and stops deletion on a changed source', async () => {
  const { deleteTag } = await import('./rename-tag-operation');
  const base = transport(true);
  const mock = vi.fn(async (op:string,p?:Record<string,unknown>) => op === 'queryNotes' ? p?.cursor ? {notes:[],nextCursor:null,coverage:{complete:true}} : {...await base(op,p) as object,nextCursor:'next'} : base(op,p));
  await expect(deleteTag('工作','vault',mock as typeof request)).rejects.toThrow('已更新 0/1');
  expect(mock).toHaveBeenCalledWith('queryNotes',{tags:['工作'],limit:100,cursor:'next'});
  expect(mock.mock.calls.some(([op]) => op === 'saveNote' || op === 'updateNoteProperty')).toBe(false);
});

it('does not rewrite a tag identity formed by stripping embedded Markdown', () => {
  expect(renameBodyTags('a<em>#work</em> #wo<b>rk</b> #work', 'work', 'project')).toBe('a<em>#work</em> #wo<b>rk</b> #project');
});
