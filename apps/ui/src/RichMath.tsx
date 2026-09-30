import { useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import katex from 'katex';
import { editRichStructure } from './rich-blocks';

export function RichMath({ node, editor, updateAttributes, getPos }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(node.attrs.latex));
  const block = node.type.name === 'blockMath';
  function close(commit: boolean) {
    if (commit && editor.isEditable && draft.trim()) editRichStructure(editor, () => updateAttributes({ latex: draft }));
    setEditing(false);
    const pos = getPos();
    if (typeof pos === 'number') editor.commands.setNodeSelection(pos);
    editor.view.focus();
  }
  return <NodeViewWrapper as={block ? 'div' : 'span'} className={`rich-math ${block ? 'rich-math-block' : ''}`} contentEditable={false}>
    <button type="button" aria-label={block ? '编辑块公式' : '编辑行内公式'} disabled={!editor.isEditable} onClick={() => { setDraft(String(node.attrs.latex)); setEditing(true); }}>
      <span dangerouslySetInnerHTML={{ __html: katex.renderToString(editing ? draft : String(node.attrs.latex), { output: 'mathml', displayMode: block, throwOnError: false, trust: false }) }} />
    </button>
    {editing && <span className="rich-math-input">
      <input autoFocus aria-label="公式表达式" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
        event.stopPropagation();
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter') { event.preventDefault(); close(true); }
        if (event.key === 'Escape') { event.preventDefault(); close(false); }
      }} />
      <button type="button" disabled={!draft.trim()} onClick={() => close(true)}>应用公式</button>
      <button type="button" onClick={() => close(false)}>取消</button>
    </span>}
  </NodeViewWrapper>;
}
