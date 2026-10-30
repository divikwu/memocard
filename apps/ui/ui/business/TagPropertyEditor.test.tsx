// @vitest-environment jsdom
import { within, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TagPropertyEditor } from './property-editors';
import { request } from '../../src/bridge';
vi.mock('../../src/bridge', () => ({request:vi.fn(), errorMessage:(error:Error) => error.message}));
beforeEach(() => {
  vi.mocked(request).mockResolvedValue({tags:[{name:'项目/设计'},{name:'项目/开发'},{name:'work'}]});
  vi.stubGlobal('ResizeObserver',class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function setup(tags:string[] = [], onSave = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup();
  render(<TagPropertyEditor tags={tags} busy={false} error="" onSave={onSave} />);
  await screen.findByRole('option',{name:'属性标签 项目/开发'});
  return {user,onSave,input:screen.getByRole('combobox',{name:'搜索或新建属性标签'})};
}
it('merges mixed-case sources and keeps color settings in candidate rows only',async () => {
  const user = userEvent.setup(), onSave = vi.fn(), onLocateTag = vi.fn();
  vi.mocked(request).mockResolvedValue({tags:[{name:'Work'},{name:'WORK'},{name:'AI'},{name:'ai'}]});
  render(<TagPropertyEditor tags={['Work','work']} bodyTags={['WORK','Body']} busy={false} error="" onSave={onSave} onLocateTag={onLocateTag} />);
  await screen.findByRole('option',{name:'属性标签 ai'});
  expect(screen.getAllByRole('option')).toHaveLength(1);
  const selected = within(screen.getByRole('toolbar',{name:'已选标签'}));
  expect(selected.getAllByText('work')).toHaveLength(1);
  expect(selected.queryByRole('button',{name:/设置标签颜色/})).toBeNull();
  await user.click(screen.getByRole('button',{name:'设置标签颜色 ai'}));
  await user.click(await screen.findByRole('menuitemradio',{name:'绿色'}));
  expect(onLocateTag).not.toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
  await user.click(selected.getByRole('button',{name:'定位正文标签 body'}));
  expect(onLocateTag).toHaveBeenCalledWith('body');
});
it('filters existing tags with an optional hash and ignores case for duplicate creation',async () => {
  const {user,input,onSave} = await setup();
  await user.type(input,'#work');
  expect(screen.getByRole('option',{name:'属性标签 work'})).toBeTruthy();
  expect(screen.queryByRole('option',{name:/新建标签/})).toBeNull();
  await user.keyboard('{Enter}');
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith(['work']));
  expect(input).toHaveProperty('value','');
  expect(document.activeElement).toBe(input);
});
it('uses arrow keys and Enter to choose a matching option instead of creating the search term',async () => {
  const {user,input,onSave} = await setup();
  await user.type(input,'项目');
  await user.keyboard('{ArrowDown}{Enter}');
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith(['项目/设计']));
  expect(onSave).toHaveBeenCalledTimes(1);
});
it('creates a new tag with Enter and keeps it available after removal without clearing the search',async () => {
  const {user,input,onSave} = await setup();
  await user.type(input,'新标签');
  expect(screen.getByRole('option',{name:'新建标签 新标签'})).toBeTruthy();
  await user.keyboard('{Enter}');
  await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith(['新标签']));
  await user.type(input,'新');
  await user.click(screen.getByRole('button',{name:'移除属性标签 新标签'}));
  await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith([]));
  expect(input).toHaveProperty('value','新');
  expect(screen.getByRole('option',{name:'属性标签 新标签'})).toBeTruthy();
  expect(document.activeElement).toBe(input);
});
it('removes the last chip with Backspace only when the search input is empty',async () => {
  const {user,input,onSave} = await setup(['work','项目/设计']);
  await user.type(input,'x{Backspace}');
  expect(onSave).not.toHaveBeenCalled();
  await user.keyboard('{Backspace}');
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith(['work']));
  expect(document.activeElement).toBe(input);
});
it('keeps focus while saving and prevents overlapping selections',async () => {
  let finish!:()=>void;
  const onSave = vi.fn().mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const {user,input} = await setup([],onSave);
  await user.type(input,'新标签{Enter}');
  expect(screen.getByRole('status').textContent).toBe('正在保存标签…');
  expect(document.activeElement).toBe(input);
  await user.keyboard('{Enter}{Backspace}');
  expect(onSave).toHaveBeenCalledTimes(1);
  finish();
  await screen.findByRole('button',{name:'移除属性标签 新标签'});
  expect(input).toHaveProperty('value','');
});
it('waits for suggestions before offering creation and keeps existing tags removable if loading fails',async () => {
  let fail!:(error:Error)=>void;
  vi.mocked(request).mockImplementation(()=>new Promise((_resolve,reject)=>{fail=reject;}));
  const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
  render(<TagPropertyEditor tags={['现有']} busy={false} error="" onSave={onSave} />);
  const input = screen.getByRole('combobox',{name:'搜索或新建属性标签'});
  await user.type(input,'未知{Enter}');
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText('正在加载标签…')).toBeTruthy();
  fail(new Error('标签读取失败'));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','标签读取失败');
  expect(screen.queryByRole('option',{name:/新建标签/})).toBeNull();
  await user.click(screen.getByRole('button',{name:'移除属性标签 现有'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith([]));
});
it('does not truncate the available tags to the first twelve',async () => {
  vi.mocked(request).mockResolvedValue({tags:Array.from({length:20},(_,i)=>({name:`标签${i}`}))});
  render(<TagPropertyEditor tags={[]} busy={false} error="" onSave={vi.fn()} />);
  await screen.findByRole('option',{name:'属性标签 标签19'});
  expect(screen.getAllByRole('option')).toHaveLength(20);
});

it('returns to the search after deleting a focused chip from the keyboard',async () => {
  const {user,input,onSave} = await setup(['work','项目/设计']);
  await user.click(input);
  await user.keyboard('{ArrowLeft}{ArrowLeft}{Delete}');
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith(['项目/设计']));
  expect(document.activeElement).toBe(input);
});

it('keeps body-only tags read-only and restores their source after removing a shared property tag',async () => {
  const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined), onLocateTag = vi.fn();
  render(<TagPropertyEditor tags={['共享']} bodyTags={['共享','正文/分类']} busy={false} error="" onSave={onSave} onLocateTag={onLocateTag} />);
  expect(within(screen.getByRole('toolbar',{name:'已选标签'})).getByRole('button',{name:'定位正文标签 正文/分类'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'移除属性标签 正文/分类'})).toBeNull();
  expect(within(screen.getByRole('toolbar',{name:'已选标签'})).getAllByText('共享')).toHaveLength(1);
  await user.click(screen.getByRole('button',{name:'移除属性标签 共享'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith([]));
  await user.click(within(screen.getByRole('toolbar',{name:'已选标签'})).getByRole('button',{name:'定位正文标签 共享'}));
  expect(onLocateTag).toHaveBeenCalledWith('共享');
  await user.click(screen.getByRole('combobox',{name:'搜索或新建属性标签'}));
  await user.keyboard('{Backspace}');
  expect(onSave).toHaveBeenCalledTimes(1);
});
it('locates a shared tag from its chip using the keyboard without removing its property source',async () => {
  const user = userEvent.setup(), onSave = vi.fn(), onLocateTag = vi.fn();
  render(<TagPropertyEditor tags={['共享']} bodyTags={['共享']} busy={false} error="" onSave={onSave} onLocateTag={onLocateTag} />);
  screen.getByRole('button',{name:'定位正文标签 共享'}).focus();
  expect(await screen.findByRole('tooltip')).toHaveProperty('textContent','属性和正文均有，点击定位');
  await user.keyboard('{Enter}');
  expect(onLocateTag).toHaveBeenCalledWith('共享');
  expect(onSave).not.toHaveBeenCalled();
});

it('keeps all selected sources visible during search and excludes body chips from property keyboard removal',async () => {
  const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined), onLocateTag = vi.fn();
  render(<TagPropertyEditor tags={['work','共享']} bodyTags={['共享','正文/分类','正文/分类']} busy={false} error="" onSave={onSave} onLocateTag={onLocateTag} />);
  const selected = within(screen.getByRole('toolbar',{name:'已选标签'}));
  expect(selected.getAllByRole('button',{name:'定位正文标签 正文/分类'})).toHaveLength(1);
  expect(selected.getAllByText('共享')).toHaveLength(1);
  const input = screen.getByRole('combobox',{name:'搜索或新建属性标签'});
  await user.type(input,'不匹配');
  expect(selected.getByRole('button',{name:'定位正文标签 正文/分类'})).toBeTruthy();
  expect(selected.getByRole('button',{name:'移除属性标签 work'})).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
  await user.clear(input);
  await user.keyboard('{Backspace}');
  await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith(['work']));
  expect(selected.getByRole('button',{name:'定位正文标签 共享'})).toBeTruthy();
  await user.keyboard('{ArrowLeft}{Delete}');
  await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith([]));
  expect(selected.getAllByRole('button',{name:/定位正文标签/})).toHaveLength(2);
  await user.keyboard('{Backspace}');
  expect(onSave).toHaveBeenCalledTimes(2);
  selected.getByRole('button',{name:'定位正文标签 正文/分类'}).focus();
  await user.keyboard('{Enter}');
  expect(onLocateTag).toHaveBeenCalledWith('正文/分类');
  expect(onSave).toHaveBeenCalledTimes(2);
});
it('keeps shared tags only in the selected area after removing their property association',async () => {
  const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
  render(<TagPropertyEditor tags={['正文']} bodyTags={['正文']} busy={false} error="" onSave={onSave} onLocateTag={vi.fn()} />);
  const selected = within(screen.getByRole('toolbar',{name:'已选标签'}));
  expect(selected.getAllByRole('button',{name:'定位正文标签 正文'})).toHaveLength(1);
  await screen.findByRole('option',{name:'属性标签 work'});
  expect(screen.queryByRole('option',{name:'属性标签 正文'})).toBeNull();
  await user.click(selected.getByRole('button',{name:'移除属性标签 正文'}));
  await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith([]));
  expect(selected.getAllByRole('button',{name:'定位正文标签 正文'})).toHaveLength(1);
  expect(selected.queryByRole('button',{name:'移除属性标签 正文'})).toBeNull();
  expect(screen.queryByRole('option',{name:'属性标签 正文'})).toBeNull();
});
it('shows a body tag as its name only, explains its source on hover, and locates it without saving',async () => {
  const user = userEvent.setup(), onSave = vi.fn(), onLocateTag = vi.fn();
  render(<TagPropertyEditor tags={[]} bodyTags={['正文/分类']} busy={false} error="" onSave={onSave} onLocateTag={onLocateTag} />);
  const tag = within(screen.getByRole('toolbar',{name:'已选标签'})).getByRole('button',{name:'定位正文标签 正文/分类'});
  expect(tag.textContent).toBe('正文/分类');
  expect(screen.queryByRole('button',{name:'移除属性标签 正文/分类'})).toBeNull();
  await user.hover(tag);
  expect(await screen.findByRole('tooltip')).toHaveProperty('textContent','正文标签，点击定位');
  await user.click(tag);
  expect(onLocateTag).toHaveBeenCalledWith('正文/分类');
  expect(onSave).not.toHaveBeenCalled();
});

it('keeps selected tags out of search results and removes associations only through the chip',async () => {
  const {user,input,onSave} = await setup(['work']);
  expect(screen.queryByRole('option',{name:'属性标签 work'})).toBeNull();
  expect(screen.getByRole('button',{name:'移除属性标签 work'}).title).toBe('');
  expect(screen.queryByText('已选标签')).toBeNull();
  expect(screen.getByText('选择或创建').tagName).toBe('P');
  expect(screen.queryByRole('status')).toBeNull();
  await user.type(input,'work');
  expect(screen.queryByRole('option',{name:'属性标签 work'})).toBeNull();
  await user.keyboard('{Enter}');
  expect(onSave).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'移除属性标签 work'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith([]));
  await user.clear(input);
  expect(screen.getByRole('option',{name:'属性标签 work'})).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
it('excludes current body tags from suggestions and duplicate creation while allowing other library tags',async () => {
  const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
  render(<TagPropertyEditor tags={[]} bodyTags={['正文','work']} busy={false} error="" onSave={onSave} />);
  await screen.findByRole('option',{name:'属性标签 项目/开发'});
  expect(screen.queryByRole('option',{name:'属性标签 正文'})).toBeNull();
  expect(screen.queryByRole('option',{name:'属性标签 work'})).toBeNull();
  const input = screen.getByRole('combobox',{name:'搜索或新建属性标签'});
  for (const query of ['#正文','#WORK']) {
    await user.clear(input);
    await user.type(input,query);
    expect(screen.queryByRole('option')).toBeNull();
    await user.keyboard('{Enter}');
    expect(onSave).not.toHaveBeenCalled();
  }
  await user.clear(input);
  await user.click(screen.getByRole('option',{name:'属性标签 项目/开发'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith(['项目/开发']));
  expect(within(screen.getByRole('toolbar',{name:'已选标签'})).getByText('正文')).toBeTruthy();
});

it('uses the shared tooltip for property sources and removal without native title hints',async () => {
  const {user,input,onSave} = await setup(['work']);
  const selected = within(screen.getByRole('toolbar',{name:'已选标签'}));
  const chip = selected.getByText('work');
  expect(chip.closest('[title]')).toBeNull();
  await user.hover(chip);
  expect(await screen.findByRole('tooltip')).toHaveProperty('textContent','属性标签，可移除');
  await user.unhover(chip);
  await user.click(input);
  const remove = selected.getByRole('button',{name:'移除属性标签 work'});
  await user.hover(remove);
  expect(await screen.findByRole('tooltip')).toHaveProperty('textContent','移除属性标签，保留正文标签');
  expect(remove.hasAttribute('title')).toBe(false);
  await user.unhover(remove);
  remove.focus();
  expect(await screen.findByRole('tooltip')).toHaveProperty('textContent','移除属性标签，保留正文标签');
  await user.keyboard('{Enter}');
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith([]));
  expect(document.activeElement).toBe(input);
});

it('searches beside selected tags and keeps the candidate heading as static guidance',async () => {
  const {user,input,onSave} = await setup(['work']);
  const selected = input.closest('.note-tag-selected') as HTMLElement;
  expect(selected).not.toBeNull();
  expect(within(selected).getByRole('button',{name:'移除属性标签 work'})).toBeTruthy();
  expect(screen.getByText('选择或创建').id).toBe(input.getAttribute('aria-describedby'));
  await user.click(screen.getByRole('option',{name:'属性标签 项目/设计'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledWith(['work','项目/设计']));
  input.blur();
  await user.click(selected);
  expect(document.activeElement).toBe(input);
  await user.type(input,'新分类');
  expect(screen.getByRole('option',{name:'新建标签 新分类'})).toBeTruthy();
  expect(screen.getByText('选择或创建').textContent).toBe('选择或创建');
});
