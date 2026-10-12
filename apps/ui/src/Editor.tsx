import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageNotice } from '@/components/page-notice';
import { request, errorMessage, type Attachment, type Draft } from './bridge';
import type { Note, NoteProperties as Properties, PropertyChange, PropertyUpdateResult } from '@memocard/contracts';
import { RichMarkdownEditor } from './RichMarkdownEditor';
import { EditorSession } from './editor-session';
import { isBrowserVault } from './client-mode';
import { createId } from './uuid';
import NoteProperties from './NoteProperties';
import './Editor.css';
import { useTagColorVault } from './TagColorProvider';
import { changeTagSettings } from './tag-settings';

export type EditorHandle = { flush: () => Promise<boolean>; finish: () => Promise<void> };
export function Editor({ initial, initialNote, capabilities, pendingLink = false, onClose, onSaved, onCommitted, onTitleChange, onTagsChanged, handle }: {
  initial: Draft; initialNote?: Note; capabilities: Set<string>; pendingLink?: boolean;
  onClose: () => void; onSaved: (note: Note) => void;
  onTagsChanged?: (from:string, to:string | null) => void;
  onCommitted?: (note: Note) => void; onTitleChange?: (title: string | undefined) => void; handle?: React.RefObject<EditorHandle | null>;
}) {
  const vaultId = useTagColorVault();
  const field = useRef<HTMLDivElement>(null);
  const titleField = useRef<HTMLTextAreaElement>(null);
  const lastEnteredTitle = useRef<string | null>(null);
  const initialDraft = useRef(initial).current;
  const titleFirst = initialDraft.title !== undefined && !initialDraft.baseHash;
  const [, render] = useState(0);
  const [working, setWorking] = useState(false);
  const [propertyData, setPropertyData] = useState<Properties>();
  const restoreImageFocus = useRef(false);
  const [localError, setLocalError] = useState('');
  const lastNote = useRef<Note | null>(null);
  const callbacks = useRef({ onCommitted, onTitleChange });
  callbacks.current = { onCommitted, onTitleChange };
  const [session] = useState(() => new EditorSession(initialDraft, request, capabilities.has('saveDraft'), () => render(value => value + 1), note => { lastNote.current = note; setPropertyData((note as PropertyUpdateResult).propertyData); callbacks.current.onCommitted?.(note); }, !isBrowserVault));
  const { body, relativePath, title, tags } = session.current;
  // Default filenames remain in the save session without filling the title input.
  const titleValue = !lastEnteredTitle.current?.trim() && /^(?:新内容|未命名)(?: \([1-9]\d*\))?$/.test(title ?? '') ? '' : title ?? '';
  const note = lastNote.current ?? initialNote;
  const metadata = note?.id === session.current.id ? note : undefined;
  useLayoutEffect(() => {
    const element = titleField.current;
    if (!element) return;
    const resize = () => { element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px`; };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [title]);
  useEffect(() => { callbacks.current.onTitleChange?.(title); }, [title]);
  const canSave = capabilities.has('saveNote');
  const busy = useRef(false);
  useEffect(() => {
    if (!working && restoreImageFocus.current) {
      restoreImageFocus.current = false;
      field.current?.focus();
    }
  }, [working]);
  const update = (nextBody: string, path = relativePath) => { if (canSave) session.update(nextBody, path); };
  async function flush() {
    if (busy.current) return false;
    if (!canSave) return !session.dirty;
    busy.current = true; setWorking(true); setLocalError('');
    try { await session.flush(); return true; }
    catch { return false; }
    finally { busy.current = false; setWorking(false); }
  }
  useEffect(() => {
    if (handle) handle.current = { flush, finish };
    return () => { if (handle) handle.current = null; };
  });
  useEffect(() => {
    session.activate();
    if (titleFirst) titleField.current?.focus(); else field.current?.focus();
    if (!initialDraft.baseHash && initialDraft.title !== undefined && canSave) void session.save().catch(() => undefined);
    if (initialDraft.updatedAt && canSave) session.update(session.current.body);
    const unload = (event: BeforeUnloadEvent) => { if (session.dirty) { event.preventDefault(); event.returnValue = ''; } };
    const hidden = () => { if (document.visibilityState === 'hidden') void session.recover().catch(() => undefined); };
    window.addEventListener('beforeunload', unload); document.addEventListener('visibilitychange', hidden);
    return () => { session.dispose(); window.removeEventListener('beforeunload', unload); document.removeEventListener('visibilitychange', hidden); };
  }, [session, initialDraft, canSave, titleFirst]);
  async function applyProperty(change: PropertyChange) {
    if (busy.current || !capabilities.has('updateNoteProperty')) throw new Error('暂时无法编辑属性。');
    await session.changeProperty(change);
  }
  async function changeTag(from:string, to:string | null) {
    if (busy.current || !vaultId || !canSave || !capabilities.has('updateNoteProperty')) throw new Error('暂时无法编辑标签。');
    busy.current = true; setWorking(true);
    let flushed = false;
    try {
      await session.flush(); flushed = true;
      const operations = await import('./rename-tag-operation');
      if (to === null) await operations.deleteTag(from, vaultId, request);
      else await operations.renameTag(from, to, vaultId, request);
      try { changeTagSettings(vaultId, from, to); }
      catch { throw new Error('标签内容已更新，但外观设置未能保存，请检查浏览器存储权限。'); }
    } finally {
      try {
        // Refresh even after a partial operation, so a later edit uses the current hash.
        if (flushed) {
          const saved = await request<Note>('getNote', {id:session.current.id});
          lastNote.current = saved;
          session.replace({...session.current, body:saved.body, title:saved.title, tags:saved.tags, relativePath:saved.relativePath, baseHash:saved.contentHash});
          callbacks.current.onCommitted?.(saved);
          onTagsChanged?.(from, to);
        }
      } finally { busy.current = false; setWorking(false); }
    }
  }
  async function finish() { if (await flush()) { if (lastNote.current) onSaved(lastNote.current); else onClose(); } }
  async function image(insert: (markdown: string) => void) {
    if (busy.current) return;
    busy.current = true; setWorking(true);
    try {
      const current = session.current;
      const attachment = await request<Attachment | null>('pickImage', { noteId: current.id, notePath: current.relativePath, ...(current.vaultBinding ? { vaultBinding: current.vaultBinding } : {}) });
      if (attachment) {
        insert(`![图片](${attachment.markdownPath})`);
        update(session.current.body, attachment.notePath ?? current.relativePath);
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
      session.replace({ ...session.current, body: note.body, title: note.title, tags: note.tags, relativePath: note.relativePath, baseHash: note.contentHash, pendingProperties: [] }, true);
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
      session.replace({ id, title: current.title, body: current.body, tags: current.tags, pendingProperties: current.pendingProperties, baseHash: null, relativePath: `${directory}${id}.md`, ...(current.vaultBinding ? { vaultBinding: current.vaultBinding } : {}) });
      await session.flush();
      // Retire the original recovery only after the copy is durably committed.
      if (capabilities.has('saveDraft')) await request('saveDraft', { ...current, title: undefined, body: '', tags: [], baseHash: null, pendingProperties: [] });
    } catch (error) { setLocalError(errorMessage(error)); }
    finally { setWorking(false); }
  }
  const error = localError || (session.error ? errorMessage(session.error) : '');
  const conversionRejected = Boolean(session.error && typeof session.error === 'object' && 'code' in session.error && session.error.code === 'LOSSY_PROPERTY_CONVERSION');
  const heading = <textarea ref={titleField} rows={1} aria-label="页面标题" placeholder="新内容" className="note-page-title" value={titleValue} readOnly={working || !canSave} onChange={event => {
      const value = event.target.value.replace(/[\r\n]+/g, ' ');
      lastEnteredTitle.current = value;
      session.update(body, relativePath, value);
    }} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key === 'Enter') { event.preventDefault(); if (event.metaKey || event.ctrlKey) void finish(); else field.current?.focus(); }
    }} />;
  return <section aria-label={initial.baseHash ? '编辑笔记' : '新建笔记'} className="note-editor">
    <NoteProperties saveError={error} renderHeader={(notice, ownsSaveError) => <>
      {error && !ownsSaveError && <PageNotice title={session.state === 'conflict' ? '笔记存在冲突' : conversionRejected ? '属性未更改' : session.state === 'error' ? '保存未完成' : '操作未完成'} actions={(session.state === 'error' && !conversionRejected || session.state === 'conflict') ? <>
        {session.state === 'error' && !conversionRejected && <Button variant="outline" size="sm" disabled={working || !canSave} onClick={() => { if (session.current.pendingProperties?.length) void flush(); else void finish(); }}>重试保存</Button>}
        {session.state === 'conflict' && <><Button variant="outline" size="sm" disabled={working} onClick={() => void copy()}>另存副本</Button><Button variant="ghost" size="sm" disabled={working} onClick={() => void reload()}>重新加载</Button><Button variant="ghost" size="sm" onClick={() => field.current?.focus()}>继续编辑</Button></>}
      </> : undefined}>{error}</PageNotice>}
      {notice}
      {pendingLink && <PageNotice tone="info" title="有待打开的笔记">完成当前记录后，将打开收到的笔记链接。</PageNotice>}
      {heading}
    </>} pendingChanges={session.current.pendingProperties} savedProperties={propertyData} onChangeTag={changeTag} note={metadata} tags={[...tags, ...session.current.inheritedTags ?? []]} relativePath={relativePath} canRead={capabilities.has('getNoteProperties')} canEdit={canSave && capabilities.has('updateNoteProperty')} busy={working} onApply={applyProperty} onLocateTag={tag => {
      const target = Array.from(field.current?.querySelectorAll('.rich-inline-tag') ?? []).find(element => element.getAttribute('data-tag') === encodeURIComponent(tag));
      if (!target) return;
      field.current?.focus();
      const range = document.createRange(); range.selectNodeContents(target);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      target.scrollIntoView({block:'center'});
    }} />
    <div className="typeset-content"><RichMarkdownEditor autoFocus={!titleFirst} ref={field} value={body} notePath={relativePath!} disabled={working || !canSave} onChange={value => update(value)} onSave={() => void finish()} onError={setLocalError} onImage={capabilities.has('pickImage') ? insert => void image(insert) : undefined} /></div>
  </section>;
}
