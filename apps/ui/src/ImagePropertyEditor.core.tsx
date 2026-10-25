import type { ComponentType, ComponentProps, SVGProps } from "react";
import { useEffect, useRef, useState } from 'react';
import { request, errorMessage, type Attachment } from './bridge';
import { imageSource } from './vault-links';
import { bindNoteImage } from './note-image';

type View = {
  ImagePlus: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  MoreHorizontal: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Maximize: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Trash2: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Button: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/button")["Button"]>, "render">>;
  Skeleton: ComponentType<ComponentProps<typeof import("@ui-next/components/skeleton")["Skeleton"]>>;
  Popover: ComponentType<ComponentProps<typeof import("@ui-next/components/popover")["Popover"]>>;
  PopoverContent: ComponentType<ComponentProps<typeof import("@ui-next/components/popover")["PopoverContent"]>>;
  PopoverTrigger: ComponentType<ComponentProps<typeof import("@ui-next/components/popover")["PopoverTrigger"]>>;
  DropdownMenu: ComponentType<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenu"]>>;
  DropdownMenuContent: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuContent"]>, "ref">>;
  DropdownMenuItem: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuItem"]>, "ref">>;
  DropdownMenuTrigger: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuTrigger"]>, "ref">>;
  ImageViewer: ComponentType<ComponentProps<typeof import("../ui-next/business/NoteMarkdown")["ImageViewer"]>>;
};

export function createImagePropertyEditor(view: View) {
  const { ImagePlus, MoreHorizontal, Maximize, Trash2, Button, Skeleton, Popover, PopoverContent, PopoverTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ImageViewer } = view;
function PropertyImage({source, name, preview = false}:{source:string; name:string; preview?:boolean}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => ref.current ? bindNoteImage(ref.current,source, () => setFailed(true)) : undefined,[source]);
  return <><span aria-busy={!loaded && !failed} className={preview ? `relative block w-full${!loaded && !failed ? ' min-h-20' : ''}` : 'relative block size-8'}>
    <img ref={ref} alt={name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={preview ? 'note-property-image-preview w-full rounded-md object-contain' : 'note-property-image-thumbnail rounded-md'} />
    {!loaded && !failed && <span role="status" aria-label="正在读取图片"><span className="sr-only">正在读取图片…</span><Skeleton className={preview ? 'absolute inset-0 min-h-20 w-full' : 'absolute inset-0 size-8'} /></span>}
  </span>{failed && <span className="text-xs text-secondary">图片暂时无法读取</span>}</>;
}

function ImagePropertyEditor({name, value, noteId, notePath, vaultBinding, editable, busy, onSave}:{name:string; value:string; noteId?:string; notePath:string; vaultBinding?:string; editable:boolean; busy:boolean; onSave:(value:string)=>Promise<void>}) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const active = useRef(true);
  const pending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; },[]);
  const source = value ? imageSource(value,notePath) : null;
  async function pick() {
    if (busy || pending.current) return;
    pending.current = true; setImporting(true); setError('');
    try {
      const image = await request<Attachment | null>('pickImage',{noteId,notePath,...(vaultBinding ? {vaultBinding} : {})});
      if (active.current && image) { await onSave(image.markdownPath); if (active.current) setOpen(false); }
    } catch (cause) { if (active.current) setError(errorMessage(cause)); }
    finally { pending.current = false; if (active.current) setImporting(false); }
  }
  async function remove() {
    setError('');
    try { await onSave(''); if (active.current) setOpen(false); }
    catch (cause) { if (active.current) setError(errorMessage(cause)); }
  }
  const upload = <Button type="button" variant="ghost" size="sm" className={value ? 'w-full justify-start font-normal' : 'note-property-edit w-full justify-start font-normal'} disabled={busy || importing} aria-label={`${value ? '替换' : '上传'}图片 ${name}`} onClick={() => { void pick(); }}>{value && <ImagePlus />}{value ? importing ? '正在导入…' : '替换图片' : <span className="note-property-empty">{importing ? '正在导入…' : '空白'}</span>}</Button>;
  return <div className="flex min-w-0 flex-col items-start">
    {value ? <Popover open={open} onOpenChange={next => { if (!importing) { setOpen(next); setError(''); } }}><PopoverTrigger render={<Button variant="ghost" className="h-8 p-0" aria-label={`预览图片 ${name}`} />}>{source ? <PropertyImage key={source} source={source} name={name} /> : <span className="text-sm text-secondary">图片路径无法显示</span>}</PopoverTrigger><PopoverContent align="start" className="note-property-image-popup p-2" aria-label={`图片预览 ${name}`}>
      <div className="note-property-image-toolbar flex pb-2"><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`图片菜单 ${name}`} disabled={busy || importing} />}><MoreHorizontal /></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!source} onClick={() => { setOpen(false); setFullscreen(true); }}><Maximize />全屏</DropdownMenuItem>
        {editable && <DropdownMenuItem onClick={() => { void remove(); }}><Trash2 />移除</DropdownMenuItem>}
      </DropdownMenuContent></DropdownMenu></div>
      {source && <PropertyImage key={source} source={source} name={name} preview />}
      {editable && <div className="mt-2 border-t pt-2">{upload}</div>}
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
    </PopoverContent></Popover> : editable ? upload : <span className="note-property-empty">空白</span>}
    {error && !open && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
    {fullscreen && source && <ImageViewer source={source} alt={name} onClose={() => setFullscreen(false)} />}
  </div>;
}

  return ImagePropertyEditor;
}
