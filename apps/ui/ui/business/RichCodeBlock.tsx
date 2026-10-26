import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { MermaidContent } from "./NoteMarkdown";

export function RichCodeBlock({ node }: ReactNodeViewProps) {
  const language = String(node.attrs.language ?? "");
  return <NodeViewWrapper className="rich-code-block"><MermaidContent source={node.textContent}><pre><NodeViewContent<"code"> as="code" spellCheck={false} className={language ? `language-${language}` : undefined} /></pre></MermaidContent></NodeViewWrapper>;
}
