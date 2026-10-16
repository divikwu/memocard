import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { errorMessage, request } from '../bridge';

export type NoteDeleteTarget = {id:string; title:string; vaultId:string; vaultBinding?:string};
export default function NoteDeleteDialog({target,prepareDelete,onDeleted,onCancel}:{target:NoteDeleteTarget;prepareDelete:()=>Promise<{id:string;contentHash:string} | null>;onDeleted:()=>void;onCancel:()=>void}) {
  const [working,setWorking]=useState(false),[error,setError]=useState<unknown>(null);
  const pending=useRef(false);
  async function remove() {
    if(pending.current)return;
    pending.current=true;setWorking(true);setError(null);
    try {
      const saved=await prepareDelete();
      if(!saved || saved.id!==target.id)throw new Error('当前修改尚未保存或笔记已切换，请重新查看后再删除。');
      await request('deleteNote',{id:saved.id,baseHash:saved.contentHash,vaultId:target.vaultId,...(target.vaultBinding ? {vaultBinding:target.vaultBinding} : {})});
      onDeleted();
    } catch(cause){setError(cause);}
    finally{pending.current=false;setWorking(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open && !pending.current)onCancel();}}><DialogContent className="max-w-md" finalFocus={()=>document.querySelector<HTMLButtonElement>('button[aria-label="页面操作"]') ?? true}><DialogTitle>删除笔记「{target.title}」？</DialogTitle><DialogDescription>笔记将移入回收站，可随时恢复。图片附件会保留。</DialogDescription>{error!=null && <p role="alert" className="text-sm text-destructive">{errorMessage(error)}</p>}<div className="flex gap-2" style={{justifyContent:'flex-end'}}><Button variant="outline" size="sm" autoFocus disabled={working} onClick={onCancel}>取消</Button><Button variant="destructive" size="sm" disabled={working} onClick={()=>void remove()}>{working ? '正在删除…' : '确认删除'}</Button></div></DialogContent></Dialog>;
}
