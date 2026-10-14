import type { BridgeRequest, BridgeResponse, PropertyChange } from "@memocard/contracts";
import { createId } from "./uuid";
import { isBrowserVault, isLocalWeb } from "./client-mode";
import { browserTransport } from "./browser-runtime";
import { externalUrl } from "./urls";

export { isBrowserVault, isLocalWeb } from "./client-mode";

type Transport = (request: BridgeRequest) => Promise<unknown>;
const pickerOperations = new Set(["selectVault", "reauthorizeVault", "pickImage", "setMCPEnabled"]);

declare global {
  interface Window {
    webkit?: { messageHandlers?: { memocard?: { postMessage: Transport } } };
  }
}

export class BridgeFailure extends Error {
  constructor(public code: string, message: string, public retryable = false) {
    super(message);
    this.name = "BridgeFailure";
  }
}

export function createBridge(transport?: Transport, timeoutMs = 15_000) {
  return async function request<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!transport) throw new BridgeFailure("NATIVE_REQUIRED", "请通过 MemoCard 本机服务或 Mac App 打开本机 Web，连接笔记文件夹。");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Invoke within the click's user activation, before any asynchronous initialization.
      const pendingReply = transport({ version: 1, requestId: createId(), operation, params });
      const reply = pickerOperations.has(operation) || timeoutMs === 0 ? await pendingReply : await Promise.race([
        pendingReply,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new BridgeFailure("TIMEOUT", "操作暂未完成。内容仍保留在编辑器中，请稍后重试。", true)), timeoutMs);
        }),
      ]);
      if (!reply || typeof reply !== "object" || !("ok" in reply) || typeof reply.ok !== "boolean") {
        throw new BridgeFailure("INVALID_RESPONSE", "无法识别 App 的响应，请重新打开应用。");
      }
      const response = reply as BridgeResponse<T>;
      if (!response.ok) {
        if (!response.error || typeof response.error.code !== "string" || typeof response.error.message !== "string") {
          throw new BridgeFailure("INVALID_RESPONSE", "App 返回了不完整的错误信息。");
        }
        throw new BridgeFailure(response.error.code, response.error.message, response.error.retryable === true);
      }
      if (!("data" in reply)) throw new BridgeFailure("INVALID_RESPONSE", "App 未返回操作结果。");
      return response.data;
    } catch (error) {
      if (error instanceof BridgeFailure) throw error;
      throw new BridgeFailure("BRIDGE_UNAVAILABLE", "与 App 的连接暂时中断，请保留内容并重试。", true);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}

const handler = typeof window === "undefined" ? undefined : window.webkit?.messageHandlers?.memocard;
export const isNative = Boolean(handler);
export const isConnectedClient = isNative || isLocalWeb || isBrowserVault;
// A browser file write must report its actual close result, not time out while it can still commit.
export const request = createBridge(handler ? (message) => handler.postMessage(message) : isLocalWeb ? createWebTransport() : isBrowserVault ? createBrowserFileTransport() : undefined, isBrowserVault ? 0 : 15_000);

export function createBrowserFileTransport(transport: Transport = browserTransport!): Transport {
  return async (message) => {
    if (message.operation === "openExternal") {
      const url = typeof message.params.url === "string" ? externalUrl(message.params.url) : null;
      if (!url) throw new BridgeFailure("INVALID_ARGUMENT", "这个链接无法打开。");
      window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true, data: {} };
    }
    if (message.operation === "pickImage") {
      const file = await pickWebImage();
      if (!file) return { ok: true, data: null };
      return transport({ ...message, operation: "importAttachment", params: { ...message.params, name: file.name, base64: await imageBase64(file) } });
    }
    return transport(message);
  };
}

export function createWebTransport(fetcher: typeof fetch = fetch): Transport {
  const connecting = window.location.hash.startsWith("#/connect?");
  let token = connecting ? new URLSearchParams(window.location.hash.slice("#/connect?".length)).get("token") : null;
  // The one-time credential must not remain in browser history or in copied links.
  if (connecting) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/home`);
  let session: Promise<void> | undefined;

  async function post(path: string, value: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    } catch {
      throw new BridgeFailure("BRIDGE_UNAVAILABLE", "此页面连接的 MemoCard 本机服务已停止。请重新打开本机 Web；编辑中的内容仍保留在此页面。");
    }
    if (response.status === 401 || response.status === 403) throw new BridgeFailure("WEB_UNAUTHORIZED", "此页面的本机 Web 授权已失效。请重新打开本机 Web；编辑中的内容仍保留在此页面。");
    if (!response.ok) throw new BridgeFailure("WEB_UNAVAILABLE", "本机 Web 暂时无法完成操作，请重试。", true);
    try { return await response.json(); }
    catch { throw new BridgeFailure("INVALID_RESPONSE", "无法识别本机 Web 的响应，请从 MemoCard 本机宿主重新打开。"); }
  }

  return async (message) => {
    if (token) {
      const credential = token;
      token = null;
      session = post("/api/session", { token: credential }).then(() => undefined);
    }
    await session;
    if (message.operation === "openExternal") {
      const url = typeof message.params.url === "string" ? externalUrl(message.params.url) : null;
      if (!url) throw new BridgeFailure("INVALID_ARGUMENT", "这个链接无法打开。");
      window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true, data: {} };
    }
    if (message.operation === "pickImage") {
      const file = await pickWebImage();
      if (!file) return { ok: true, data: null };
      const params = { ...message.params, name: file.name, base64: await imageBase64(file) };
      return post("/api/bridge", { ...message, operation: "importAttachment", params });
    }
    return post("/api/bridge", message);
  };
}

function pickWebImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".png,.jpg,.jpeg,.webp,.gif,.heic,.heif";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

export async function imageBase64(file: File): Promise<string> {
  if (!/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name)) throw new BridgeFailure("INVALID_ARGUMENT", "请选择 PNG、JPEG、WebP、GIF、HEIC 或 HEIF 图片。");
  if (file.size > 20 * 1024 * 1024) throw new BridgeFailure("INVALID_ARGUMENT", "图片不能超过 20 MB。");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => typeof reader.result === "string" ? resolve(reader.result.slice(reader.result.indexOf(",") + 1)) : reject(new BridgeFailure("INVALID_ARGUMENT", "无法读取这张图片。")), { once: true });
    reader.addEventListener("error", () => reject(new BridgeFailure("INVALID_ARGUMENT", "无法读取这张图片，请重新选择。")), { once: true });
    reader.readAsDataURL(file);
  });
}

export { errorMessage } from "./error-messages";

export type StorageMode = "native" | "local-web" | "browser";
export type SelectVaultResult = { cancelled: true; diagnostic?: string } | { reconnectUrl: string } | { vaultId: string; vaultBinding?: string };
export type RegisteredVault = { vaultId: string; name: string; active: boolean };
export type Environment = { platform: "mac" | "ios" | "web"; phase: string; storage: StorageMode; mcpEnabled: boolean; webEnabled?: boolean; capabilities: string[]; vaultBinding?: string };
export function reconnectVault(url: string, location: Pick<Location, "replace" | "reload"> = window.location): void {
  location.replace(url);
  // A same-origin reconnect only changes the hash, so force a document reload to
  // construct a fresh transport that can redeem the new one-time credential.
  location.reload();
}
export type Draft = { id: string; title?: string; body: string; tags: string[]; inheritedTags?: string[]; pendingProperties?: PropertyChange[]; baseHash: string | null; relativePath?: string; updatedAt?: string; vaultBinding?: string; draftKey?: string; revision?:string; unscoped?:boolean; recoveryScope?:string; reminderDismissed?:boolean; recoveredFrom?:{draftKey:string;revision:string;unscoped?:boolean;scope?:string} };
export type Attachment = { relativePath: string; markdownPath: string; notePath?: string };

export type DraftIssue = {path?:string;code:string;message:string};
export type DraftList = {drafts:Draft[];unscopedDrafts?:Draft[];issues?:DraftIssue[]};
