import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Note } from '@memocard/contracts';
import { ArrowUp, Check, FolderOpen, Hash, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from './ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Input } from './ui/input';
import TagPill from '../TagPill';
import { NoteImage } from '../NoteImage';
import { errorMessage, request, type Attachment, type Draft } from '../bridge';
import { createId } from '../uuid';
import { inlineTags, normalizePropertyTag } from '../inline-tags';
import { assetUrl } from '../urls';
import { commitQuickCapture } from '../quick-capture-operation';
import '../quick-capture.css';

type Capture = {id:string; text:string; tags:string[]; images:Attachment[]; relativePath:string};
export type QuickCaptureHandle = {isBusy:()=>boolean};

export function QuickCapture({vaultId, vaultBinding, rootNotes, tags:options, disabled, canImage, onRecorded, handle, draftCount=0, onOpenDrafts}: {
  vaultId:string; vaultBinding?:string; rootNotes:boolean; tags:string[]; disabled:boolean; canImage:boolean;
  onRecorded:(note:Note)=>void; handle:React.RefObject<QuickCaptureHandle | null>;
  draftCount?:number; onOpenDrafts?:()=>void;
}) {
  const blank = useCallback(():Capture => {const id=createId(); return {id,text:'',tags:[],images:[],relativePath:`${rootNotes ? '' : 'notes/'}${id}.md`};}, [rootNotes]);
  const [capture, setCapture] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const recorded = useRef(onRecorded);
  useEffect(() => {recorded.current=onRecorded;}, [onRecorded]);
  useEffect(() => {mounted.current=true; return () => {mounted.current=false;};}, []);
  const params = useCallback((value:Capture):Draft & {vaultId:string} => {
    const body = [value.text.trim(), ...value.images.map(image => `![图片](${image.markdownPath})`)].filter(Boolean).join('\n\n');
    return {id:value.id,title:'',body,tags:inlineTags(body),inheritedTags:value.tags,baseHash:null,relativePath:value.relativePath,vaultId,...(vaultBinding ? {vaultBinding} : {})};
  }, [vaultId,vaultBinding]);
  useImperativeHandle(handle, ()=>({isBusy:()=>working.current}), []);
  const blocked=disabled || busy;
  const canRecord=Boolean(capture.text.trim() || capture.images.length) && !blocked;
  async function record() {
    if (!canRecord || working.current) return;
    working.current=true; setBusy(true); setError('');
    const snapshot=params(capture);
    try {
      const saved=await commitQuickCapture(snapshot,request);
      if (!mounted.current) return;
      setCapture(blank()); setTagQuery('');
      recorded.current(saved);
      requestAnimationFrame(()=>textarea.current?.focus());
    } catch(cause) {if(mounted.current)setError(errorMessage(cause));}
    finally {working.current=false; if(mounted.current)setBusy(false);}
  }
  async function image() {
    if (blocked || working.current || !canImage) return;
    working.current=true; setBusy(true); setError('');
    try {
      const image=await request<Attachment | null>('pickImage', {noteId:capture.id,notePath:capture.relativePath,vaultId,...(vaultBinding ? {vaultBinding} : {})});
      if (image && mounted.current) {
        const next={...capture,relativePath:image.notePath ?? capture.relativePath,images:[...capture.images,image]};
        setCapture(next);
      }
    } catch(cause) {if(mounted.current)setError(errorMessage(cause));}
    finally {working.current=false; if(mounted.current)setBusy(false);}
  }
  function toggleTag(tag:string) {if(!blocked)setCapture(current=>({...current,tags:current.tags.includes(tag) ? current.tags.filter(value=>value!==tag) : [...current.tags,tag]}));}
  const normalized=normalizePropertyTag(tagQuery);
  const known=[...new Set([...capture.tags,...options])];
  const matches=known.filter(tag=>tag.includes(tagQuery.trim().replace(/^#/,'').toLowerCase()));
  return <form className="quick-capture" aria-label="快速输入" aria-busy={busy} onSubmit={event=>{event.preventDefault();void record();}}>
    <InputGroup className="quick-capture-group has-disabled:opacity-100 has-disabled:bg-background shadow-[0_4px_12px_rgba(25,25,25,0.027),0_1px_2px_rgba(25,25,25,0.02)]">
      <InputGroupTextarea ref={textarea} aria-label="快速输入内容" placeholder="记下此刻的想法…" disabled={blocked} value={capture.text} onChange={event=>setCapture(current=>({...current,text:event.target.value}))} onKeyDown={event=>{
        if(!event.nativeEvent.isComposing && !event.repeat && (event.metaKey || event.ctrlKey) && event.key==='Enter') {event.preventDefault();void record();}
      }} className="quick-capture-textarea" />
      {capture.images.length>0 && <div className="quick-capture-images" aria-label="待记录的图片">{capture.images.map((image,index)=>{
        const source=assetUrl(image.markdownPath,capture.relativePath);
        return <div className="quick-capture-image" key={image.relativePath}>{source && <NoteImage source={source} alt={`待记录图片 ${index+1}`} />}
          <Button type="button" variant="secondary" size="icon-xs" disabled={blocked} aria-label={`移除图片 ${index+1}`} onClick={()=>setCapture(current=>({...current,images:current.images.filter((_,i)=>i!==index)}))}><X /></Button>
        </div>;
      })}</div>}
      {capture.tags.length>0 && <div className="quick-capture-tags" aria-label="已选标签">{capture.tags.map(tag=><TagPill key={tag} name={tag} render={<button type="button" disabled={blocked} aria-label={`移除标签 ${tag}`} onClick={()=>toggleTag(tag)} />}><span>{tag}</span><X className="size-3" /></TagPill>)}</div>}
      <InputGroupAddon align="block-end" className="quick-capture-footer">
        <Popover><PopoverTrigger render={<InputGroupButton size="sm" disabled={blocked} aria-label="选择标签" title="选择标签"><Hash />标签</InputGroupButton>} />
          <PopoverContent align="start" className="quick-capture-tag-picker" aria-label="选择标签">
            <Input aria-label="搜索或新建标签" placeholder="搜索或新建标签" value={tagQuery} disabled={blocked} onChange={event=>setTagQuery(event.target.value)} />
            <div className="quick-capture-tag-options">{matches.map(tag=><Button type="button" key={tag} variant="ghost" size="sm" disabled={blocked} aria-pressed={capture.tags.includes(tag)} onClick={()=>toggleTag(tag)}><Hash className="size-3.5" /><span>{tag}</span>{capture.tags.includes(tag) && <Check className="size-3.5" />}</Button>)}
              {normalized && !known.includes(normalized) && <Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={()=>{toggleTag(normalized);setTagQuery('');}}>新建标签 {normalized}</Button>}
              {!known.length && !tagQuery && <p>输入名称，创建第一个标签。</p>}
            </div>
          </PopoverContent>
        </Popover>
        <InputGroupButton size="sm" disabled={blocked || !canImage} aria-label="添加图片" title="添加图片" onClick={()=>void image()}><ImagePlus />图片</InputGroupButton>
        <span className="quick-capture-shortcut">⌘ / Ctrl + Enter</span>
        <InputGroupButton type="submit" variant="default" size="sm" className="quick-capture-submit" disabled={!canRecord}>{busy ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <ArrowUp />}{busy ? '处理中' : '记录'}</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
    {draftCount>0 && onOpenDrafts && <div className="quick-capture-drafts"><Button type="button" variant="ghost" size="sm" onClick={onOpenDrafts}><FolderOpen aria-hidden="true" />保留草稿（{draftCount}）</Button></div>}
    {error && <p role="alert" className="quick-capture-error">{error}</p>}
  </form>;
}
