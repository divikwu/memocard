import { DOMSerializer } from '@tiptap/pm/model';
import type { NodeViewRendererProps } from '@tiptap/react';

export function wrapRichBlock(body: globalThis.Node, insetSurface = false) {
  const frame = document.createElement('div');
  frame.className = 'rich-block-frame';
  frame.append(insetSurface ? insetRichBlockSurface(body) : body);
  return frame;
}

export function insetRichBlockSurface(body: globalThis.Node) {
  // Keep the editing inset outside the surface's own border and padding.
  const content = document.createElement('div');
  content.className = 'rich-block-content';
  content.append(body);
  return content;
}

export function framedRichBlockView({ node, view, getPos }: NodeViewRendererProps) {
  const { dom, contentDOM } = DOMSerializer.renderSpec(document, node.type.spec.toDOM!(node));
  const type = node.type.name;
  const paragraph = type === 'paragraph';
  if (paragraph || type === 'heading' || type === 'footnoteDefinition') {
    const pos = getPos();
    if (pos === undefined || view.state.doc.resolve(pos).depth !== 0) return { dom, contentDOM };
  }
  if (type === 'heading') {
    const text = document.createElement('span');
    text.className = 'rich-heading-text';
    dom.appendChild(text);
    return { dom, contentDOM: text };
  }
  const frame = wrapRichBlock(dom, type === 'blockquote' || type === 'horizontalRule');
  if (paragraph) frame.classList.add('rich-paragraph-block');
  return { dom: frame, contentDOM };
}

export function richBlockBody(element: HTMLElement) {
  const child = element.firstElementChild;
  if (!(child instanceof HTMLElement)) return element;
  if (child.classList.contains('rich-heading-text')) return child;
  if (!element.classList.contains('rich-block-frame')) return element;
  return child.classList.contains('rich-block-content') && child.firstElementChild instanceof HTMLElement
    ? child.firstElementChild : child;
}

export function richBlockBounds(element: HTMLElement, mode: 'content' | 'highlight' = 'content') {
  const bounds = element.getBoundingClientRect();
  let { top, bottom } = bounds;
  const list = element.matches('li') && element.parentElement?.matches('ul, ol') ? element.parentElement : null;
  // The marker sits outside the list item's border box, in its list's gutter.
  const left = list ? list.getBoundingClientRect().left + (parseFloat(getComputedStyle(list).paddingInlineEnd) || 0) : bounds.left;
  const topLevel = element.parentElement?.matches('.ui-note-markdown.typeset-memocard.rich-editor-content');
  const heading = element.matches('h1,h2,h3,h4,h5,h6');
  if (mode === 'content' && topLevel && heading) {
    // Heading layout padding stays outside the editing hit area.
    const style = getComputedStyle(element);
    top += parseFloat(style.paddingTop) || 0;
    bottom -= parseFloat(style.paddingBottom) || 0;
  }
  return { left, right: bounds.right, top, bottom, width: bounds.right - left, height: bottom - top };
}

function blockHighlightBox(element: HTMLElement, origin: DOMRect) {
  const { left, top, width, height } = richBlockBounds(element, 'highlight');
  if (width <= 0 || height <= 0 || !element.getClientRects().length) return null;
  const style = getComputedStyle(element);
  const radii = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
    .map(radius => parseFloat(radius) || 0);
  return { x: left - origin.left, y: top - origin.top, width, height, radii };
}

function roundedBox({ x, y, width, height, radii }: NonNullable<ReturnType<typeof blockHighlightBox>>) {
  const [tl, tr, br, bl] = radii.map(radius => Math.min(radius, width / 2, height / 2));
  const right = x + width, bottom = y + height;
  return `M${x + tl} ${y}H${right - tr}A${tr} ${tr} 0 0 1 ${right} ${y + tr}V${bottom - br}A${br} ${br} 0 0 1 ${right - br} ${bottom}H${x + bl}A${bl} ${bl} 0 0 1 ${x} ${bottom - bl}V${y + tl}A${tl} ${tl} 0 0 1 ${x + tl} ${y}Z`;
}

export function richBlockHighlightPath(element: HTMLElement, origin: DOMRect) {
  const box = blockHighlightBox(element, origin);
  return box ? roundedBox(box) : '';
}
