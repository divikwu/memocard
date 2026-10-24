import { memo } from "react";
import { sameNotePreview, useNotePreview, type NotePreviewProps } from "../../src/note-preview";
import { Button } from "../components/button";
import { NoteMarkdown } from "./NoteMarkdown";
import "./note-content.css";

export type { NotePreviewProps } from "../../src/note-preview";

export const NotePreview = memo(function NotePreview({ title, body, notePath, onError, compact = false, showTitle = true, hiddenTags = [] }: NotePreviewProps) {
  const { content, viewport, expanded, setExpanded, overflows, compactClip, displayBody } = useNotePreview(body, compact, hiddenTags);
  return <div ref={viewport} className="note-preview-next" data-compact={compact || undefined} data-expanded={expanded || undefined} data-overflow={compact && overflows ? "true" : undefined}>
    {showTitle && (title || !body.trim()) && <h2 className="type-heading-2 mb-3">{title || "新内容"}</h2>}
    <div className={compactClip !== null || (!expanded && !compact) ? "overflow-hidden" : undefined} style={compact && compactClip !== null ? { maxHeight: compactClip } : !expanded && !compact ? { maxHeight: 360 } : undefined}>
      <div ref={content}><NoteMarkdown body={displayBody || (compact ? "" : "还没有正文")} notePath={notePath} onError={onError} interactive={!compact} compact={compact} /></div>
    </div>
    {compact && compactClip !== null && <span aria-hidden="true" className="note-preview-ellipsis">…</span>}
    {!compact && overflows && <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "收起全文" : "展开全文"}</Button>}
  </div>;
}, sameNotePreview);
