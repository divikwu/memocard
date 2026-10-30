import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { defaultRangeExtractor, useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';

export type TagVirtualizer = Virtualizer<HTMLDivElement, HTMLDivElement>;

export default function VirtualTagOptions({items, virtualizerRef, children}: {items:string[];virtualizerRef:Ref<TagVirtualizer>;children:(tag:string,index:number)=>ReactNode}) {
  const list = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const focusedIndex = focused === null ? -1 : items.indexOf(focused);
  const virtualizer = useVirtualizer<HTMLDivElement,HTMLDivElement>({
    count: items.length,
    getScrollElement: () => list.current,
    getItemKey: index => items[index],
    estimateSize: () => 44,
    overscan: 4,
    rangeExtractor: range => {
      const visible = defaultRangeExtractor(range);
      // Keep the focused row mounted while its menu or confirmation is open.
      return focusedIndex >= 0 ? [...new Set([...visible, focusedIndex])].sort((a,b) => a-b) : visible;
    },
  });
  useImperativeHandle(virtualizerRef, () => virtualizer, [virtualizer]);
  const total = virtualizer.getTotalSize();
  const overflow = total - (virtualizer.scrollOffset ?? 0) > (virtualizer.scrollRect?.height ?? 240) + 1;
  return <div className="note-tag-options-wrap" data-overflow={overflow}>
    <Combobox.List ref={list} className="note-tag-options" aria-multiselectable aria-label="可选属性标签" onFocusCapture={event => {
      const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]');
      if (row) setFocused(items[Number(row.dataset.index)]);
    }}>
      <div role="presentation" style={{height:total,position:'relative'}}>
        {virtualizer.getVirtualItems().map(item => <div key={item.key} data-index={item.index} ref={virtualizer.measureElement} style={{position:'absolute',top:0,left:0,width:'100%',transform:`translateY(${item.start}px)`}}>
          {children(items[item.index],item.index)}
        </div>)}
      </div>
    </Combobox.List>
  </div>;
}
