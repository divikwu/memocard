import type { NodeViewRendererProps } from '@tiptap/react';
import { imageRow, setImageWidths } from './rich-image-layout';
import { imageColumns } from './import-layout';

export function imageRowView({ node, editor, getPos }: NodeViewRendererProps) {
  const dom = document.createElement('div'), contentDOM = document.createElement('figure'), controls = document.createElement('div');
  dom.className = 'rich-image-row'; controls.className = 'rich-image-column-controls'; controls.contentEditable = 'false';
  dom.append(contentDOM, controls);
  let current = node;
  let lastEditable = editor.isEditable;
  let gesture: { pointer: number; x: number; width: number; widths: number[]; index: number; doc: typeof editor.state.doc; button: HTMLButtonElement } | null = null;
  let preview: number[] | null = null;
  function paint(widths: number[] | null) {
    contentDOM.style.gridTemplateColumns = widths?.map(width => `${width}fr`).join(' ') ?? '';
    if (widths) [...controls.children].forEach((control, i) => {
      const total = widths.reduce((a, b) => a + b, 0), fraction = widths.slice(0, i + 1).reduce((a, b) => a + b, 0) / total;
      (control as HTMLElement).style.left = `calc(${fraction * 100}% + ${(i + .5 - fraction * (widths.length - 1)) * 16}px)`;
      control.setAttribute('aria-valuenow', String(Math.round(widths[i] / (widths[i] + widths[i + 1]) * 100)));
    });
  }
  function cancel() {
    const previous = gesture; gesture = null; preview = null; paint(imageColumns(current.attrs.columns));
    if (previous?.button.hasPointerCapture(previous.pointer)) previous.button.releasePointerCapture(previous.pointer);
    window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key, true);
  }
  function update(next: typeof node) {
    if (next.type !== node.type) return false;
    if (gesture && gesture.doc !== editor.state.doc) cancel();
    current = next;
    const widths = imageColumns(next.attrs.columns), pos = getPos(), row = pos == null ? null : imageRow(editor, pos);
    if (widths) { contentDOM.setAttribute('data-image-columns', widths.join(',')); contentDOM.setAttribute('role', 'group'); contentDOM.setAttribute('aria-label', '图片组'); }
    else { contentDOM.removeAttribute('data-image-columns'); contentDOM.removeAttribute('role'); contentDOM.removeAttribute('aria-label'); }
    if (!gesture) paint(widths);
    const count = editor.isEditable && row && widths?.length === row.images.length ? widths.length - 1 : 0;
    if (controls.childElementCount !== count) {
      controls.replaceChildren();
      for (let i = 0; i < count; i++) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'rich-image-column-resize';
        button.setAttribute('role', 'separator'); button.setAttribute('aria-orientation', 'vertical'); button.setAttribute('aria-label', `调整第 ${i + 1}、${i + 2} 列宽度`);
        button.setAttribute('aria-valuemin', '15'); button.setAttribute('aria-valuemax', '85');
        button.title = '拖动调整列宽；方向键微调；双击等宽';
        button.addEventListener('pointerdown', event => {
          const pos = getPos(), row = pos == null ? null : imageRow(editor, pos);
          if (gesture || event.button !== 0 || !editor.isEditable || editor.view.composing || !row) return;
          event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId);
          const bounds = contentDOM.getBoundingClientRect(), gap = parseFloat(getComputedStyle(contentDOM).columnGap) || 16;
          gesture = { pointer: event.pointerId, x: event.clientX, width: bounds.width - gap * (row.widths.length - 1), widths: row.widths, index: i, doc: editor.state.doc, button };
          window.addEventListener('blur', cancel); window.addEventListener('keydown', key, true);
        });
        button.addEventListener('pointermove', event => {
          if (!gesture || gesture.pointer !== event.pointerId || gesture.width <= 0) return;
          const { widths, index, x, width } = gesture, total = widths.reduce((a, b) => a + b, 0), pair = widths[index] + widths[index + 1];
          const left = Math.max(pair * .15, Math.min(pair * .85, widths[index] + (event.clientX - x) / width * total));
          preview = [...widths]; preview[index] = Math.round(left * 1000) / 1000; preview[index + 1] = Math.round((pair - left) * 1000) / 1000; paint(preview);
        });
        button.addEventListener('pointerup', event => {
          if (!gesture || gesture.pointer !== event.pointerId) return;
          const widths = preview, valid = gesture.doc === editor.state.doc, pos = getPos(); cancel();
          if (valid && widths && pos != null) setImageWidths(editor, pos, widths);
        });
        button.addEventListener('pointercancel', cancel); button.addEventListener('lostpointercapture', cancel);
        button.addEventListener('keydown', event => {
          if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
          if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
          event.preventDefault(); const pos = getPos(), row = pos == null ? null : imageRow(editor, pos);
          if (!row) return;
          const widths = [...row.widths], pair = widths[i] + widths[i + 1];
          widths[i] = event.key === 'Home' ? pair / 2 : Math.max(pair * .15, Math.min(pair * .85, widths[i] + pair * (event.key === 'ArrowLeft' ? -.02 : .02)));
          widths[i + 1] = pair - widths[i]; setImageWidths(editor, row.pos, widths.map(width => Math.round(width * 1000) / 1000)); button.focus();
        });
        button.addEventListener('dblclick', () => { const pos = getPos(); if (pos != null) setImageWidths(editor, pos, Array(count + 1).fill(1)); });
        controls.append(button);
      }
    }
    if (!gesture) paint(widths);
    return true;
  }
  update(node);
  const editable = () => {
    if (gesture && gesture.doc !== editor.state.doc) cancel();
    if (lastEditable !== editor.isEditable) { lastEditable = editor.isEditable; update(current); }
  };
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel(); };
  editor.on('transaction', editable);
  return { dom, contentDOM, update, stopEvent: (event: Event) => controls.contains(event.target as globalThis.Node),
    ignoreMutation: (mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }) => controls.contains(mutation.target) || mutation.type === 'attributes' && mutation.target === contentDOM,
    destroy() { cancel(); editor.off('transaction', editable); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key, true); },
  };
}
