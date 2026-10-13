// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { observeTableOverflow } from './table-overflow';

afterEach(() => vi.unstubAllGlobals());

it('updates the scroll hint as the table fits or overflows and disconnects on removal', () => {
  let resize = () => {};
  const disconnect = vi.fn(), observe = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe = observe;
    disconnect = disconnect;
  });
  const container = document.createElement('div'), table = document.createElement('table');
  let width = 300;
  Object.defineProperty(container, 'clientWidth', { get: () => width });
  Object.defineProperty(table, 'scrollWidth', { value: 500 });
  const dispose = observeTableOverflow(container, table);
  expect(container.dataset.overflow).toBe('true');
  expect(observe.mock.calls).toEqual([[container], [table]]);
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(container.scrollLeft).toBe(80);
  table.append(document.createElement('td')); container.append(table);
  table.firstChild!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(container.scrollLeft).toBe(80);
  width = 600; resize();
  expect(container.dataset.overflow).toBe('false');
  dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  expect(container.scrollLeft).toBe(80);
});
