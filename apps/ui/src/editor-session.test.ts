import { afterEach, expect, it, vi } from 'vitest';
import { EditorSession } from './editor-session';
import type { Draft } from './bridge';
const initial: Draft = { id: 'a', body: '', tags: [], baseHash: null, relativePath: 'notes/a.md' };
const note = { id: 'a', contentHash: 'new-hash' };
afterEach(() => vi.useRealTimers());
function setup(draft = initial) {
  const transport = vi.fn(async (op: string) => op === 'saveNote' ? note : undefined);
  const committed = vi.fn();
  const session = new EditorSession(draft, transport as never, true, vi.fn(), committed);
  return { session, transport, committed };
}
it('does not rewrite an untouched existing note, but saves an explicitly cleared body', async () => {
  const { session, transport } = setup({ ...initial, body: 'old', baseHash: 'original' });
  await session.flush(); expect(transport).not.toHaveBeenCalled();
  session.update('', []); await session.flush();
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: '', baseHash: 'original' }));
  session.dispose();
});
it('does not create a tag-only new note', async () => {
  const { session, transport } = setup(); session.update('', ['标签']); await session.flush(); expect(transport).not.toHaveBeenCalled(); session.dispose();
});
it('preserves newer recovery during an older commit and flushes with the returned hash', async () => {
  vi.useFakeTimers();
  const { session, transport, committed } = setup();
  let resolve!: (value: typeof note) => void;
  transport.mockImplementation(async op => op === 'saveNote' ? new Promise(r => { resolve = r; }) : undefined);
  session.update('first', []);
  const saving = session.save(); await vi.advanceTimersByTimeAsync(0);
  session.update('newer', ['tag']);
  resolve(note); await saving;
  expect(session.dirty).toBe(true); expect(session.state).toBe('idle');
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: 'newer', baseHash: 'new-hash' }));
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: 'newer', baseHash: 'new-hash' }));
  expect(session.dirty).toBe(false); expect(committed).toHaveBeenCalledTimes(2); session.dispose();
});
it('stops automatic conflict retries but continues to preserve edits', async () => {
  vi.useFakeTimers(); const { session, transport } = setup({ ...initial, baseHash: 'original' });
  transport.mockImplementation(async op => { if (op === 'saveNote') throw { code: 'REVISION_CONFLICT' }; });
  session.update('first', []); await vi.advanceTimersByTimeAsync(650);
  expect(session.state).toBe('conflict'); session.update('second', []); await vi.advanceTimersByTimeAsync(1000);
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(1);
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: 'second', baseHash: 'original' })); session.dispose();
});
it('retries the newest content after an in-flight save fails without advancing its hash', async () => {
  vi.useFakeTimers();
  const { session, transport } = setup({ ...initial, body: 'original', baseHash: 'original-hash' });
  let fail!: (reason: Error) => void;
  transport.mockImplementation(async op => op === 'saveNote' ? new Promise((_resolve, reject) => { fail = reject; }) : undefined);
  session.update('first', []);
  const saving = session.save();
  const result = expect(saving).rejects.toThrow('暂时不可写');
  await vi.advanceTimersByTimeAsync(0);
  session.update('newest', ['tag']);
  fail(new Error('暂时不可写')); await result; await session.recover();
  expect(session.current.baseHash).toBe('original-hash');expect(session.state).toBe('error');
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: 'newest', baseHash: 'original-hash' }));
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: 'newest', tags: ['tag'], baseHash: 'original-hash' }));
  expect(session.dirty).toBe(false);expect(session.state).toBe('saved');session.dispose();
});
it('automatically persists an undo back to the old baseline while a newer write is in flight', async () => {
  vi.useFakeTimers();
  const { session, transport } = setup({ ...initial, body: 'original order', baseHash: 'original' });
  let finish!: (value: typeof note) => void;
  transport.mockImplementation(async op => op === 'saveNote' ? new Promise(resolve => { finish = resolve; }) : undefined);
  session.update('moved order', []);
  await vi.advanceTimersByTimeAsync(650);
  session.update('original order', []);
  expect(session.state).toBe('saving');
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  finish(note);
  await vi.advanceTimersByTimeAsync(1000);
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(2);
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: 'moved order', baseHash: 'original' }));
  expect(transport).toHaveBeenCalledWith('saveNote', expect.objectContaining({ body: 'original order', baseHash: 'new-hash' }));
  expect(session.dirty).toBe(false);
  expect(session.state).toBe('saved');
  session.dispose();
});
it('keeps unknown source and literal tags intact', async () => {
  const { session, transport } = setup({ ...initial, body: '<!-- x -->\r\n\n[^a]: footnote\n', baseHash: 'original' });
  session.update(session.current.body, ['C#,F#', ' two words ']); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ body: '<!-- x -->\r\n\n[^a]: footnote\n', tags: ['C#,F#', ' two words '] })); session.dispose();
});
it('does not notify a replaced UI session after a late commit', async () => {
  const { session, committed } = setup(); session.update('pending', []); session.dispose(); await session.flush(); expect(committed).not.toHaveBeenCalled();
});
it('retires new-note recovery when the user clears the content before creating a file', async () => {
  const { session, transport } = setup(); session.update('temporary', []); await session.recover();
  session.update('', []); await session.recover(); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveDraft', expect.objectContaining({ body: '', baseHash: null }));
  expect(transport.mock.calls.filter(([op]) => op === 'saveNote')).toHaveLength(0); session.dispose();
});
it.each(['HASH_CONFLICT', 'SOURCE_CONFLICT', 'NOTE_DELETED', 'NOTE_NOT_FOUND'])('recognizes the actual bridge conflict %s', async code => {
  const { session, transport } = setup({ ...initial, baseHash: 'old' });
  transport.mockImplementation(async op => { if (op === 'saveNote') throw { code }; });
  session.update('new', []); await expect(session.flush()).rejects.toEqual({ code }); expect(session.state).toBe('conflict'); session.dispose();
});
it('retains independently stored tags returned by the file layer for subsequent saves', async () => {
  const transport = vi.fn(async (op: string) => op === 'saveNote' ? { ...note, tags: ['工作'] } : undefined);
  const session = new EditorSession({ ...initial, body: '#工作', tags: ['工作'], baseHash: 'old' }, transport as never, false, vi.fn(), vi.fn());
  session.update('删除正文标签', []); await session.flush();
  expect(session.current.tags).toEqual(['工作']); expect(session.dirty).toBe(false);
  session.update('继续输入', session.current.tags); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ tags: ['工作'] }));
  session.dispose();
});
it('keeps title edits made during initial empty-page creation and saves clearing both fields', async () => {
  let complete!: (value: unknown) => void;
  const transport = vi.fn(async (op: string) => op === 'saveNote' ? new Promise(resolve => { complete = resolve; }) : undefined);
  const session = new EditorSession({ ...initial, title: '' }, transport as never, true, vi.fn(), vi.fn());
  const saving = session.save();
  await vi.waitFor(() => expect(complete).toBeTypeOf('function'));
  session.update('正文', [], undefined, '标题'); complete(note); await saving;
  expect(session.current.title).toBe('标题'); expect(session.current.body).toBe('正文'); expect(session.dirty).toBe(true);
  transport.mockImplementation(async op => op === 'saveNote' ? note : undefined);
  await session.flush(); session.update('', [], undefined, ''); await session.flush();
  expect(transport).toHaveBeenLastCalledWith('saveNote', expect.objectContaining({ title: '', body: '', baseHash: 'new-hash' }));
  session.dispose();
});
