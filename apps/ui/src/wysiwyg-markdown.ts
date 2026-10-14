import { Extension, Node, type Editor, type JSONContent } from '@tiptap/react';
import { DOMSerializer } from '@tiptap/pm/model';
import { semanticTags } from './rich-semantic';
import { parser, GFM } from '@lezer/markdown';

const markdownParser = parser.configure(GFM);
const sourceTypes = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'horizontalRule', 'image', 'wikiImage', 'table', 'blockMath', 'footnoteDefinition', 'details', 'summary', 'figure', 'figcaption', 'dl', 'dt', 'dd', 'aside'];
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

export class MarkdownSource {
  private original = '';
  private initial = '';
  private prefix = '';
  private suffix = '';
  private eol = '\n';
  parse(editor: Editor, source: string): JSONContent {
    this.original = source;
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
      const knownTags = [...semanticTags, 'p', 'strong', 'em', 's', 'a', 'code', 'pre', 'br', 'ul', 'ol', 'li', 'blockquote', 'hr', 'img', 'table', 'caption', 'tfoot', 'thead', 'tbody', 'tr', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
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
    this.initial = fingerprint(editor.schema.nodeFromJSON(doc).toJSON());
    return doc;
  }
  serialize(editor: Editor): string {
    const doc = editor.getJSON();
    if (fingerprint(doc) === this.initial) return this.original;
    const nodes = doc.content ?? [];
    if (nodes.length === 1 && nodes[0].type === 'paragraph' && !nodes[0].content?.length) return '';
    return this.prefix + nodes.map((node, i) => {
      const unchanged = node.attrs?.original != null && node.attrs.fingerprint === fingerprint(node);
      // Keep an HTML paragraph as HTML: Markdown delimiters can lose emphasis next to Chinese punctuation.
      const htmlParagraph = node.type === 'paragraph' && /^\s*<p(?:\s|>)/i.test(String(node.attrs?.original ?? ''));
      const raw = node.type === 'preservedMarkdown' ? String(node.attrs?.source ?? '') : unchanged ? String(node.attrs!.original) : htmlParagraph ? (DOMSerializer.fromSchema(editor.schema).serializeNode(editor.schema.nodeFromJSON(node)) as HTMLElement).outerHTML : editor.markdown!.serialize({ type: 'doc', content: [node] }).replace(/^\n+|\n+$/g, '').replace(/\r?\n/g, this.eol);
      const separator = node.attrs?.separator as string | undefined;
      return raw + (i < nodes.length - 1 ? separator || this.eol.repeat(2) : this.suffix);
    }).join('');
  }
}
