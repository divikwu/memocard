import type { Note, NoteQuickFilter } from "@memocard/contracts";

// Keep the same grammar in MemoCardCore/NoteFilters.swift.
// Deliberately omit the Unicode regex flag: URL markers accept ASCII casing, not ſ → s folding.
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
  // Consume internal links as whole tokens so URL-shaped labels do not count as webpage targets.
  const linkTokens = /!?\[\[[^\]\n]+\]\]|\[[^\]\n]+\]\(\s*<?([^)\n]+)\)|<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>(?:[\s\S]*?<\/a\s*>)?|(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  const hasWebLink = Array.from(links.matchAll(linkTokens)).some(match =>
    /^(?:https?:\/\/|www\.)[^\s<>"')]+/i.test((match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[0]).trim())
  );
  return [
    ...(!note.tags.length ? ["untagged" as const] : []),
    ...(hasImage ? ["images" as const] : []),
    ...(hasWebLink ? ["links" as const] : []),
  ];
}
