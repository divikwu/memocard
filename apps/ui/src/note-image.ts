import { request } from "./bridge";
import { resolvedImageURL, type ResolvedLink } from "./vault-links";
import { isBrowserVault } from "./client-mode";
import { getBrowserVaultBinding, readBrowserAsset } from "./browser-runtime";

const imageReads: { run: () => Promise<void> }[] = [];
let activeReads = 0;
function queueImageRead(run: () => Promise<void>) {
  const task = { run };
  imageReads.push(task);
  function drain() {
    while (activeReads < 4 && imageReads.length) {
      const next = imageReads.shift()!;
      activeReads++;
      void next.run().finally(() => { activeReads--; drain(); });
    }
  }
  drain();
  return () => { const index = imageReads.indexOf(task); if (index !== -1) imageReads.splice(index, 1); };
}

function whenVisible(image: HTMLImageElement, load: () => void): () => void {
  // The placeholder owns geometry before an image has a decoded size. A null
  // root also includes every ancestor clip, including fixed-height note cards.
  const target = image.closest<HTMLElement>('[data-image-state]') ?? image;
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { root: null });
    observer.observe(target);
    return () => observer.disconnect();
  }
  let frame = 0, stopped = false;
  let observer: ResizeObserver | undefined;
  const ancestors: HTMLElement[] = [];
  for (let parent = target.parentElement; parent; parent = parent.parentElement) ancestors.push(parent);
  const stop = () => {
    stopped = true; cancelAnimationFrame(frame); observer?.disconnect();
    document.removeEventListener('scroll', schedule, true);
    document.removeEventListener('load', schedule, true);
    document.removeEventListener('toggle', schedule, true);
    window.removeEventListener('resize', schedule);
  };
  function check() {
    frame = 0;
    if (stopped || !target.isConnected) return;
    const rect = target.getBoundingClientRect();
    let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
    let right = Math.min(window.innerWidth, rect.right), bottom = Math.min(window.innerHeight, rect.bottom);
    for (const parent of ancestors) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      if (/hidden|clip|scroll|auto/.test(style.overflowX || style.overflow)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (/hidden|clip|scroll|auto/.test(style.overflowY || style.overflow)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    if (right > left && bottom > top) { stop(); load(); }
  }
  function schedule() { if (!stopped && !frame) frame = requestAnimationFrame(check); }
  document.addEventListener('scroll', schedule, true);
  document.addEventListener('load', schedule, true);
  document.addEventListener('toggle', schedule, true);
  window.addEventListener('resize', schedule);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    for (const element of [target, ...ancestors]) observer.observe(element);
  }
  check();
  return stop;
}

// Only URLs already validated by assetUrl reach this renderer. Blob URLs are never
// accepted from Markdown itself, and every renderer owns and revokes its own URL.
export function bindNoteImage(image: HTMLImageElement, source: string, onError?: () => void, { lazy = false }: { lazy?: boolean } = {}): () => void {
  let disposed = false, started = false;
  let objectURL: string | undefined;
  let cancelRead: (() => void) | undefined;
  const browser = isBrowserVault, resolving = source.startsWith('memocard-resolve:');
  const binding = browser ? getBrowserVaultBinding() : null;
  const alive = () => !disposed && (!browser || getBrowserVaultBinding() === binding);
  async function read() {
    if (!alive()) return;
    try {
      let url = source;
      if (resolving) {
        const params = JSON.parse(decodeURIComponent(source.slice('memocard-resolve:'.length))) as Record<string, unknown>;
        const result = await request<ResolvedLink>('resolveLink', params);
        if (!alive()) return;
        if (result.kind !== 'image') { onError?.(); return; }
        url = resolvedImageURL(result.path);
      }
      if (!browser) { image.src = url; return; }
      const prefix = 'memocard-asset://vault/';
      if (!binding || !url.startsWith(prefix)) { onError?.(); return; }
      const path = url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');
      const blob = await readBrowserAsset(path, binding);
      if (!alive()) return;
      objectURL = URL.createObjectURL(blob);
      image.src = objectURL;
    } catch {
      if (alive()) {
        image.title = resolving ? '图片链接不存在或不唯一，请检查附件路径。' : '图片暂时无法读取，请检查文件夹授权和文件是否已下载。';
        onError?.();
      }
    }
  }
  const start = () => {
    if (started || !alive()) return;
    started = true;
    // Native/local Web URLs already use the browser's image loader; they do not
    // allocate a JS Blob and retain its existing loading/cache behavior.
    if (!browser && !resolving) { if (image.getAttribute('src') !== source) image.src = source; }
    else cancelRead = queueImageRead(read);
  };
  const stopWaiting = lazy && (browser || resolving) ? whenVisible(image, start) : (start(), () => {});
  return () => {
    disposed = true; stopWaiting(); cancelRead?.();
    if (objectURL) URL.revokeObjectURL(objectURL);
    if (browser) image.removeAttribute('src');
  };
}
