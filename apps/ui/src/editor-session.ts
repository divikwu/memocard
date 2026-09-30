import { inlineTags } from './inline-tags';
import type { Note } from '@memocard/contracts';
import type { Draft } from './bridge';

type Transport = <T>(operation: string, params?: Record<string, unknown>) => Promise<T>;
export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
const key = (draft: Draft) => JSON.stringify([draft.title, draft.body, draft.tags, draft.relativePath]);
export const conflictError = (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && ['REVISION_CONFLICT', 'HASH_CONFLICT', 'SOURCE_CONFLICT', 'NOTE_NOT_FOUND', 'NOTE_DELETED'].includes(String(error.code)));

/** One queue owns both recovery and source writes, so an old commit cannot erase newer recovery. */
export class EditorSession {
  current: Draft;
  state: SaveState = 'idle';
  error: unknown = null;
  private persisted: string;
  private tail: Promise<unknown> = Promise.resolve();
  private recoveryQueued = false;
  private hadRecovery = false;
  private timer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private writing = false;
  constructor(initial: Draft, private transport: Transport, private canDraft: boolean, private notify: () => void, private committed: (note: Note) => void) {
    this.current = { ...initial, relativePath: initial.relativePath ?? `notes/${initial.id}.md` };
    this.hadRecovery = Boolean(initial.updatedAt);
    this.persisted = initial.baseHash && !initial.updatedAt ? key(this.current) : '';
  }
  get dirty() { return key(this.current) !== this.persisted && Boolean(this.current.baseHash || this.current.title !== undefined || this.current.body.trim()); }
  private emit() { if (!this.disposed) this.notify(); }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.catch(() => undefined).then(work);
    this.tail = result;
    return result;
  }
  update(body: string, tags: string[], relativePath = this.current.relativePath, title = this.current.title) {
    this.current = { ...this.current, body, tags, relativePath, ...(title === undefined ? {} : { title }) };
    if (this.state !== 'conflict') this.state = this.dirty ? 'idle' : this.writing ? 'saving' : 'saved';
    this.emit();
    void this.recover().catch(error => { this.error = error; if (this.state !== 'conflict') this.state = 'error'; this.emit(); });
    clearTimeout(this.timer);
    if (this.dirty && this.state !== 'conflict') this.timer = setTimeout(() => { void this.save().catch(() => undefined); }, 650);
  }
  recover(): Promise<unknown> {
    if (!this.canDraft || (!this.dirty && !this.hadRecovery) || this.recoveryQueued) return this.tail;
    this.recoveryQueued = true;
    this.hadRecovery = true;
    return this.enqueue(async () => {
      this.recoveryQueued = false;
      if (key(this.current) !== this.persisted) await this.transport('saveDraft', this.params(this.current));
    });
  }
  private params(draft: Draft): Record<string, unknown> {
    const { id, title, body, tags, baseHash, relativePath, vaultBinding, draftKey } = draft;
    return { id, ...(title === undefined ? {} : { title }), body, tags, baseHash, relativePath, ...(vaultBinding ? { vaultBinding } : {}), ...(draftKey ? { draftKey } : {}) };
  }
  save(): Promise<void> {
    clearTimeout(this.timer);
    return this.enqueue(async () => {
      if (this.state === 'conflict') throw this.error;
      if (!this.dirty) return;
      const snapshot = { ...this.current };
      this.writing = true;
      this.state = 'saving'; this.emit();
      try {
        if (this.canDraft) await this.transport('saveDraft', this.params(snapshot));
        const note = await this.transport<Note>('saveNote', this.params(snapshot));
        const path = note.relativePath ?? snapshot.relativePath;
        // The file layer can retain independent YAML tags that also occurred in the body.
        const retained = (note.tags ?? []).filter(tag => !snapshot.tags.includes(tag) && !inlineTags(snapshot.body).includes(tag));
        this.persisted = key({ ...snapshot, tags: [...new Set([...snapshot.tags, ...retained])], relativePath: path });
        this.current = { ...this.current, tags: [...new Set([...this.current.tags, ...retained])], relativePath: this.current.relativePath === snapshot.relativePath ? path : this.current.relativePath, baseHash: note.contentHash };
        this.hadRecovery = this.dirty;
        this.state = this.dirty ? 'idle' : 'saved'; this.error = null;
        // The source bridge removes only the matching recovery. Restore the newest version immediately.
        if (this.dirty && this.canDraft) await this.transport('saveDraft', this.params(this.current));
        if (this.dirty && !this.disposed) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => { void this.save().catch(() => undefined); }, 650);
        }
        if (!this.disposed) this.committed(note);
        this.emit();
      } catch (error) {
        this.error = error; this.state = conflictError(error) ? 'conflict' : 'error'; this.emit(); throw error;
      } finally { this.writing = false; }
    });
  }
  async flush() {
    await this.save();
    // Input may have changed while the first write was in flight.
    while (this.dirty) await this.save();
  }
  replace(initial: Draft, clearRecovery = false) {
    clearTimeout(this.timer);
    this.current = initial;
    this.persisted = initial.baseHash && !clearRecovery ? key(initial) : '';
    this.hadRecovery = clearRecovery;
    this.state = 'idle'; this.error = null; this.emit();
  }
  activate() { this.disposed = false; }
  dispose() { this.disposed = true; clearTimeout(this.timer); }
}
