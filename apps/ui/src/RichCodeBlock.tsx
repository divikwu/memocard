import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { MermaidBlock } from './MermaidBlock';

export function RichCodeBlock({ node }: NodeViewProps) {
  const language = String(node.attrs.language ?? '');
  return <NodeViewWrapper className="rich-code-block">
    <MermaidBlock source={node.textContent}><pre><NodeViewContent<'code'> as="code" spellCheck={false} className={language ? `language-${language}` : undefined} /></pre></MermaidBlock>
  </NodeViewWrapper>;
}
