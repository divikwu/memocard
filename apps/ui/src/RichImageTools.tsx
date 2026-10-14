import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { Menu } from '@base-ui/react/menu';
import { Ellipsis, ArrowLeft, ArrowRight, Columns2, Rows2 } from 'lucide-react';
import { adjacentImage, applyImageTransaction, imageIndex, imageMoveTransaction, imageRow, setImageWidths, splitImageRow } from './rich-image-layout';

export function RichImageTools({ editor, getPos, alt }: { editor: Editor; getPos: () => number | undefined; alt: string }) {
  const [open, setOpen] = useState(false);
  const { editable } = useEditorState({ editor, selector: ({ editor }) => ({ editable: editor.isEditable, doc: open ? editor.state.doc : null }) });
  if (!editable) return null;
  const pos = getPos(), row = pos == null ? null : imageRow(editor, pos), index = row && pos != null ? imageIndex(row, pos) : -1;
  const grouped = !!row && row.images.length > 1;
  const previous = pos == null ? null : adjacentImage(editor, pos, -1), next = pos == null ? null : adjacentImage(editor, pos, 1);
  const join = (target: number | null, side: 'left' | 'right') => pos != null && target != null ? imageMoveTransaction(editor, pos, target, side) : null;
  const move = (direction: -1 | 1) => {
    if (!row || index < 0 || pos == null) return;
    const target = pos + (direction < 0 ? -row.images[index - 1].nodeSize : row.images[index].nodeSize);
    applyImageTransaction(editor, imageMoveTransaction(editor, pos, target, direction < 0 ? 'left' : 'right'));
  };
  return <div className="rich-image-tools" contentEditable={false} data-open={open || undefined}>
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger aria-label={`图片布局 ${alt}`} title="图片布局"><Ellipsis size={16} aria-hidden="true" /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={12} className="z-50"><Menu.Popup className="rich-block-menu" aria-label="图片布局">
        <Menu.Item disabled={!join(previous, 'right')} onClick={() => applyImageTransaction(editor, join(previous, 'right'))}><Columns2 aria-hidden="true" />与上一行并排</Menu.Item>
        <Menu.Item disabled={!join(next, 'left')} onClick={() => applyImageTransaction(editor, join(next, 'left'))}><Columns2 aria-hidden="true" />与下一行并排</Menu.Item>
        <Menu.Separator />
        <Menu.Item disabled={!grouped || index <= 0} onClick={() => move(-1)}><ArrowLeft aria-hidden="true" />向左移动</Menu.Item>
        <Menu.Item disabled={!grouped || !row || index >= row.images.length - 1} onClick={() => move(1)}><ArrowRight aria-hidden="true" />向右移动</Menu.Item>
        <Menu.Item disabled={!grouped} onClick={() => { if (row) setImageWidths(editor, row.pos, row.images.map(() => 1)); }}><Columns2 aria-hidden="true" />等宽排列</Menu.Item>
        <Menu.Separator />
        <Menu.Item disabled={!grouped} onClick={() => { if (pos != null) splitImageRow(editor, pos, true); }}><Rows2 aria-hidden="true" />移到独立一行</Menu.Item>
        <Menu.Item disabled={!grouped} onClick={() => { if (pos != null) splitImageRow(editor, pos); }}><Rows2 aria-hidden="true" />全部拆为单行</Menu.Item>
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
  </div>;
}
