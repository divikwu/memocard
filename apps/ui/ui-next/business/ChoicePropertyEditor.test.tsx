// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteProperty } from '@memocard/contracts';
import { ChoicePropertyEditor } from './property-editors';
const options = [{name:'设计',color:'blue' as const},{name:'开发',color:'green' as const}];
const property:NoteProperty = {name:'领域',type:'multiSelect',value:['设计'],options,editable:true};
beforeEach(()=>{
 vi.stubGlobal('ResizeObserver',class { observe() {} unobserve() {} disconnect() {} });
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('replaces the selected value in single-select with keyboard and clears via chip removal',async()=>{
 const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
 render(<ChoicePropertyEditor property={{...property,type:'select',value:'设计'}} busy={false} error="" onSave={onSave} />);
 await user.type(screen.getByRole('combobox'),'开发{Enter}');
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type:'select',value:'开发',options},false));
 await user.click(screen.getByRole('button',{name:'移除选项 开发'}));
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type:'select',value:'',options},false));
});
it('adds and removes multiple values while retaining reusable options',async()=>{
 const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
 render(<ChoicePropertyEditor property={property} busy={false} error="" onSave={onSave} />);
 await user.click(screen.getByRole('option',{name:'选项 开发'}));
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type:'multiSelect',value:['设计','开发'],options},true));
 await user.click(screen.getByRole('button',{name:'移除选项 设计'}));
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type:'multiSelect',value:['开发'],options},true));
 expect(screen.getByRole('option',{name:'选项 设计'})).toBeTruthy();
});
it('creates options, keeps case and spaces, and saves option colors separately from tags',async()=>{
 const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
 render(<ChoicePropertyEditor property={property} busy={false} error="" onSave={onSave} />);
 await user.type(screen.getByRole('combobox'),'AI Design{Enter}');
 const nextOptions = [...options,{name:'AI Design',color:'default'}];
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type:'multiSelect',value:['设计','AI Design'],options:nextOptions,definition:true},true));
 await user.click(screen.getByRole('button',{name:'管理选项 AI Design'}));
 await user.click(await screen.findByRole('menuitemradio',{name:'紫色'}));
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type:'multiSelect',value:['设计','AI Design'],options:[...options,{name:'AI Design',color:'purple'}],definition:true},true));
});
it('retains input after failed writes and ignores composition Enter',async()=>{
 const user = userEvent.setup(), onSave = vi.fn().mockRejectedValue(new Error('conflict'));
 render(<ChoicePropertyEditor property={property} busy={false} error="文件冲突" onSave={onSave} />);
 const input = screen.getByRole('combobox');
 await user.type(input,'保留输入');
 fireEvent.keyDown(input,{key:'Enter',isComposing:true}); expect(onSave).not.toHaveBeenCalled();
 await user.keyboard('{Enter}'); await waitFor(()=>expect(onSave).toHaveBeenCalledTimes(1));
 expect(input).toHaveProperty('value','保留输入');
 expect(screen.queryByRole('button',{name:'移除选项 保留输入'})).toBeNull();
 expect(screen.getByRole('alert').textContent).toBe('文件冲突');
});

it.each(['select','multiSelect'] as const)('renames and deletes a selected %s option while preserving unrelated options',async type=>{
 const user = userEvent.setup(), onSave = vi.fn().mockResolvedValue(undefined);
 const value = type === 'select' ? '设计' : ['设计','开发'];
 render(<ChoicePropertyEditor property={{...property,type,value}} busy={false} error="" onSave={onSave} />);
 await user.click(screen.getByRole('button',{name:'管理选项 设计'}));
 const name = await screen.findByRole('textbox',{name:'选项名称'});
 await user.clear(name); await user.type(name,'AI Design{Enter}');
 const renamed = [{name:'AI Design',color:'blue'},options[1]];
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type,value:type === 'select' ? 'AI Design' : ['AI Design','开发'],options:renamed,definition:true,optionRename:{from:'设计',to:'AI Design'}},true));
 await user.click(screen.getByRole('button',{name:'管理选项 AI Design'}));
 await user.click(await screen.findByRole('menuitem',{name:'删除选项'}));
 expect(onSave).toHaveBeenCalledTimes(1);
 await user.click(await screen.findByRole('button',{name:'确认删除'}));
 await waitFor(()=>expect(onSave).toHaveBeenLastCalledWith({name:'领域',type,value:type === 'select' ? '' : ['开发'],options:[options[1]],definition:true},true));
});
it('rejects duplicate option names and keeps failed edits available',async()=>{
 const user = userEvent.setup(), onSave = vi.fn().mockRejectedValue(new Error('conflict'));
 render(<ChoicePropertyEditor property={property} busy={false} error="文件冲突" onSave={onSave} />);
 await user.click(screen.getByRole('button',{name:'管理选项 设计'}));
 const name = await screen.findByRole('textbox',{name:'选项名称'});
 await user.clear(name); await user.type(name,'开发{Enter}');
 expect(onSave).not.toHaveBeenCalled();
 expect(screen.getAllByRole('alert').some(alert=>alert.textContent === '同名选项已存在。')).toBe(true);
 await user.clear(name); await user.type(name,'New Design{Enter}');
 await waitFor(()=>expect(onSave).toHaveBeenCalledTimes(1));
 expect(screen.getByRole('textbox',{name:'选项名称'})).toHaveProperty('value','New Design');
 expect(screen.getByRole('button',{name:'移除选项 设计'})).toBeTruthy();
});
