// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ImageViewer from './ImageViewer';
import { bindNoteImage } from './note-image';

vi.mock('./note-image', () => ({ bindNoteImage: vi.fn() }));
let loader: HTMLImageElement;
let fail: (() => void) | undefined;
const dispose = vi.fn();
beforeEach(() => {
  dispose.mockReset();
  vi.mocked(bindNoteImage).mockImplementation((image, _source, onError) => {
    loader = image; fail = onError;
    return dispose;
  });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('keeps a resolved local image alive until the viewer closes and supports Escape', async () => {
  const onClose = vi.fn(), user = userEvent.setup();
  const view = render(<ImageViewer source="memocard-asset://vault/assets/a.png" alt="封面" onClose={onClose} />);
  expect(screen.getByRole('status').textContent).toBe('正在读取图片…');
  expect(screen.getByRole('heading', { name: '封面' }).className).toContain('sr-only');
  loader.src = 'blob:http://localhost/resolved';
  loader.dispatchEvent(new Event('load'));
  expect((await screen.findByRole('img', { name: '封面' })).getAttribute('src')).toBe('blob:http://localhost/resolved');
  expect(dispose).not.toHaveBeenCalled();
  await user.click(screen.getByRole('img', { name: '封面' }));
  expect(onClose).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledOnce();
  view.unmount();
  expect(dispose).toHaveBeenCalledOnce();
});

it('closes when clicking the empty area around the image', async () => {
  const onClose = vi.fn(), user = userEvent.setup();
  render(<ImageViewer source="memocard-asset://vault/assets/a.png" alt="封面" onClose={onClose} />);
  loader.src = 'blob:http://localhost/resolved';
  loader.dispatchEvent(new Event('load'));
  await screen.findByRole('img', { name: '封面' });
  await user.click(screen.getByRole('dialog', { name: '封面' }));
  expect(onClose).toHaveBeenCalledOnce();
});

it('releases the previous binding when the source changes, and allows closing a failed image', async () => {
  const onClose = vi.fn(), user = userEvent.setup();
  const view = render(<ImageViewer source="memocard-asset://vault/assets/a.png" alt="封面" onClose={onClose} />);
  const previous = loader;
  view.rerender(<ImageViewer source="memocard-asset://vault/assets/b.png" alt="封面" onClose={onClose} />);
  expect(dispose).toHaveBeenCalledOnce();
  expect(previous.onload).toBeNull();
  expect(previous.onerror).toBeNull();
  fail?.();
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('图片暂时无法读取'));
  await user.click(screen.getByRole('button', { name: '关闭图片' }));
  expect(onClose).toHaveBeenCalledOnce();
});
