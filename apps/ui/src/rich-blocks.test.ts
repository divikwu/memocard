// @vitest-environment jsdom
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, expect, it } from 'vitest';
import { Selection } from '@tiptap/pm/state';
import { BlockRangeSelection } from './rich-block-selection';
import { duplicateRichBlocks, moveRichBlock, moveRichBlocks, richBlockAt, richBlockMoveSources, richBlockMoveTarget, selectedRichBlocks, selectRichBlocks, selectRichBlockRange, type RichBlock } from './rich-blocks';
let editor: Editor;
afterEach(()=>editor?.destroy());
function setup(html: string) { editor=new Editor({extensions:[StarterKit.configure({trailingNode:false})],content:html});return editor; }
function block(text: string, type='listItem'): RichBlock {
 let found: RichBlock | null=null;editor.state.doc.descendants((node,pos)=>{if(node.type.name===type&&node.textContent===text)found=richBlockAt(editor,pos);});
 if(!found)throw new Error(`Missing ${type}: ${text}`);return found;
}
it('lifts forward and backward ranges across nested containers without splitting their structure',()=>{
 setup('<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li><li><p>Sibling</p></li></ul><p>After</p>');
 const before=editor.getJSON(),child=block('Child'),after=block('After','paragraph');
 selectRichBlockRange(editor,child,after);
 expect(editor.state.selection.from).toBe(0);expect(editor.state.selection.to).toBe(editor.state.doc.content.size);
 selectRichBlockRange(editor,after,child);
 expect(editor.state.selection.anchor).toBe(editor.state.doc.content.size);expect(editor.state.selection.head).toBe(0);
 selectRichBlockRange(editor,block('ParentChild'),child);
 expect(editor.state.selection.toJSON().type).toBe('node');expect(editor.state.selection.content().content.firstChild?.textContent).toBe('ParentChild');
 expect(editor.getJSON()).toEqual(before);
});
it('moves sibling paragraphs as a closed range and restores its selection on undo',()=>{
 setup('<p>A</p><p>B</p><p>C</p><p>D</p>');
 const sources=[block('B','paragraph'),block('C','paragraph')];selectRichBlocks(editor,sources);
 expect(editor.state.selection).toBeInstanceOf(BlockRangeSelection);
 expect(moveRichBlocks(editor,sources,block('D','paragraph'),true)).toBe(true);
 expect(editor.getText()).toBe('A\n\nD\n\nB\n\nC');
 expect(selectedRichBlocks(editor,editor.state.selection.from).map(b=>b.node.textContent)).toEqual(['B','C']);
 editor.commands.undo();expect(editor.getText()).toBe('A\n\nB\n\nC\n\nD');
 expect(editor.state.selection).toBeInstanceOf(BlockRangeSelection);
 expect(Selection.fromJSON(editor.state.doc,editor.state.selection.toJSON()).eq(editor.state.selection)).toBe(true);
});
it('duplicates a multi-block range preserving order and formatting',()=>{
 setup('<p><strong>A</strong></p><p>B</p><p>C</p>');
 duplicateRichBlocks(editor,[block('A','paragraph'),block('B','paragraph')]);
 expect(editor.getText()).toBe('A\n\nB\n\nA\n\nB\n\nC');expect(editor.getHTML().match(/<strong>/g)).toHaveLength(2);
 editor.commands.undo();expect(editor.getText()).toBe('A\n\nB\n\nC');
});
it('moves a sole nested item out and removes its now-empty list',()=>{
 setup('<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li><li><p>Sibling</p></li></ul>');
 expect(moveRichBlock(editor,block('Child'),block('Sibling'),false)).toBe(true);
 expect(editor.getHTML()).toBe('<ul><li><p>Parent</p></li><li><p>Child</p></li><li><p>Sibling</p></li></ul>');
 editor.commands.undo();expect(block('ParentChild').node.childCount).toBe(2);
});
it('moves an outer item into an existing child list preserving its own descendants',()=>{
 setup('<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li><li><p>Sibling</p><ul><li><p>Grandchild</p></li></ul></li></ul>');
 expect(moveRichBlock(editor,block('SiblingGrandchild'),block('Child'),true)).toBe(true);
 expect(editor.state.doc.firstChild?.childCount).toBe(1);
 expect(block('ParentChildSiblingGrandchild').node.child(1).childCount).toBe(2);
 expect(block('SiblingGrandchild').node.childCount).toBe(2);editor.state.doc.check();
});
it('moves between separate lists and rejects self descendants and incompatible targets',()=>{
 setup('<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li></ul><p>Between</p><ul><li><p>Other</p></li></ul>');
 const before=editor.getJSON();expect(moveRichBlock(editor,block('ParentChild'),block('Child'),true)).toBe(false);
 expect(moveRichBlock(editor,block('Child'),block('Between','paragraph'),true)).toBe(false);
 expect(editor.getJSON()).toEqual(before);
 expect(moveRichBlock(editor,block('ParentChild'),block('Other'),false)).toBe(true);
 expect(editor.state.doc.childCount).toBe(2);expect(editor.state.doc.firstChild?.textContent).toBe('Between');editor.state.doc.check();
});
it('maps a block selection after insertion and falls back safely after its deletion',()=>{
 setup('<p>A</p><p>B</p><p>C</p>');selectRichBlocks(editor,[block('B','paragraph'),block('C','paragraph')]);
 editor.view.dispatch(editor.state.tr.insert(0,editor.schema.nodes.paragraph.create(null,editor.schema.text('X'))));
 expect(selectedRichBlocks(editor,editor.state.selection.from).map(b=>b.node.textContent)).toEqual(['B','C']);
 editor.commands.deleteSelection();expect(editor.getText()).toBe('X\n\nA');expect(editor.state.selection.empty).toBe(true);
});
it('moves a complete group out of a nested list and rejects a stale drag source',()=>{
 setup('<ul><li><p>Parent</p><ul><li><p>A</p></li><li><p>B</p></li></ul></li><li><p>Sibling</p></li></ul>');
 expect(moveRichBlocks(editor,[block('A'),block('B')],block('Sibling'),true)).toBe(true);
 expect(editor.getHTML()).toBe('<ul><li><p>Parent</p></li><li><p>Sibling</p></li><li><p>A</p></li><li><p>B</p></li></ul>');
 const stale=block('A');editor.commands.insertContentAt(stale.pos+2,'Changed');
 const before=editor.getJSON();expect(moveRichBlock(editor,stale,block('Sibling'),false)).toBe(false);expect(editor.getJSON()).toEqual(before);
});
it('replaces a block range with text and restores both blocks and selection on undo',()=>{
 setup('<p>A</p><p>B</p><p>C</p>');selectRichBlocks(editor,[block('A','paragraph'),block('B','paragraph')]);
 editor.commands.insertContent('X');expect(editor.getText()).toBe('X\n\nC');editor.state.doc.check();
 editor.commands.undo();expect(editor.getText()).toBe('A\n\nB\n\nC');expect(editor.state.selection).toBeInstanceOf(BlockRangeSelection);
});
it('ignores a drag after an external document replacement removes its positions',()=>{
 setup('<p>A</p><p>B</p><p>C</p>');const source=block('C','paragraph'),target=block('B','paragraph');
 editor.commands.setContent('<p>X</p>');expect(moveRichBlock(editor,source,target,false)).toBe(false);expect(editor.getText()).toBe('X');
});
it('deletes a selected nested sibling group without leaving an empty list',()=>{
 setup('<ul><li><p>Parent</p><ul><li><p>A</p></li><li><p>B</p></li></ul></li><li><p>Sibling</p></li></ul>');
 selectRichBlocks(editor,[block('A'),block('B')]);editor.commands.deleteSelection();
 expect(editor.getHTML()).toBe('<ul><li><p>Parent</p></li><li><p>Sibling</p></li></ul>');
 editor.commands.undo();expect(block('ParentAB').node.child(1).childCount).toBe(2);
});
it('moves a heading with its descendants up to the next peer or enclosing heading',()=>{
 setup('<h1>Root</h1><h2>A</h2><p>Body A</p><h3>Child</h3><p>Child body</p><h2>B</h2><p>Body B</p><h1>Next</h1>');
 const sources=richBlockMoveSources(editor,block('A','heading').pos);
 expect(sources.map(b=>b.node.textContent)).toEqual(['A','Body A','Child','Child body']);
 expect(richBlockMoveTarget(editor,sources,-1,true)).toBeNull();
 const target=richBlockMoveTarget(editor,sources,1,true)!;
 expect(target.node.textContent).toBe('Body B');selectRichBlocks(editor,sources);
 expect(moveRichBlocks(editor,sources,target,true)).toBe(true);
 expect(editor.getText()).toBe('Root\n\nB\n\nBody B\n\nA\n\nBody A\n\nChild\n\nChild body\n\nNext');
 editor.commands.undo();expect(selectedRichBlocks(editor,editor.state.selection.from).map(b=>b.node.textContent)).toEqual(['A','Body A','Child','Child body']);
 editor.commands.redo();expect(editor.state.doc.child(1).textContent).toBe('B');editor.state.doc.check();
});
it('finds the preceding peer section without crossing an enclosing heading',()=>{
 setup('<h2>A</h2><p>Body A</p><h3>Child</h3><p>Child body</p><h2>B</h2><p>Body B</p><h1>Next</h1><h2>C</h2><p>Body C</p>');
 const sources=richBlockMoveSources(editor,block('B','heading').pos);
 expect(richBlockMoveTarget(editor,sources,-1,true)?.node.textContent).toBe('A');
 expect(richBlockMoveTarget(editor,sources,1,true)).toBeNull();
 expect(richBlockMoveTarget(editor,richBlockMoveSources(editor,block('C','heading').pos),-1,true)).toBeNull();
});
it('keeps an explicitly selected heading range instead of expanding its section',()=>{
 setup('<h2>A</h2><p>Selected</p><p>Unselected</p><h2>B</h2>');
 selectRichBlocks(editor,[block('A','heading'),block('Selected','paragraph')]);
 expect(richBlockMoveSources(editor,0,true).map(b=>b.node.textContent)).toEqual(['A','Selected']);
});
it('chooses the nearest list for modifier dragging, preserving nested content',()=>{
 setup('<ul><li><p>Parent</p><ul><li><p>Child A</p></li><li><p>Child B</p></li></ul></li><li><p>Sibling</p></li></ul><p>After</p>');
 const child=block('Child A');expect(richBlockMoveSources(editor,child.pos)[0].node.textContent).toBe('Child A');
 const nested=richBlockMoveSources(editor,child.pos,true)[0];expect(nested.node.type.name).toBe('bulletList');expect(nested.node.textContent).toBe('Child AChild B');
 const outer=richBlockMoveSources(editor,block('Sibling').pos,true)[0];expect(outer.parent).toBe(-1);
 expect(moveRichBlocks(editor,[outer],block('After','paragraph'),true)).toBe(true);
 expect(editor.state.doc.lastChild?.textContent).toBe('ParentChild AChild BSibling');
 editor.commands.undo();expect(editor.state.doc.firstChild?.type.name).toBe('bulletList');editor.state.doc.check();
});
it('rejects a section drag if any carried block changes during the gesture',()=>{
 setup('<h2>A</h2><p>Body A</p><h2>B</h2><p>Body B</p>');
 const sources=richBlockMoveSources(editor,0),target=block('Body B','paragraph');
 editor.commands.insertContentAt(sources[1].pos+1,'Changed');
 const before=editor.getJSON();expect(moveRichBlocks(editor,sources,target,true)).toBe(false);expect(editor.getJSON()).toEqual(before);
});
