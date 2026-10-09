// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TypographyProvider } from './TypographyProvider';
import { TypographySettings } from './TypographySettings';
import { defaults, parseTypography, STORAGE_KEY } from './preferences';

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
it('applies content styles, persists choices, remounts and restores defaults independently of interface styles', async () => {
  const user = userEvent.setup();
  const mount = () => render(<TypographyProvider><TypographySettings /></TypographyProvider>);
  const first = mount();
  await user.click(screen.getByRole('combobox', { name: '字号' }));
  await user.click(screen.getByRole('option', { name: '18px' }));
  expect(document.documentElement.style.getPropertyValue('--note-size')).toBe('18px');
  expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe('');
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).size).toBe('18');
  first.unmount(); mount();
  expect(document.documentElement.style.getPropertyValue('--note-size')).toBe('18px');
  fireEvent.click(screen.getByRole('button', { name: '恢复默认风格' }));
  expect(document.documentElement.style.getPropertyValue('--note-size')).toBe('16px');
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
