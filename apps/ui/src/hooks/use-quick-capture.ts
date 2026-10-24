import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { Note } from '@memocard/contracts';
import { errorMessage, request, type Attachment, type Draft } from '../bridge';
import { createId } from '../uuid';
import { inlineTags, normalizePropertyTag } from '../inline-tags';
import { commitQuickCapture } from '../quick-capture-operation';
import { hasCapture, readQuickCaptureDraft, writeQuickCaptureDraft, type Capture } from '../quick-capture-draft';
import { insertCaptureTag, removeCaptureTags, restoreCaptureTags } from '../quick-capture-tags';
import { useIsMobile } from './use-mobile';
import { isIOSNative, useIOSSurface } from '../ios-native';
import { parseTagColors, readTagColors } from '../tag-colors';

export type QuickCaptureHandle = {isBusy:()=>boolean};
export type QuickCaptureMemory = {vaultId:string; vaultBinding?:string; capture:Capture};

export type QuickCaptureProps = {
  vaultId:string; vaultBinding?:string; rootNotes:boolean; tags:string[]; disabled:boolean; canImage:boolean;
  onRecorded:(note:Note)=>void; handle:React.RefObject<QuickCaptureHandle | null>;
  onContinue?:(draft:Draft)=>void;
  draftCount?:number; onOpenDrafts?:()=>void;
  docked?:boolean; active?:boolean;
  memory?:React.RefObject<QuickCaptureMemory | null>;
};

export function useQuickCapture({vaultId, vaultBinding, rootNotes, tags:options, disabled, canImage, onRecorded, onContinue, handle, draftCount=0, onOpenDrafts, docked=false, active=true, memory}: QuickCaptureProps) {
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
  const [capture, setCapture] = useState(() => restoreCaptureTags(restored.capture ?? blank()));
  const captureCurrent = useRef(capture);
  captureCurrent.current = capture;
  const [draftError, setDraftError] = useState(restored.error);
  const [restoreFailed, setRestoreFailed] = useState(Boolean(restored.error));
  const [recordedLocally, setRecordedLocally] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [tagPickerOpen,setTagPickerOpen] = useState(false);
  const textarea = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(()=>{
    if(pendingCaret.current===null || !textarea.current)return;
    textarea.current.focus();editorRef.current?.commands.setTextSelection(pendingCaret.current);
    pendingCaret.current=null;
  },[capture.text]);
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
    next={...next,tags:inlineTags(next.text)};
    captureCurrent.current=next;
    setCapture(next); setRecordedLocally(false); setRestoreFailed(false);
    if (isMobile) protect(next);
  }
  function retryProtection() {
    if (!restoreFailed) { protect(capture); return; }
    try {
      const draft=readQuickCaptureDraft(vaultId);
      if (draft) setCapture(restoreCaptureTags(draft));
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
    return {id:value.id,title:'',body,tags:inlineTags(body),inheritedTags:[],baseHash:null,relativePath:value.relativePath,vaultId,...(vaultBinding ? {vaultBinding} : {})};
  }, [vaultId,vaultBinding]);
  useImperativeHandle(handle, ()=>({isBusy:()=>working.current}), []);
  const blocked=disabled || busy;
  const canRecord=Boolean(removeCaptureTags(capture.text).trim() || capture.images.length) && !blocked;
  async function record() {
    const current=captureCurrent.current;
    if (disabled || working.current || (!removeCaptureTags(current.text).trim() && !current.images.length)) return;
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
  function chooseTag(tag:string) {
    if(blocked)return;
    const current=captureCurrent.current;
    const inserted=insertCaptureTag(current.text,tag,editorRef.current?.state.selection.from ?? current.text.length,editorRef.current?.state.selection.to ?? current.text.length);
    pendingCaret.current=inserted.caret;
    changeCapture({...current,text:inserted.text});setTagPickerOpen(false);
  }
  function toggleTag(tag:string) {
    if(blocked)return;
    const current=captureCurrent.current;
    if(current.tags.includes(tag))changeCapture({...current,text:removeCaptureTags(current.text,tag)});
    else chooseTag(tag);
  }
  const normalized=normalizePropertyTag(tagQuery);
  const known=[...new Set([...options,...capture.tags])];
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
  return {expanded,setExpanded,sheetViewport,capture,captureCurrent,draftError,restoreFailed,recordedLocally,busy,error,tagQuery,setTagQuery,tagPickerOpen,setTagPickerOpen,textarea,editorRef,working,continuing,blocked,canRecord,record,continueInPage,image,changeCapture,retryProtection,toggleTag,normalized,known,matches,isMobile};
}
