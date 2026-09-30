import { Mark, Node, type Editor } from '@tiptap/react';
import { DOMSerializer } from '@tiptap/pm/model';

export const semanticTags = ['mark', 'abbr', 'kbd', 'sup', 'sub', 'details', 'summary', 'figure', 'figcaption', 'dl', 'dt', 'dd'];
export function semanticExtensions(getEditor: () => Editor | null) {
  const marks = ['mark', 'abbr', 'kbd', 'sup', 'sub'].map(tag => Mark.create({
    name: tag,
    addAttributes: () => tag === 'abbr' ? { title: { default: '' } } : {},
    parseHTML: () => [{ tag }],
    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes, 0],
    renderMarkdown: (node, helpers) => `<${tag}${tag === 'abbr' ? ` title="${String(node.attrs?.title ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"` : ''}>${helpers.renderChildren(node)}</${tag}>`,
  }));
  const nodes = ['details', 'summary', 'figure', 'figcaption', 'dl', 'dt', 'dd'].map(tag => Node.create({
    name: tag, group: 'block', content: ['summary', 'figcaption', 'dt'].includes(tag) ? 'inline*' : 'block+',
    defining: true,
    parseHTML: () => [{ tag }],
    renderHTML: () => [tag, tag === 'details' ? { open: '' } : {}, 0],
    renderMarkdown: node => {
      const editor = getEditor();
      if (!editor) return '';
      const dom = DOMSerializer.fromSchema(editor.schema).serializeNode(editor.schema.nodeFromJSON(node)) as HTMLElement;
      // The disclosure stays open while editing; do not persist that UI state.
      if (tag === 'details') dom.removeAttribute('open');
      return dom.outerHTML;
    },
  }));
  return [...marks, ...nodes];
}
export const WikiLink = Mark.create({
  name: 'wikiLink', inclusive: false,
  addAttributes: () => ({ target: { default: '' } }),
  parseHTML: () => [{ tag: 'a[data-wiki-target]', getAttrs: element => ({ target: element.getAttribute('data-wiki-target') }) }],
  renderHTML: ({ HTMLAttributes }) => ['a', { 'data-wiki-target': HTMLAttributes.target, role: 'link', tabindex: 0 }, 0],
  markdownTokenizer: {
    name: 'wikiLink', level: 'inline', start: src => src.indexOf('[['),
    tokenize: src => { const match = /^\[\[([^\]\n]+)\]\]/.exec(src); return match ? { type: 'wikiLink', raw: match[0], text: match[1] } : undefined; },
  },
  parseMarkdown: token => {
    const [target, label] = String(token.text).split('|');
    return { type: 'text', text: label ?? target, marks: [{ type: 'wikiLink', attrs: { target } }] };
  },
  renderMarkdown: (node, helpers) => {
    const text = helpers.renderChildren(node), target = String(node.attrs?.target ?? '');
    return `[[${target}${text === target ? '' : `|${text}`}]]`;
  },
});
export const FootnoteReference = Node.create({
  name: 'footnoteReference', inline: true, group: 'inline', atom: true,
  addAttributes: () => ({ label: { default: '' } }),
  parseHTML: () => [{ tag: 'sup[data-footnote]' }],
  renderHTML: ({ node }) => ['sup', { 'data-footnote': node.attrs.label }, String(node.attrs.label)],
  markdownTokenizer: {
    name: 'footnoteReference', level: 'inline', start: src => src.indexOf('[^'),
    tokenize: src => { const match = /^\[\^([^\]\n]+)\]/.exec(src); return match ? { type: 'footnoteReference', raw: match[0], text: match[1] } : undefined; },
  },
  parseMarkdown: token => ({ type: 'footnoteReference', attrs: { label: token.text } }),
  renderMarkdown: node => `[^${node.attrs?.label}]`,
});
export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition', group: 'block', content: 'block+', defining: true,
  addAttributes: () => ({ label: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-footnote-definition]' }],
  renderHTML: ({ node }) => ['div', { 'data-footnote-definition': node.attrs.label, class: 'rich-footnote' }, 0],
  renderMarkdown: (node, helpers) => `[^${node.attrs?.label}]: ${helpers.renderChildren(node, '\n\n').replace(/\n/g, '\n    ')}`,
});
