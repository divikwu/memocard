// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNoteImage } from './use-note-image';

vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: true }));
vi.mock('./browser-runtime', () => ({ getBrowserVaultBinding: () => null, readBrowserAsset: vi.fn() }));
vi.mock('./bridge', () => ({ request: vi.fn() }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function DirectImage({ source }: { source: string }) {
  const { ref, state, onLoaded, onFailed, retry } = useNoteImage(source);
  return <><img ref={ref} src={source} alt="附件" onLoad={onLoaded} onError={onFailed} />
    <output>{state}</output><button onClick={retry}>重试</button></>;
}

it('reassigns a failed native/local URL only on explicit retry with the real binder', () => {
  const assign = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
  const view = render(<DirectImage source="/assets/transient.png" />);
  const image = screen.getByRole('img', { name: '附件' });
  assign.mockClear();
  fireEvent.error(image);
  expect(screen.getByRole('status').textContent).toBe('failed');
  expect(assign).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(assign).toHaveBeenCalledExactlyOnceWith('/assets/transient.png');
  expect(image.getAttribute('src')).toBe('/assets/transient.png');
  expect(screen.getByRole('status').textContent).toBe('loading');
  fireEvent.load(image);
  expect(screen.getByRole('status').textContent).toBe('loaded');
  view.rerender(<DirectImage source="/assets/transient.png" />);
  expect(assign).toHaveBeenCalledOnce();
});

it('retains the decoded native/local image fast path without rebinding the same URL', () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(32);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(16);
  const assign = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
  const view = render(<DirectImage source="/assets/cached.png" />);
  expect(screen.getByRole('status').textContent).toBe('loaded');
  assign.mockClear();
  view.rerender(<DirectImage source="/assets/cached.png" />);
  expect(assign).not.toHaveBeenCalled();
});
