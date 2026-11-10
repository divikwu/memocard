import { useEffect, useRef, useState } from "react";

export type NotePreviewProps = { title?: string; body: string; notePath?: string; onError: (message: string) => void; compact?: boolean; showTitle?: boolean; hiddenTags?: string[]; plainText?: boolean; omitImages?: boolean };

/** Keep reading available when a timeline preview exceeds its allotted height. */
export function compactPreviewBody(body: string, hiddenTags: string[]) {
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

export function useNotePreview(body: string, compact: boolean, hiddenTags: string[]) {
  const content = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const displayBody = compact ? compactPreviewBody(body, hiddenTags) : body;
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => {
      setOverflows(element.scrollHeight > (compact && viewport.current ? viewport.current.clientHeight : 360));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (compact && viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [displayBody, compact]);
  return { content, viewport, expanded, setExpanded, overflows, displayBody };
}

export function sameNotePreview(before: NotePreviewProps, after: NotePreviewProps) {
  return before.body === after.body && before.title === after.title && before.notePath === after.notePath
    && before.onError === after.onError && before.compact === after.compact && before.showTitle === after.showTitle
    && before.plainText === after.plainText && before.omitImages === after.omitImages
    && (before.hiddenTags ?? []).length === (after.hiddenTags ?? []).length
    && (before.hiddenTags ?? []).every((tag, index) => tag === after.hiddenTags?.[index]);
}
