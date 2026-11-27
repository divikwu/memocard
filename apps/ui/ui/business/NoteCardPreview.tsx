import { Suspense, useCallback, useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import type { Note } from "@memocard/contracts";
import { analyzeNoteContent } from "../../src/markdown-images";
import { mayContainMarkdownImage } from "../../src/markdown-image-hint";
import { useNoteImage } from "../../src/use-note-image";
import { recoverableLazy } from "../components/recoverable-lazy";
import { NotePreview } from "./NotePreview";
import "./note-card-gallery.css";

const NoteCardGallery = recoverableLazy(() => import("./NoteCardGallery"), "卡片轮播");

function CardCover({ source, alt, textCover, onFailure }: { source: string; alt: string; textCover?: boolean; onFailure: (source: string) => void }) {
  const { ref, state, onLoaded, onFailed } = useNoteImage(source, true);
  useEffect(() => {
    if (state === "failed") onFailure(source);
  }, [state, onFailure, source]);
  return <div className="ui-note-card-cover" data-image-state={state} data-text-cover={textCover || undefined}>
    <img draggable={false} ref={ref} alt={alt} loading="lazy" onLoad={onLoaded} onError={onFailed} />
  </div>;
}

export function NoteCardPreview({ note, coverSlot, onOpen, onError }: { onOpen?: () => void; note: Note; coverSlot: HTMLDivElement | null; onError: (message: string) => void }) {
  const { body, cardPreview, relativePath, tags } = note;
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const reject = useCallback((source: string) => {
    setFailed(previous => previous.has(source) ? previous : new Set([...previous, source]));
  }, []);
  // Polls return fresh objects, including new tag and image arrays for unchanged notes.
  const analysisMetadata = JSON.stringify([relativePath, note.contentTypeOverride, tags, cardPreview?.images]);
  const analyze = useEffectEvent(() => analyzeNoteContent(note));
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof analyzeNoteContent>>>();
  useEffect(() => {
    let active = true;
    void analyze().then(next => {
      if (active) setPreview(next);
    }).catch(() => {
      if (active) setPreview({ type: "text", images: [] });
    });
    return () => { active = false; };
  }, [body, analysisMetadata]);
  if (!preview && (cardPreview?.images.length || mayContainMarkdownImage(body))) {
    return coverSlot && createPortal(<div className="ui-note-card-cover" data-text-cover={note.contentTypeOverride === "text" || undefined} />, coverSlot);
  }
  const images = preview?.images.filter(image => !failed.has(image.source)) ?? [];
  if (images.length) {
    const textCover = preview?.type === "text";
    const firstCover = <CardCover key={images[0].source} {...images[0]} textCover={textCover} onFailure={reject} />;
    return coverSlot && createPortal(textCover || images.length === 1 ? firstCover : <Suspense fallback={firstCover}>
      <NoteCardGallery>{images.map(image => <button className="ui-gallery-slide" type="button" key={image.source} tabIndex={-1}
        disabled={!onOpen} aria-label={`打开笔记 · ${image.alt}`} onClick={onOpen}>
        <CardCover {...image} onFailure={reject} />
      </button>)}</NoteCardGallery>
    </Suspense>, coverSlot);
  }
  if (!cardPreview?.text && !body.trim()) return null;
  return <div className="ui-note-preview">{cardPreview?.text
    ? <NotePreview compact showTitle={false} plainText body={cardPreview.text} onError={onError} />
    : <NotePreview compact showTitle={false} omitImages hiddenTags={tags} body={body} notePath={relativePath} onError={onError} />}
  </div>;
}
