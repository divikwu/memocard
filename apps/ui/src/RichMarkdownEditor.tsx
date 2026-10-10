import { forwardRef, useCallback, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps, type ChainedCommands, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as MarkdownExtension } from '@tiptap/markdown';
import { TableCell } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import Image, { type ImageOptions } from '@tiptap/extension-image';
import { InlineMath, BlockMath } from '@tiptap/extension-mathematics';
import { AllSelection, EditorState, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { richBlock, richBlockAt, richSectionEnd, selectedRichBlocks, richBlockMoveSources, richBlockMoveTarget, selectRichBlocks, selectRichBlockRange, extendRichBlocksTo, blockMoveTransaction, moveRichBlocks, duplicateRichBlocks, editRichStructure, type RichBlock } from './rich-blocks';
import { BlockRangeSelection } from './rich-block-selection';
import { RichInlineTags } from './rich-inline-tags';
import { RichHeadingFolding } from './rich-heading-fold';
import { RichTagSuggestions } from './RichTagSuggestions';
import { RichMath } from './RichMath';
import { RichFormatTools } from './RichFormatTools';
import { richTable, RichTableRow, RichTableHeader, alignRichColumn } from './rich-table';
import { Popover } from "@base-ui/react/popover";
import { Menu } from '@base-ui/react/menu';
import { useIsMobile } from './hooks/use-mobile';
import { Plus, GripVertical, Type, Heading, List, ListOrdered, ListTodo, Quote, Code, Minus, Table, Sigma, Image as ImageIcon, Search, ArrowUp, ArrowDown, Copy, Trash2, RefreshCw, Check, ChevronRight, type LucideIcon } from 'lucide-react';
import { MarkdownSource, SourceMetadata, PreservedMarkdown } from './wysiwyg-markdown';
import { Markdown } from './markdown';
import { imageSource, openVaultLink } from './vault-links';
import { externalUrl } from './urls';
import { request } from './bridge';
import { semanticExtensions, WikiLink, FootnoteReference, FootnoteDefinition } from './rich-semantic';
import { bindNoteImage } from './note-image';
import './typeset.css';
import './block-controls.css';
import './rich-editor.css';

export type RichEditorProps = {
  value: string; notePath: string; disabled: boolean; autoFocus?: boolean;
  onChange: (value: string) => void; onSave: () => void; onError: (message: string) => void;
  onImage?: (insert: (markdown: string) => void) => void;
};
function SafeImage({ node, extension }: NodeViewProps) {
  const ref = useRef<HTMLImageElement>(null);
  const path = extension.options.notePath() as string;
  useEffect(() => {
    const source = imageSource(String(node.attrs.src), path, node.type.name === 'wikiImage');
    if (source && ref.current) return bindNoteImage(ref.current, source);
  }, [node.attrs.src, node.type.name, path]);
  return <NodeViewWrapper className="rich-image"><img ref={ref} alt={String(node.attrs.alt ?? '图片')} draggable={false} /></NodeViewWrapper>;
}
function PreservedContent({ node, extension }: NodeViewProps) {
  return <NodeViewWrapper className="rich-preserved" contentEditable={false}>
    <Markdown body={String(node.attrs.source)} notePath={extension.options.notePath()} />
    <span className="rich-preserved-label">原格式内容 · 保留原文</span>
  </NodeViewWrapper>;
}
const SafeImageExtension = Image.extend<ImageOptions & { notePath: () => string }>({
  addOptions() { return { ...this.parent!(), notePath: () => 'notes/note.md' }; },
  addNodeView() { return ReactNodeViewRenderer(SafeImage); },
});
const WikiImageExtension = SafeImageExtension.extend({
  name: 'wikiImage', markdownTokenName: 'wikiImage',
  markdownTokenizer: {
    name: 'wikiImage', level: 'block', start: src => src.indexOf('![['),
    tokenize: src => { const match = /^!\[\[([^\]\n]+)\]\](?:\n|$)/.exec(src); return match ? { type: 'wikiImage', raw: match[0], text: match[1] } : undefined; },
  },
  parseMarkdown: token => { const [src, alt] = String(token.text).split('|'); return { type: 'wikiImage', attrs: { src, alt: alt ?? '' } }; },
  renderMarkdown: node => `![[${node.attrs?.src}${node.attrs?.alt ? `|${node.attrs.alt}` : ''}]]`,
});
const PreservedExtension = PreservedMarkdown.extend({
  addOptions: () => ({ notePath: () => 'notes/note.md' }),
  addNodeView() { return ReactNodeViewRenderer(PreservedContent); },
});

type MenuItem = { label: string; keywords?: string; icon?: LucideIcon; hint?: string; group?: string; searchOnly?: boolean; convertible?: boolean; run: (chain: ChainedCommands) => ChainedCommands };
const insertItems: MenuItem[] = [
  { label: '文本', keywords: 'text paragraph 段落', icon: Type, convertible: true, run: e => e.setParagraph() },
  ...([1, 2, 3, 4, 5, 6] as const).map(level => ({ label: `${['一', '二', '三', '四', '五', '六'][level - 1]}级标题`, keywords: `heading${level} h${level} 标题${level}`, icon: Heading, hint: '#'.repeat(level), searchOnly: level > 3, convertible: true, run: (e: ChainedCommands) => e.setHeading({ level }) })),
  { label: '项目符号列表', keywords: 'bullet list 无序列表', icon: List, hint: '-', convertible: true, run: e => e.toggleBulletList() },
  { label: '有序列表', keywords: 'ordered list numbered', icon: ListOrdered, hint: '1.', convertible: true, run: e => e.toggleOrderedList() },
  { label: '待办事项', keywords: 'todo task checkbox', icon: ListTodo, hint: '[]', convertible: true, run: e => e.toggleTaskList() },
  { label: '引用', keywords: 'quote blockquote', icon: Quote, hint: '>', convertible: true, run: e => e.toggleBlockquote() },
  { label: '分割线', keywords: 'divider hr 分隔线', icon: Minus, hint: '---', run: e => e.setHorizontalRule() },
  { label: '代码', keywords: 'code 代码块', icon: Code, hint: '```', group: '其他内容', convertible: true, run: e => e.toggleCodeBlock() },
  { label: '表格', keywords: 'table', icon: Table, group: '其他内容', run: e => e.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  { label: '公式', keywords: 'math equation latex 块公式', icon: Sigma, hint: '$$', group: '其他内容', run: e => e.insertBlockMath({ latex: 'x^2' }) },
  { label: '行内公式', keywords: 'inline math latex', icon: Sigma, hint: '$', group: '其他内容', searchOnly: true, run: e => e.insertInlineMath({ latex: 'x^2' }) },
];

export const RichMarkdownEditor = forwardRef<HTMLDivElement, RichEditorProps>(function RichMarkdownEditor(props, ref) {
  const latest = useRef(props); latest.current = props;
  const source = useRef(new MarkdownSource());
  const emitted = useRef(props.value);
  const initialized = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<'insert' | 'block' | null>(null);
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [conversionOpen, setConversionOpen] = useState(false);
  const isMobile = useIsMobile();
  const [toolbar, setToolbar] = useState({ top: 14, pos: 0 });
  const [inlineTop, setInlineTop] = useState(0);
  const [, setRevision] = useState(0);
  const [dropTop, setDropTop] = useState<number | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [typing, setTyping] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const rangeGesture = useRef<{ before: EditorState; idleSelection: EditorState['selection']; pointerId: number; x: number; y: number } | null>(null);
  const dragging = useRef<RichBlock[] | null>(null);
  const dragPreview = useRef<HTMLDivElement | null>(null);
  const beforeDrag = useRef<EditorState | null>(null);
  const internalDrag = useRef(false);
  const frame = useRef(0);
  const pointerY = useRef(0);
  const pointerX = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const insertion = useRef<number | null>(null);
  const slash = useRef<{ from: number; to: number } | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const pastePlain = useRef(false);
  const editor: TiptapEditor | null = useEditor({
    immediatelyRender: false,
    // Plain Markdown is parsed explicitly; rich/literal clipboard content must not run Markdown paste rules.
    enablePasteRules: false,
    extensions: [RichInlineTags, RichHeadingFolding, StarterKit.configure({ link: { openOnClick: false }, trailingNode: false }), MarkdownExtension, SourceMetadata, WikiLink, FootnoteReference, FootnoteDefinition, ...semanticExtensions(() => editorRef.current),
      richTable(() => editorRef.current), RichTableRow, RichTableHeader, TableCell, TaskList, TaskItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' }, a11y: { checkboxLabel: node => `待办：${node.textContent}` } }),
      SafeImageExtension.configure({ notePath: () => latest.current.notePath }), WikiImageExtension.configure({ notePath: () => latest.current.notePath }),
      PreservedExtension.configure({ notePath: () => latest.current.notePath }),
      InlineMath.extend({ addNodeView() { return ReactNodeViewRenderer(RichMath); } }),
      BlockMath.extend({ addNodeView() { return ReactNodeViewRenderer(RichMath); } }),
    ],
    content: '', editable: !props.disabled,
    editorProps: {
      attributes: { class: 'markdown typeset rich-editor-content', role: 'textbox', 'aria-label': '笔记内容', 'aria-multiline': 'true' },
      decorations(state) {
        if (!(state.selection instanceof AllSelection || state.selection instanceof BlockRangeSelection)) return null;
        const blocks: Decoration[] = [];
        state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
          if (pos >= state.selection.from && pos + node.nodeSize <= state.selection.to) { blocks.push(Decoration.node(pos, pos + node.nodeSize, { class: 'rich-selected-block' })); return false; }
        });
        return DecorationSet.create(state.doc, blocks);
      },
      handleDOMEvents: {
        keyup(_view, event) { pastePlain.current = event.shiftKey; return false; },
        blur() { pastePlain.current = false; return false; },
      },
      handleKeyDown(view, event) {
        pastePlain.current = event.shiftKey;
        if (event.isComposing || event.keyCode === 229 || view.composing) return false;
        if (event.shiftKey && !event.metaKey && !event.ctrlKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
          const selection = view.state.selection, e = editorRef.current;
          if (e && (selection instanceof BlockRangeSelection || selection instanceof NodeSelection && selection.node.isBlock)) {
            const blocks = selectedRichBlocks(e, selection.from);
            const edge = selection.anchor > selection.head ? blocks[0] : blocks[blocks.length - 1];
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            if (edge) {
              const parent = view.state.doc.resolve(edge.pos).parent, index = edge.index + direction;
              if (index >= 0 && index < parent.childCount) {
                const pos = direction < 0 ? edge.pos - parent.child(index).nodeSize : edge.pos + edge.node.nodeSize;
                const target = richBlockAt(e, pos);
                if (target) extendRichBlocksTo(e, target);
              }
            }
            return true;
          }
        }
        if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'a') {
          const { selection, doc } = view.state;
          const { $from, $to } = selection;
          // Keep the table extension's cell-selection shortcuts.
          if (editorRef.current?.isActive('table')) return false;
          const local = selection instanceof TextSelection && $from.sameParent($to) && $from.parent.isTextblock && $from.parent.content.size > 0;
          const selected = local && selection.from === $from.start() && selection.to === $from.end();
          view.dispatch(view.state.tr.setSelection(local && !selected ? TextSelection.create(doc, $from.start(), $from.end()) : new AllSelection(doc)));
          return true;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); if (!latest.current.disabled) latest.current.onSave(); return true; }
        if (event.key === 'Escape') {
          slash.current = null; setMenu(null); stopDrag();
          const selection = view.state.selection;
          if (!selection.empty && !menuRef.current && !(selection instanceof NodeSelection && selection.node.isInline)) {
            view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(view.state.selection.from))));
            return true;
          }
          return false;
        }
        if (slash.current && menuRef.current && handleInsertKey(event)) return true;
        if (event.key === 'Tab') {
          const e = editorRef.current;
          if (e?.isActive('listItem') || e?.isActive('taskItem')) {
            event.preventDefault(); const name = e.isActive('taskItem') ? 'taskItem' : 'listItem';
            return event.shiftKey ? e.commands.liftListItem(name) : e.commands.sinkListItem(name);
          }
        }
        return false;
      },
      handleClick(_view, _pos, event) {
        const reference = (event.target as HTMLElement).closest('[data-footnote], [data-footnote-definition]');
        if (reference && (event.metaKey || event.ctrlKey)) {
          const label = reference.getAttribute('data-footnote') ?? reference.getAttribute('data-footnote-definition');
          const type = reference.hasAttribute('data-footnote') ? 'footnoteDefinition' : 'footnoteReference';
          let destination: number | null = null;
          editorRef.current?.state.doc.descendants((node, pos) => { if (destination === null && node.type.name === type && node.attrs.label === label) destination = pos + (type === 'footnoteDefinition' ? 2 : 0); });
          if (destination !== null) editorRef.current?.chain().focus().setTextSelection(destination).scrollIntoView().run();
          return true;
        }
        const link = (event.target as HTMLElement).closest('a');
        if (!link) return false;
        event.preventDefault();
        if (!(event.metaKey || event.ctrlKey)) return true;
        const wiki = link.getAttribute('data-wiki-target'), href = link.getAttribute('href');
        const work = wiki ? openVaultLink(wiki, latest.current.notePath, true) : href && externalUrl(href) ? request('openExternal', { url: externalUrl(href) }) : href ? openVaultLink(href, latest.current.notePath, false) : null;
        void work?.catch(() => latest.current.onError('无法打开链接。'));
        return true;
      },
      handlePaste(view, event, slice) {
        if (latest.current.disabled) return true;
        const e = editorRef.current;
        if (!e) return false;
        // Use the schema-validated slice for rich/internal and literal clipboard content.
        if (pastePlain.current || view.state.selection.$from.parent.type.spec.code || event.clipboardData?.getData('text/html')) {
          if (!slice.size) return false;
          editRichStructure(e, () => view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView().setMeta('paste', true).setMeta('uiEvent', 'paste')));
          return true;
        }
        const text = event.clipboardData?.getData('text/plain');
        if (!text) return false;
        editRichStructure(e, () => { e.commands.insertContent(new MarkdownSource().parse(e, text)); }); return true;
      },
    },
    onUpdate({ editor: e }) {
      if (!initialized.current) return;
      const value = source.current.serialize(e); emitted.current = value; latest.current.onChange(value);
      const selection = e.state.selection;
      const text = selection.$from.parent.textContent;
      if (!e.view.composing && selection.empty && selection.$from.parent.type.name === 'paragraph' && /^\/[^\n]*$/.test(text)) {
        slash.current = { from: selection.$from.start(), to: selection.$from.end() }; setActiveIndex(0); setMenu('insert'); setFilter(text.slice(1));
      } else { slash.current = null; setMenu(null); }
    },
    onSelectionUpdate({ editor: e }) { positionToolbar(e); positionInlineToolbar(e); setRevision(n => n + 1); },
  });
  editorRef.current = editor;
  const stopRangeSelection = useCallback((cancel = false) => {
    const gesture = rangeGesture.current, e = editorRef.current;
    rangeGesture.current = null; setSelectionBox(null);
    if (!gesture) return;
    cancelAnimationFrame(frame.current); frame.current = 0;
    if (root.current?.hasPointerCapture(gesture.pointerId)) root.current.releasePointerCapture(gesture.pointerId);
    if (cancel && e && e.state.doc === gesture.before.doc) e.view.dispatch(e.state.tr.setSelection(gesture.before.selection));
  }, []);
  const stopDrag = useCallback((restoreSelection = false) => {
    setIsDragging(false);
    dragPreview.current?.remove(); dragPreview.current = null;
    cancelAnimationFrame(frame.current); frame.current = 0; dragging.current = null; setDropTop(null);
    const e = editorRef.current, previous = beforeDrag.current;
    beforeDrag.current = null;
    if (e) {
      e.view.dragging = null;
      // A cancelled drag restores its selection only while the document is unchanged.
      if (restoreSelection && previous && e.state.doc === previous.doc) e.view.dispatch(e.state.tr.setSelection(previous.selection));
    }
  }, []);
  function positionInlineToolbar(e: TiptapEditor) {
    if (!root.current || !(e.state.selection instanceof TextSelection) || e.state.selection.empty) return;
    const rect = e.view.coordsAtPos(e.state.selection.from);
    let visibleTop = 0;
    for (let parent = root.current.parentElement; parent; parent = parent.parentElement) {
      if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)) visibleTop = Math.max(visibleTop, parent.getBoundingClientRect().top);
    }
    const top = rect.top - 40 >= visibleTop ? rect.top - 40 : rect.bottom + 6;
    setInlineTop(top - root.current.getBoundingClientRect().top);
  }
  function positionToolbar(e: TiptapEditor, pos = e.state.selection.from) {
    if (!root.current) return;
    const block = richBlock(e, pos);
    if (!block) return;
    const from = block.pos;
    const element = e.view.nodeDOM(from);
    if (element instanceof HTMLElement) {
      const rect = element.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(element).lineHeight) || 26;
      const top = rect.top - root.current.getBoundingClientRect().top + Math.min(rect.height, line) / 2;
      setToolbar(current => current.pos === from && current.top === top ? current : { pos: from, top });
    }
  }
  useImperativeHandle(ref, () => root.current?.querySelector('[role=textbox]') as HTMLDivElement);
  useLayoutEffect(() => {
    if (!editor || initialized.current) return;
    editor.chain().setMeta('addToHistory', false).setContent(source.current.parse(editor, latest.current.value), { emitUpdate: false }).run();
    initialized.current = true;
    if (latest.current.autoFocus !== false) { editor.commands.focus('start'); editor.view.focus(); }
  }, [editor]);
  useEffect(() => { editor?.setEditable(!props.disabled, false); }, [editor, props.disabled]);
  useEffect(() => {
    if (editor && props.value !== emitted.current) {
      emitted.current = props.value;
      const doc = editor.schema.nodeFromJSON(source.current.parse(editor, props.value));
      editor.view.updateState(EditorState.create({ doc, plugins: editor.state.plugins }));
    }
  }, [editor, props.value]);
  useEffect(() => {
    if (!editor) return;
    const observer = new ResizeObserver(() => { positionToolbar(editor); positionInlineToolbar(editor); });
    if (root.current) observer.observe(root.current); return () => observer.disconnect();
  }, [editor]);
  useEffect(() => {
    const cancel = () => { if (dragging.current) stopDrag(true); stopRangeSelection(true); };
    const hidden = () => { if (document.visibilityState === 'hidden') cancel(); };
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(frame.current);
      stopRangeSelection();
      window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden);
    };
  }, [stopDrag, stopRangeSelection]);
  useEffect(() => {
    menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, filter]);
  useEffect(() => {
    if (!editor) return;
    const start = (event: PointerEvent) => {
      const target = event.target, element = root.current;
      if (!(target instanceof HTMLElement) || !element || event.button !== 0 || event.pointerType === 'touch' || menu || props.disabled || editor.view.composing || target.closest('button, a, input, textarea, select, [contenteditable]')) return;
      const rect = editor.view.dom.getBoundingClientRect();
      const pageTop = element.parentElement?.closest('.note-editor')?.getBoundingClientRect().top ?? rect.top;
      if (event.clientY < pageTop || event.clientY > rect.bottom || (event.clientY >= rect.top && event.clientX >= rect.left)) return;
      let surface = element.parentElement;
      while (surface && !/auto|scroll/.test(getComputedStyle(surface).overflowY)) surface = surface.parentElement;
      if (!element.contains(target)) {
        if (!surface?.contains(target)) return;
        const bounds = surface.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
      }
      event.preventDefault();
      const bounds = element.getBoundingClientRect();
      const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      const idleSelection = editor.state.selection instanceof TextSelection ? editor.state.selection : TextSelection.near(editor.state.doc.resolve(editor.state.selection.from));
      rangeGesture.current = { before: editor.state, idleSelection, pointerId: event.pointerId, x, y };
      element.setPointerCapture(event.pointerId); setSelectionBox({ left: x, top: y, width: 0, height: 0 });
      pointerX.current = event.clientX; pointerY.current = event.clientY;
      if (!editor.state.selection.eq(idleSelection)) editor.view.dispatch(editor.state.tr.setSelection(idleSelection));
      editor.view.focus();
      frame.current = requestAnimationFrame(scrollDrag);
    };
    const hover = (event: MouseEvent) => {
      const target = event.target, element = root.current;
      if (element?.contains(target as Node)) setTyping(false);
      if (!(target instanceof Element) || !element || menu || rangeGesture.current || dragging.current || event.buttons || target.closest('.block-controls, .rich-menu, .rich-table-tools, .rich-inline-tools, .rich-heading-fold-widget')) return;
      const rect = editor.view.dom.getBoundingClientRect();
      if (!element.contains(target)) {
        let surface = element.parentElement;
        while (surface && !/auto|scroll/.test(getComputedStyle(surface).overflowY)) surface = surface.parentElement;
        if (!surface?.contains(target)) return;
        const bounds = surface.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientY < rect.top || event.clientY > rect.bottom) return;
      }
      const left = rect.width ? Math.max(rect.left + 1, Math.min(event.clientX, rect.right - 1)) : event.clientX;
      const position = editor.view.posAtCoords({ left, top: event.clientY });
      if (position) positionToolbar(editor, position.pos);
    };
    const continueWriting = (event: MouseEvent) => {
      const target = event.target, element = root.current;
      if (!(target instanceof HTMLElement) || !element || event.button !== 0 || event.defaultPrevented || menu || props.disabled || editor.view.composing || target.closest('button, a, input, textarea, select, [contenteditable]')) return;
      const rect = editor.view.dom.getBoundingClientRect();
      if (event.clientY < rect.bottom || event.clientX < rect.left || event.clientX > rect.right) return;
      const surface = element.closest('.note-page-scroll');
      if (surface?.contains(target)) editor.commands.focus('end');
    };
    // Page margins belong to the scroll surface, so they do not bubble through the editor.
    document.addEventListener('pointerdown', start, true);
    document.addEventListener('mousemove', hover);
    document.addEventListener('click', continueWriting);
    return () => { document.removeEventListener('pointerdown', start, true); document.removeEventListener('mousemove', hover); document.removeEventListener('click', continueWriting); };
  });
  function handleInsertKey(event: { key: string; preventDefault: () => void; isComposing?: boolean; keyCode?: number }) {
    if (event.isComposing || event.keyCode === 229 || editorRef.current?.view.composing) return false;
    const choices = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? []);
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return false;
    event.preventDefault();
    if (!choices.length) return true;
    const current = Math.max(0, choices.findIndex(item => item.dataset.active === 'true'));
    if (event.key === 'Enter') choices[current]?.click();
    else setActiveIndex((current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length);
    return true;
  }
  if (!editor) return null;
  function run(item: MenuItem) {
    if (!editor || editor.view.composing || props.disabled) return;
    let chain = editor.chain().focus();
    if (slash.current) chain = chain.deleteRange(slash.current);
    else if (insertion.current != null) {
      const pos = insertion.current;
      chain = chain.insertContentAt(pos, { type: 'paragraph' }).setTextSelection(pos + 1);
    }
    insertion.current = null; slash.current = null; setMenu(null); setFilter('');
    editRichStructure(editor, () => { item.run(chain).run(); });
  }

  function move(direction: number) {
    if (!editor) return;
    const blocks = richBlockMoveSources(editor, toolbar.pos);
    const target = richBlockMoveTarget(editor, blocks, direction, movingSection);
    if (target) moveRichBlocks(editor, blocks, target, direction > 0);
    setMenu(null);
  }
  function scrollDrag() {
    if ((!dragging.current && !rangeGesture.current) || !root.current) return;
    let scroller: HTMLElement | null = root.current;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    if (scroller) {
      const rect = scroller.getBoundingClientRect(), y = pointerY.current;
      const delta = y < rect.top + 56 ? -12 : y > rect.bottom - 56 ? 12 : 0;
      if (delta) { scroller.scrollTop += delta; if (rangeGesture.current) updateRangeSelection(); else positionDropIndicator(); }
    }
    frame.current = requestAnimationFrame(scrollDrag);
  }
  function updateRangeSelection() {
    const gesture = rangeGesture.current;
    if (!gesture) return;
    if (editor!.state.doc !== gesture.before.doc) { stopRangeSelection(); return; }
    const rect = root.current!.getBoundingClientRect();
    const x = pointerX.current - rect.left, y = pointerY.current - rect.top;
    const box = { left: Math.min(gesture.x, x), top: Math.min(gesture.y, y), width: Math.abs(x - gesture.x), height: Math.abs(y - gesture.y) };
    setSelectionBox(box);
    const left = rect.left + box.left, top = rect.top + box.top;
    const hits: RichBlock[] = [];
    const seen = new Set<number>();
    editor!.state.doc.descendants((node, pos) => {
      if (!node.isBlock) return;
      const block = richBlock(editor!, node.isLeaf ? pos : pos + 1);
      if (!block || seen.has(block.pos)) return;
      seen.add(block.pos);
      const dom = editor!.view.nodeDOM(block.pos);
      if (!(dom instanceof HTMLElement)) return;
      const bounds = dom.getBoundingClientRect();
      if (box.width > 0 && box.height > 0 && bounds.width > 0 && bounds.height > 0 && left < bounds.right && left + box.width > bounds.left && top < bounds.bottom && top + box.height > bounds.top) hits.push(block);
    });
    if (hits.length) selectRichBlockRange(editor!, y >= gesture.y ? hits[0] : hits[hits.length - 1], y >= gesture.y ? hits[hits.length - 1] : hits[0]);
    else if (!editor!.state.selection.eq(gesture.idleSelection)) editor!.view.dispatch(editor!.state.tr.setSelection(gesture.idleSelection));
  }
  function dropAt(left: number, top: number) {
    if (!editor || !dragging.current) return null;
    const position = editor.view.posAtCoords({ left, top });
    let block = position ? richBlock(editor, position.pos) : null;
    if (block && dragging.current[0]?.parent === -1 && block.parent !== -1) {
      block = richBlockAt(editor, editor.state.doc.resolve(block.pos).before(1));
    }
    const dom = block ? editor.view.nodeDOM(block.pos) : null;
    if (!block || !(dom instanceof HTMLElement)) return null;
    const rect = dom.getBoundingClientRect(), after = top >= (rect.top + rect.bottom) / 2;
    if (!blockMoveTransaction(editor, dragging.current, block, after)) return null;
    return { block, after, rect };
  }
  function positionDropIndicator() {
    const target = dropAt(pointerX.current, pointerY.current);
    setDropTop(target && root.current ? (target.after ? target.rect.bottom : target.rect.top) - root.current.getBoundingClientRect().top : null);
  }
  const selectedBlocks = selectedRichBlocks(editor, toolbar.pos);
  const firstSelected = selectedBlocks[0], lastSelected = selectedBlocks[selectedBlocks.length - 1];
  const movingSection = selectedBlocks.length === 1 && firstSelected.node.type.name === 'heading' && !(editor.state.selection instanceof AllSelection);
  const moveSources = richBlockMoveSources(editor, toolbar.pos);
  const upTarget = richBlockMoveTarget(editor, moveSources, -1, movingSection), downTarget = richBlockMoveTarget(editor, moveSources, 1, movingSection);
  const gripTitle = movingSection ? '拖动以移动标题，Option/Alt 拖动以移动整个章节；点击打开菜单，Shift 点击扩展块选择'
    : firstSelected && ['listItem', 'taskItem'].includes(firstSelected.node.type.name) ? '拖动以移动列表项，Option/Alt 拖动以移动整个列表；Shift 点击扩展块选择'
    : '拖动以移动，点击打开菜单；Shift 点击扩展块选择';
  const query = filter.trim().toLowerCase();
  const items = insertItems.filter(item => (query ? `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(query) : !item.searchOnly));
  if (props.onImage && (!query || '图片 image photo'.includes(query))) items.push({ label: '图片', icon: ImageIcon, group: '其他内容', run: e => e });
  const closeMenu = () => { slash.current = null; insertion.current = null; setMenu(null); editor.commands.focus(); };
  const openBlockMenu = () => {
    if (editor.view.composing || props.disabled || !richBlockAt(editor, toolbar.pos)) return;
    const selected = selectedRichBlocks(editor, toolbar.pos);
    if (selected.length > 1) selectRichBlocks(editor, selected);
    else if (editor.state.selection.empty || richBlock(editor, editor.state.selection.from)?.pos !== toolbar.pos) editor.commands.setNodeSelection(toolbar.pos);
    setMenu('block');
  }
  const isCurrentType = (item: MenuItem) => {
    if (item.icon === Heading) return editor.isActive('heading', { level: item.hint!.length });
    const type = item.icon === List ? 'bulletList' : item.icon === ListOrdered ? 'orderedList' : item.icon === ListTodo ? 'taskList' : item.icon === Quote ? 'blockquote' : item.icon === Code ? 'codeBlock' : 'paragraph';
    return editor.isActive(type) && (type !== 'paragraph' || !['bulletList', 'orderedList', 'taskList', 'blockquote'].some(name => editor.isActive(name)));
  }
  function choose(item: MenuItem) {
    if (item.label === '图片') props.onImage?.(markdown => run({ label: '图片', run: chain => chain.insertContent(markdown, { contentType: 'markdown' }) }));
    else run(item);
  }
  return <Menu.Root open={menu === 'block'} modal={false} onOpenChange={(open, details) => { if (open) openBlockMenu(); else { setMenu(current => current === 'block' ? null : current); if (details.reason === 'escape-key') editor.commands.focus(); } }}><Popover.Root open={menu === 'insert'} onOpenChange={open => { if (!open && menu === 'insert') { slash.current = null; setMenu(null); } }}><div className="note-editor rich-editor" ref={root} data-selecting={selectionBox != null || undefined} data-dragging={isDragging || undefined} data-typing={typing || undefined} data-menu-open={menu != null || undefined}
    onInputCapture={event => { if (editor.view.dom.contains(event.target as Node)) setTyping(true); }}
    onPointerMove={event => { if (rangeGesture.current?.pointerId === event.pointerId) { pointerX.current = event.clientX; pointerY.current = event.clientY; updateRangeSelection(); } }}
    onPointerUp={event => { if (rangeGesture.current?.pointerId === event.pointerId) { pointerX.current = event.clientX; pointerY.current = event.clientY; updateRangeSelection(); stopRangeSelection(); } }}
    onPointerCancel={() => stopRangeSelection(true)} onLostPointerCapture={() => stopRangeSelection()}
    onKeyDownCapture={event => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || editor.view.composing) return;
    if (event.key === 'Escape' && dragging.current) { event.preventDefault(); event.stopPropagation(); stopDrag(true); }
    if (event.key === 'Escape' && rangeGesture.current) { event.preventDefault(); event.stopPropagation(); stopRangeSelection(true); }
  }}
    onDragOverCapture={event => {
      if (!dragging.current) return;
      event.preventDefault(); event.stopPropagation(); pointerY.current = event.clientY; pointerX.current = event.clientX;
      if (!frame.current) frame.current = requestAnimationFrame(scrollDrag);
      positionDropIndicator();
      event.dataTransfer.dropEffect = 'move';
    }}
    onDropCapture={event => {
      if (!internalDrag.current) return;
      event.preventDefault(); event.stopPropagation();
      const target = dropAt(event.clientX, event.clientY);
      const moved = dragging.current && target && moveRichBlocks(editor, dragging.current, target.block, target.after);
      stopDrag(!moved); internalDrag.current = false;
    }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) { cancelAnimationFrame(frame.current); frame.current = 0; setDropTop(null); } }}
  >
    <div ref={controlsRef} className="block-controls" data-heading={richBlockAt(editor, toolbar.pos)?.node.type.name === 'heading' && richSectionEnd(editor.state.doc, toolbar.pos) > toolbar.pos + editor.state.doc.nodeAt(toolbar.pos)!.nodeSize || undefined} style={{ top: toolbar.top }}>
      <button ref={gripRef} type="button" aria-label="内容块操作" title={gripTitle} disabled={props.disabled} draggable={!props.disabled} aria-haspopup="menu" aria-expanded={menu === 'block'} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); openBlockMenu(); } }} onDragStart={event => {
        if (editor.view.composing) { event.preventDefault(); return; }
        dragging.current = event.altKey ? richBlockMoveSources(editor, toolbar.pos, true) : selectedRichBlocks(editor, toolbar.pos);
        if (!dragging.current.length) { dragging.current = null; event.preventDefault(); return; }
        setIsDragging(true);
        beforeDrag.current = editor.state;
        internalDrag.current = true; selectRichBlocks(editor, dragging.current);
        const slice = editor.state.selection.content();
        event.dataTransfer.setData('text/plain', dragging.current.map(block => block.node.textContent).join('\n\n'));
        const dom = editor.view.nodeDOM(dragging.current[0].pos);
        if (dom instanceof HTMLElement && root.current) {
          dragPreview.current?.remove();
          const preview = document.createElement('div');
          preview.className = 'markdown typeset rich-editor-content block-drag-preview';
          preview.style.width = `${dom.getBoundingClientRect().width}px`;
          preview.setAttribute('aria-hidden', 'true'); preview.inert = true;
          for (const block of dragging.current) {
            const element = editor.view.nodeDOM(block.pos);
            if (!(element instanceof HTMLElement)) continue;
            const copy = element.cloneNode(true) as HTMLElement;
            copy.classList.remove('rich-selected-block', 'ProseMirror-selectednode');
            copy.querySelectorAll('.rich-selected-block, .ProseMirror-selectednode').forEach(node => node.classList.remove('rich-selected-block', 'ProseMirror-selectednode'));
            preview.append(copy);
          }
          root.current.append(preview); dragPreview.current = preview;
          event.dataTransfer.setDragImage(preview, 0, 0);
        }
        event.dataTransfer.effectAllowed = 'move';
        editor.view.dragging = { slice, move: true };
      }} onDragEnd={() => { stopDrag(true); internalDrag.current = false; }} onClick={event => {
        if (editor.view.composing) return;
        if (event.shiftKey) {
          const target = richBlockAt(editor, toolbar.pos);
          if (target) extendRichBlocksTo(editor, target);
          setMenu(null); return;
        }
        if (menu === 'block') { closeMenu(); return; }
        openBlockMenu();
      }}><GripVertical size={16} /></button>
    </div>
    <EditorContent editor={editor} />
    {selectionBox && <div className="rich-selection-box" aria-hidden="true" style={selectionBox} />}
    {!props.disabled && <RichTagSuggestions editor={editor} />}
    {dropTop != null && <div className="block-drop-indicator" style={{ top: dropTop }} />}
    {!props.disabled && editor.state.selection instanceof TextSelection && !editor.state.selection.empty && !menu && <div className="rich-inline-tools" style={{ top: inlineTop }} aria-label="文字格式">
      <button aria-label="粗体" aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button aria-label="斜体" aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
      <button aria-label="删除线" aria-pressed={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button aria-label="行内代码" aria-pressed={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>&lt;/&gt;</button>
      <RichFormatTools editor={editor} onError={props.onError} />
    </div>}
    {menu === 'insert' && <Popover.Portal><Popover.Positioner anchor={controlsRef} side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50"><Popover.Popup ref={menuRef} initialFocus={() => slash.current ? false : true} finalFocus={false} className="rich-menu block-menu rich-insert-menu" role="menu" aria-label="插入内容块菜单" onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
      if (event.target !== event.currentTarget.querySelector('.rich-insert-close')) handleInsertKey(event.nativeEvent);
    }}>
      <>
        {!slash.current && <div className="rich-insert-search"><Search size={16} aria-hidden="true" /><input aria-label="筛选内容块" placeholder="搜索内容块…" value={filter} onChange={event => { setFilter(event.target.value); setActiveIndex(0); }} /></div>}
        <span className="sr-only" role="status" aria-live="polite">{items.length ? items[activeIndex]?.label : '未找到匹配的内容块'}</span>
        <div className="rich-insert-list">
          {items.length === 0 && <p className="rich-insert-empty">未找到匹配的内容块</p>}
          {items.map((item, index) => { const Icon = item.icon ?? Type; const group = item.group ?? '基本区块'; return <div key={item.label}>
            {(index === 0 || (items[index - 1].group ?? '基本区块') !== group) && <div className="block-menu-label">{group}</div>}
            <button role="menuitem" aria-label={item.label} data-active={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}><Icon size={18} aria-hidden="true" /><span>{item.label}</span>{item.hint && <kbd aria-hidden="true">{item.hint}</kbd>}</button>
          </div>; })}
        </div>
        <button className="rich-insert-close" onClick={closeMenu}>关闭菜单<kbd>esc</kbd></button>
      </>
    </Popover.Popup></Popover.Positioner></Popover.Portal>}
    {menu === 'block' && <Menu.Portal><Menu.Positioner anchor={gripRef} side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50"><Menu.Popup ref={menuRef} className="rich-block-menu" aria-label="内容块操作菜单" finalFocus={() => editor.view.dom}>
      <Menu.SubmenuRoot open={conversionOpen} onOpenChange={setConversionOpen}>
        <Menu.SubmenuTrigger disabled={selectedBlocks.length !== 1 || !firstSelected?.node.isTextblock}><RefreshCw aria-hidden="true" /><span>转换为</span><ChevronRight className="rich-menu-check" aria-hidden="true" /></Menu.SubmenuTrigger>
        <Menu.Portal><Menu.Positioner collisionPadding={12} sideOffset={isMobile ? -260 : 6} alignOffset={-5} className="z-50"><Menu.Popup className="rich-block-menu rich-convert-menu" aria-label="转换为">
          {insertItems.filter(item => item.convertible).map((item, index) => { const Icon = item.icon ?? Type; const current = isCurrentType(item); const label = item.icon === Heading ? `标题 ${item.hint!.length}` : item.label; return <div key={item.label}>
            {(index === 7 || index === 10) && <Menu.Separator />}
            <Menu.Item aria-label={label} onClick={() => { if (current) { closeMenu(); return; } insertion.current = null; slash.current = null; editor.commands.setTextSelection(toolbar.pos + 1); choose(item); }}><Icon aria-hidden="true" /><span>{label}</span>{current && <Check className="rich-menu-check" aria-label="当前类型" />}</Menu.Item>
          </div>; })}
        </Menu.Popup></Menu.Positioner></Menu.Portal>
      </Menu.SubmenuRoot>
      <Menu.Item onClick={() => { const block = richBlockAt(editor, toolbar.pos); insertion.current = block ? block.pos + block.node.nodeSize : null; slash.current = null; setFilter(''); setActiveIndex(0); setMenu('insert'); }}><Plus aria-hidden="true" /><span>在下方插入</span></Menu.Item>
      <Menu.Item onClick={() => { duplicateRichBlocks(editor, selectedBlocks); closeMenu(); }}><Copy aria-hidden="true" /><span>复制</span></Menu.Item>
      <Menu.Separator />
      <Menu.Item disabled={!upTarget} onClick={() => move(-1)}><ArrowUp aria-hidden="true" /><span>{movingSection ? '上移章节' : '上移'}</span></Menu.Item>
      <Menu.Item disabled={!downTarget} onClick={() => move(1)}><ArrowDown aria-hidden="true" /><span>{movingSection ? '下移章节' : '下移'}</span></Menu.Item>
      <Menu.Separator />
      <Menu.Item data-variant="destructive" onClick={() => { if (firstSelected && lastSelected) editRichStructure(editor, () => { editor.commands.deleteRange({ from: firstSelected.pos, to: lastSelected.pos + lastSelected.node.nodeSize }); }); closeMenu(); }}><Trash2 aria-hidden="true" /><span>删除</span></Menu.Item>
      {(selectedBlocks.length > 1 || movingSection) && <><Menu.Separator /><div className="rich-block-menu-note" role="status">{movingSection ? `章节移动包含 ${moveSources.length} 个块；其他操作仅作用于标题` : `已选择 ${selectedBlocks.length} 个块`}</div></>}
    </Menu.Popup></Menu.Positioner></Menu.Portal>}
    {!props.disabled && editor.isActive('table') && <div className="rich-table-tools" aria-label="表格操作">
      <button onClick={() => editor.chain().focus().addRowAfter().run()}>添加行</button><button onClick={() => editor.chain().focus().addColumnAfter().run()}>添加列</button>
      <select aria-label="列对齐" defaultValue="" onChange={event => { alignRichColumn(editor, event.target.value); event.target.value = ''; }}><option value="" disabled>对齐</option><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select>
      {editor.isActive('tableHeader') && <select aria-label="表头范围" value={editor.getAttributes('tableHeader').scope ?? ''} onChange={event => editor.chain().focus().updateAttributes('tableHeader', { scope: event.target.value || null }).run()}><option value="">自动</option><option value="col">列标题</option><option value="row">行标题</option></select>}
      <button onClick={() => editor.chain().focus().toggleHeaderRow().run()}>切换表头</button>
      <button onClick={() => editor.chain().focus().mergeOrSplit().run()}>合并／拆分单元格</button>
      <button disabled={!editor.isActive('tableRow') || (() => { const p = editor.state.selection.$from; for (let d = p.depth; d > 0; d--) if (p.node(d).type.name === 'tableRow') return p.index(d - 1) !== p.node(d - 1).childCount - 1; return true; })()} onClick={() => editor.chain().focus().updateAttributes('tableRow', { footer: !editor.getAttributes('tableRow').footer }).run()}>切换表尾行</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()}>删除行</button><button onClick={() => editor.chain().focus().deleteColumn().run()}>删除列</button>
    </div>}

  </div></Popover.Root></Menu.Root>;
});
