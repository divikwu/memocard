import { Extension, Node, type Editor, type JSONContent } from '@tiptap/react';
import { DOMSerializer, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { semanticTags } from './rich-semantic';
import { parser, GFM } from '@lezer/markdown';

const markdownParser = parser.configure(GFM);
const sourceTypes = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'horizontalRule', 'image', 'wikiImage', 'table', 'blockMath', 'footnoteDefinition', 'figure', 'figcaption', 'aside'];
export const SourceMetadata = Extension.create({
  name: 'sourceMetadata',
  addGlobalAttributes: () => [{ types: sourceTypes, attributes: {
    original: { default: null, rendered: false },
    fingerprint: { default: null, rendered: false },
    separator: { default: null, rendered: false },
  } }],
});

// Unsupported Markdown stays in the document instead of disappearing on the next save.
export const PreservedMarkdown = Node.create({
  name: 'preservedMarkdown', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ source: { default: '' }, separator: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-preserved-markdown]' }],
  renderHTML: () => ['div', { 'data-preserved-markdown': '' }],
  renderMarkdown: node => String(node.attrs?.source ?? ''),
});

function fingerprint(node: JSONContent): string {
  const clean = (value: JSONContent): JSONContent => {
    const attrs = { ...value.attrs };
    delete attrs.original; delete attrs.fingerprint; delete attrs.separator; delete attrs.noteEdit;
    return { ...value, attrs: Object.keys(attrs).length ? attrs : undefined, content: value.content?.map(clean) };
  };
  return JSON.stringify(clean(node));
}

function hasHtmlMarks(node: JSONContent): boolean {
  return !!node.marks?.some(mark => ['mark', 'abbr', 'kbd', 'sup', 'sub'].includes(mark.type)) || !!node.content?.some(hasHtmlMarks);
}

export class MarkdownSource {
  private original = '';
  private initial: string[] = [];
  private serialized = new WeakMap<ProseMirrorNode, { fingerprint: string; raw: string }>();
  private prefix = '';
  private suffix = '';
  private eol = '\n';
  parse(editor: Editor, source: string): JSONContent {
    this.original = source;
    this.serialized = new WeakMap();
    this.eol = source.includes('\r\n') ? '\r\n' : '\n';
    const tree = markdownParser.parse(source);
    const ranges: { from: number; to: number }[] = [];
    for (let node = tree.topNode.firstChild; node; node = node.nextSibling) ranges.push({ from: node.from, to: source[node.to - 1] === '\r' ? node.to - 1 : node.to });
    // A footnote may span paragraphs. Lezer GFM does not group footnote definitions.
    const footnotes: { from: number; to: number }[] = [];
    const lines = Array.from(source.matchAll(/[^\r\n]*(?:\r?\n|$)/g)).filter(line => line[0]);
    for (let i = 0; i < lines.length; i++) {
      if (!/^\[\^[^\]]+\]:/.test(lines[i][0])) continue;
      let context: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(lines[i].index!, 1);
      let literal = false;
      while (context) { if (['FencedCode', 'CodeBlock', 'HTMLBlock', 'CommentBlock'].includes(context.name)) literal = true; context = context.parent; }
      if (literal) continue;
      let end = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^(?: {4}|\t)\S|^(?: {4}|\t) +\S/.test(lines[j][0])) end = j;
        else if (lines[j][0].trim()) break;
      }
      footnotes.push({ from: lines[i].index!, to: lines[end].index! + lines[end][0].replace(/\r?\n$/, '').length });
      i = end;
    }
    for (const footnote of footnotes) {
      for (let i = ranges.length - 1; i >= 0; i--) if (ranges[i].from >= footnote.from && ranges[i].from < footnote.to) ranges.splice(i, 1);
      ranges.push(footnote);
    }
    ranges.sort((a, b) => a.from - b.from);
    this.prefix = source.slice(0, ranges[0]?.from ?? source.length);
    this.suffix = ranges.length ? source.slice(ranges[ranges.length - 1].to) : '';
    const definitions = ranges.map(range => source.slice(range.from, range.to)).filter(raw => /^\s*\[[^\]^][^\]]*\]:/.test(raw)).join('\n');
    const content: JSONContent[] = [];
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i], raw = source.slice(range.from, range.to);
      const separator = source.slice(range.to, ranges[i + 1]?.from ?? source.length);
      const footnote = /^\[\^([^\]]+)\]:[ \t]*(.*)$/s.exec(raw);
      const parsed = footnote && editor.schema.nodes.footnoteDefinition ? [{ type: 'footnoteDefinition', attrs: { label: footnote[1] }, content: new MarkdownSource().parse(editor, footnote[2].replace(/\r?\n(?: {4}|\t)/g, '\n')).content }] : editor.markdown!.parse(raw + (definitions ? '\n\n' + definitions : '')).content ?? [];
      // HTML and reference definitions need their exact syntax and context preserved.
      const html: string[] = [];
      markdownParser.parse(raw).iterate({ enter(node) {
        if (node.name === 'HTMLTag' || node.name === 'HTMLBlock' || node.name === 'CommentBlock' || node.name === 'Comment') { html.push(raw.slice(node.from, node.to)); return false; }
      } });
      const knownTags = [...semanticTags, 'p', 'strong', 'b', 'em', 'i', 's', 'del', 'strike', 'u', 'a', 'code', 'pre', 'br', 'ul', 'ol', 'li', 'blockquote', 'hr', 'img', 'table', 'caption', 'tfoot', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      const unsupported = parsed[0]?.type !== 'codeBlock' && (
        /^\s*\[[^\]^][^\]]*\]:/im.test(raw) || html.some(fragment => fragment.includes('<!--') || Array.from(fragment.matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)).some(match => !knownTags.includes(match[1].toLowerCase())))
      );
      if (parsed.length !== 1 || unsupported || !sourceTypes.includes(parsed[0].type ?? '')) {
        content.push({ type: 'preservedMarkdown', attrs: { source: raw, separator } });
      } else {
        const node = parsed[0];
        // Normalize default schema attributes before computing the comparison key.
        const normalized = editor.schema.nodeFromJSON(node).toJSON() as JSONContent;
        normalized.attrs = { ...normalized.attrs, original: raw, fingerprint: fingerprint(normalized), separator };
        content.push(normalized);
      }
    }
    const doc = { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
    this.initial = [];
    editor.schema.nodeFromJSON(doc).forEach(node => this.initial.push(node.attrs.fingerprint ?? fingerprint(node.toJSON())));
    return doc;
  }
  serialize(editor: Editor): string {
    const { doc } = editor.state;
    const count = doc.childCount, defaultSeparator = this.eol.repeat(2);
    let original = count === this.initial.length;
    const parts: string[] = [];
    doc.forEach((node, _offset, i) => {
      // ProseMirror shares immutable blocks across edits. Cache their text, not
      // their position-dependent separators, so moving a block stays safe.
      let block = this.serialized.get(node);
      if (!block) {
        const json = node.toJSON();
        const key = fingerprint(json);
        let raw: string;
        if (node.type.name === 'preservedMarkdown') raw = String(node.attrs.source ?? '');
        else if (node.attrs.original != null && node.attrs.fingerprint === key) raw = String(node.attrs.original);
        // Mixed HTML marks and Markdown delimiters can reopen as literal punctuation.
        else if (hasHtmlMarks(json) || node.type.name === 'paragraph' && /^\s*<p(?:\s|>)/i.test(String(node.attrs.original ?? ''))) {
          raw = (DOMSerializer.fromSchema(editor.schema).serializeNode(node) as HTMLElement).outerHTML;
        } else raw = editor.markdown!.serialize({ type: 'doc', content: [json] }).replace(/^\n+|\n+$/g, '').replace(/\r?\n/g, this.eol);
        block = { fingerprint: key, raw };
        this.serialized.set(node, block);
      }
      original &&= block.fingerprint === this.initial[i];
      parts.push(block.raw, i < count - 1 ? node.attrs.separator || defaultSeparator : this.suffix);
    });
    if (original) return this.original;
    if (count === 1 && doc.firstChild?.type.name === 'paragraph' && !doc.firstChild.childCount) return '';
    return this.prefix + parts.join('');
  }
}
