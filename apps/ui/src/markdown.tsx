import "./typeset.css";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { wikiMarkdown } from "./wiki-markdown";
import { imageSource, openVaultLink } from "./vault-links";
import ReactMarkdown, { type Components } from "react-markdown";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { request } from "./bridge";
import { externalUrl, internalTarget } from "./urls";
import { NoteImage } from './NoteImage';
import { calloutColors, imageColumns } from './import-layout';
import './import-layout.css';
import { observeTableOverflow } from './table-overflow';
import { MermaidBlock } from './MermaidBlock';

function ScrollableTable({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current, table = container?.querySelector('table');
    return container && table ? observeTableOverflow(container, table) : undefined;
  }, [children]);
  return <div ref={ref} className="typeset-scroll" role="region" aria-label="表格，可横向滚动" tabIndex={0}><table>{children}</table></div>;
}

// Keep the component type stable across background refreshes so resolved images stay mounted.
const markdownImage: Components["img"] = ({ src, alt }) => typeof src === "string" && src ? <NoteImage source={src} alt={alt ?? "笔记图片"} loading="lazy" /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;

export function Markdown({ body, notePath, onError }: { body: string; notePath?: string; onError?: (message: string) => void }) {
  const anchorPrefix = `note-${useId()}-`;
  return <div className="markdown typeset"><ReactMarkdown
    remarkPlugins={[remarkGfm, wikiMarkdown, remarkMath]}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, { ...defaultSchema, clobberPrefix: anchorPrefix, protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), 'memocard-wiki'], src: [...(defaultSchema.protocols?.src ?? []), 'memocard-wiki'] }, tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'abbr', 'kbd', 'sub', 'sup', 'details', 'summary', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'aside'], attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']], abbr: ['title'], img: [...(defaultSchema.attributes?.img ?? []), ['dataWikiImage', '']], figure: [['dataImageColumns', /^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?){1,2}$/]], aside: [['dataCallout', ...calloutColors], ['dataCalloutTextColor', ...calloutColors], 'dataCalloutIcon'] } }], [rehypeKatex, { output: 'mathml', throwOnError: false, trust: false }]]}
    urlTransform={(url, key, node) => {
      if (key === "href" && url.startsWith("#")) return `#${anchorPrefix}${url.slice(1)}`;
      const wiki = url.startsWith("memocard-wiki:");
      let target = url;
      try { if (wiki) target = decodeURIComponent(url.slice("memocard-wiki:".length)); } catch { return ""; }
      if (key === "src") return imageSource(target, notePath ?? "notes/note.md", wiki || node.properties.dataWikiImage != null) ?? "";
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
      aside: ({ children, node }) => <aside data-callout={node?.properties.dataCallout as string | undefined} data-callout-text-color={node?.properties.dataCalloutTextColor as string | undefined} data-callout-icon={String(node?.properties.dataCalloutIcon ?? '').slice(0, 32) || undefined} role="note">{children}</aside>,
      figure: ({ children, node }) => { const columns = imageColumns(node?.properties.dataImageColumns); return <figure data-image-columns={columns?.join(',')} style={columns ? { gridTemplateColumns: columns.map(column => `${column}fr`).join(' ') } : undefined} role={columns ? 'group' : undefined} aria-label={columns ? '图片组' : undefined}>{children}</figure>; },
      table: ScrollableTable,
      pre: ({ children }) => {
        const code = children as React.ReactElement<{ className?: string; children?: string }>;
        return code?.props?.className === 'language-mermaid' ? <MermaidBlock source={String(code.props.children ?? '').replace(/\n$/, '')}><pre>{children}</pre></MermaidBlock> : <pre>{children}</pre>;
      },
    }}
  >{body}</ReactMarkdown></div>;
}
