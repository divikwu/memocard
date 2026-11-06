import { useLayoutEffect, useState, type RefObject } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { AllSelection, NodeSelection } from '@tiptap/pm/state';
import { BlockRangeSelection } from './rich-block-selection';
import { richBlockHighlightPath } from './rich-block-frame';

const selectedBlock = '.rich-selected-block, .ProseMirror-selectednode';

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
      setPath(elements.map(element => richBlockHighlightPath(element, origin)).join(''));
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
