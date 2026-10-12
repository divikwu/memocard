// @vitest-environment jsdom
import { act, within, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Note } from '@memocard/contracts';
import NoteProperties from './NoteProperties';
import { request } from './bridge';
vi.mock('./bridge', () => ({request:vi.fn(), errorMessage:(error:Error) => error.message}));
const note = {id:'note',contentHash:'hash',updatedAt:'2026-10-10T00:00:00Z'} as Note;
const properties = [
 {name:'摘要',type:'text',value:'原值',editable:true},
 {name:'aliases',type:'list',value:['别名一','别名二'],editable:true},
 {name:'日期',type:'date',value:'2026-10-12',editable:true},
 {name:'已验证',type:'checkbox',value:true,editable:true},
];
beforeEach(() => {
 vi.mocked(request).mockReset();
 vi.stubGlobal('matchMedia', () => ({matches:false,addEventListener() {},removeEventListener() {}}));
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : {properties,writable:true,contentHash:'hash'});
 vi.stubGlobal('ResizeObserver',class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('distinguishes tag sources, selects existing tags, creates tags and removes only property tags',async () => {
 const onApply = vi.fn().mockResolvedValue(undefined), onLocateTag = vi.fn();
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : operation === 'listTags' ? {tags:[{name:'共享'},{name:'属性/分类'}]} : {properties:[],tagProperty:{name:'tags',type:'list',value:['共享'],editable:true},writable:true,contentHash:'hash'});
 const user = userEvent.setup();
 render(<NoteProperties note={note} tags={['共享','正文/分类']} canEdit busy={false} onApply={onApply} onLocateTag={onLocateTag} />);
 const trigger = await screen.findByRole('button',{name:'编辑标签'});
 expect(screen.getByRole('button',{name:/^属性$/}).getAttribute('aria-expanded')).toBe('false');
 expect(screen.queryByText('更新时间')).toBeNull();
 expect(within(trigger).getAllByText('共享')).toHaveLength(1);
 expect(within(trigger).getByText('正文/分类')).toBeTruthy();
 await user.click(screen.getByRole('button',{name:/^属性$/}));
 expect(screen.getAllByText('共享')).toHaveLength(1);
 await user.click(screen.getByRole('button',{name:/^属性$/}));
 expect(screen.getByRole('button',{name:'编辑标签'})).toBe(trigger);
 expect(screen.queryByText('正文标签')).toBeNull();
 const sharedBadge = within(trigger).getByText('共享');
 expect(sharedBadge.hasAttribute('title')).toBe(false);
 await user.hover(sharedBadge);
 expect(await screen.findByRole('tooltip')).toHaveProperty('textContent','属性和正文均有');
 await user.unhover(sharedBadge);
 await user.click(await screen.findByRole('button',{name:'编辑标签'}));
 await user.click(await screen.findByRole('option',{name:'属性标签 属性/分类'}));
 await waitFor(()=>expect(onApply).toHaveBeenLastCalledWith({name:'tags',type:'list',value:['共享','属性/分类']}));
 await user.type(screen.getByRole('combobox',{name:'搜索或新建属性标签'}),'新建{Enter}');
 await waitFor(()=>expect(onApply).toHaveBeenLastCalledWith({name:'tags',type:'list',value:['共享','属性/分类','新建']}));
 await user.click(screen.getByRole('button',{name:'移除属性标签 共享'}));
 await waitFor(()=>expect(onApply).toHaveBeenLastCalledWith({name:'tags',type:'list',value:['属性/分类','新建']}));
 await user.click(await screen.findByRole('button',{name:'定位正文标签 共享'}));
 expect(onLocateTag).toHaveBeenCalledWith('共享');
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑标签'})).toBeNull());
});
it('retains tag input on a conflict and does not write invalid names or on Escape',async () => {
 const onApply = vi.fn().mockRejectedValue(new Error('文件冲突'));
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : operation === 'listTags' ? {tags:[]} : {properties:[],tagProperty:{name:'tags',type:'list',value:[],editable:true},writable:true,contentHash:'hash'});
 const user = userEvent.setup();
 render(<NoteProperties note={note} tags={['正文']} canEdit busy={false} onApply={onApply} />);
 await user.click(screen.getByRole('button',{name:/^属性$/}));
 await user.click(await screen.findByRole('button',{name:'编辑标签'}));
 const input = screen.getByRole('combobox',{name:'搜索或新建属性标签'});
 await user.type(input,'two words{Enter}'); expect(onApply).not.toHaveBeenCalled();
 await user.clear(input); await user.type(input,'组合输入');
 fireEvent.keyDown(input,{key:'Enter',isComposing:true}); expect(onApply).not.toHaveBeenCalled();
 await user.clear(input); await user.type(input,'保留输入{Enter}');
 expect((await screen.findByRole('alert')).textContent).toContain('文件冲突');
 expect(screen.getByRole('button',{name:'移除属性标签 保留输入'})).toBeTruthy();
 await user.keyboard('{Escape}');
 expect(onApply).toHaveBeenCalledTimes(1);
});
async function setup(onApply = vi.fn().mockResolvedValue(undefined)) {
 const user = userEvent.setup();
 render(<NoteProperties note={note} tags={[]} canEdit busy={false} onApply={onApply} />);
 expect(screen.queryByRole('button',{name:'编辑属性 摘要'})).toBeNull();
 await user.click(screen.getByRole('button',{name:/^属性$/}));
 await screen.findByRole('button',{name:'编辑属性 摘要'});
 return {user,onApply};
}
it('uses multi-select editing for legacy lists and removes the separate list type from menus',async () => {
 const {user,onApply} = await setup();
 await user.click(screen.getByRole('button',{name:'编辑属性 aliases'}));
 expect(await screen.findByRole('combobox',{name:'搜索或创建选项'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'移除选项 别名一'})).toBeTruthy();
 expect(onApply).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'移除选项 别名一'}));
 await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.objectContaining({type:'multiSelect',value:['别名二']})));
 await user.keyboard('{Escape}');
 await user.click(screen.getByRole('button',{name:'添加属性'}));
 expect(screen.queryByRole('button',{name:'文本列表'})).toBeNull();
 expect(screen.getByRole('button',{name:/^多选$/})).toBeTruthy();
 await user.keyboard('{Escape}');
 await user.click(screen.getByRole('button',{name:'属性菜单 aliases'}));
 const typeTrigger = await screen.findByRole('menuitem',{name:/^类型/});
 typeTrigger.focus(); await user.keyboard('{ArrowRight}');
 expect(await screen.findByRole('menuitemradio',{name:/^多选$/})).toBeTruthy();
 expect(screen.queryByRole('menuitemradio',{name:'文本列表'})).toBeNull();
});
it.each([
 ['文本','text',''], ['日期','date',''], ['复选框','checkbox',false],
])('creates an empty %s property immediately after choosing its type',async (label,type,value) => {
 const {user,onApply}=await setup();
 await user.click(screen.getByRole('button',{name:'添加属性'}));
 const dialog=await screen.findByRole('dialog',{name:'添加属性'});
 const name=within(dialog).getByRole('textbox',{name:'属性名'});
 await waitFor(()=>expect(document.activeElement).toBe(name));
 expect(within(dialog).queryByRole('textbox',{name:'属性值'})).toBeNull();
 expect((within(dialog).getByRole('button',{name:label as string}) as HTMLButtonElement).disabled).toBe(true);
 await user.type(name,'验收属性');
 await user.click(within(dialog).getByRole('button',{name:label as string}));
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'验收属性',type,value,create:true}));
 expect(onApply).toHaveBeenCalledTimes(1);
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'添加属性'})).toBeNull());
});
it('requires a name and supports creating an empty property with keyboard type selection',async () => {
 const {user,onApply}=await setup();
 await user.click(screen.getByRole('button',{name:'添加属性'}));
 const dialog=await screen.findByRole('dialog',{name:'添加属性'});
 const name=within(dialog).getByRole('textbox',{name:'属性名'});
 await user.type(name,'   {Enter}');
 expect(onApply).not.toHaveBeenCalled();
 await user.clear(name); await user.type(name,'验收属性');
 await user.keyboard('{Tab}{Enter}');
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'验收属性',type:'text',value:'',create:true}));
});
it('retains the name and type choices after a failed creation and allows retry',async () => {
 const onApply=vi.fn().mockRejectedValueOnce(new Error('属性已存在。')).mockResolvedValue(undefined);
 const {user}=await setup(onApply);
 await user.click(screen.getByRole('button',{name:'添加属性'}));
 const dialog=await screen.findByRole('dialog',{name:'添加属性'});
 const name=within(dialog).getByRole('textbox',{name:'属性名'});
 await user.type(name,'摘要');
 await user.click(within(dialog).getByRole('button',{name:'日期'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','属性已存在。');
 expect(name).toHaveProperty('value','摘要');
 await user.clear(name); await user.type(name,'新日期');
 await user.click(within(dialog).getByRole('button',{name:'日期'}));
 await waitFor(()=>expect(onApply).toHaveBeenLastCalledWith({name:'新日期',type:'date',value:'',create:true}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'添加属性'})).toBeNull());
});
it('clears an existing date without deleting the property',async () => {
 const {user,onApply}=await setup();
 await user.click(screen.getByRole('button',{name:'编辑属性 日期'}));
 const input=await screen.findByRole('textbox',{name:'属性值'});
 await user.clear(input); await user.keyboard('{Enter}');
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'日期',type:'date',value:''}));
 expect(screen.queryByRole('alert')).toBeNull();
});
it('places delete in the property-name menu and keeps confirmation cancellable',async () => {
 const {user,onApply} = await setup();
 expect(screen.queryByText('删除')).toBeNull();
 await user.click(screen.getByRole('button',{name:'属性菜单 摘要'}));
 await user.click(await screen.findByRole('menuitem',{name:'删除属性'}));
 expect(await screen.findByRole('alertdialog')).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'取消'}));
 expect(onApply).not.toHaveBeenCalled();
});
it('edits text in its existing value cell, cancels with Escape and saves with Enter',async () => {
 const {user,onApply} = await setup();
 await user.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 const input = await screen.findByRole('textbox',{name:'属性值'});
 await waitFor(() => expect(document.activeElement).toBe(input));
 expect(input.closest('dd')).toBeTruthy();
 expect(screen.queryByRole('dialog')).toBeNull();
 expect(screen.queryByRole('button',{name:'保存属性'})).toBeNull();
 await user.clear(input); await user.type(input,'不保存'); await user.keyboard('{Escape}');
 expect(onApply).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 const next = await screen.findByRole('textbox',{name:'属性值'});
 await user.clear(next); await user.type(next,'新值{Enter}');
 await waitFor(() => expect(onApply).toHaveBeenCalledWith({name:'摘要',type:'text',value:'新值'}));
});
it('saves on outside click, keeps failed input and does not submit during IME composition',async () => {
 const onApply = vi.fn().mockRejectedValue(new Error('文件冲突'));
 const {user} = await setup(onApply);
 await user.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 const input = await screen.findByRole('textbox',{name:'属性值'});
 await user.clear(input); await user.type(input,'保留输入');
 fireEvent.keyDown(input,{key:'Enter',isComposing:true});
 expect(onApply).not.toHaveBeenCalled();
 await user.click(screen.getByText('创建时间'));
 expect((await screen.findByRole('alert')).textContent).toContain('文件冲突');
 expect(screen.getByRole('button',{name:'编辑属性 摘要'}).textContent).toBe('保留输入');
 await user.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 expect((screen.getByRole('textbox',{name:'属性值'}) as HTMLTextAreaElement).value).toBe('保留输入');
 await user.keyboard('{Escape}');
 expect(onApply).toHaveBeenCalledTimes(1);
});
it('toggles checkbox directly and presents a date input and list chips',async () => {
 const {user,onApply} = await setup();
 await user.click(screen.getByRole('checkbox',{name:'切换属性 已验证'}));
 expect(onApply).toHaveBeenCalledWith({name:'已验证',type:'checkbox',value:false});
 onApply.mockClear();
 screen.getByRole('checkbox',{name:'切换属性 已验证'}).focus();
 await user.keyboard('[Space]');
 expect(onApply).toHaveBeenCalledWith({name:'已验证',type:'checkbox',value:true});
 expect(screen.getByText('别名一')).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'编辑属性 日期'}));
 expect(await screen.findByLabelText('属性值')).toHaveProperty('placeholder','YYYY-MM-DD');
 expect(screen.getByRole('grid')).toBeTruthy();
});

it('responds immediately to a checkbox click and retains the value during the save and refresh',async () => {
 let finishSave!: () => void;
 const onApply = vi.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
 const user = userEvent.setup();
 const props = {note,tags:[],canEdit:true,busy:false,onApply};
 const {rerender} = render(<NoteProperties {...props} />);
 await user.click(screen.getByRole('button',{name:/^属性$/}));
 const checkbox = await screen.findByRole('checkbox',{name:'切换属性 已验证'});
 const summary = screen.getByRole('button',{name:'编辑属性 摘要'});
 await user.click(checkbox);
 expect(checkbox.getAttribute('aria-checked')).toBe('false');
 rerender(<NoteProperties {...props} busy />);
 expect(checkbox).toHaveProperty('disabled',true);
 expect(screen.getByLabelText('笔记属性').hasAttribute('data-updating')).toBe(true);
 await user.click(checkbox);
 expect(onApply).toHaveBeenCalledTimes(1);
 await act(async () => { finishSave(); });
 let finishRefresh!: (value:unknown) => void;
 vi.mocked(request).mockImplementation(async () => new Promise(resolve => { finishRefresh = resolve; }));
 rerender(<NoteProperties {...props} note={{...note,contentHash:'new-hash'}} />);
 expect(checkbox.getAttribute('aria-checked')).toBe('false');
 expect(checkbox).toHaveProperty('disabled',false);
 expect(screen.getByRole('button',{name:'编辑属性 摘要'})).toBe(summary);
 await act(async () => { finishRefresh({properties:properties.map(property => property.name === '已验证' ? {...property,value:false} : property),writable:true,contentHash:'new-hash'}); });
 expect(checkbox).toHaveProperty('disabled',false);
 expect(checkbox.getAttribute('aria-checked')).toBe('false');
 expect(screen.getByLabelText('笔记属性').hasAttribute('data-updating')).toBe(false);
});

it('uses the matching save snapshot, ignores an older read and reloads on a later body revision',async () => {
 let complete!: (value:unknown) => void;
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels'} : new Promise(resolve => { complete = resolve; }));
 const props = {note,tags:[],canEdit:true,busy:false,onApply:vi.fn()};
 const view = render(<NoteProperties {...props} />);
 fireEvent.click(screen.getByRole('button',{name:/^属性$/}));
 const savedProperties = {properties:[{name:'摘要',type:'text' as const,value:'已保存',editable:true}],writable:true,contentHash:'saved-property'};
 view.rerender(<NoteProperties {...props} note={{...note,contentHash:savedProperties.contentHash}} savedProperties={savedProperties} />);
 const value = await screen.findByRole('button',{name:'编辑属性 摘要'});
 expect(value.textContent).toBe('已保存');
 expect(value).toHaveProperty('disabled',false);
 await act(async () => { complete({properties,writable:true,contentHash:note.contentHash}); });
 expect(value.textContent).toBe('已保存');
 expect(vi.mocked(request).mock.calls.filter(([op]) => op === 'getNoteProperties')).toHaveLength(1);
 view.rerender(<NoteProperties {...props} note={{...note,contentHash:'later-body'}} savedProperties={savedProperties} />);
 expect(value).toHaveProperty('disabled',false);
 expect(vi.mocked(request).mock.calls.filter(([op]) => op === 'getNoteProperties')).toHaveLength(2);
 await act(async () => { complete({...savedProperties,contentHash:'later-body'}); });
 expect(value).toHaveProperty('disabled',false);
});

it('retains the intended checkbox value and reports a failed save',async () => {
 let failSave!: (reason:Error) => void;
 const onApply = vi.fn(() => new Promise<void>((_,reject) => { failSave = reject; }));
 const {user} = await setup(onApply);
 const checkbox = screen.getByRole('checkbox',{name:'切换属性 已验证'});
 await user.click(checkbox);
 expect(checkbox.getAttribute('aria-checked')).toBe('false');
 await act(async () => { failSave(new Error('文件冲突')); });
 expect(checkbox.getAttribute('aria-checked')).toBe('false');
 expect((await screen.findByRole('alert')).textContent).toContain('文件冲突');
});

it('commits on keyboard focus leaving the value editor',async () => {
 const {user,onApply} = await setup();
 await user.click(screen.getByRole('button',{name:'编辑属性 摘要'}));
 const input = await screen.findByRole('textbox',{name:'属性值'});
 await user.clear(input); await user.type(input,'键盘保存');
 await user.tab(); await user.tab(); await user.tab();
 await waitFor(() => expect(onApply).toHaveBeenCalledWith({name:'摘要',type:'text',value:'键盘保存'}));
});
it('selects a calendar date immediately, without extra save controls, and supports month navigation',async () => {
 const {user,onApply} = await setup();
 await user.click(screen.getByRole('button',{name:'编辑属性 日期'}));
 expect(screen.queryByRole('button',{name:'保存属性'})).toBeNull();
 await user.click(screen.getByRole('button',{name:'下个月'}));
 expect(screen.getByText('2026年11月')).toBeTruthy();
 expect(onApply).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'2026年11月5日'}));
 await waitFor(() => expect(onApply).toHaveBeenCalledWith({name:'日期',type:'date',value:'2026-11-05'}));
});
it('rejects impossible dates, retains input, and cancels without a write',async () => {
 const {user,onApply} = await setup();
 await user.click(screen.getByRole('button',{name:'编辑属性 日期'}));
 const input = await screen.findByRole('textbox',{name:'属性值'});
 await user.clear(input); await user.type(input,'2026-02-30{Enter}');
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','请输入有效日期（YYYY-MM-DD）。');
 expect(onApply).not.toHaveBeenCalled();
 await user.keyboard('{Escape}');
 expect(onApply).not.toHaveBeenCalled();
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('saves a typed leap date and preserves it on a write conflict',async () => {
 const onApply = vi.fn().mockRejectedValue(new Error('文件已被修改'));
 const {user} = await setup(onApply);
 await user.click(screen.getByRole('button',{name:'编辑属性 日期'}));
 const input = await screen.findByRole('textbox',{name:'属性值'});
 await user.clear(input); await user.type(input,'2028-02-29{Enter}');
 await waitFor(() => expect(onApply).toHaveBeenCalledWith({name:'日期',type:'date',value:'2028-02-29'}));
 expect((await screen.findByRole('alert')).textContent).toContain('文件已被修改');
 expect((input as HTMLInputElement).value).toBe('2028-02-29');
});
it('supports calendar arrow keys and Space selection',async () => {
 const {user,onApply} = await setup();
 await user.click(screen.getByRole('button',{name:'编辑属性 日期'}));
 const day = screen.getByRole('button',{name:'2026年10月12日'});
 day.focus();
 await user.keyboard('{ArrowRight}');
 expect(document.activeElement?.getAttribute('aria-label')).toBe('2026年10月13日');
 await user.keyboard(' ');
 await waitFor(() => expect(onApply).toHaveBeenCalledWith({name:'日期',type:'date',value:'2026-10-13'}));
});

it('reads both tag sources without offering edits when the note is read-only',async () => {
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : ({properties:[],tagProperty:{name:'tags',type:'list',value:['只读属性'],editable:true},writable:true,contentHash:'hash'}));
 render(<NoteProperties note={note} tags={['只读正文']} canRead canEdit={false} busy={false} onApply={vi.fn()} />);
 expect(await screen.findByText('只读属性')).toBeTruthy();
 expect(screen.getByText('只读正文')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'编辑标签'})).toBeNull();
});

it('keeps the focus selected by the body locator when the tag popup closes',async () => {
 const target = document.createElement('button');document.body.append(target);
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : operation === 'listTags' ? {tags:[]} : {properties:[],tagProperty:{name:'tags',type:'list',value:[],editable:true},writable:true,contentHash:'hash'});
 const user = userEvent.setup();
 render(<NoteProperties note={note} tags={['正文']} canEdit busy={false} onApply={vi.fn()} onLocateTag={()=>target.focus()} />);
 await user.click(screen.getByRole('button',{name:/^属性$/}));
 await user.click(await screen.findByRole('button',{name:'编辑标签'}));
 await user.click(screen.getByRole('button',{name:'定位正文标签 正文'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑标签'})).toBeNull());
 expect(document.activeElement).toBe(target);
 target.remove();
});

it.each([['选择','select',''],['多选','multiSelect',[]]])('creates empty %s properties with persisted option definitions',async(label,type,value)=>{
 const {user,onApply}=await setup();
 await user.click(screen.getByRole('button',{name:'添加属性'}));
 await user.type(screen.getByRole('textbox',{name:'属性名'}),'选择属性');
 await user.click(screen.getByRole('button',{name:label as string}));
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'选择属性',type,value,options:[],create:true}));
});

it.each([['select',false],['multiSelect',true]] as const)('handles %s selection and closes only single-select',async(type,staysOpen)=>{
 const onApply = vi.fn().mockResolvedValue(undefined), user=userEvent.setup();
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : ({properties:[{name:'领域',type,value:type==='select'?'':[],options:[{name:'设计',color:'blue'}],editable:true}],writable:true,contentHash:'hash'}));
 render(<NoteProperties note={note} tags={[]} canEdit busy={false} onApply={onApply} />);
 await user.click(screen.getByRole('button',{name:'属性'}));
 await user.click(await screen.findByRole('button',{name:'编辑属性 领域'}));
 await user.click(screen.getByRole('option',{name:'选项 设计'}));
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'领域',type,value:type==='select'?'设计':['设计'],options:[{name:'设计',color:'blue'}]}));
 await waitFor(()=>expect(Boolean(screen.queryByRole('dialog',{name:'编辑属性 领域'}))).toBe(staysOpen));
 if (staysOpen) { await user.keyboard('{Escape}'); await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑属性 领域'})).toBeNull()); }
});

it('renames vault-wide labels and retains the input on a failed save',async () => {
 const {user,onApply}=await setup();
 vi.mocked(request).mockRejectedValueOnce(new Error('属性名称已存在。')).mockResolvedValueOnce({labels:{},contentHash:'new-hash'}).mockResolvedValueOnce({labels:{'property:摘要':'新摘要'},contentHash:'saved-hash'});
 await user.click(screen.getByRole('button',{name:'属性菜单 摘要'}));
 await user.click(await screen.findByRole('menuitem',{name:'重命名'}));
 const dialog=await screen.findByRole('dialog',{name:'重命名属性'});
 const input=within(dialog).getByRole('textbox',{name:'新属性名'});
 expect(within(dialog).queryByRole('button',{name:'选择 Emoji'})).toBeNull();
 expect(within(dialog).queryByRole('button',{name:'取消'})).toBeNull();
 await waitFor(()=>expect(document.activeElement).toBe(input));
 await user.clear(input); await user.type(input,'新摘要');
 fireEvent.keyDown(input,{key:'Enter',isComposing:true}); expect(onApply).not.toHaveBeenCalled();
 await user.keyboard('{Enter}');
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','属性名称已存在。');
 expect(input).toHaveProperty('value','新摘要');
 await user.click(within(dialog).getByRole('button',{name:'保存'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'重命名属性'})).toBeNull());
 expect(request).toHaveBeenLastCalledWith('renamePropertyLabel',{key:'property:摘要',label:'新摘要',baseHash:'new-hash'});
 expect(screen.getByRole('button',{name:'属性菜单 新摘要'})).toBeTruthy();
 expect(onApply).not.toHaveBeenCalled();
});
it('cancels rename with Escape and skips saving an unchanged name',async () => {
 const {user,onApply}=await setup();
 await user.click(screen.getByRole('button',{name:'属性菜单 摘要'}));
 await user.click(await screen.findByRole('menuitem',{name:'重命名'}));
 await screen.findByRole('textbox',{name:'新属性名'});
 await user.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'重命名属性'})).toBeNull());
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'属性菜单 摘要'})));
 expect(onApply).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'属性菜单 摘要'}));
 await user.click(await screen.findByRole('menuitem',{name:'重命名'}));
 await user.click(await screen.findByRole('button',{name:'保存'}));
 expect(onApply).not.toHaveBeenCalled();
});
it('duplicates a choice property with a unique name and preserves values and colors',async () => {
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : ({properties:[...properties,
  {name:'阶段',type:'select',value:'进行中',editable:true,options:[{name:'进行中',color:'blue'},{name:'完成',color:'green'}]},
  {name:'阶段 副本',type:'text',value:'existing',editable:true}],writable:true,contentHash:'hash'}));
 const {user,onApply}=await setup();
 await user.click(screen.getByRole('button',{name:'属性菜单 阶段'}));
 const deletion=await screen.findByRole('menuitem',{name:'删除属性'});
 expect(deletion.getAttribute('data-variant')).toBe('default');
 await user.click(screen.getByRole('menuitem',{name:'创建属性副本'}));
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'阶段 副本2',type:'select',value:'进行中',create:true,copyFrom:'阶段',options:[{name:'进行中',color:'blue'},{name:'完成',color:'green'}]}));
 expect(onApply).toHaveBeenCalledTimes(1);
});

async function openTypes(user:ReturnType<typeof userEvent.setup>,name:string) {
 await user.click(screen.getByRole('button',{name:`属性菜单 ${name}`}));
 const trigger=await screen.findByRole('menuitem',{name:/^类型/});
 trigger.focus(); await user.keyboard('{ArrowRight}');
 return await screen.findByRole('menu',{name:`属性类型 ${name}`});
}
it('switches types from the property menu and retains compatible values',async () => {
 const {user,onApply}=await setup();
 const types=await openTypes(user,'摘要');
 expect(within(types).getAllByRole('menuitemradio')).toHaveLength(5);
 expect(within(types).getByRole('menuitemradio',{name:'文本'}).getAttribute('aria-checked')).toBe('true');
 await user.click(within(types).getByRole('menuitemradio',{name:'多选'}));
 const confirmation=await screen.findByRole('alertdialog');
 expect(within(confirmation).getByText(/库内所有同名属性/)).toBeTruthy();
 expect(onApply).not.toHaveBeenCalled();
 await user.click(within(confirmation).getByRole('button',{name:'确认更改'}));
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'摘要',type:'multiSelect',value:['原值'],options:[{name:'原值',color:'default'}],definition:true}));
 await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
});
it('does not write when reselecting the current type or dismissing the type menu',async () => {
 const {user,onApply}=await setup();
 const types=await openTypes(user,'摘要');
 await user.click(within(types).getByRole('menuitemradio',{name:'文本'}));
 expect(onApply).not.toHaveBeenCalled();
 await user.keyboard('{Escape}');
 expect(onApply).not.toHaveBeenCalled();
});
it('does not enqueue a cancelled switch and retains the original property on a save conflict',async () => {
 const onApply=vi.fn().mockRejectedValueOnce(new Error('文件冲突')).mockResolvedValue(undefined);
 const {user}=await setup(onApply);
 let types=await openTypes(user,'摘要');
 await user.click(within(types).getByRole('menuitemradio',{name:'日期'}));
 let confirmation=await screen.findByRole('alertdialog');
 await user.click(within(confirmation).getByRole('button',{name:'取消'}));
 expect(onApply).not.toHaveBeenCalled();
 types=await openTypes(user,'摘要');
 await user.click(within(types).getByRole('menuitemradio',{name:'日期'}));
 confirmation=await screen.findByRole('alertdialog');
 await user.click(within(confirmation).getByRole('button',{name:'确认更改'}));
 expect(await within(confirmation).findByRole('alert')).toHaveProperty('textContent','文件冲突');
 expect(screen.getByRole('button',{name:'编辑属性 摘要',hidden:true}).textContent).toBe('原值');
 await waitFor(()=>expect(screen.queryByRole('menu',{name:'属性类型 摘要'})).toBeNull());
 await user.click(within(confirmation).getByRole('button',{name:'确认更改'}));
 await waitFor(()=>expect(onApply).toHaveBeenCalledTimes(2));
 expect(onApply).toHaveBeenLastCalledWith({name:'摘要',type:'date',value:'',definition:true});
 await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
});
it('keeps all selected values when the backend rejects a lossy single-select conversion',async () => {
 const options=[{name:'设计',color:'purple'},{name:'开发',color:'blue'}];
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{},contentHash:'labels-hash'} : ({properties:[...properties,{name:'领域',type:'multiSelect',value:['设计','开发'],options,editable:true}],writable:true,contentHash:'hash'}));
 const onApply=vi.fn().mockRejectedValue(new Error('无法无损转换。笔记库未修改。'));
 const {user}=await setup(onApply);
 const types=await openTypes(user,'领域');
 await user.click(within(types).getByRole('menuitemradio',{name:'选择'}));
 const confirmation=await screen.findByRole('alertdialog');
 expect(onApply).not.toHaveBeenCalled();
 await user.click(within(confirmation).getByRole('button',{name:'确认更改'}));
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'领域',type:'select',value:'设计',options,definition:true}));
 expect(await within(confirmation).findByRole('alert')).toHaveProperty('textContent','无法无损转换。笔记库未修改。');
 expect(screen.getByRole('button',{name:'编辑属性 领域',hidden:true}).textContent).toBe('设计开发');
});

it.each([['标签','tags'],['更新时间','updatedAt'],['创建时间','createdAt'],['文件名','filename']])('renames the built-in %s display name without changing the note',async (name,key) => {
 const {user,onApply}=await setup();
 await user.click(screen.getByRole('button',{name:`属性菜单 ${name}`}));
 const menu=await screen.findByRole('menu',{name:`管理属性 ${name}`});
 expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
 await user.click(within(menu).getByRole('menuitem',{name:'重命名'}));
 const input=await screen.findByRole('textbox',{name:'新属性名'});
 vi.mocked(request).mockResolvedValueOnce({labels:{[`system:${key}`]:'自定义名称'},contentHash:'saved'});
 await user.clear(input); await user.type(input,'自定义名称{Enter}');
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'重命名属性'})).toBeNull());
 expect(request).toHaveBeenLastCalledWith('renamePropertyLabel',{key:`system:${key}`,label:'自定义名称',baseHash:'labels-hash'});
 expect(screen.getByRole('button',{name:'属性菜单 自定义名称'})).toBeTruthy();
 expect(onApply).not.toHaveBeenCalled();
});
it('reads shared labels on another note and keeps the underlying value key',async () => {
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{'system:tags':'分类','property:摘要':'概述'},contentHash:'labels-hash'} : {properties,writable:true,contentHash:'hash'});
 const user=userEvent.setup(), onApply=vi.fn().mockResolvedValue(undefined);
 const view=render(<NoteProperties note={note} tags={[]} canEdit busy={false} onApply={onApply} />);
 await user.click(screen.getByRole('button',{name:'属性'}));
 expect(await screen.findByRole('button',{name:'属性菜单 分类'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'属性菜单 概述'})).toBeTruthy();
 view.rerender(<NoteProperties note={{...note,id:'other'}} tags={[]} canEdit busy={false} onApply={onApply} />);
 await waitFor(()=>expect(screen.getByRole('button',{name:'属性菜单 概述'}).hasAttribute('disabled')).toBe(false));
 await user.click(screen.getByRole('button',{name:'编辑属性 概述'}));
 await user.clear(screen.getByRole('textbox',{name:'属性值'}));
 await user.type(screen.getByRole('textbox',{name:'属性值'}),'独立值{Enter}');
 await waitFor(()=>expect(onApply).toHaveBeenCalledWith({name:'摘要',type:'text',value:'独立值'}));
});

it('previews inherited library fields on an unsaved page without editing or writing',async () => {
 const onApply = vi.fn(), inherited = properties.map(property => ({...property,value:property.type === 'checkbox' ? false : property.type === 'list' ? [] : ''}));
 vi.mocked(request).mockImplementation(async operation => operation === 'getPropertyLabels' ? {labels:{'property:摘要':'库摘要'},contentHash:'labels-hash'} : {properties:inherited,writable:false,contentHash:''});
 const user = userEvent.setup();
 const view = render(<NoteProperties tags={[]} canEdit busy={false} onApply={onApply} />);
 await user.click(screen.getByRole('button',{name:/^属性$/}));
 expect(await screen.findByText('库摘要')).toBeTruthy();
 expect(request).toHaveBeenCalledWith('getNoteProperties',{deferWhileIndexing:true});
 const checkbox = screen.getByRole('checkbox',{name:'切换属性 已验证'});
 expect(checkbox.getAttribute('aria-checked')).toBe('false');
 expect(checkbox).toHaveProperty('disabled',true);
 await user.click(checkbox);
 expect(screen.queryByText('只读')).toBeNull();
 expect(screen.queryByText('高级 YAML 语法请在源文件中编辑。')).toBeNull();
 expect(screen.queryByRole('button',{name:'编辑属性 库摘要'})).toBeNull();
 expect(onApply).not.toHaveBeenCalled();
 view.rerender(<NoteProperties note={note} tags={[]} canEdit busy={false} onApply={onApply} />);
 await waitFor(()=>expect(request).toHaveBeenCalledWith('getNoteProperties',{id:note.id,deferWhileIndexing:true}));
 expect(await screen.findByRole('button',{name:'编辑属性 库摘要'})).toBeTruthy();
});

it('retries properties during initial indexing without showing a failure or leaving a timer after unmount', async () => {
 vi.useFakeTimers();
 let indexing = true;
 vi.mocked(request).mockImplementation(async operation => {
  if (operation === 'getPropertyLabels') return {labels:{},contentHash:'labels'};
  if (indexing) throw Object.assign(new Error('Initial validation pending'),{code:'INDEXING'});
  return {properties,writable:true,contentHash:'hash'};
 });
 try {
  const view = render(<NoteProperties note={note} tags={[]} canEdit busy={false} onApply={vi.fn()} />);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.queryByRole('alert')).toBeNull();
  indexing = false;
  await act(async()=>{await vi.advanceTimersByTimeAsync(1100);});
  fireEvent.click(screen.getByRole('button',{name:'属性'}));
  expect(screen.getByRole('button',{name:'编辑属性 摘要'}).hasAttribute('disabled')).toBe(false);
  view.unmount();
  const calls = vi.mocked(request).mock.calls.length;
  await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
  expect(vi.mocked(request).mock.calls.length).toBe(calls);
 } finally {vi.useRealTimers();}
});

it.each(['getNoteProperties','getPropertyLabels'])('retries failed %s reads without writing note data',async operation => {
 const implementation=vi.mocked(request).getMockImplementation()!;
 let failed=true;
 vi.mocked(request).mockImplementation(async (op,params) => {
   if (op === operation && failed) throw new Error('配置文件暂时无法读取');
   return implementation(op,params);
 });
 const onApply=vi.fn(), user=userEvent.setup();
 render(<NoteProperties note={note} tags={[]} canRead canEdit={false} busy={false} onApply={onApply} />);
 await user.click(screen.getByRole('button',{name:'属性'}));
 expect((await screen.findByRole('alert')).textContent).toContain('配置文件暂时无法读取');
 failed=false;
 await user.click(screen.getByRole('button',{name:'重试读取'}));
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 expect(screen.getByText('原值')).toBeTruthy();
 expect(vi.mocked(request).mock.calls.filter(([op])=>op === operation)).toHaveLength(2);
 expect(onApply).not.toHaveBeenCalled();
});
