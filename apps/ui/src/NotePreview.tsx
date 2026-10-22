import { memo, useEffect, useRef, useState } from "react";
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

export const NotePreview = memo(function NotePreview({ title, body, notePath, onError, compact = false, showTitle = true, hiddenTags = [] }: { title?: string; body: string; notePath?: string; onError: (message: string) => void; compact?: boolean; showTitle?: boolean; hiddenTags?: string[] }) {
  const content = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [compactClip, setCompactClip] = useState<number | null>(null);
  const displayBody = compact ? compactPreviewBody(body, hiddenTags) : body;
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => {
      const preview = viewport.current;
      const markdown = element.querySelector<HTMLElement>(".markdown");
      if (!compact || !preview || !markdown) {
        setOverflows(element.scrollHeight > 360);
        return;
      }
      markdown.style.removeProperty("-webkit-line-clamp");
      const overflows = element.scrollHeight > preview.clientHeight;
      setOverflows(overflows);
      setCompactClip(null);
      if (!overflows || markdown.querySelector("img")) return;
      const hasTable = !!markdown.querySelector("table");
      const bottom = preview.getBoundingClientRect().bottom - (hasTable ? 20 : 0);
      const lines = new Set<number>();
      let lastBottom = element.getBoundingClientRect().top;
      const walker = document.createTreeWalker(markdown, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const row = node.parentElement?.closest("tr");
        if (row && row.getBoundingClientRect().bottom > bottom) break;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.bottom > bottom) break;
          if (rect.height > 0) {
            lines.add(Math.round(rect.top));
            lastBottom = Math.max(lastBottom, row?.getBoundingClientRect().bottom ?? rect.bottom);
          }
        }
        if (range.getBoundingClientRect().bottom > bottom) break;
      }
      if (hasTable) {
        setCompactClip(Math.max(0, lastBottom - element.getBoundingClientRect().top));
        return;
      }
      if (lines.size) {
        let count = lines.size;
        markdown.style.webkitLineClamp = String(count);
        while (count > 1 && markdown.clientHeight > preview.clientHeight) {
          markdown.style.webkitLineClamp = String(--count);
        }
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (compact && viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [displayBody, compact]);
  return <div ref={viewport} data-overflow={compact && overflows ? "true" : undefined} className={compact ? "typeset-summary note-card-preview relative h-full overflow-hidden text-muted-foreground" : expanded ? "typeset-content" : "typeset-summary"}>
    {showTitle && (title || !body.trim()) && <h2 className="mb-3 text-xl font-semibold">{title || "新内容"}</h2>}
    <div className={compactClip !== null || (!expanded && !compact) ? "overflow-hidden" : undefined} style={compact && compactClip !== null ? { maxHeight: compactClip } : !expanded && !compact ? { maxHeight: 360 } : undefined}>
      <div ref={content} className={`break-words ${compact ? "text-sm leading-relaxed" : "text-(length:--font-size-base) leading-relaxed"}`}><Markdown body={displayBody || (compact ? "" : "还没有正文")} notePath={notePath} onError={onError} /></div>
    </div>
    {compact && compactClip !== null && <span aria-hidden="true" className="absolute bottom-0 left-0 text-sm leading-normal">…</span>}
    {!compact && overflows && <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "收起全文" : "展开全文"}</Button>}
  </div>;
}, (before, after) => before.body === after.body && before.title === after.title && before.notePath === after.notePath
  && before.onError === after.onError && before.compact === after.compact && before.showTitle === after.showTitle
  && (before.hiddenTags ?? []).length === (after.hiddenTags ?? []).length
  && (before.hiddenTags ?? []).every((tag, index) => tag === after.hiddenTags?.[index]));
