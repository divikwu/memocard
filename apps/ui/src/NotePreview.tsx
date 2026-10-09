import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";

/** Keep reading available when a timeline preview exceeds its allotted height. */
function compactPreviewBody(body: string, hiddenTags: string[]) {
  if (!hiddenTags.length) return body;
  const hidden = new Set(hiddenTags);
  let fence: string | null = null;
  return body.split("\n").filter((line) => {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === marker ? null : fence ?? marker;
      return true;
    }
    if (fence) return true;
    const value = line.trim();
    if (!value) return true;
    const tokens = value.split(/\s+/);
    return !tokens.every((token) => token.startsWith("#") && hidden.has(token.slice(1)));
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function NotePreview({ title, body, notePath, onError, compact = false, showTitle = true, hiddenTags = [] }: { title?: string; body: string; notePath?: string; onError: (message: string) => void; compact?: boolean; showTitle?: boolean; hiddenTags?: string[] }) {
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const displayBody = compact ? compactPreviewBody(body, hiddenTags) : body;
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollHeight > (compact ? 136 : 360));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [displayBody, compact]);
  return <div className={compact ? "typeset-summary note-card-preview text-muted-foreground" : expanded ? "typeset-content" : "typeset-summary"}>
    {showTitle && (title || !body.trim()) && <h2 className="mb-3 text-xl font-semibold">{title || "新页面"}</h2>}
    <div className={expanded ? undefined : compact ? "max-h-[136px] overflow-hidden" : "max-h-[360px] overflow-hidden"}>
      <div ref={content} className={`break-words ${compact ? "text-sm leading-6" : "text-[15px] leading-7"}`}><Markdown body={displayBody || (compact ? "" : "还没有正文")} notePath={notePath} onError={onError} /></div>
    </div>
    {!compact && overflows && <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "收起全文" : "展开全文"}</Button>}
  </div>;
}
