// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const faces: { family: string; style: string; load: ReturnType<typeof vi.fn> }[] = [];
const add = vi.fn();
const loadNext = vi.fn();
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
beforeEach(() => {
  vi.resetModules(); faces.length = 0; add.mockClear(); loadNext.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { add } });
  vi.stubGlobal('FontFace', class {
    style: string;
    load = vi.fn(async () => { await loadNext(); return this; });
    constructor(public family: string, public source: string, descriptors: { style: string }) {
      this.style = descriptors.style; faces.push(this);
    }
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Reflect.deleteProperty(document, 'fonts');
});

it('loads normal text once and registers real italics without downloading them eagerly', async () => {
  const { loadFonts } = await import('./font-loader');
  await Promise.all([loadFonts(['noto-sans', 'noto-sans']), loadFonts(['noto-sans'])]);
  expect(faces.map(face => [face.family, face.style])).toEqual([['Noto Sans Variable', 'normal'], ['Noto Sans Variable', 'italic']]);
  expect(faces[0].load).toHaveBeenCalledOnce();
  expect(faces[1].load).not.toHaveBeenCalled();
  expect(add).toHaveBeenCalledTimes(2);
});

it('keeps the bundled Geist normal face and registers its italic companion only once', async () => {
  const { loadFonts } = await import('./font-loader');
  await loadFonts(['geist', 'geist']); await loadFonts(['geist']);
  expect(faces.map(face => [face.family, face.style])).toEqual([['Geist Variable', 'italic']]);
  expect(faces[0].load).not.toHaveBeenCalled();
});

it('allows retry after a normal face fails and does not invent missing italic assets', async () => {
  const { loadFonts } = await import('./font-loader');
  const failure = new Error('offline');
  loadNext.mockRejectedValueOnce(failure);
  await expect(loadFonts(['oxanium'])).rejects.toThrow('offline');
  await loadFonts(['oxanium']);
  expect(faces.map(face => face.style)).toEqual(['normal', 'normal']);
  expect(add).toHaveBeenCalledOnce();
});
