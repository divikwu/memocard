import { Extension, type Editor } from '@tiptap/react';
import { Plugin, PluginKey, TextSelection, NodeSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { createRoot } from 'react-dom/client';
import { richSectionEnd } from './rich-blocks';
import { RichHeadingFoldButton } from './RichHeadingFoldButton';

// View-only state: no node attributes, document changes, or undo entries.
const folding = new PluginKey<Set<number>>('headingFolding');

export function unfoldRichHeadings(editor: Editor) {
  if (folding.getState(editor.state)?.size) editor.view.dispatch(editor.state.tr.setMeta(folding, 'expandAll'));
}

export const RichHeadingFolding = Extension.create({
  name: 'headingFolding',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({
      key: folding,
      state: {
        init: () => new Set<number>(),
        apply(tr, previous) {
          if (tr.getMeta(folding) === 'expandAll') return new Set<number>();
          const next = new Set<number>();
          for (const pos of previous) {
            const mapped = tr.mapping.mapResult(pos, 1);
            if (!mapped.deleted && tr.doc.nodeAt(mapped.pos)?.type.name === 'heading') next.add(mapped.pos);
          }
          const toggle = tr.getMeta(folding) as number | undefined;
          if (toggle !== undefined) { if (next.has(toggle)) next.delete(toggle); else next.add(toggle); }
          else if ((tr.selectionSet || tr.docChanged) && (tr.selection instanceof TextSelection || tr.selection instanceof NodeSelection)) {
            // Programmatic navigation and cursor movement reveal their destination.
            for (const pos of next) {
              const from = pos + tr.doc.nodeAt(pos)!.nodeSize, to = richSectionEnd(tr.doc, pos);
              if (tr.selection.from < to && tr.selection.to > from) next.delete(pos);
            }
          }
          return next;
        },
      },
      props: {
        handleKeyDown(view, event) {
          if (view.composing || event.isComposing || event.keyCode === 229 || !view.state.selection.empty || !['Delete', 'Backspace'].includes(event.key)) return false;
          for (const pos of folding.getState(view.state)!) {
            const heading = view.state.doc.nodeAt(pos)!, selection = view.state.selection;
            const boundary = event.key === 'Delete' ? pos + heading.nodeSize - 1 : richSectionEnd(view.state.doc, pos) + 1;
            if (selection.from !== boundary) continue;
            view.dispatch(view.state.tr.setMeta(folding, pos).setMeta('addToHistory', false));
            return true;
          }
          return false;
        },
        decorations(state) {
          const folded = folding.getState(state)!, decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return;
            const from = pos + node.nodeSize, to = richSectionEnd(state.doc, pos);
            if (from === to) return;
            decorations.push(Decoration.node(pos, from, { class: 'rich-foldable-heading' }));
            decorations.push(Decoration.widget(pos + 1, (_view, getPos) => {
              const dom = document.createElement('span');
              dom.className = 'rich-heading-fold-widget'; dom.contentEditable = 'false';
              const root = createRoot(dom);
              root.render(<RichHeadingFoldButton editor={editor} getPos={getPos} folding={folding} />);
              return Object.assign(dom, { dispose: () => root.unmount() });
            }, { key: `heading-fold-${pos}`, side: -1, stopEvent: () => true, ignoreSelection: true,
              destroy: dom => { queueMicrotask(() => (dom as HTMLElement & { dispose: () => void }).dispose()); },
            }));
            if (folded.has(pos)) state.doc.nodesBetween(from, to, (child, at) => {
              decorations.push(Decoration.node(at, at + child.nodeSize, { hidden: '', class: 'rich-folded-content' })); return false;
            });
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});
