import TagColorStyles from '@ui-next/business/TagColorStyles';
// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TagColorProvider } from './TagColorProvider';
import { TagPropertyEditor } from "@ui-next/business/property-editors";
import { parseTagColors, readTagColors, renameTagColors, setTagColor, tagColorKey } from './tag-colors';
import { request } from './bridge';

vi.mock('./bridge', () => ({ request: vi.fn(), errorMessage: (error: Error) => error.message }));
beforeEach(() => {
  localStorage.clear();
  vi.mocked(request).mockResolvedValue({ tags: [{ name: '工作' }, { name: '工作/设计' }] });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('persists colors per vault and resets only the chosen tag', () => {
  setTagColor('a', '工作', 'green');
  setTagColor('a', '生活', 'red');
  setTagColor('b', '工作', 'yellow');
  expect(parseTagColors(readTagColors('a'))).toEqual({ 工作: 'green', 生活: 'red' });
  expect(parseTagColors(readTagColors('b'))).toEqual({ 工作: 'yellow' });
  setTagColor('a', '工作', 'default');
  expect(parseTagColors(readTagColors('a'))).toEqual({ 生活: 'red' });
  expect(parseTagColors(readTagColors('b'))).toEqual({ 工作: 'yellow' });
  setTagColor('a', '__proto__', 'blue');
  expect(parseTagColors(readTagColors('a'))['__proto__']).toBe('blue');
});
it('rejects invalid stored colors without losing valid preferences', () => {
  expect(parseTagColors('broken')).toEqual({});
  expect(parseTagColors('["green"]')).toEqual({});
  expect(parseTagColors('{"工作":"green","生活":"red;}body{color:red}","其他":null}')).toEqual({ 工作: 'green' });
});
it('merges legacy case variants and prefers an existing lowercase color', () => {
  expect(parseTagColors('{"Work":"green","work":"blue","AI":"purple"}')).toEqual({work:'blue',ai:'purple'});
  setTagColor('a','WORK','green');
  expect(parseTagColors(readTagColors('a'))).toEqual({work:'green'});
});
it('treats legacy gray as default and preserves other colors and vaults', async () => {
  const user = userEvent.setup(), onSave = vi.fn();
  const legacy = JSON.stringify({ 工作: 'gray', 生活: 'green' });
  localStorage.setItem(tagColorKey('a'), legacy);
  localStorage.setItem(tagColorKey('b'), legacy);
  expect(parseTagColors(readTagColors('a'))).toEqual({ 生活: 'green' });
  render(<TagColorProvider vaultId="a"><TagColorStyles /><TagPropertyEditor tags={[]} busy={false} error="" onSave={onSave} /></TagColorProvider>);
  await user.click(await screen.findByRole('button', { name: '设置标签颜色 工作' }));
  expect((await screen.findByRole('menuitemradio', { name: '默认' })).getAttribute('aria-checked')).toBe('true');
  expect(screen.queryByRole('menuitemradio', { name: '灰色' })).toBeNull();
  expect(document.querySelector('style[data-tag-colors]')?.textContent).toContain('--tag-green-bg');
  expect(readTagColors('a')).toBe(legacy);
  await user.click(screen.getByRole('menuitemradio', { name: '蓝色' }));
  expect(parseTagColors(readTagColors('a'))).toEqual({ 工作: 'blue', 生活: 'green' });
  expect(readTagColors('b')).toBe(legacy);
  expect(onSave).not.toHaveBeenCalled();
});
it('moves a renamed tag and its children without affecting other vaults or prefixes', () => {
  setTagColor('a', '工作', 'green');
  setTagColor('a', '工作/设计', 'purple');
  setTagColor('a', '工作室', 'red');
  setTagColor('b', '工作', 'blue');
  renameTagColors('a', '工作', '职业');
  expect(parseTagColors(readTagColors('a'))).toEqual({ 职业: 'green', '职业/设计': 'purple', 工作室: 'red' });
  expect(parseTagColors(readTagColors('b'))).toEqual({ 工作: 'blue' });
});
it('changes appearance without choosing a tag or exposing a delete action, and survives reopening', async () => {
  const user = userEvent.setup(), onSave = vi.fn();
  const ui = (bodyTags:string[] = []) => <TagColorProvider vaultId="a"><TagColorStyles /><TagPropertyEditor tags={[]} bodyTags={bodyTags} busy={false} error="" onSave={onSave} onLocateTag={vi.fn()} /></TagColorProvider>;
  const view = render(ui());
  await user.click(await screen.findByRole('button', { name: '设置标签颜色 工作' }));
  expect(screen.queryByRole('menuitem', { name: /删除/ })).toBeNull();
  await user.click(await screen.findByRole('menuitemradio', { name: '绿色' }));
  await waitFor(() => expect(parseTagColors(readTagColors('a'))).toEqual({ 工作: 'green' }));
  expect(document.querySelector('style[data-tag-colors]')?.textContent).toContain('--tag-bg:var(--tag-green-bg)');
  view.rerender(ui(['工作']));
  expect(screen.getByRole('button', { name: '定位正文标签 工作' }).getAttribute('data-tag')).toBe(encodeURIComponent('工作'));
  expect(onSave).not.toHaveBeenCalled();
  view.unmount();
  render(ui());
  await user.click(await screen.findByRole('button', { name: '设置标签颜色 工作' }));
  expect((await screen.findByRole('menuitemradio', { name: '绿色' })).getAttribute('aria-checked')).toBe('true');
  await user.click(screen.getByRole('menuitemradio', { name: '默认' }));
  expect(parseTagColors(readTagColors('a'))).toEqual({});
  expect(onSave).not.toHaveBeenCalled();
});
it('keeps the color menu available after a storage failure without pretending to save', async () => {
  const user = userEvent.setup();
  render(<TagColorProvider vaultId="a"><TagColorStyles /><TagPropertyEditor tags={[]} busy={false} error="" onSave={vi.fn()} /></TagColorProvider>);
  await user.click(await screen.findByRole('button', { name: '设置标签颜色 工作' }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  await user.click(await screen.findByRole('menuitemradio', { name: '红色' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', '无法保存标签颜色，请检查浏览器存储权限。');
  expect(screen.getByRole('menuitemradio', { name: '默认' }).getAttribute('aria-checked')).toBe('true');
});
it('allows keyboard color selection without creating a property association', async () => {
  const user = userEvent.setup(), onSave = vi.fn();
  render(<TagColorProvider vaultId="a"><TagColorStyles /><TagPropertyEditor tags={[]} busy={false} error="" onSave={onSave} /></TagColorProvider>);
  const trigger = await screen.findByRole('button', { name: '设置标签颜色 工作' });
  trigger.focus();
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('menuitemradio', { name: '棕色' })).toBeTruthy();
  await user.keyboard('{ArrowDown}{Enter}');
  await waitFor(() => expect(parseTagColors(readTagColors('a'))).toEqual({ 工作: 'brown' }));
  expect(onSave).not.toHaveBeenCalled();
});
it('switches the generated styles with the active vault', () => {
  setTagColor('a', '工作', 'green');
  setTagColor('b', '工作', 'red');
  const view = render(<TagColorProvider vaultId="a"><TagColorStyles /><span /></TagColorProvider>);
  expect(document.querySelector('style[data-tag-colors]')?.textContent).toContain('--tag-green-bg');
  view.rerender(<TagColorProvider vaultId="b"><TagColorStyles /><span /></TagColorProvider>);
  expect(document.querySelector('style[data-tag-colors]')?.textContent).toContain('--tag-red-bg');
  expect(localStorage.getItem(tagColorKey('a'))).toBe('{"工作":"green"}');
});
