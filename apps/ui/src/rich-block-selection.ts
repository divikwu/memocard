import { NodeSelection, Selection, type SelectionBookmark } from '@tiptap/pm/state';
import type { Node, ResolvedPos } from '@tiptap/pm/model';
import type { Mappable } from '@tiptap/pm/transform';

// A closed range of sibling blocks. Positions live in the editor transaction,
// so undo, clipboard slices and document changes share one selection model.
export class BlockRangeSelection extends Selection {
  constructor($anchor: ResolvedPos, $head: ResolvedPos) { super($anchor, $head); }
  static between(doc: Node, anchor: number, head: number): Selection {
    const $anchor = doc.resolve(anchor), $head = doc.resolve(head);
    if (anchor === head || !$anchor.sameParent($head) || $anchor.textOffset || $head.textOffset || $anchor.parent.inlineContent) return Selection.near($head);
    if ($anchor.nodeAfter?.nodeSize === head - anchor) return NodeSelection.create(doc, anchor);
    if ($head.nodeAfter?.nodeSize === anchor - head) return NodeSelection.create(doc, head);
    return new BlockRangeSelection($anchor, $head);
  }
  map(doc: Node, mapping: Mappable): Selection {
    const forward = this.anchor < this.head;
    return BlockRangeSelection.between(doc, mapping.map(this.anchor, forward ? 1 : -1), mapping.map(this.head, forward ? -1 : 1));
  }
  eq(other: Selection) { return other instanceof BlockRangeSelection && other.anchor === this.anchor && other.head === this.head; }
  toJSON() { return { type: 'blockRange', anchor: this.anchor, head: this.head }; }
  static fromJSON(doc: Node, json: { anchor: number; head: number }) { return BlockRangeSelection.between(doc, json.anchor, json.head); }
  getBookmark(): SelectionBookmark { return new BlockBookmark(this.anchor, this.head); }
}
BlockRangeSelection.prototype.visible = false;
Selection.jsonID('blockRange', BlockRangeSelection);
class BlockBookmark implements SelectionBookmark {
  constructor(readonly anchor: number, readonly head: number) {}
  map(mapping: Mappable) {
    const forward = this.anchor < this.head;
    return new BlockBookmark(mapping.map(this.anchor, forward ? 1 : -1), mapping.map(this.head, forward ? -1 : 1));
  }
  resolve(doc: Node) { return BlockRangeSelection.between(doc, this.anchor, this.head); }
}
