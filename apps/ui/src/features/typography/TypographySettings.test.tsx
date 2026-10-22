// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TypographyProvider } from './TypographyProvider';
import { TypographySettings } from './TypographySettings';
import { defaults, options, parseTypography, STORAGE_KEY } from './preferences';

beforeEach(() => {
  localStorage.clear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('validates persisted choices and rejects malformed values', () => {
  expect(parseTypography('{')).toEqual(defaults);
  expect(parseTypography('null')).toEqual(defaults);
  expect(parseTypography('{"size":"500","body":"url(remote)","leading":"1.9"}')).toEqual({ ...defaults, leading: '1.9' });
});
it.each([false, true])('applies, persists and restores content styles independently of interface styles (delayed frame: %s)', async delayedFrame => {
  const user = userEvent.setup();
  if (delayedFrame) {
    // Base UI opens pointer-triggered selects on the next animation frame.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => window.setTimeout(() => callback(performance.now()), 100));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => window.clearTimeout(id));
  }
  const mount = () => render(<TypographyProvider><TypographySettings /></TypographyProvider>);
  const first = mount();
  await user.click(screen.getByRole('combobox', { name: '字号' }));
  await user.click(await screen.findByRole('option', { name: '18px 基准' }));
  expect(document.documentElement.style.getPropertyValue('--note-size')).toBe('var(--font-size-lg)');
  expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe('');
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).size).toBe('18');
  first.unmount(); mount();
  expect(document.documentElement.style.getPropertyValue('--note-size')).toBe('var(--font-size-lg)');
  fireEvent.click(screen.getByRole('button', { name: '恢复默认风格' }));
  expect(document.documentElement.style.getPropertyValue('--note-size')).toBe('var(--font-size-base)');
  expect(document.documentElement.style.getPropertyValue('--note-measure')).toBe('720px');
});
it('synchronizes other tabs and reports failed persistence', () => {
  render(<TypographyProvider><TypographySettings /></TypographyProvider>);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify({ ...defaults, measure: '60' }) })));
  expect(document.documentElement.style.getPropertyValue('--note-measure')).toBe('448px');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  fireEvent.click(screen.getByRole('button', { name: '恢复默认风格' }));
  expect(screen.getByRole('status').textContent).toContain('无法保存');
});

it('offers only monospace choices while preserving an existing proportional code font', async () => {
  expect(options.mono).toEqual(['geist-mono', 'jetbrains-mono']);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaults, mono: 'inter' }));
  expect(parseTypography(localStorage.getItem(STORAGE_KEY)).mono).toBe('inter');
  render(<TypographyProvider><TypographySettings /></TypographyProvider>);
  const user = userEvent.setup();
  expect(screen.getByRole('combobox', { name: '笔记等宽字体' }).textContent).toContain('Inter');
  await user.click(screen.getByRole('combobox', { name: '笔记等宽字体' }));
  expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual(['Inter（已有设置）', 'Geist Mono', 'JetBrains Mono']);
  await user.click(screen.getByRole('option', { name: 'Geist Mono' }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).mono).toBe('geist-mono');
});

it('labels nominal reading widths honestly without changing the existing pixel widths', async () => {
  render(<TypographyProvider><TypographySettings /></TypographyProvider>);
  const user = userEvent.setup();
  for (const [name, pixels] of [['窄', '448px'], ['适中', '528px'], ['宽', '592px'], ['宽松', '720px']]) {
    await user.click(screen.getByRole('combobox', { name: '行宽' }));
    await user.click(await screen.findByRole('option', { name }));
    expect(document.documentElement.style.getPropertyValue('--note-measure')).toBe(pixels);
  }
  vi.spyOn(Math, 'random').mockReturnValue(0);
  fireEvent.click(screen.getByRole('button', { name: '随机搭配' }));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).mono).toBe('geist-mono');
});

it('distinguishes stored baseline sizes from actual browser-scaled pixels', async () => {
  render(<TypographyProvider><TypographySettings /></TypographyProvider>);
  expect(screen.getByRole('combobox', { name: '字号' }).textContent).toContain('16px 基准');
  expect(screen.getByText(/实际文字随浏览器缩放/)).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: '字号' }));
  expect((await screen.findAllByRole('option')).map(option => option.textContent)).toEqual(['14px 基准', '15px 基准', '16px 基准', '18px 基准']);
});
