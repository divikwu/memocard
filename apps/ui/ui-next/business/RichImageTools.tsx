import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft01Icon from "@hugeicons/core-free-icons/ArrowLeft01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import ColumnInsertIcon from "@hugeicons/core-free-icons/ColumnInsertIcon";
import RowInsertIcon from "@hugeicons/core-free-icons/RowInsertIcon";
import { adjacentImage, applyImageTransaction, imageIndex, imageMoveTransaction, imageRow, setImageWidths, splitImageRow } from "../../src/rich-image-layout";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Button } from "../components/button";
import { richIcons } from "./rich-icons";

export function RichImageTools({ editor, getPos, alt }: { editor: Editor; getPos: () => number | undefined; alt: string }) {
  const [open, setOpen] = useState(false);
  const { editable } = useEditorState({ editor, selector: ({ editor }) => ({ editable: editor.isEditable, doc: open ? editor.state.doc : null }) });
  if (!editable) return null;
  const pos = getPos(), row = pos == null ? null : imageRow(editor, pos), index = row && pos != null ? imageIndex(row, pos) : -1;
  const grouped = !!row && row.images.length > 1;
  const previous = pos == null ? null : adjacentImage(editor, pos, -1), next = pos == null ? null : adjacentImage(editor, pos, 1);
  const join = (target: number | null, side: "left" | "right") => pos != null && target != null ? imageMoveTransaction(editor, pos, target, side) : null;
  const move = (direction: -1 | 1) => {
    if (!row || index < 0 || pos == null) return;
    const target = pos + (direction < 0 ? -row.images[index - 1].nodeSize : row.images[index].nodeSize);
    applyImageTransaction(editor, imageMoveTransaction(editor, pos, target, direction < 0 ? "left" : "right"));
  };
  const columns = <HugeiconsIcon icon={ColumnInsertIcon} aria-hidden="true" strokeWidth={2} />;
  const rows = <HugeiconsIcon icon={RowInsertIcon} aria-hidden="true" strokeWidth={2} />;
  return <div className="rich-image-tools" contentEditable={false} data-open={open || undefined}>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button type="button" variant="secondary" size="icon-xs" aria-label={`图片布局 ${alt}`} title="图片布局" />}><richIcons.MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={6} className="next-rich-ui rich-block-menu" aria-label="图片布局">
        <DropdownMenuItem disabled={!join(previous, "right")} onClick={() => applyImageTransaction(editor, join(previous, "right"))}>{columns}与上一行并排</DropdownMenuItem>
        <DropdownMenuItem disabled={!join(next, "left")} onClick={() => applyImageTransaction(editor, join(next, "left"))}>{columns}与下一行并排</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!grouped || index <= 0} onClick={() => move(-1)}><HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" strokeWidth={2} />向左移动</DropdownMenuItem>
        <DropdownMenuItem disabled={!grouped || !row || index >= row.images.length - 1} onClick={() => move(1)}><HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" strokeWidth={2} />向右移动</DropdownMenuItem>
        <DropdownMenuItem disabled={!grouped} onClick={() => { if (row) setImageWidths(editor, row.pos, row.images.map(() => 1)); }}>{columns}等宽排列</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!grouped} onClick={() => { if (pos != null) splitImageRow(editor, pos, true); }}>{rows}移到独立一行</DropdownMenuItem>
        <DropdownMenuItem disabled={!grouped} onClick={() => { if (pos != null) splitImageRow(editor, pos); }}>{rows}全部拆为单行</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
