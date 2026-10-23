import { useEditorState, type Editor } from '@tiptap/react';
import { TextSelection, type PluginKey } from '@tiptap/pm/state';
import { Button } from '@base-ui/react/button';
import type { RichIcon } from './rich-editor-core';
import { richSectionEnd } from './rich-blocks';

export function createRichHeadingFoldButton(ChevronRight: RichIcon) {
return function RichHeadingFoldButton({ editor, getPos, folding }: { editor: Editor; getPos: () => number | undefined; folding: PluginKey<Set<number>> }) {
  const state = useEditorState({ editor, selector: ({ editor: e }) => {
    const pos = getPos();
    return { folded: pos !== undefined && !!folding.getState(e.state)?.has(pos - 1), title: pos === undefined ? '' : e.state.doc.nodeAt(pos - 1)?.textContent ?? '' };
  } });
  return <Button className="rich-heading-fold" aria-expanded={!state.folded} aria-label={`${state.folded ? '展开' : '收起'}“${state.title || '无标题'}”章节`}
    onMouseDown={event => event.preventDefault()} onClick={() => {
      const widgetPos = getPos();
      if (widgetPos === undefined || editor.view.composing) return;
      const pos = widgetPos - 1, node = editor.state.doc.nodeAt(pos);
      if (node?.type.name !== 'heading') return;
      const tr = editor.state.tr.setMeta(folding, pos).setMeta('addToHistory', false);
      const from = pos + node.nodeSize, to = richSectionEnd(tr.doc, pos);
      if (!state.folded && tr.selection.from < to && tr.selection.to > from) tr.setSelection(TextSelection.create(tr.doc, from - 1));
      editor.view.dispatch(tr);
    }}><ChevronRight size={16} aria-hidden="true" /></Button>;
}
}
