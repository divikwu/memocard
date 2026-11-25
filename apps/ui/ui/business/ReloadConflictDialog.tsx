import { useRef } from 'react';
import { Button } from '../components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/dialog';

export default function ReloadConflictDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  return <Dialog open onOpenChange={open => { if (!open) onCancel(); }}>
    <DialogContent initialFocus={cancel}>
      <DialogHeader>
        <DialogTitle>重新加载笔记？</DialogTitle>
        <DialogDescription>当前未保存的修改将被文件中的内容替换。</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button ref={cancel} variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={onConfirm}>确认重新加载</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
