import { Popover as PopoverPrimitive } from "radix-ui";
import { Plus, GripVertical, Type, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListOrdered, ListTodo, Quote, Code, Minus, ArrowUp, ArrowDown, Copy, Trash2, IndentIncrease, IndentDecrease, ImagePlus, type LucideIcon } from "lucide-react";
import { imageSource, openVaultLink } from "./vault-links";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Annotation, Compartment, EditorState, Prec, StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, EditorView, keymap, placeholder, WidgetType, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage, insertNewlineContinueMarkup } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { decodeString } from "micromark-util-decode-string";
import { GFM } from "@lezer/markdown";
import { blocks, blockAt, blockAction, canBlockAction, moveBlock, type Block, type BlockAction } from "./markdown-blocks";
import { request } from "./bridge";
import { externalUrl, internalTarget } from "./urls";
import { bindNoteImage } from "./note-image";
import { editorSeparators, separatorSelection } from './editor-separators';
import './block-controls.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  notePath: string;
  disabled: boolean;
  onSave: () => void;
  onImage?: (insert: (markdown: string) => void) => void;
  onError: (message: string) => void;
};

function dropDestination(editor: EditorView, source: Block, x: number, y: number) {
  const position = editor.posAtCoords({ x, y });
  const separator = position === null ? undefined : editorSeparators(editor.state).find(range => position > range.from && position <= range.to);
  const target = position === null ? undefined : blockAt(editor.state, separator ? separator.to + 1 : position);
  if (!target || target.parent !== source.parent || target.from === source.from) return;
  const start = editor.coordsAtPos(target.from), end = editor.coordsAtPos(target.to);
  if (!start || !end) return;
  const after = !separator && y >= (start.top + end.bottom) / 2;
  const siblings = blocks(editor.state).filter(block => block.parent === source.parent);
  const sourceIndex = siblings.findIndex(block => block.from === source.from);
  const insertion = siblings.findIndex(block => block.from === target.from) + Number(after);
  const index = insertion - Number(sourceIndex < insertion);
  if (sourceIndex < 0 || index === sourceIndex) return;
  return { target: siblings[index], top: after ? end.bottom : start.top };
}

const externalChange = Annotation.define<boolean>();
const notePathChanged = StateEffect.define<string>();
const focusChanged = StateEffect.define<boolean>();
const imageCleanup = new WeakMap<HTMLElement, () => void>();

class ImagePreview extends WidgetType {
  constructor(readonly src: string, readonly alt: string) { super(); }
  eq(other: ImagePreview) { return this.src === other.src && this.alt === other.alt; }
  toDOM() {
    const image = document.createElement("img");
    image.className = "mc-live-image";
    image.alt = this.alt;
    image.draggable = false;
    imageCleanup.set(image, bindNoteImage(image, this.src));
    return image;
  }
  destroy(dom: HTMLElement) { imageCleanup.get(dom)?.(); imageCleanup.delete(dom); }
  ignoreEvent() { return false; }
}

class ListMarker extends WidgetType {
  constructor(readonly text: string) { super(); }
  eq(other: ListMarker) { return this.text === other.text; }
  toDOM() {
    const marker = document.createElement('span');
    marker.className = 'mc-live-list-marker';
    marker.textContent = this.text;
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }
  ignoreEvent() { return false; }
}

class TaskCheckbox extends WidgetType {
  constructor(readonly checked: boolean, readonly from: number, readonly label: string) { super(); }
  eq(other: TaskCheckbox) { return this.checked === other.checked && this.from === other.from && this.label === other.label; }
  toDOM(view: EditorView) {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = this.checked;
    input.setAttribute('aria-label', `待办：${this.label}`); input.disabled = view.state.readOnly;
    input.addEventListener('change', () => {
      if (view.state.readOnly || view.composing) return;
      view.dispatch({ changes: { from: this.from, to: this.from + 3, insert: input.checked ? '[x]' : '[ ]' }, userEvent: 'input.task' });
    });
    return input;
  }
  ignoreEvent() { return true; }
}

function liveDecorations(state: EditorState, notePath: string, focused: boolean): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const selection = state.selection.main;
  const activeFrom = state.doc.lineAt(selection.from).from;
  const activeTo = state.doc.lineAt(selection.to).to;
  const active = (from: number, to: number) => focused && selection.empty && from <= activeTo && to >= activeFrom;
  if (!selection.empty) {
    const selectedLines = new Set<number>();
    for (const block of blocks(state)) {
      if (/^(BulletList|OrderedList)$/.test(block.kind) || block.from < selection.from || block.to > selection.to) continue;
      for (let number = state.doc.lineAt(block.from).number; number <= state.doc.lineAt(block.to).number; number++) {
        const line = state.doc.line(number);
        if (line.text.trim()) selectedLines.add(line.from);
      }
    }
    for (const from of selectedLines) ranges.push(Decoration.line({ class: 'mc-block-selected' }).range(from));
    if (selectedLines.size) {
      for (let number = state.doc.lineAt(selection.from).number; number <= state.doc.lineAt(selection.to).number; number++) {
        const line = state.doc.line(number);
        if (!line.text.trim() && line.from >= selection.from && line.to < selection.to) {
          ranges.push(Decoration.line({ class: 'mc-block-selection-gap' }).range(line.from));
        }
      }
    }
  }
  const mark = (from: number, to: number, className: string) => {
    if (to > from) ranges.push(Decoration.mark({ class: className }).range(from, to));
  };
  const hide = (from: number, to: number) => {
    if (to > from && state.doc.lineAt(from).number === state.doc.lineAt(to).number) ranges.push(Decoration.replace({}).range(from, to));
  };
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state);
  tree.iterate({ enter(reference) {
    const node = reference.node;
    const { from, to, name } = node;
    const editing = active(from, to);
    const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
    if (heading) ranges.push(Decoration.line({ class: `mc-live-heading mc-live-heading-${heading[1]}` }).range(state.doc.lineAt(from).from));
    if (name === 'TaskMarker') ranges.push(Decoration.replace({ widget: new TaskCheckbox(state.sliceDoc(from, to).toLowerCase() === '[x]', from, state.sliceDoc(to, state.doc.lineAt(to).to).trim()) }).range(from, to));
    if (name === "StrongEmphasis") mark(from, to, "mc-live-strong");
    if (name === "Emphasis") mark(from, to, "mc-live-emphasis");
    if (name === "Strikethrough") mark(from, to, "mc-live-strike");
    if (name === "InlineCode") mark(from, to, "mc-live-inline-code");
    if (name === "FencedCode" || name === "CodeBlock") {
      for (let line = state.doc.lineAt(from); line.from < to; line = state.doc.line(line.number + 1)) {
        ranges.push(Decoration.line({ class: "mc-live-code-line" }).range(line.from));
        if (line.number === state.doc.lines) break;
      }
    }
    if (name === 'Blockquote' || name === 'Table') {
      for (let line = state.doc.lineAt(from); line.from < to; line = state.doc.line(line.number + 1)) {
        ranges.push(Decoration.line({ class: name === 'Table' ? 'mc-live-table-line' : 'mc-live-quote-line' }).range(line.from));
        if (line.number === state.doc.lines) break;
      }
    }
    if (name === 'HorizontalRule') {
      ranges.push(Decoration.line({ class: editing ? 'mc-live-rule' : 'mc-live-rule mc-live-rule-preview' }).range(state.doc.lineAt(from).from));
      if (!editing) hide(from, to);
    }
    if (name === 'QuoteMark' && !editing) hide(from, to + Number(state.sliceDoc(to, to + 1) === ' '));
    if (name === 'ListMark' && !editing) {
      const end = to + Number(state.sliceDoc(to, to + 1) === ' ');
      if (/^\[[ xX]\]/.test(state.sliceDoc(end, end + 3))) hide(from, end);
      else {
        let depth = 0;
        for (let parent = node.parent; parent; parent = parent.parent) if (parent.name === 'BulletList') depth++;
        const text = node.parent?.parent?.name === 'OrderedList' ? state.sliceDoc(from, to).replace(/\)$/, '.') : ['•', '◦', '▪'][Math.min(2, Math.max(0, depth - 1))];
        ranges.push(Decoration.line({ class: 'mc-live-list-line' }).range(state.doc.lineAt(from).from));
        ranges.push(Decoration.replace({ widget: new ListMarker(text) }).range(from, end));
      }
    }
    if (name === "QuoteMark") mark(from, to, "mc-live-quote");
    if (name === "ListMark" || name === "CodeInfo") mark(from, to, "mc-live-marker");
    if (name === "Image" || name === "Link") {
      const url = node.getChild("URL");
      // Reference-style and unfamiliar syntax stay editable as written.
      if (!url) return false;
      const raw = decodeString(state.doc.sliceString(url.from, url.to).replace(/^<|>$/g, ""));
      const closing = node.getChildren("LinkMark").find((child) => state.doc.sliceString(child.from, child.to) === "]");
      if (!closing) return false;
      if (name === "Image") {
        const src = imageSource(raw, notePath);
        if (!src) { mark(from, to, "mc-live-blocked"); return false; }
        const widget = new ImagePreview(src, state.doc.sliceString(from + 2, closing.from));
        if (!editing && state.doc.lineAt(from).number === state.doc.lineAt(to).number) {
          ranges.push(Decoration.replace({ widget }).range(from, to));
        } else ranges.push(Decoration.widget({ widget, side: 1 }).range(to));
      } else {
        const href = externalUrl(raw) ?? (internalTarget(raw) ? `memocard-internal:${encodeURIComponent(raw)}` : null);
        if (href) ranges.push(Decoration.mark({
          class: "mc-live-link", tagName: "a", attributes: { href, "data-memocard-link": href, title: "⌘ / Ctrl + 单击打开链接", tabindex: "-1" },
        }).range(from + 1, closing.from));
        if (!editing && href) { hide(from, from + 1); hide(closing.from, to); }
      }
      return false;
    }
    if ((name === "EmphasisMark" || name === "StrikethroughMark" || (name === "CodeMark" && node.parent?.name === "InlineCode")) && !editing) hide(from, to);
    if (name === "HeaderMark" && node.parent?.name.startsWith("ATXHeading") && !editing) {
      hide(from, to + (state.doc.sliceString(to, to + 1) === " " ? 1 : 0));
    }
  } });
  // Match typeset.css element spacing; Markdown separator lines carry the gap
  // instead of adding another line-height on top of it.
  const headingScale = (name: string) => [1, 1.75, 1.25, 1.125, 1, 0.875, 0.8125][Number(/Heading([1-6])$/.exec(name)?.[1] ?? 0)];
  tree.iterate({ enter(ref) {
    const node = ref.node, parent = node.parent, previous = node.prevSibling;
    const topLevel = parent?.name === 'Document';
    const listItem = node.name === 'ListItem';
    if ((!topLevel && !listItem) || !previous) return;
    const scale = headingScale(node.name);
    let space = 'var(--note-flow, 1em)';
    if (listItem) space = '0.5em';
    else if (/Heading[1-6]$/.test(node.name)) {
      const factor = /Heading[12]$/.test(node.name) ? 1.75 : /Heading3$/.test(node.name) ? 1.125 : 1;
      space = `calc(var(--note-flow, 1em) * ${factor})`;
    } else if (node.name === 'HorizontalRule') space = 'calc(var(--note-flow, 1em) * 2.4)';
    if (topLevel && /Heading[1-6]$/.test(previous.name) && !['FencedCode', 'CodeBlock', 'HorizontalRule'].includes(node.name)) space = `${scale}em`;
    if (previous.name === 'HorizontalRule' && /Heading[1-4]$/.test(node.name)) space = `calc(var(--note-flow, 1em) * ${scale})`;
    const next = state.doc.lineAt(node.from);
    ranges.push(Decoration.line({ class: 'mc-live-block-start', attributes: { style: `--editor-block-space: calc(${space} / ${scale})` } }).range(next.from));
  } });
  for (const separator of editorSeparators(state)) ranges.push(Decoration.replace({}).range(separator.from, separator.to));
  for (const match of state.doc.toString().matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
    const from = match.index!, to = from + match[0].length;
    let node = tree.resolveInner(from, 1);
    let code = false;
    while (node.parent) { if (["InlineCode", "FencedCode", "CodeBlock", "Link", "Image"].includes(node.name)) code = true; node = node.parent; }
    if (code) continue;
    const [target, label] = match[2].split("|");
    if (match[1]) {
      if (!/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(target)) continue;
      const src = imageSource(target, notePath, true);
      if (!src) continue;
      const widget = new ImagePreview(src, label ?? target);
      if (!active(from, to)) ranges.push(Decoration.replace({ widget }).range(from, to));
      else ranges.push(Decoration.widget({ widget, side: 1 }).range(to));
    } else ranges.push(Decoration.mark({ class: "mc-live-link", tagName: "a", attributes: { "data-memocard-wiki": target, title: "⌘ / Ctrl + 单击打开笔记", tabindex: "-1" } }).range(from, to));
  }
  return Decoration.set(ranges, true);
}

function previewExtension(initialPath: string) {
  return StateField.define<{ decorations: DecorationSet; path: string; focused: boolean }>({
    create(state) { return { decorations: liveDecorations(state, initialPath, false), path: initialPath, focused: false }; },
    update(previous, transaction) {
      let { path, focused } = previous;
      for (const effect of transaction.effects) {
        if (effect.is(notePathChanged)) path = effect.value;
        if (effect.is(focusChanged)) focused = effect.value;
      }
      if (!transaction.docChanged && !transaction.selection && !transaction.effects.length) return previous;
      return { path, focused, decorations: liveDecorations(transaction.state, path, focused) };
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });
}

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--foreground)", fontFamily: "var(--note-body-font)", fontSize: "var(--note-size, 16px)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto", fontFamily: "inherit", lineHeight: "var(--note-leading, 1.6)" },
  ".cm-content": { minHeight: "100%", padding: "12px var(--editor-inset-right, 16px) 24px var(--editor-gutter, 64px)", caretColor: "var(--foreground)", overflowWrap: "anywhere" },
  ".cm-line": { padding: "0" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "var(--accent)" },
  ".mc-block-selected": { position: "relative", isolation: "isolate" },
  ".mc-block-selected::before": { content: '""', position: "absolute", inset: "1px -6px", borderRadius: "4px", backgroundColor: "var(--note-block-selection, rgba(35, 131, 226, 0.14))", zIndex: "-1", pointerEvents: "none" },
  ".mc-block-selected::selection, .mc-block-selected *::selection, .mc-block-selection-gap::selection, .mc-block-selection-gap *::selection": { backgroundColor: "transparent" },
  ".mc-live-heading": { fontWeight: "600", lineHeight: "1.5", fontFamily: "var(--note-heading-font)" },
  ".mc-live-heading-1": { fontSize: "1.75em", lineHeight: "1.3" },
  ".mc-live-heading-2": { fontSize: "1.25em", lineHeight: "1.4" },
  ".mc-live-heading-3": { fontSize: "1.125em", lineHeight: "1.45" },
  ".mc-live-heading-4": { fontSize: "1em" },
  ".mc-live-heading-5": { fontSize: "0.875em", fontWeight: "500", color: "var(--muted-foreground)" },
  ".mc-live-heading-6": { fontSize: "0.8125em", fontWeight: "500", letterSpacing: "0.08em", color: "var(--muted-foreground)" },
  ".mc-live-block-start": { paddingTop: "var(--editor-block-space)" },
  ".mc-live-quote-line": { borderLeft: "2px solid var(--border)", paddingLeft: "1em" },
  ".mc-live-table-line": { fontFamily: "var(--note-mono-font)", backgroundColor: "var(--muted)", fontSize: "0.875em" },
  ".mc-live-list-line": { paddingLeft: "1.9em", textIndent: "-1.9em" },
  ".mc-live-list-marker": { display: "inline-block", width: "1.9em", textIndent: "0", paddingRight: "0.4em", textAlign: "center", color: "var(--muted-foreground)", userSelect: "none" },
  ".mc-live-rule-preview": { lineHeight: "0", minHeight: "0" },
  ".mc-live-rule-preview > span, .mc-live-rule-preview > .cm-widgetBuffer": { display: "none" },
  ".mc-live-rule": { color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" },
  ".mc-live-strong": { fontWeight: "700" },
  ".mc-live-emphasis": { fontStyle: "italic" },
  ".mc-live-strike": { textDecoration: "line-through" },
  ".mc-live-marker, .mc-live-quote, .mc-live-blocked": { color: "var(--muted-foreground)" },
  ".mc-live-inline-code, .mc-live-code-line": { fontFamily: "var(--note-mono-font)", backgroundColor: "var(--muted)", borderRadius: "4px" },
  ".mc-live-inline-code": { padding: "0.1em 0.2em", fontSize: "0.9em" },
  ".mc-live-code-line": { padding: "0 8px" },
  ".mc-live-link": { color: "var(--accent-text)", textDecoration: "underline", textUnderlineOffset: "3px" },
  ".mc-live-image": { display: "block", maxWidth: "100%", height: "auto", maxHeight: "440px", objectFit: "contain", objectPosition: "left", borderRadius: "var(--radius)", margin: "8px 0" },
});

export const LiveMarkdownEditor = forwardRef<HTMLDivElement, Props>(function LiveMarkdownEditor(props, forwardedRef) {
  const container = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Block | undefined>();
  const [canInsert, setCanInsert] = useState(true);
  const [menu, setMenu] = useState<'insert' | 'actions' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openMenu = useRef<'insert' | 'actions' | null>(null);
  openMenu.current = menu;
  const [filter, setFilter] = useState("");
  const [top, setTop] = useState<number | null>(null);
  const drag = useRef<{ block: Block; doc: string } | null>(null);
  const ownsDrag = useRef(false);
  const dragScroll = useRef<number | null>(null);
  const stopDragScroll = () => { if (dragScroll.current !== null) cancelAnimationFrame(dragScroll.current); dragScroll.current = null; };
  const dragPreview = useRef<HTMLElement | null>(null);
  const clearDragPreview = () => { stopDragScroll(); dragPreview.current?.remove(); dragPreview.current = null; };
  const [dropTop, setDropTop] = useState<number | null>(null);
  const slash = useRef(false);
  const dismissedSlash = useRef<string | null>(null);
  const blockPosition = useRef(0);
  const updateBlock = (editor: EditorView, position = editor.state.selection.main.head) => {
    blockPosition.current = position;
    const block = blockAt(editor.state, position);
    const separator = editorSeparators(editor.state).some(range => position > range.from && position <= range.to);
    if (separator) {
      setCanInsert(false);
      setActive(undefined);
      setTop(null);
      return;
    }
    setCanInsert(Boolean(block) || !editor.state.doc.lineAt(position).text.trim());
    setActive(previous => previous?.from === block?.from && previous?.to === block?.to && previous?.kind === block?.kind ? previous : block);
    editor.requestMeasure({ key: container, read: current => {
      const coords = current.coordsAtPos(Math.min(block?.from ?? position, current.state.doc.length));
      return coords && container.current ? (coords.top + coords.bottom) / 2 - container.current.getBoundingClientRect().top : null;
    }, write: value => { if (blockPosition.current === position) setTop(value); } });
  };
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef(props);
  const initial = useRef(props);
  const editable = useRef(new Compartment());

  useLayoutEffect(() => { callbacks.current = props; });
  useLayoutEffect(() => {
    const current = initial.current;
    const editor = new EditorView({
      parent: container.current!,
      state: EditorState.create({
        doc: current.value,
        extensions: [
          // Split only LF: existing CRLF or mixed line endings remain source bytes.
          EditorState.lineSeparator.of("\n"),
          markdown({ base: markdownLanguage, extensions: [GFM], addKeymap: false }), history(),
          keymap.of([...defaultKeymap.filter((binding) => binding.key !== "Mod-Enter"), ...historyKeymap]), EditorView.lineWrapping,
          placeholder("有什么想记下来的？"), theme,
          editable.current.of([EditorView.editable.of(!current.disabled), EditorState.readOnly.of(current.disabled)]),
          EditorView.contentAttributes.of({ role: "textbox", "aria-label": "笔记内容", "aria-multiline": "true", spellcheck: "false" }),
          previewExtension(current.notePath), separatorSelection,
          EditorView.updateListener.of((update) => {
            if (update.docChanged || update.selectionSet) {
              updateBlock(update.view);
              const line = update.state.doc.lineAt(update.state.selection.main.head);
              const block = blockAt(update.state, line.from);
              const query = /^\/([^\s/]*)$/.exec(line.text);
              const isSlash = query && block?.kind === 'Paragraph' && block.from === line.from && block.to === line.to && dismissedSlash.current !== `${line.from}:${line.text}`;
              if (isSlash) { setFilter(query[1]); slash.current = true; setMenu('insert'); }
              else if (slash.current) { slash.current = false; setMenu(null); }
            } else if (update.geometryChanged || update.viewportChanged) {
              updateBlock(update.view, blockPosition.current);
            }
            if (update.docChanged && !update.transactions.every((transaction) => transaction.annotation(externalChange))) {
              callbacks.current.onChange(update.state.doc.toString());
            }
          }),
          Prec.highest(EditorView.domEventHandlers({
            focus: (_event, editor) => { editor.dispatch({ effects: focusChanged.of(true) }); },
            blur: (_event, editor) => { editor.dispatch({ effects: focusChanged.of(false) }); },
            mousemove: (event, editor) => { if (!drag.current && !openMenu.current) { const position = editor.posAtCoords({ x: event.clientX, y: event.clientY }); if (position !== null) updateBlock(editor, position); } return false; },
            dragover: (event, editor) => {
              if (!drag.current) return false;
              event.preventDefault();
              let scroller: HTMLElement | null = editor.scrollDOM;
              while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
              stopDragScroll();
              const updateDestination = () => {
                const source = drag.current;
                const destination = source && source.doc === editor.state.doc.toString() ? dropDestination(editor, source.block, event.clientX, event.clientY) : undefined;
                if (event.dataTransfer) event.dataTransfer.dropEffect = destination ? 'move' : 'none';
                setDropTop(destination ? destination.top - container.current!.getBoundingClientRect().top : null);
              };
              if (scroller) {
                const bounds = scroller.getBoundingClientRect();
                const delta = event.clientY < bounds.top + 48 ? -12 : event.clientY > bounds.bottom - 48 ? 12 : 0;
                if (delta) {
                  const scrollTarget = scroller;
                  let previousTime = performance.now();
                  const advance = (now: number) => {
                    dragScroll.current = null;
                    if (!drag.current) return;
                    const previousTop = scrollTarget.scrollTop;
                    scrollTarget.scrollTop += delta * Math.min(32, now - previousTime) / 16;
                    previousTime = now;
                    updateDestination();
                    if (scrollTarget.scrollTop !== previousTop) dragScroll.current = requestAnimationFrame(advance);
                  };
                  scroller.scrollTop += delta;
                  dragScroll.current = requestAnimationFrame(advance);
                }
              }
              updateDestination();
              return true;
            },
            dragleave: (event, editor) => { if (!(event.relatedTarget instanceof Node) || !editor.dom.contains(event.relatedTarget)) { stopDragScroll(); setDropTop(null); } return false; },
            drop: (event, editor) => {
              const source = drag.current; drag.current = null; clearDragPreview(); setDropTop(null);
              const internal = ownsDrag.current || event.dataTransfer?.types?.includes('application/x-memocard-block');
              ownsDrag.current = false;
              if (!source && !internal) return false;
              event.preventDefault();
              if (!source) return true;
              const destination = source.doc === editor.state.doc.toString() ? dropDestination(editor, source.block, event.clientX, event.clientY) : undefined;
              if (destination) moveBlock(editor, source.block, destination.target);
              return true;
            },
            paste: (event, editor) => {
              const text = event.clipboardData?.getData('text/plain');
              if (text === undefined || editor.state.readOnly) return false;
              event.preventDefault(); editor.dispatch(editor.state.replaceSelection(text)); return true;
            },
            keydown: (event, editor) => {
              if (event.isComposing || event.keyCode === 229 || editor.composing || editor.state.readOnly) return false;
              if (event.key === 'Escape') { const line = editor.state.doc.lineAt(editor.state.selection.main.head); dismissedSlash.current = `${line.from}:${line.text}`; slash.current = false; setMenu(null); drag.current = null; setDropTop(null); return false; }
              if (slash.current && openMenu.current === 'insert' && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
                event.preventDefault(); const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)');
                const item = items?.[event.key === 'ArrowUp' ? items.length - 1 : 0];
                if (event.key === 'Enter') item?.click(); else { item?.focus(); item?.scrollIntoView({ block: 'nearest' }); }
                return true;
              }
              const position = editor.state.selection.main.head;
              const candidate = blockAt(editor.state, position);
              const block = candidate && position >= candidate.from && position <= candidate.to ? candidate : undefined;
              if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); if (block) blockAction(editor, block, event.key === 'ArrowUp' ? 'up' : 'down'); return true; }
              if (block?.kind === 'ListItem' && event.key === 'Tab') { event.preventDefault(); blockAction(editor, block, event.shiftKey ? 'outdent' : 'indent'); return true; }
              if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault();
                const eol = editor.state.doc.toString().includes('\r\n') ? '\r\n' : '\n';
                if (!event.shiftKey && block?.kind === 'ListItem') {
                  const line = editor.state.doc.lineAt(position);
                  if (editor.state.selection.main.empty && /^[ \t]*(?:[-+*]|\d+[.)])(?:[ \t]+\[[ xX]\])?[ \t]*\r?$/.test(line.text)) {
                    if (canBlockAction(editor.state, block, 'outdent')) blockAction(editor, block, 'outdent');
                    else {
                      const gap = line.from && line.to === editor.state.doc.length ? eol : '';
                      editor.dispatch({ changes: { from: line.from, to: line.to - (line.text.endsWith('\r') ? 1 : 0), insert: gap }, selection: { anchor: line.from + gap.length }, userEvent: 'input' });
                    }
                    return true;
                  }
                  if (insertNewlineContinueMarkup(editor)) return true;
                }
                const inCode = block && /Code/.test(block.kind);
                editor.dispatch(editor.state.replaceSelection(event.shiftKey || inCode ? eol : eol + eol)); return true;
              }
              if (event.key === 'Backspace' && editor.state.selection.main.empty && block && editor.state.selection.main.head === block.from) {
                const previous = blocks(editor.state).filter(item => item.parent === block.parent && item.to < block.from).at(-1);
                if (previous) {
                  const gap = editor.state.sliceDoc(previous.to, block.from);
                  if (gap.trim()) { event.preventDefault(); return true; }
                  if ((gap.match(/\n/g)?.length ?? 0) > 2) {
                    event.preventDefault();
                    editor.dispatch({ changes: { from: block.from - (gap.endsWith('\r\n') ? 2 : 1), to: block.from, insert: '' }, userEvent: 'delete.backward' });
                    return true;
                  }
                }
                if (previous && previous.kind === 'Paragraph' && block.kind === 'Paragraph') { event.preventDefault(); editor.dispatch({ changes: { from: previous.to, to: block.from, insert: '' }, selection: { anchor: previous.to } }); return true; }
                if (previous) { event.preventDefault(); return true; }
              }
              if (event.key === 'Delete' && editor.state.selection.main.empty && block && position === block.to) {
                const next = blocks(editor.state).find(item => item.parent === block.parent && item.from > block.to);
                if (next) {
                  event.preventDefault();
                  const gap = editor.state.sliceDoc(block.to, next.from);
                  if (gap.trim()) return true;
                  if ((gap.match(/\n/g)?.length ?? 0) > 2) {
                    editor.dispatch({ changes: { from: block.to, to: block.to + (gap.startsWith('\r\n') ? 2 : 1), insert: '' }, userEvent: 'delete.forward' });
                    return true;
                  }
                  if (block.kind === 'Paragraph' && next.kind === 'Paragraph') editor.dispatch({ changes: { from: block.to, to: next.from, insert: '' }, selection: { anchor: block.to }, userEvent: 'delete.forward' });
                  return true;
                }
              }
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                if (event.isComposing || event.keyCode === 229 || editor.composing) return false;
                event.preventDefault();
                if (!callbacks.current.disabled) callbacks.current.onSave();
                return true;
              }
              return false;
            },
            click: (event) => {
              const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-memocard-link], a[data-memocard-wiki]") : null;
              if (!link) return false;
              event.preventDefault();
              const raw = link.dataset.memocardLink ?? "";
              const internal = link.dataset.memocardWiki ?? (raw.startsWith("memocard-internal:") ? decodeURIComponent(raw.slice("memocard-internal:".length)) : undefined);
              if (internal !== undefined && (event.metaKey || event.ctrlKey)) void openVaultLink(internal, callbacks.current.notePath, link.dataset.memocardWiki !== undefined).catch((error: unknown) => callbacks.current.onError(error instanceof Error ? error.message : "无法打开笔记链接。"));
              const url = externalUrl(raw);
              if (url && (event.metaKey || event.ctrlKey)) void request("openExternal", { url }).catch(() => callbacks.current.onError("无法打开链接，请在 App 中重试。"));
              return false;
            },
          })),
        ],
      }),
    });
    view.current = editor;
    updateBlock(editor);
    if (typeof forwardedRef === "function") forwardedRef(editor.contentDOM as HTMLDivElement);
    else if (forwardedRef) forwardedRef.current = editor.contentDOM as HTMLDivElement;
    return () => {
      if (typeof forwardedRef === "function") forwardedRef(null);
      else if (forwardedRef) forwardedRef.current = null;
      clearDragPreview(); editor.destroy(); view.current = null;
    };
  }, [forwardedRef]);

  useLayoutEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const old = editor.state.doc.toString();
    if (old !== props.value) {
      let from = 0, oldEnd = old.length, newEnd = props.value.length;
      while (from < oldEnd && from < newEnd && old[from] === props.value[from]) from++;
      while (oldEnd > from && newEnd > from && old[oldEnd - 1] === props.value[newEnd - 1]) { oldEnd--; newEnd--; }
      const appendingAtCursor = from === old.length && editor.state.selection.main.empty && editor.state.selection.main.head === old.length;
      editor.dispatch({
        changes: { from, to: oldEnd, insert: props.value.slice(from, newEnd) },
        ...(appendingAtCursor ? { selection: { anchor: props.value.length } } : {}),
        annotations: externalChange.of(true),
      });
    }
  }, [props.value]);
  useLayoutEffect(() => { view.current?.dispatch({ effects: notePathChanged.of(props.notePath) }); }, [props.notePath]);
  useLayoutEffect(() => {
    view.current?.dispatch({ effects: editable.current.reconfigure([EditorView.editable.of(!props.disabled), EditorState.readOnly.of(props.disabled)]) });
    view.current?.contentDOM.setAttribute("aria-disabled", String(props.disabled));
  }, [props.disabled]);

  useEffect(() => {
    if (!menu) return;
    if (slash.current) view.current?.dispatch({ scrollIntoView: true });
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target) && !(target instanceof Element && target.closest('.block-controls'))) setMenu(null);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [menu]);

  const run = (action: BlockAction) => { if (view.current && active) blockAction(view.current, active, action); setMenu(null); };
  const insert = (kind: string, markdown?: string) => {
    // The image picker temporarily locks typing; its completed import still inserts.
    const editor = view.current; if (!editor || (editor.state.readOnly && markdown === undefined)) return;
    const line = editor.state.doc.lineAt(slash.current ? editor.state.selection.main.head : Math.min(blockPosition.current, editor.state.doc.length));
    const eol = editor.state.doc.toString().includes('\r\n') ? '\r\n' : '\n';
    const snippets: Record<string, string> = { paragraph: '', heading1: '# ', heading2: '## ', heading3: '### ', heading4: '#### ', heading5: '##### ', heading6: '###### ', bullet: '- ', ordered: '1. ', task: '- [ ] ', quote: '> ', code: '```' + eol + eol + '```', divider: '---' };
    const replacing = slash.current || !line.text.trim();
    const from = replacing ? line.from : active?.to ?? line.to;
    const to = replacing ? line.to : from;
    const prefix = replacing ? '' : eol + eol;
    const text = markdown === undefined ? snippets[kind] : markdown + (to === editor.state.doc.length ? eol + eol : '');
    editor.dispatch({ changes: { from, to, insert: prefix + text }, selection: { anchor: from + prefix.length + (kind === 'code' ? 3 + eol.length : text.length) }, scrollIntoView: true });
    slash.current = false; setMenu(null); editor.focus();
  };
  const icons: Record<string, LucideIcon> = { paragraph: Type, heading1: Heading1, heading2: Heading2, heading3: Heading3, heading4: Heading4, heading5: Heading5, heading6: Heading6, bullet: List, ordered: ListOrdered, task: ListTodo, quote: Quote, code: Code, divider: Minus, up: ArrowUp, down: ArrowDown, duplicate: Copy, delete: Trash2, indent: IndentIncrease, outdent: IndentDecrease };
  const hints: Record<string, string> = { heading1: "#", heading2: "##", heading3: "###", heading4: "####", heading5: "#####", heading6: "######", bullet: "-", ordered: "1.", task: "[]", quote: ">", code: "```", divider: "---" };
  const matches = (kind: string, label: string) => `${label} ${kind}`.toLowerCase().includes(filter.trim().toLowerCase());
  const choices = [['paragraph', '正文'], ['heading1', '一级标题'], ['heading2', '二级标题'], ['heading3', '三级标题'], ['heading4', '四级标题'], ['heading5', '五级标题'], ['heading6', '六级标题'], ['bullet', '无序列表'], ['ordered', '有序列表'], ['task', '待办列表'], ['quote', '引用'], ['code', '代码块'], ['divider', '分割线']];
  return <div className="block-editor relative min-h-0" onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); drag.current = null; clearDragPreview(); setDropTop(null); setMenu(null); view.current?.focus(); } }}>
    <PopoverPrimitive.Root open={Boolean(menu)} onOpenChange={open => { if (!open) setMenu(null); }}>
    {!props.disabled && <PopoverPrimitive.Anchor asChild><div className="block-controls" style={{ top: top ?? 0, visibility: top === null ? 'hidden' : undefined }}>
      <button type="button" aria-label="插入内容块" disabled={!canInsert} aria-expanded={menu === 'insert'} onClick={() => { slash.current = false; setFilter(""); setMenu(menu === 'insert' ? null : 'insert'); }} title="添加内容块"><Plus size={18} strokeWidth={1.5} aria-hidden="true" /></button>
      <button type="button" aria-label="内容块操作" disabled={!active} aria-expanded={menu === 'actions'} draggable={Boolean(active)} onDragStart={event => { if (!active || !view.current) { event.preventDefault(); return; } ownsDrag.current = true; drag.current = { block: active, doc: view.current.state.doc.toString() }; event.dataTransfer.setData('application/x-memocard-block', '1'); event.dataTransfer.setData('text/plain', view.current.state.sliceDoc(active.from, active.to)); event.dataTransfer.effectAllowed = 'move';
        const editor = view.current;
        editor.dispatch({ selection: { anchor: active.from, head: active.to } });
        clearDragPreview();
        const preview = document.createElement('div');
        preview.className = 'block-drag-preview';
        preview.style.width = `${Math.min(560, editor.contentDOM.clientWidth)}px`;
        for (const line of editor.contentDOM.querySelectorAll('.cm-line')) {
          const from = editor.posAtDOM(line, 0);
          if (from >= active.from && from <= active.to) preview.append(line.cloneNode(true));
        }
        preview.setAttribute('aria-hidden', 'true');
        editor.dom.append(preview); dragPreview.current = preview;
        event.dataTransfer.setDragImage?.(preview, 16, 12);
        setMenu(null); }} onDragEnd={() => { drag.current = null; ownsDrag.current = false; clearDragPreview(); setDropTop(null); }} onClick={() => { setFilter(''); setMenu(menu === 'actions' ? null : 'actions'); }} title="拖动以移动，点击打开菜单"><GripVertical size={18} strokeWidth={1.5} aria-hidden="true" /></button>
    </div></PopoverPrimitive.Anchor>}
    {menu && <PopoverPrimitive.Portal><PopoverPrimitive.Content ref={menuRef} role="menu" aria-label={menu === 'insert' ? '插入内容块' : '内容块操作'} className="block-menu" align="start" side="bottom" sideOffset={6} collisionPadding={12} sticky="always" updatePositionStrategy="always"
      onOpenAutoFocus={event => { event.preventDefault(); if (!slash.current) menuRef.current?.querySelector<HTMLElement>(menu === 'insert' ? 'input' : '[role="menuitem"]:not(:disabled)')?.focus(); }}
      onCloseAutoFocus={event => event.preventDefault()}
      onFocusOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { event.preventDefault(); if (event.isComposing || event.keyCode === 229 || view.current?.composing) return; const editor = view.current; if (editor) { const line = editor.state.doc.lineAt(editor.state.selection.main.head); dismissedSlash.current = `${line.from}:${line.text}`; } slash.current = false; setMenu(null); editor?.focus(); }}
      onKeyDown={event => {
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)'));
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); items[0]?.click(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[next]?.focus(); items[next]?.scrollIntoView({ block: 'nearest' }); }
    }}>
      <div className="block-menu-scroll">
      {menu === 'insert' && <><input className="block-menu-filter" aria-label="筛选内容块" placeholder="输入以筛选…" value={filter} onChange={event => setFilter(event.target.value)} /><div className="block-menu-label">基本区块</div></>}
      {menu === 'actions' && <div className="block-menu-label">内容块操作</div>}
      {menu === 'actions' && active?.kind === 'ListItem' && <button role="menuitem" onClick={() => { const root = view.current && blocks(view.current.state).find(block => block.parent === -1 && block.from <= active.from && block.to >= active.to); if (root) setActive(root); }}>选择整个列表</button>}
      {menu === 'actions' && [['up', '上移'], ['down', '下移'], ['duplicate', '复制内容块'], ['delete', '删除内容块'], ...(active?.kind === 'ListItem' ? [['indent', '缩进'], ['outdent', '取消缩进']] : [])].map(([action, label]) => <button role="menuitem" key={action} disabled={!view.current || !active || !canBlockAction(view.current.state, active, action as BlockAction)} onClick={() => run(action as BlockAction)}>{(() => { const Icon = icons[action]; return <Icon size={18} aria-hidden="true" />; })()}<span>{label}</span></button>)}
      {(menu === 'insert' ? choices : choices.filter(([kind]) => !['code', 'divider'].includes(kind) && (active?.kind === 'ListItem' ? ['bullet', 'ordered', 'task'].includes(kind) : /^(Paragraph|ATXHeading[1-6]|SetextHeading[12])$/.test(active?.kind ?? '')))).filter(([kind, label]) => matches(kind, label)).map(([kind, label]) => <button role="menuitem" key={kind} onClick={() => menu === 'insert' ? insert(kind) : run(kind as BlockAction)}>{(() => { const Icon = icons[kind]; return <Icon size={18} strokeWidth={1.5} aria-hidden="true" />; })()}<span>{menu === 'actions' ? '转为' : ''}{label}</span><kbd aria-hidden="true">{hints[kind]}</kbd></button>)}
      {menu === 'insert' && props.onImage && matches('image', '图片') && <><div className="block-menu-label block-menu-divider">媒体</div><button role="menuitem" onClick={() => { setMenu(null); props.onImage?.(markdown => insert('image', markdown)); }}><ImagePlus size={18} aria-hidden="true" /><span>图片</span></button></>}
      {menu === 'insert' && !choices.some(([kind, label]) => matches(kind, label)) && !(props.onImage && matches('image', '图片')) && <p role="status" className="px-3 py-6 text-sm text-muted-foreground">没有匹配的内容块</p>}
      </div><button className="block-menu-close" onClick={() => { setMenu(null); view.current?.focus(); }}><span>关闭菜单</span><kbd>esc</kbd></button>
    </PopoverPrimitive.Content></PopoverPrimitive.Portal>}
    </PopoverPrimitive.Root>
    {dropTop !== null && <div className="block-drop-indicator" style={{ top: dropTop }} />}
    <div ref={container} className="min-h-0" />
  </div>;
});
