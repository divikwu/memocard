// @vitest-environment jsdom
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableCell } from '@tiptap/extension-table';
import { richTable, RichTableRow, RichTableHeader, alignRichColumn } from './rich-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Mathematics } from '@tiptap/extension-mathematics';
import Image from '@tiptap/extension-image';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { semanticExtensions, WikiLink, FootnoteReference, FootnoteDefinition } from './rich-semantic';
import { richBlockAt, moveRichBlock, moveRichBlocks, richBlockMoveSources, richBlockMoveTarget } from './rich-blocks';
import { MarkdownSource, SourceMetadata, PreservedMarkdown } from './wysiwyg-markdown';
const editors: Editor[] = [];
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); vi.unstubAllGlobals(); });
function setup(body: string) {
 const editor: Editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false }), Markdown, SourceMetadata, WikiLink, FootnoteReference, FootnoteDefinition, ...semanticExtensions(() => editor), PreservedMarkdown, richTable(() => editor), RichTableRow, RichTableHeader, TableCell, TaskList, TaskItem.configure({nested:true}), Image, Mathematics.configure({katexOptions:{output:'mathml',throwOnError:false,trust:false}})] });
 editors.push(editor);
 const source = new MarkdownSource(); editor.chain().setMeta('addToHistory',false).setContent(source.parse(editor, body), {emitUpdate:false}).run();
 return {editor, text: () => source.serialize(editor)};
}
it('renders headings, lists, tables and formulas as semantic content while editing', () => {
 const {editor} = setup('# 标题\n\n正文 **粗体**\n\n- first\n  - child\n- second\n\n| A | B |\n| --- | --- |\n| 一 | 二 |\n\n$x^2$\n\n$$\nx+1\n$$');
 expect(editor.view.dom.querySelector('h1')?.textContent).toBe('标题');
 expect(editor.view.dom.querySelector('strong')?.textContent).toBe('粗体');
 expect(editor.view.dom.querySelector('li li')?.textContent).toBe('child');
 expect(editor.view.dom.querySelector('td')?.textContent).toBe('一');
 expect(editor.view.dom.querySelectorAll('math').length).toBe(2);
});
it('does not rewrite untouched source including CRLF, raw HTML and reference definitions', () => {
 const body = '# heading\r\n\r\n<!-- raw -->\r\n\r\n[^one]: footnote\r\n\r\n* original\r\n';
 const {editor,text} = setup(body); expect(text()).toBe(body);
 editor.commands.insertContentAt(2, 'X');
 expect(text()).toBe('# hXeading\r\n\r\n<!-- raw -->\r\n\r\n[^one]: footnote\r\n\r\n* original\r\n');
 editor.commands.undo(); expect(text()).toBe(body);
});
it('edits a table cell and formula without losing neighbouring original source', () => {
 const body = '___\n\n| A | B |\n| --- | --- |\n| 一 | 二 |\n\n$$\nx+1\n$$\n\n* original';
 const {editor,text} = setup(body);
 let cell = -1, math = -1;
 editor.state.doc.descendants((node,pos) => { if (node.isText && node.text === '一') cell = pos; if(node.type.name === 'blockMath') math = pos; });
 expect(cell).toBeGreaterThan(0); expect(math).toBeGreaterThan(0);
 editor.commands.insertContentAt(cell, '新');
 math = -1; editor.state.doc.descendants((node,pos) => { if(node.type.name === 'blockMath') math = pos; });
 editor.commands.updateBlockMath({pos:math,latex:'x+2'});
 expect(text()).toContain('新一'); expect(text()).toContain('x+2'); expect(text()).toMatch(/^___\n\n/); expect(text()).toMatch(/\n\n\* original$/);
 const reopened = setup(text()); expect(reopened.editor.view.dom.querySelector('td')?.textContent).toBe('新一');
 expect(reopened.editor.state.doc.toJSON()).toEqual(expect.objectContaining({type:'doc'}));
});
it('saves an empty existing document as empty Markdown', () => { const {editor,text}=setup('hello'); editor.commands.clearContent(); expect(text()).toBe(''); });
it('keeps relative attachment targets through edits', () => {
 const {editor,text}=setup('![图片](../../assets/a.png)\n\ntext');
 editor.commands.insertContentAt(editor.state.doc.content.size-1,'!');
 expect(text()).toBe('![图片](../../assets/a.png)\n\ntext!');
});

it('edits semantic HTML, Wiki labels and footnotes without exposing source markers', () => {
 const body='正文 <mark>重点</mark> [[笔记|名字]] 和脚注[^1]\n\n[^1]: 注释\n\n<details><summary>摘要</summary><p>内部正文</p></details>';
 const {editor,text}=setup(body);
 expect(editor.view.dom.querySelector('mark')?.textContent).toBe('重点');
 expect(editor.view.dom.querySelector('a[data-wiki-target]')?.textContent).toBe('名字');
 expect(editor.view.dom.querySelector('sup')?.textContent).toBe('1');
 expect(editor.view.dom.querySelector('summary')?.textContent).toBe('摘要');
 expect(text()).toBe(body);
 let position=0;editor.state.doc.descendants((node,pos)=>{if(node.isText&&node.text==='内部正文')position=pos;});
 editor.commands.insertContentAt(position,'新');
 expect(text()).toContain('<p>新内部正文</p>');expect(text()).toContain('[[笔记|名字]]');
 expect(text()).not.toContain('<details open');
});
it('moves a list item with its children within and across compatible lists reversibly',()=>{
 const body='* parent\n  * child\n* second\n\nparagraph\n\n- other';
 const {editor,text}=setup(body);
 const items: number[]=[];editor.state.doc.descendants((node,pos)=>{if(node.type.name==='listItem')items.push(pos);});
 expect(moveRichBlock(editor,richBlockAt(editor,items[0])!,richBlockAt(editor,items[2])!,true)).toBe(true);
 expect(editor.state.doc.firstChild?.firstChild?.textContent).toBe('second');
 editor.commands.undo();expect(text()).toBe(body);
 expect(moveRichBlock(editor,richBlockAt(editor,items[0])!,richBlockAt(editor,items[3])!,true)).toBe(true);
 expect(editor.state.doc.lastChild?.lastChild?.textContent).toBe('parentchild');
 expect(editor.state.doc.child(1).textContent).toBe('paragraph');
 editor.commands.undo();expect(text()).toBe(body);
});
it('round-trips moved sections while preserving untouched Markdown and raw blocks',()=>{
 const body='## A\n\n* original\n\n### Child\n\n<!-- untouched -->\n\n## B\n\nBody B';
 const moved='## B\n\nBody B\n\n## A\n\n* original\n\n### Child\n\n<!-- untouched -->';
 const {editor,text}=setup(body),sources=richBlockMoveSources(editor,0);
 expect(moveRichBlocks(editor,sources,richBlockMoveTarget(editor,sources,1,true)!,true)).toBe(true);
 expect(text()).toBe(moved);
 const reopened=setup(text());expect(reopened.text()).toBe(moved);expect(reopened.editor.state.doc.child(0).textContent).toBe('B');
 editor.commands.undo();expect(text()).toBe(body);editor.commands.redo();expect(text()).toBe(moved);
});
it.each(['3. First\n4. Second', '- [x] Done\n  - [ ] Child\n- [ ] Todo'])('moves an entire list preserving numbering or checkbox state: %s',list=>{
 const body=`intro\n\n${list}\n\nafter`,{editor,text}=setup(body);
 let item=0;editor.state.doc.descendants((node,pos)=>{if(['listItem','taskItem'].includes(node.type.name))item=pos;});
 const sources=richBlockMoveSources(editor,item,true);
 const target=richBlockAt(editor,editor.state.doc.content.size-editor.state.doc.lastChild!.nodeSize)!;
 expect(moveRichBlocks(editor,sources,target,true)).toBe(true);expect(text()).toBe(`intro\n\nafter\n\n${list}`);
 editor.commands.undo();expect(text()).toBe(body);
});
it('keeps code editable even when its examples contain unknown HTML', () => {
 const {editor,text}=setup('```html\n<custom>code</custom>\n```\n\nUse `<custom>` here.');
 expect(editor.state.doc.firstChild?.type.name).toBe('codeBlock');
 expect(editor.state.doc.lastChild?.type.name).toBe('paragraph');
 editor.commands.insertContentAt(1,'x');expect(text()).toContain('x<custom>code</custom>');
});
it('resolves reference links while preserving their definitions',()=>{
 const {editor,text}=setup('Go to [site][ref].\n\n[ref]: https://example.com');
 expect(editor.view.dom.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
 editor.commands.insertContentAt(1,'Now ');expect(text()).toContain('[ref]: https://example.com');
});
it('can address and edit the last block beyond the old preview parser range',()=>{
 const body=Array.from({length:700},(_,i)=>`第${i+1}段：长文内容`).join('\n\n');
 const {editor,text}=setup(body);
 editor.commands.insertContentAt(editor.state.doc.content.size-1,'末尾');
 expect(text()).toBe(body+'末尾');editor.commands.undo();expect(text()).toBe(body);
});
it('keeps a multi-paragraph footnote together through editing, reopening and undo', () => {
 const body = 'Text[^a]\n\n[^a]: first\n\n    second **bold**\n\n    - nested\n\nnext';
 const {editor,text}=setup(body);
 const footnote=editor.state.doc.child(1);
 expect(footnote.type.name).toBe('footnoteDefinition');expect(footnote.childCount).toBe(3);
 expect(text()).toBe(body);
 let pos=0; editor.state.doc.descendants((node,at)=>{if(node.isText&&node.text?.startsWith('second'))pos=at;});
 editor.commands.insertContentAt(pos,'edited ');
 const reopened=setup(text());expect(reopened.editor.state.doc.child(1).childCount).toBe(3);
 expect(reopened.editor.state.doc.child(1).textContent).toContain('edited second');
 editor.commands.undo();expect(text()).toBe(body);
});
it('preserves table captions, footer rows and merged cells when edited',()=>{
 const body='<table><caption>Summary</caption><tbody><tr><th scope="col">A</th><th>B</th></tr><tr><td colspan="2">Total</td></tr></tbody><tfoot><tr><td>End</td><td>2</td></tr></tfoot></table>';
 const {editor,text}=setup(body);
 expect(editor.state.doc.firstChild?.type.name).toBe('table');
 expect(editor.state.doc.firstChild?.attrs.caption).toBe('Summary');
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.isText&&node.text==='Total')pos=at;});
 editor.commands.insertContentAt(pos,'New ');
 expect(text()).toContain('<caption>Summary</caption>');expect(text()).toContain('<tfoot>');expect(text()).toContain('colspan="2"');
 expect(setup(text()).editor.state.doc.firstChild?.attrs.caption).toBe('Summary');
 editor.commands.undo();expect(text()).toBe(body);
});
it('saves changed table alignment as Markdown and semantic formatting as HTML',()=>{
 const {editor,text}=setup('| A | B |\n| --- | --- |\n| one | two |');
 editor.commands.setTextSelection(3);alignRichColumn(editor,'right');
 expect(text()).toContain('---:');
 const reopened=setup(text());expect(reopened.editor.view.dom.querySelector('th')?.style.textAlign).toBe('right');
 const formatted=setup('word');formatted.editor.commands.setTextSelection({from:1,to:5});formatted.editor.commands.setMark('abbr',{title:'description'});formatted.editor.commands.setMark('mark');
 expect(formatted.text()).toContain('<abbr title="description">');expect(setup(formatted.text()).editor.view.dom.querySelector('mark')).toBeTruthy();
});
it('retains a standalone HTML comment as a protected block',()=>{
 const {editor,text}=setup('<!-- original -->');expect(editor.state.doc.firstChild?.type.name).toBe('preservedMarkdown');expect(text()).toBe('<!-- original -->');
});
it('retains mixed cell alignment as HTML rather than losing it to GFM',()=>{
 const {editor,text}=setup('| A | B |\n| --- | --- |\n| one | two |');
 let pos=0;editor.state.doc.descendants((node,at)=>{if(node.isText&&node.text==='one')pos=at;});
 editor.commands.setTextSelection(pos);editor.commands.setCellAttribute('align','right');
 expect(text()).toContain('align="right"');expect(setup(text()).editor.view.dom.querySelector('td')?.style.textAlign).toBe('right');
});
it('does not turn footnote examples inside code fences into definitions',()=>{
 const body='```md\n[^sample]: example\n\n    continuation\n```\n\ntext';
 const {editor,text}=setup(body);expect(editor.state.doc.firstChild?.type.name).toBe('codeBlock');expect(editor.state.doc.childCount).toBe(2);expect(text()).toBe(body);
});
