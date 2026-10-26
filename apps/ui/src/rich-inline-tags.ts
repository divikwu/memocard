import { Extension } from '@tiptap/react';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
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

type BodyTag = { from: number; to: number; text: string; key: string };
// ProseMirror retains unchanged nodes across transactions. Store relative ranges
// per node so editing one paragraph does not reparse the rest of the note.
const tagRanges = new WeakMap<Node, BodyTag[]>();
const tagStyle = new PluginKey<DecorationSet>('inlineTagStyle');
function bodyTags(node: Node): BodyTag[] {
  const cached = tagRanges.get(node);
  if (cached) return cached;
  const tags: BodyTag[] = [];
  if (!node.type.spec.code && node.type.name !== 'preservedMarkdown') {
    if (node.isTextblock) {
      let previous = '';
      node.forEach((child, pos) => {
        if (!child.isText) { previous = child.isLeaf ? ' ' : child.textContent.slice(-1); return; }
        const text = child.text!;
        if (!child.marks.some(mark => ['code', 'link'].includes(mark.type.name))) {
          const valid = new Set(inlineTags(text));
          for (const match of text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)(?![\p{L}\p{N}_/-])/gu)) {
            const key = tagKey(match[1]), offset = match.index + match[0].indexOf('#');
            if (!valid.has(key) || offset === 0 && previous && !/[\s(]/u.test(previous)) continue;
            const from = pos + offset;
            tags.push({ from, to: from + match[1].length + 1, text: `#${match[1]}`, key });
          }
        }
        previous = text.slice(-1);
      });
    } else node.forEach((child, pos) => {
      for (const tag of bodyTags(child)) tags.push({ ...tag, from: pos + 1 + tag.from, to: pos + 1 + tag.to });
    });
  }
  tagRanges.set(node, tags);
  return tags;
}

const decoration = (tag: BodyTag, offset = 0) => Decoration.inline(offset + tag.from, offset + tag.to, { class: 'rich-inline-tag', 'data-tag': encodeURIComponent(tag.key) });

// Tags remain editable text; normalize user edits in the same undo step.
export const RichInlineTags = Extension.create({
  name: 'inlineTagStyle',
  addProseMirrorPlugins() {
    const editor = this.editor;
    let composition: { doc: Node; mapping: Mapping } | null = null;
    return [new Plugin<DecorationSet>({
      key: tagStyle,
      state: {
        init: (_, state) => DecorationSet.create(state.doc, bodyTags(state.doc).map(tag => decoration(tag))),
        apply(tr, previous) {
          if (!tr.docChanged) return previous;
          const from = tr.before.content.findDiffStart(tr.doc.content);
          if (from === null) return previous;
          // Quick capture uses an inline-only top document instead of paragraphs.
          if (tr.doc.inlineContent) return DecorationSet.create(tr.doc, bodyTags(tr.doc).map(tag => decoration(tag)));
          const ranges = [{ from, to: Math.max(from, tr.before.content.findDiffEnd(tr.doc.content)?.b ?? from) }];
          // A move or document replacement can insert content identical to the
          // old prefix. Include actual changed ranges as well as the net diff.
          tr.mapping.maps.forEach((map, index) => {
            const remaining = tr.mapping.slice(index + 1);
            map.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
              ranges.push({ from: remaining.map(newFrom, -1), to: remaining.map(newTo, 1) });
            });
          });
          let next = previous.map(tr.mapping, tr.doc);
          const blocks = new Map<number, Node>();
          for (const range of ranges) {
            const start = Math.max(0, range.from - 1), end = Math.min(tr.doc.content.size, range.to + 1);
            next = next.remove(next.find(start, end));
            // Include adjoining blocks for edits at a boundary. Untouched
            // subtrees stay mapped instead of rebuilding all decorations.
            tr.doc.nodesBetween(start, end, (node, pos) => {
              if (!node.isTextblock) return;
              blocks.set(pos, node);
              return false;
            });
          }
          const additions: Decoration[] = [];
          for (const [pos, node] of blocks) {
            next = next.remove(next.find(pos, pos + node.nodeSize));
            additions.push(...bodyTags(node).map(tag => decoration(tag, pos + 1)));
          }
          return next.add(tr.doc, additions);
        },
      },
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
          const position = (pos: number) => pos < tag.from ? pos : pos <= tag.to ? tag.from + tagKey(tag.text.slice(0, pos - tag.from)).length : pos + tag.key.length + 1 - tag.text.length;
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
        decorations: state => tagStyle.getState(state),
      },
    })];
  },
});
