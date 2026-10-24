import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";
import { sameNotePreview, useNotePreview, type NotePreviewProps } from "./note-preview";

export const NotePreview = memo(function NotePreview({ title, body, notePath, onError, compact = false, showTitle = true, hiddenTags = [] }: NotePreviewProps) {
  const { content, viewport, expanded, setExpanded, overflows, compactClip, displayBody } = useNotePreview(body, compact, hiddenTags);
  return <div ref={viewport} data-overflow={compact && overflows ? "true" : undefined} className={compact ? "typeset-summary note-card-preview relative h-full overflow-hidden text-secondary" : expanded ? "typeset-content" : "typeset-summary"}>
    {showTitle && (title || !body.trim()) && <h2 className="mb-3 text-xl font-semibold">{title || "新内容"}</h2>}
    <div className={compactClip !== null || (!expanded && !compact) ? "overflow-hidden" : undefined} style={compact && compactClip !== null ? { maxHeight: compactClip } : !expanded && !compact ? { maxHeight: 360 } : undefined}>
      <div ref={content} className={`break-words ${compact ? "text-sm leading-relaxed" : "text-(length:--font-size-base) leading-relaxed"}`}><Markdown body={displayBody || (compact ? "" : "还没有正文")} notePath={notePath} onError={onError} /></div>
    </div>
    {compact && compactClip !== null && <span aria-hidden="true" className="absolute bottom-0 left-0 text-sm leading-normal">…</span>}
    {!compact && overflows && <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "收起全文" : "展开全文"}</Button>}
  </div>;
}, sameNotePreview);
