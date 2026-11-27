import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Note } from "@memocard/contracts";
import { imageSource } from "../../src/vault-links";
import { markdownImageCandidates } from "../../src/markdown-images";
import { useNoteImage } from "../../src/use-note-image";
import { NotePreview } from "./NotePreview";

function CardCover({ source, alt, onFailure }: { source: string; alt: string; onFailure: (source: string) => void }) {
  const { ref, state, onLoaded, onFailed } = useNoteImage(source, true);
  useEffect(() => {
    if (state === "failed") onFailure(source);
  }, [state, onFailure, source]);
  return <div className="ui-note-card-cover" data-image-state={state}>
    <img ref={ref} alt={alt} loading="lazy" onLoad={onLoaded} onError={onFailed} />
  </div>;
}

export function NoteCardPreview({ note, coverSlot, onError }: { note: Note; coverSlot: HTMLDivElement | null; onError: (message: string) => void }) {
  const { body, cardPreview, relativePath, tags } = note;
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const reject = useCallback((source: string) => {
    setFailed(previous => previous.has(source) ? previous : new Set([...previous, source]));
  }, []);
  const propertyCover = cardPreview?.images.map(path => imageSource(path, relativePath))
    .find((source): source is string => source !== null && !failed.has(source));
  const needsBodyCover = !propertyCover;
  const bodyCovers = useMemo(() => needsBodyCover ? markdownImageCandidates(body, relativePath) : [], [needsBodyCover, body, relativePath]);
  const cover = propertyCover ? { source: propertyCover, alt: "笔记封面" } : bodyCovers.find(image => !failed.has(image.source));
  if (cover) return coverSlot && createPortal(<CardCover key={cover.source} {...cover} onFailure={reject} />, coverSlot);
  if (!cardPreview?.text && !body.trim()) return null;
  return <div className="ui-note-preview">{cardPreview?.text
    ? <NotePreview compact showTitle={false} plainText body={cardPreview.text} onError={onError} />
    : <NotePreview compact showTitle={false} omitImages hiddenTags={tags} body={body} notePath={relativePath} onError={onError} />}
  </div>;
}
