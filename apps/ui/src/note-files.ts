import { linkCandidates } from './link-candidates';

export const fileTitle = (path: string) => path.split('/').at(-1)!.replace(/\.md$/i, '');
export function safeNoteTitle(title: string): string {
  // Control characters are forbidden in portable filenames.
  // eslint-disable-next-line no-control-regex
  let value = title.normalize('NFC').replace(/[\\/:*?"<>|#^[\]\x00-\x1f\x7f]/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) value = `_${value}`;
  while (new TextEncoder().encode(value).length > 200) value = [...value].slice(0, -1).join('');
  return value || '未命名';
}
export function namedNotePath(path: string, title: string, paths: string[]): string {
  const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const base = safeNoteTitle(title), occupied = new Set(paths.filter(item => item !== path).map(item => item.normalize('NFC').toLowerCase()));
  let next = `${directory}${base}.md`, count = 2;
  while (occupied.has(next.normalize('NFC').toLowerCase())) next = `${directory}${base} (${count++}).md`;
  return next;
}

export function noteSavePath(save: { id: string; title?: string; body: string; relativePath?: string }, existing: string | undefined, paths: string[], compatible: boolean): string {
  if (existing) return save.title === undefined || safeNoteTitle(save.title) === fileTitle(existing) ? existing : namedNotePath(existing, save.title, paths);
  const path = save.relativePath ?? `${compatible ? '' : 'notes/'}${save.id}.md`;
  if (save.relativePath && !path.endsWith(`${save.id}.md`)) return path;
  const title = save.title?.trim() || (save.body.split(/\r?\n/).find(line => line.trim()) ?? '未命名').replace(/^[#\s]+/, '');
  return namedNotePath(path, title, paths);
}

/** Rewrite resolved destinations only; preserve YAML, literal code, display text and fragments. */
export function rewriteNoteLinks(source: string, sourcePath: string, paths: string[], renames: Record<string, string>): string {
  const protectedRanges = [...source.matchAll(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*(?:\n|$)|(?![\s\S]))|`+[^`\n]*`+|^ {4}[^\n]*|<!--[\s\S]*?-->/gm)].map(match => [match.index!, match.index! + match[0].length]);
  const header = /^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source);
  if (header) protectedRanges.push([0, header[0].length]);
  const destination = (target: string, wiki: boolean) => {
    const hash = target.indexOf('#'), raw = hash < 0 ? target : target.slice(0, hash), fragment = hash < 0 ? '' : target.slice(hash);
    const matches = linkCandidates(raw, sourcePath, paths, wiki);
    if (matches.length !== 1 || !renames[matches[0]]) return target;
    let next = renames[matches[0]];
    if (!raw.endsWith('.md')) next = next.slice(0, -3);
    if (!wiki) {
      const directory = sourcePath.split('/').slice(0, -1), parts = next.split('/');
      while (directory.length && parts.length && directory[0] === parts[0]) { directory.shift(); parts.shift(); }
      next = [...directory.map(() => '..'), ...parts].map(part => encodeURIComponent(part).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
    }
    return next + fragment;
  };
  const pattern = /!?\[\[([^\]\n]+)\]\]|!?\[(?:\\.|[^\]\\\n])*\]\([ \t]*(<[^>\n]+>|(?:\\.|[^\s()\\]|\([^()\n]*\))+)(?=[\s)])|^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]+>|[^\s\n]+)/gm;
  return source.replace(pattern, (whole: string, wikiTarget: string | undefined, inline: string | undefined, reference: string | undefined, offset: number) => {
    if (protectedRanges.some(([start, end]) => offset >= start && offset < end)) return whole;
    if (wikiTarget !== undefined) {
      const pipe = wikiTarget.indexOf('|'), target = pipe < 0 ? wikiTarget : wikiTarget.slice(0, pipe);
      return whole.replace(wikiTarget, destination(target, true) + (pipe < 0 ? '' : wikiTarget.slice(pipe)));
    }
    const token = inline ?? reference!, angle = token.startsWith('<'), target = angle ? token.slice(1, -1) : token;
    const next = destination(target, false);
    const start = inline !== undefined ? whole.indexOf('](') + 2 : whole.indexOf(']:') + 2;
    const at = whole.indexOf(token, start);
    return whole.slice(0, at) + (angle ? `<${next}>` : next) + whole.slice(at + token.length);
  });
}
