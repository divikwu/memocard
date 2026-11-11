import { inlineTags, propertyTags } from './inline-tags';
export { inlineTags } from './inline-tags';
import type { Note } from "@memocard/contracts";
import { Document, isMap, isScalar, isSeq, parseDocument } from "yaml";
import { BrowserVaultError, canonicalId, maxNoteBytes, parseDate, sha256 } from "./browser-file-io";
import { fileTitle } from "./note-files";
export { BrowserVaultError, canonicalId, fileAt, fileError, parseDate, readBytes, safeParts, sha256, validatedTags } from "./browser-file-io";
export type { BrowserWritable, BrowserFileHandle, BrowserDirectoryHandle, BrowserPicker } from "./browser-file-io";


export type ParsedBrowserNote = { note: Note; frontmatter: Document; source?: string; header?: string };

const headerOpening = /^(?:\uFEFF)?---\r?\n/;
const legacyTitleLine = /^# memocard:title=([^\r\n]*)\r?\n/;
const bodyTitleLine = /^((?:[ \t]*\r?\n)*)<!-- memocard:title=([^ \r\n]+) -->(?:\r?\n|$)/;

function decodeTitle(encoded: string | undefined): string | undefined {
  try { return encoded ? decodeURIComponent(encoded) : undefined; }
  catch { return undefined; }
}

function noteContent(path: string, header: string, body: string) {
  const line = bodyTitleLine.exec(body), title = decodeTitle(line?.[2]);
  if (line && title) return { title, body: line[1] + body.slice(line[0].length) };
  return { title: decodeTitle(legacyTitleLine.exec(header.replace(headerOpening, ""))?.[1]) ?? fileTitle(path), body };
}

export function noteTitleOverride(title: string | undefined, original: ParsedBrowserNote | undefined, path: string): string | undefined {
  const display = title ?? original?.note.title;
  return display?.trim() && display !== fileTitle(path) ? display : undefined;
}

function withoutLegacyNoteTitle(header: string): string {
  const opening = headerOpening.exec(header)?.[0];
  if (!opening) return header;
  const rest = header.slice(opening.length), content = rest.replace(legacyTitleLine, "");
  if (rest === content) return header;
  if (/^---(?:\r?\n)?$/.test(content)) return header.startsWith("\uFEFF") ? "\uFEFF" : "";
  return opening + content;
}

function bodyWithNoteTitle(body: string, title: string | undefined, newline: string): string {
  if (title === undefined) return body;
  // Keep title metadata outside YAML so an external property edit can rewrite the header.
  const encoded = encodeURIComponent(title.replace(/[\uD800-\uDFFF]/gu, "\uFFFD")).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return "<!-- memocard:title=" + encoded + " -->" + newline + body;
}
function documentTags(doc: Document): string[] {
  const value = doc.get('tags');
  return propertyTags(isSeq(value) ? value.items.map(item => isScalar(item) ? item.value : null) : value);
}

export async function parseBrowserNote(bytes: Uint8Array, relativePath: string, vaultId: string): Promise<ParsedBrowserNote> {
  if (bytes.byteLength > maxNoteBytes) throw new BrowserVaultError("NOTE_TOO_LARGE", "单条 Markdown 最大支持 8 MiB。");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes).replace(/\r\n/g, "\n"); }
  catch { throw new BrowserVaultError("INVALID_NOTE", "笔记必须为 UTF-8 Markdown 文件。"); }
  const closing = /\n---(?:\n|$)/g;
  closing.lastIndex = 4;
  const end = closing.exec(text);
  if (!text.startsWith("---\n") || !end) throw new BrowserVaultError("INVALID_FRONTMATTER", "笔记需要完整的 YAML frontmatter。");
  const header = text.slice(0, end.index + end[0].length);
  const doc = parseDocument(text.slice(4, end.index).replace(legacyTitleLine, ""), { schema: "yaml-1.1", uniqueKeys: true, prettyErrors: false });
  if (doc.errors.length || !isMap(doc.contents) || doc.contents.items.some(({ key }) => !isScalar(key) || typeof key.value !== "string")) {
    throw new BrowserVaultError("INVALID_FRONTMATTER", "Frontmatter 必须是无重复字符串键的 YAML 对象。");
  }
  const scalar = (key: string): string => {
    const node = doc.get(key, true);
    if (!isScalar(node)) throw new BrowserVaultError("INVALID_FRONTMATTER", `笔记缺少有效的 ${key}。`);
    // Yams treats timestamp scalars as their original spelling; YAML 1.1 also parses them to Date.
    if (typeof node.value === "string") return node.value;
    if (node.value instanceof Date && node.source) return node.source;
    throw new BrowserVaultError("INVALID_FRONTMATTER", `笔记的 ${key} 格式无效。`);
  };
  const id = canonicalId(scalar("id"));
  const createdAt = scalar("createdAt"), updatedAt = scalar("updatedAt");
  parseDate(createdAt); parseDate(updatedAt);
  const { title, body } = noteContent(relativePath, header, text.slice(header.length));
  const tags = [...new Set([...documentTags(doc), ...inlineTags(body)])];
  const deletedNode = doc.get("deletedAt", true);
  const deletedAt = deletedNode === undefined || (isScalar(deletedNode) && deletedNode.value === null) ? undefined : scalar("deletedAt");
  if (deletedAt !== undefined) parseDate(deletedAt);
  return { frontmatter: doc, header, note: {
    id, title, createdAt, updatedAt, tags, ...(deletedAt !== undefined ? { deletedAt } : {}),
    body, contentHash: await sha256(bytes), relativePath,
    sourceUrl: `memocard://note/${id}?vault=${vaultId}`,
  } };
}

export function encodeBrowserNote(frontmatter: Document, body: string, title?: string): Uint8Array {
  let yaml = frontmatter.toString({ lineWidth: 0 });
  // YAML's JS values can round decimals/large integers and normalize timestamp offsets.
  const serialized = parseDocument(yaml, { schema: 'yaml-1.1' });
  const replacements: {from:number; to:number; source:string}[] = [];
  if (isMap(frontmatter.contents)) for (const pair of frontmatter.contents.items) {
    if (!isScalar(pair.key) || !isScalar(pair.value) || !pair.value.source || !(typeof pair.value.value === 'number' || pair.value.value instanceof Date)) continue;
    const node = serialized.get(pair.key.value as string, true);
    if (isScalar(node) && node.range) replacements.push({from:node.range[0],to:node.range[1],source:pair.value.source});
  }
  for (const item of replacements.sort((a,b)=>b.from-a.from)) yaml = yaml.slice(0,item.from) + item.source + yaml.slice(item.to);
  const bytes = new TextEncoder().encode(`---\n${yaml}---\n` + bodyWithNoteTitle(body, title, "\n"));
  if (bytes.byteLength > maxNoteBytes) throw new BrowserVaultError("NOTE_TOO_LARGE", "单条 Markdown 最大支持 8 MiB。");
  return bytes;
}

export type FileIdentity = { id: string; path: string; hash: string; createdAt: string };

/** Obsidian properties are user data; never interpret id/deletedAt as our lifecycle fields. */
export async function parseObsidianNote(bytes: Uint8Array, path: string, vaultId: string, identity: FileIdentity, modified: number): Promise<ParsedBrowserNote> {
  let source: string;
  try { source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new BrowserVaultError("INVALID_NOTE", "笔记必须为 UTF-8 Markdown 文件。"); }
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  const header = match?.[0] ?? (source.startsWith("\uFEFF") ? "\uFEFF" : "");
  const doc = match ? parseDocument(match[1], { uniqueKeys: true }) : new Document({});
  if (doc.errors.length || (doc.contents !== null && !isMap(doc.contents))) throw new BrowserVaultError("INVALID_FRONTMATTER", "无法安全读取 YAML 属性。");
  const { title, body } = noteContent(path, header, source.slice(header.length));
  return { source, header, frontmatter: doc, note: {
    id: identity.id, title, body, tags: [...new Set([...documentTags(doc), ...inlineTags(body)])],
    createdAt: identity.createdAt, updatedAt: new Date(modified || 0).toISOString(),
    contentHash: await sha256(bytes), relativePath: path, sourceUrl: `memocard://note/${identity.id}?vault=${vaultId}`,
  } };
}


export function encodeObsidianNote(parsed: ParsedBrowserNote | undefined, body: string, title?: string): Uint8Array {
  let header = withoutLegacyNoteTitle(parsed?.header ?? "");
  const newline = header.includes("\r\n") ? "\r\n" : "\n";
  const content = bodyWithNoteTitle(body, title, newline);
  if (content && header.endsWith("---")) header += newline;
  const bytes = new TextEncoder().encode(header + content);
  if (bytes.length > maxNoteBytes) throw new BrowserVaultError("NOTE_TOO_LARGE", "单条 Markdown 最大支持 8 MiB。");
  return bytes;
}
