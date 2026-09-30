// Keep the same grammar in MemoCardCore/Obsidian.swift.
export function inlineTags(body: string): string[] {
  const text = body
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*(?:\n|$)|(?![\s\S]))/gm, '')
    .replace(/^(?: {4}|\t).*$/gm, '')
    .replace(/(`+)[\s\S]*?\1/g, '')
    .replace(/!?\[[^\]\n]*\]\([^\n)]*\)|\[\[[^\]\n]*\]\]|<[^>]*>|\$\$[\s\S]*?\$\$|\$[^\n$]+\$/g, '');
  return [...new Set([...text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)(?![\p{L}\p{N}_/-])/gu)]
    .map(match => match[1]).filter(tag => /[\p{L}_-]/u.test(tag)))];
}
