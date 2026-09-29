import { wikiMarkdown } from "./wiki-markdown";
import { imageSource, openVaultLink } from "./vault-links";
import ReactMarkdown, { type Components } from "react-markdown";
import { useEffect, useRef } from "react";
import { request } from "./bridge";
import { externalUrl, internalTarget } from "./urls";
import { isBrowserVault } from "./client-mode";
import { bindNoteImage } from "./note-image";
import { getBrowserVaultBinding } from "./browser-vault";

function NoteImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const binding = isBrowserVault ? getBrowserVaultBinding() : null;
  useEffect(() => ref.current ? bindNoteImage(ref.current, src) : undefined, [src, binding]);
  return <img ref={ref} src={src.startsWith("memocard-resolve:") || isBrowserVault ? undefined : src} alt={alt} loading="lazy" />;
}

// Keep the component type stable across background refreshes so resolved images stay mounted.
const markdownImage: Components["img"] = ({ src, alt }) => typeof src === "string" && src ? <NoteImage src={src} alt={alt ?? "笔记图片"} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;

export function Markdown({ body, notePath, onError }: { body: string; notePath?: string; onError?: (message: string) => void }) {
  return <div className="markdown"><ReactMarkdown
    skipHtml
    remarkPlugins={[wikiMarkdown]}
    urlTransform={(url, key) => {
      const wiki = url.startsWith("memocard-wiki:");
      let target = url;
      try { if (wiki) target = decodeURIComponent(url.slice("memocard-wiki:".length)); } catch { return ""; }
      if (key === "src") return imageSource(target, notePath ?? "notes/note.md", wiki) ?? "";
      return externalUrl(url) ?? (internalTarget(target) ? `memocard-internal:${encodeURIComponent(JSON.stringify({ target, wiki }))}` : "");
    }}
    components={{
      a: ({ href, children }) => href ? <a href={href} onClick={(event) => {
        event.preventDefault();
        if (href.startsWith("memocard-internal:")) {
          const { target, wiki } = JSON.parse(decodeURIComponent(href.slice("memocard-internal:".length))) as { target: string; wiki: boolean };
          void openVaultLink(target, notePath ?? "notes/note.md", wiki).catch((error: unknown) => onError?.(error instanceof Error ? error.message : "无法打开笔记链接。"));
        } else void request("openExternal", { url: href }).catch(() => onError?.("无法打开链接，请在 App 中重试。"));
      }}>{children}</a> : <span>{children}</span>,
      img: markdownImage,
    }}
  >{body}</ReactMarkdown></div>;
}
