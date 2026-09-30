// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { RichMarkdownEditor, type RichEditorProps } from './RichMarkdownEditor';
vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
vi.mock('./bridge', () => ({ request: vi.fn() }));
beforeEach(() => {
 vi.stubGlobal('DragEvent', MouseEvent);
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
 Range.prototype.getClientRects=()=>[] as unknown as DOMRectList;
 Range.prototype.getBoundingClientRect=()=>new DOMRect();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function setup(value: string, extra: Partial<RichEditorProps> = {}) {
 const change=vi.fn(),save=vi.fn();
 render(<RichMarkdownEditor value={value} disabled={false} notePath="notes/a.md" onChange={change} onSave={save} onError={vi.fn()} {...extra}/>);
 const field=await screen.findByRole('textbox',{name:'笔记内容'});
 const editor=(field as HTMLDivElement & {editor: Editor}).editor;
 await waitFor(()=> value.startsWith('<!--') ? expect(editor.state.doc.firstChild?.type.name).toBe('preservedMarkdown') : expect(editor.getText()).toContain(value.startsWith('#') ? '标题' : value.split('\n')[0].replace(/\[\^[^\]]+\]/g, '')));
 return {editor,field,change,save};
}
it('opens without a write, renders heading syntax invisibly and edits semantic text',async()=>{
 const {editor,field,change}=await setup('# 标题\n\n正文');
 expect(change).not.toHaveBeenCalled();expect(field.querySelector('h1')?.textContent).toBe('标题');
 act(()=>{editor.commands.insertContentAt(2,'新');});
 expect(change).toHaveBeenLastCalledWith('# 标新题\n\n正文');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('# 标题\n\n正文');
});
it('guards command-enter during composition',async()=>{
 const {field,save}=await setup('正文');
 fireEvent.keyDown(field,{key:'Enter',metaKey:true,isComposing:true});expect(save).not.toHaveBeenCalled();
 fireEvent.keyDown(field,{key:'Enter',metaKey:true});expect(save).toHaveBeenCalledOnce();
});
it('opens the insertion menu and creates a directly editable table',async()=>{
 const {editor,field}=await setup('正文');
 fireEvent.click(screen.getByRole('button',{name:'插入内容块'}));
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
it('inserts a block after its source and undoes insertion in one step',async()=>{
 const {editor,change}=await setup('正文');
 fireEvent.click(screen.getByRole('button',{name:'插入内容块'}));
 fireEvent.click(screen.getByRole('menuitem',{name:'表格'}));
 act(()=>{editor.commands.undo();});
 expect(change).toHaveBeenLastCalledWith('正文');expect(editor.view.dom.querySelector('table')).toBeNull();
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
 expect(root.querySelector('.block-drop-indicator')).toBeTruthy();
 fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).toHaveBeenLastCalledWith('second\n\nfirst');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('first\n\nsecond');
 fireEvent.dragStart(screen.getByRole('button',{name:'内容块操作'}),{dataTransfer:transfer});
 fireEvent.keyDown(root,{key:'Escape'});
 fireEvent.drop(root,{dataTransfer:transfer,clientX:100,clientY:65});
 expect(change).toHaveBeenLastCalledWith('first\n\nsecond');expect(root.querySelector('.block-drop-indicator')).toBeNull();
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
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'编辑链接'}));
 fireEvent.change(screen.getByRole('textbox',{name:'属性内容'}),{target:{value:'https://example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'应用属性'}));
 expect(field.querySelector('a')?.getAttribute('href')).toContain('https://example.com');
 expect(change).toHaveBeenLastCalledWith('[正文](https://example.com)');
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'移除链接'}));
 expect(change).toHaveBeenLastCalledWith('正文');
});
it('inserts a unique footnote with editable paragraphs and undoes both pieces together',async()=>{
 const {editor,change}=await setup('正文');
 act(()=>{editor.commands.setTextSelection(3);});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'插入脚注'}));
 expect(editor.state.doc.lastChild?.type.name).toBe('footnoteDefinition');
 expect(editor.state.selection.$from.parent.type.name).toBe('paragraph');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('正文');
});
it('changes a protected source block through an explicit editor and supports undo',async()=>{
 const {editor,change}=await setup('<!-- original -->');
 act(()=>{editor.commands.setNodeSelection(0);});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'编辑原格式内容'}));
 fireEvent.change(screen.getByRole('textbox',{name:'属性内容'}),{target:{value:'<!-- revised -->'}});fireEvent.click(screen.getByRole('button',{name:'应用属性'}));
 expect(change).toHaveBeenLastCalledWith('<!-- revised -->');act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('<!-- original -->');
});
it('renames a footnote and every reference in one undoable change',async()=>{
 const {editor,change}=await setup('正文[^a]\n\n[^a]: first\n\n    second');
 let position=0;editor.state.doc.descendants((node,pos)=>{if(node.type.name==='footnoteReference')position=pos;});
 act(()=>{editor.commands.setNodeSelection(position);});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'脚注编号'}));
 fireEvent.change(screen.getByRole('textbox',{name:'属性内容'}),{target:{value:'2'}});fireEvent.click(screen.getByRole('button',{name:'应用属性'}));
 expect(change.mock.lastCall?.[0]).toContain('正文[^2]');expect(change.mock.lastCall?.[0]).toContain('[^2]: first');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('正文[^a]\n\n[^a]: first\n\n    second');
});
it('edits image alt text, replaces its file and adds an editable caption',async()=>{
 const {editor,change}=await setup('正文',{onImage:insert=>insert('![new](../assets/new.png)')});
 act(()=>{editor.commands.setContent('![old](../assets/old.png)',{contentType:'markdown'});editor.commands.setNodeSelection(0);});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'图片替代文字'}));
 fireEvent.change(screen.getByRole('textbox',{name:'属性内容'}),{target:{value:'描述'}});fireEvent.click(screen.getByRole('button',{name:'应用属性'}));
 expect(change).toHaveBeenLastCalledWith('![描述](../assets/old.png)');
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'替换图片'}));
 expect(change).toHaveBeenLastCalledWith('![描述](../assets/new.png)');
 act(()=>{editor.commands.setNodeSelection(0);});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'笔记内容'}),{key:'Escape'});fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));fireEvent.click(screen.getByRole('menuitem',{name:'块属性与更多操作'}));fireEvent.click(screen.getByRole('button',{name:'添加图片说明'}));
 expect(editor.state.doc.firstChild?.type.name).toBe('figure');expect(change.mock.lastCall?.[0]).toContain('<figcaption>图片说明</figcaption>');
 act(()=>{editor.commands.undo();});expect(change).toHaveBeenLastCalledWith('![描述](../assets/new.png)');
});
it('suggests existing tags and confirms them without inserting a paragraph', async () => {
 const { request } = await import('./bridge');
 vi.mocked(request).mockResolvedValue({ tags: [{ name: '工作/项目' }] });
 const { editor, field, change } = await setup('正文');
 act(() => { editor.chain().setTextSelection(3).insertContent(' #工').run(); });
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
it('only exposes advanced formatting through a text selection or block menu', async () => {
 const { editor, field } = await setup('正文');
 expect(screen.queryByRole('button', { name: '格式与属性' })).toBeNull();
 expect(screen.queryByRole('button', { name: '更多格式' })).toBeNull();
 act(() => { editor.commands.setTextSelection({ from: 1, to: 3 }); });
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

it('groups the compact insert menu and finds low-frequency formats by aliases', async () => {
 const {editor}=await setup('正文');
 fireEvent.click(screen.getByRole('button',{name:'插入内容块'}));
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
 await setup('正文');fireEvent.click(screen.getByRole('button',{name:'插入内容块'}));
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
