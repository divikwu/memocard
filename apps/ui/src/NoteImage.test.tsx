// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NoteImage } from './NoteImage';
import { bindNoteImage } from './note-image';

vi.mock('./note-image', () => ({bindNoteImage:vi.fn(() => vi.fn())}));
vi.mock('./client-mode', () => ({isBrowserVault:false}));
vi.mock('./browser-runtime', () => ({getBrowserVaultBinding:() => null}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
