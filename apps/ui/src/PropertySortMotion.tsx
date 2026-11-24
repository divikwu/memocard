import { useLayoutEffect, type RefObject } from 'react';
import { useAnimate } from 'motion/react-mini';

export type SlidePropertyRow = (row: HTMLElement, to: string, from?: string) => void;

export default function PropertySortMotion({ slide }: { slide: RefObject<SlidePropertyRow | null> }) {
  const [, animate] = useAnimate();
  useLayoutEffect(() => {
    const active = new WeakMap<HTMLElement, ReturnType<typeof animate>>();
    slide.current = (row, to, from) => {
      const style = getComputedStyle(row);
      const start = from ?? style.translate;
      const duration = parseFloat(style.getPropertyValue('--duration-medium-min')) / 1000;
      active.get(row)?.cancel();
      active.delete(row);
      row.style.translate = to;
      if (!duration || start === to || (start === 'none' && !to)) return;
      const playback = animate(row, { translate: [start === 'none' ? '0px 0px' : start, to || '0px 0px'] }, { duration, ease: 'easeOut' });
      active.set(row, playback);
      void playback.then(() => {
        if (active.get(row) !== playback) return;
        active.delete(row);
        row.style.translate = to;
      });
    };
    return () => { slide.current = null; };
  }, [animate, slide]);
  return null;
}
