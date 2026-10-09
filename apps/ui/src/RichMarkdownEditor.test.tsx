// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/react';
import { RichMarkdownEditor, type RichEditorProps } from './RichMarkdownEditor';
import userEvent from '@testing-library/user-event';
vi.mock('./client-mode', () => ({ isBrowserVault: false, isLocalWeb: false }));
vi.mock('./bridge', () => ({ request: vi.fn() }));
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
 render(page ? <div className="note-page-scroll">{content}<button>其他操作</button></div> : content);
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
it('focuses the document end from blank page space without inserting content or stealing interactive clicks',async()=>{
 const {editor,field,change}=await setup('first\n\nsecond',{},true);
 const surface=field.closest('.note-page-scroll')!;
 vi.spyOn(field,'getBoundingClientRect').mockReturnValue(new DOMRect(100,100,720,240));
 act(()=>{editor.commands.setTextSelection(2);});
 fireEvent.click(surface,{clientX:200,clientY:500});
 await waitFor(()=>expect(document.activeElement).toBe(field));
 expect(editor.state.selection.from).toBe(editor.state.doc.content.size-1);
 expect(change).not.toHaveBeenCalled();
 const button=screen.getByRole('button',{name:'其他操作'});
 act(()=>{editor.commands.setTextSelection(2);});
 fireEvent.click(button,{clientX:200,clientY:500});
 fireEvent.click(surface,{clientX:50,clientY:500});
 expect(editor.state.selection.from).toBe(2);
 Object.defineProperty(editor.view,'composing',{configurable:true,value:true});
 fireEvent.click(surface,{clientX:200,clientY:500});expect(editor.state.selection.from).toBe(2);
 Object.defineProperty(editor.view,'composing',{configurable:true,value:false});
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
 expect(screen.getByRole('button',{name:'内容块操作'}).title).toContain('移动标题');
 expect(screen.getByRole('button',{name:'内容块操作'}).title).toContain('Option/Alt');
 fireEvent.click(screen.getByRole('button',{name:'内容块操作'}));
 expect(screen.getByRole('status').textContent).toContain('章节移动包含 4 个块');
 expect((screen.getByRole('menuitem',{name:'上移章节'}) as HTMLButtonElement).disabled).toBe(true);
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
 const {editor,field}=await setup('first\n\nsecond\n\nthird');const root=rangeGeometry(field),scroller=root.parentElement!;
 scroller.style.overflowY='auto';
 Object.defineProperties(scroller,{scrollHeight:{value:600},clientHeight:{value:100}});
 vi.spyOn(scroller,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,600,100));
 vi.spyOn(root,'getBoundingClientRect').mockImplementation(()=>new DOMRect(0,-scroller.scrollTop,600,400));
 Array.from(field.children).forEach((element,index)=>vi.spyOn(element,'getBoundingClientRect').mockImplementation(()=>new DOMRect(64,index*50-scroller.scrollTop,500,30)));
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
 const top=tools.style.top;expect(top).toBe('160px');
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
 const {editor,field}=await setup('first\n\nsecond');
 const root=field.closest('.rich-editor') as HTMLElement;
 const scroller=root.parentElement!;scroller.style.overflowY='auto';
 Object.defineProperties(scroller,{scrollHeight:{value:600},clientHeight:{value:200}});
 vi.spyOn(scroller,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,300,200));
 vi.spyOn(editor.view,'posAtCoords').mockImplementation(()=>scroller.scrollTop ? null : {pos:9,inside:7});
 vi.spyOn(editor.view.nodeDOM(7) as HTMLElement,'getBoundingClientRect').mockImplementation(()=>new DOMRect(60,160-scroller.scrollTop,200,30));
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
 expect(screen.getByLabelText('文字格式').style.top).toBe('32px');
});
