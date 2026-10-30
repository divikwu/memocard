import { useEffect, useRef, useState, type DragEventHandler, type ReactElement } from "react";
import type { Components } from "react-markdown";
import { MarkdownContent, type MarkdownContentProps } from "../../src/markdown-content";
import { bindNoteImage } from "../../src/note-image";
import { isBrowserVault } from "../../src/client-mode";
import { useNoteImage } from "../../src/use-note-image";
import { mermaidSVG } from "../../src/mermaid-svg";
import { Button } from "../components/button";
import { ActionGroup, useMobileActionGroup } from "../components/action-group";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import SourceCodeIcon from "@hugeicons/core-free-icons/SourceCodeIcon";
import GitBranchIcon from "@hugeicons/core-free-icons/GitBranchIcon";
import Layout2RowIcon from "@hugeicons/core-free-icons/Layout2RowIcon";
import { CloseIcon } from "../icons";
import "./note-content.css";

export type VaultImageProps = { source: string; alt: string; width?: string | number; height?: string | number; loading?: "lazy"; interactive?: boolean; onDragStart?: DragEventHandler<HTMLImageElement> };

function ViewerClose({ label }: { label: string }) {
  const grouped = useMobileActionGroup();
  const close = <DialogClose render={<Button variant={grouped ? "ghost" : "outline"} size={grouped ? "icon" : "icon-lg"} className={grouped ? undefined : "note-viewer-close"} aria-label={label} />}><CloseIcon aria-hidden="true" /></DialogClose>;
  return grouped ? <ActionGroup className="note-viewer-close" aria-label="查看器操作">{close}</ActionGroup> : close;
}

export function VaultImage({ source, alt, width, height, loading, interactive = true, onDragStart }: VaultImageProps) {
  const { ref: image, state, dimensions, onLoaded, onFailed, retry } = useNoteImage(source, loading === 'lazy');
  const [open, setOpen] = useState(false);
  const dragged = useRef(false);
  const visual = <>
    <img ref={image} src={source.startsWith("memocard-resolve:") || isBrowserVault ? undefined : source} alt={alt} loading={dimensions ? undefined : loading} width={width ?? dimensions?.width} height={height ?? dimensions?.height} draggable={!!onDragStart} onPointerDown={() => { dragged.current = false; }} onDragStart={onDragStart ? event => { onDragStart(event); dragged.current = !event.defaultPrevented; } : undefined} onLoad={onLoaded} onError={onFailed} />
    {state === "loading" && <span className="sr-only">正在读取图片…</span>}
    {state === "failed" && <span className="note-image-message">图片暂时无法读取</span>}
  </>;
  return <>
    {interactive ? <Button variant="ghost" type="button" className="ui-note-image" data-image-state={state} data-image-sized={Boolean((width && height) || dimensions) || undefined} aria-label={alt ? `查看大图 ${alt}` : "查看大图"} aria-busy={state === "loading"} onClick={event => { event.stopPropagation(); if (!dragged.current || event.detail === 0) setOpen(true); }}>{visual}</Button>
      : <span className="ui-note-image" data-image-state={state} data-image-sized={Boolean((width && height) || dimensions) || undefined}>{visual}</span>}
    {interactive && state === 'failed' && <Button type="button" variant="ghost" size="sm" aria-label={`重试读取图片 ${alt}`} onClick={event => { event.stopPropagation(); retry(); }}>重试</Button>}
    {open && <ImageViewer source={source} alt={alt || "笔记图片"} onClose={() => setOpen(false)} />}
  </>;
}

export function ImageViewer({ source, alt, onClose }: { source: string; alt: string; onClose: () => void }) {
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
    <DialogContent className="ui-note-viewer" aria-describedby={undefined} showCloseButton={false} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <DialogTitle className="sr-only">{alt}</DialogTitle>
      <ViewerClose label="关闭图片" />
      {current?.url ? <img className="note-viewer-image" src={current.url} alt={alt} /> : <p role={current?.failed ? "alert" : "status"}>{current?.failed ? "图片暂时无法读取，请检查文件是否可用。" : "正在读取图片…"}</p>}
    </DialogContent>
  </Dialog>;
}

function Diagram({ svg, enlarged = false }: { svg: string; enlarged?: boolean }) {
  const element = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = element.current!;
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>:host{display:block}svg{display:block;width:auto;height:auto;max-width:none;max-height:${enlarged ? "70dvh" : "420px"}}</style>${svg}`;
  }, [svg, enlarged]);
  return <span ref={element} role="img" aria-label="Mermaid 图表" />;
}

function MermaidDiagram({ source }: { source: string }) {
  const [result, setResult] = useState<{ source: string; svg?: string; failed?: boolean }>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(() => {
      void import("beautiful-mermaid").then(({ renderMermaidSVG }) => {
        if (disposed) return;
        const svg = mermaidSVG(renderMermaidSVG(source, {
          bg: "var(--color-background-surface)", fg: "var(--color-text-primary)", line: "var(--color-text-secondary)",
          accent: "var(--color-accent)", muted: "var(--color-text-secondary)", surface: "var(--color-background-muted)", border: "var(--color-border)",
          font: "var(--font-family-body)", transparent: true,
        }));
        setResult({ source, svg });
      }).catch(() => { if (!disposed) setResult({ source, failed: true }); });
    }, 180);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [source]);
  const current = result?.source === source ? result : undefined;
  return <div className="note-mermaid-diagram">
    {current?.svg ? <div className="note-diagram-scroll" role="region" aria-label="Mermaid 图形预览，可横向滚动" tabIndex={0}>
      <Button variant="ghost" className="note-diagram-trigger" aria-label="放大 Mermaid 图表" onClick={() => setOpen(true)}><Diagram svg={current.svg} /></Button>
    </div> : <p className="text-sm text-secondary" role={current?.failed ? "alert" : "status"}>{current?.failed ? "暂时无法预览，请检查语法或图表类型。源码已保留。" : "正在生成图表预览…"}</p>}
    {open && current?.svg && <Dialog open onOpenChange={value => { if (!value) setOpen(false); }}>
      <DialogContent className="ui-note-viewer" aria-describedby={undefined} showCloseButton={false} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <DialogTitle className="sr-only">Mermaid 图表</DialogTitle>
        <ViewerClose label="关闭图表" />
        <div className="note-diagram-enlarged" role="region" aria-label="Mermaid 大图，可滚动" tabIndex={0}><Diagram svg={current.svg} enlarged /></div>
      </DialogContent>
    </Dialog>}
  </div>;
}

const mermaidModes = [
  { value: "source", label: "仅源码", icon: SourceCodeIcon },
  { value: "preview", label: "仅图形", icon: GitBranchIcon },
  { value: "both", label: "源码与图形", icon: Layout2RowIcon },
] as const;

export function MermaidContent({ source, children }: { source: string; children: React.ReactNode }) {
  const [mode, setMode] = useState("both");
  const grouped = useMobileActionGroup();
  const modes = <TabsList contentEditable={false} aria-label="Mermaid 显示模式" activateOnFocus>
    {mermaidModes.map(({ value, label, icon }) => <TabsTrigger key={value} value={value} aria-label={label} title={label}><HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" /></TabsTrigger>)}
  </TabsList>;
  return <Tabs className="ui-note-mermaid" value={mode} onValueChange={setMode}>
    <div className="note-mermaid-toolbar" contentEditable={false}>
      {grouped ? <ActionGroup aria-label="Mermaid 操作">{modes}</ActionGroup> : modes}
    </div>
    <TabsContent value={mode} keepMounted>
      <div className="note-mermaid-source" hidden={mode === "preview"}>{children}</div>
      <div contentEditable={false} hidden={mode === "source"}><MermaidDiagram source={source} /></div>
    </TabsContent>
  </Tabs>;
}

const imageRenderer: Components["img"] = ({ src, alt, width, height }) => typeof src === "string" && src ? <VaultImage source={src} alt={alt ?? "笔记图片"} loading="lazy" width={width} height={height} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;
const compactImageRenderer: Components["img"] = ({ src, alt, width, height }) => typeof src === "string" && src ? <VaultImage source={src} alt={alt ?? "笔记图片"} loading="lazy" width={width} height={height} interactive={false} /> : <span className="blocked-image">{alt || "图片"} · 仅显示笔记库中的图片</span>;
const preRenderer: Components["pre"] = ({ children }) => {
  const code = children as ReactElement<{ className?: string; children?: string }>;
  return code?.props?.className === "language-mermaid" ? <MermaidContent source={String(code.props.children ?? "").replace(/\n$/, "")}><pre>{children}</pre></MermaidContent> : <pre>{children}</pre>;
};
const compactTableRenderer: Components["table"] = ({ children }) => <div className="typeset-scroll" tabIndex={-1}><table>{children}</table></div>;
const compactPreRenderer: Components["pre"] = ({ children }) => <pre tabIndex={-1}>{children}</pre>;
const compactTaskRenderer: Components["input"] = ({ checked }) => <span className="note-task-indicator" aria-hidden="true" data-checked={checked === true} />;

export function NoteMarkdown({ compact = false, interactive = true, ...props }: Pick<MarkdownContentProps, "body" | "notePath" | "onError"> & { compact?: boolean; interactive?: boolean }) {
  return <div className="markdown typeset typeset-memocard ui-note-markdown" data-compact={compact || undefined}>
    <MarkdownContent {...props} interactive={interactive} components={interactive ? { img: imageRenderer, pre: preRenderer } : { img: compactImageRenderer, pre: compactPreRenderer, table: compactTableRenderer, input: compactTaskRenderer }} />
  </div>;
}
