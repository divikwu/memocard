import { isBrowserVault } from "./client-mode";
import { getBrowserVaultBinding, readBrowserAsset } from "./browser-vault";

// Only URLs already validated by assetUrl reach this renderer. Blob URLs are never
// accepted from Markdown itself, and every renderer owns and revokes its own URL.
export function bindNoteImage(image: HTMLImageElement, source: string): () => void {
  if (!isBrowserVault) {
    image.src = source;
    return () => {};
  }
  const prefix = "memocard-asset://vault/";
  if (!source.startsWith(prefix)) return () => {};
  let path: string;
  try { path = source.slice(prefix.length).split("/").map(decodeURIComponent).join("/"); }
  catch { return () => {}; }
  let disposed = false;
  let objectURL: string | undefined;
  const binding = getBrowserVaultBinding();
  if (!binding) return () => {};
  void readBrowserAsset(path, binding).then((blob) => {
    if (disposed || getBrowserVaultBinding() !== binding) return;
    objectURL = URL.createObjectURL(blob);
    image.src = objectURL;
  }).catch(() => {
    if (!disposed) image.title = "图片暂时无法读取，请检查文件夹授权和文件是否已下载。";
  });
  return () => {
    disposed = true;
    if (objectURL) URL.revokeObjectURL(objectURL);
    image.removeAttribute("src");
  };
}
