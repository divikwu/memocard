import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Combobox } from '@base-ui/react/combobox';

export default function PropertyOptionList({ label, count, multiple = true, children }: { label:string; count:number; multiple?:boolean; children:(value:string,index:number)=>ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const update = () => setCanScrollDown(element.scrollHeight - element.clientHeight - element.scrollTop > 1);
    update();
    element.addEventListener('scroll', update);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener('scroll', update); observer.disconnect(); };
  }, [count]);
  return <div className="note-tag-options-wrap" data-overflow={canScrollDown}>
    <Combobox.List ref={list} className="note-tag-options" aria-multiselectable={multiple} aria-label={label}>{children}</Combobox.List>
  </div>;
}
