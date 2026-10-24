import { useNoteDelete, type NoteDeleteProps } from "../../src/hooks/use-note-delete";
import { errorMessage } from "../../src/error-messages";
import { Button } from "../components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/dialog";

export function NoteDeleteDialog(props: NoteDeleteProps) {
  const { working, error, pending, remove } = useNoteDelete(props);
  return <Dialog open onOpenChange={open => { if (!open && !pending.current) props.onCancel(); }}><DialogContent finalFocus={() => document.querySelector<HTMLButtonElement>('button[aria-label="页面操作"]') ?? true}>
    <DialogHeader><DialogTitle>将「{props.target.title || "新内容"}」移入回收站？</DialogTitle><DialogDescription>可在回收站恢复这条笔记，图片附件会保留。</DialogDescription></DialogHeader>
    {error != null && <p role="alert" className="text-sm text-error">{errorMessage(error)}</p>}
    <DialogFooter><Button variant="outline" autoFocus disabled={working} onClick={props.onCancel}>取消</Button><Button variant="destructive" disabled={working} onClick={() => void remove()}>{working ? "正在处理…" : "移入回收站"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
