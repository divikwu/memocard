// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { SidebarProvider } from './ui/sidebar';
import { TagNavigation } from './tag-navigation';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

let sheet: HTMLStyleElement;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  sheet = document.createElement('style');
  // JSDOM does not resolve inherited custom properties in background shorthands.
  sheet.textContent = (styles.match(/\.sidebar-tag-[^{}]+\{[^{}]*\}/g) ?? []).join('\n')
    .replaceAll('var(--hover-bg)', 'rgba(0, 0, 0, 0.06)')
    .replaceAll('var(--hover-row-radius)', '8px')
    .replaceAll('var(--hover-action-radius)', '4px');
  document.head.append(sheet);
});
afterEach(() => { cleanup(); sheet.remove(); vi.unstubAllGlobals(); });

it.each(['parent', 'parent/child'])('keeps the whole %s row highlighted while focus is in its menu', async path => {
  const user = userEvent.setup();
  render(<SidebarProvider><TagNavigation vaultId="hover-test" tags={[{ name: 'parent', count: 1 }, { name: 'parent/child', count: 1 }]} selected={null} onSelect={() => {}} /><button>移出焦点</button></SidebarProvider>);
  const action = screen.getByRole('button', { name: `标签操作 ${path}` });
  const row = action.closest('.sidebar-tag-row')!;
  await user.click(action);
  await user.unhover(action);
  const menuItem = await screen.findByRole('menuitem', { name: '置顶标签' });
  menuItem.focus();
  expect(row.contains(document.activeElement)).toBe(false);
  expect(getComputedStyle(row).backgroundColor).toBe('rgba(0, 0, 0, 0.06)');
  expect(getComputedStyle(screen.getByRole('button', { name: path })).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(getComputedStyle(action).backgroundColor).toBe('rgba(0, 0, 0, 0.06)');
  expect(getComputedStyle(row).borderRadius).toBe('8px');
  expect(getComputedStyle(action).borderRadius).toBe('4px');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
  screen.getByRole('button', { name: '移出焦点' }).focus();
  expect(row.classList.contains('sidebar-tag-row-open')).toBe(false);
  expect(action.getAttribute('aria-expanded')).toBe('false');
});
