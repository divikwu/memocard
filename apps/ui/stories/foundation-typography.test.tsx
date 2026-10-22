// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FontChoiceRows } from './foundation-typography.example';

const { loadFonts } = vi.hoisted(() => ({ loadFonts: vi.fn() }));
vi.mock('../src/features/theme/font-loader', () => ({ loadFonts }));
const observers: { element?: Element; trigger: () => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
const load = vi.fn();
beforeEach(() => {
  observers.length = 0; loadFonts.mockReset().mockResolvedValue([]); load.mockReset().mockResolvedValue([]);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load } });
  vi.stubGlobal('IntersectionObserver', class {
    element?: Element;
    disconnect = vi.fn();
    trigger: () => void;
    constructor(callback: IntersectionObserverCallback) {
      this.trigger = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      observers.push(this);
    }
    observe(element: Element) { this.element = element; }
  });
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Reflect.deleteProperty(document, 'fonts');
});
function show(font: string) { act(() => [...observers].reverse().find(observer => observer.element?.getAttribute('data-font-choice') === font)!.trigger()); }
const mount = () => render(<table><tbody><FontChoiceRows /></tbody></table>);

it('loads only visible font rows and keeps offscreen samples on the existing fallback', async () => {
  const { container, unmount } = mount();
  expect(container.querySelectorAll('[data-font-choice]')).toHaveLength(28);
  expect(loadFonts).not.toHaveBeenCalled();
  expect(container.querySelectorAll('.foundation-font-choice[style]')).toHaveLength(0);
  show('inter');
  await waitFor(() => expect(container.querySelector('[data-font-choice="inter"]')?.getAttribute('data-font-state')).toBe('ready'));
  expect(loadFonts).toHaveBeenCalledExactlyOnceWith(['inter']);
  expect(load).toHaveBeenCalledOnce();
  expect(container.querySelectorAll('.foundation-font-choice[style]')).toHaveLength(1);
  unmount(); expect(observers.every(observer => observer.disconnect.mock.calls.length > 0)).toBe(true);
});

it('isolates failures to one row without affecting successful samples', async () => {
  loadFonts.mockImplementation(async ([font]: string[]) => { if (font === 'inter') throw new Error('offline'); return []; });
  const { container } = mount(); show('geist'); show('inter');
  await screen.findByText('加载失败，使用回退字体。');
  expect(container.querySelector('[data-font-choice="geist"]')?.getAttribute('data-font-state')).toBe('ready');
  expect(container.querySelector('[data-font-choice="inter"] .foundation-font-choice')?.getAttribute('style')).toBeNull();
  expect(loadFonts.mock.calls.map(([fonts]) => fonts)).toEqual([['geist'], ['inter']]);
});

it('reports glyph/subset loading failure as fallback instead of claiming the sample is ready', async () => {
  load.mockRejectedValueOnce(new Error('subset offline'));
  const { container } = mount(); show('noto-sans-sc');
  await screen.findByText('加载失败，使用回退字体。');
  expect(container.querySelector('[data-font-choice="noto-sans-sc"]')?.getAttribute('data-font-state')).toBe('fallback');
});

it('disconnects observers and does not start glyph loading after the table is unmounted', async () => {
  let finish!: (value: unknown[]) => void;
  loadFonts.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { unmount } = mount(); show('inter'); unmount();
  await act(async () => { finish([]); });
  expect(load).not.toHaveBeenCalled();
  expect(observers.every(observer => observer.disconnect.mock.calls.length > 0)).toBe(true);
});
