import { useLayoutEffect, useState, type RefObject } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { AllSelection, NodeSelection } from '@tiptap/pm/state';
import { BlockRangeSelection } from './rich-block-selection';

const selectedBlock = '.rich-selected-block, .ProseMirror-selectednode';
const outset = 4;

function blockHighlightBox(element: HTMLElement, origin: DOMRect) {
  const body = element.querySelector<HTMLElement>(':scope > [data-node-view-wrapper]') ?? element;
  const target = body.matches('.rich-table-block') ? body.querySelector<HTMLElement>('table') ?? body
    : body.matches('.rich-image') ? body.querySelector<HTMLElement>('.ui-note-image') ?? body : body;
  const bounds = target.getBoundingClientRect(), style = getComputedStyle(target);
  let { left, top, right, bottom } = bounds;
  // Text blocks include editing space outside their visible line boxes.
  if (target.matches('p, h1, h2, h3, h4, h5, h6, ul, ol, li')) {
    top += parseFloat(style.paddingTop) || 0;
    bottom -= parseFloat(style.paddingBottom) || 0;
    if (target.matches('p, h1, h2, h3, h4, h5, h6')) {
      left += parseFloat(style.paddingLeft) || 0;
      right -= parseFloat(style.paddingRight) || 0;
    }
    if (target.matches('li') && target.parentElement?.matches('ul, ol')) left = target.parentElement.getBoundingClientRect().left;
  }
  if (target.matches('table')) {
    const scroller = target.closest('.tableWrapper');
    if (scroller) {
      const clip = scroller.getBoundingClientRect();
      left = Math.max(left, clip.left); right = Math.min(right, clip.right);
    }
  }
  if (right <= left || bottom <= top || !target.getClientRects().length) return null;
  const radii = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
    .map(radius => (parseFloat(radius) || 0) + outset);
  return { x: left - origin.left - outset, y: top - origin.top - outset, width: right - left + outset * 2, height: bottom - top + outset * 2, radii };
}

function roundedBox({ x, y, width, height, radii }: NonNullable<ReturnType<typeof blockHighlightBox>>) {
  const [tl, tr, br, bl] = radii.map(radius => Math.min(radius, width / 2, height / 2));
  const right = x + width, bottom = y + height;
  return `M${x + tl} ${y}H${right - tr}A${tr} ${tr} 0 0 1 ${right} ${y + tr}V${bottom - br}A${br} ${br} 0 0 1 ${right - br} ${bottom}H${x + bl}A${bl} ${bl} 0 0 1 ${x} ${bottom - bl}V${y + tl}A${tl} ${tl} 0 0 1 ${x + tl} ${y}Z`;
}

export function RichBlockHighlight({ editor, root }: { editor: Editor; root: RefObject<HTMLDivElement | null> }) {
  const { selection, doc } = useEditorState({ editor, selector: ({ editor }) => ({ selection: editor.state.selection, doc: editor.state.doc }) });
  const active = selection instanceof AllSelection || selection instanceof BlockRangeSelection || selection instanceof NodeSelection && selection.node.isBlock;
  const [path, setPath] = useState('');
  useLayoutEffect(() => {
    const host = root.current;
    if (!host || !active) return;
    const elements = Array.from(editor.view.dom.querySelectorAll<HTMLElement>(selectedBlock))
      .filter(element => !element.parentElement?.closest(selectedBlock));
    let frame = 0;
    const update = () => {
      frame = 0;
      const origin = host.getBoundingClientRect();
      setPath(elements.map(element => blockHighlightBox(element, origin)).filter(box => box !== null).map(roundedBox).join(''));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    elements.forEach(element => resize.observe(element));
    // Theme changes can alter radii without changing the element's dimensions.
    const attributes = new MutationObserver(schedule);
    for (let ancestor: HTMLElement | null = host; ancestor; ancestor = ancestor.parentElement) attributes.observe(ancestor, { attributes: true });
    document.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); attributes.disconnect();
      document.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule);
    };
  }, [active, editor, root, selection, doc]);
  // One filled path paints intersecting frames once, without darker overlap bands.
  return active && path ? <svg className="rich-block-highlights" aria-hidden="true" focusable="false"><path d={path} /></svg> : null;
}
