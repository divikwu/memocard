import { useEffect, useState } from 'react';
import { errorMessage, request } from '../../src/bridge';
import { Button } from '../components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/dialog';
import { NativeSelect, NativeSelectOption } from '../components/native-select';

export default function DraftFolderDialog({ onClose, onSave }: { onClose: () => void; onSave: (folder: string) => void }) {
  const [folders, setFolders] = useState<string[]>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('.');
  useEffect(() => {
    let active = true;
    void request<{ folders: string[] }>('listFolders').then(
      result => { if (active) setFolders(result.folders); },
      cause => { if (active) setError(errorMessage(cause)); },
    );
    return () => { active = false; };
  }, []);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>重新选择保存目录</DialogTitle>
        <DialogDescription>草稿内容会保留。选择当前笔记库中的目录后再保存。</DialogDescription>
      </DialogHeader>
      {error ? <p role="alert" className="text-error">{error}</p> :
        !folders ? <p role="status">正在读取目录…</p> :
        !folders.length ? <p role="status">未找到可用目录。</p> :
        <NativeSelect aria-label="保存目录" className="w-full" value={selected} onChange={event => setSelected(event.target.value)}>
          <NativeSelectOption value="." disabled>请选择目录</NativeSelectOption>
          {folders.map(folder => <NativeSelectOption key={folder} value={folder}>{folder || '笔记库根目录'}</NativeSelectOption>)}
        </NativeSelect>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button disabled={!folders?.includes(selected)} onClick={() => onSave(selected)}>保存到此目录</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
