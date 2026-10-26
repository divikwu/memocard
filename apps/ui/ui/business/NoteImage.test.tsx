// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { VaultImage as NoteImage } from './NoteMarkdown';
import { bindNoteImage } from '../../src/note-image';

vi.mock('../../src/note-image', () => ({bindNoteImage:vi.fn(() => vi.fn())}));
const runtime = vi.hoisted(() => ({ browser: false, binding: null as string | null }));
vi.mock('../../src/bridge', () => ({ get isBrowserVault() { return runtime.browser; }, isLocalWeb:false, getBrowserVaultBinding:()=>runtime.binding }));
afterEach(() => { runtime.browser = false; runtime.binding = null; cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

it('reserves supplied dimensions and clears busy state after decoding the image', () => {
  render(<NoteImage source="/image.png" alt="封面" width={640} height={320} />);
  const button = screen.getByRole('button', {name:'查看大图 封面'});
  const image = screen.getByRole('img', {name:'封面'});
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(image.getAttribute('width')).toBe('640');
  expect(image.getAttribute('height')).toBe('320');
  fireEvent.load(image);
  expect(button.getAttribute('aria-busy')).toBe('false');
  expect(button.getAttribute('data-image-state')).toBe('loaded');
});

it('starts loading a changed source and disposes the previous vault binding', () => {
  const dispose = vi.fn();
  vi.mocked(bindNoteImage).mockReturnValue(dispose);
  const view = render(<NoteImage source="/first.png" alt="封面" />);
  fireEvent.load(screen.getByRole('img', {name:'封面'}));
  view.rerender(<NoteImage source="/second.png" alt="封面" />);
  expect(dispose).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', {name:'查看大图 封面'}).getAttribute('aria-busy')).toBe('true');
  fireEvent.error(screen.getByRole('img', {name:'封面'}));
  expect(screen.getByText('图片暂时无法读取')).toBeTruthy();
  expect(screen.getByRole('button', {name:'查看大图 封面'}).getAttribute('aria-busy')).toBe('false');
});

it('restores a decoded image before paint when switching back to it', () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(900);
  const first = render(<NoteImage source="/cached-switch.png" alt="照片" loading="lazy" />);
  first.unmount();
  render(<NoteImage source="/cached-switch.png" alt="照片" loading="lazy" />);
  const image = screen.getByRole('img', { name: '照片' });
  expect(image.getAttribute('width')).toBe('600');
  expect(image.getAttribute('height')).toBe('900');
  expect(image.hasAttribute('loading')).toBe(false);
  expect(screen.getByRole('button', { name: '查看大图 照片' }).getAttribute('data-image-state')).toBe('loaded');
});

it('reserves known image dimensions while a remounted image is still loading', () => {
  const first = render(<NoteImage source="/reserved-switch.png" alt="照片" loading="lazy" />);
  const image = screen.getByRole('img', { name: '照片' });
  Object.defineProperties(image, { naturalWidth: { value: 640 }, naturalHeight: { value: 320 } });
  fireEvent.load(image);
  first.unmount();
  render(<NoteImage source="/reserved-switch.png" alt="照片" loading="lazy" />);
  const restored = screen.getByRole('img', { name: '照片' });
  expect(restored.getAttribute('width')).toBe('640');
  expect(restored.getAttribute('height')).toBe('320');
  expect(screen.getByRole('button', { name: '查看大图 照片' }).getAttribute('data-image-sized')).toBe('true');
});

it('does not mistake the previous image for a newly resolving link', () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(900);
  const view = render(<NoteImage source="/previous-decoded.png" alt="照片" />);
  view.rerender(<NoteImage source="memocard-resolve:pending" alt="照片" />);
  expect(screen.getByRole('button', { name: '查看大图 照片' }).getAttribute('data-image-state')).toBe('loading');
});

it('keeps editor images eager, Markdown images lazy, and compact images noninteractive', () => {
  const view = render(<NoteImage source="/eager.png" alt="编辑图片" />);
  expect(screen.getByRole('img').hasAttribute('loading')).toBe(false);
  view.rerender(<NoteImage source="/lazy.png" alt="摘要图片" loading="lazy" interactive={false} />);
  expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy');
  expect(screen.queryByRole('button')).toBeNull();
});

it('retries a failed image binding without losing its reserved geometry', () => {
  render(<NoteImage source="/retry.png" alt="照片" width={640} height={320} loading="lazy" />);
  const image = screen.getByRole('img', { name: '照片' });
  fireEvent.error(image);
  const attempts = vi.mocked(bindNoteImage).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: '重试读取图片 照片' }));
  expect(bindNoteImage).toHaveBeenCalledTimes(attempts + 1);
  expect(screen.getByRole('button', { name: '查看大图 照片' }).getAttribute('aria-busy')).toBe('true');
  expect(image.getAttribute('width')).toBe('640');
  expect(image.getAttribute('height')).toBe('320');
  fireEvent.load(image);
  expect(screen.queryByRole('button', { name: '重试读取图片 照片' })).toBeNull();
});

it('does not reserve dimensions cached for another vault binding', () => {
  runtime.browser = true; runtime.binding = 'vault-a';
  const first = render(<NoteImage source="memocard-asset://vault/assets/isolated.png" alt="封面" loading="lazy" />);
  const image = screen.getByRole('img');
  Object.defineProperties(image, { naturalWidth: { value: 640 }, naturalHeight: { value: 320 } });
  fireEvent.load(image); first.unmount();
  runtime.binding = 'vault-b';
  render(<NoteImage source="memocard-asset://vault/assets/isolated.png" alt="封面" loading="lazy" />);
  expect(screen.getByRole('img').hasAttribute('width')).toBe(false);
  expect(screen.getByRole('img').hasAttribute('height')).toBe(false);
  expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy');
  expect(screen.getByRole('button', { name: '查看大图 封面' }).getAttribute('aria-busy')).toBe('true');
});
