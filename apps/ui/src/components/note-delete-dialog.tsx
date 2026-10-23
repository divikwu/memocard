import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { errorMessage } from '../bridge';
import { useNoteDelete } from '../hooks/use-note-delete';
import { isIOSNative, useIOSSurface } from '../ios-native';

export type NoteDeleteTarget = {id:string; title:string; vaultId:string; vaultBinding?:string};
export default function NoteDeleteDialog({target,prepareDelete,onDeleted,onCancel}:{target:NoteDeleteTarget;prepareDelete:()=>Promise<{id:string;contentHash:string} | null>;onDeleted:()=>void;onCancel:()=>void}) {
  const { working, error, pending, remove } = useNoteDelete({ target, prepareDelete, onDeleted, onCancel });
  useIOSSurface('delete-note', () => ({
    kind:'alert',title:`删除笔记「${target.title}」？`,presented:!working,busy:working,error:error != null ? errorMessage(error) : undefined,
    message:'笔记将移入回收站，可随时恢复。图片附件会保留。',
    sections:[{id:'confirm',actions:[{id:'delete',title:'确认删除',destructive:true,disabled:working}]}],
  }), async action=>{if(action === 'delete')await remove();else if(!pending.current)onCancel();});
  if(isIOSNative)return null;
  return <Dialog open onOpenChange={open=>{if(!open && !pending.current)onCancel();}}><DialogContent className="max-w-md" finalFocus={()=>document.querySelector<HTMLButtonElement>('button[aria-label="页面操作"]') ?? true}><DialogTitle>删除笔记「{target.title}」？</DialogTitle><DialogDescription>笔记将移入回收站，可随时恢复。图片附件会保留。</DialogDescription>{error!=null && <p role="alert" className="text-sm text-error">{errorMessage(error)}</p>}<div className="flex gap-2" style={{justifyContent:'flex-end'}}><Button variant="outline" size="sm" autoFocus disabled={working} onClick={onCancel}>取消</Button><Button variant="destructive" size="sm" disabled={working} onClick={()=>void remove()}>{working ? '正在删除…' : '确认删除'}</Button></div></DialogContent></Dialog>;
}
