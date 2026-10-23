import { useRef, useState } from "react";
import { NoteSearchDialog } from "../src/components/note-search-dialog";
import { Button } from "../src/components/ui/button";

export type NoteSearchExampleProps = {
  available: boolean;
  initialOpen: boolean;
  preserveSession: boolean;
  onOpenNote: (id: string) => void;
  onOpenChange: (open: boolean) => void;
};

export function NoteSearchExample({ available, initialOpen, preserveSession, onOpenNote, onOpenChange }: NoteSearchExampleProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(initialOpen);
  const [openedNote, setOpenedNote] = useState<string | null>(null);
  const changeOpen = (next: boolean) => { setOpen(next); onOpenChange(next); };
  return <main className="min-h-dvh space-y-4 bg-body p-6 text-primary">
    <h1 className="text-xl font-semibold">笔记搜索</h1>
    <p className="max-w-lg text-sm text-secondary">生产搜索组件；只使用本故事的内存笔记，不连接笔记库。输入“计划”查看高亮与筛选。</p>
    <Button ref={trigger} onClick={() => changeOpen(true)}>{openedNote ? "返回搜索" : "打开搜索"}</Button>
    <output aria-label="已打开笔记" className="block text-sm text-secondary">{openedNote ?? "尚未打开笔记"}</output>
    <NoteSearchDialog open={open} available={available} preserveSession={preserveSession} returnFocus={trigger} vaultName="Storybook 示例库" onOpenChange={changeOpen} onOpenNote={id => { setOpenedNote(id); onOpenNote(id); changeOpen(false); }} />
  </main>;
}
