import { useCallback, useEffect, useMemo, useState } from "react";
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

export function NoteCardPreview({ note, onError }: { note: Note; onError: (message: string) => void }) {
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
  if (cover) return <CardCover key={cover.source} {...cover} onFailure={reject} />;
  if (cardPreview?.text) return <NotePreview compact showTitle={false} plainText body={cardPreview.text} onError={onError} />;
  return <NotePreview compact showTitle={false} omitImages hiddenTags={tags} body={body} notePath={relativePath} onError={onError} />;
}
