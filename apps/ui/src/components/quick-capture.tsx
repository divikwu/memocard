import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Note } from '@memocard/contracts';
import { ArrowUp, ArrowUpRight, Check, FolderOpen, Hash, ImagePlus, LoaderCircle, Plus, X } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from './ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import TagPill from '../TagPill';
import { NoteImage } from '../NoteImage';
import { errorMessage, request, type Attachment, type Draft } from '../bridge';
import { createId } from '../uuid';
import { inlineTags, normalizePropertyTag } from '../inline-tags';
import { assetUrl } from '../urls';
import { commitQuickCapture } from '../quick-capture-operation';
import { hasCapture, readQuickCaptureDraft, writeQuickCaptureDraft, type Capture } from '../quick-capture-draft';
import { useIsMobile } from '../hooks/use-mobile';
import { isIOSNative, useIOSSurface } from '../ios-native';
import '../quick-capture.css';
import { parseTagColors, readTagColors } from '../tag-colors';

export type QuickCaptureHandle = {isBusy:()=>boolean};
export type QuickCaptureMemory = {vaultId:string; vaultBinding?:string; capture:Capture};

export function QuickCapture({vaultId, vaultBinding, rootNotes, tags:options, disabled, canImage, onRecorded, onContinue, handle, draftCount=0, onOpenDrafts, docked=false, active=true, memory}: {
  vaultId:string; vaultBinding?:string; rootNotes:boolean; tags:string[]; disabled:boolean; canImage:boolean;
  onRecorded:(note:Note)=>void; handle:React.RefObject<QuickCaptureHandle | null>;
  onContinue?:(draft:Draft)=>void;
  draftCount?:number; onOpenDrafts?:()=>void;
  docked?:boolean; active?:boolean;
  memory?:React.RefObject<QuickCaptureMemory | null>;
}) {
  const isMobile = useIsMobile() || isIOSNative;
  const [expanded,setExpanded] = useState(false);
  const [sheetViewport,setSheetViewport] = useState<{bottom:number; maxHeight:number} | null>(null);
  useEffect(()=>{if (!active) setExpanded(false);},[active]);
  useEffect(()=>{
    const viewport=window.visualViewport;
    if (!docked || !expanded || !viewport) return;
    const place=()=>setSheetViewport({bottom:Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop),maxHeight:viewport.height-16});
    place();viewport.addEventListener('resize',place);viewport.addEventListener('scroll',place);
    return ()=>{viewport.removeEventListener('resize',place);viewport.removeEventListener('scroll',place);};
  },[docked,expanded]);
  const blank = useCallback(():Capture => {const id=createId(); return {id,text:'',tags:[],images:[],relativePath:`${rootNotes ? '' : 'notes/'}${id}.md`};}, [rootNotes]);
  const [restored] = useState(() => {
    const cached=memory?.current;
    if (cached?.vaultId === vaultId && cached.vaultBinding === vaultBinding && hasCapture(cached.capture)) return {capture:cached.capture,error:'',cached:true};
    try { return {capture:isMobile ? readQuickCaptureDraft(vaultId) : null,error:'',cached:false}; }
    catch { return {capture:null,error:'无法恢复本机草稿，请保持页面打开。',cached:false}; }
  });
  const [capture, setCapture] = useState(() => restored.capture ?? blank());
  const captureCurrent = useRef(capture);
  captureCurrent.current = capture;
  const [draftError, setDraftError] = useState(restored.error);
  const [restoreFailed, setRestoreFailed] = useState(Boolean(restored.error));
  const [recordedLocally, setRecordedLocally] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const focusAfterRecord = useRef(false);
  useEffect(()=>{
    if (!busy && focusAfterRecord.current) {
      focusAfterRecord.current=false;
      if (!docked) textarea.current?.focus();
    }
  },[busy,capture.id,docked]);
  const working = useRef(false);
  const continuing = useRef(false);
  const mounted = useRef(true);
  const recorded = useRef(onRecorded);
  const wasMobile = useRef(isMobile && !restored.cached);
  useEffect(()=>{if(memory && !restoreFailed)memory.current={vaultId,vaultBinding,capture};},[memory,vaultId,vaultBinding,capture,restoreFailed]);
  const protect = useCallback((next:Capture) => {
    try { writeQuickCaptureDraft(vaultId,next); setDraftError(''); return true; }
    catch { setDraftError('草稿保护暂不可用，请保持页面打开。'); return false; }
  }, [vaultId]);
  function changeCapture(next:Capture) {
    captureCurrent.current=next;
    setCapture(next); setRecordedLocally(false); setRestoreFailed(false);
    if (isMobile) protect(next);
  }
  function retryProtection() {
    if (!restoreFailed) { protect(capture); return; }
    try {
      const draft=readQuickCaptureDraft(vaultId);
      if (draft) setCapture(draft);
      setRestoreFailed(false); setDraftError('');
    } catch { /* Keep the unreadable draft for another recovery attempt. */ }
  }
  useEffect(() => {
    if (isMobile && !wasMobile.current) protect(capture);
    wasMobile.current = isMobile;
  }, [capture,isMobile,protect]);
  useEffect(() => {recorded.current=onRecorded;}, [onRecorded]);
  useEffect(() => {mounted.current=true; return () => {mounted.current=false;};}, []);
  const params = useCallback((value:Capture, text=value.text.trim()):Draft & {vaultId:string} => {
    const body = [text, ...value.images.map(image => `![图片](${image.markdownPath})`)].filter(Boolean).join('\n\n');
    return {id:value.id,title:'',body,tags:inlineTags(body),inheritedTags:value.tags,baseHash:null,relativePath:value.relativePath,vaultId,...(vaultBinding ? {vaultBinding} : {})};
  }, [vaultId,vaultBinding]);
  useImperativeHandle(handle, ()=>({isBusy:()=>working.current}), []);
  const blocked=disabled || busy;
  const canRecord=Boolean(capture.text.trim() || capture.images.length) && !blocked;
  async function record() {
    const current=captureCurrent.current;
    if (disabled || working.current || (!current.text.trim() && !current.images.length)) return;
    working.current=true; setBusy(true); setError('');
    const snapshot=params(current);
    try {
      const saved=await commitQuickCapture(snapshot,request);
      if (!mounted.current) return;
      const next=blank();
      setCapture(next); setTagQuery('');
      const cleaned=(!isMobile && !restored.cached) || protect(next);
      if (isMobile) setRecordedLocally(true);
      recorded.current(saved);
      if (docked) { if(cleaned)setExpanded(false); }
      else focusAfterRecord.current=true;
    } catch(cause) {if(mounted.current)setError(errorMessage(cause));}
    finally {working.current=false; if(mounted.current)setBusy(false);}
  }
  async function continueInPage() {
    if (blocked || working.current || restoreFailed || !onContinue) return;
    working.current=true; setBusy(true); setError('');
    const current=captureCurrent.current;
    const snapshot:Draft & {vaultId:string}={...params(current,current.text),title:undefined};
    try {
      const saved=await request<Draft>('saveDraft',snapshot);
      if (saved.revision) snapshot.recoveredFrom={draftKey:saved.draftKey ?? snapshot.id,revision:saved.revision};
      if (!mounted.current) return;
      const next=blank();
      if (!protect(next)) return;
      continuing.current=true;
      setCapture(next); setTagQuery(''); setExpanded(false);
      onContinue(snapshot);
    } catch(cause) {if(mounted.current)setError(errorMessage(cause));}
    finally {working.current=false; if(mounted.current)setBusy(false);}
  }
  async function image() {
    if (blocked || working.current || !canImage) return;
    working.current=true; setBusy(true); setError('');
    try {
      const current=captureCurrent.current;
      const image=await request<Attachment | null>('pickImage', {noteId:current.id,notePath:current.relativePath,vaultId,...(vaultBinding ? {vaultBinding} : {})});
      if (image && mounted.current) {
        const latest=captureCurrent.current;
        const next={...latest,relativePath:image.notePath ?? latest.relativePath,images:[...latest.images,image]};
        changeCapture(next);
      }
    } catch(cause) {if(mounted.current)setError(errorMessage(cause));}
    finally {working.current=false; if(mounted.current)setBusy(false);}
  }
  function toggleTag(tag:string) {const current=captureCurrent.current;if(!blocked)changeCapture({...current,tags:current.tags.includes(tag) ? current.tags.filter(value=>value!==tag) : [...current.tags,tag]});}
  const normalized=normalizePropertyTag(tagQuery);
  const known=[...new Set([...capture.tags,...options])];
  const matches=known.filter(tag=>tag.includes(tagQuery.trim().replace(/^#/,'').toLowerCase()));
  useEffect(()=>{
    if(!isIOSNative)return;
    const open=()=>{if(active && !working.current && !disabled)setExpanded(true);};
    window.addEventListener('memocard:open-native-capture',open);
    return()=>window.removeEventListener('memocard:open-native-capture',open);
  },[active,disabled]);
  useIOSSurface('capture', () => {
    const colors=parseTagColors(readTagColors(vaultId));
    return {
      kind:'capture',title:'快速记录',presented:expanded && active,busy,error:error || draftError,resetKey:capture.id,
      summary:hasCapture(capture) ? '继续未完成的记录…' : undefined,
      primary:{id:'record',title:busy ? '处理中' : '记录',disabled:!canRecord},
      sections:[
        {id:'text',fields:[{id:'text',title:'记下此刻的想法…',value:capture.text,kind:'multiline',disabled:blocked}]},
        {id:'selected-tags',actions:capture.tags.map(tag=>({id:`tag:${tag}`,title:tag,color:colors[tag] ?? 'default',disabled:blocked}))},
        {id:'tags',fields:[{id:'tag-query',title:'搜索或新建标签',value:tagQuery,disabled:blocked}],actions:[
          ...matches.map(tag=>({id:`tag:${tag}`,title:tag,selected:capture.tags.includes(tag),disabled:blocked})),
          ...(normalized && !known.includes(normalized) ? [{id:'new-tag',title:`新建标签 ${normalized}`,disabled:blocked}] : []),
        ],message:!known.length && !tagQuery ? '输入名称，创建第一个标签。' : undefined},
        {id:'images',actions:[{id:'image',title:'添加图片',disabled:blocked || !canImage},...capture.images.map((image,index)=>({id:`remove-image:${image.relativePath}`,title:`移除图片 ${index+1}`,imagePath:image.relativePath,disabled:blocked}))]},
        {id:'more',actions:[...(onContinue ? [{id:'continue',title:'切换为页面',disabled:blocked || restoreFailed}] : []),...(draftCount>0 ? [{id:'drafts',title:`保留草稿（${draftCount}）`,disabled:busy}] : []),...(draftError ? [{id:'retry',title:'重试草稿保护',disabled:blocked}] : [])]},
      ],
    };
  },async(action,value)=>{
    if(action === 'close'){if(!working.current)setExpanded(false);return;}
    if(working.current)return;
    if(action === 'text')changeCapture({...captureCurrent.current,text:value ?? ''});
    if(action === 'tag-query')setTagQuery(value ?? '');
    if(action.startsWith('tag:'))toggleTag(action.slice(4));
    if(action === 'new-tag' && normalized){toggleTag(normalized);setTagQuery('');}
    if(action === 'record')await record();
    if(action === 'image')await image();
    if(action.startsWith('remove-image:')){const current=captureCurrent.current;changeCapture({...current,images:current.images.filter(image=>image.relativePath !== action.slice(13))});}
    if(action === 'continue')await continueInPage();
    if(action === 'drafts'){setExpanded(false);onOpenDrafts?.();}
    if(action === 'retry')retryProtection();
  });
  if(isIOSNative)return null;
  const form = <form className="quick-capture" aria-label="快速输入" aria-busy={busy} onSubmit={event=>{event.preventDefault();void record();}}>
    <InputGroup className="quick-capture-group has-disabled:opacity-100 has-disabled:bg-background shadow-[0_4px_12px_rgba(25,25,25,0.027),0_1px_2px_rgba(25,25,25,0.02)]">
      <InputGroupTextarea ref={textarea} aria-label="快速输入内容" placeholder="记下此刻的想法…" disabled={blocked} value={capture.text} onChange={event=>changeCapture({...capture,text:event.target.value})} onKeyDown={event=>{
        if(!event.nativeEvent.isComposing && !event.repeat && (event.metaKey || event.ctrlKey) && event.key==='Enter') {event.preventDefault();void record();}
      }} className="quick-capture-textarea" />
      {capture.images.length>0 && <div className="quick-capture-images" aria-label="待记录的图片">{capture.images.map((image,index)=>{
        const source=assetUrl(image.markdownPath,capture.relativePath);
        return <div className="quick-capture-image" key={image.relativePath}>{source && <NoteImage source={source} alt={`待记录图片 ${index+1}`} />}
          <Button type="button" variant="secondary" size="icon-xs" disabled={blocked} aria-label={`移除图片 ${index+1}`} onClick={()=>changeCapture({...capture,images:capture.images.filter((_,i)=>i!==index)})}><X /></Button>
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
    {draftCount>0 && onOpenDrafts && <div className="quick-capture-drafts"><Button type="button" variant="ghost" size="sm" disabled={docked && busy} onClick={()=>{if(docked)setExpanded(false);onOpenDrafts();}}><FolderOpen aria-hidden="true" />保留草稿（{draftCount}）</Button></div>}
    {docked && isMobile && onContinue && <Button type="button" variant="outline" className="quick-capture-continue" disabled={blocked || restoreFailed} onClick={()=>void continueInPage()}><ArrowUpRight aria-hidden="true" />切换为页面</Button>}
    {error && <p role="alert" className="quick-capture-error">{error}</p>}
    {isMobile && <div className="quick-capture-save-status" role="status" aria-live="polite" aria-atomic="true">
      {draftError ? <><span className="text-destructive">{recordedLocally ? '记录已保存，临时草稿未清除。' : draftError}</span><Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={retryProtection}>{restoreFailed ? '重试恢复草稿' : recordedLocally ? '重试清理草稿' : '重试草稿保护'}</Button></>
        : recordedLocally ? '已保存到本机' : hasCapture(capture) ? '草稿已保存在本机，点击「记录」完成保存' : null}
    </div>}
  </form>;
  if (!docked) return form;
  return <Sheet open={expanded && active} onOpenChange={(open,details)=>{if(working.current)details.cancel();else {if(open)continuing.current=false;setExpanded(open);}}}>
    <SheetTrigger render={<Button type="button" variant="outline" className="mobile-capture-entry" disabled={blocked} aria-label="打开快速记录" />}>
      <Plus aria-hidden="true" className="size-5 shrink-0" /><span className="min-w-0 truncate">{capture.text.trim() || (hasCapture(capture) ? '继续未完成的记录…' : '记下此刻的想法…')}</span>
    </SheetTrigger>
    <SheetContent side="bottom" className="mobile-capture-sheet" style={sheetViewport ?? undefined} initialFocus={textarea} finalFocus={()=>continuing.current ? false : true} showCloseButton={false} swipeToClose swipeDisabled={busy}>
      <SheetHeader className="flex-row items-center justify-between p-0"><SheetTitle>快速记录</SheetTitle><SheetClose render={<Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label="收起快速记录" />}><X aria-hidden="true" /></SheetClose></SheetHeader>
      {form}
    </SheetContent>
  </Sheet>;
}
