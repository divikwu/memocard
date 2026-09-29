import { expect, it, vi } from "vitest";
import type { Note } from "@memocard/contracts";
import { renameBodyTags, renameTag, renamedTag } from "./rename-tag";
import type { request } from "./bridge";
it("renames exact paths and descendants without changing code, links, or neighboring names", () => {
  const body = '#工作 #工作/设计 #工作室 #工作流\n`#工作`\n```md\n#工作/设计\n```\n[链接](page#工作)';
  expect(renameBodyTags(body, '工作', '职业')).toBe('#职业 #职业/设计 #工作室 #工作流\n`#工作`\n```md\n#工作/设计\n```\n[链接](page#工作)');
  expect(renamedTag('工作/设计/视觉', '工作', '职业')).toBe('职业/设计/视觉');
});
function transport(conflict = false) {
  const note: Note = { id: 'a', body: '#工作/设计', tags: ['工作/设计', '其他'], contentHash: 'hash', relativePath: 'Projects/a.md', createdAt: '', updatedAt: '', sourceUrl: '' };
  return vi.fn(async (operation: string, params?: Record<string, unknown>) => {
    if (operation === 'listTags') return { tags: [{ name: '工作' }] };
    if (operation === 'queryNotes') return { notes: [note], nextCursor: null, coverage: { complete: true } };
    if (operation === 'getStatus') return { vaultId: 'vault' };
    if (operation === 'getNote') return { ...note, contentHash: conflict ? 'changed' : 'hash', vaultBinding: 'binding' };
    if (operation === 'saveNote') return { ...note, ...params };
  });
}
it("uses existing conditional saves and keeps file paths and unrelated tags", async () => {
  const mock = transport();
  await renameTag('工作', '职业', 'vault', mock as typeof request);
  expect(mock).toHaveBeenCalledWith('saveNote', { id: 'a', body: '#职业/设计', tags: ['职业/设计', '其他'], baseHash: 'hash', relativePath: 'Projects/a.md', vaultBinding: 'binding' });
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
