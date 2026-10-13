import { request } from "./bridge";
import { resolvedImageURL, type ResolvedLink } from "./vault-links";
import { isBrowserVault } from "./client-mode";
import { getBrowserVaultBinding, readBrowserAsset } from "./browser-runtime";

// Only URLs already validated by assetUrl reach this renderer. Blob URLs are never
// accepted from Markdown itself, and every renderer owns and revokes its own URL.
export function bindNoteImage(image: HTMLImageElement, source: string, onError?: () => void): () => void {
  if (source.startsWith("memocard-resolve:")) {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const params = JSON.parse(decodeURIComponent(source.slice("memocard-resolve:".length))) as Record<string, unknown>;
    void request<ResolvedLink>("resolveLink", params).then(result => {
      if (!disposed) {
        if (result.kind === "image") cleanup = bindNoteImage(image, resolvedImageURL(result.path), onError);
        else onError?.();
      }
    }).catch(() => { if (!disposed) { image.title = "图片链接不存在或不唯一，请检查附件路径。"; onError?.(); } });
    return () => { disposed = true; cleanup?.(); };
  }
  if (!isBrowserVault) {
    image.src = source;
    return () => {};
  }
  const prefix = "memocard-asset://vault/";
  if (!source.startsWith(prefix)) { onError?.(); return () => {}; }
  let path: string;
  try { path = source.slice(prefix.length).split("/").map(decodeURIComponent).join("/"); }
  catch { onError?.(); return () => {}; }
  let disposed = false;
  let objectURL: string | undefined;
  const binding = getBrowserVaultBinding();
  if (!binding) { onError?.(); return () => {}; }
  void readBrowserAsset(path, binding).then((blob) => {
    if (disposed || getBrowserVaultBinding() !== binding) return;
    objectURL = URL.createObjectURL(blob);
    image.src = objectURL;
  }).catch(() => {
    if (!disposed) { image.title = "图片暂时无法读取，请检查文件夹授权和文件是否已下载。"; onError?.(); }
  });
  return () => {
    disposed = true;
    if (objectURL) URL.revokeObjectURL(objectURL);
    image.removeAttribute("src");
  };
}
