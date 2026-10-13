import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { bindNoteImage } from './note-image';
import './image-viewer.css';

// Keep the vault binding alive for the viewer's lifetime, including its blob URL.
export default function ImageViewer({ source, alt, onClose }: { source: string; alt: string; onClose: () => void }) {
  const [result, setResult] = useState<{ source: string; url?: string; failed?: boolean }>();
  useEffect(() => {
    const image = new Image();
    image.onload = () => setResult({ source, url: image.src });
    image.onerror = () => setResult({ source, failed: true });
    const dispose = bindNoteImage(image, source, () => setResult({ source, failed: true }));
    return () => { image.onload = null; image.onerror = null; dispose(); };
  }, [source]);
  const current = result?.source === source ? result : undefined;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent aria-describedby={undefined} showCloseButton={false} className="image-viewer" onClick={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <DialogTitle className="sr-only">{alt}</DialogTitle>
      <DialogClose render={<Button variant="outline" size="icon-lg" className="image-viewer-close" aria-label="关闭图片" />}><X aria-hidden="true" /></DialogClose>
      {current?.url ? <img className="image-viewer-image" src={current.url} alt={alt} /> : <p role={current?.failed ? 'alert' : 'status'} className="image-viewer-message">{current?.failed ? '图片暂时无法读取，请检查文件是否可用。' : '正在读取图片…'}</p>}
    </DialogContent>
  </Dialog>;
}
