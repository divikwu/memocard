// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TagColorMenu } from './property-editors';
import { changeTagSettings } from '../../src/tag-settings';
import { parseTagColors, readTagColors, setTagColor } from '../../src/tag-colors';

beforeEach(() => { localStorage.clear(); vi.stubGlobal('ResizeObserver',class {observe() {} unobserve() {} disconnect() {}}); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('saves a normalized name using Enter and does not choose a color', async () => {
  const user = userEvent.setup(), onChangeTag = vi.fn().mockResolvedValue(undefined);
  render(<TagColorMenu tag="work" disabled={false} onChangeTag={onChangeTag} />);
  await user.click(screen.getByRole('button',{name:'管理标签 work'}));
  const input = await screen.findByRole('textbox',{name:'标签名称'});
  await user.clear(input); await user.type(input,'Project/Design{Enter}');
  await waitFor(() => expect(onChangeTag).toHaveBeenCalledWith('work','project/design'));
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
});
it('requires deletion confirmation and reports a failed operation without dismissing it', async () => {
  const user = userEvent.setup(), onChangeTag = vi.fn().mockRejectedValue(new Error('文件冲突'));
  render(<TagColorMenu tag="work" disabled={false} onChangeTag={onChangeTag} />);
  await user.click(screen.getByRole('button',{name:'管理标签 work'}));
  await user.click(await screen.findByRole('menuitem',{name:'删除标签'}));
  expect(await screen.findByRole('alertdialog')).toBeTruthy();
  expect(onChangeTag).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'取消'}));
  expect(onChangeTag).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'管理标签 work'}));
  await user.click(await screen.findByRole('menuitem',{name:'删除标签'}));
  await user.click(await screen.findByRole('button',{name:'确认删除'}));
  expect(onChangeTag).toHaveBeenCalledWith('work',null);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','文件冲突');
});
it('does not save invalid names and leaves failed renames editable', async () => {
  const user = userEvent.setup(), onChangeTag = vi.fn().mockRejectedValue(new Error('目标标签已存在'));
  render(<TagColorMenu tag="work" disabled={false} onChangeTag={onChangeTag} />);
  await user.click(screen.getByRole('button',{name:'管理标签 work'}));
  const input = await screen.findByRole('textbox',{name:'标签名称'});
  await user.clear(input); await user.type(input,'bad//name{Enter}');
  expect(onChangeTag).not.toHaveBeenCalled();
  await user.clear(input); await user.type(input,'existing{Enter}');
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','目标标签已存在');
  expect(screen.getByRole('textbox',{name:'标签名称'})).toHaveProperty('value','existing');
});
it('migrates colors, pins and icons while deleting only the exact identity', () => {
  setTagColor('v','work','green'); setTagColor('v','work/child','purple'); setTagColor('other','work','red');
  localStorage.setItem('memocard:tags:v',JSON.stringify({pinned:['work','work/child','other'],icons:{work:'💼','work/child':'✏️'}}));
  changeTagSettings('v','work','project');
  expect(parseTagColors(readTagColors('v'))).toEqual({project:'green','project/child':'purple'});
  expect(JSON.parse(localStorage.getItem('memocard:tags:v')!)).toEqual({pinned:['project','project/child','other'],icons:{project:'💼','project/child':'✏️'}});
  changeTagSettings('v','project',null);
  expect(parseTagColors(readTagColors('v'))).toEqual({'project/child':'purple'});
  expect(JSON.parse(localStorage.getItem('memocard:tags:v')!)).toEqual({pinned:['project/child','other'],icons:{'project/child':'✏️'}});
  expect(parseTagColors(readTagColors('other'))).toEqual({work:'red'});
});
