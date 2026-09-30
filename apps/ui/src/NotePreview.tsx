import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";

/** Keep reading available when a timeline preview exceeds its allotted height. */
export function NotePreview({ title, body, notePath, onError }: { title?: string; body: string; notePath?: string; onError: (message: string) => void }) {
  const content = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollHeight > 360);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [body]);
  return <div className={expanded ? "typeset-content" : "typeset-summary"}>
    {(title || !body.trim()) && <h2 className="mb-3 text-xl font-semibold">{title || "新页面"}</h2>}
    <div className={expanded ? undefined : "max-h-[360px] overflow-hidden"}>
      <div ref={content} className="break-words text-[15px] leading-7"><Markdown body={body || "还没有正文"} notePath={notePath} onError={onError} /></div>
    </div>
    {overflows && <Button variant="ghost" size="sm" className="mt-2" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "收起全文" : "展开全文"}</Button>}
  </div>;
}
