import { Extension } from '@tiptap/react';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { Mapping } from '@tiptap/pm/transform';
import { Fragment, type Node } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { inlineTagMatches, inlineTags, tagKey } from './inline-tags';

// Only complete tag tokens lose their code mark, and only during a normal paste.
export function pastedInlineTags(content: Fragment): Fragment {
  const nodes: Node[] = [];
  content.forEach(node => {
    if (node.type.spec.code || node.type.name === 'preservedMarkdown') { nodes.push(node); return; }
    if (node.isText) {
      if (node.marks.some(mark => mark.type.name === 'code') && !node.marks.some(mark => mark.type.name === 'link')) {
        const matches = inlineTagMatches(node.text!);
        if (matches.length === 1 && matches[0].start === 0 && matches[0].end === node.text!.length) node = node.mark(node.marks.filter(mark => mark.type.name !== 'code'));
      }
    } else node = node.copy(pastedInlineTags(node.content));
    nodes.push(node);
  });
  return Fragment.fromArray(nodes);
}

function bodyTags(doc: Node) {
  const tags: { from: number; to: number; text: string; key: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.spec.code || node.type.name === 'preservedMarkdown') return false;
    if (!node.isText || node.marks.some(mark => ['code', 'link'].includes(mark.type.name))) return;
    const valid = new Set(inlineTags(node.text!));
    for (const match of node.text!.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)(?![\p{L}\p{N}_/-])/gu)) {
      const key = tagKey(match[1]);
      if (!valid.has(key)) continue;
      const from = pos + match.index + match[0].indexOf('#');
      const previous = from > 0 ? doc.textBetween(from - 1, from, '\n', ' ') : '';
      if (previous && !/[\s(]/u.test(previous)) continue;
      tags.push({ from, to: from + match[1].length + 1, text: `#${match[1]}`, key });
    }
  });
  return tags;
}

// Tags remain editable text; normalize user edits in the same undo step.
export const RichInlineTags = Extension.create({
  name: 'inlineTagStyle',
  addProseMirrorPlugins() {
    const editor = this.editor;
    let composition: { doc: Node; mapping: Mapping } | null = null;
    return [new Plugin({
      appendTransaction(transactions, oldState, state) {
        if (transactions.some(tr => tr.getMeta('normalizedBodyTags') || tr.getMeta('preventUpdate') || tr.getMeta('addToHistory') === false || isHistoryTransaction(tr))) { composition = null; return; }
        if (!transactions.some(tr => tr.docChanged || tr.getMeta('commitBodyTags'))) return;
        const baseline = composition ?? { doc: oldState.doc, mapping: new Mapping() };
        for (const tr of transactions) baseline.mapping.appendMapping(tr.mapping);
        if (editor.view.composing) { composition = baseline; return; }
        composition = null;
        const previous = new Map(bodyTags(baseline.doc).map(tag => [`${tag.from}:${tag.to}`, tag.text]));
        const inverse = baseline.mapping.invert();
        const tr = state.tr;
        let { anchor, head } = state.selection;
        for (const tag of bodyTags(state.doc).reverse()) {
          if (tag.text === `#${tag.key}` || previous.get(`${inverse.map(tag.from, 1)}:${inverse.map(tag.to, -1)}`) === tag.text) continue;
          const position = (pos: number) => pos < tag.from ? pos : pos <= tag.to ? tag.from + tagKey(state.doc.textBetween(tag.from, pos)).length : pos + tag.key.length + 1 - tag.text.length;
          anchor = position(anchor); head = position(head);
          tr.insertText(`#${tag.key}`, tag.from, tag.to);
        }
        if (tr.docChanged && state.selection instanceof TextSelection) tr.setSelection(TextSelection.create(tr.doc, anchor, head));
        return tr.docChanged ? tr.setMeta('normalizedBodyTags', true) : null;
      },
      props: {
        handleDOMEvents: {
          compositionend(view) {
            if (composition) queueMicrotask(() => { if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta('commitBodyTags', true)); });
            return false;
          },
        },
        decorations(state) {
          return DecorationSet.create(state.doc, bodyTags(state.doc).map(tag => Decoration.inline(tag.from, tag.to, { class: 'rich-inline-tag', 'data-tag': encodeURIComponent(tag.key) })));
        },
      },
    })];
  },
});
