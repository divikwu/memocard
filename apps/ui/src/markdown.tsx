import "./typeset.css";
import "./import-layout.css";
import type { Components } from "react-markdown";
import { MarkdownContent, type MarkdownContentProps } from "./markdown-content";
import { NoteImage } from "./NoteImage";
import { MermaidBlock } from "./MermaidBlock";

// Stable renderer types preserve resolved media across background refreshes.
const markdownImage: Components["img"] = ({ src, alt, width, height }) => typeof src === "string" && src ? <NoteImage source={src} alt={alt ?? "笔记图片"} loading="lazy" width={width} height={height} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;
const markdownPre: Components["pre"] = ({ children }) => {
  const code = children as React.ReactElement<{ className?: string; children?: string }>;
  return code?.props?.className === "language-mermaid" ? <MermaidBlock source={String(code.props.children ?? "").replace(/\n$/, "")}><pre>{children}</pre></MermaidBlock> : <pre>{children}</pre>;
};

export function Markdown(props: Pick<MarkdownContentProps, "body" | "notePath" | "onError">) {
  return <div className="markdown typeset"><MarkdownContent {...props} components={{ img: markdownImage, pre: markdownPre }} /></div>;
}
