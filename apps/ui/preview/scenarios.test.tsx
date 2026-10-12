// @vitest-environment jsdom
import { render,screen,cleanup,fireEvent,within,waitFor } from '@testing-library/react';
import { beforeAll,beforeEach,afterEach,it,expect,vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { createPreviewMock } from './mock';
import { scenarios,noteId } from './catalog';
import { errorMessage } from '../src/error-messages';
import { App } from '../src/App';

const fixture=vi.hoisted(()=>({request:vi.fn(),browser:false}));
vi.mock('../src/bridge',async()=>({errorMessage:(await import('../src/error-messages')).errorMessage,request:fixture.request,isConnectedClient:true,isNative:false,get isBrowserVault(){return fixture.browser;},get isLocalWeb(){return !fixture.browser;},reconnectVault:vi.fn()}));
vi.mock('../src/client-mode',()=>({get isBrowserVault(){return fixture.browser;},get isLocalWeb(){return !fixture.browser;}}));
vi.mock('../src/browser-runtime',()=>({getBrowserVaultBinding:()=> 'preview',readBrowserAsset:()=>Promise.reject(new Error('模拟附件不可用'))}));
beforeAll(async()=>{await Promise.all([import('../src/Editor'),import('../src/components/note-collection')]);},30000);
beforeEach(()=>{
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  vi.stubGlobal('matchMedia',()=>({matches:false,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  Range.prototype.getClientRects=()=>[] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect=()=>new DOMRect();
  localStorage.clear();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function show(id:string){
  const scenario=scenarios.find(item=>item.id === id)!;
  const mock=createPreviewMock(id);fixture.browser=mock.browser;fixture.request.mockImplementation(mock.request);
  window.history.replaceState(null,'',scenario.detail?`#/notes/${noteId}`:'#/notes');
  render(<App />);
  return mock;
}
it.each([
  ['disconnected','连接已断开'],['unauthorized','访问授权已失效'],
  ['permission','重新授权笔记文件夹'],['unsupported','需要启动 MemoCard 本机服务'],
  ['detail-error','部分文件尚不可读取，暂时无法确认此笔记。'],['detail-missing','找不到此笔记。'],
  ['timeout','操作暂未完成。内容仍保留在编辑器中，请稍后重试。'],
  ['partial','部分文件待读取'],['index-reading','正在读取笔记库'],['index-writing','正在建立索引'],
  ['draft-corrupt','部分草稿无法读取'],['draft-directory','此恢复目录暂时无法读取，原记录已保留。'],
  ['save-error','文件操作未完成，请检查目录权限和文件可用性。'],
  ['draft-save-error','本机草稿暂时无法保存，请检查本机目录权限和可用空间。'],
  ['conflict','文件已在其他位置修改，原文未被覆盖。请保留草稿并重新读取。'],
  ['source-deleted','原文件已移除，不能从旧缓存恢复。'],
  ['source-conflict','文件存在未解决的 iCloud 版本冲突，原版本均已保留。'],
  ['transaction-error','保存事务期间文件被外部修改，事务记录和草稿已保留，请先处理恢复记录。'],
  ['property-read-error','属性定义配置无法读取，请检查 .memocard/property-definitions.json。'],
  ['readonly','只读'],['empty','记下第一条笔记'],
])('%s renders the actual App state',async(id,text)=>{
  await show(id);
  if(['property-read-error','readonly'].includes(id))fireEvent.click(await screen.findByRole('button',{name:'属性'}));
  expect((await screen.findAllByText(content=>content.includes(errorMessage(new Error(text))),{}, {timeout:3000})).length).toBeGreaterThan(0);
});
it('shows multiple cards and retains dismissed drafts',async()=>{
  await show('draft-many');fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  expect(await screen.findByRole('dialog',{name:'草稿'})).toBeTruthy();
  expect(screen.getAllByRole('button',{name:/继续编辑：/})).toHaveLength(6);
  fireEvent.click(screen.getAllByRole('button',{name:'不再提醒'})[0]);
  expect(await screen.findByText('已关闭提醒')).toBeTruthy();
  expect(screen.getAllByRole('button',{name:/继续编辑：/})).toHaveLength(6);
});
it('keeps reminder errors inside the draft dialog',async()=>{
  await show('draft-reminder-error');fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  fireEvent.click(await screen.findByRole('button',{name:'不再提醒'}));
  expect(await screen.findByText('草稿已更新，请刷新列表后重试。')).toBeTruthy();
  expect(screen.getByRole('dialog',{name:'草稿'})).toBeTruthy();
});
it('shows recovery commit failures in the editor while preserving content',async()=>{
  await show('draft-restore-error');fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  fireEvent.click(await screen.findByRole('button',{name:'继续编辑：保留草稿 1'}));
  expect(await screen.findByText('文件读写失败，请检查权限和文件状态。',{}, {timeout:3000})).toBeTruthy();
  expect(screen.queryByRole('dialog',{name:'草稿'})).toBeNull();
  expect(screen.getByRole('button',{name:'重试保存'})).toBeTruthy();
});

it('places retry and return together and recovers a failed detail read',async()=>{
  const mock=await show('detail-error');
  const back=await screen.findByRole('button',{name:'返回列表'});
  const retry=screen.getByRole('button',{name:'重试'});
  expect(back.parentElement).toBe(retry.parentElement);
  mock.retry();fireEvent.click(retry);
  expect(await screen.findByRole('textbox',{name:'笔记内容'})).toBeTruthy();
});
it('returns from a missing note without offering an invalid retry',async()=>{
  await show('detail-missing');
  const back=await screen.findByRole('button',{name:'返回列表'});
  expect(back.getAttribute('data-variant')).toBe('outline');
  expect(screen.queryByRole('button',{name:'重试'})).toBeNull();
  fireEvent.click(back);
  expect(await screen.findByRole('heading',{name:'所有笔记'})).toBeTruthy();
});
it('keeps diagnostic reasons and paths in an expandable section',async()=>{
  await show('combined');
  const title=await screen.findByText('部分草稿无法读取');
  const alert=title.closest('[role="status"]')!;
  const details=alert.querySelector('details')!;
  expect(details.open).toBe(false);
  expect(within(alert as HTMLElement).getByText('原记录已保留，其他草稿仍可恢复。')).toBeTruthy();
  fireEvent.click(within(alert as HTMLElement).getByText('查看详情'));
  expect(details.open).toBe(true);
  expect(within(alert as HTMLElement).getByText(/模拟目录/)).toBeTruthy();
});
it('refreshes a changed draft in the dialog and retains it if refreshing fails',async()=>{
  const mock=await show('draft-reminder-error');
  fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  fireEvent.click(await screen.findByRole('button',{name:'不再提醒'}));
  const dialog=screen.getByRole('dialog',{name:'草稿'});
  const original=mock.snapshot().drafts[0];
  let failed=true;
  fixture.request.mockImplementation(async(op,params)=>{
    if(op === 'getDrafts'){
      if(failed)throw new Error('恢复目录暂时不可读');
      return {drafts:[],unscopedDrafts:[{...original,title:'外部更新后的草稿',revision:'latest'}]};
    }
    return mock.request(op,params);
  });
  fireEvent.click(await within(dialog).findByRole('button',{name:'刷新草稿'}));
  expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent','恢复目录暂时不可读');
  expect(within(dialog).getByRole('button',{name:'继续编辑：保留草稿 1'})).toBeTruthy();
  failed=false;fireEvent.click(within(dialog).getByRole('button',{name:'刷新草稿'}));
  expect(await within(dialog).findByRole('button',{name:'继续编辑：外部更新后的草稿'})).toBeTruthy();
  await waitFor(()=>expect(within(dialog).queryByRole('alert')).toBeNull());
  expect(mock.calls.filter(op=>!['getStatus','getEnvironment','getDrafts','listTags','listFolders','queryNotes','dismissDraftReminder'].includes(op))).toEqual([]);
});

it('shows a property save failure once with its shared retry action',async()=>{
  await show('property-save-error');
  fireEvent.click(await screen.findByRole('button',{name:'属性'}));
  fireEvent.click(await screen.findByRole('button',{name:'编辑属性 阶段'}));
  fireEvent.click(await screen.findByRole('option',{name:'选项 完成'}));
  await screen.findByRole('button',{name:'重试保存'});
  await waitFor(()=>expect(screen.getAllByText('文件读写失败，请检查权限和文件状态。')).toHaveLength(1));
});

it.each(['save-error','property-read-error','readonly'])('%s places its notice before the title, even with properties collapsed',async id=>{
  await show(id);
  const notice=id === 'readonly' ? await screen.findByText('部分属性只读') : await screen.findByRole('alert',{}, {timeout:3000});
  const title=await screen.findByRole('textbox',{name:'页面标题'});
  expect(notice.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(notice.closest('[data-slot="alert"]')).toBeTruthy();
  if(id === 'property-read-error')expect(screen.getByRole('button',{name:'重试读取'})).toBeTruthy();
  if(id === 'readonly'){
    expect(screen.getAllByText('高级 YAML 语法请在源文件中编辑。')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'属性'}));
    expect(await screen.findByText('只读')).toBeTruthy();
  }
});

it('keeps list notices above the heading and does not describe a failed read as an empty vault',async()=>{
  await show('timeout');
  const alert=await screen.findByRole('alert');
  const heading=screen.getByRole('heading',{name:'所有笔记'});
  expect(alert.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByText('记下第一条笔记')).toBeNull();
  expect(screen.queryByRole('heading',{name:'记下第一条笔记'})).toBeNull();
  expect(screen.queryByText('等待连接本机服务')).toBeNull();
  expect(screen.getByRole('button',{name:'新建笔记'}).hasAttribute('disabled')).toBe(false);
});

it('shows a rejected conversion only in its confirmation and keeps its original value',async()=>{
  const mock=await show('lossy-conversion');
  const original=mock.snapshot();
  const user=userEvent.setup();
  await user.click(await screen.findByRole('button',{name:'属性'}));
  await user.click(await screen.findByRole('button',{name:'属性菜单 摘要'}));
  const types=await screen.findByRole('menuitem',{name:/^类型/});
  types.focus(); await user.keyboard('{ArrowRight}');
  await user.click(await screen.findByRole('menuitemradio',{name:'复选框'}));
  const dialog=await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button',{name:'确认更改'}));
  await within(dialog).findByRole('alert');
  expect(screen.getAllByRole('alert',{hidden:true})).toHaveLength(1);
  expect(screen.queryByRole('button',{name:'重试保存'})).toBeNull();
  expect(mock.snapshot().notes).toEqual(original.notes);
  expect(mock.snapshot().properties).toEqual(original.properties);
  await user.click(within(dialog).getByRole('button',{name:'取消'}));
  await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByRole('button',{name:'重试保存'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'编辑属性 阶段'}));
  await user.click(await screen.findByRole('option',{name:'选项 完成'}));
  await waitFor(()=>expect(mock.snapshot().properties.properties.find(property=>property.name==='阶段')?.value).toBe('完成'));
  expect(mock.snapshot().notes[0].body).toBe(original.notes[0].body);
  expect(mock.snapshot().properties.properties.find(property=>property.name==='摘要')).toEqual(original.properties.properties.find(property=>property.name==='摘要'));
  await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
});
