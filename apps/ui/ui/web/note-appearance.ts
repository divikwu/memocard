import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { resolveNoteTextMetrics, useTypography } from "../../src/features/typography/TypographyProvider";
import { getPreviewFont, loadPreviewFonts, type PreviewFont } from "../preview-fonts";
import { usePreviewAppearance } from "../preview-mode";

export const noteFontChoices = [
  { value: "system", label: "无衬线体" },
  { value: "noto-serif", label: "衬线体" },
  { value: "system-mono", label: "等宽体" },
] as const;
export type NoteFont = (typeof noteFontChoices)[number]["value"];
type NoteAppearance = { headingFont?: NoteFont; bodyFont?: NoteFont; size?: "14" | "16" };

export const noteAppearanceStoragePrefix = "memocard.note-appearance.v1:";
const changeEvent = "memocard:note-appearance";

function read(key: string | null) {
  try { return key ? localStorage.getItem(key) : null; } catch { return null; }
}

function parse(raw: string | null): NoteAppearance {
  try {
    const data = JSON.parse(raw ?? "null");
    return {
      headingFont: noteFontChoices.find(choice => choice.value === data?.headingFont)?.value,
      bodyFont: noteFontChoices.find(choice => choice.value === data?.bodyFont)?.value,
      size: data?.size === "14" || data?.size === "16" ? data.size : undefined,
    };
  } catch { return {}; }
}

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(changeEvent, onChange); window.removeEventListener("storage", onChange); };
}

function fontPreset(font: PreviewFont): NoteFont {
  const { group } = getPreviewFont(font);
  return group === "Serif" ? "noto-serif" : group === "Mono" ? "system-mono" : "system";
}

export function useNoteAppearance(vaultId?: string | null, noteId?: string) {
  const key = vaultId && noteId ? `${noteAppearanceStoragePrefix}${JSON.stringify([vaultId, noteId])}` : null;
  const raw = useSyncExternalStore(subscribe, () => read(key));
  const { headingFont, bodyFont, size } = parse(raw);
  const { value: typography } = useTypography();
  const appearance = usePreviewAppearance();
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    const fonts = [headingFont, bodyFont].filter(font => font !== undefined);
    if (fonts.length) void loadPreviewFonts(fonts).catch(() => { /* The font stack already provides fallbacks. */ });
  }, [headingFont, bodyFont]);

  function save(patch: Partial<NoteAppearance>) {
    if (!key) return;
    const next = { ...parse(read(key)), ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setFailedKey(null);
      window.dispatchEvent(new Event(changeEvent));
    } catch { setFailedKey(key); }
  }

  const style = {
    "--note-font-heading": headingFont ? getPreviewFont(headingFont).fontFamily : undefined,
    "--note-font-body": bodyFont ? getPreviewFont(bodyFont).fontFamily : undefined,
    ...(size ? resolveNoteTextMetrics({ ...typography, size }) : {}),
  } as CSSProperties;

  const value = {
    headingFont: headingFont ?? fontPreset(appearance.headingFont === "inherit" ? appearance.bodyFont : appearance.headingFont),
    bodyFont: bodyFont ?? fontPreset(appearance.bodyFont),
    smallText: (size ?? typography.size) === "14",
  };
  return { available: key !== null, value, style, save, error: key !== null && failedKey === key };
}
