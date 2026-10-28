import type { NodeViewRendererProps } from '@tiptap/react';
import { calloutColor } from './import-layout';

export type CalloutIconTarget = { anchor: HTMLButtonElement; getPos: () => number | undefined };

export function calloutView({ node, editor, getPos }: NodeViewRendererProps, editIcon: (target: CalloutIconTarget) => void) {
  const dom = document.createElement('aside'), contentDOM = document.createElement('div'), button = document.createElement('button');
  contentDOM.className = 'rich-callout-content';
  button.className = 'rich-callout-icon'; button.type = 'button'; button.contentEditable = 'false';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('mousedown', event => event.preventDefault());
  button.addEventListener('click', () => { if (editor.isEditable) editIcon({ anchor: button, getPos }); });
  dom.append(button, contentDOM);
  function update(current: typeof node) {
    if (current.type !== node.type) return false;
    for (const [name, value] of Object.entries({ 'data-callout': calloutColor(current.attrs.color), 'data-callout-text-color': calloutColor(current.attrs.textColor), 'data-callout-icon': current.attrs.icon || null, role: current.attrs.color ? 'note' : null })) {
      if (value) dom.setAttribute(name, String(value)); else dom.removeAttribute(name);
    }
    button.textContent = current.attrs.icon || '+';
    button.setAttribute('aria-label', current.attrs.icon ? '更改标注图标' : '添加标注图标');
    button.title = current.attrs.icon ? '更改图标' : '添加图标';
    button.hidden = !current.attrs.icon || !current.attrs.color || !editor.isEditable;
    return true;
  }
  update(node);
  const editable = () => { button.hidden = !dom.hasAttribute('data-callout-icon') || !dom.hasAttribute('data-callout') || !editor.isEditable; };
  editor.on('transaction', editable);
  return { dom, contentDOM, update, stopEvent: (event: Event) => button.contains(event.target as globalThis.Node), ignoreMutation: (mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }) => button.contains(mutation.target) || mutation.type === 'attributes' && mutation.target === dom, destroy: () => editor.off('transaction', editable) };
}
