// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ImagePropertyEditor from './ImagePropertyEditor';
import { request } from './bridge';
vi.mock('./bridge', () => ({request:vi.fn(),errorMessage:(cause:Error) => cause.message}));
vi.mock('./note-image', () => ({bindNoteImage:(image:HTMLImageElement,source:string) => { image.src = source; return () => {}; }}));
const props = {name:'封面',value:'',noteId:'note-a',notePath:'folder/A.md',vaultBinding:'vault-a',editable:true,busy:false};
beforeEach(() => {
  vi.mocked(request).mockReset();
  vi.stubGlobal('ResizeObserver',class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('imports one image with the current note and vault binding and leaves a cancelled picker unchanged', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined), user = userEvent.setup();
  vi.mocked(request).mockResolvedValueOnce(null).mockResolvedValueOnce({markdownPath:'../assets/cover.png'});
  render(<ImagePropertyEditor {...props} onSave={onSave} />);
  await user.click(screen.getByRole('button',{name:'上传图片 封面'}));
  expect(onSave).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'上传图片 封面'}));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith('../assets/cover.png'));
  expect(request).toHaveBeenCalledWith('pickImage',{noteId:'note-a',notePath:'folder/A.md',vaultBinding:'vault-a'});
});
it('opens the image card, previews fullscreen, replaces the image and clears only its reference', async () => {
  const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
  render(<ImagePropertyEditor {...props} value="../assets/cover.png" onSave={onSave} />);
  await user.click(screen.getByRole('button',{name:'预览图片 封面'}));
  expect(await screen.findByRole('button',{name:'替换图片 封面'})).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'图片菜单 封面'}));
  await user.click(await screen.findByRole('menuitem',{name:'全屏'}));
  expect(await screen.findByRole('dialog',{name:'封面'})).toBeTruthy();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog',{name:'封面'})).toBeNull());
  await user.click(screen.getByRole('button',{name:'预览图片 封面'}));
  vi.mocked(request).mockResolvedValueOnce({markdownPath:'../assets/replaced.jpg'});
  await user.click(screen.getByRole('button',{name:'替换图片 封面'}));
  await waitFor(() => expect(onSave).toHaveBeenLastCalledWith('../assets/replaced.jpg'));
  await waitFor(() => expect(screen.queryByRole('dialog',{name:'图片预览 封面'})).toBeNull());
  await user.click(screen.getByRole('button',{name:'预览图片 封面'}));
  await user.click(screen.getByRole('button',{name:'图片菜单 封面'}));
  await user.click(await screen.findByRole('menuitem',{name:'移除'}));
  await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(''));
  expect(request).toHaveBeenCalledTimes(1);
});
it('shows import failures next to the action and ignores a picker that finishes after unmount', async () => {
  const user = userEvent.setup(), onSave = vi.fn();
  vi.mocked(request).mockRejectedValueOnce(new Error('无法读取图片'));
  const view = render(<ImagePropertyEditor {...props} onSave={onSave} />);
  await user.click(screen.getByRole('button',{name:'上传图片 封面'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','无法读取图片');
  let finish!:(value:unknown)=>void;
  vi.mocked(request).mockReturnValueOnce(new Promise(resolve => {finish=resolve;}));
  await user.click(screen.getByRole('button',{name:'上传图片 封面'}));
  expect((screen.getByRole('button',{name:'上传图片 封面'}) as HTMLButtonElement).disabled).toBe(true);
  view.unmount(); finish({markdownPath:'../assets/late.png'});
  await Promise.resolve(); expect(onSave).not.toHaveBeenCalled();
});
