import { expect, it, vi } from 'vitest';
import type { Note } from '@memocard/contracts';
import { commitQuickCapture } from './quick-capture-operation';
const draft={id:'test',title:'',body:'想法 #阅读',tags:['阅读'],inheritedTags:['工作'],baseHash:null,vaultId:'vault-a'};
it('recognizes a committed source after a lost reply without creating a duplicate',async()=>{
  const saved={id:draft.id,body:draft.body,tags:['工作','阅读']} as Note;
  const transport=vi.fn().mockRejectedValueOnce({code:'TIMEOUT'}).mockResolvedValueOnce(saved);
  expect(await commitQuickCapture(draft,transport)).toBe(saved);
  expect(transport.mock.calls.map(([op])=>op)).toEqual(['saveNote','getNote']);
});
it('retains an ambiguous or conflicting write error when the source does not match',async()=>{
  const error={code:'HASH_CONFLICT'};
  const transport=vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce({id:draft.id,body:'另一个版本',tags:[]});
  await expect(commitQuickCapture(draft,transport)).rejects.toBe(error);
});
