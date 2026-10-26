// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bindNoteImage } from './note-image';
import { request } from './bridge';
import { readBrowserAsset } from './browser-runtime';

const state = vi.hoisted(() => ({ binding: 'vault-a', browser: true }));
vi.mock('./bridge', () => ({ request: vi.fn() }));
vi.mock('./client-mode', () => ({ isLocalWeb: false, get isBrowserVault() { return state.browser; } }));
vi.mock('./browser-runtime', () => ({ readBrowserAsset: vi.fn(), getBrowserVaultBinding: () => state.binding }));

const releases: (() => void)[] = [];
const pending: ((blob: Blob) => void)[] = [];
const observers: VisibilityObserver[] = [];
const intersection = (target: Element, isIntersecting: boolean): IntersectionObserverEntry => ({
  target, isIntersecting, time: 0, rootBounds: null, intersectionRatio: isIntersecting ? 1 : 0,
  boundingClientRect: target.getBoundingClientRect(), intersectionRect: target.getBoundingClientRect(),
});
class VisibilityObserver {
  target: Element | null = null;
  constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) { observers.push(this); }
  observe(target: Element) { this.target = target; }
  disconnect() { this.target = null; }
  show(visible = true) { if (this.target) this.callback([intersection(this.target, visible)], this as unknown as IntersectionObserver); }
}
const settle = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
const image = (index: number, source = `memocard-asset://vault/assets/photo-${index}.png`) => {
  const target = document.createElement('img');
  target.loading = 'lazy';
  document.body.append(target);
  releases.push(bindNoteImage(target, source, undefined, { lazy: true }));
  return target;
};
beforeEach(() => {
  state.binding = 'vault-a'; state.browser = true; observers.length = 0;
  vi.mocked(request).mockReset();
  vi.mocked(readBrowserAsset).mockReset().mockResolvedValue(new Blob(['image']));
  vi.stubGlobal('IntersectionObserver', VisibilityObserver);
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:http://localhost/image');
    static revokeObjectURL = vi.fn();
  });
});
afterEach(async () => {
  releases.splice(0).forEach(release => release());
  pending.splice(0).forEach(resolve => resolve(new Blob(['image'])));
  await settle();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('does not read clipped or offscreen lazy images and limits visible file reads to four', async () => {
  vi.mocked(readBrowserAsset).mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  for (let index = 0; index < 30; index++) image(index);
  expect(readBrowserAsset).not.toHaveBeenCalled();
  expect(observers.every(observer => observer.options.root === null && !observer.options.rootMargin)).toBe(true);
  observers[0].show(false);
  expect(readBrowserAsset).not.toHaveBeenCalled();
  observers.slice(0, 10).forEach(observer => observer.show());
  expect(readBrowserAsset).toHaveBeenCalledTimes(4);
  pending.splice(0).forEach(resolve => resolve(new Blob(['image'])));
  await settle();
  expect(readBrowserAsset).toHaveBeenCalledTimes(8);
});

it('waits for visibility before resolving a wiki image and skips unmounted queued reads', async () => {
  vi.mocked(readBrowserAsset).mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  vi.mocked(request).mockResolvedValue({ kind: 'image', path: 'assets/resolved.png' });
  const source = `memocard-resolve:${encodeURIComponent(JSON.stringify({ target: 'resolved.png', sourcePath: 'notes/a.md', wiki: true }))}`;
  image(0, source);
  expect(request).not.toHaveBeenCalled();
  observers[0].show();
  await settle();
  expect(request).toHaveBeenCalledWith('resolveLink', { target: 'resolved.png', sourcePath: 'notes/a.md', wiki: true });
  for (let index = 1; index < 8; index++) { image(index); observers.at(-1)!.show(); }
  expect(readBrowserAsset).toHaveBeenCalledTimes(4);
  releases.splice(4).forEach(release => release());
  pending.splice(0).forEach(resolve => resolve(new Blob(['image'])));
  await settle();
  expect(readBrowserAsset).toHaveBeenCalledTimes(4);
});

it('discards in-flight and queued reads from a replaced vault binding', async () => {
  vi.mocked(readBrowserAsset).mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  for (let index = 0; index < 8; index++) { image(index); observers.at(-1)!.show(); }
  expect(readBrowserAsset).toHaveBeenCalledTimes(4);
  state.binding = 'vault-b';
  pending.splice(0).forEach(resolve => resolve(new Blob(['image'])));
  await settle();
  expect(readBrowserAsset).toHaveBeenCalledTimes(4);
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('starts a visible image once even if intersection notifications were already queued', () => {
  vi.mocked(readBrowserAsset).mockImplementation(() => new Promise(resolve => pending.push(resolve)));
  const target = image(0), observer = observers[0];
  observer.show();
  observer.callback([intersection(target, true)], observer as unknown as IntersectionObserver);
  expect(readBrowserAsset).toHaveBeenCalledTimes(1);
  releases[0]();
  observer.callback([intersection(target, true)], observer as unknown as IntersectionObserver);
  expect(readBrowserAsset).toHaveBeenCalledTimes(1);
});

it('allows a failed visible binding to retry and suppresses failures after a vault switch', async () => {
  vi.mocked(readBrowserAsset).mockRejectedValueOnce(new Error('Missing image'));
  const failed = vi.fn(), target = document.createElement('img');
  document.body.append(target);
  const source = 'memocard-asset://vault/assets/retry.png';
  const release = bindNoteImage(target, source, failed, { lazy: true });
  observers.at(-1)!.show();
  await settle();
  expect(failed).toHaveBeenCalledOnce();
  release();
  releases.push(bindNoteImage(target, source, failed, { lazy: true }));
  observers.at(-1)!.show();
  await settle();
  expect(URL.createObjectURL).toHaveBeenCalledOnce();
  let reject!: (cause: Error) => void;
  vi.mocked(readBrowserAsset).mockReturnValue(new Promise((_resolve, no) => { reject = no; }));
  releases.push(bindNoteImage(document.createElement('img'), source, failed));
  state.binding = 'vault-b'; reject(new Error('Old vault is gone'));
  await settle();
  expect(failed).toHaveBeenCalledOnce();
});

it('keeps native lazy URL delivery in the browser loader without allocating JS assets', () => {
  state.browser = false;
  const target = image(0);
  expect(target.getAttribute('src')).toBe('memocard-asset://vault/assets/photo-0.png');
  expect(observers).toHaveLength(0);
  expect(readBrowserAsset).not.toHaveBeenCalled();
});

it('checks every clipping ancestor and listens to nested scrolls without IntersectionObserver', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const outer = document.createElement('div'), clip = document.createElement('div'), frame = document.createElement('span'), target = document.createElement('img');
  outer.style.overflowX = outer.style.overflowY = 'auto';
  clip.style.overflowX = clip.style.overflowY = 'hidden'; frame.dataset.imageState = 'loading';
  outer.append(clip); clip.append(frame); frame.append(target); document.body.append(outer);
  outer.getBoundingClientRect = () => new DOMRect(0, 0, 300, 300);
  clip.getBoundingClientRect = () => new DOMRect(0, 0, 300, 100);
  let top = 150;
  frame.getBoundingClientRect = () => new DOMRect(0, top, 160, 80);
  releases.push(bindNoteImage(target, 'memocard-asset://vault/assets/scroll.png', undefined, { lazy: true }));
  expect(readBrowserAsset).not.toHaveBeenCalled();
  top = 30;
  outer.dispatchEvent(new Event('scroll'));
  await vi.waitFor(() => expect(readBrowserAsset).toHaveBeenCalledTimes(1));
  releases.at(-1)!();
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
});
