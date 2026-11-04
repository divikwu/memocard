import type { ReactElement } from "react";
import type { Components } from "react-markdown";
import { MarkdownContent, type MarkdownContentProps } from "../../src/markdown-content";
import { MermaidContent, VaultImage } from "./NoteMedia";

export { MermaidContent, VaultImage, ImageViewer } from "./NoteMedia";
export type { VaultImageProps } from "./NoteMedia";

const imageRenderer: Components["img"] = ({ src, alt, width, height }) => typeof src === "string" && src ? <VaultImage source={src} alt={alt ?? "笔记图片"} loading="lazy" width={width} height={height} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;
const compactImageRenderer: Components["img"] = ({ src, alt, width, height }) => typeof src === "string" && src ? <VaultImage source={src} alt={alt ?? "笔记图片"} loading="lazy" width={width} height={height} interactive={false} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;
const preRenderer: Components["pre"] = ({ children }) => {
  const code = children as ReactElement<{ className?: string; children?: string }>;
  return code?.props?.className === "language-mermaid" ? <MermaidContent source={String(code.props.children ?? "").replace(/\n$/, "")}><pre>{children}</pre></MermaidContent> : <pre>{children}</pre>;
};
const compactTableRenderer: Components["table"] = ({ children }) => <div className="typeset-scroll" tabIndex={-1}><table>{children}</table></div>;
const compactPreRenderer: Components["pre"] = ({ children }) => <pre tabIndex={-1}>{children}</pre>;
const compactTaskRenderer: Components["input"] = ({ checked }) => <span className="note-task-indicator" aria-hidden="true" data-checked={checked === true} />;

export function NoteMarkdown({ compact = false, interactive = true, ...props }: Pick<MarkdownContentProps, "body" | "notePath" | "onError"> & { compact?: boolean; interactive?: boolean }) {
  return <div className="markdown typeset typeset-memocard ui-note-markdown" data-compact={compact || undefined}>
    <MarkdownContent {...props} interactive={interactive} components={interactive ? { img: imageRenderer, pre: preRenderer } : { img: compactImageRenderer, pre: compactPreRenderer, table: compactTableRenderer, input: compactTaskRenderer }} />
  </div>;
}
