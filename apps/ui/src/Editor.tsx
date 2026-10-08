import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inlineTags } from './inline-tags';
import { request, errorMessage, type Attachment, type Draft } from './bridge';
import type { Note } from '@memocard/contracts';
import { RichMarkdownEditor } from './RichMarkdownEditor';
import { EditorSession } from './editor-session';
import { createId } from './uuid';

export type EditorHandle = { flush: () => Promise<boolean> };
export function Editor({ initial, capabilities, pendingLink = false, onClose, onSaved, onCommitted, onTitleChange, handle }: {
  initial: Draft; capabilities: Set<string>; pendingLink?: boolean;
  onClose: () => void; onSaved: (note: Note) => void;
  onCommitted?: (note: Note) => void; onTitleChange?: (title: string | undefined) => void; handle?: React.RefObject<EditorHandle | null>;
}) {
  const field = useRef<HTMLDivElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const initialDraft = useRef(initial).current;
  const titleFirst = initialDraft.title !== undefined && !initialDraft.baseHash;
  const [, render] = useState(0);
  const [working, setWorking] = useState(false);
  const restoreImageFocus = useRef(false);
  const [localError, setLocalError] = useState('');
  const lastNote = useRef<Note | null>(null);
  const callbacks = useRef({ onCommitted, onTitleChange });
  callbacks.current = { onCommitted, onTitleChange };
  const [session] = useState(() => new EditorSession(initialDraft, request, capabilities.has('saveDraft'), () => render(value => value + 1), note => { lastNote.current = note; callbacks.current.onCommitted?.(note); }));
  const { body, tags, relativePath, title } = session.current;
  useEffect(() => { callbacks.current.onTitleChange?.(title); }, [title]);
  const canSave = capabilities.has('saveNote');
  const propertyTags = tags.filter(name => !inlineTags(body).includes(name));
  const busy = useRef(false);
  useEffect(() => {
    if (!working && restoreImageFocus.current) {
      restoreImageFocus.current = false;
      field.current?.focus();
    }
  }, [working]);
  const update = (nextBody: string, nextTags = [...new Set([...tags.filter(tag => !inlineTags(body).includes(tag)), ...inlineTags(nextBody)])], path = relativePath) => { if (canSave) session.update(nextBody, nextTags, path); };
  async function flush() {
    if (busy.current) return false;
    if (!canSave) return !session.dirty;
    busy.current = true; setWorking(true); setLocalError('');
    try { await session.flush(); return true; }
    catch { return false; }
    finally { busy.current = false; setWorking(false); }
  }
  useEffect(() => {
    if (handle) handle.current = { flush };
    return () => { if (handle) handle.current = null; };
  });
  useEffect(() => {
    session.activate();
    if (titleFirst) titleField.current?.focus(); else field.current?.focus();
    if (!initialDraft.baseHash && initialDraft.title !== undefined && canSave) void session.save().catch(() => undefined);
    if (initialDraft.updatedAt && canSave) session.update(session.current.body, session.current.tags);
    const unload = (event: BeforeUnloadEvent) => { if (session.dirty) { event.preventDefault(); event.returnValue = ''; } };
    const hidden = () => { if (document.visibilityState === 'hidden') void session.recover().catch(() => undefined); };
    window.addEventListener('beforeunload', unload); document.addEventListener('visibilitychange', hidden);
    return () => { session.dispose(); window.removeEventListener('beforeunload', unload); document.removeEventListener('visibilitychange', hidden); };
  }, [session, initialDraft, canSave, titleFirst]);
  async function finish() { if (await flush()) { if (lastNote.current) onSaved(lastNote.current); else onClose(); } }
  async function image(insert: (markdown: string) => void) {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try {
      const current = session.current;
      const attachment = await request<Attachment | null>('pickImage', { noteId: current.id, notePath: current.relativePath, ...(current.vaultBinding ? { vaultBinding: current.vaultBinding } : {}) });
      if (attachment) {
        insert(`![图片](${attachment.markdownPath})`);
        update(session.current.body, session.current.tags, attachment.notePath ?? current.relativePath);
      }
    } catch (error) { setLocalError(errorMessage(error)); }
    finally { busy.current = false; restoreImageFocus.current = true; setWorking(false); }
  }
  async function reload() {
    if (!window.confirm('重新加载将放弃当前未保存的修改，是否继续？')) return;
    setWorking(true);
    try {
      await session.recover();
      const note = await request<Note>('getNote', { id: session.current.id });
      // Commit the chosen source version with its hash so the bridge clears matching recovery.
      session.replace({ ...session.current, body: note.body, title: note.title, tags: note.tags, relativePath: note.relativePath, baseHash: note.contentHash }, true);
      await session.flush();
      setLocalError('');
    } catch (error) { setLocalError(errorMessage(error)); }
    finally { setWorking(false); }
  }
  async function copy() {
    setWorking(true);
    try {
      await session.recover();
      const id = createId();
      const current = session.current;
      const directory = current.relativePath?.slice(0, current.relativePath.lastIndexOf('/') + 1) ?? 'notes/';
      session.replace({ id, title: current.title, body: current.body, tags: current.tags, baseHash: null, relativePath: `${directory}${id}.md`, ...(current.vaultBinding ? { vaultBinding: current.vaultBinding } : {}) });
      await session.flush();
      // Retire the original recovery only after the copy is durably committed.
      if (capabilities.has('saveDraft')) await request('saveDraft', { ...current, title: undefined, body: '', tags: [], baseHash: null });
    } catch (error) { setLocalError(errorMessage(error)); }
    finally { setWorking(false); }
  }
  const error = localError || (session.error ? errorMessage(session.error) : '');
  return <section aria-label={initial.baseHash ? '编辑笔记' : '新建笔记'} className="note-editor space-y-5">
    <div className="note-editor-header flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={() => void finish()} disabled={working} aria-label="返回笔记列表"><ArrowLeft className="size-4" />返回</Button>
      <div className="flex items-center gap-2"><span role="status" className="text-xs text-muted-foreground">{session.state === 'saving' ? '保存中…' : session.state === 'saved' && !session.dirty ? '已保存到本地库' : session.state === 'conflict' ? '文件已在其他位置修改' : session.state === 'error' ? '未保存，请重试' : session.dirty ? '未保存' : ''}</span>
      </div>
    </div>
    <input ref={titleField} aria-label="页面标题" placeholder="新页面" className="note-page-title" value={session.current.title ?? ''} readOnly={!canSave} onChange={event => session.update(body, tags, relativePath, event.target.value)} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key === 'Enter') { event.preventDefault(); if (event.metaKey || event.ctrlKey) void finish(); else field.current?.focus(); }
    }} />
    {propertyTags.length > 0 && <div className="note-editor-tags flex flex-wrap items-center gap-1" aria-label="笔记标签">
      {propertyTags.map(name => <Button key={name} variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" aria-label={`移除标签 ${name}`} disabled={working || !canSave} onClick={() => update(body, tags.filter(tag => tag !== name))}>#{name}<X className="size-3" /></Button>)}
    </div>}
    {pendingLink && <p role="status" className="text-sm text-muted-foreground">完成当前记录后，将打开收到的笔记链接。</p>}
    {error && <div role="alert" className="note-editor-message space-y-2 rounded-lg border p-3 text-sm"><p>{error}</p>{session.state === 'error' && <Button variant="outline" size="sm" disabled={working || !canSave} onClick={() => void finish()}>重试保存</Button>}{session.state === 'conflict' && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => field.current?.focus()}>继续编辑</Button><Button variant="outline" size="sm" disabled={working} onClick={() => void reload()}>重新加载</Button><Button variant="outline" size="sm" disabled={working} onClick={() => void copy()}>另存副本</Button></div>}</div>}
    <div className="typeset-content min-h-[55vh]"><RichMarkdownEditor autoFocus={!titleFirst} ref={field} value={body} notePath={relativePath!} disabled={working || !canSave} onChange={value => update(value)} onSave={() => void finish()} onError={setLocalError} onImage={capabilities.has('pickImage') ? insert => void image(insert) : undefined} /></div>
  </section>;
}
