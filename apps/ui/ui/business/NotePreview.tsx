import { memo } from "react";
import { sameNotePreview, useNotePreview, type NotePreviewProps } from "../../src/note-preview";
import { Button } from "../components/button";
import { NoteMarkdown } from "./NoteMarkdown";
import "./note-content.css";

export type { NotePreviewProps } from "../../src/note-preview";

export const NotePreview = memo(function NotePreview({ title, body, notePath, onError, compact = false, showTitle = true, hiddenTags = [], plainText, omitImages }: NotePreviewProps) {
  const { content, viewport, expanded, setExpanded, overflows, displayBody } = useNotePreview(body, compact, hiddenTags);
  return <div ref={viewport} className="note-preview" data-compact={compact || undefined} data-expanded={expanded || undefined} data-overflow={compact && overflows ? "true" : undefined}>
    {showTitle && (title || !body.trim()) && <h2 className="type-heading-2 mb-3">{title || "新内容"}</h2>}
    <div className={!expanded && !compact ? "overflow-hidden" : undefined} style={!expanded && !compact ? { maxHeight: 360 } : undefined}>
      <div ref={content}>{plainText ? <p className="ui-note-preview-text">{body}</p> : <NoteMarkdown body={displayBody || (compact ? "" : "还没有正文")} notePath={notePath} onError={onError} interactive={!compact} compact={compact} omitImages={omitImages} />}</div>
    </div>
    {!compact && overflows && <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "收起全文" : "展开全文"}</Button>}
  </div>;
}, sameNotePreview);
