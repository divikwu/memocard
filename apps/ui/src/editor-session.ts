import { inlineTags } from './inline-tags';
import type { Note, PropertyChange, PropertyUpdateResult } from '@memocard/contracts';
import type { Draft } from './bridge';
import { createId } from './uuid';

type Transport = <T>(operation: string, params?: Record<string, unknown>) => Promise<T>;
export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'indexing';
const key = (draft: Draft) => JSON.stringify([draft.title, draft.body, draft.tags, draft.inheritedTags, draft.relativePath]);
export const conflictError = (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && ['REVISION_CONFLICT', 'HASH_CONFLICT', 'SOURCE_CONFLICT', 'NOTE_NOT_FOUND', 'NOTE_DELETED'].includes(String(error.code)));
const rejectedConversion = (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'LOSSY_PROPERTY_CONVERSION');

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
  private propertyRecovery = false;
  private definitionHash?: string;
  private draftSession = createId();
  constructor(initial: Draft, private transport: Transport, private canDraft: boolean, private notify: () => void, private committed: (note: Note) => void, private isolateDrafts = false) {
    const inheritedTags = !initial.baseHash ? initial.inheritedTags ?? (!initial.body.trim() ? initial.tags : []) : [];
    this.current = { ...initial, ...(inheritedTags.length ? { inheritedTags } : {}), tags: inlineTags(initial.body), relativePath: initial.relativePath ?? `notes/${initial.id}.md` };
    if (isolateDrafts) this.current = {...this.current,draftKey:`${this.draftSession}:${initial.id}`,recoveredFrom:initial.updatedAt && initial.revision ? {draftKey:initial.draftKey ?? initial.id,revision:initial.revision,...(initial.unscoped ? {unscoped:true,...(initial.recoveryScope ? {scope:initial.recoveryScope} : {})} : {})} : undefined};
    this.hadRecovery = Boolean(initial.updatedAt);
    this.propertyRecovery = Boolean(initial.pendingProperties?.length);
    this.persisted = initial.baseHash && !initial.updatedAt ? key(this.current) : '';
  }
  private get bodyDirty() { return key(this.current) !== this.persisted && Boolean(this.current.baseHash || this.current.title?.trim() || this.current.body.trim()); }
  get dirty() { return this.bodyDirty || Boolean(this.current.pendingProperties?.length); }
  private emit() { if (!this.disposed) this.notify(); }
  private failed(error: unknown) {
    const indexing = Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'INDEXING');
    this.error = indexing ? null : error;
    this.state = indexing ? 'indexing' : conflictError(error) ? 'conflict' : 'error';
    if (indexing && !this.disposed) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { void this.save().catch(() => undefined); }, 1000);
    }
    this.emit();
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.catch(() => undefined).then(work);
    this.tail = result;
    return result;
  }
  update(body: string, relativePath = this.current.relativePath, title = this.current.title) {
    this.current = { ...this.current, body, tags: inlineTags(body), relativePath, ...(title === undefined ? {} : { title }) };
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
      if (this.dirty || key(this.current) !== this.persisted) await this.transport('saveDraft', this.params(this.current));
    });
  }
  private params(draft: Draft): Record<string, unknown> {
    const { id, title, baseHash, relativePath, vaultBinding, draftKey, recoveredFrom } = draft;
    const empty = !baseHash && !title?.trim() && !draft.body.trim();
    const body = empty ? '' : draft.body, tags = empty ? [] : draft.tags;
    const pendingProperties = draft.pendingProperties?.map(change => ({ ...change, id, baseHash: baseHash ?? '' }));
    return { ...(pendingProperties?.length ? { pendingProperties } : {}), id, ...(title === undefined ? {} : { title }), body, tags, ...(!empty && draft.inheritedTags?.length ? { inheritedTags: draft.inheritedTags } : {}), baseHash, relativePath, ...(vaultBinding ? { vaultBinding } : {}), ...(draftKey ? { draftKey } : {}), ...(recoveredFrom ? {recoveredFrom} : {}) };
  }
  changeProperty(change: PropertyChange): Promise<void> {
    this.current = { ...this.current, pendingProperties: [...this.current.pendingProperties ?? [], structuredClone(change)] };
    this.propertyRecovery = true;
    this.emit();
    // Preserve intent before attempting any source write. A failed intent stays at the head.
    void this.recover().catch(error => { this.error = error; this.state = 'error'; this.emit(); });
    return this.enqueue(async () => {
      // Rejected conversions are retired; write and recovery failures still need an explicit retry.
      if (this.state === 'conflict' || (this.state === 'error' && !rejectedConversion(this.error))) throw this.error;
      await this.drain(true);
    });
  }
  private async saveBody(): Promise<void> {
    if (!this.bodyDirty) return;
    const snapshot = { ...this.current };
    this.writing = true;
    this.state = 'saving'; this.emit();
    try {
      if (this.canDraft) await this.transport('saveDraft', this.params(snapshot));
      const note = await this.transport<Note>('saveNote', {...this.params(snapshot), deferWhileIndexing: true});
      const path = note.relativePath ?? snapshot.relativePath;
      const title = note.title ?? snapshot.title, body = note.body ?? snapshot.body;
      this.persisted = key({ ...snapshot, title, body, inheritedTags: undefined, relativePath: path });
      this.current = { ...this.current, title: this.current.title === snapshot.title ? title : this.current.title, body: this.current.body === snapshot.body ? body : this.current.body, inheritedTags: undefined, relativePath: this.current.relativePath === snapshot.relativePath ? path : this.current.relativePath, baseHash: note.contentHash };
      this.hadRecovery = this.dirty;
      this.state = this.dirty ? 'idle' : 'saved'; this.error = null;
      // The source bridge removes only the matching recovery. Restore the newest version immediately.
      if (this.dirty && this.canDraft) await this.transport('saveDraft', this.params(this.current));
      if (this.bodyDirty && !this.disposed) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => { void this.save().catch(() => undefined); }, 650);
      }
      if (!this.disposed) this.committed(note);
      this.emit();
    } catch (error) {
      this.failed(error); throw error;
    } finally { this.writing = false; }
  }
  private async drain(oneProperty = false): Promise<void> {
    if (this.state === 'conflict') throw this.error;
    if (!this.dirty && !this.propertyRecovery) return;
    try {
      while (this.dirty) {
        await this.saveBody();
        const change = this.current.pendingProperties?.[0];
        if (!change) break;
        if (!this.current.baseHash) throw new Error('请先填写标题或正文并保存。');
        this.state = 'saving'; this.emit();
        if (this.canDraft) await this.transport('saveDraft', this.params(this.current));
        // A prior transaction may have advanced both the note and definition versions.
        let saved:PropertyUpdateResult;
        try { saved = await this.transport<PropertyUpdateResult>('updateNoteProperty', {
          ...change, ...(this.definitionHash && change.definitionHash ? { definitionHash: this.definitionHash } : {}),
          id: this.current.id, baseHash: this.current.baseHash, deferWhileIndexing: true,
          ...(this.current.vaultBinding ? { vaultBinding: this.current.vaultBinding } : {}),
        }); } catch (error) {
          if (rejectedConversion(error)) {
            // The backend guarantees rejection before any source or schema changes.
            this.current = {...this.current,pendingProperties:this.current.pendingProperties!.slice(1)};
            if (this.canDraft) await this.transport('saveDraft',this.params(this.current));
          }
          throw error;
        }
        this.definitionHash = saved.propertyData?.definitionHash;
        this.current = { ...this.current, baseHash: saved.contentHash, pendingProperties: this.current.pendingProperties!.slice(1).map(pending => pending.definitionHash && this.definitionHash ? {...pending,definitionHash:this.definitionHash} : pending) };
        // Never replace current body/title with the snapshot from a property response.
        if (!this.disposed) this.committed(saved);
        this.emit();
        if (this.canDraft) await this.transport('saveDraft', this.params(this.current));
        if (oneProperty) break;
      }
      if (!this.dirty && this.propertyRecovery && this.canDraft) {
        await this.transport('saveDraft', { ...this.params(this.current), pendingProperties: [], title: '', body: '', tags: [], baseHash: null });
      }
      if (!this.dirty) { this.propertyRecovery = false; this.hadRecovery = false; }
      this.state = this.dirty ? 'idle' : 'saved'; this.error = null; this.emit();
    } catch (error) {
      this.failed(error); throw error;
    }
  }
  save(): Promise<void> {
    clearTimeout(this.timer);
    return this.enqueue(() => this.drain());
  }
  async flush() {
    await this.save();
    // Input may have changed while the first write was in flight.
    while (this.dirty) await this.save();
  }
  replace(initial: Draft, clearRecovery = false) {
    clearTimeout(this.timer);
    if (this.isolateDrafts) initial = {...initial,draftKey:`${this.draftSession}:${initial.id}`,recoveredFrom:initial.id === this.current.id ? this.current.recoveredFrom : undefined};
    this.current = { ...initial, tags: inlineTags(initial.body) };
    this.persisted = initial.baseHash && !clearRecovery ? key(this.current) : '';
    this.hadRecovery = clearRecovery;
    this.propertyRecovery = Boolean(initial.pendingProperties?.length);
    this.definitionHash = undefined;
    this.state = 'idle'; this.error = null; this.emit();
  }
  activate() { this.disposed = false; }
  dispose() { this.disposed = true; clearTimeout(this.timer); }
}
