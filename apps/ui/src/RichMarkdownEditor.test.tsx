// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { RichMarkdownEditor, type RichEditorProps } from './RichMarkdownEditor';
import userEvent from '@testing-library/user-event';
import { canWrapCallout, unwrapCallout, wrapCallout } from './rich-callout';
import { applyImageTransaction, arrangeImageRows, imageMoveTransaction, setImageWidths, splitImageRow } from './rich-image-layout';
vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
vi.mock('./bridge', () => ({ request: vi.fn() }));
// Compile the shared picker before timing editor interactions on cold CI workers.
beforeAll(async()=>{await import('./components/tag-emoji-picker');},15000);
beforeEach(() => {
 vi.stubGlobal('DragEvent', MouseEvent);
 vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerId=1; pointerType='mouse'; });
 HTMLElement.prototype.setPointerCapture=vi.fn();
 HTMLElement.prototype.releasePointerCapture=vi.fn();
 HTMLElement.prototype.hasPointerCapture=vi.fn(()=>true);
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
 vi.stubGlobal('matchMedia', vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 Range.prototype.getClientRects=()=>[] as unknown as DOMRectList;
 Range.prototype.getBoundingClientRect=()=>new DOMRect();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function setup(value: string, extra: Partial<RichEditorProps> = {}, page = false) {
 const change=vi.fn(),save=vi.fn();
 const content=<RichMarkdownEditor value={value} disabled={false} notePath="notes/a.md" onChange={change} onSave={save} onError={vi.fn()} {...extra}/>;
 await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 const rendered=render(page ? <div className="note-page-scroll">{content}<button>其他操作</button></div> : content);
 const field=await screen.findByRole('textbox',{name:'笔记内容'});
 const editor=(field as HTMLDivElement & {editor: Editor}).editor;
 vi.spyOn(editor.view,'coordsAtPos').mockReturnValue({left:60,right:160,top:100,bottom:126});
 await waitFor(()=> value.startsWith('<!--') ? expect(editor.state.doc.firstChild?.type.name).toBe('preservedMarkdown') : expect(editor.getText()).toContain(value.startsWith('#') ? '标题' : value.split('\n')[0].replace(/\[\^[^\]]+\]/g, '')));
 return {editor,field,change,save,rerender:rendered.rerender};
}
async function chooseCalloutColor(name: string) {
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 act(()=>screen.getByRole('menuitem',{name:'颜色'}).focus());
 await userEvent.setup().keyboard('{ArrowRight}');
 const popup=await screen.findByRole('menu',{name:'标注颜色'});
 fireEvent.click(within(popup).getByRole('menuitemradio',{name}));
 await waitFor(()=>expect(screen.queryByRole('menu',{name:'标注颜色'})).toBeNull());
}
it('opens without a write, renders heading syntax invisibly and edits semantic text',async()=>{
 const {editor,field,change}=await setup('# 标题\n\n正文');
 expect(change).not.toHaveBeenCalled();expect(field.querySelector('h1')?.textContent).toBe('标题');
 act(()=>{editor.commands.insertContentAt(2,'新');});
 expect(change).toHaveBeenLastCalledWith('# 标新题\n\n正文');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('# 标题\n\n正文');
});
it('restores the exact blank Markdown source after undoing body input',async()=>{
 const original=' \r\n\t';
 const {editor,change}=await setup('',{value:original,title:'空白页面'});
 act(()=>editor.commands.insertContent('输入'));
 act(()=>editor.commands.undo());
 expect(change).toHaveBeenLastCalledWith(original);
});
it('inserts an editable callout from the block menu and keeps it after reopening',async()=>{
 const {editor,field,change}=await setup('开头');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'标注'}));
 expect(field.querySelector('aside')?.getAttribute('data-callout')).toBe('gray');
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='aside')pos=at;});
 act(()=>{editor.commands.insertContentAt(pos+2,'新建标注');});
 const saved=change.mock.lastCall![0] as string;
 cleanup();const reopened=await setup(saved);
 expect(reopened.field.querySelector('.rich-callout-content')?.textContent).toBe('新建标注');
 expect(reopened.field.querySelector('aside')?.getAttribute('data-callout-icon')).toBe('💡');
});
it('creates a callout through slash search and Enter without retaining the command text',async()=>{
 const {editor,field}=await setup('开头');
 act(()=>{editor.chain().focus('end').splitBlock().insertContent('/callout').run();});
 await screen.findByRole('menu',{name:'插入内容块菜单'});
 expect(screen.getByRole('menuitem',{name:'标注'})).toBeTruthy();
 fireEvent.keyDown(field,{key:'Enter'});
 expect(field.querySelector('aside[data-callout="gray"]')).toBeTruthy();
 expect(editor.getText()).not.toContain('/callout');
});
it('converts a paragraph to a callout and back without losing inline formats, with one-step undo',async()=>{
 const original='开头\n\n**重点** 与 `token`\n\n结束';
 const {editor,field,change}=await setup(original);
 act(()=>editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize+1));
 const user=userEvent.setup();
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 act(()=>screen.getByRole('menuitem',{name:'转换为'}).focus());await user.keyboard('{ArrowRight}');
 fireEvent.click(await screen.findByRole('menuitem',{name:'标注'}));
 expect(field.querySelector('aside strong')?.textContent).toBe('重点');
 expect(field.querySelector('aside code')?.textContent).toBe('token');
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
 act(()=>editor.commands.redo());
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 act(()=>screen.getByRole('menuitem',{name:'转换为'}).focus());await user.keyboard('{ArrowRight}');
 fireEvent.click(await screen.findByRole('menuitem',{name:'普通区块'}));
 expect(field.querySelector('aside')).toBeNull();expect(change).toHaveBeenLastCalledWith(original);
});
it('wraps and unwraps several blocks while preserving headings, lists and links',async()=>{
 const original='开头\n\n## 小标题\n\n- **第一项**\n- [第二项](https://example.com)\n\n结尾';
 const {editor,field,change}=await setup(original);
 const blocks: Parameters<typeof wrapCallout>[1]=[];
 editor.state.doc.forEach((node,pos,index)=>blocks.push({node,pos,index,parent:-1}));
 expect(canWrapCallout(editor,blocks)).toBe(true);
 act(()=>wrapCallout(editor,blocks));
 expect(field.querySelector('aside h2')?.textContent).toBe('小标题');
 expect(field.querySelectorAll('aside li')).toHaveLength(2);
 expect(field.querySelector('aside a')?.getAttribute('href')).toBe('https://example.com');
 act(()=>unwrapCallout(editor,0));
 expect(change).toHaveBeenLastCalledWith(original);
 act(()=>editor.commands.undo());expect(field.querySelector('aside h2')).toBeTruthy();
});
it('edits an icon directly, retains the caret and saves only the new icon through reopening',async()=>{
 const original='开头\n\n<aside data-callout="blue" data-callout-icon="ℹ️"><p><strong>标题</strong></p><ul><li>正文</li></ul></aside>\n\n结尾';
 const {editor,field,change}=await setup(original);
 const pos=editor.state.doc.firstChild!.nodeSize;
 act(()=>editor.commands.setTextSelection(pos+3));
 const selection=editor.state.selection.toJSON();
 fireEvent.click(screen.getByRole('button',{name:'更改标注图标'}));
 const input=await screen.findByRole('textbox',{name:'搜索 Emoji'});
 await waitFor(()=>expect(document.activeElement).toBe(input));
 expect(change).not.toHaveBeenCalled();expect(editor.state.selection.toJSON()).toEqual(selection);
 fireEvent.change(input,{target:{value:'🧑🏽‍💻'}});
 fireEvent.keyDown(input,{key:'Enter'});
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑标注图标'})).toBeNull());
 const saved=change.mock.lastCall![0] as string;
 expect(saved).toContain('🧑🏽‍💻');expect(saved).not.toContain('rich-callout');expect(saved).not.toContain('<button');
 expect(field.querySelector('aside strong')?.textContent).toBe('标题');expect(field.querySelectorAll('aside li')).toHaveLength(1);
 expect(editor.state.selection.toJSON()).toEqual(selection);
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
 cleanup();const reopened=await setup(saved);
 expect(reopened.field.querySelector('aside')?.getAttribute('data-callout-icon')).toBe('🧑🏽‍💻');
},15000);
it('filters common emoji, applies one immediately and supports removing and adding the icon',async()=>{
 const {editor,field,change}=await setup('开头\n\n<aside data-callout="gray" data-callout-icon="💡"><p>正文</p></aside>');
 fireEvent.click(screen.getByRole('button',{name:'更改标注图标'}));
 const input=await screen.findByRole('textbox',{name:'搜索 Emoji'});
 fireEvent.change(input,{target:{value:'警告'}});
 expect(screen.queryByRole('button',{name:/灯泡/})).toBeNull();expect(change).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'警告、小心'}));
 expect(field.querySelector('aside')?.getAttribute('data-callout-icon')).toBe('⚠️');
 fireEvent.click(screen.getByRole('button',{name:'更改标注图标'}));
 await screen.findByRole('textbox',{name:'搜索 Emoji'});fireEvent.click(screen.getByRole('button',{name:'清除'}));
 expect(field.querySelector('aside')?.hasAttribute('data-callout-icon')).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'添加标注图标'}));
 fireEvent.change(await screen.findByRole('textbox',{name:'搜索 Emoji'}),{target:{value:'灯泡'}});fireEvent.click(screen.getByRole('button',{name:/灯泡/}));
 expect(field.querySelector('aside')?.getAttribute('data-callout-icon')).toBe('💡');
 act(()=>editor.commands.undo());expect(field.querySelector('aside')?.hasAttribute('data-callout-icon')).toBe(false);
},15000);
it('closes the icon picker with Escape or outside click without writing',async()=>{
 const {change}=await setup('开头\n\n<aside data-callout="blue" data-callout-icon="💡"><p>正文</p></aside>',{},true);
 const trigger=screen.getByRole('button',{name:'更改标注图标'});
 act(()=>trigger.focus());fireEvent.click(trigger);
 let input=await screen.findByRole('textbox',{name:'搜索 Emoji'});
 fireEvent.change(input,{target:{value:'🧭'}});
 await userEvent.setup().keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑标注图标'})).toBeNull());
 await waitFor(()=>expect(document.activeElement).toBe(trigger));
 fireEvent.click(trigger);input=await screen.findByRole('textbox',{name:'搜索 Emoji'});
 fireEvent.change(input,{target:{value:'🧭'}});
 const outside=screen.getByRole('button',{name:'其他操作'});
 fireEvent.pointerDown(outside,{button:0,pointerType:'mouse'});fireEvent.mouseDown(outside);fireEvent.click(outside);
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑标注图标'})).toBeNull());
 expect(change).not.toHaveBeenCalled();
});
it('changes background and text independently from the block submenu, preserving content with undo and reopening',async()=>{
 const original='开头\n\n<aside data-callout="blue" data-callout-icon="ℹ️"><p><strong>标题</strong></p><ul><li>正文</li></ul></aside>';
 const {editor,field,change}=await setup(original);
 act(()=>editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize+2));
 await chooseCalloutColor('紫色背景');
 const purple=change.mock.lastCall![0] as string;
 expect(field.querySelector('aside')?.getAttribute('data-callout')).toBe('purple');
 await chooseCalloutColor('棕色文字');
 const saved=change.mock.lastCall![0] as string;
 expect(saved).toContain('data-callout-text-color="brown"');expect(saved).toContain('data-callout="purple"');
 expect(field.querySelector('aside strong')?.textContent).toBe('标题');expect(field.querySelectorAll('aside li')).toHaveLength(1);
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(purple);
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
 cleanup();const reopened=await setup(saved);
 expect(reopened.field.querySelector('aside')?.getAttribute('data-callout-text-color')).toBe('brown');
 expect(reopened.field.querySelector('aside')?.getAttribute('data-callout')).toBe('purple');
});
it('shows current colors and resets them without changing the emoji or body',async()=>{
 const {editor,field}=await setup('开头\n\n<aside data-callout="purple" data-callout-text-color="brown" data-callout-icon="🧭"><p>正文</p></aside>');
 act(()=>editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize+2));
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 act(()=>screen.getByRole('menuitem',{name:'颜色'}).focus());await userEvent.setup().keyboard('{ArrowRight}');
 await screen.findByRole('menu',{name:'标注颜色'});
 expect(screen.getByRole('menuitemradio',{name:'紫色背景'}).getAttribute('aria-checked')).toBe('true');
 expect(screen.getByRole('menuitemradio',{name:'棕色文字'}).getAttribute('aria-checked')).toBe('true');
 fireEvent.click(screen.getByRole('menuitemradio',{name:'默认文字'}));
 await waitFor(()=>expect(screen.queryByRole('menu',{name:'标注颜色'})).toBeNull());
 await chooseCalloutColor('默认背景');
 expect(field.querySelector('aside')?.hasAttribute('data-callout-text-color')).toBe(false);
 expect(field.querySelector('aside')?.getAttribute('data-callout')).toBe('default');
 expect(field.querySelector('aside')?.getAttribute('data-callout-icon')).toBe('🧭');
 expect(field.querySelector('.rich-callout-content')?.textContent).toBe('正文');
});
it('opens the icon picker with the keyboard and exposes the expanded state',async()=>{
 const {field}=await setup('开头\n\n<aside data-callout="blue" data-callout-icon="💡"><p>正文</p></aside>');
 // Tiptap finishes its initial focus on the next animation frame.
 await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 expect(document.activeElement).toBe(field);
 const trigger=screen.getByRole('button',{name:'更改标注图标'});
 act(()=>trigger.focus());await userEvent.setup().keyboard('{Enter}');
 await screen.findByRole('textbox',{name:'搜索 Emoji'});
 expect(trigger.getAttribute('aria-expanded')).toBe('true');
 await userEvent.setup().keyboard('{Escape}');
 await waitFor(()=>expect(trigger.getAttribute('aria-expanded')).toBe('false'));
});
it('uses the same picker from the block menu and safely follows a moved position',async()=>{
 const {editor,field}=await setup('开头\n\n<aside data-callout="blue"><p>正文</p></aside>');
 act(()=>editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize+2));
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'编辑图标'}));
 await screen.findByRole('textbox',{name:'搜索 Emoji'});
 act(()=>editor.commands.insertContentAt(1,'更长的开头'));
 fireEvent.change(screen.getByRole('textbox',{name:'搜索 Emoji'}),{target:{value:'指南针'}});fireEvent.click(screen.getByRole('button',{name:/指南针/}));
 expect(field.querySelector('aside')?.getAttribute('data-callout-icon')).toBe('🧭');
});
it('does not apply icon changes to a deleted block or allow edits while disabled',async()=>{
 const original='开头\n\n<aside data-callout="blue" data-callout-icon="💡"><p>正文</p></aside>';
 const {editor,change}=await setup(original);
 fireEvent.click(screen.getByRole('button',{name:'更改标注图标'}));
 await screen.findByRole('textbox',{name:'搜索 Emoji'});
 act(()=>editor.commands.deleteRange({from:editor.state.doc.firstChild!.nodeSize,to:editor.state.doc.content.size}));
 change.mockClear();fireEvent.change(screen.getByRole('textbox',{name:'搜索 Emoji'}),{target:{value:'灯泡'}});fireEvent.click(screen.getByRole('button',{name:/灯泡/}));
 expect(screen.getByRole('alert').textContent).toContain('标注已变化');expect(change).not.toHaveBeenCalled();
 cleanup();const readonly=await setup(original,{disabled:true});
 expect(screen.queryByRole('button',{name:'更改标注图标'})).toBeNull();
 expect(readonly.field.querySelector('aside')?.getAttribute('data-callout-icon')).toBe('💡');
});
it('closes the picker and updates native buttons when editing is disabled and reenabled',async()=>{
 const raw='开头\n\n<aside data-callout="blue" data-callout-icon="💡"><p>正文</p></aside>';
 const {field,change,rerender}=await setup(raw);
 fireEvent.click(screen.getByRole('button',{name:'更改标注图标'}));
 await screen.findByRole('textbox',{name:'搜索 Emoji'});
 const props={value:raw,notePath:'notes/a.md',onChange:change,onSave:vi.fn(),onError:vi.fn()};
 rerender(<RichMarkdownEditor {...props} disabled />);
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑标注图标'})).toBeNull());
 expect(screen.queryByRole('button',{name:'更改标注图标'})).toBeNull();
 expect(field.getAttribute('contenteditable')).toBe('false');expect(change).not.toHaveBeenCalled();
 rerender(<RichMarkdownEditor {...props} disabled={false} />);
 await screen.findByRole('button',{name:'更改标注图标'});expect(change).not.toHaveBeenCalled();
});
it('previews Mermaid while preserving editable fences and ordinary code through reopening',async()=>{
 const code='flowchart TD\nA[开始] --> B[完成]';
 const ordinary='```typescript\nconst n = 1;\n```';
 const {editor,field,change}=await setup('开头\n\n```mermaid\n'+code+'\n```\n\n'+ordinary);
 await screen.findByRole('button',{name:'放大 Mermaid 图表'});
 expect(change).not.toHaveBeenCalled();
 expect(field.querySelector('pre code.language-mermaid')?.textContent).toBe(code);
 const contentDOM=field.querySelector('pre code.language-mermaid');
 fireEvent.click(screen.getByRole('tab',{name:'仅图形'}));
 expect(contentDOM?.closest<HTMLElement>('.mermaid-source')?.hidden).toBe(true);
 fireEvent.click(screen.getByRole('tab',{name:'仅源码'}));
 expect(screen.queryByRole('img',{name:'Mermaid 图表'})).toBeNull();
 const user=userEvent.setup();
 act(()=>screen.getByRole('tab',{name:'仅源码'}).focus());
 await user.keyboard('{ArrowRight}');
 expect(screen.getByRole('tab',{name:'仅图形'}).getAttribute('aria-selected')).toBe('true');
 fireEvent.click(screen.getByRole('tab',{name:'仅源码'}));
 expect(field.querySelector('pre code.language-mermaid')).toBe(contentDOM);
 expect(change).not.toHaveBeenCalled();
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='codeBlock'&&node.attrs.language==='mermaid')pos=at+node.nodeSize-2;});
 act(()=>{editor.commands.insertContentAt(pos,'新');});
 const saved=change.mock.lastCall![0] as string;
 fireEvent.click(screen.getByRole('tab',{name:'源码与图形'}));
 await waitFor(()=>expect(screen.getByRole('img',{name:'Mermaid 图表'}).shadowRoot?.textContent).toContain('完成新'));
 expect(saved).toContain(ordinary);expect(saved).not.toContain('<svg');expect(saved).not.toContain('mermaid-preview');
 cleanup();const reopened=await setup(saved);
 await screen.findByRole('button',{name:'放大 Mermaid 图表'});
 expect(screen.getByRole('tab',{name:'源码与图形'}).getAttribute('aria-selected')).toBe('true');
 expect(reopened.field.querySelector('pre code.language-mermaid')?.textContent).toBe('flowchart TD\nA[开始] --> B[完成新]');
 expect(reopened.field.querySelector('pre code.language-typescript')?.textContent).toBe('const n = 1;');
});
it('keeps callout paragraphs and layout metadata through editing and reopening',async()=>{
 const raw='<aside data-callout="blue" data-callout-icon="🧭"><p>第一段</p><p>第二段</p></aside>';
 const {editor,field,change}=await setup('开头\n\n'+raw+'\n\n结尾');
 expect(field.querySelector('aside')?.getAttribute('data-callout')).toBe('blue');
 expect(field.querySelectorAll('aside > .rich-callout-content > p')).toHaveLength(2);expect(change).not.toHaveBeenCalled();
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='paragraph'&&node.textContent==='第二段')pos=at+1;});
 act(()=>{editor.commands.insertContentAt(pos,'新');});
 const saved=change.mock.lastCall![0] as string;
 expect(saved).toContain('data-callout="blue"');expect(saved).toContain('data-callout-icon="🧭"');expect(saved).toContain('<p>新第二段</p>');
 cleanup();const reopened=await setup(saved);
 expect(reopened.field.querySelectorAll('aside > .rich-callout-content > p')).toHaveLength(2);
 expect(reopened.field.querySelector('.rich-callout-content')?.textContent).toBe('第一段新第二段');
});
it('keeps the guide info, warning and quote callouts separate through edits and reopening',async()=>{
 const panels=[{color:'blue',icon:'ℹ️',title:'信息提示',body:'信息正文'},{color:'yellow',icon:'⚠️',title:'警告',body:'警告正文'},{color:'gray',icon:'❝',title:'引言',body:'引言正文'}];
 const raw=panels.map(p=>`<aside data-callout="${p.color}" data-callout-icon="${p.icon}"><p><strong>${p.title}</strong></p><p>${p.body}</p></aside>`).join('\n\n');
 const {editor,field,change}=await setup('开头\n\n'+raw+'\n\n结尾');
 expect(field.querySelectorAll('aside')).toHaveLength(3);
 for(const panel of panels){
  let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='paragraph'&&node.textContent===panel.body)pos=at+2;});
  act(()=>{editor.commands.insertContentAt(pos,'新');});
 }
 const saved=change.mock.lastCall![0] as string;
 cleanup();const reopened=await setup(saved);
 const asides=[...reopened.field.querySelectorAll('aside')];expect(asides).toHaveLength(3);
 asides.forEach((aside,i)=>{
  expect(aside.getAttribute('data-callout')).toBe(panels[i].color);expect(aside.getAttribute('data-callout-icon')).toBe(panels[i].icon);
  expect(aside.querySelectorAll(':scope > .rich-callout-content > p')).toHaveLength(2);expect(aside.querySelector('strong')?.textContent).toBe(panels[i].title);
  expect(aside.querySelector('.rich-callout-content')!.children[1].textContent).toBe(panels[i].body[0]+'新'+panels[i].body.slice(1));
 });
 expect(saved.startsWith('开头\n\n')).toBe(true);expect(saved.endsWith('\n\n结尾')).toBe(true);
});
it('keeps code inside emphasized text and lists after editing and reopening',async()=>{
 const raw='**`bodyState` 在 `onExitComplete` 中清理**：正文。\n\n- **`fetchBodyData(slug)`**：返回 `Promise<BodyResult>`\n- **`AnimatePresence key={selectedSlug}`**：说明\n- **卡片原生 `<a>` 标签**：说明';
 const {editor,field,change}=await setup('开头\n\n'+raw);
 const expected=['bodyState','onExitComplete','fetchBodyData(slug)','Promise<BodyResult>','AnimatePresence key={selectedSlug}','<a>'];
 expect([...field.querySelectorAll('code')].map(e=>e.textContent)).toEqual(expected);
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='paragraph'&&node.textContent.startsWith('fetchBodyData'))pos=at+node.nodeSize-1;});
 act(()=>{editor.commands.insertContentAt(pos,'新');});
 cleanup();const reopened=await setup(change.mock.lastCall![0] as string);
 expect([...reopened.field.querySelectorAll('code')].map(e=>e.textContent)).toEqual(expected.map((text,i)=>i===3?text+'新':text));
 expect(reopened.field.querySelectorAll('strong code')).toHaveLength(5);
 expect(reopened.field.querySelectorAll('li')).toHaveLength(3);
 expect(reopened.field.textContent).toContain('返回 Promise<BodyResult>新');
});
it('keeps a quoted CSS example as code when edited and reopened',async()=>{
 const {editor,field,change}=await setup('开头\n\n> ```css\n> primary-color: #1A73E8;\n> border-radius: 8px;\n> ```\n\n结尾');
 expect(field.querySelector('blockquote pre code')?.className).toBe('language-css');
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='codeBlock')pos=at+node.nodeSize-1;});
 act(()=>{editor.commands.insertContentAt(pos,'\n/* 示例 */');});
 cleanup();const reopened=await setup(change.mock.lastCall![0] as string);
 expect(reopened.field.querySelector('blockquote pre code')?.textContent).toBe('primary-color: #1A73E8;\nborder-radius: 8px;\n/* 示例 */');
 expect(reopened.field.querySelectorAll('blockquote')).toHaveLength(1);
 expect(reopened.field.querySelector('pre code')?.className).toBe('language-css');
});
it('keeps callout lists and wiki destinations when edited and reopened',async()=>{
 const raw='<aside data-callout="blue" data-callout-icon="ℹ️"><p><strong>项目信息</strong></p><ul><li><strong>客户</strong>: 示例</li><li><strong>平台</strong>: Web</li></ul></aside>\n\n[[../../README]]\n\n<aside data-callout="green" data-callout-icon="✅"><p><strong>项目成果</strong></p><p>成果正文</p></aside>';
 const {editor,change}=await setup('开头\n\n'+raw);
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='paragraph'&&node.textContent==='成果正文')pos=at+node.nodeSize-1;});
 act(()=>{editor.commands.insertContentAt(pos,'新');});
 cleanup();const reopened=await setup(change.mock.lastCall![0] as string);
 expect([...reopened.field.querySelectorAll('aside')].map(e=>e.getAttribute('data-callout'))).toEqual(['blue','green']);
 expect(reopened.field.querySelectorAll('aside li')).toHaveLength(2);
 expect([...reopened.field.querySelectorAll('aside strong')].map(e=>e.textContent)).toEqual(['项目信息','客户','平台','项目成果']);
 expect(reopened.field.querySelector('a[data-wiki-target]')?.getAttribute('data-wiki-target')).toBe('../../README');
 expect(reopened.field.textContent).toContain('成果正文新');
});
it('keeps HTML paragraph emphasis at Chinese punctuation boundaries after editing and reopening',async()=>{
 const raw='<p>在数字产品设计中，<strong>第 04 条（易于理解）</strong>和<strong>第 10 条（极简）</strong>尤为重要。</p>';
 const {editor,field,change}=await setup('开头\n\n'+raw+'\n\n结尾');
 expect([...field.querySelectorAll('strong')].map(e=>e.textContent)).toEqual(['第 04 条（易于理解）','第 10 条（极简）']);
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='paragraph'&&node.textContent.startsWith('在数字产品设计中'))pos=at+node.nodeSize-1;});
 act(()=>{editor.commands.insertContentAt(pos,'新');});
 const saved=change.mock.lastCall![0] as string;
 cleanup();const reopened=await setup(saved);
 expect([...reopened.field.querySelectorAll('strong')].map(e=>e.textContent)).toEqual(['第 04 条（易于理解）','第 10 条（极简）']);
 expect(reopened.field.textContent).toContain('在数字产品设计中，第 04 条（易于理解）和第 10 条（极简）尤为重要。新');
});
it('keeps grouped images, ratios and captions when a gallery is edited and reopened',async()=>{
 const raw='<figure data-image-columns="40,60"><img src="../assets/a.png" alt="第一张"><img src="../assets/b.png" alt="第二张"><figcaption>原说明</figcaption></figure>';
 const {editor,field,change}=await setup('开头\n\n'+raw+'\n\n结尾');
 expect(field.querySelector('figure')?.getAttribute('data-image-columns')).toBe('40,60');
 expect(field.querySelectorAll('figure img')).toHaveLength(2);expect(change).not.toHaveBeenCalled();
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.type.name==='figcaption')pos=at+1;});
 act(()=>{editor.commands.insertContentAt(pos,'新');});
 const saved=change.mock.lastCall![0] as string;
 expect(saved).toContain('data-image-columns="40,60"');expect(saved).not.toContain('style=');
 expect(saved).toContain('src="../assets/a.png"');expect(saved).toContain('src="../assets/b.png"');
 cleanup();const reopened=await setup(saved);
 expect(reopened.field.querySelectorAll('figure img')).toHaveLength(2);
 expect(reopened.field.querySelector('figcaption')?.textContent).toBe('新原说明');
});
const layoutImages = '<figure data-image-columns="40,60"><img src="../assets/a.png" alt="甲"><img src="../assets/b.png" alt="乙"><figcaption>共同说明</figcaption></figure>';
function imagePos(editor: Editor, alt: string) {
 let found=-1;editor.state.doc.descendants((node,pos)=>{if(['image','wikiImage'].includes(node.type.name)&&node.attrs.alt===alt)found=pos;});
 if(found<0)throw new Error(`Missing image: ${alt}`);return found;
}
it('joins images from their layout menu with one-step undo and saves a reopenable row',async()=>{
 const original='开头\n\n![甲](../assets/a.png)\n\n![乙](../assets/b.png)\n\n结束';
 const {editor,field,change}=await setup(original);
 fireEvent.click(screen.getByRole('button',{name:'图片布局 甲'}));
 fireEvent.click(await screen.findByRole('menuitem',{name:'与下一行并排'}));
 await waitFor(()=>expect(field.querySelectorAll('figure img')).toHaveLength(2));
 const saved=change.mock.lastCall![0] as string;expect(saved).not.toContain('style=');
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
 act(()=>editor.commands.redo());expect(change).toHaveBeenLastCalledWith(saved);
 cleanup();const reopened=await setup(saved);
 expect([...reopened.field.querySelectorAll('figure img')].map(img=>img.getAttribute('alt'))).toEqual(['甲','乙']);
 expect(reopened.change).not.toHaveBeenCalled();
});
it('reorders, extracts and splits grouped images without losing captions or surrounding text',async()=>{
 const original='开头\n\n'+layoutImages+'\n\n![丙](../assets/c.png)\n\n结束';
 const {editor,field,change}=await setup(original);
 act(()=>applyImageTransaction(editor,imageMoveTransaction(editor,imagePos(editor,'乙'),imagePos(editor,'甲'),'left')));
 await waitFor(()=>expect([...field.querySelectorAll('figure img')].map(img=>img.getAttribute('alt'))).toEqual(['乙','甲']));
 expect(field.querySelector('figcaption')?.textContent).toBe('共同说明');
 act(()=>splitImageRow(editor,imagePos(editor,'乙'),true));
 expect(field.querySelectorAll('figure img')).toHaveLength(1);expect(field.querySelector('figcaption')?.textContent).toBe('共同说明');
 act(()=>editor.commands.undo());act(()=>splitImageRow(editor,imagePos(editor,'甲')));
 expect(field.querySelectorAll('figure img')).toHaveLength(0);expect(field.querySelector('figcaption')?.textContent).toBe('共同说明');
 const saved=change.mock.lastCall![0] as string;cleanup();const reopened=await setup(saved);
 expect([...reopened.field.querySelectorAll('img')].map(img=>img.getAttribute('alt'))).toEqual(['乙','甲','丙']);
 expect(reopened.field.textContent).toContain('共同说明');expect(reopened.field.textContent).toContain('结束');
});
it('keeps an open image menu attached to its image when preceding text changes',async()=>{
 const {editor,field}=await setup('开头\n\n![甲](../assets/a.png)\n\n![乙](../assets/b.png)\n\n结束');
 fireEvent.click(screen.getByRole('button',{name:'图片布局 甲'}));
 await screen.findByRole('menuitem',{name:'与下一行并排'});
 act(()=>editor.commands.insertContentAt(2,'新增文字'));
 fireEvent.click(screen.getByRole('menuitem',{name:'与下一行并排'}));
 await waitFor(()=>expect([...field.querySelectorAll('figure img')].map(img=>img.getAttribute('alt'))).toEqual(['甲','乙']));
 expect(editor.getText()).toContain('开新增文字头');
});
it('moves images across rows, collapses an empty source row, and rejects full or incompatible targets',async()=>{
 const {editor,field}=await setup('开头\n\n'+layoutImages+'\n\n![丙](../assets/c.png)\n\n![丁](../assets/d.png)\n\n<blockquote><img src="../assets/e.png" alt="戊"></blockquote>');
 const before=editor.getJSON();
 expect(imageMoveTransaction(editor,imagePos(editor,'甲'),imagePos(editor,'戊'),'left')).toBeNull();expect(editor.getJSON()).toEqual(before);
 act(()=>applyImageTransaction(editor,imageMoveTransaction(editor,imagePos(editor,'丙'),imagePos(editor,'乙'),'right')));
 await waitFor(()=>expect(field.querySelectorAll('figure img')).toHaveLength(3));
 expect(imageMoveTransaction(editor,imagePos(editor,'丁'),imagePos(editor,'乙'),'left')).toBeNull();
 act(()=>applyImageTransaction(editor,imageMoveTransaction(editor,imagePos(editor,'甲'),imagePos(editor,'丁'),'above')));
 await waitFor(()=>expect([...field.querySelectorAll('img')].map(img=>img.getAttribute('alt'))).toEqual(['乙','丙','甲','丁','戊']));
 expect(field.querySelectorAll('figure img')).toHaveLength(2);expect(field.querySelector('figcaption')?.textContent).toBe('共同说明');
});
it('previews column resizing without writes, cancels it, then commits one undoable change',async()=>{
 const original='开头\n\n'+layoutImages;const {editor,field,change}=await setup(original);
 const row=field.querySelector('figure')!;
 row.getBoundingClientRect=()=>new DOMRect(0,0,616,300);
 const handle=screen.getByRole('separator',{name:'调整第 1、2 列宽度'});
 fireEvent.pointerDown(handle,{button:0,clientX:252,pointerId:1});fireEvent.pointerMove(handle,{clientX:312,pointerId:1});
 expect(change).not.toHaveBeenCalled();expect(row.style.gridTemplateColumns).toBe('50fr 50fr');
 fireEvent.keyDown(handle,{key:'Escape'});expect(row.style.gridTemplateColumns).toBe('40fr 60fr');
 fireEvent.pointerDown(handle,{button:0,clientX:252,pointerId:1});fireEvent.pointerMove(handle,{clientX:312,pointerId:1});fireEvent.pointerUp(handle,{pointerId:1});
 expect(row.getAttribute('data-image-columns')).toBe('50,50');expect(change).toHaveBeenCalledTimes(1);
 fireEvent.keyDown(handle,{key:'z',metaKey:true});expect(change).toHaveBeenLastCalledWith(original);
 fireEvent.keyDown(handle,{key:'ArrowLeft'});expect(row.getAttribute('data-image-columns')).toBe('38,62');
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
});
it('arranges selected image rows into two or three columns and preserves wiki image identity',async()=>{
 const {request}=await import('./bridge');vi.mocked(request).mockResolvedValue({kind:'image',path:'assets/a.png'});
 const {editor,field,change}=await setup('开头\n\n![[a.png|甲]]\n\n![乙](../assets/b.png)\n\n![丙](../assets/c.png)');
 act(()=>arrangeImageRows(editor,imagePos(editor,'甲'),editor.state.doc.content.size,3));
 await waitFor(()=>expect(field.querySelectorAll('figure img')).toHaveLength(3));
 const saved=change.mock.lastCall![0] as string;expect(saved).toContain('data-wiki-image');
 cleanup();const reopened=await setup(saved);
 expect(reopened.editor.state.doc.nodeAt(imagePos(reopened.editor,'甲'))?.type.name).toBe('wikiImage');
 const from=reopened.editor.state.doc.firstChild!.nodeSize;
 act(()=>arrangeImageRows(reopened.editor,from,reopened.editor.state.doc.content.size,2));
 expect(reopened.field.querySelectorAll('figure img')).toHaveLength(2);await waitFor(()=>expect(reopened.field.querySelectorAll('img')).toHaveLength(3));
});
it('drops an image beside another and consumes cancelled and stale drops without changing content',async()=>{
 const original='开头\n\n![甲](../assets/a.png)\n\n![乙](../assets/b.png)';
 const {editor,field,change}=await setup(original);
 field.getBoundingClientRect=()=>new DOMRect(0,0,700,800);
 const target=screen.getByRole('button',{name:'查看大图 乙'}).closest('.rich-image')!;
 target.getBoundingClientRect=()=>new DOMRect(0,400,300,200);
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 const start=()=>{fireEvent.mouseMove(screen.getByRole('button',{name:'查看大图 甲'}));fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});};
 start();fireEvent.dragOver(target,{clientX:290,clientY:500,dataTransfer:transfer});
 expect(document.querySelector('.rich-image-drop-guide')).toBeTruthy();
 fireEvent.keyDown(window,{key:'Escape'});fireEvent.drop(target,{clientX:290,clientY:500,dataTransfer:transfer});
 expect(change).not.toHaveBeenCalled();expect(document.querySelector('.rich-image-drop-guide')).toBeNull();
 start();act(()=>editor.commands.insertContentAt(2,'新'));const changed=change.mock.lastCall![0];
 fireEvent.drop(target,{clientX:290,clientY:500,dataTransfer:transfer});expect(change).toHaveBeenLastCalledWith(changed);
 act(()=>editor.commands.undo());start();fireEvent.drop(target,{clientX:290,clientY:500,dataTransfer:transfer});
 await waitFor(()=>expect(field.querySelectorAll('figure img')).toHaveLength(2));act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
});
it('drags an image surface without opening the viewer and preserves a fresh single click',async()=>{
 const original='开头\n\n'+layoutImages+'\n\n![丙](../assets/c.png)';
 const {editor,field,change}=await setup(original);
 field.getBoundingClientRect=()=>new DOMRect(0,0,700,900);
 const source=screen.getByRole('button',{name:'查看大图 乙'}),target=screen.getByRole('button',{name:'查看大图 丙'}).closest('.rich-image')!;
 target.getBoundingClientRect=()=>new DOMRect(0,600,300,200);
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 expect(source.draggable).toBe(true);
 fireEvent.dragStart(source,{dataTransfer:transfer});
 expect(transfer.setData).toHaveBeenCalledWith('application/x-memocard-image','move');
 fireEvent.keyDown(window,{key:'Escape'});fireEvent.drop(target,{clientX:290,clientY:700,dataTransfer:transfer});
 fireEvent.click(source,{detail:1});expect(screen.queryByRole('dialog')).toBeNull();expect(change).not.toHaveBeenCalled();
 fireEvent.pointerDown(source,{button:0});fireEvent.dragStart(source,{dataTransfer:transfer});
 fireEvent.drop(target,{clientX:290,clientY:700,dataTransfer:transfer});
 await waitFor(()=>expect([...field.querySelectorAll('img')].map(img=>img.getAttribute('alt'))).toEqual(['甲','丙','乙']));
 expect(field.querySelector('figcaption')?.textContent).toBe('共同说明');expect(screen.queryByRole('dialog')).toBeNull();
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
 const restored=await screen.findByRole('button',{name:'查看大图 乙'});
 fireEvent.pointerDown(restored,{button:0});fireEvent.click(restored,{detail:1});
 expect(await screen.findByRole('dialog',{name:'乙'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'关闭图片'}));
});
it('hides layout controls and refuses layout writes in a disabled editor',async()=>{
 const {editor,field,change}=await setup('开头\n\n'+layoutImages,{disabled:true});
 expect(screen.queryByRole('button',{name:'图片布局 甲'})).toBeNull();expect(screen.queryByRole('separator',{name:'调整第 1、2 列宽度'})).toBeNull();
 expect(splitImageRow(editor,imagePos(editor,'甲'))).toBe(false);expect(setImageWidths(editor,editor.state.doc.firstChild!.nodeSize,[50,50])).toBe(false);
 expect(field.querySelectorAll('figure img')).toHaveLength(2);expect(change).not.toHaveBeenCalled();
 expect(screen.getByRole('button',{name:'查看大图 甲'}).draggable).toBe(false);
 act(()=>editor.setEditable(true));expect(screen.getByRole('button',{name:'查看大图 甲'}).draggable).toBe(true);
 act(()=>editor.setEditable(false));expect(screen.getByRole('button',{name:'查看大图 甲'}).draggable).toBe(false);
});
it('uses the left block handle for a hovered grouped image and can drag the whole row with Alt',async()=>{
 const original='开头\n\n'+layoutImages+'\n\n![丙](../assets/c.png)';
 const {editor,field,change}=await setup(original);
 expect(screen.queryByRole('button',{name:'拖动图片 乙'})).toBeNull();
 const second=screen.getByRole('button',{name:'查看大图 乙'}),dom=editor.view.nodeDOM(imagePos(editor,'乙')) as HTMLElement;
 dom.getBoundingClientRect=()=>new DOMRect(350,100,280,400);
 fireEvent.mouseMove(second,{clientX:400,clientY:120});
 expect(field.closest('.rich-editor')!.querySelector<HTMLElement>('.block-controls')!.style.left).toBe('322px');
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer,altKey:true});
 expect(editor.state.doc.nodeAt(editor.state.selection.from)?.type.name).toBe('figure');
 fireEvent.dragEnd(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.mouseMove(second,{clientX:400,clientY:120});
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});
 const target=screen.getByRole('button',{name:'查看大图 丙'}).closest('.rich-image')!;
 field.getBoundingClientRect=()=>new DOMRect(0,0,700,900);target.getBoundingClientRect=()=>new DOMRect(0,600,300,200);
 fireEvent.drop(target,{clientX:290,clientY:700,dataTransfer:transfer});
 await waitFor(()=>expect([...field.querySelectorAll('img')].map(img=>img.getAttribute('alt'))).toEqual(['甲','丙','乙']));
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith(original);
});
it('moves an individual image before text without losing its former row caption',async()=>{
 const {editor,field,change}=await setup('开头\n\n'+layoutImages+'\n\n结束');
 const original=editor.getJSON(),last=editor.state.doc.content.size-editor.state.doc.lastChild!.nodeSize;
 act(()=>applyImageTransaction(editor,imageMoveTransaction(editor,imagePos(editor,'乙'),last,'above')));
 await waitFor(()=>expect(field.querySelectorAll('img')).toHaveLength(2));
 expect(field.querySelectorAll('figure img')).toHaveLength(1);expect(field.querySelector('figcaption')?.textContent).toBe('共同说明');
 expect(change.mock.lastCall![0]).toMatch(/!\[乙\].*\n\n结束/);
 act(()=>editor.commands.undo());expect(editor.getJSON()).toEqual(original);
});
it('folds a heading section up to its next peer without changing Markdown or undo history',async()=>{
 const {editor,field,change,save}=await setup('## 标题 A\n\n正文 A\n\n### 子标题\n\n子正文\n\n## 标题 B\n\n正文 B');
 const before=editor.getJSON();
 const toggle=await screen.findByRole('button',{name:'收起“标题 A”章节'});
 fireEvent.click(toggle);
 expect(toggle.getAttribute('aria-expanded')).toBe('false');
 expect(field.querySelector('h3')?.getAttribute('hidden')).toBe('');
 expect([...field.querySelectorAll('p')].filter(p=>p.hasAttribute('hidden')).map(p=>p.textContent)).toEqual(['正文 A','子正文']);
 expect(field.querySelectorAll('h2')[1].hasAttribute('hidden')).toBe(false);
 expect(editor.getJSON()).toEqual(before);expect(change).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
 expect(editor.can().undo()).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'展开“标题 A”章节'}));
 expect(field.querySelector('[hidden]')).toBeNull();expect(change).not.toHaveBeenCalled();
});
it('reveals folded chapters when switching to mobile without changing content or history',async()=>{
 let resize=()=>{};
 const media={matches:false,addEventListener:(_event:string,listener:()=>void)=>{resize=listener;},removeEventListener:vi.fn()};
 vi.stubGlobal('matchMedia',vi.fn((query:string)=>query.includes('767px')?media:{matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
 const {editor,field,change}=await setup('## 标题\n\n正文');
 fireEvent.click(await screen.findByRole('button',{name:'收起“标题”章节'}));
 expect(field.querySelector('p')?.hasAttribute('hidden')).toBe(true);
 const before=editor.getJSON();
 act(()=>{media.matches=true;resize();});
 expect(field.querySelector('[hidden]')).toBeNull();
 expect(editor.getJSON()).toEqual(before);expect(change).not.toHaveBeenCalled();expect(editor.can().undo()).toBe(false);
});
it('keeps child folds when reopening a parent and reveals a programmatic selection',async()=>{
 const {editor,field,change}=await setup('## 标题 A\n\n父正文\n\n### 子标题\n\n子正文\n\n## 标题 B\n\n其他正文');
 fireEvent.click(await screen.findByRole('button',{name:'收起“子标题”章节'}));
 fireEvent.click(screen.getByRole('button',{name:'收起“标题 A”章节'}));
 fireEvent.click(screen.getByRole('button',{name:'展开“标题 A”章节'}));
 expect(screen.getByRole('button',{name:'展开“子标题”章节'}).getAttribute('aria-expanded')).toBe('false');
 expect([...field.querySelectorAll('[hidden]')].map(p=>p.textContent)).toEqual(['子正文']);
 fireEvent.click(screen.getByRole('button',{name:'收起“标题 A”章节'}));
 let destination=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph'&&node.textContent==='子正文')destination=pos+1;});
 act(()=>{editor.commands.setTextSelection(destination);});
 expect(field.querySelector('[hidden]')).toBeNull();
 expect(screen.getByRole('button',{name:'收起“标题 A”章节'})).toBeTruthy();
 expect(change).not.toHaveBeenCalled();
});
it.each(['Delete','Backspace'])('reveals folded content before %s across its boundary',async key=>{
 const {editor,field,change}=await setup('## 标题 A\n\n不能误删\n\n## 标题 B\n\n其他正文');
 let nextHeading=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='heading'&&node.textContent==='标题 B')nextHeading=pos+1;});
 act(()=>{editor.commands.setTextSelection(key==='Delete'?editor.state.doc.firstChild!.nodeSize-1:nextHeading);});
 fireEvent.click(await screen.findByRole('button',{name:'收起“标题 A”章节'}));
 const before=editor.getJSON();
 fireEvent.keyDown(field,{key});
 expect(screen.getByRole('button',{name:'收起“标题 A”章节'})).toBeTruthy();
 expect(editor.getJSON()).toEqual(before);expect(change).not.toHaveBeenCalled();
});
it('keeps a folded heading closed while opening its block menu',async()=>{
 const {editor,field,change}=await setup('## 标题\n\n正文');
 fireEvent.click(await screen.findByRole('button',{name:'收起“标题”章节'}));
 act(()=>{editor.commands.setNodeSelection(0);});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(screen.getByRole('button',{name:'展开“标题”章节'})).toBeTruthy();
 expect(field.querySelector('p')?.hasAttribute('hidden')).toBe(true);
 expect(change).not.toHaveBeenCalled();
});
it('maps folds after preceding edits and refreshes heading labels',async()=>{
 const {editor,field}=await setup('开头\n\n## 标题\n\n正文');
 fireEvent.click(await screen.findByRole('button',{name:'收起“标题”章节'}));
 act(()=>{editor.commands.insertContentAt(1,'新');});
 const toggle=await screen.findByRole('button',{name:'展开“标题”章节'});
 expect(field.querySelector('p[hidden]')?.textContent).toBe('正文');
 let heading=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='heading')heading=pos;});
 act(()=>{editor.commands.insertContentAt(heading+1,'新');});
 expect(await screen.findByRole('button',{name:'展开“新标题”章节'})).toBeTruthy();
 expect(toggle.getAttribute('aria-expanded')).toBe('false');
});
it('supports keyboard folding in a read-only document without writes and guards composition',async()=>{
 const {editor,field,change}=await setup('## 标题\n\n正文',{disabled:true});
 const toggle=await screen.findByRole('button',{name:'收起“标题”章节'}),user=userEvent.setup();
 toggle.focus();await user.keyboard('{Enter}');
 expect(toggle.getAttribute('aria-expanded')).toBe('false');expect(document.activeElement).toBe(toggle);
 await user.keyboard(' ');
 expect(toggle.getAttribute('aria-expanded')).toBe('true');expect(document.activeElement).toBe(toggle);
 Object.defineProperty(editor.view,'composing',{configurable:true,value:true});
 fireEvent.click(toggle);expect(toggle.getAttribute('aria-expanded')).toBe('true');
 Object.defineProperty(editor.view,'composing',{configurable:true,value:false});
 expect(field.querySelector('[hidden]')).toBeNull();expect(change).not.toHaveBeenCalled();
});
it('resets folds when replacing the note from outside the editor',async()=>{
 const change=vi.fn();
 const props={disabled:false,notePath:'notes/a.md',onChange:change,onSave:vi.fn(),onError:vi.fn()};
 const {rerender}=render(<RichMarkdownEditor {...props} value={'## 标题\n\n正文'} />);
 const field=await screen.findByRole('textbox',{name:'笔记内容'});
 fireEvent.click(await screen.findByRole('button',{name:'收起“标题”章节'}));
 rerender(<RichMarkdownEditor {...props} notePath="notes/b.md" value={'## 新标题\n\n新正文'} />);
 expect(field.querySelector('[hidden]')).toBeNull();
 expect(await screen.findByRole('button',{name:'收起“新标题”章节'})).toBeTruthy();
 expect(change).not.toHaveBeenCalled();
});
it('guards command-enter during composition',async()=>{
 const {field,save}=await setup('正文');
 fireEvent.keyDown(field,{key:'Enter',metaKey:true,isComposing:true});expect(save).not.toHaveBeenCalled();
 fireEvent.keyDown(field,{key:'Enter',metaKey:true});expect(save).toHaveBeenCalledOnce();
});
it('weakens block controls while typing and restores them on pointer movement or menu opening',async()=>{
 const {editor,field}=await setup('正文');
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue(null);
 const root=field.closest('.rich-editor')!;
 fireEvent.input(field);expect(root.getAttribute('data-typing')).toBe('true');
 fireEvent.mouseMove(field);expect(root.hasAttribute('data-typing')).toBe(false);
 fireEvent.input(field);fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(root.getAttribute('data-menu-open')).toBe('true');
 vi.restoreAllMocks();
});
it('enters one trailing empty paragraph from blank page space without stealing interactive clicks',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond',{},true);
 const surface=field.closest('.note-page-scroll')!;
 vi.spyOn(field,'getBoundingClientRect').mockReturnValue(new DOMRect(100,100,720,240));
 act(()=>{editor.commands.setTextSelection(2);});
 fireEvent.click(surface,{clientX:200,clientY:500});
 await waitFor(()=>expect(document.activeElement).toBe(field));
 expect(editor.state.selection.from).toBe(editor.state.doc.content.size-1);
 expect(editor.state.doc.childCount).toBe(3);
 expect(editor.state.doc.lastChild?.type.name).toBe('paragraph');
 expect(editor.state.doc.lastChild?.content.size).toBe(0);
 expect(change).toHaveBeenCalledTimes(1);
 const after=editor.getJSON();
 for(let i=0;i<3;i++) fireEvent.click(surface,{clientX:200,clientY:500});
 expect(editor.getJSON()).toEqual(after);expect(change).toHaveBeenCalledTimes(1);
 const button=screen.getByRole('button',{name:'其他操作'});
 act(()=>{editor.commands.setTextSelection(2);});
 fireEvent.click(button,{clientX:200,clientY:500});
 fireEvent.click(surface,{clientX:50,clientY:500});
 expect(editor.state.selection.from).toBe(2);
 Object.defineProperty(editor.view,'composing',{configurable:true,value:true});
 fireEvent.click(surface,{clientX:200,clientY:500});expect(editor.state.selection.from).toBe(2);
 Object.defineProperty(editor.view,'composing',{configurable:true,value:false});
 act(()=>{editor.commands.undo();});
 expect(editor.getText()).toBe('first\n\nsecond');expect(editor.state.doc.childCount).toBe(2);
 vi.restoreAllMocks();
});
it.each(['','first'])('reuses an existing empty last paragraph after %j without writing',async value=>{
 const {editor,field,change}=await setup(value,{},true);
 if(value) act(()=>{editor.commands.insertContentAt(editor.state.doc.content.size,{type:'paragraph'});});
 change.mockClear();
 const before=editor.getJSON(),surface=field.closest('.note-page-scroll')!;
 vi.spyOn(field,'getBoundingClientRect').mockReturnValue(new DOMRect(100,100,720,26));
 for(let i=0;i<3;i++) fireEvent.click(surface,{clientX:200,clientY:150});
 await waitFor(()=>expect(document.activeElement).toBe(field));
 expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
 expect(editor.state.selection.from).toBe(editor.state.doc.content.size-1);
 expect(editor.getJSON()).toEqual(before);expect(change).not.toHaveBeenCalled();
 vi.restoreAllMocks();
});
it.each(['first\n\n- item','first\n\n```\ncode\n```','first\n\n---'])('continues outside the final block in %j',async value=>{
 const {editor,field,change}=await setup(value,{},true);
 const before=editor.getJSON(),surface=field.closest('.note-page-scroll')!;
 vi.spyOn(field,'getBoundingClientRect').mockReturnValue(new DOMRect(100,100,720,100));
 fireEvent.click(surface,{clientX:200,clientY:250});
 expect(editor.state.selection.$from.depth).toBe(1);
 expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
 expect(editor.state.selection.$from.parent.content.size).toBe(0);
 expect(editor.getJSON().content?.slice(0,-1)).toEqual(before.content);
 const after=editor.getJSON();fireEvent.click(surface,{clientX:200,clientY:250});
 expect(editor.getJSON()).toEqual(after);expect(change).toHaveBeenCalledTimes(1);
 vi.restoreAllMocks();
});
it('does not focus blank page space in a read-only editor',async()=>{
 const {editor,field}=await setup('正文',{disabled:true},true);
 const surface=field.closest('.note-page-scroll')!;
 vi.spyOn(field,'getBoundingClientRect').mockReturnValue(new DOMRect(100,100,720,240));
 const focus=vi.spyOn(editor.commands,'focus');
 fireEvent.click(surface,{clientX:200,clientY:500});expect(focus).not.toHaveBeenCalled();
 vi.restoreAllMocks();
});
it('keeps task node views matched to the inline layout when toggled and edited',async()=>{
 const {editor,field,change}=await setup('正文\n\n- [ ] 第一条待办\n  - [ ] 嵌套待办');
 expect(field.querySelectorAll('li[data-type="taskItem"]')).toHaveLength(2);
 fireEvent.click(screen.getByRole('checkbox',{name:'待办：第一条待办嵌套待办'}));
 expect(field.querySelector('li[data-type="taskItem"]')?.getAttribute('data-checked')).toBe('true');
 expect(change).toHaveBeenLastCalledWith('正文\n\n- [x] 第一条待办\n  - [ ] 嵌套待办');
 let position=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='paragraph'&&node.textContent==='嵌套待办')position=pos+1;});
 act(()=>{editor.commands.insertContentAt(position,'新');});
 expect(field.querySelectorAll('li[data-type="taskItem"]')).toHaveLength(2);
 expect(screen.getByRole('checkbox',{name:'待办：新嵌套待办'})).toBeTruthy();
});
it('uses a single block handle with keyboard access to insertion',async()=>{
 const {editor,field}=await setup('正文');
 expect(field.closest('.rich-editor')!.querySelectorAll('.block-controls button')).toHaveLength(1);
 expect(screen.queryByRole('button',{name:'插入内容块'})).toBeNull();
 const grip=screen.getByRole('button',{name:'内容块操作'});
 expect(grip.querySelector('svg')?.getAttribute('width')).toBe('16');
 expect(grip.querySelector('svg')?.getAttribute('height')).toBe('16');
 expect(grip.getAttribute('draggable')).toBe('true');
 fireEvent.keyDown(grip,{key:'ArrowDown'});
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'待办事项'}));
 expect(editor.state.doc.firstChild?.textContent).toBe('正文');
 expect(editor.state.doc.lastChild?.type.name).toBe('taskList');
});
it('does not open a block menu or move the caret during composition',async()=>{
 const {editor,change}=await setup('first\n\nsecond');
 act(()=>{editor.commands.setTextSelection(3);});
 Object.defineProperty(editor.view,'composing',{configurable:true,value:true});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(screen.queryByRole('menu')).toBeNull();
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.empty).toBe(true);
 expect(change).not.toHaveBeenCalled();
 Object.defineProperty(editor.view,'composing',{configurable:true,value:false});
});
it.each(['Escape','dragEnd','blur','hidden'])('restores the original text range when dragging is cancelled by %s',async reason=>{
 const {editor,field,change}=await setup('first\n\nsecond');
 act(()=>{editor.commands.setTextSelection({from:2,to:4});});
 const selection=editor.state.selection.toJSON(),root=field.closest('.rich-editor')!;
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:8,inside:7});
 vi.spyOn(editor.view.nodeDOM(7) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,40,200,30));
 const grip=screen.getByRole('button',{name:'内容块操作'});
 fireEvent.dragStart(grip,{dataTransfer:transfer});fireEvent.dragOver(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(root.querySelector('.block-drop-indicator')).toBeTruthy();
 if(reason==='Escape')fireEvent.keyDown(root,{key:'Escape'});
 else if(reason==='dragEnd')fireEvent.dragEnd(grip);
 else if(reason==='blur')fireEvent.blur(window);
 else {vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');fireEvent(document,new Event('visibilitychange'));}
 expect(editor.state.selection.toJSON()).toEqual(selection);
 expect(root.querySelector('.block-drop-indicator')).toBeNull();expect(editor.view.dragging).toBeNull();
 expect(change).not.toHaveBeenCalled();
 fireEvent.dragEnd(grip);
 vi.restoreAllMocks();
});
it('does not restore a stale drag selection after the document changes',async()=>{
 const {editor,field}=await setup('first\n\nsecond');
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});
 act(()=>{editor.commands.insertContentAt(2,'new');editor.commands.setTextSelection(5);});
 const selection=editor.state.selection.toJSON();
 fireEvent.keyDown(field.closest('.rich-editor')!,{key:'Escape'});
 expect(editor.state.selection.toJSON()).toEqual(selection);expect(editor.getText()).toContain('fnewirst');
 fireEvent.dragEnd(screen.getByRole('button',{name:'内容块操作'}));
});
it('opens the insertion menu and creates a directly editable table',async()=>{
 const {editor,field}=await setup('正文');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'表格'}));
 expect(field.querySelectorAll('td')).toHaveLength(6);
 let position=0;editor.state.doc.descendants((node,pos)=>{if(!position&&node.type.name==='tableCell')position=pos+2;});
 act(()=>{editor.commands.insertContentAt(position,'单元格');});
 expect(field.querySelector('td')?.textContent).toBe('单元格');
});
it('edits formulas with a live rendered preview and saves Markdown',async()=>{
 const {field,change}=await setup('正文\n\n$x^2$');
 fireEvent.click(await screen.findByRole('button',{name:'编辑行内公式'}));
 const input=screen.getByRole('textbox',{name:'公式表达式'});
 fireEvent.change(input,{target:{value:'x^3'}});expect(screen.queryByRole('dialog')).toBeNull();expect(field.querySelector('math')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'应用公式'}));
 expect(change).toHaveBeenLastCalledWith('正文\n\n$x^3$');
});
it('round-trips guide inline styles and both formulas without rewriting its table or code block',async()=>{
 const table='| 功能 | 状态 |\n| :--- | ---: |\n| 渲染 | 完整 |';
 const code='```typescript\nconst literal = "*text* ~~text~~ $x$";\n```';
 const value='正文\n\n**加粗**、*斜体 (Italic)*、~~删除线 (Strikethrough)~~、`行内代码 (Inline Code)`。\n\n行内公式：$e^{i\\pi} + 1 = 0$\n\n$$\nI = \\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n$$\n\n'+table+'\n\n'+code;
 const {editor,field,change}=await setup(value);
 expect(field.querySelector('em')?.textContent).toBe('斜体 (Italic)');
 expect(field.querySelector('s')?.textContent).toBe('删除线 (Strikethrough)');
 expect(field.querySelector('p > code')?.textContent).toBe('行内代码 (Inline Code)');
 expect(field.querySelectorAll('math')).toHaveLength(2);
 for(const target of ['斜体 (Italic)','删除线 (Strikethrough)','行内代码 (Inline Code)']){
  let pos=0;editor.state.doc.descendants((node,at)=>{if(node.isText&&node.text===target)pos=at+1;});
  act(()=>{editor.commands.insertContentAt(pos,'新');});
 }
 fireEvent.click(screen.getByRole('button',{name:'编辑行内公式'}));
 fireEvent.change(screen.getByRole('textbox',{name:'公式表达式'}),{target:{value:'e^{i \\pi} + 1 = 0'}});
 fireEvent.click(screen.getByRole('button',{name:'应用公式'}));
 fireEvent.click(screen.getByRole('button',{name:'编辑块公式'}));
 fireEvent.change(screen.getByRole('textbox',{name:'公式表达式'}),{target:{value:'I = \\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}'}});
 fireEvent.click(screen.getByRole('button',{name:'应用公式'}));
 const saved=change.mock.lastCall![0] as string;
 expect(saved).toContain(table);expect(saved).toContain(code);
 cleanup();const reopened=await setup(saved);
 expect(reopened.field.querySelector('em')?.textContent).toBe('斜新体 (Italic)');
 expect(reopened.field.querySelector('s')?.textContent).toBe('删新除线 (Strikethrough)');
 expect(reopened.field.querySelector('p > code')?.textContent).toBe('行新内代码 (Inline Code)');
 expect(reopened.field.querySelectorAll('math')).toHaveLength(2);
 expect(reopened.field.querySelector('.katex-error')).toBeNull();
 expect(saved).toContain('e^{i \\pi} + 1 = 0');expect(saved).toContain('e^{-x^2}\\,dx');
});
it('inserts a block after its source and undoes insertion in one step',async()=>{
 const {editor,change}=await setup('正文');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'表格'}));
 act(()=>{editor.commands.undo();});
 expect(change).toHaveBeenLastCalledWith('正文');expect(editor.view.dom.querySelector('table')).toBeNull();
});
it('uses an unselected content copy for dragging and removes it on cancellation',async()=>{
 const {editor,field,change}=await setup('first #工作\n\nsecond');
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 const grip=screen.getByRole('button',{name:'内容块操作'});
 fireEvent.dragStart(grip,{dataTransfer:transfer});
 expect(field.closest('.rich-editor')!.getAttribute('data-dragging')).toBe('true');
 const preview=transfer.setDragImage.mock.calls[0]?.[0] as HTMLElement;
 expect(preview).not.toBe(editor.view.nodeDOM(0));
 expect(preview.classList.contains('block-drag-preview')).toBe(true);
 expect(preview.isConnected).toBe(true);
 expect(preview.textContent).toBe('first #工作');
 expect(preview.querySelector('.rich-inline-tag')?.textContent).toBe('#工作');
 expect(preview.querySelector('.rich-selected-block, .ProseMirror-selectednode')).toBeNull();
 expect(field.querySelector('.rich-selected-block, .ProseMirror-selectednode')).toBeTruthy();
 fireEvent.keyDown(field.closest('.rich-editor')!,{key:'Escape'});
 expect(field.closest('.rich-editor')!.hasAttribute('data-dragging')).toBe(false);
 expect(preview.isConnected).toBe(false);
 expect(change).not.toHaveBeenCalled();
 fireEvent.dragEnd(grip);
 expect(document.querySelector('.block-drag-preview')).toBeNull();
});
it('moves a block by handle and cancels a later drag without changing content',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond');
 const root=field.closest('.rich-editor')!;
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:8,inside:7});
 vi.spyOn(editor.view.nodeDOM(7) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,40,200,30));
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});
 expect(transfer.setData).toHaveBeenCalledWith('text/plain','first');
 // The pointer crosses the midpoint after the last dragover. Drop must use its own coordinates.
 fireEvent.dragOver(root,{dataTransfer:transfer,clientX:100,clientY:45});
 expect(root.querySelector('.block-drop-indicator')).toBeNull(); // Before the next sibling is a no-op.
 fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).toHaveBeenLastCalledWith('second\n\nfirst');
 expect(root.querySelector('.block-drag-preview')).toBeNull();
 expect(root.hasAttribute('data-dragging')).toBe(false);
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('first\n\nsecond');
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});
 fireEvent.keyDown(root,{key:'Escape'});
 fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).toHaveBeenLastCalledWith('first\n\nsecond');expect(root.querySelector('.block-drop-indicator')).toBeNull();
});
it('moves peer sections from the heading menu with one-step undo and redo',async()=>{
 const original='## 标题 A\n\n正文 A\n\n### 子标题\n\n子正文\n\n## 标题 B\n\n正文 B';
 const moved='## 标题 B\n\n正文 B\n\n## 标题 A\n\n正文 A\n\n### 子标题\n\n子正文';
 const {editor,change}=await setup(original);
 await waitFor(()=>expect(screen.getByRole('button',{name:'内容块操作'}).title).toContain('移动标题'));
 expect(screen.getByRole('button',{name:'内容块操作'}).title).toContain('Option/Alt');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(screen.getByRole('status').textContent).toContain('章节移动包含 4 个块');
 expect(screen.getByRole('menuitem',{name:'上移章节'}).getAttribute('aria-disabled')).toBe('true');
 fireEvent.click(screen.getByRole('menuitem',{name:'下移章节'}));
 expect(change).toHaveBeenLastCalledWith(moved);
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith(original);
 act(()=>{editor.commands.redo();});expect(change).toHaveBeenLastCalledWith(moved);
});
it('opens conversion by keyboard, returns with ArrowLeft and converts with one-step undo',async()=>{
 const {editor,field,change}=await setup('正文',{autoFocus:false});
 const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'内容块操作'}));
 const trigger=screen.getByRole('menuitem',{name:'转换为'});
 trigger.focus();await user.keyboard('{ArrowRight}');
 expect(await screen.findByRole('menu',{name:'转换为'})).toBeTruthy();
 expect(screen.getByRole('menuitem',{name:'文本'}).querySelector('[aria-label="当前类型"]')).toBeTruthy();
 expect(screen.getByRole('menuitem',{name:'标题 6'})).toBeTruthy();
 expect(change).not.toHaveBeenCalled();
 await user.keyboard('{ArrowLeft}');
 expect(screen.queryByRole('menu',{name:'转换为'})).toBeNull();
 expect(screen.getByRole('menu',{name:'内容块操作菜单'})).toBeTruthy();expect(document.activeElement).toBe(trigger);
 await user.keyboard('{ArrowRight}');
 fireEvent.click(await screen.findByRole('menuitem',{name:'标题 6'}));
 expect(field.querySelector('h6')?.textContent).toBe('正文');expect(change).toHaveBeenLastCalledWith('###### 正文');
 expect(screen.queryByRole('menu')).toBeNull();
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('正文');
});
it('inserts below from the block menu without replacing the selected content',async()=>{
 const {editor,change}=await setup('first\n\nsecond');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 expect(await screen.findByRole('menu',{name:'插入内容块菜单'})).toBeTruthy();
 fireEvent.click(screen.getByRole('menuitem',{name:'一级标题'}));
 expect(editor.state.doc.child(0).textContent).toBe('first');expect(editor.state.doc.child(1).type.name).toBe('heading');expect(editor.state.doc.child(2).textContent).toBe('second');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('first\n\nsecond');
});
it('keeps the block menu focused on block operations without an advanced format entry',async()=>{
 await setup('正文',{autoFocus:false});
 const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(screen.queryByRole('menuitem',{name:'块属性与更多操作'})).toBeNull();
 expect(screen.queryByRole('button',{name:'更多格式'})).toBeNull();
 expect(screen.getAllByRole('menuitem').map(item=>item.textContent)).toEqual(['转换为','在下方插入','复制','上移','下移','删除']);
});
it.each(['mouse','keyboard'])('opens link properties by %s and cancels without writing or losing selection',async activation=>{
 const {editor,field,change}=await setup('正文',{autoFocus:false});
 const user=userEvent.setup();
 act(()=>{editor.commands.setTextSelection({from:1,to:3});});
 await user.click(screen.getByRole('button',{name:'更多格式'}));
 const editLink=await screen.findByRole('button',{name:'编辑链接'});
 if(activation==='mouse')await user.click(editLink);else{editLink.focus();await user.keyboard('{Enter}');}
 const dialog=await screen.findByRole('dialog',{name:'编辑链接'});
 await waitFor(()=>expect(document.querySelector('.rich-format-menu')).toBeNull());
 await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 expect(dialog.contains(document.activeElement)).toBe(true);
 await user.keyboard('{Tab}');
 await user.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'编辑链接'})).toBeNull());
 await waitFor(()=>expect(document.activeElement).toBe(field));
 expect(editor.state.selection.from).toBe(1);expect(editor.state.selection.to).toBe(3);
 expect(change).not.toHaveBeenCalled();
});
it('converts a code block back to text and deletes a block with undo',async()=>{
 const {editor,field,change}=await setup('正文',{autoFocus:false});const user=userEvent.setup();
 await user.click(screen.getByRole('button',{name:'内容块操作'}));screen.getByRole('menuitem',{name:'转换为'}).focus();await user.keyboard('{ArrowRight}');
 fireEvent.click(await screen.findByRole('menuitem',{name:'代码'}));expect(field.querySelector('pre')).toBeTruthy();await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 await user.click(screen.getByRole('button',{name:'内容块操作'}));screen.getByRole('menuitem',{name:'转换为'}).focus();await user.keyboard('{ArrowRight}');
 expect(editor.state.doc.firstChild?.type.name).toBe('codeBlock');
 expect(screen.getByRole('menuitem',{name:'代码'}).querySelector('[aria-label="当前类型"]')).toBeTruthy();
 fireEvent.click(await screen.findByRole('menuitem',{name:'文本'}));expect(field.querySelector('pre')).toBeNull();expect(editor.getText()).toBe('正文');await act(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));
 await user.click(screen.getByRole('button',{name:'内容块操作'}));await user.click(screen.getByRole('menuitem',{name:'删除'}));
 expect(editor.getText()).toBe('');act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('正文');
});
it('drags only the heading by default, leaving its body and neighbors in place',async()=>{
 const original='## 标题\n\n- [ ] first\n- [ ] second\n\nend';
 const {editor,field,change}=await setup(original),root=field.closest('.rich-editor')!;
 let last=0;editor.state.doc.forEach((_node,pos)=>{last=pos;});
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:last+1,inside:last});
 vi.spyOn(editor.view.nodeDOM(last) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,40,200,30));
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});
 expect(transfer.setData).toHaveBeenCalledWith('text/plain','标题');
 expect(editor.state.selection.to).toBe(editor.state.doc.firstChild!.nodeSize);
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);
 expect(field.querySelector('.ProseMirror-selectednode')?.tagName).toBe('H2');
 fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).toHaveBeenLastCalledWith('- [ ] first\n- [ ] second\n\nend\n\n## 标题');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith(original);
});
it('drags an explicitly selected heading range without including unselected followers',async()=>{
 const {editor,field,change}=await setup('## 标题\n\nselected\n\nother');
 act(()=>{editor.commands.setNodeSelection(0);});fireEvent.keyDown(field,{key:'ArrowDown',shiftKey:true});
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 const grip=screen.getByRole('button',{name:'内容块操作'});
 fireEvent.dragStart(grip,{dataTransfer:transfer});expect(transfer.setData).toHaveBeenCalledWith('text/plain','标题\n\nselected');
 expect([...field.querySelectorAll('.rich-selected-block')].map(node=>node.textContent)).toEqual(['标题','selected']);
 fireEvent.dragEnd(grip);expect(change).not.toHaveBeenCalled();
});
it('drags a heading section with its body using Option/Alt and cancels without changing Markdown',async()=>{
 const original='## 标题 A\n\n正文 A\n\n## 标题 B\n\n正文 B';
 const {editor,field,change}=await setup(original),root=field.closest('.rich-editor')!;
 let last=0;editor.state.doc.forEach((_node,pos)=>{last=pos;});
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:last+1,inside:last});
 vi.spyOn(editor.view.nodeDOM(last) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,40,200,30));
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 const grip=screen.getByRole('button',{name:'内容块操作'});
 fireEvent.dragStart(grip,{dataTransfer:transfer,altKey:true});expect(transfer.setData).toHaveBeenCalledWith('text/plain','标题 A\n\n正文 A');
 fireEvent.keyDown(root,{key:'Escape'});fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).not.toHaveBeenCalled();
 act(()=>{editor.commands.setTextSelection(1);});
 fireEvent.dragStart(grip,{dataTransfer:transfer,altKey:true});fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).toHaveBeenLastCalledWith('## 标题 B\n\n正文 B\n\n## 标题 A\n\n正文 A');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith(original);
});
it('uses Option/Alt dragging to move a complete list instead of one item',async()=>{
 const original='intro\n\n- first\n  - child\n- second\n\nafter';
 const {editor,field,change}=await setup(original),root=field.closest('.rich-editor')!;
 let item=0,last=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='listItem'&&node.textContent==='second')item=pos;});
 editor.state.doc.forEach((_node,pos)=>{last=pos;});act(()=>{editor.commands.setTextSelection(item+2);});
 const grip=screen.getByRole('button',{name:'内容块操作'});expect(grip.title).toContain('Option/Alt');
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:last+1,inside:last});
 vi.spyOn(editor.view.nodeDOM(last) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,40,200,30));
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(grip,{dataTransfer:transfer,altKey:true});
 expect(editor.state.selection.from).toBe(editor.state.doc.firstChild!.nodeSize);
 expect(transfer.setData).toHaveBeenCalledWith('text/plain','firstchildsecond');
 fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).toHaveBeenLastCalledWith('intro\n\nafter\n\n- first\n  - child\n- second');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith(original);
});
it('drops a top-level section beside a list instead of inside its nested items',async()=>{
 const {editor,field,change}=await setup('## 标题 A\n\nBody A\n\n## 标题 B\n\n- Other\n  - Child');
 let item=0,list=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='listItem'&&node.textContent==='Child')item=pos;});
 editor.state.doc.forEach((node,pos)=>{if(node.type.name==='bulletList')list=pos;});
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:item+2,inside:item});
 vi.spyOn(editor.view.nodeDOM(list) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,40,200,60));
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer,altKey:true});
 fireEvent.drop(field.closest('.rich-editor')!,{dataTransfer:transfer,clientX:100,clientY:90});
 expect(change).toHaveBeenLastCalledWith('## 标题 B\n\n- Other\n  - Child\n\n## 标题 A\n\nBody A');editor.state.doc.check();
});
it('keeps cancelled slash commands as text and supports keyboard insertion',async()=>{
 const {editor,field}=await setup('正文');
 act(()=>{editor.commands.setContent('/二级',{contentType:'markdown'});});
 fireEvent.keyDown(field,{key:'Enter'});expect(field.querySelector('h2')).toBeTruthy();
 act(()=>{editor.commands.setContent('/文本',{contentType:'markdown'});});
 fireEvent.keyDown(field,{key:'Escape'});expect(screen.queryByRole('menu')).toBeNull();
 fireEvent.keyDown(field,{key:'Enter'});expect(editor.state.doc.childCount).toBe(2);
});
it('creates and removes a link through properties without losing selected text',async()=>{
 const {editor,field,change}=await setup('正文');
 act(()=>{editor.commands.setTextSelection({from:1,to:3});});
 fireEvent.click(screen.getByRole('button',{name:'更多格式'}));fireEvent.click(screen.getByRole('button',{name:'编辑链接'}));
 fireEvent.change(screen.getByRole('textbox',{name:'链接地址'}),{target:{value:'https://example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'保存'}));
 expect(field.querySelector('a')?.getAttribute('href')).toContain('https://example.com');
 expect(change).toHaveBeenLastCalledWith('[正文](https://example.com)');
 act(()=>{editor.commands.setTextSelection({from:1,to:3});});
 fireEvent.click(screen.getByRole('button',{name:'更多格式'}));fireEvent.click(screen.getByRole('button',{name:'移除链接'}));
 expect(change).toHaveBeenLastCalledWith('正文');
});
it('round-trips guide links, task states and footnote content through edits',async()=>{
 const value='正文\n\n这是一个[外部链接](https://google.com)。\n\n[内部链接](other.md)\n\n- [x] 已完成的任务\n- [ ] 待完成的任务\n- [ ] 正在进行中的任务\n\n这是带有脚注的句子 [^1]。\n\n[^1]: 这是脚注的内容。';
 const {editor,field,change}=await setup(value);
 expect([...field.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toEqual(['https://google.com','other.md']);
 expect(field.querySelectorAll('[data-footnote]')).toHaveLength(1);
 fireEvent.click(screen.getByRole('checkbox',{name:'待办：待完成的任务'}));
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.isText&&node.text==='这是脚注的内容。')pos=at+2;});
 act(()=>{editor.commands.insertContentAt(pos,'新');});
 const saved=change.mock.lastCall![0] as string;
 expect(saved).toContain('[外部链接](https://google.com)');expect(saved).toContain('[内部链接](other.md)');
 expect(saved).toContain('- [x] 待完成的任务');expect(saved).toContain('[^1]: 这是新脚注的内容。');
 cleanup();const reopened=await setup(saved);
 expect([...reopened.field.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map(c=>c.checked)).toEqual([true,true,false]);
 expect(reopened.field.querySelector('[data-footnote-definition="1"]')?.textContent).toBe('这是新脚注的内容。');
 expect(reopened.field.querySelector('[data-footnote="1"]')?.textContent).toBe('1');
 expect([...reopened.field.querySelectorAll('a')].map(a=>a.getAttribute('href'))).toEqual(['https://google.com','other.md']);
});
it.each([
 '<!-- original -->',
 '正文[^a]\n\n[^a]: first\n\n    second',
 '![描述](../assets/old.png)',
 '<details><summary>展开内容</summary><p>保留正文</p></details>',
 '<dl><dt>术语</dt><dd><p>释义</p></dd></dl>',
])('preserves existing advanced Markdown after removing its block-menu controls: %s',async content=>{
 const source=`# 标题\n\n${content}\n\n末尾`;
 const {editor,change}=await setup(source);
 expect(change).not.toHaveBeenCalled();
 act(()=>{editor.commands.insertContentAt(editor.state.doc.content.size-1,'新');});
 expect(change).toHaveBeenLastCalledWith(`${source}新`);
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith(source);
});
it('suggests existing tags and confirms them without inserting a paragraph', async () => {
 const { request } = await import('./bridge');
 vi.mocked(request).mockResolvedValue({ tags: [{ name: '工作/项目' }] });
 const { editor, field, change } = await setup('正文');
 // Settle listTags and its keyboard-listener effect before sending Enter.
 await act(async () => { editor.chain().setTextSelection(3).insertContent(' #工').run(); });
 await screen.findByRole('button', { name: '#工作/项目' });
 fireEvent.keyDown(field, { key: 'Enter' });
 expect(editor.getText()).toBe('正文 #工作/项目 ');
 expect(change).toHaveBeenLastCalledWith('正文 #工作/项目 ');
 expect(screen.queryByRole('group', { name: '标签建议' })).toBeNull();
});
it('keeps a leading hashtag as tag syntax rather than a Markdown heading', async () => {
 const { editor, change } = await setup('');
 act(() => { editor.commands.insertContent({ type: 'text', text: '#工作/项目 ' }); });
 expect(change).toHaveBeenLastCalledWith('#工作/项目 ');
});
it.each(['#/事实上', '#//', '#work//design'])('keeps malformed tag %s as plain text without suggestions', async text => {
 const {editor,field}=await setup('正文');
 act(()=>{editor.chain().setTextSelection(3).insertContent(` ${text}`).run();});
 expect(editor.getText()).toBe(`正文 ${text}`);
 expect(screen.queryByRole('group',{name:'标签建议'})).toBeNull();
 expect(field.querySelector('.rich-inline-tag')).toBeNull();
});
it('keeps suggestions while entering a nested tag after its slash', async () => {
 const {request}=await import('./bridge');
 vi.mocked(request).mockResolvedValue({tags:[{name:'work/design'}]});
 const {editor,field}=await setup('正文');
 act(()=>{editor.chain().setTextSelection(3).insertContent(' #work/').run();});
 await screen.findByRole('button',{name:'#work/design'});
 act(()=>{editor.commands.insertContent('/');});
 expect(screen.queryByRole('group',{name:'标签建议'})).toBeNull();
 expect(editor.getText()).toBe('正文 #work//');
 fireEvent.keyDown(field,{key:'Enter'});
 expect(editor.getText()).not.toContain('#work/design');
});
it('only exposes advanced formatting through a text selection', async () => {
 const { editor, field } = await setup('正文');
 expect(screen.queryByRole('button', { name: '格式与属性' })).toBeNull();
 expect(screen.queryByRole('button', { name: '更多格式' })).toBeNull();
 act(() => { editor.commands.setTextSelection({ from: 1, to: 3 }); });
 fireEvent.click(screen.getByRole('button', { name: '更多格式' }));
 expect(screen.getByRole('dialog',{name:'更多格式'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button', { name: '更多格式' }));
 fireEvent.click(screen.getByRole('button', { name: '高亮' }));
 expect(field.querySelector('mark')?.textContent).toBe('正文');
});

it('styles editable inline tags without changing source and excludes code and links', async () => {
 const {editor,field,change}=await setup('正文 #测试/笔记\n\n`#代码` [#链接](https://example.com)\n\n```\n#围栏\n```');
 expect([...field.querySelectorAll('.rich-inline-tag')].map(el=>el.textContent)).toEqual(['#测试/笔记']);
 expect(change).not.toHaveBeenCalled();
 act(()=>{editor.commands.setContent('正文 #新标签', {contentType:'markdown'});});
 expect(field.querySelector('.rich-inline-tag')?.textContent).toBe('#新标签');
 expect(change).toHaveBeenLastCalledWith('正文 #新标签');
});
it('uses lowercase tag identities while retaining mixed-case body text', async () => {
 const {field,change}=await setup('正文 #Work #work #WORK/Design');
 expect([...field.querySelectorAll('.rich-inline-tag')].map(el=>[el.textContent,el.getAttribute('data-tag')])).toEqual([['#Work','work'],['#work','work'],['#WORK/Design','work%2Fdesign']]);
 expect(change).not.toHaveBeenCalled();
});
it('lowercases newly typed tags without rewriting untouched tags and keeps undo atomic', async () => {
 const {editor,field,change}=await setup('正文 #Legacy');
 act(()=>{editor.commands.insertContentAt(editor.state.doc.content.size-1,{type:'text',text:' #Work/Design '});});
 expect(editor.getText()).toBe('正文 #Legacy #work/design ');
 expect(change).toHaveBeenLastCalledWith('正文 #Legacy #work/design ');
 expect(field.querySelectorAll('.rich-inline-tag')[1].textContent).toBe('#work/design');
 act(()=>{editor.commands.undo();});
 expect(editor.getText()).toBe('正文 #Legacy');
 act(()=>{editor.commands.redo();});
 expect(editor.getText()).toBe('正文 #Legacy #work/design ');
});
it('lowercases an edited existing tag while preserving the cursor and surrounding text', async () => {
 const {editor}=await setup('正文 #Work 尾部');
 act(()=>{editor.chain().setTextSelection(7).insertContent('X').run();});
 expect(editor.getText()).toBe('正文 #woxrk 尾部');
 expect(editor.state.selection.from).toBe(8);
});
it('lowercases pasted tags but preserves code, links and Markdown headings', async () => {
 const {editor,change}=await setup('正文');
 act(()=>{editor.commands.setContent('正文 #Work #WORK/Design\n\n`#CODE` [#LINK](https://example.com)\n\n```\n#FENCED\n```\n\n# Heading',{contentType:'markdown'});});
 expect(change).toHaveBeenLastCalledWith('正文 #work #work/design\n\n`#CODE` [#LINK](https://example.com)\n\n```\n#FENCED\n```\n\n# Heading');
});
it('defers tag casing until composition ends', async () => {
 const {editor,field,change}=await setup('正文');
 fireEvent.compositionStart(field);
 act(()=>{editor.commands.insertContentAt(3,{type:'text',text:' #WORK中文'});});
 expect(editor.getText()).toBe('正文 #WORK中文');
 await act(async()=>{fireEvent.compositionEnd(field); await Promise.resolve();});
 expect(editor.getText()).toBe('正文 #work中文');
 expect(change).toHaveBeenLastCalledWith('正文 #work中文');
});
it('matches and chooses lowercase suggestions from an existing uppercase tag', async () => {
 const {request}=await import('./bridge');
 vi.mocked(request).mockResolvedValue({tags:[{name:'Work/Design'},{name:'WORK/DESIGN'}]});
 const {editor}=await setup('正文 #Wo');
 act(()=>{editor.commands.setTextSelection(editor.state.doc.content.size-1);});
 const suggestion=await screen.findByRole('button',{name:'#work/design'});
 expect(screen.getAllByRole('button',{name:'#work/design'})).toHaveLength(1);
 fireEvent.click(suggestion);
 expect(editor.getText()).toBe('正文 #work/design ');
});
it('keeps tag paragraph styles stable and preserves their Markdown on edit and undo', async () => {
 const source='正文 #工作\n\n#工作/设计 #生活\n\n`#代码`\n\n[#链接](https://example.com)\n\n#123';
 const {editor,field,change}=await setup(source);
 const paragraphClasses=[...field.querySelectorAll('p')].map(el=>el.className);
 expect(field.querySelector('.rich-tag-line')).toBeNull();
 expect([...field.querySelectorAll('.rich-inline-tag')].map(el=>el.textContent)).toEqual(['#工作','#工作/设计','#生活']);
 expect(change).not.toHaveBeenCalled();
 act(()=>{editor.commands.insertContentAt(editor.state.doc.firstChild!.nodeSize+1,'记录 ');});
 expect(field.querySelector('.rich-tag-line')).toBeNull();
 expect([...field.querySelectorAll('p')].map(el=>el.className)).toEqual(paragraphClasses);
 expect(change).toHaveBeenLastCalledWith(source.replace('#工作/设计','记录 #工作/设计'));
 act(()=>{editor.commands.undo();});
 expect(field.querySelector('.rich-tag-line')).toBeNull();
 expect([...field.querySelectorAll('p')].map(el=>el.className)).toEqual(paragraphClasses);
 expect(change).toHaveBeenLastCalledWith(source);
});

it('groups the compact insert menu and finds low-frequency formats by aliases', async () => {
 const {editor}=await setup('正文');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 expect(screen.getByText('基本区块')).toBeTruthy();
 expect(screen.getByText('其他内容')).toBeTruthy();
 expect(screen.queryByRole('menuitem',{name:'四级标题'})).toBeNull();
 expect(screen.queryByRole('menuitem',{name:'行内公式'})).toBeNull();
 const input=screen.getByRole('textbox',{name:'筛选内容块'});
 fireEvent.change(input,{target:{value:' H4 '}});
 expect(screen.getByRole('menuitem',{name:'四级标题'})).toBeTruthy();
 fireEvent.keyDown(input,{key:'Enter',isComposing:true});
 expect(screen.getByRole('menu')).toBeTruthy();
 fireEvent.keyDown(input,{key:'Enter'});
 expect(editor.state.doc.lastChild?.type.name).toBe('heading');
 expect(editor.state.doc.lastChild?.attrs.level).toBe(4);
});
it('keeps filtering focus while navigating and handles empty results', async () => {
 await setup('正文');fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 const input=screen.getByRole('textbox',{name:'筛选内容块'}); input.focus();
 fireEvent.keyDown(input,{key:'ArrowDown'});
 expect(document.activeElement).toBe(input);
 expect(screen.getByRole('menuitem',{name:'一级标题'}).getAttribute('data-active')).toBe('true');
 fireEvent.change(input,{target:{value:'no-such-block'}});
 expect(screen.getByRole('status').textContent).toBe('未找到匹配的内容块');
 fireEvent.keyDown(input,{key:'Enter'});expect(screen.getByRole('menu')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'关闭菜单esc'}));
 expect(screen.queryByRole('menu')).toBeNull();
});
it('filters slash commands in the document and preserves text on cancellation', async () => {
 const {editor,field}=await setup('正文');
 act(()=>{editor.commands.setContent('/todo',{contentType:'markdown'});editor.commands.focus('end');});
 expect(screen.queryByRole('textbox',{name:'筛选内容块'})).toBeNull();
 expect(screen.getByRole('menuitem',{name:'待办事项'})).toBeTruthy();
 fireEvent.keyDown(field,{key:'Escape'});
 expect(editor.getText()).toBe('/todo');expect(screen.queryByRole('menu')).toBeNull();
});

function paste(field: HTMLElement, text: string, html = '') {
 fireEvent.paste(field,{clipboardData:{getData:(type: string)=>type==='text/html'?html:type==='text/plain'?text:'',files:[]}});
}
it('preserves rich clipboard formatting, nested lists and tables in one undo step',async()=>{
 const {editor,field,change}=await setup('正文');
 act(()=>{editor.commands.setTextSelection(3);});
 paste(field,'Rich bold link\nParent\nChild\nName Value\nA B','<p>Rich <strong>bold</strong> <a href="https://example.com">link</a></p><ul><li>Parent<ul><li>Child</li></ul></li></ul><table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>B</td></tr></table>');
 expect(field.querySelector('strong')?.textContent).toBe('bold');
 expect(field.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
 expect(field.querySelector('ul ul li')?.textContent).toBe('Child');
 expect(field.querySelectorAll('td')).toHaveLength(2);
 expect(change.mock.lastCall?.[0]).toContain('**bold**');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('正文');
 act(()=>{editor.commands.redo();});expect(field.querySelector('strong')?.textContent).toBe('bold');
});
it('keeps Markdown paste but makes shift-paste and code-block paste literal',async()=>{
 const {editor,field}=await setup('正文');
 act(()=>{editor.commands.selectAll();});paste(field,'**bold**');
 expect(field.querySelector('strong')?.textContent).toBe('bold');
 act(()=>{editor.commands.selectAll();});
 fireEvent.keyDown(field,{key:'V',code:'KeyV',metaKey:true,shiftKey:true});
 paste(field,'**literal**');
 fireEvent.keyUp(field,{key:'Shift'});
 expect(editor.getText()).toBe('**literal**');expect(field.querySelector('strong')).toBeNull();
 act(()=>{editor.commands.setCodeBlock();editor.commands.setTextSelection({from:1,to:editor.state.doc.content.size-1});});paste(field,'**code**');
 expect(field.querySelector('code')?.textContent).toBe('**code**');expect(field.querySelector('strong')).toBeNull();
});
it('does not reinterpret literal Markdown inside HTML or import executable HTML',async()=>{
 const {editor,field}=await setup('正文');
 act(()=>{editor.commands.selectAll();});
 paste(field,'**literal** unsafe','<p>**literal** <a href="javascript:alert(1)">unsafe</a></p><script>alert(1)</script>');
 expect(editor.getText()).toContain('**literal**');
 expect(field.querySelector('strong,script,[href^="javascript:"]')).toBeNull();
});
it('does not remove a selection when clipboard text is empty',async()=>{
 const {editor,field,change}=await setup('正文');
 act(()=>{editor.commands.selectAll();});paste(field,'');
 expect(editor.getText()).toBe('正文');expect(change).not.toHaveBeenCalled();
});
it('separates paste history from immediately preceding and following typing',async()=>{
 const {editor,field}=await setup('正文');
 act(()=>{editor.commands.setTextSelection(3);editor.commands.insertContent('before');});
 paste(field,'bold','<strong>bold</strong>');
 act(()=>{editor.commands.insertContent('after');editor.commands.undo();});
 expect(editor.getText()).toBe('正文beforebold');
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('正文before');
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('正文');
});
it('selects the current paragraph before the whole document and Escape returns to a caret',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond');
 act(()=>{editor.commands.setTextSelection(9);});
 fireEvent.keyDown(field,{key:'a',metaKey:true});
 expect(editor.state.selection.from).toBe(8);expect(editor.state.selection.to).toBe(14);
 fireEvent.keyDown(field,{key:'a',metaKey:true});
 expect(editor.state.selection.toJSON().type).toBe('all');
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(2);
 fireEvent.keyDown(field,{key:'Escape'});expect(editor.state.selection.empty).toBe(true);
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);expect(change).not.toHaveBeenCalled();
});
it('follows the hovered task from the page margin outside the editor box',async()=>{
 const {editor,field,change}=await setup('intro\n\n- [ ] A\n- [ ] B\n- [ ] C');
 const root=rangeGeometry(field),surface=root.parentElement!;surface.style.overflowY='auto';
 vi.spyOn(surface,'getBoundingClientRect').mockReturnValue(new DOMRect(-200,0,800,400));
 const tasks:Array<{pos:number,node:HTMLElement}>=[];
 editor.state.doc.descendants((node,pos)=>{if(node.type.name==='taskItem')tasks.push({pos,node:editor.view.nodeDOM(pos) as HTMLElement});});
 tasks.forEach((task,index)=>vi.spyOn(task.node,'getBoundingClientRect').mockReturnValue(new DOMRect(64,index*50,500,40)));
 vi.spyOn(editor.view,'posAtCoords').mockImplementation(({left,top})=>left===65&&[10,110].includes(top) ? {pos:tasks[top===110?2:0].pos+2,inside:tasks[top===110?2:0].pos} : null);
 fireEvent.mouseMove(surface,{clientX:-80,clientY:110});
 const grip=screen.getByRole('button',{name:'内容块操作'});
 expect(grip.parentElement!.style.top).toBe('113px');
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(grip,{dataTransfer:transfer});expect(transfer.setData).toHaveBeenCalledWith('text/plain','C');
 fireEvent.mouseMove(surface,{clientX:-80,clientY:10});expect(grip.parentElement!.style.top).toBe('113px');fireEvent.dragEnd(grip);
 const top=grip.parentElement!.style.top;
 fireEvent.mouseMove(document.body,{clientX:-80,clientY:10});expect(grip.parentElement!.style.top).toBe(top);
 fireEvent.mouseMove(surface,{clientX:-250,clientY:10});expect(grip.parentElement!.style.top).toBe(top);
 fireEvent.mouseMove(surface,{clientX:-80,clientY:110});fireEvent.click(grip);
 fireEvent.mouseMove(surface,{clientX:-80,clientY:10});expect(grip.parentElement!.style.top).toBe('113px');
 expect(change).not.toHaveBeenCalled();
});
it('targets the hovered block when opening its properties from a different caret',async()=>{
 const {editor,field}=await setup('first\n\nsecond');
 act(()=>{editor.commands.setTextSelection(2);});
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:9,inside:7});
 fireEvent.mouseMove(field.closest('.rich-editor')!,{clientX:50,clientY:80});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(editor.state.selection.from).toBe(7);expect(editor.state.selection.to).toBe(15);
 fireEvent.keyDown(screen.getByRole('menu'),{key:'Escape'});
 await waitFor(()=>expect(editor.view.hasFocus()).toBe(true));
});
it('duplicates a block with isolated history and restores editor focus',async()=>{
 const {editor,field}=await setup('first\n\nsecond');
 act(()=>{editor.commands.setTextSelection(6);editor.commands.insertContent('!');});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'复制'}));
 expect(editor.state.doc.childCount).toBe(3);
 await waitFor(()=>expect(editor.view.hasFocus()).toBe(true));
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('first!\n\nsecond');
 expect(field.querySelectorAll('p')).toHaveLength(2);
});
it('keeps movement independent of later typing and preserves nested list children',async()=>{
 const {editor,field}=await setup('first\n\n- Parent\n  - Child\n- Sibling');
 let parentPos=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='listItem'&&node.textContent==='ParentChild')parentPos=pos;});
 act(()=>{editor.commands.setTextSelection(parentPos+2);});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'下移'}));
 expect(Array.from(field.querySelectorAll('ul > li')).map(n=>n.textContent)).toEqual(['Sibling','ParentChild','Child']);
 act(()=>{editor.commands.setTextSelection(2);editor.commands.insertContent('!');editor.commands.undo();});
 expect(Array.from(field.querySelectorAll('ul > li')).map(n=>n.textContent)).toEqual(['Sibling','ParentChild','Child']);
 act(()=>{editor.commands.undo();});
 expect(Array.from(field.querySelectorAll('ul > li')).map(n=>n.textContent)).toEqual(['ParentChild','Child','Sibling']);
 act(()=>{editor.commands.redo();});expect(field.querySelector('ul > li')?.textContent).toBe('Sibling');
});
it('deletes only the menu target and undo retains prior typing',async()=>{
 const {editor,field}=await setup('first\n\nsecond');
 act(()=>{editor.commands.setTextSelection(6);editor.commands.insertContent('!');});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'删除'}));
 expect(editor.getText()).toBe('second');
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('first!\n\nsecond');
 expect(field.querySelectorAll('p')).toHaveLength(2);
});
it('keeps slash no-result text on Enter and returns focus when the search menu is cancelled',async()=>{
 const {editor,field}=await setup('正文');
 act(()=>{editor.commands.setContent('/not-a-block',{contentType:'markdown'});});
 fireEvent.keyDown(field,{key:'Enter'});expect(editor.getText()).toBe('/not-a-block');
 fireEvent.keyDown(field,{key:'Escape'});expect(screen.queryByRole('menu')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'在下方插入'}));
 const search=screen.getByRole('textbox',{name:'筛选内容块'});fireEvent.change(search,{target:{value:'无结果'}});
 fireEvent.keyDown(search,{key:'Escape'});
 await waitFor(()=>expect(editor.view.hasFocus()).toBe(true));expect(editor.getText()).toBe('/not-a-block');
});
it('does not change selection or content for shortcuts during composition',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond');
 act(()=>{editor.commands.setTextSelection(3);});
 fireEvent.keyDown(field,{key:'a',metaKey:true,isComposing:true});
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.empty).toBe(true);
 expect(change).not.toHaveBeenCalled();
});
it('Shift-click selects consecutive block handles and duplicates the whole range',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond\n\nthird');
 act(()=>{editor.commands.setTextSelection(2);});
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:9,inside:7});
 fireEvent.mouseMove(field.closest('.rich-editor')!,{clientX:50,clientY:80});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}),{shiftKey:true});
 expect(editor.state.selection.toJSON().type).toBe('blockRange');
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(2);
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(screen.getByRole('status').textContent).toContain('2 个块');
 fireEvent.click(screen.getByRole('menuitem',{name:'复制'}));
 expect(editor.getText()).toBe('first\n\nsecond\n\nfirst\n\nsecond\n\nthird');
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('first\n\nsecond\n\nthird');
 act(()=>{editor.commands.redo();});expect(change).toHaveBeenLastCalledWith('first\n\nsecond\n\nfirst\n\nsecond\n\nthird');
});
it('moves a selected block range together and deletes it without affecting its neighbors',async()=>{
 const {editor,field}=await setup('first\n\nsecond\n\nthird');
 act(()=>{editor.commands.setTextSelection(2);});
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:9,inside:7});
 fireEvent.mouseMove(field.closest('.rich-editor')!,{clientX:50,clientY:80});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}),{shiftKey:true});
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'下移'}));
 expect(editor.getText()).toBe('third\n\nfirst\n\nsecond');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'删除'}));
 expect(editor.getText()).toBe('third');
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('third\n\nfirst\n\nsecond');
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('first\n\nsecond\n\nthird');
});
function rangeGeometry(field: HTMLElement) {
 // Range tests provide block geometry rather than the toolbar's synthetic caret coordinates.
 vi.mocked((field as HTMLDivElement & {editor: Editor}).editor.view.coordsAtPos).mockRestore();
 const root=field.closest('.rich-editor')!;
 vi.spyOn(field,'getBoundingClientRect').mockReturnValue(new DOMRect(64,0,500,400));
 Array.from(field.children).forEach((element,index)=>vi.spyOn(element,'getBoundingClientRect').mockReturnValue(new DOMRect(64,index*50,500,30)));
 return root;
}
it('starts a range in the page margin outside the editor, then continues into the text',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond\n\nthird');
 const root=rangeGeometry(field),surface=root.parentElement!;surface.style.overflowY='auto';
 vi.spyOn(surface,'getBoundingClientRect').mockReturnValue(new DOMRect(-200,0,800,400));
 act(()=>{editor.commands.setTextSelection(2);});
 for(const [target,x,y] of [[document.body,-80,60],[surface,-250,60],[surface,-80,-20],[surface,100,60]] as const) {
  fireEvent.pointerDown(target,{button:0,clientX:x,clientY:y});fireEvent.pointerMove(root,{clientX:100,clientY:110});
  expect(editor.state.selection.from).toBe(2);expect(editor.state.selection.empty).toBe(true);
 }
 fireEvent.pointerDown(surface,{button:0,clientX:-80,clientY:60});
 fireEvent.pointerMove(root,{clientX:100,clientY:110});
 const box=root.querySelector<HTMLElement>('.rich-selection-box');
 expect(box).not.toBeNull();expect(box!.getAttribute('aria-hidden')).toBe('true');
 expect(box!.style.left).toBe('-80px');expect(box!.style.top).toBe('60px');
 expect(box!.style.width).toBe('180px');expect(box!.style.height).toBe('50px');
 fireEvent.pointerUp(root,{clientX:100,clientY:110});
 expect(root.querySelector('.rich-selection-box')).toBeNull();
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(2);
 expect(editor.state.selection.from).toBe(7);expect(editor.state.selection.to).toBe(22);expect(change).not.toHaveBeenCalled();
});
it('starts in the page whitespace above the body and selects only after entering the document',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond\n\nthird');
 const root=rangeGeometry(field),page=root.parentElement!;page.className='note-editor';page.style.overflowY='auto';
 vi.spyOn(page,'getBoundingClientRect').mockReturnValue(new DOMRect(-200,-120,800,520));
 act(()=>{editor.commands.setTextSelection({from:2,to:4});});
 const title=document.createElement('input');page.prepend(title);
 fireEvent.pointerDown(title,{button:0,clientX:100,clientY:-60});fireEvent.pointerMove(root,{clientX:140,clientY:60});
 expect(root.querySelector('.rich-selection-box')).toBeNull();
 fireEvent.pointerDown(page,{button:0,clientX:100,clientY:-60});fireEvent.pointerMove(root,{clientX:140,clientY:-20});
 expect(root.querySelector('.rich-selection-box')).not.toBeNull();
 expect(editor.state.selection.from).toBe(2);expect(editor.state.selection.to).toBe(4);
 fireEvent.pointerMove(root,{clientX:140,clientY:60});expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(2);
 fireEvent.pointerMove(root,{clientX:140,clientY:-20});
 expect(editor.state.selection.from).toBe(2);expect(editor.state.selection.to).toBe(4);
 fireEvent.pointerMove(root,{clientX:140,clientY:110});fireEvent.pointerUp(root,{clientX:140,clientY:110});
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(3);
 expect(root.querySelector('.rich-selection-box')).toBeNull();expect(change).not.toHaveBeenCalled();
});
it('only selects blocks intersected by the rectangle and clears them when dragged back into the margin',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond\n\nthird');const root=rangeGeometry(field);
 act(()=>{editor.commands.setTextSelection(2);});
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(root,{clientX:40,clientY:110});
 expect(root.querySelector('.rich-selection-box')).not.toBeNull();expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);
 fireEvent.pointerMove(root,{clientX:64,clientY:110});expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);
 fireEvent.pointerMove(root,{clientX:100,clientY:110});expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(3);
 fireEvent.pointerMove(root,{clientX:40,clientY:110});expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);
 fireEvent.pointerUp(root,{clientX:40,clientY:110});expect(editor.state.selection.from).toBe(2);expect(change).not.toHaveBeenCalled();
 act(()=>{editor.commands.setNodeSelection(7);});
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(root,{clientX:40,clientY:110});
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);
 fireEvent.keyDown(field,{key:'Escape'});expect(editor.state.selection.from).toBe(7);
 expect(field.querySelectorAll('.ProseMirror-selectednode')).toHaveLength(1);
});
it('does not select neighboring blocks when the rectangle stays inside a vertical gap',async()=>{
 const {field}=await setup('first\n\nsecond');const root=rangeGeometry(field);
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:35});fireEvent.pointerMove(root,{clientX:100,clientY:45});
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(0);
 fireEvent.pointerUp(root,{clientX:100,clientY:45});
});
it('selects whole blocks by dragging the left gutter, reverses and deletes the exact range with undo',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond\n\nthird');
 const root=rangeGeometry(field);
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:60});
 fireEvent.pointerMove(root,{clientX:250,clientY:110});
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(2);
 expect(editor.state.selection.from).toBe(7);expect(editor.state.selection.to).toBe(22);
 fireEvent.pointerMove(root,{clientX:250,clientY:10});
 expect(editor.state.selection.anchor).toBe(15);expect(editor.state.selection.head).toBe(0);
 fireEvent.pointerUp(root,{clientX:250,clientY:10});
 expect(root.hasAttribute('data-selecting')).toBe(false);expect(change).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'删除'}));
 expect(editor.getText()).toBe('third');
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('first\n\nsecond\n\nthird');
});
it('draws a positive selection rectangle when dragging upward into the text',async()=>{
 const {field}=await setup('first\n\nsecond\n\nthird');const root=rangeGeometry(field);
 vi.spyOn(root,'getBoundingClientRect').mockReturnValue(new DOMRect(-100,-20,600,400));
 fireEvent.pointerDown(root,{button:0,clientX:40,clientY:110});fireEvent.pointerMove(root,{clientX:100,clientY:10});
 const box=root.querySelector<HTMLElement>('.rich-selection-box');
 expect(box).not.toBeNull();expect(box!.style.left).toBe('140px');expect(box!.style.top).toBe('30px');
 expect(box!.style.width).toBe('60px');expect(box!.style.height).toBe('100px');
 fireEvent.pointerUp(root,{clientX:100,clientY:10});expect(root.querySelector('.rich-selection-box')).toBeNull();
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(3);
});
it.each(['Escape','cancel','blur'])('cancels a gutter range with %s and restores the prior text selection',async how=>{
 const {editor,field,change}=await setup('first\n\nsecond\n\nthird');
 const root=rangeGeometry(field);act(()=>{editor.commands.setTextSelection({from:2,to:4});});
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(root,{clientX:100,clientY:110});
 if(how==='Escape')fireEvent.keyDown(field,{key:'Escape'});else if(how==='cancel')fireEvent.pointerCancel(root);else fireEvent(window,new Event('blur'));
 expect(editor.state.selection.from).toBe(2);expect(editor.state.selection.to).toBe(4);
 expect(root.hasAttribute('data-selecting')).toBe(false);expect(change).not.toHaveBeenCalled();
 expect(root.querySelector('.rich-selection-box')).toBeNull();
 fireEvent.pointerMove(root,{clientX:10,clientY:60});expect(editor.state.selection.from).toBe(2);
});
it('does not capture ordinary text selection, controls or composition as a block range',async()=>{
 const {editor,field}=await setup('first\n\nsecond');const root=rangeGeometry(field);
 act(()=>{editor.commands.setTextSelection({from:2,to:4});});
 fireEvent.pointerDown(field,{button:0,clientX:100,clientY:10});fireEvent.pointerMove(root,{clientX:10,clientY:60});
 expect(editor.state.selection.from).toBe(2);expect(editor.state.selection.to).toBe(4);
 fireEvent.pointerDown(screen.getByRole('button',{name:'内容块操作'}),{button:0,clientX:30,clientY:10});
 expect(root.hasAttribute('data-selecting')).toBe(false);
 Object.defineProperty(editor.view,'composing',{configurable:true,value:true});
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:10});expect(root.hasAttribute('data-selecting')).toBe(false);
 Object.defineProperty(editor.view,'composing',{configurable:true,value:false});
});
it('selects individual tasks from the gutter and lifts a cross-container range to whole blocks',async()=>{
 const {editor,field,change}=await setup('before\n\n- [ ] A\n- [ ] B\n- [ ] C\n\nafter');
 const root=rangeGeometry(field);
 Array.from(field.querySelectorAll('li')).forEach((element,index)=>vi.spyOn(element,'getBoundingClientRect').mockReturnValue(new DOMRect(64,50+index*30,500,30)));
 vi.spyOn(field.children[1],'getBoundingClientRect').mockReturnValue(new DOMRect(64,50,500,90));
 vi.spyOn(field.children[2],'getBoundingClientRect').mockReturnValue(new DOMRect(64,160,500,30));
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:60});fireEvent.pointerMove(root,{clientX:100,clientY:120});
 expect(field.querySelectorAll('li.rich-selected-block')).toHaveLength(3);expect(editor.state.selection.$from.parent.type.name).toBe('taskList');
 fireEvent.pointerMove(root,{clientX:100,clientY:10});fireEvent.pointerUp(root,{clientX:100,clientY:10});
 expect(editor.state.selection.from).toBe(0);expect(editor.state.selection.to).toBe(editor.state.doc.child(0).nodeSize+editor.state.doc.child(1).nodeSize);
 expect(change).not.toHaveBeenCalled();
});
it('extends a gutter selection as its ancestor scrolls and stops scrolling after release',async()=>{
 // Keep startup focus/scroll RAFs out of this manually stepped scroll test.
 const {editor,field}=await setup('first\n\nsecond\n\nthird',{autoFocus:false});const root=rangeGeometry(field),scroller=root.parentElement!;
 scroller.style.overflowY='auto';
 Object.defineProperties(scroller,{scrollHeight:{value:600},clientHeight:{value:100}});
 vi.spyOn(scroller,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,600,100));
 vi.spyOn(root,'getBoundingClientRect').mockImplementation(()=>new DOMRect(0,-scroller.scrollTop,600,400));
 Array.from(field.children).forEach((element,index)=>vi.spyOn(element,'getBoundingClientRect').mockImplementation(()=>new DOMRect(64,index*50-scroller.scrollTop,500,30)));
 expect(scroller.scrollTop).toBe(0);
 let frame:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frame=callback;return 1;});
 fireEvent.pointerDown(root,{button:0,clientX:10,clientY:10});fireEvent.pointerMove(root,{clientX:100,clientY:85});
 expect(editor.state.selection.to).toBe(15);
 act(()=>{frame(0);});expect(scroller.scrollTop).toBe(12);expect(editor.state.selection.to).toBe(15);
 act(()=>{frame(0);});expect(scroller.scrollTop).toBe(24);expect(editor.state.selection.to).toBe(22);
 fireEvent.pointerUp(root,{clientX:100,clientY:85});act(()=>{frame(0);});expect(scroller.scrollTop).toBe(24);
});
it('replaces forward and backward partial cross-paragraph text without losing outside text',async()=>{
 const {editor}=await setup('first\n\nsecond\n\nthird');
 for (const [from,to] of [[3,11],[11,3]]) {
  act(()=>{editor.commands.setTextSelection({from,to});editor.commands.insertContent('X');});
  expect(editor.getText()).toBe('fiXond\n\nthird');
  act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('first\n\nsecond\n\nthird');
 }
});
it('expands and shrinks an explicit block selection with Shift arrows',async()=>{
 const {editor,field}=await setup('first\n\nsecond\n\nthird');
 act(()=>{editor.commands.setNodeSelection(7);});
 fireEvent.keyDown(field,{key:'ArrowDown',shiftKey:true});expect(editor.state.selection.toJSON().type).toBe('blockRange');
 expect(field.querySelectorAll('.rich-selected-block')).toHaveLength(2);
 fireEvent.keyDown(field,{key:'ArrowUp',shiftKey:true});expect(editor.state.selection.toJSON().type).toBe('node');expect(editor.state.selection.from).toBe(7);
 fireEvent.keyDown(field,{key:'ArrowUp',shiftKey:true});expect(editor.state.selection.from).toBe(0);expect(editor.state.selection.to).toBe(15);
 fireEvent.keyDown(field,{key:'ArrowDown',shiftKey:true});expect(editor.state.selection.toJSON().type).toBe('node');expect(editor.state.selection.from).toBe(7);
});
it('copies a selected block range through the HTML clipboard without losing structure',async()=>{
 const {editor,field}=await setup('first\n\nsecond\n\nthird');
 act(()=>{editor.commands.setNodeSelection(0);});fireEvent.keyDown(field,{key:'ArrowDown',shiftKey:true});
 const clipboard=editor.view.serializeForClipboard(editor.state.selection.content());
 act(()=>{editor.commands.setTextSelection(editor.state.doc.content.size-1);});
 fireEvent.keyUp(field,{key:'Shift'});paste(field,clipboard.text,clipboard.dom.innerHTML);
 expect(editor.getText()).toContain('first');expect(field.querySelectorAll('p')).toHaveLength(4);
 act(()=>{editor.commands.undo();});expect(editor.getText()).toBe('first\n\nsecond\n\nthird');
});
it('keeps the text toolbar anchored to its selection when hovering another block',async()=>{
 const {editor,field}=await setup('first\n\nsecond');
 vi.spyOn(editor.view.nodeDOM(0) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,100,200,30));
 vi.spyOn(editor.view.nodeDOM(7) as HTMLElement,'getBoundingClientRect').mockReturnValue(new DOMRect(60,400,200,30));
 vi.spyOn(editor.view,'coordsAtPos').mockReturnValue({left:60,right:160,top:200,bottom:226});
 act(()=>{editor.commands.setTextSelection({from:1,to:4});});
 const tools=screen.getByLabelText('文字格式');
 const top=tools.style.top;expect(top).toBe('192px');
 vi.spyOn(editor.view,'posAtCoords').mockReturnValue({pos:9,inside:7});
 fireEvent.mouseMove(field.closest('.rich-editor')!,{clientX:80,clientY:410});
 expect(tools.style.top).toBe(top);
});
it('splits a paragraph at the caret and joins it back without losing text',async()=>{
 const {editor,field,change}=await setup('前半后半');
 act(()=>{editor.commands.setTextSelection(3);});
 fireEvent.keyDown(field,{key:'Enter',code:'Enter'});
 expect(editor.getText()).toBe('前半\n\n后半');
 expect(editor.state.selection.$from.parent.textContent).toBe('后半');
 expect(editor.state.selection.$from.parentOffset).toBe(0);
 fireEvent.keyDown(field,{key:'Backspace',code:'Backspace'});
 expect(change).toHaveBeenLastCalledWith('前半后半');
 expect(editor.state.selection.$from.parentOffset).toBe(2);
});
it('exits an empty list item without absorbing the following paragraph',async()=>{
 const {editor,field}=await setup('item\n\nafter');
 act(()=>{editor.commands.setTextSelection(2);editor.commands.toggleBulletList();editor.commands.setTextSelection(7);});
 fireEvent.keyDown(field,{key:'Enter',code:'Enter'});
 expect(field.querySelectorAll('li')).toHaveLength(2);
 fireEvent.keyDown(field,{key:'Enter',code:'Enter'});
 expect(field.querySelectorAll('li')).toHaveLength(1);
 expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
 expect(editor.state.selection.$from.depth).toBe(1);
 expect(editor.state.doc.lastChild?.textContent).toBe('after');
});
it('updates the drop indicator while edge scrolling with a stationary pointer',async()=>{
 const {editor,field}=await setup('first\n\nsecond',{autoFocus:false});
 act(()=>editor.commands.setTextSelection(1));
 const root=field.closest('.rich-editor') as HTMLElement;
 const scroller=root.parentElement!;scroller.style.overflowY='auto';
 Object.defineProperties(scroller,{scrollHeight:{value:600},clientHeight:{value:200}});
 vi.spyOn(scroller,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,300,200));
 vi.spyOn(editor.view,'posAtCoords').mockImplementation(()=>scroller.scrollTop ? null : {pos:9,inside:7});
 vi.spyOn(editor.view.nodeDOM(7) as HTMLElement,'getBoundingClientRect').mockImplementation(()=>new DOMRect(60,160-scroller.scrollTop,200,30));
 expect(scroller.scrollTop).toBe(0);
 let frame: FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frame=callback;return 1;});
 vi.stubGlobal('cancelAnimationFrame',vi.fn());
 const transfer={setData:vi.fn(),setDragImage:vi.fn(),effectAllowed:'',dropEffect:''};
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});
 fireEvent.dragOver(root,{dataTransfer:transfer,clientX:100,clientY:190});
 expect((root.querySelector('.block-drop-indicator') as HTMLElement).style.top).toBe('190px');
 act(()=>{frame(16);});
 expect(scroller.scrollTop).toBe(12);
 expect(root.querySelector('.block-drop-indicator')).toBeNull();
 fireEvent.dragEnd(screen.getByRole('button',{name:'内容块操作'}));
});

it('places the text toolbar below the selection when there is no room above',async()=>{
 const {editor}=await setup('first');
 vi.spyOn(editor.view,'coordsAtPos').mockReturnValue({left:60,right:80,top:0,bottom:26});
 act(()=>{editor.commands.setTextSelection({from:1,to:4});});
 expect(screen.getByLabelText('文字格式').style.top).toBe('34px');
});

it('formats only selected parts across paragraphs and preserves selection through undo and redo', async () => {
 const {editor,field,change}=await setup('Alpha\n\nBeta');
 act(()=>editor.commands.setTextSelection({from:3,to:10}));
 fireEvent.click(await screen.findByRole('button',{name:'粗体'}));
 expect([...field.querySelectorAll('strong')].map(node=>node.textContent)).toEqual(['pha','Be']);
 expect(editor.state.doc.childCount).toBe(2);
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
 expect(screen.getByRole('button',{name:'粗体'}).getAttribute('aria-pressed')).toBe('true');
 fireEvent.click(screen.getByRole('button',{name:'高亮'}));
 expect([...field.querySelectorAll('mark')].map(node=>node.textContent)).toEqual(['pha','Be']);
 act(()=>editor.commands.undo());
 expect(field.querySelector('mark')).toBeNull();expect(field.querySelectorAll('strong')).toHaveLength(2);
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith('Alpha\n\nBeta');
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
 act(()=>editor.commands.redo());act(()=>editor.commands.redo());
 expect(field.querySelectorAll('mark')).toHaveLength(2);expect(field.querySelectorAll('strong')).toHaveLength(2);
 const saved=change.mock.lastCall![0] as string;cleanup();
 const reopened=await setup('',{value:saved});expect(reopened.editor.getText()).toBe('Alpha\n\nBeta');expect(reopened.editor.state.doc.childCount).toBe(2);expect(reopened.field.querySelectorAll('mark')).toHaveLength(2);expect(reopened.field.querySelectorAll('strong')).toHaveLength(2);
});
it('shows mixed formatting and applies or removes the format uniformly without expanding selection', async () => {
 const {editor,field}=await setup('Alpha\n\nBeta');
 act(()=>{editor.chain().setTextSelection({from:1,to:3}).setMark('bold').setTextSelection({from:1,to:10}).run();});
 const bold=await screen.findByRole('button',{name:'粗体'});
 expect(bold.getAttribute('aria-pressed')).toBe('mixed');
 fireEvent.click(bold);expect(bold.getAttribute('aria-pressed')).toBe('true');
 expect([...field.querySelectorAll('strong')].map(node=>node.textContent)).toEqual(['Alpha','Be']);
 fireEvent.click(bold);expect(field.querySelector('strong')).toBeNull();
 expect(editor.state.selection.from).toBe(1);expect(editor.state.selection.to).toBe(10);
});
it('keeps a cross-paragraph selection while entering link properties, applies one undoable edit and cancels safely', async () => {
 const {editor,field,change}=await setup('Alpha\n\nBeta');
 act(()=>editor.commands.setTextSelection({from:3,to:10}));
 fireEvent.click(await screen.findByRole('button',{name:'链接'}));
 const address=await screen.findByRole('textbox',{name:'链接地址'});
 fireEvent.change(address,{target:{value:'https://example.com'}});
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
 expect(field.querySelector('.rich-text-selected')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'保存'}));
 expect([...field.querySelectorAll('a')].map(node=>node.textContent)).toEqual(['pha','Be']);
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith('Alpha\n\nBeta');
 act(()=>editor.commands.redo());expect(field.querySelectorAll('a')).toHaveLength(2);
 const saved=change.mock.lastCall![0];
 fireEvent.click(screen.getByRole('button',{name:'链接'}));
 fireEvent.change(await screen.findByRole('textbox',{name:'链接地址'}),{target:{value:'https://cancelled.example'}});
 fireEvent.click(screen.getByRole('button',{name:'取消'}));
 expect(change).toHaveBeenLastCalledWith(saved);expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
});
it('clears selected styles without deleting links, text or paragraph structure', async () => {
 const {editor,field}=await setup('Alpha\n\nBeta');
 act(()=>editor.chain().setTextSelection({from:3,to:10}).setMark('bold').setMark('mark').setMark('link',{href:'https://example.com'}).run());
 fireEvent.click(await screen.findByRole('button',{name:'更多格式'}));
 fireEvent.click(await screen.findByRole('button',{name:'清除文字样式'}));
 expect(field.querySelector('strong')).toBeNull();expect(field.querySelector('mark')).toBeNull();expect(field.querySelectorAll('a')).toHaveLength(2);
 expect(editor.getText()).toBe('Alpha\n\nBeta');expect(editor.state.doc.childCount).toBe(2);
 act(()=>editor.commands.undo());expect(field.querySelectorAll('strong')).toHaveLength(2);expect(field.querySelectorAll('mark')).toHaveLength(2);
});
it('keeps the toolbar inside the viewport and hides it when the selection scrolls away', async () => {
 const {editor}=await setup('Alpha');
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(232);
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(40);
 vi.spyOn(editor.view,'coordsAtPos').mockReturnValue({left:1000,right:1010,top:200,bottom:226});
 act(()=>editor.commands.setTextSelection({from:1,to:3}));
 const tools=await screen.findByRole('toolbar',{name:'文字格式'});
 expect(parseFloat(tools.style.left)+232).toBeLessThanOrEqual(window.innerWidth-12);expect(tools.style.top).toBe('152px');
 vi.spyOn(editor.view,'coordsAtPos').mockReturnValue({left:60,right:80,top:-100,bottom:-74});
 fireEvent.scroll(document);expect(tools.style.visibility).toBe('hidden');
 vi.restoreAllMocks();
});
it('offers a compact mobile toolbar and a sheet without losing the text selection', async () => {
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 const {editor,field}=await setup('Alpha\n\nBeta');
 act(()=>editor.commands.setTextSelection({from:3,to:10}));
 expect(await screen.findByRole('button',{name:'链接'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'行内代码'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'更多格式'}));
 const sheet=await screen.findByRole('dialog',{name:'更多格式'});expect(sheet.classList.contains('rich-format-sheet')).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'删除线'}));
 expect([...field.querySelectorAll('s')].map(node=>node.textContent)).toEqual(['pha','Be']);
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
 fireEvent.click(screen.getByRole('button',{name:'更多格式'}));
 fireEvent.click(await screen.findByRole('button',{name:'编辑链接'}));
 expect((await screen.findByRole('dialog',{name:'编辑链接'})).classList.contains('rich-format-sheet')).toBe(true);
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('textbox',{name:'链接地址'})));
 fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
});

it('keeps invalid link input local, preserves selection and saves a corrected trimmed address with Enter', async () => {
 const {editor,field,change}=await setup('Alpha\n\nBeta');
 act(()=>editor.commands.setTextSelection({from:3,to:10}));
 await userEvent.setup().click(await screen.findByRole('button',{name:'链接'}));
 const address=await screen.findByRole('textbox',{name:'链接地址'});
 fireEvent.change(address,{target:{value:'javascript:alert(1)'}});fireEvent.click(screen.getByRole('button',{name:'保存'}));
 expect(screen.getByRole('alert').textContent).toContain('有效的网页地址');expect(address.getAttribute('aria-invalid')).toBe('true');
 expect(address.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
 expect(change).not.toHaveBeenCalled();expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
 fireEvent.change(address,{target:{value:'  https://example.com  '}});expect(screen.queryByRole('alert')).toBeNull();
 fireEvent.keyDown(address,{key:'Enter'});
 expect([...field.querySelectorAll('a')].map(node=>[node.textContent,node.getAttribute('href')])).toEqual([['pha','https://example.com'],['Be','https://example.com']]);
 act(()=>editor.commands.undo());expect(change).toHaveBeenLastCalledWith('Alpha\n\nBeta');
});
it('edits abbreviation meaning in an anchored popup and removes it with independent undo', async () => {
 const {editor,field}=await setup('Alpha\n\nBeta');
 act(()=>editor.commands.setTextSelection({from:3,to:10}));
 fireEvent.click(await screen.findByRole('button',{name:'更多格式'}));fireEvent.click(await screen.findByRole('button',{name:'缩写说明'}));
 const popup=await screen.findByRole('dialog',{name:'缩写说明'});expect(popup.classList.contains('rich-link-popup')).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'保存'}));expect(screen.getByRole('alert').textContent).toContain('完整含义');
 fireEvent.change(screen.getByRole('textbox',{name:'缩写说明'}),{target:{value:'完整说明'}});fireEvent.click(screen.getByRole('button',{name:'保存'}));
 expect([...field.querySelectorAll('abbr')].map(node=>[node.textContent,node.title])).toEqual([['pha','完整说明'],['Be','完整说明']]);
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
 act(()=>editor.commands.undo());expect(field.querySelector('abbr')).toBeNull();act(()=>editor.commands.redo());
 fireEvent.click(screen.getByRole('button',{name:'更多格式'}));fireEvent.click(await screen.findByRole('button',{name:'缩写说明'}));
 expect((await screen.findByRole('textbox',{name:'缩写说明'}) as HTMLInputElement).value).toBe('完整说明');
 fireEvent.click(screen.getByRole('button',{name:'移除说明'}));expect(field.querySelector('abbr')).toBeNull();
 act(()=>editor.commands.undo());expect(field.querySelectorAll('abbr')).toHaveLength(2);
});
it('shows empty and failed Wiki searches and supports keyboard selection of a matching note', async () => {
 const {request}=await import('./bridge');
 vi.mocked(request).mockReset().mockResolvedValueOnce({notes:[]}).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({notes:[{id:'target',title:'项目计划',body:'<aside>正文第一行</aside>',relativePath:'notes/project.md'},{id:'untitled',body:'# 正文标题',relativePath:'notes/备用笔记.md'}]});
 const {editor,field}=await setup('Alpha\n\nBeta');const user=userEvent.setup();
 act(()=>editor.commands.setTextSelection({from:3,to:10}));
 await user.click(await screen.findByRole('button',{name:'链接'}));await user.click(screen.getByRole('combobox',{name:'链接类型'}));
 await user.click(await screen.findByRole('option',{name:'Wiki 笔记链接'}));
 expect(await screen.findByText('正在查找笔记…')).toBeTruthy();
 expect(await screen.findByText('没有匹配的笔记，可直接输入路径。')).toBeTruthy();
 const search=screen.getByRole('textbox',{name:'搜索目标笔记'});
 fireEvent.change(search,{target:{value:'failed'}});expect(await screen.findByText('无法读取笔记，请直接输入目标路径。')).toBeTruthy();
 fireEvent.change(search,{target:{value:'project'}});const result=await screen.findByRole('option',{name:/项目计划/});expect(screen.getByRole('option',{name:/备用笔记/})).toBeTruthy();expect(screen.queryByRole('option',{name:/正文第一行|正文标题/})).toBeNull();
 search.focus();await user.keyboard('{ArrowDown}');expect(document.activeElement).toBe(result);await user.keyboard('{Enter}');
 const address=screen.getByRole('textbox',{name:'链接地址'});expect((address as HTMLInputElement).value).toBe('notes/project.md');expect(document.activeElement).toBe(address);
 await user.click(screen.getByRole('button',{name:'保存'}));
 expect([...field.querySelectorAll('a[data-wiki-target]')].map(node=>node.getAttribute('data-wiki-target'))).toEqual(['notes/project.md','notes/project.md']);
 expect(editor.state.selection.from).toBe(3);expect(editor.state.selection.to).toBe(10);
});
it('navigates formatting actions by keyboard and closes a nested type selector before its parent popup', async () => {
 const {editor,field,change}=await setup('正文');const user=userEvent.setup();
 act(()=>editor.commands.setTextSelection({from:1,to:3}));
 fireEvent.click(await screen.findByRole('button',{name:'更多格式'}));
 const firstAction=await screen.findByRole('button',{name:'上标'});firstAction.focus();fireEvent.keyDown(firstAction,{key:'End'});
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'清除文字样式'}));fireEvent.keyDown(document.activeElement!,{key:'ArrowDown'});
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'上标'}));await user.keyboard('{Escape}');
 expect(screen.queryByRole('dialog',{name:'更多格式'})).toBeNull();expect(document.activeElement).toBe(field);
 await user.click(screen.getByRole('button',{name:'链接'}));await user.click(screen.getByRole('combobox',{name:'链接类型'}));
 await screen.findByRole('option',{name:'Wiki 笔记链接'});await user.keyboard('{Escape}');
 expect(screen.queryByRole('option',{name:'Wiki 笔记链接'})).toBeNull();expect(screen.getByRole('dialog',{name:'编辑链接'})).toBeTruthy();
 await user.keyboard('{Escape}');expect(screen.queryByRole('dialog',{name:'编辑链接'})).toBeNull();expect(document.activeElement).toBe(field);
 expect(editor.state.selection.from).toBe(1);expect(editor.state.selection.to).toBe(3);expect(change).not.toHaveBeenCalled();
});
it('closes mobile link layers without opening the format sheet and returns to the original selection', async () => {
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 const {editor,field}=await setup('正文');const user=userEvent.setup();
 act(()=>editor.commands.setTextSelection({from:1,to:3}));
 await user.click(await screen.findByRole('button',{name:'链接'}));await user.click(screen.getByRole('combobox',{name:'链接类型'}));
 await screen.findByRole('option',{name:'Wiki 笔记链接'});await user.keyboard('{Escape}');
 await waitFor(()=>expect(screen.queryByRole('option',{name:'Wiki 笔记链接'})).toBeNull());expect(screen.getByRole('dialog',{name:'编辑链接'})).toBeTruthy();
 await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(document.activeElement).toBe(field);
 expect(editor.state.selection.from).toBe(1);expect(editor.state.selection.to).toBe(3);
 await user.click(screen.getByRole('button',{name:'更多格式'}));expect(await screen.findByRole('dialog',{name:'更多格式'})).toBeTruthy();
});
