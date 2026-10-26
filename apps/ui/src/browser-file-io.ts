import { tagKey } from './inline-tags';

export const maxNoteBytes = 8 * 1024 * 1024;

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
  return [...new Set(value.map(tagKey))];
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

export function safeParts(path: string, prefix: "notes" | "assets" | "vault"): string[] {
  const parts = path.split("/");
  if ((prefix !== "vault" && (parts[0] !== prefix || parts.length < 2)) || parts.some((part) => !part || part === "." || part === ".." || part.includes("\\") || (prefix === "vault" && part.startsWith(".")) || [...part].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))) {
    throw new BrowserVaultError("PATH_NOT_ALLOWED", "文件路径超出笔记库允许的范围。");
  }
  return parts;
}

export async function fileAt(root: BrowserDirectoryHandle, path: string, prefix: "notes" | "assets" | "vault", create = false): Promise<BrowserFileHandle> {
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
