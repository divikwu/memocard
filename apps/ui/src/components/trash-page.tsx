import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Note, TrashItem, TrashList, TrashNote } from '@memocard/contracts';
import { LoaderCircle, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { LoadingTrash } from './loading-states';
import { Skeleton } from './ui/skeleton';
import { PageNotice } from './page-notice';
import { errorMessage, request } from '../bridge';
import { isIOSNative, useIOSSurface } from '../ios-native';
import '../trash-page.css';
const Markdown=lazy(()=>import('../markdown').then(module=>({default:module.Markdown})));
const title=(item:TrashItem)=>item.title || '新内容';
const date=(value:string)=>Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '未知时间';
export default function TrashPage({vaultId,vaultBinding,refreshVersion,onRestored,canPermanentlyDelete=false}:{vaultId:string;vaultBinding?:string;refreshVersion:number;onRestored:()=>void;canPermanentlyDelete?:boolean}) {
  const [data,setData]=useState<TrashList>({notes:[],issues:[]}),[loading,setLoading]=useState(true),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState('');
  const [selected,setSelected]=useState<TrashItem|null>(null),[preview,setPreview]=useState<TrashNote|null>(null),[readError,setReadError]=useState<unknown>(null),[reading,setReading]=useState(false),[restoring,setRestoring]=useState<string|null>(null);
  const alive=useRef(true),epoch=useRef(0),readEpoch=useRef(0),pending=useRef(false),refreshButton=useRef<HTMLButtonElement>(null),returnFocus=useRef<HTMLButtonElement|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<TrashItem|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState<unknown>(null);
  const deleteFocus=useRef<HTMLButtonElement|null>(null),busy=restoring!==null || deleting;
  const scope=useCallback(()=>({vaultId,...(vaultBinding ? {vaultBinding} : {})}),[vaultId,vaultBinding]);
  const load=useCallback(async()=>{
    const current=++epoch.current;setLoading(true);setError(null);
    try{const result=await request<TrashList>('getTrash',scope());if(current===epoch.current)setData(result);}
    catch(cause){if(current===epoch.current)setError(cause);}
    finally{if(current===epoch.current)setLoading(false);}
  },[scope]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const invalidate=useCallback(()=>{epoch.current++;readEpoch.current++;},[]);
  useEffect(()=>{void load();return invalidate;},[load,refreshVersion,invalidate]);
  async function open(item:TrashItem,button:HTMLButtonElement) {
    const current=++readEpoch.current;returnFocus.current=button;setSelected(item);setPreview(null);setReadError(null);setReading(true);
    try{const value=await request<TrashNote>('getTrashedNote',{trashKey:item.trashKey,...scope()});if(current===readEpoch.current)setPreview(value);}
    catch(cause){if(current===readEpoch.current)setReadError(cause);}
    finally{if(current===readEpoch.current)setReading(false);}
  }
  async function restore(item:TrashItem,hash=item.contentHash) {
    if(pending.current)return;
    pending.current=true;setRestoring(item.trashKey);setError(null);setReadError(null);setNotice('');
    try {
      const saved=await request<Note>('restoreNote',{trashKey:item.trashKey,baseHash:hash,...scope()});
      if(!alive.current)return;
      setData(value=>({...value,notes:value.notes.filter(note=>note.trashKey!==item.trashKey)}));setSelected(null);readEpoch.current++;
      setNotice(`已恢复「${saved.title || '新内容'}」`);onRestored();void load();
    } catch(cause){if(alive.current){setError(cause);if(selected)setReadError(cause);}}
    finally{pending.current=false;if(alive.current)setRestoring(null);}
  }
  async function permanentlyDelete() {
    if(!deleteTarget || pending.current || !canPermanentlyDelete)return;
    const item=deleteTarget;
    pending.current=true;setDeleting(true);setDeleteError(null);setNotice('');
    try {
      await request('permanentlyDeleteNote',{trashKey:item.trashKey,baseHash:item.contentHash,...scope()});
      if(!alive.current)return;
      setData(value=>({...value,notes:value.notes.filter(note=>note.trashKey!==item.trashKey)}));setDeleteTarget(null);
      setNotice(`已永久删除「${title(item)}」`);void load();
    } catch(cause){if(alive.current)setDeleteError(cause);}
    finally{pending.current=false;if(alive.current)setDeleting(false);}
  }
  useIOSSurface('delete-trash', () => ({
    kind:'alert',title:`永久删除「${deleteTarget ? title(deleteTarget) : ''}」？`,presented:deleteTarget !== null && !deleting,
    message:'此操作无法撤销，删除后无法从回收站恢复。图片附件会保留。',error:deleteError != null ? errorMessage(deleteError) : undefined,
    sections:[{id:'confirm',actions:[{id:'delete',title:'确认永久删除',destructive:true,disabled:deleting}]}],
  }), async action=>{if(action === 'delete')await permanentlyDelete();else if(!pending.current)setDeleteTarget(null);});
  return <section aria-label="回收站" className="trash-page">
    <div className="trash-toolbar"><h1 className="truncate text-[32px] font-bold leading-[1.2] tracking-tight">回收站</h1><Button ref={refreshButton} aria-busy={loading} variant="outline" size="sm" disabled={loading || busy} onClick={()=>void load()}>{loading && data.notes.length > 0 && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}刷新回收站</Button></div>
    {error!=null && <PageNotice title="回收站操作未完成">{errorMessage(error)}</PageNotice>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {data.issues.length>0 && <PageNotice tone="info" title="部分回收记录无法读取">{data.issues.length} 条记录已保留，请检查回收目录后刷新。</PageNotice>}
    {loading && (data.notes.length === 0 ? <LoadingTrash toolbar={false} canPermanentlyDelete={canPermanentlyDelete} /> : <span role="status" className="sr-only">正在读取回收站…</span>)}
    {!loading && !error && data.notes.length===0 && <Card className="shadow-none"><CardContent className="trash-empty"><Trash2 aria-hidden="true" /><h2 className="font-medium">回收站是空的</h2><p className="text-sm text-muted-foreground">删除的笔记会保留在这里，随时恢复。</p></CardContent></Card>}
    <div className="trash-list" aria-busy={loading}>{data.notes.map(item=><Card key={item.trashKey} className="trash-card px-4 py-3 shadow-none hover:bg-hover"><button type="button" className="trash-item-open" disabled={busy} aria-label={`查看已删除笔记：${title(item)}`} onClick={event=>void open(item,event.currentTarget)} /><CardContent className="trash-item px-0"><div className="trash-item-content"><h2 className="truncate text-sm font-medium">{title(item)}</h2><p className="truncate text-xs text-muted-foreground" title={item.relativePath}>{item.relativePath}</p><p className="text-xs text-muted-foreground">删除于 {date(item.deletedAt)}</p>{item.preview && <p className="line-clamp-2 text-sm text-muted-foreground">{item.preview}</p>}</div><div className="trash-item-actions"><Button variant="outline" size="sm" disabled={busy} aria-label={`恢复笔记：${title(item)}`} onClick={()=>void restore(item)}><RotateCcw />{restoring===item.trashKey ? '正在恢复…' : '恢复'}</Button>{canPermanentlyDelete && <Button variant="outline" size="sm" disabled={busy} aria-label={`永久删除笔记：${title(item)}`} style={{"--accent-foreground":"var(--destructive)"} as React.CSSProperties} onClick={event=>{deleteFocus.current=event.currentTarget;setDeleteError(null);setDeleteTarget(item);}}><Trash2 />永久删除</Button>}</div></CardContent></Card>)}</div>
    <Dialog open={selected!==null} onOpenChange={open=>{if(!open && !pending.current){readEpoch.current++;setSelected(null);}}}><DialogContent className="trash-preview" finalFocus={()=>returnFocus.current?.isConnected ? returnFocus.current : refreshButton.current ?? true}><DialogTitle>{selected ? title(selected) : '已删除笔记'}</DialogTitle><DialogDescription>{selected?.relativePath} · 此内容只读，恢复后可继续编辑。</DialogDescription>{readError!=null && <p role="alert" className="text-sm text-destructive">{errorMessage(readError)}</p>}{reading ? <div role="status" aria-label="正在读取笔记" className="trash-preview-body space-y-3"><span className="sr-only">正在读取笔记…</span><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /></div> : preview && <div className="trash-preview-body"><Suspense fallback={<div role="status" aria-label="正在显示笔记" className="space-y-3"><span className="sr-only">正在显示笔记…</span><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>}><Markdown body={preview.note.body} notePath={preview.note.relativePath} /></Suspense></div>}<div className="trash-preview-actions"><Button variant="outline" size="sm" disabled={busy} onClick={()=>{readEpoch.current++;setSelected(null);}}>关闭</Button><Button size="sm" disabled={!selected || !preview || busy} onClick={()=>selected && preview && void restore(selected,preview.note.contentHash)}><RotateCcw />{restoring ? '正在恢复…' : '恢复笔记'}</Button></div></DialogContent></Dialog>
    <Dialog open={deleteTarget!==null && !isIOSNative} onOpenChange={open=>{if(!open && !pending.current)setDeleteTarget(null);}}><DialogContent className="max-w-md" finalFocus={()=>deleteFocus.current?.isConnected ? deleteFocus.current : refreshButton.current ?? true}><DialogTitle>永久删除「{deleteTarget ? title(deleteTarget) : ''}」？</DialogTitle><DialogDescription>此操作无法撤销，删除后无法从回收站恢复。图片附件会保留。</DialogDescription>{deleteError!=null && <p role="alert" className="text-sm text-destructive">{errorMessage(deleteError)}</p>}<div className="trash-preview-actions"><Button variant="outline" size="sm" autoFocus disabled={deleting} onClick={()=>setDeleteTarget(null)}>取消</Button><Button variant="destructive" size="sm" disabled={deleting} onClick={()=>void permanentlyDelete()}><Trash2 />{deleting ? '正在删除…' : '确认永久删除'}</Button></div></DialogContent></Dialog>
  </section>;
}
