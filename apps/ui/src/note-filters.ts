import type { Note, NoteQuickFilter } from "@memocard/contracts";

// Keep the same grammar in MemoCardCore/NoteFilters.swift.
export function noteQuickFilters(note: Pick<Note, "body" | "tags">): NoteQuickFilter[] {
  let text = note.body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*(?:\n|$)|(?![\s\S]))/gm, '')
    .replace(/^(?: {4}|\t).*$/gm, '')
    .replace(/(`+)[\s\S]*?\1/g, '');
  const references = new Map<string, string>();
  text = text.replace(/^ {0,3}\[(?!\^)([^\]\n]+)\]:\s*(\S+).*$/gm, (_, label: string, target: string) => {
    references.set(label.trim().toLowerCase(), target);
    return '';
  });
  text = text.replace(/(!?)\[([^\]\n]+)\](?:\[([^\]\n]*)\])?(?!\(|\[)/g, (source, image: string, label: string, reference?: string) => {
    const target = references.get((reference || label).trim().toLowerCase());
    return target ? `${image}[${label}](${target})` : source;
  });
  const images = /!\[[^\]\n]*\]\([^)\n]+\)|!\[\[[^\]\n]+\.(?:png|jpe?g|webp|gif|heic|heif)(?:\|[^\]\n]*)?\]\]|<img\b[^>]*>/gi;
  const hasImage = images.test(text);
  const links = text.replace(images, '');
  return [
    ...(!note.tags.length ? ["untagged" as const] : []),
    ...(hasImage ? ["images" as const] : []),
    ...(/\[[^\]\n]+\]\([^)\n]+\)|\[\[[^\]\n]+\]\]|(?:https?:\/\/|www\.)[^\s<>]+|<a\b[^>]*\bhref\s*=/i.test(links) ? ["links" as const] : []),
  ];
}
