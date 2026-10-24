import { useEffect, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import { request } from '../bridge';
import { inlineTagMatches, inlineTags, tagKey } from '../inline-tags';

export function useRichTagSuggestions(editor: Editor, providedNames?: string[], hostRef?: RefObject<HTMLElement | null>) {
  const [active, setActive] = useState<{ from: number; to: number; query: string; left: number; top: number } | null>(null);
  const [fetchedNames, setNames] = useState<string[]>([]);
  const names=providedNames ?? fetchedNames;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const update = () => {
      const { selection } = editor.state;
      const parent = selection.$from.parent;
      if (!editor.isEditable || editor.view.composing || !selection.empty || parent.type.spec.code || editor.isActive('code') || editor.isActive('link') || editor.isActive('wikiLink')) { setActive(null); return; }
      const before = parent.textBetween(0, selection.$from.parentOffset, '\n', '\ufffc');
      const match = /(?:^|\s)#((?:[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*\/?)?)$/u.exec(before);
      if (!match) { setActive(null); return; }
      const from=selection.$from.parentOffset-match[1].length-1;
      const text=parent.textBetween(0,parent.content.size,'\n','\ufffc');
      const probe=text.slice(0,from)+'#memocard_tag'+text.slice(selection.$from.parentOffset);
      if(!inlineTagMatches(probe).some(tag=>tag.start===from)){setActive(null);return;}
      const rect = editor.view.coordsAtPos(selection.from);
      const host = (hostRef?.current ?? editor.view.dom.closest('.rich-editor'))!.getBoundingClientRect();
      setIndex(0);
      setActive({ from: selection.from - match[1].length - 1, to: selection.from, query: tagKey(match[1]), left: Math.max(0, rect.left - host.left), top: rect.bottom - host.top + 4 });
    };
    const blur = () => setActive(null);
    editor.on('transaction', update); editor.on('blur', blur);
    return () => { editor.off('transaction', update); editor.off('blur', blur); };
  }, [editor,hostRef]);
  const open = Boolean(active);
  useEffect(() => {
    if (!open || providedNames) return;
    let cancelled = false;
    void request<{ tags: { name: string }[] }>('listTags').then(result => { if (!cancelled) setNames([...new Set((result?.tags ?? []).map(tag => tagKey(tag.name)))]); }).catch(() => { if (!cancelled) setNames([]); });
    return () => { cancelled = true; };
  }, [open,providedNames]);
  const options = active ? names.filter(name => inlineTags(`#${name}`)[0] === name && name.includes(active.query)).slice(0, 7) : [];
  if (active?.query && inlineTags(`#${active.query}`)[0] === active.query && !options.includes(active.query)) options.push(active.query);
  const choose = (name: string) => {
    if (!active) return;
    const next=editor.state.doc.textBetween(active.to,Math.min(active.to+1,editor.state.doc.content.size));
    editor.chain().focus().insertContentAt({ from: active.from, to: active.to }, { type: 'text', text: `#${name}${/^\s/.test(next) ? '' : ' '}` }).run();
    setActive(null);
  };
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || editor.view.composing || event.metaKey || event.ctrlKey) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setActive(null); }
      else if (options.length && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Enter') choose(options[index % options.length]);
        else setIndex(value => (value + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
      }
    };
    editor.view.dom.addEventListener('keydown', key, true);
    return () => editor.view.dom.removeEventListener('keydown', key, true);
  });
  return {active,index,names,options,choose};
}
