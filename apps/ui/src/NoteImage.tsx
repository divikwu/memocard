import { useEffect, useRef, useState, type DragEventHandler } from 'react';
import { Button } from '@/components/ui/button';
import { bindNoteImage } from './note-image';
import { isBrowserVault } from './client-mode';
import { getBrowserVaultBinding } from './browser-runtime';

import ImageViewer from './ImageViewer';

export function NoteImage({ source, alt, loading, width, height, onDragStart }: { source: string; alt: string; loading?: 'lazy'; width?: number | string; height?: number | string; onDragStart?: DragEventHandler<HTMLButtonElement> }) {
  const ref = useRef<HTMLImageElement>(null);
  const dragged = useRef(false);
  const [open, setOpen] = useState(false);
  const binding = isBrowserVault ? getBrowserVaultBinding() : null;
  const [result, setResult] = useState<{ source: string; binding: typeof binding; state: 'loaded' | 'failed' }>();
  const state = result?.source === source && result.binding === binding ? result.state : 'loading';
  useEffect(() => ref.current ? bindNoteImage(ref.current, source, () => setResult({ source, binding, state: 'failed' })) : undefined, [source, binding]);
  return <>
    <Button type="button" variant="ghost" className="note-image-trigger" aria-label={alt ? `查看大图 ${alt}` : '查看大图'}
      aria-busy={state === 'loading'} data-image-state={state} data-image-sized={Boolean(width && height) || undefined}
      draggable={!!onDragStart} onPointerDown={() => { dragged.current = false; }}
      onDragStart={onDragStart ? event => { onDragStart(event); dragged.current = !event.defaultPrevented; } : undefined}
      onClick={event => { event.stopPropagation(); if (!dragged.current || event.detail === 0) setOpen(true); }}>
      <img ref={ref} src={source.startsWith('memocard-resolve:') || isBrowserVault ? undefined : source} alt={alt} loading={loading} width={width} height={height} draggable={false} onLoad={() => setResult({ source, binding, state: 'loaded' })} onError={() => setResult({ source, binding, state: 'failed' })} />
      {state === 'loading' && <span className="sr-only">正在读取图片…</span>}
      {state === 'failed' && <span className="text-pretty px-3 py-2 text-xs text-muted-foreground">图片暂时无法读取</span>}
    </Button>
    {open && <ImageViewer source={source} alt={alt || '笔记图片'} onClose={() => setOpen(false)} />}
  </>;
}
