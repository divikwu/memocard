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
import { calloutColors, imageColumns } from './import-layout';
import { observeTableOverflow } from './table-overflow';

function ScrollableTable({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current, table = container?.querySelector('table');
    return container && table ? observeTableOverflow(container, table) : undefined;
  }, [children]);
  return <div ref={ref} className="typeset-scroll" role="region" aria-label="表格，可横向滚动" tabIndex={0}><table>{children}</table></div>;
}

const markdownCallout: Components["aside"] = ({ children, node }) => <aside data-callout={node?.properties.dataCallout as string | undefined} data-callout-text-color={node?.properties.dataCalloutTextColor as string | undefined} data-callout-icon={String(node?.properties.dataCalloutIcon ?? '').slice(0, 32) || undefined} role="note">{children}</aside>;
const markdownFigure: Components["figure"] = ({ children, node }) => { const columns = imageColumns(node?.properties.dataImageColumns); return <figure data-image-columns={columns?.join(',')} style={columns ? { gridTemplateColumns: columns.map(column => `${column}fr`).join(' ') } : undefined} role={columns ? 'group' : undefined} aria-label={columns ? '图片组' : undefined}>{children}</figure>; };

export type MarkdownContentProps = { body: string; notePath?: string; onError?: (message: string) => void; interactive?: boolean; components?: Components };

export function MarkdownContent({ body, notePath, onError, interactive = true, components }: MarkdownContentProps) {
  const anchorPrefix = `note-${useId()}-`;
  return <ReactMarkdown
    remarkPlugins={[remarkGfm, wikiMarkdown, remarkMath]}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, { ...defaultSchema, clobberPrefix: anchorPrefix, protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), 'memocard-wiki'], src: [...(defaultSchema.protocols?.src ?? []), 'memocard-wiki'] }, tagNames: [...(defaultSchema.tagNames ?? []).filter(tag => !['details', 'summary', 'dl', 'dt', 'dd'].includes(tag)), 'mark', 'abbr', 'kbd', 'sub', 'sup', 'figure', 'figcaption', 'aside'], attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']], abbr: ['title'], img: [...(defaultSchema.attributes?.img ?? []), ['dataWikiImage', '']], figure: [['dataImageColumns', /^\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?){1,2}$/]], aside: [['dataCallout', ...calloutColors], ['dataCalloutTextColor', ...calloutColors], 'dataCalloutIcon'] } }], [rehypeKatex, { output: 'mathml', throwOnError: false, trust: false }]]}
    urlTransform={(url, key, node) => {
      if (key === "href" && url.startsWith("#")) return `#${anchorPrefix}${url.slice(1)}`;
      const wiki = url.startsWith("memocard-wiki:");
      let target = url;
      try { if (wiki) target = decodeURIComponent(url.slice("memocard-wiki:".length)); } catch { return ""; }
      if (key === "src") return imageSource(target, notePath ?? "notes/note.md", wiki || node.properties.dataWikiImage != null) ?? "";
      return externalUrl(url) ?? (internalTarget(target) ? `memocard-internal:${encodeURIComponent(JSON.stringify({ target, wiki }))}` : "");
    }}
    components={{
      a: ({ href, children, id, title, "aria-label": ariaLabel }) => href && interactive ? <a id={id} title={title} aria-label={ariaLabel} href={href} onClick={(event) => {
        if (href.startsWith("#")) return;
        event.preventDefault();
        if (href.startsWith("memocard-internal:")) {
          const { target, wiki } = JSON.parse(decodeURIComponent(href.slice("memocard-internal:".length))) as { target: string; wiki: boolean };
          void openVaultLink(target, notePath ?? "notes/note.md", wiki).catch((error: unknown) => onError?.(error instanceof Error ? error.message : "无法打开笔记链接。"));
        } else void request("openExternal", { url: href }).catch(() => onError?.("无法打开链接，请在 App 中重试。"));
      }}>{children}</a> : <span id={id} title={title}>{children}</span>,
      aside: markdownCallout,
      figure: markdownFigure,
      table: ScrollableTable,
      ...components,
    }}
  >{body}</ReactMarkdown>;
}
