import type { Note } from "@memocard/contracts";
import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import type { Document } from "yaml";

export class BrowserVaultError extends Error {
  constructor(public code: string, message: string, public retryable = false) {
    super(message);
    this.name = "BrowserVaultError";
  }
}

export type BrowserWritable = {
  write(data: Uint8Array | Blob | string): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
};
export type BrowserFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean; mode?: "exclusive" }): Promise<BrowserWritable>;
  isSameEntry(other: BrowserFileHandle | BrowserDirectoryHandle): Promise<boolean>;
};
export type BrowserDirectoryHandle = {
  kind: "directory";
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<BrowserDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<BrowserFileHandle>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterableIterator<[string, BrowserDirectoryHandle | BrowserFileHandle]>;
  isSameEntry(other: BrowserDirectoryHandle | BrowserFileHandle): Promise<boolean>;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
};
export type BrowserPicker = (options: { id: string; mode: "readwrite" }) => Promise<BrowserDirectoryHandle>;
export type ParsedBrowserNote = { note: Note; frontmatter: Document };

const maxNoteBytes = 8 * 1024 * 1024;

export function canonicalId(value: unknown): string {
  if (typeof value !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) {
    throw new BrowserVaultError("INVALID_ID", "笔记或笔记库 ID 必须是标准 UUID。");
  }
  return value.toLowerCase();
}

export function parseDate(value: unknown): number {
  if (typeof value !== "string") throw new BrowserVaultError("INVALID_DATE", "日期必须是包含时区的 ISO 8601 时间。");
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new BrowserVaultError("INVALID_DATE", "日期必须是包含时区的 ISO 8601 时间。");
  const [, y, m, d, h, min, s] = match.map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const time = Date.parse(value);
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1]! || h > 23 || min > 59 || s > 59 || !Number.isFinite(time)) {
    throw new BrowserVaultError("INVALID_DATE", "日期无效。");
  }
  return time;
}

export function validatedTags(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === "string" && tag.trim() && !tag.includes("\n"))) {
    throw new BrowserVaultError("INVALID_TAGS", "标签必须是字符串数组，不能为空或包含换行。");
  }
  return [...new Set(value)] as string[];
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readBytes(handle: BrowserFileHandle): Promise<Uint8Array> {
  const file = await handle.getFile();
  if (file.size > maxNoteBytes) throw new BrowserVaultError("NOTE_TOO_LARGE", "单条 Markdown 最大支持 8 MiB。");
  return new Uint8Array(await file.arrayBuffer());
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
  const doc = parseDocument(text.slice(4, end.index), { schema: "yaml-1.1", uniqueKeys: true, prettyErrors: false });
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
  const tagNode = doc.get("tags", true);
  if (tagNode !== undefined && (!isSeq(tagNode) || tagNode.items.some((tag) => !isScalar(tag) || typeof tag.value !== "string"))) {
    throw new BrowserVaultError("INVALID_TAGS", "tags 必须是字符串数组。");
  }
  const tags = validatedTags(isSeq(tagNode) ? tagNode.items.map((tag) => isScalar(tag) ? tag.value : null) : []);
  const deletedNode = doc.get("deletedAt", true);
  const deletedAt = deletedNode === undefined || (isScalar(deletedNode) && deletedNode.value === null) ? undefined : scalar("deletedAt");
  if (deletedAt !== undefined) parseDate(deletedAt);
  return { frontmatter: doc, note: {
    id, createdAt, updatedAt, tags, ...(deletedAt !== undefined ? { deletedAt } : {}),
    body: text.slice(end.index + end[0].length), contentHash: await sha256(bytes), relativePath,
    sourceUrl: `memocard://note/${id}?vault=${vaultId}`,
  } };
}

export function encodeBrowserNote(frontmatter: Document, body: string): Uint8Array {
  const bytes = new TextEncoder().encode(`---\n${frontmatter.toString({ lineWidth: 0 })}---\n${body}`);
  if (bytes.byteLength > maxNoteBytes) throw new BrowserVaultError("NOTE_TOO_LARGE", "单条 Markdown 最大支持 8 MiB。");
  return bytes;
}

export function safeParts(path: string, prefix: "notes" | "assets"): string[] {
  const parts = path.split("/");
  if (parts[0] !== prefix || parts.length < 2 || parts.some((part) => !part || part === "." || part === ".." || part.includes("\\") || [...part].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))) {
    throw new BrowserVaultError("PATH_NOT_ALLOWED", "文件路径超出笔记库允许的范围。");
  }
  return parts;
}

export async function fileAt(root: BrowserDirectoryHandle, path: string, prefix: "notes" | "assets", create = false): Promise<BrowserFileHandle> {
  const parts = safeParts(path, prefix);
  let directory = root;
  for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
  return directory.getFileHandle(parts.at(-1)!, { create });
}

export function fileError(error: unknown): BrowserVaultError {
  if (error instanceof BrowserVaultError) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return new BrowserVaultError("UNAUTHORIZED", "文件夹授权已失效，请重新授权；本机草稿仍然保留。", true);
  if (name === "NotReadableError") return new BrowserVaultError("FILE_PENDING", "文件当前不可读取，请先在系统文件管理器中完成下载后重试。", true);
  if (name === "NotFoundError") return new BrowserVaultError("FILE_NOT_FOUND", "文件或文件夹已移除，请重新选择笔记库。", true);
  if (name === "QuotaExceededError") return new BrowserVaultError("STORAGE_FULL", "本机存储空间不足，内容仍保留在编辑器中。", true);
  if (name === "NoModificationAllowedError") return new BrowserVaultError("FILE_BUSY", "文件正被其他页面写入，请稍后重试。", true);
  return new BrowserVaultError("IO_ERROR", "文件操作未完成，请检查文件夹权限和文件可用性。", true);
}

export function imageType(bytes: Uint8Array): { extension: string; mime: string } | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length > 24 && bytes.slice(0, 8).every((b, i) => b === [137, 80, 78, 71, 13, 10, 26, 10][i]) && ascii(12, 16) === "IHDR") return { extension: "png", mime: "image/png" };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: "jpg", mime: "image/jpeg" };
  if (bytes.length > 10 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) return { extension: "gif", mime: "image/gif" };
  if (bytes.length > 16 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { extension: "webp", mime: "image/webp" };
  if (bytes.length > 16 && ascii(4, 8) === "ftyp" && ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(ascii(8, 12))) return { extension: "heic", mime: "image/heic" };
  return null;
}
