// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderMermaidSVG } from 'beautiful-mermaid';
import { MermaidContent } from './NoteMarkdown';

vi.mock('beautiful-mermaid', () => ({ renderMermaidSVG: vi.fn((source: string) => `<svg xmlns="http://www.w3.org/2000/svg"><text>${source}</text></svg>`) }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it('debounces source typing and cancels stale or unmounted diagram work', async () => {
  const view = render(<MermaidContent source="A"><pre>A</pre></MermaidContent>);
  await act(() => vi.advanceTimersByTimeAsync(179));
  expect(renderMermaidSVG).not.toHaveBeenCalled();
  view.rerender(<MermaidContent source="B"><pre>B</pre></MermaidContent>);
  await act(() => vi.advanceTimersByTimeAsync(179));
  expect(renderMermaidSVG).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(renderMermaidSVG).toHaveBeenCalledOnce();
  expect(renderMermaidSVG).toHaveBeenCalledWith('B', expect.any(Object));
  view.rerender(<MermaidContent source="C"><pre>C</pre></MermaidContent>);
  view.unmount();
  await act(() => vi.advanceTimersByTimeAsync(180));
  expect(renderMermaidSVG).toHaveBeenCalledOnce();
});

it('keeps source editable, prevents toolbar editing, and closes fullscreen on its blank area', async () => {
  render(<MermaidContent source="A"><pre contentEditable>A</pre></MermaidContent>);
  expect(screen.getByRole('tablist').getAttribute('contenteditable')).toBe('false');
  expect(screen.getByText('A').getAttribute('contenteditable')).toBe('true');
  await act(() => vi.advanceTimersByTimeAsync(180));
  fireEvent.click(screen.getByRole('button', { name: '放大 Mermaid 图表' }));
  const viewer = screen.getByRole('dialog', { name: 'Mermaid 图表' });
  fireEvent.click(screen.getByRole('region', { name: 'Mermaid 大图，可滚动' }));
  expect(screen.getByRole('dialog', { name: 'Mermaid 图表' })).toBe(viewer);
  fireEvent.click(viewer);
  await act(() => vi.runOnlyPendingTimersAsync());
  expect(screen.queryByRole('dialog', { name: 'Mermaid 图表' })).toBeNull();
});
