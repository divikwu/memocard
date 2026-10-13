import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { mermaidSVG } from './mermaid-svg';
import './image-viewer.css';
import './mermaid.css';

function Diagram({ svg, enlarged = false }: { svg: string; enlarged?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = ref.current!;
    const canvasRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    // Scope the renderer's CSS and marker IDs to this diagram.
    canvasRoot.innerHTML = `<style>:host{display:block}svg{display:block;width:auto;height:auto;max-width:none;max-height:${enlarged ? '70dvh' : '420px'}}</style>${svg}`;
  }, [svg, enlarged]);
  return <span ref={ref} role="img" aria-label="Mermaid 图表" />;
}

export function MermaidPreview({ source }: { source: string }) {
  const [result, setResult] = useState<{ source: string; svg?: string; error?: string }>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(() => {
      void import('beautiful-mermaid').then(({ renderMermaidSVG }) => {
        if (disposed) return;
        const svg = mermaidSVG(renderMermaidSVG(source, {
          bg: 'var(--background)', fg: 'var(--foreground)', line: 'var(--muted-foreground)',
          accent: 'var(--foreground)', muted: 'var(--muted-foreground)', surface: 'var(--secondary)', border: 'var(--input)',
          font: 'system-ui', transparent: true,
        }));
        setResult({ source, svg });
      }).catch(() => { if (!disposed) setResult({ source, error: '暂时无法预览，请检查语法或图表类型。源码已保留。' }); });
    }, 180);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [source]);
  const current = result?.source === source ? result : undefined;
  return <div className="mermaid-preview" contentEditable={false}>
    {current?.svg ? <div className="mermaid-viewport" role="region" aria-label="Mermaid 图形预览，可横向滚动" tabIndex={0}>
      <Button type="button" variant="ghost" className="note-image-trigger" aria-label="放大 Mermaid 图表" onClick={() => setOpen(true)}><Diagram svg={current.svg} /></Button>
    </div> : <p className="text-sm text-muted-foreground" role={current?.error ? 'alert' : 'status'}>{current?.error ?? '正在生成图表预览…'}</p>}
    {open && current?.svg && <Dialog open onOpenChange={value => { if (!value) setOpen(false); }}>
      <DialogContent className="image-viewer" showCloseButton={false} aria-describedby={undefined} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <DialogTitle className="sr-only">Mermaid 图表</DialogTitle>
        <DialogClose render={<Button variant="outline" size="icon-lg" className="image-viewer-close" aria-label="关闭图表" />}><X aria-hidden="true" /></DialogClose>
        <div className="mermaid-enlarged" role="region" aria-label="Mermaid 大图，可滚动" tabIndex={0}><Diagram svg={current.svg} enlarged /></div>
      </DialogContent>
    </Dialog>}
  </div>;
}
