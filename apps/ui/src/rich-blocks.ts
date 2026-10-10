import { closeHistory } from '@tiptap/pm/history';
import type { Editor } from '@tiptap/react';
import { AllSelection } from '@tiptap/pm/state';
import { Fragment, type Node } from '@tiptap/pm/model';
import { BlockRangeSelection } from './rich-block-selection';
export type RichBlock = { pos: number; parent: number; node: Node; index: number };
export function richBlock(editor: Editor, position: number): RichBlock | null {
  const resolved = editor.state.doc.resolve(Math.max(0, Math.min(position, editor.state.doc.content.size)));
  if (['listItem', 'taskItem'].includes(resolved.nodeAfter?.type.name ?? '')) return richBlockAt(editor, resolved.pos);
  let depth = resolved.depth;
  while (depth > 1 && !['listItem', 'taskItem'].includes(resolved.node(depth).type.name)) depth--;
  if (!depth) {
    const node = resolved.nodeAfter;
    return node ? { pos: resolved.pos, parent: -1, node, index: resolved.index() } : null;
  }
  return { pos: resolved.before(depth), parent: depth === 1 ? -1 : resolved.before(depth - 1), node: resolved.node(depth), index: resolved.index(depth - 1) };
}
export function selectedRichBlocks(editor: Editor, fallback: number): RichBlock[] {
  const { selection, doc } = editor.state;
  if (selection instanceof BlockRangeSelection || selection instanceof AllSelection) {
    const blocks: RichBlock[] = [];
    for (let pos = selection.from; pos < selection.to;) {
      const block = richBlockAt(editor, pos);
      if (!block || !block.node.isBlock) return [];
      blocks.push(block); pos += block.node.nodeSize;
    }
    if (fallback >= selection.from && fallback < selection.to || selection instanceof AllSelection) return blocks;
  }
  const block = richBlockAt(editor, fallback);
  return block && doc.nodeAt(fallback)?.isBlock ? [block] : [];
}
export function richSectionEnd(doc: Node, pos: number): number {
  const resolved = doc.resolve(pos), heading = resolved.nodeAfter!;
  let end = pos + heading.nodeSize;
  for (let index = resolved.index() + 1; index < resolved.parent.childCount; index++) {
    const node = resolved.parent.child(index);
    if (node.type.name === 'heading' && node.attrs.level <= heading.attrs.level) break;
    end += node.nodeSize;
  }
  return end;
}
function sectionBlocks(editor: Editor, heading: RichBlock): RichBlock[] {
  const blocks = [heading], parent = editor.state.doc.resolve(heading.pos).parent;
  const end = richSectionEnd(editor.state.doc, heading.pos);
  for (let pos = heading.pos + heading.node.nodeSize, index = heading.index + 1; pos < end; index++) {
    const node = parent.child(index);
    blocks.push({ pos, parent: heading.parent, node, index }); pos += node.nodeSize;
  }
  return blocks;
}
export function richBlockMoveSources(editor: Editor, fallback: number, wholeList = false): RichBlock[] {
  const blocks = selectedRichBlocks(editor, fallback);
  // An explicit range remains the user's target, including ranges that contain headings.
  if (blocks.length !== 1 || editor.state.selection instanceof AllSelection) return blocks;
  const block = blocks[0];
  if (wholeList) {
    const resolved = editor.state.doc.resolve(block.pos);
    for (let depth = resolved.depth; depth > 0; depth--) {
      if (['bulletList', 'orderedList', 'taskList'].includes(resolved.node(depth).type.name)) {
        const list = richBlockAt(editor, resolved.before(depth));
        if (list) return [list];
      }
    }
  }
  return block.node.type.name === 'heading' ? sectionBlocks(editor, block) : blocks;
}
export function richBlockMoveTarget(editor: Editor, blocks: RichBlock[], direction: number, section = false): RichBlock | null {
  if (!blocks.length) return null;
  const edge = direction < 0 ? blocks[0] : blocks[blocks.length - 1];
  const parent = editor.state.doc.resolve(edge.pos).parent;
  let index = edge.index + direction, pos = direction < 0 && index >= 0 ? edge.pos - parent.child(index).nodeSize : edge.pos + edge.node.nodeSize;
  while (index >= 0 && index < parent.childCount) {
    const node = parent.child(index), target = { pos, parent: edge.parent, node, index };
    if (!section) return target;
    if (node.type.name === 'heading' && node.attrs.level <= blocks[0].node.attrs.level) {
      // Menu moves swap peer sections without crossing their enclosing heading.
      if (node.attrs.level !== blocks[0].node.attrs.level) return null;
      return direction < 0 ? target : sectionBlocks(editor, target).at(-1)!;
    }
    index += direction;
    pos += direction < 0 && index >= 0 ? -parent.child(index).nodeSize : node.nodeSize;
  }
  return null;
}
export function selectRichBlocks(editor: Editor, blocks: RichBlock[]) {
  if (!blocks.length) return;
  const first = blocks[0], last = blocks[blocks.length - 1];
  editor.view.dispatch(editor.state.tr.setSelection(BlockRangeSelection.between(editor.state.doc, first.pos, last.pos + last.node.nodeSize)));
}
export function selectRichBlockRange(editor: Editor, anchor: RichBlock, target: RichBlock) {
  const { doc } = editor.state;
  const $anchor = doc.resolve(anchor.pos), $target = doc.resolve(target.pos);
  const depth = $anchor.sharedDepth(target.pos);
  const fromBlock = $anchor.depth > depth ? richBlockAt(editor, $anchor.before(depth + 1))! : anchor;
  const toBlock = $target.depth > depth ? richBlockAt(editor, $target.before(depth + 1))! : target;
  const forward = fromBlock.pos <= toBlock.pos;
  editor.view.dispatch(editor.state.tr.setSelection(BlockRangeSelection.between(doc,
    forward ? fromBlock.pos : fromBlock.pos + fromBlock.node.nodeSize,
    forward ? toBlock.pos + toBlock.node.nodeSize : toBlock.pos)));
}
export function extendRichBlocksTo(editor: Editor, target: RichBlock): boolean {
  const selection = editor.state.selection;
  const anchor = richBlock(editor, selection instanceof BlockRangeSelection && selection.anchor > selection.head ? selection.anchor - 1 : selection.anchor);
  if (!anchor || anchor.parent !== target.parent) return false;
  const forward = anchor.pos <= target.pos;
  editor.view.dispatch(editor.state.tr.setSelection(BlockRangeSelection.between(editor.state.doc,
    forward ? anchor.pos : anchor.pos + anchor.node.nodeSize, forward ? target.pos + target.node.nodeSize : target.pos)));
  editor.view.focus(); return true;
}
export function blockMoveTransaction(editor: Editor, sources: RichBlock[], target: RichBlock, after: boolean) {
  if (!editor.isEditable || editor.view.composing || !sources.length) return null;
  const { doc } = editor.state, first = sources[0], last = sources[sources.length - 1];
  const from = first.pos, to = last.pos + last.node.nodeSize;
  if (from < 0 || to > doc.content.size || target.pos < 0 || target.pos + target.node.nodeSize > doc.content.size) return null;
  if (sources.some((block, i) => block.parent !== first.parent || !doc.nodeAt(block.pos)?.eq(block.node) || i > 0 && sources[i - 1].pos + sources[i - 1].node.nodeSize !== block.pos)) return null;
  if (!doc.nodeAt(target.pos)?.eq(target.node)) return null;
  const destination = target.pos + (after ? target.node.nodeSize : 0);
  if (target.pos >= from && target.pos < to || destination >= from && destination <= to) return null;
  // Cross-container moves are limited to compatible list items, not arbitrary wrappers.
  if (first.parent !== target.parent && sources.some(block => !['listItem', 'taskItem'].includes(block.node.type.name) || block.node.type !== target.node.type)) return null;
  const content = Fragment.fromArray(sources.map(block => block.node));
  const $target = doc.resolve(destination);
  if (!$target.parent.canReplace($target.index(), $target.index(), content)) return null;
  const tr = editor.state.tr.deleteRange(from, to);
  const mapped = tr.mapping.map(destination);
  const $mapped = tr.doc.resolve(mapped);
  if (!$mapped.parent.canReplace($mapped.index(), $mapped.index(), content)) return null;
  tr.insert(mapped, content).setSelection(BlockRangeSelection.between(tr.doc, mapped, mapped + content.size));
  return tr;
}
export function moveRichBlocks(editor: Editor, sources: RichBlock[], target: RichBlock, after: boolean): boolean {
  const tr = blockMoveTransaction(editor, sources, target, after);
  if (!tr) return false;
  editRichStructure(editor, () => editor.view.dispatch(tr.scrollIntoView())); editor.view.focus(); return true;
}
export function moveRichBlock(editor: Editor, source: RichBlock, target: RichBlock, after: boolean): boolean {
  return moveRichBlocks(editor, [source], target, after);
}
export function duplicateRichBlocks(editor: Editor, blocks: RichBlock[]): boolean {
  if (!editor.isEditable || editor.view.composing || !blocks.length) return false;
  const last = blocks[blocks.length - 1], pos = last.pos + last.node.nodeSize;
  const content = Fragment.fromArray(blocks.map(block => block.node));
  const tr = editor.state.tr.insert(pos, content);
  tr.setSelection(BlockRangeSelection.between(tr.doc, pos, pos + content.size));
  editRichStructure(editor, () => editor.view.dispatch(tr.scrollIntoView())); editor.view.focus(); return true;
}

export function richBlockAt(editor: Editor, pos: number): RichBlock | null {
  if (pos < 0 || pos >= editor.state.doc.content.size) return null;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return null;
  const resolved = editor.state.doc.resolve(pos);
  return { pos, node, parent: resolved.depth ? resolved.before(resolved.depth) : -1, index: resolved.index() };
}

export function editRichStructure(editor: Editor, operation: () => void) {
  if (editor.view.composing) return;
  editor.view.dispatch(closeHistory(editor.state.tr));
  operation();
  editor.view.dispatch(closeHistory(editor.state.tr));
}
