import { useRef, useState } from "react";
import { request } from "../bridge";
export type NoteDeleteTarget = { id: string; title: string; vaultId: string; vaultBinding?: string };

export type NoteDeleteProps = { target: NoteDeleteTarget; prepareDelete: () => Promise<{id:string;contentHash:string} | null>; onDeleted: () => void; onCancel: () => void };
export function useNoteDelete({ target, prepareDelete, onDeleted }: NoteDeleteProps) {
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
  return { working, error, pending, remove };
}
