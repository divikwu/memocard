import { lazy, Suspense, useEffect, useRef, useState, type DragEventHandler } from 'react';
import { Button } from '@/components/ui/button';
import { bindNoteImage } from './note-image';
import { isBrowserVault } from './client-mode';
import { getBrowserVaultBinding } from './browser-runtime';

const ImageViewer = lazy(() => import('./ImageViewer'));

export function NoteImage({ source, alt, loading, onDragStart }: { source: string; alt: string; loading?: 'lazy'; onDragStart?: DragEventHandler<HTMLButtonElement> }) {
  const ref = useRef<HTMLImageElement>(null);
  const dragged = useRef(false);
  const [open, setOpen] = useState(false);
  const binding = isBrowserVault ? getBrowserVaultBinding() : null;
  useEffect(() => ref.current ? bindNoteImage(ref.current, source) : undefined, [source, binding]);
  return <>
    <Button type="button" variant="ghost" className="note-image-trigger" aria-label={alt ? `查看大图 ${alt}` : '查看大图'}
      draggable={!!onDragStart} onPointerDown={() => { dragged.current = false; }}
      onDragStart={onDragStart ? event => { onDragStart(event); dragged.current = !event.defaultPrevented; } : undefined}
      onClick={event => { event.stopPropagation(); if (!dragged.current || event.detail === 0) setOpen(true); }}>
      <img ref={ref} src={source.startsWith('memocard-resolve:') || isBrowserVault ? undefined : source} alt={alt} loading={loading} draggable={false} />
    </Button>
    {open && <Suspense fallback={<span role="status">正在打开图片…</span>}><ImageViewer source={source} alt={alt || '笔记图片'} onClose={() => setOpen(false)} /></Suspense>}
  </>;
}
