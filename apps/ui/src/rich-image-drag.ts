import { Extension, type Editor } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';
import { applyImageTransaction, imageMoveTransaction, imageRow, isLayoutImage } from './rich-image-layout';
import { richBlock } from './rich-blocks';

type Gesture = { pos: number; doc: Node; cancelled: boolean; preview: HTMLElement | null };
const gestures = new WeakMap<Editor, Gesture>();
export const isImageDragging = (editor: Editor) => gestures.has(editor);

export function beginImageDrag(editor: Editor, pos: number, event: DragEvent) {
  if (!editor.isEditable || editor.view.composing || !isLayoutImage(editor.state.doc.nodeAt(pos)) || !event.dataTransfer) { event.preventDefault(); return; }
  const gesture: Gesture = { pos, doc: editor.state.doc, cancelled: false, preview: null };
  gestures.set(editor, gesture);
  event.dataTransfer.setData('application/x-memocard-image', 'move');
  event.dataTransfer.effectAllowed = 'move';
  const dom = editor.view.nodeDOM(pos);
  if (dom instanceof HTMLElement) {
    const preview = dom.cloneNode(true) as HTMLElement;
    preview.querySelector('.rich-image-tools')?.remove(); preview.classList.remove('rich-image-dragging', 'ProseMirror-selectednode');
    Object.assign(preview.style, { position: 'fixed', left: '-10000px', top: '0', width: `${dom.getBoundingClientRect().width}px`, opacity: '1', pointerEvents: 'none' });
    preview.setAttribute('aria-hidden', 'true'); document.body.append(preview); gesture.preview = preview;
    event.dataTransfer.setDragImage(preview, 0, 0); dom.classList.add('rich-image-dragging');
  }
}

export const RichImageDrag = Extension.create<{ uiClassName: string }>({
  name: 'imageLayoutDrag',
  addOptions: () => ({ uiClassName: '' }),
  addProseMirrorPlugins() {
    const editor = this.editor, uiClassName = this.options.uiClassName;
    return [new Plugin({ view(view) {
      const guide = document.createElement('div'); guide.className = ['rich-image-drop-guide', uiClassName].filter(Boolean).join(' '); guide.setAttribute('aria-hidden', 'true');
      let target: { pos: number; side: 'left' | 'right' | 'above' | 'below' } | null = null;
      let frame = 0, x = 0, y = 0;
      let surface: HTMLElement | null = view.dom.parentElement;
      while (surface && !/auto|scroll/.test(getComputedStyle(surface).overflowY)) surface = surface.parentElement;
      const clear = () => { target = null; guide.remove(); cancelAnimationFrame(frame); frame = 0; };
      const finish = () => { clear(); gestures.get(editor)?.preview?.remove(); gestures.delete(editor); view.dom.querySelectorAll('.rich-image-dragging').forEach(dom => dom.classList.remove('rich-image-dragging')); };
      const locate = (element: EventTarget | null) => {
        target = null; guide.remove();
        const gesture = gestures.get(editor);
        if (!gesture || gesture.cancelled || gesture.doc !== view.state.doc || !(element instanceof Element)) return;
        const image = element.closest<HTMLElement>('.rich-image');
        if (!view.dom.contains(element)) return;
        const coords = image ? null : view.posAtCoords({ left: x, top: y });
        const block = coords ? richBlock(editor, coords.pos) : null;
        const pos = image ? view.posAtDOM(image, 0) : block?.pos;
        if (pos == null) return;
        const dom = image ?? view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement)) return;
        const rect = dom.getBoundingClientRect();
        const horizontal = !!image && view.dom.getBoundingClientRect().width > 400 && y > rect.top + Math.min(40, rect.height / 4) && y < rect.bottom - Math.min(40, rect.height / 4);
        const side = horizontal && x < rect.left + rect.width * .3 ? 'left' : horizontal && x > rect.right - rect.width * .3 ? 'right' : y < rect.top + rect.height / 2 ? 'above' : 'below';
        if (!imageMoveTransaction(editor, gesture.pos, pos, side)) return;
        target = { pos, side };
        const row = imageRow(editor, pos);
        const rowDOM = view.nodeDOM(row?.pos ?? pos);
        const bounds = rowDOM instanceof HTMLElement ? rowDOM.getBoundingClientRect() : rect;
        Object.assign(guide.style, side === 'left' || side === 'right'
          ? { left: `${side === 'left' ? rect.left - 3 : rect.right}px`, top: `${rect.top}px`, width: '3px', height: `${rect.height}px` }
          : { left: `${bounds.left}px`, top: `${side === 'above' ? bounds.top - 3 : bounds.bottom}px`, width: `${bounds.width}px`, height: '3px' });
        document.body.append(guide);
      };
      const scroll = () => {
        frame = 0;
        if (!gestures.has(editor) || !surface) return;
        const rect = surface.getBoundingClientRect(), margin = 48;
        const dy = y < rect.top + margin ? -10 : y > rect.bottom - margin ? 10 : 0;
        if (dy && x >= rect.left && x <= rect.right) { surface.scrollTop += dy; locate(document.elementFromPoint(x, y)); }
        frame = requestAnimationFrame(scroll);
      };
      const over = (event: DragEvent) => {
        if (!gestures.has(editor)) return;
        event.preventDefault(); event.stopPropagation(); x = event.clientX; y = event.clientY;
        locate(event.target);
        if (event.dataTransfer) event.dataTransfer.dropEffect = target ? 'move' : 'none';
        if (!frame && !gestures.get(editor)?.cancelled) frame = requestAnimationFrame(scroll);
      };
      const drop = (event: DragEvent) => {
        const gesture = gestures.get(editor);
        if (!gesture) return;
        event.preventDefault(); event.stopPropagation(); x = event.clientX; y = event.clientY; locate(event.target);
        if (target && !gesture.cancelled && gesture.doc === view.state.doc) applyImageTransaction(editor, imageMoveTransaction(editor, gesture.pos, target.pos, target.side));
        finish();
      };
      const cancel = () => { const gesture = gestures.get(editor); if (gesture) { gesture.cancelled = true; gesture.preview?.remove(); } clear(); view.dom.querySelectorAll('.rich-image-dragging').forEach(dom => dom.classList.remove('rich-image-dragging')); };
      const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gestures.has(editor)) { event.preventDefault(); cancel(); } };
      const leave = (event: DragEvent) => { if (!view.dom.contains(event.relatedTarget as globalThis.Node | null)) clear(); };
      view.dom.addEventListener('dragover', over, true); view.dom.addEventListener('drop', drop, true); view.dom.addEventListener('dragleave', leave);
      window.addEventListener('dragend', finish); window.addEventListener('keydown', key, true); window.addEventListener('blur', cancel);
      return { update() { if (gestures.get(editor)?.doc !== view.state.doc) cancel(); }, destroy() {
        finish(); view.dom.removeEventListener('dragover', over, true); view.dom.removeEventListener('drop', drop, true); view.dom.removeEventListener('dragleave', leave);
        window.removeEventListener('dragend', finish); window.removeEventListener('keydown', key, true); window.removeEventListener('blur', cancel);
      } };
    } })];
  },
});
