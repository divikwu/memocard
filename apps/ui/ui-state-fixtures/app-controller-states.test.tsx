// @vitest-environment jsdom
import { act,render,screen,cleanup,fireEvent,within,waitFor } from '@testing-library/react';
import { beforeAll,beforeEach,afterEach,it,expect,vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { createPreviewMock, PreviewFailure } from './mock';
import { scenarios,noteId } from './catalog';
import { errorMessage } from '../src/error-messages';
import { App } from '../src/App';

const fixture=vi.hoisted(()=>({request:vi.fn(),browser:false}));
vi.mock('../src/bridge',async()=>({errorMessage:(await import('../src/error-messages')).errorMessage,request:fixture.request,isConnectedClient:true,isNative:false,get isBrowserVault(){return fixture.browser;},get isLocalWeb(){return !fixture.browser;},reconnectVault:vi.fn()}));
vi.mock('../src/client-mode',()=>({get isBrowserVault(){return fixture.browser;},get isLocalWeb(){return !fixture.browser;}}));
vi.mock('../src/browser-runtime',()=>({getBrowserVaultBinding:()=> 'preview',readBrowserAsset:()=>Promise.reject(new Error('模拟附件不可用'))}));
beforeAll(async()=>{await Promise.all([import('../ui/business/Editor'),import('../ui/business/NoteCollection')]);},30000);
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
  await act(async()=>{await vi.dynamicImportSettled();});
  return mock;
}
it.each([
  ['disconnected','需要重新连接本机服务'],['unauthorized','需要重新连接本机服务'],
  ['permission','需要文件夹访问权限'],['unsupported','通过本机服务连接笔记库'],
  ['detail-error','部分文件尚不可读取，暂时无法确认此笔记。'],['detail-missing','找不到此笔记。'],
  ['timeout','暂时无法读取笔记列表，请重试。'],
  ['partial','部分文件暂时无法读取'],['index-reading','正在读取笔记库'],['index-writing','正在建立索引'],
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
  if(['property-read-error','readonly'].includes(id))fireEvent.click(await screen.findByRole('button',{name:'更多属性'}));
  expect((await screen.findAllByText(content=>content.includes(errorMessage(new Error(text))),{}, {timeout:3000})).length).toBeGreaterThan(0);
});
it('shows multiple cards and retains dismissed drafts',async()=>{
  await show('draft-many');fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  expect(await screen.findByRole('dialog',{name:'保留的草稿'})).toBeTruthy();
  expect(screen.getAllByRole('button',{name:/继续编辑：/})).toHaveLength(6);
  fireEvent.click(screen.getAllByRole('button',{name:'不再提醒'})[0]);
  expect(await screen.findByText('已关闭提醒')).toBeTruthy();
  expect(screen.getAllByRole('button',{name:/继续编辑：/})).toHaveLength(6);
});
it('keeps reminder errors inside the draft dialog',async()=>{
  await show('draft-reminder-error');fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  fireEvent.click(await screen.findByRole('button',{name:'不再提醒'}));
  expect(await screen.findByText('草稿已更新，请刷新列表后重试。')).toBeTruthy();
  expect(screen.getByRole('dialog',{name:'保留的草稿'})).toBeTruthy();
});
it('shows recovery commit failures in the editor while preserving content',async()=>{
  await show('draft-restore-error');fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  fireEvent.click(await screen.findByRole('button',{name:'继续编辑：保留草稿 1'}));
  expect(await screen.findByText('文件读写失败，请检查权限和文件状态。',{}, {timeout:3000})).toBeTruthy();
  expect(screen.queryByRole('dialog',{name:'保留的草稿'})).toBeNull();
  expect(screen.getByRole('button',{name:'重试保存'})).toBeTruthy();
});

it('places retry and return together and recovers a failed detail read',async()=>{
  const mock=await show('detail-error');
  const state=await screen.findByRole('alert');
  const back=within(state).getByRole('button',{name:'返回笔记列表'});
  const retry=screen.getByRole('button',{name:'重试'});
  expect(back.parentElement).toBe(retry.parentElement);
  expect(retry.className).toContain('bg-accent-bg');
  expect(back.className).toContain('border-border');
  mock.retry();fireEvent.click(retry);
  expect(await screen.findByRole('textbox',{name:'笔记内容'})).toBeTruthy();
});
it('returns from a missing note without offering an invalid retry',async()=>{
  await show('detail-missing');
  const state=await screen.findByRole('alert');
  const back=within(state).getByRole('button',{name:'返回笔记列表'});
  expect(back.className).toContain('border-border');
  expect(screen.queryByRole('button',{name:'重试'})).toBeNull();
  fireEvent.click(back);
  expect(await screen.findByRole('heading',{name:'所有笔记'})).toBeTruthy();
});
it('shows diagnostic reasons and paths directly',async()=>{
  await show('combined');
  const title=await screen.findByText('部分草稿无法读取');
  const alert=title.closest('[role="status"]')!;
  expect(alert.querySelector('details, summary')).toBeNull();
  expect(within(alert as HTMLElement).queryByText('查看详情')).toBeNull();
  expect(within(alert as HTMLElement).getByText('此草稿无法读取或格式无效，原文件已保留，可从此路径检查或备份。')).toBeTruthy();
  expect(within(alert as HTMLElement).getByText(/模拟目录/)).toBeTruthy();
});
it('refreshes a changed draft in the dialog and retains it if refreshing fails',async()=>{
  const mock=await show('draft-reminder-error');
  fireEvent.click(await screen.findByRole('button',{name:'查看草稿'}));
  fireEvent.click(await screen.findByRole('button',{name:'不再提醒'}));
  const dialog=screen.getByRole('dialog',{name:'保留的草稿'});
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
  expect((await within(dialog).findByRole('alert')).textContent).toContain('恢复目录暂时不可读');
  expect(within(dialog).getByRole('button',{name:'继续编辑：保留草稿 1'})).toBeTruthy();
  failed=false;fireEvent.click(within(dialog).getByRole('button',{name:'刷新草稿'}));
  expect(await within(dialog).findByRole('button',{name:'继续编辑：外部更新后的草稿'})).toBeTruthy();
  await waitFor(()=>expect(within(dialog).queryByRole('alert')).toBeNull());
  expect(mock.calls.filter(op=>!['getStatus','getEnvironment','getDrafts','listTags','listFolders','queryNotes','dismissDraftReminder'].includes(op))).toEqual([]);
});

it('shows a property save failure once with its shared retry action',async()=>{
  await show('property-save-error');
  fireEvent.click(await screen.findByRole('button',{name:'更多属性'}));
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
  expect(notice.closest('[role="alert"], [role="status"]')).toBeTruthy();
  if(id === 'property-read-error')expect(screen.getByRole('button',{name:'重试读取'})).toBeTruthy();
  if(id === 'readonly'){
    expect(screen.getAllByText('高级 YAML 语法请在源文件中编辑。')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'更多属性'}));
    expect(await screen.findByText('只读')).toBeTruthy();
  }
});

it('shows an initial timeout below the heading and retries through a loading state',async()=>{
  const mock=await show('timeout');
  const original=mock.snapshot();
  const alert=await screen.findByRole('alert');
  const heading=screen.getByRole('heading',{name:'所有笔记'});
  expect(heading.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(alert).getByRole('heading',{name:'笔记加载超时'})).toBeTruthy();
  expect(within(alert).getAllByRole('button')).toHaveLength(1);
  expect(within(alert).getByRole('button',{name:'重试'}).className).toContain('bg-accent-bg');
  expect(screen.queryByRole('textbox',{name:'搜索当前视图笔记'})).toBeNull();
  expect(screen.queryByText('记下第一条笔记')).toBeNull();
  expect(screen.queryByText('等待连接本机服务')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'页面操作'}));
  expect((await screen.findByRole('menuitem',{name:'新建笔记'})).getAttribute('aria-disabled')).not.toBe('true');
  await userEvent.keyboard('{Escape}');
  let finish!:()=>void;
  fixture.request.mockImplementation(async(op,params)=>{
    if(op === 'queryNotes')await new Promise<void>(resolve=>{finish=resolve;});
    return mock.request(op,params);
  });
  mock.retry();fireEvent.click(within(alert).getByRole('button',{name:'重试'}));
  expect(await screen.findByRole('status',{name:'正在读取笔记库'})).toBeTruthy();
  expect(screen.getByRole('textbox',{name:'搜索当前视图笔记'})).toBeTruthy();
  await waitFor(()=>expect(finish).toBeTypeOf('function'));
  finish();
  expect(await screen.findByRole('list',{name:'笔记列表'})).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mock.snapshot()).toEqual(original);
  expect(mock.calls.some(op=>['saveNote','saveDraft','dismissDraftReminder'].includes(op))).toBe(false);
});

it('keeps a loaded list mounted during refresh timeout and retry, then shows the latest snapshot',async()=>{
  const mock=await show('refresh-timeout');
  const list=await screen.findByRole('list',{name:'笔记列表'});
  const original=mock.snapshot();
  fireEvent(window,new CustomEvent('memocard:event',{detail:{type:'notesChanged'}}));
  const alert=await screen.findByRole('alert');
  expect(within(alert).getByText('刷新超时')).toBeTruthy();
  expect(within(alert).getByText('继续显示上次读取的内容。')).toBeTruthy();
  expect(alert.compareDocumentPosition(screen.getByRole('heading',{name:'所有笔记'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
  expect(screen.getByRole('textbox',{name:'搜索当前视图笔记'}).hasAttribute('disabled')).toBe(false);
  expect(window.location.hash).toBe('#/notes');
  let finish!:()=>void;
  fixture.request.mockImplementation(async(op,params)=>{
    if(op === 'queryNotes'){
      await new Promise<void>(resolve=>{finish=resolve;});
      return {notes:[{...original.notes[0],title:'刷新后的模拟笔记'}],nextCursor:null};
    }
    return mock.request(op,params);
  });
  const retry=within(alert).getByRole('button',{name:'重试'});
  expect(retry.className).toContain('border-border');
  fireEvent.click(retry);
  await waitFor(()=>expect(finish).toBeTypeOf('function'));
  expect(retry.hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
  finish();
  expect(await screen.findByText('刷新后的模拟笔记')).toBeTruthy();
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(mock.snapshot()).toEqual(original);
});

it('recovers a refresh timeout through a later background refresh',async()=>{
  const mock=await show('refresh-timeout');
  await screen.findByRole('list',{name:'笔记列表'});
  fireEvent(window,new CustomEvent('memocard:event',{detail:{type:'notesChanged'}}));
  await screen.findByText('刷新超时');
  fireEvent(window,new CustomEvent('memocard:event',{detail:{type:'notesChanged'}}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'重试'}).hasAttribute('disabled')).toBe(false));
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  mock.retry();
  fireEvent(window,new CustomEvent('memocard:event',{detail:{type:'notesChanged'}}));
  await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
  expect(screen.getByRole('list',{name:'笔记列表'})).toBeTruthy();
});

it('treats a successfully loaded empty vault as a refresh snapshot',async()=>{
  const mock=await show('empty');
  await screen.findByText('记下第一条笔记');
  fixture.request.mockImplementation((op,params)=>op === 'queryNotes'
    ? Promise.reject(new PreviewFailure('TIMEOUT','模拟超时',true)) : mock.request(op,params));
  fireEvent(window,new CustomEvent('memocard:event',{detail:{type:'notesChanged'}}));
  await screen.findByText('刷新超时');
  expect(screen.getByText('记下第一条笔记')).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'笔记加载超时'})).toBeNull();
  expect(screen.getByRole('textbox',{name:'搜索当前视图笔记'})).toBeTruthy();
});

it('does not reuse the previous filter snapshot after a search times out',async()=>{
  const mock=await show('refresh-timeout');
  await screen.findByRole('list',{name:'笔记列表'});
  fireEvent.change(screen.getByRole('textbox',{name:'搜索当前视图笔记'}),{target:{value:'另一条笔记'}});
  expect(await screen.findByRole('heading',{name:'笔记加载超时'})).toBeTruthy();
  expect(screen.queryByRole('list',{name:'笔记列表'})).toBeNull();
  expect(mock.snapshot().notes).toHaveLength(1);
});

it('shows a rejected conversion only in its confirmation and keeps its original value',async()=>{
  const mock=await show('lossy-conversion');
  const original=mock.snapshot();
  const user=userEvent.setup();
  await user.click(await screen.findByRole('button',{name:'更多属性'}));
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


it.each([
  ['disconnected','需要重新连接本机服务','重新打开'],
  ['unauthorized','需要重新连接本机服务','重新打开'],
  ['permission','需要文件夹访问权限','重新授权'],
])('%s uses a centered state below the page title without duplicate notices',async(id,title,action)=>{
  const mock=await show(id);
  const heading=await screen.findByRole('heading',{name:title});
  const state=heading.closest('[data-slot="empty"]')!;
  const page=screen.getByRole('heading',{name:'所有笔记'});
  expect(page.compareDocumentPosition(state) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('记下第一条笔记')).toBeNull();
  const button=within(state as HTMLElement).getByRole(id === 'permission'?'button':'link',{name:action});
  expect(button.className).toContain('bg-accent-bg');
  if(id === 'permission'){
    fireEvent.click(button);
    expect(await screen.findByText('模拟笔记 · 产品验收')).toBeTruthy();
    expect(screen.queryByRole('heading',{name:title})).toBeNull();
  } else expect(button.getAttribute('href')).toBe('memocard-service://open-web');
  expect(mock.calls.some(op=>['saveNote','saveDraft','dismissDraftReminder'].includes(op))).toBe(false);
});

it('shows an incomplete first authorization with diagnostics and can select again',async()=>{
  const mock=await show('folder-cancel');
  const original=mock.snapshot();
  fireEvent.click(await screen.findByRole('button',{name:'打开已有笔记库'}));
  const heading=await screen.findByRole('heading',{name:'文件夹授权未完成'});
  const card=heading.closest('[data-slot="empty"]')!;
  expect(screen.queryByText('打开你的笔记文件夹')).toBeNull();
  expect(within(card as HTMLElement).getByText(/模拟：未授予文件夹访问权限/).closest('[data-slot="empty-description"]')).not.toBeNull();
  expect(card.querySelector('details, summary')).toBeNull();
  expect(within(card as HTMLElement).getByRole('button',{name:'重新选择文件夹'}).className).toContain('bg-accent-bg');
  mock.retry();fireEvent.click(within(card as HTMLElement).getByRole('button',{name:'重新选择文件夹'}));
  expect(await screen.findByText('模拟笔记 · 产品验收')).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'文件夹授权未完成'})).toBeNull();
  expect(mock.snapshot()).toEqual(original);
});

it.each(['disconnected','unauthorized','permission'])('%s keeps the already loaded list and a local notice',async id=>{
  const mock=createPreviewMock('permission');
  fixture.browser=id === 'permission';
  let failed=false;
  fixture.request.mockImplementation(async(op,params)=>{
    if(op === 'getEnvironment'){
      const environment=await mock.request<Record<string,unknown>>(op,params);
      return {...environment,capabilities:failed && id === 'permission'?environment.capabilities:(environment.capabilities as string[]).filter(item=>item !== 'reauthorizeVault')};
    }
    if(op === 'getStatus'){
      if(failed && id !== 'permission')throw Object.assign(new Error('连接暂时不可用'),{code:id === 'disconnected'?'BRIDGE_UNAVAILABLE':'WEB_UNAUTHORIZED'});
      const status=await mock.request<Record<string,unknown>>(op,params);
      return {...status,connected:!failed,capabilities:failed && id === 'permission'?status.capabilities:(status.capabilities as string[]).filter(item=>item !== 'reauthorizeVault')};
    }
    return mock.request(op,params);
  });
  window.history.replaceState(null,'','#/notes');render(<App />);
  const note=await screen.findByText('模拟笔记 · 产品验收');
  failed=true;fireEvent(window,new CustomEvent('memocard:event',{detail:{type:'statusChanged'}}));
  await screen.findByText(id === 'permission'?'重新授权笔记文件夹':'连接已断开');
  expect(screen.getByRole(id === 'permission'?'button':'link',{name:id === 'permission'?'重新授权':'重新打开'}).className).toContain('border-border');
  expect(screen.getByText('模拟笔记 · 产品验收')).toBe(note);
  expect(screen.queryByRole('heading',{name:/本机服务未连接|访问授权已失效|需要文件夹访问权限/})).toBeNull();
  expect((screen.getByRole('textbox',{name:'搜索当前视图笔记'}) as HTMLInputElement).disabled).toBe(true);
  expect(mock.calls.some(op=>['saveNote','saveDraft'].includes(op))).toBe(false);
});

it('keeps the original list when selecting another folder is not authorized',async()=>{
  const mock=createPreviewMock('partial');fixture.browser=true;fixture.request.mockImplementation(mock.request);
  window.history.replaceState(null,'','#/notes');render(<App />);
  expect(await screen.findByText('模拟笔记 · 产品验收')).toBeTruthy();
  const original=mock.snapshot();
  window.history.replaceState(null,'','#/settings');fireEvent(window,new HashChangeEvent('hashchange'));
  fireEvent.click(await screen.findByRole('button',{name:'切换笔记库'}));
  expect(await screen.findByText('模拟：未授予文件夹访问权限')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'所有笔记'}));
  expect(await screen.findByText('模拟笔记 · 产品验收')).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'文件夹授权未完成'})).toBeNull();
  expect(mock.calls.filter(op=>op === 'selectVault')).toHaveLength(1);
  expect(mock.snapshot()).toEqual(original);
});


it('does not retain the previous vault list when another vault requires authorization',async()=>{
  const mock=createPreviewMock('partial');fixture.browser=true;
  let changed=false;
  fixture.request.mockImplementation(async(op,params)=>{
    const value=await mock.request<Record<string,unknown>>(op,params);
    if(changed && ['getStatus','getEnvironment'].includes(op))return {...value,vaultId:'another-vault',connected:false,capabilities:[...(value.capabilities as string[]),'reauthorizeVault']};
    return value;
  });
  window.history.replaceState(null,'','#/notes');render(<App />);
  await screen.findByText('模拟笔记 · 产品验收');
  changed=true;fireEvent(window,new CustomEvent('memocard:event',{detail:{type:'statusChanged'}}));
  await screen.findByRole('heading',{name:'需要文件夹访问权限'});
  expect(screen.queryByText('模拟笔记 · 产品验收')).toBeNull();
  expect(mock.calls.some(op=>['saveNote','saveDraft'].includes(op))).toBe(false);
});


it.each([['detail-error','无法打开笔记'],['detail-missing','笔记不存在']])('%s reuses the compact centered card and keeps its reason',async(id,title)=>{
  const mock=await show(id);
  const heading=await screen.findByRole('heading',{name:title});
  const card=heading.closest('[data-slot="empty"]')!;
  expect(card.getAttribute('role')).toBe('alert');
  expect(card.className).toContain('web-workspace-empty');
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(within(card as HTMLElement).getByText(id === 'detail-missing'?'找不到此笔记。':'笔记文件暂时无法读取，请稍后重试。')).toBeTruthy();
  const breadcrumb=screen.getByRole('navigation',{name:'当前位置'});
  expect(within(breadcrumb).getAllByRole('button').map(button=>button.textContent)).toEqual(['所有笔记']);
  expect(within(breadcrumb).getByRole('link',{current:'page'}).textContent).toBe(mock.snapshot().notes[0].title);
  expect(within(card as HTMLElement).getByRole('button',{name:'返回笔记列表'})).toBeTruthy();
  expect(screen.queryByRole('textbox',{name:'笔记内容'})).toBeNull();
});

it('uses a new file request after a failed deep-link prefetch and displays loading during retry',async()=>{
  const mock=await show('detail-error');
  const retry=await screen.findByRole('button',{name:'重试'});
  const before=fixture.request.mock.calls.filter(([op])=>op === 'getNote').length;
  let resolveRead!: (note:unknown)=>void;
  fixture.request.mockImplementation((op,params)=>op === 'getNote'?new Promise(resolve=>{resolveRead=resolve;}):mock.request(op,params));
  fireEvent.click(retry);
  expect(screen.getByRole('status',{name:'正在读取内容'})).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  await waitFor(()=>expect(resolveRead).toBeTypeOf('function'));
  resolveRead({...mock.snapshot().notes[0],body:'重新读取的最新正文'});
  expect(await screen.findByRole('textbox',{name:'笔记内容'})).toBeTruthy();
  expect(screen.getByText('重新读取的最新正文')).toBeTruthy();
  expect(fixture.request.mock.calls.filter(([op])=>op === 'getNote')).toHaveLength(before+1);
  expect(mock.calls.some(op=>['saveNote','saveDraft'].includes(op))).toBe(false);
});


it('guides partial reads with visible statistics and honest recovery instructions',async()=>{
  const mock=await show('partial');
  const list=await screen.findByRole('list',{name:'笔记列表'});
  const before=mock.snapshot();
  const retry=screen.getByRole('button',{name:'重新读取'});
  expect(retry.className).toContain('border-border');
  expect(screen.queryByRole('button',{name:'查看详情'})).toBeNull();
  expect(screen.getByText(/已加载的笔记仍可使用/)).toBeTruthy();
  expect(screen.getByText(/当前未提供具体文件和失败原因/)).toBeTruthy();
  expect(screen.getByText(/确认笔记文件夹可访问/)).toBeTruthy();
  expect(screen.getByText(/已读入\s*2\s*篇笔记，待读取\s*3\s*项，需要处理\s*0\s*项/)).toBeTruthy();
  expect(screen.queryByText(/iCloud/)).toBeNull();
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
  expect(mock.snapshot()).toEqual(before);
  expect(mock.calls.some(op=>op.startsWith('save'))).toBe(false);
});
it('keeps the loaded list while retrying partial reads and clears the notice on success',async()=>{
  const mock=await show('partial');
  const list=await screen.findByRole('list',{name:'笔记列表'});
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  fixture.request.mockImplementation(async(op,params)=>{
    if(op === 'getStatus')await gate;
    return mock.request(op,params);
  });
  mock.retry();fireEvent.click(screen.getByRole('button',{name:'重新读取'}));
  expect(screen.getByRole('button',{name:'重新读取'})).toHaveProperty('disabled',true);
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
  expect(within(list).getByRole('button',{name:/^打开 /})).toHaveProperty('disabled',false);
  release();
  await waitFor(()=>expect(screen.queryByText('部分文件暂时无法读取')).toBeNull());
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
  expect(mock.calls.some(op=>op.startsWith('save'))).toBe(false);
});
it('retains partial reads after a failed retry and allows another attempt',async()=>{
  const mock=await show('partial');
  const list=await screen.findByRole('list',{name:'笔记列表'});
  let fail=true;
  fixture.request.mockImplementation(async(op,params)=>{
    if(op === 'queryNotes' && fail)throw new PreviewFailure('IO_ERROR','模拟读取失败',true);
    return mock.request(op,params);
  });
  fireEvent.click(screen.getByRole('button',{name:'重新读取'}));
  await screen.findByText('模拟读取失败');
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
  await waitFor(()=>expect(screen.getByRole('button',{name:'重新读取'})).toHaveProperty('disabled',false));
  fail=false;mock.retry();fireEvent.click(screen.getByRole('button',{name:'重新读取'}));
  await waitFor(()=>expect(screen.queryByText('部分文件暂时无法读取')).toBeNull());
  expect(screen.getByRole('list',{name:'笔记列表'})).toBe(list);
});
it('shows background reading guidance without asking the user to retry',async()=>{
  await show('partial-reading');
  const list=await screen.findByRole('list',{name:'笔记列表'});
  expect(screen.getByText(/可继续使用已加载的笔记/)).toBeTruthy();
  expect(screen.queryByText('部分文件暂时无法读取')).toBeNull();
  expect(screen.queryByRole('button',{name:'重新读取'})).toBeNull();
  fireEvent.click(within(list).getByRole('button',{name:/^打开 /}));
  expect(await screen.findByRole('textbox',{name:'笔记内容'})).toBeTruthy();
});
