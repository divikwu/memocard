// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Markdown } from './markdown';
import { bindNoteImage } from './note-image';

vi.mock('./note-image', () => ({ bindNoteImage: vi.fn(() => vi.fn()) }));
vi.mock('./bridge', () => ({ request: vi.fn() }));
vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
vi.mock('./browser-runtime', () => ({ getBrowserVaultBinding: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it.each([
  '<figure data-image-columns="1,1"><img src="../assets/a.png" alt="照片"></figure>',
  '<aside data-callout="gray"><p><img src="../assets/a.png" alt="照片"></p></aside>',
])('keeps a loaded image mounted when surrounding content rerenders: %s', body => {
  const view = render(<Markdown body={body} />);
  const image = screen.getByRole('img', { name: '照片' });
  fireEvent.load(image);
  view.rerender(<Markdown body={`${body}\n\n更新后的说明`} />);
  expect(screen.getByRole('img', { name: '照片' })).toBe(image);
  expect(screen.getByRole('button', { name: '查看大图 照片' }).getAttribute('data-image-state')).toBe('loaded');
  expect(bindNoteImage).toHaveBeenCalledTimes(1);
});
