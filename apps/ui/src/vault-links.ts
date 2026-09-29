import { request } from "./bridge";
import { assetUrl, internalTarget } from "./urls";
import { isLocalWeb } from "./client-mode";

export type ResolvedLink = { kind: "note"; id: string; path: string } | { kind: "image"; path: string };
export function resolvedImageURL(path: string): string {
  return `${isLocalWeb ? "/api/assets/" : "memocard-asset://vault/"}${path.split("/").map(encodeURIComponent).join("/")}`;
}
export function deferredImageURL(target: string, sourcePath: string, wiki = false): string {
  return `memocard-resolve:${encodeURIComponent(JSON.stringify({ target, sourcePath, wiki }))}`;
}
export async function openVaultLink(target: string, sourcePath: string, wiki: boolean): Promise<void> {
  const result = await request<ResolvedLink>("resolveLink", { target, sourcePath, wiki });
  if (result.kind !== "note") throw new Error("此链接不是 Markdown 笔记，暂不支持在此处打开。");
  window.dispatchEvent(new CustomEvent("memocard:open-note", { detail: { id: result.id } }));
}


export function imageSource(target: string, sourcePath: string, wiki = false): string | null {
  if (wiki) return internalTarget(target) ? deferredImageURL(target, sourcePath, true) : null;
  const direct = assetUrl(target, sourcePath);
  if (!direct) return null;
  return target.startsWith(".") || target.startsWith("memocard-asset:") ? direct : deferredImageURL(target, sourcePath);
}
