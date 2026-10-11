// Keep the same grammar in MemoCardCore/Obsidian.swift.
export function tagKey(value: string): string { return value.toLowerCase().normalize('NFC'); }
export function normalizePropertyTag(value: string): string | null {
  const tag = tagKey(value.trim().replace(/^#/, ''));
  return inlineTags(`#${tag}`)[0] === tag ? tag : null;
}
export function propertyTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return [...new Set(values.flatMap(item => typeof item === 'string' ? normalizePropertyTag(item) ?? [] : []))];
}
const ignoredMarkdown = [
  /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*(?:\n|$)|(?![\s\S]))/gm,
  /^(?: {4}|\t).*$/gm,
  /(`+)[\s\S]*?\1/g,
  /!?\[[^\]\n]*\]\([^\n)]*\)|\[\[[^\]\n]*\]\]|<[^>]*>|\$\$[\s\S]*?\$\$|\$[^\n$]+\$/g,
];
const tagPattern = /(^|[\s(])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)(?![\p{L}\p{N}_/-])/gu;
export function inlineTagMatches(body: string): { tag:string; start:number; end:number }[] {
  // Track source offsets through the same exclusions used by the tag index.
  let text = body;
  let offsets = Array.from({length:body.length}, (_, index) => index);
  for (const pattern of ignoredMarkdown) {
    const next:number[] = [];
    let cursor = 0;
    text = text.replace(pattern, (value, ...args) => {
      const start = args[args.length - 2] as number;
      for (let index = cursor; index < start; index++) next.push(offsets[index]);
      cursor = start + value.length;
      return '';
    });
    for (let index = cursor; index < offsets.length; index++) next.push(offsets[index]);
    offsets = next;
  }
  return [...text.matchAll(tagPattern)].filter(match => {
    const start = match.index + match[1].length, end = match.index + match[0].length - 1;
    return /[\p{L}_-]/u.test(match[2]) && offsets[end] - offsets[start] === end - start;
  }).map(match => ({ tag:tagKey(match[2]), start:offsets[match.index + match[1].length], end:offsets[match.index + match[0].length - 1] + 1 }));
}
export function inlineTags(body: string): string[] {
  let text = body;
  for (const pattern of ignoredMarkdown) text = text.replace(pattern, '');
  return [...new Set([...text.matchAll(tagPattern)].map(match => tagKey(match[2])).filter(tag => /[\p{L}_-]/u.test(tag)))];
}
