import "./typeset.css";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { wikiMarkdown } from "./wiki-markdown";
import { imageSource, openVaultLink } from "./vault-links";
import ReactMarkdown, { type Components } from "react-markdown";
import { useEffect, useRef, useId } from "react";
import { request } from "./bridge";
import { externalUrl, internalTarget } from "./urls";
import { isBrowserVault } from "./client-mode";
import { bindNoteImage } from "./note-image";
import { getBrowserVaultBinding } from "./browser-runtime";

function NoteImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const binding = isBrowserVault ? getBrowserVaultBinding() : null;
  useEffect(() => ref.current ? bindNoteImage(ref.current, src) : undefined, [src, binding]);
  return <img ref={ref} src={src.startsWith("memocard-resolve:") || isBrowserVault ? undefined : src} alt={alt} loading="lazy" />;
}

// Keep the component type stable across background refreshes so resolved images stay mounted.
const markdownImage: Components["img"] = ({ src, alt }) => typeof src === "string" && src ? <NoteImage src={src} alt={alt ?? "笔记图片"} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;

export function Markdown({ body, notePath, onError }: { body: string; notePath?: string; onError?: (message: string) => void }) {
  const anchorPrefix = `note-${useId()}-`;
  return <div className="markdown typeset"><ReactMarkdown
    remarkPlugins={[remarkGfm, wikiMarkdown, remarkMath]}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, { ...defaultSchema, clobberPrefix: anchorPrefix, protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), 'memocard-wiki'], src: [...(defaultSchema.protocols?.src ?? []), 'memocard-wiki'] }, tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'abbr', 'kbd', 'sub', 'sup', 'details', 'summary', 'figure', 'figcaption', 'dl', 'dt', 'dd'], attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']], abbr: ['title'] } }], [rehypeKatex, { output: 'mathml', throwOnError: false, trust: false }]]}
    urlTransform={(url, key) => {
      if (key === "href" && url.startsWith("#")) return `#${anchorPrefix}${url.slice(1)}`;
      const wiki = url.startsWith("memocard-wiki:");
      let target = url;
      try { if (wiki) target = decodeURIComponent(url.slice("memocard-wiki:".length)); } catch { return ""; }
      if (key === "src") return imageSource(target, notePath ?? "notes/note.md", wiki) ?? "";
      return externalUrl(url) ?? (internalTarget(target) ? `memocard-internal:${encodeURIComponent(JSON.stringify({ target, wiki }))}` : "");
    }}
    components={{
      a: ({ href, children, id, title, "aria-label": ariaLabel }) => href ? <a id={id} title={title} aria-label={ariaLabel} href={href} onClick={(event) => {
        if (href.startsWith("#")) return;
        event.preventDefault();
        if (href.startsWith("memocard-internal:")) {
          const { target, wiki } = JSON.parse(decodeURIComponent(href.slice("memocard-internal:".length))) as { target: string; wiki: boolean };
          void openVaultLink(target, notePath ?? "notes/note.md", wiki).catch((error: unknown) => onError?.(error instanceof Error ? error.message : "无法打开笔记链接。"));
        } else void request("openExternal", { url: href }).catch(() => onError?.("无法打开链接，请在 App 中重试。"));
      }}>{children}</a> : <span>{children}</span>,
      img: markdownImage,
      table: ({ children }) => <div className="typeset-scroll" role="region" aria-label="表格，可横向滚动" tabIndex={0}><table>{children}</table></div>,
    }}
  >{body}</ReactMarkdown></div>;
}
