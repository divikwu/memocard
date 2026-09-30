import { Extension } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { inlineTags } from './inline-tags';

// Decorations keep hashtags as editable text and never change Markdown storage.
export const RichInlineTags = Extension.create({
  name: 'inlineTagStyle',
  addProseMirrorPlugins() {
    return [new Plugin({
      props: {
        decorations(state) {
          const decorations: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.spec.code || node.type.name === 'preservedMarkdown') return false;
            if (!node.isText || node.marks.some(mark => ['code', 'link'].includes(mark.type.name))) return;
            const text = node.text!;
            const valid = new Set(inlineTags(text));
            for (const match of text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)(?![\p{L}\p{N}_/-])/gu)) {
              if (!valid.has(match[1])) continue;
              const from = pos + match.index + match[0].indexOf('#');
              const previous = from > 0 ? state.doc.textBetween(from - 1, from, '\n', ' ') : '';
              if (previous && !/[\s(]/u.test(previous)) continue;
              decorations.push(Decoration.inline(from, from + match[1].length + 1, { class: 'rich-inline-tag' }));
            }
          });
          return DecorationSet.create(state.doc, decorations);
        },
      },
    })];
  },
});
