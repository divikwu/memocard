import ReactMarkdown from "react-markdown";
import { useEffect, useRef } from "react";
import { request } from "./bridge";
import { assetUrl, externalUrl } from "./urls";
import { isBrowserVault } from "./client-mode";
import { bindNoteImage } from "./note-image";
import { getBrowserVaultBinding } from "./browser-vault";

function NoteImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const binding = isBrowserVault ? getBrowserVaultBinding() : null;
  useEffect(() => ref.current ? bindNoteImage(ref.current, src) : undefined, [src, binding]);
  return <img ref={ref} src={isBrowserVault ? undefined : src} alt={alt} loading="lazy" />;
}

export function Markdown({ body, notePath, onError }: { body: string; notePath?: string; onError?: (message: string) => void }) {
  return <div className="markdown"><ReactMarkdown
    skipHtml
    urlTransform={(url, key) => (key === "src" ? assetUrl(url, notePath) : externalUrl(url)) ?? ""}
    components={{
      a: ({ href, children }) => href ? <a href={href} onClick={(event) => {
        event.preventDefault();
        void request("openExternal", { url: href }).catch(() => onError?.("无法打开链接，请在 App 中重试。"));
      }}>{children}</a> : <span>{children}</span>,
      img: ({ src, alt }) => typeof src === "string" && src ? <NoteImage src={src} alt={alt ?? "笔记图片"} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>,
    }}
  >{body}</ReactMarkdown></div>;
}
