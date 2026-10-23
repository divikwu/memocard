import { useCallback, useEffect, useRef, useState } from "react";
import type { Note, TrashItem, TrashList, TrashNote } from "@memocard/contracts";
import { request } from "../bridge";

export type TrashPageProps = { vaultId: string; vaultBinding?: string; refreshVersion: number; onRestored: () => void; canPermanentlyDelete?: boolean };
const title = (item: TrashItem) => item.title || "新内容";

export function useTrash({ vaultId, vaultBinding, refreshVersion, onRestored, canPermanentlyDelete = false }: TrashPageProps) {
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
  return { data, loading, error, notice, selected, setSelected, preview, readError, reading, restoring,
    readEpoch, pending, refreshButton, returnFocus, deleteTarget, setDeleteTarget, deleting, deleteError, setDeleteError,
    deleteFocus, busy, load, open, restore, permanentlyDelete };
}
