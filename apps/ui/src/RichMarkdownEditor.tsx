import { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps, type ChainedCommands, type Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as MarkdownExtension } from '@tiptap/markdown';
import { TableCell } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import Image, { type ImageOptions } from '@tiptap/extension-image';
import { InlineMath, BlockMath } from '@tiptap/extension-mathematics';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { richBlock, richBlockAt, moveRichBlock, editRichStructure, type RichBlock } from './rich-blocks';
import { RichInlineTags } from './rich-inline-tags';
import { RichTagSuggestions } from './RichTagSuggestions';
import { RichMath } from './RichMath';
import { RichFormatTools } from './RichFormatTools';
import { richTable, RichTableRow, RichTableHeader, alignRichColumn } from './rich-table';
import { Popover } from 'radix-ui';
import { Plus, GripVertical, Type, Heading, List, ListOrdered, ListTodo, Quote, Code, Minus, Table, Sigma, Image as ImageIcon, Search, type LucideIcon } from 'lucide-react';
import { MarkdownSource, SourceMetadata, PreservedMarkdown } from './wysiwyg-markdown';
import { Markdown } from './markdown';
import { imageSource, openVaultLink } from './vault-links';
import { externalUrl } from './urls';
import { request } from './bridge';
import { semanticExtensions, WikiLink, FootnoteReference, FootnoteDefinition } from './rich-semantic';
import { bindNoteImage } from './note-image';
import './typeset.css';
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
  { label: '代码', keywords: 'code 代码块', icon: Code, hint: '```', group: '其他内容', run: e => e.toggleCodeBlock() },
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
  const converting = useRef(false);
  const [toolbar, setToolbar] = useState({ top: 14, pos: 0 });
  const [, setRevision] = useState(0);
  const [dropTop, setDropTop] = useState<number | null>(null);
  const dragging = useRef<RichBlock | null>(null);
  const internalDrag = useRef(false);
  const frame = useRef(0);
  const pointerY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const insertion = useRef<number | null>(null);
  const slash = useRef<{ from: number; to: number } | null>(null);
  const editorRef = useRef<TiptapEditor | null>(null);
  const editor: TiptapEditor | null = useEditor({
    immediatelyRender: false,
    extensions: [RichInlineTags, StarterKit.configure({ link: { openOnClick: false }, trailingNode: false }), MarkdownExtension, SourceMetadata, WikiLink, FootnoteReference, FootnoteDefinition, ...semanticExtensions(() => editorRef.current),
      richTable(() => editorRef.current), RichTableRow, RichTableHeader, TableCell, TaskList, TaskItem.configure({ nested: true, a11y: { checkboxLabel: node => `待办：${node.textContent}` } }),
      SafeImageExtension.configure({ notePath: () => latest.current.notePath }), WikiImageExtension.configure({ notePath: () => latest.current.notePath }),
      PreservedExtension.configure({ notePath: () => latest.current.notePath }),
      InlineMath.extend({ addNodeView() { return ReactNodeViewRenderer(RichMath); } }),
      BlockMath.extend({ addNodeView() { return ReactNodeViewRenderer(RichMath); } }),
    ],
    content: '', editable: !props.disabled,
    editorProps: {
      attributes: { class: 'markdown typeset rich-editor-content', role: 'textbox', 'aria-label': '笔记内容', 'aria-multiline': 'true' },
      handleKeyDown(view, event) {
        if (event.isComposing || event.keyCode === 229 || view.composing) return false;
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); if (!latest.current.disabled) latest.current.onSave(); return true; }
        if (event.key === 'Escape') { slash.current = null; setMenu(null); stopDrag(); return false; }
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
      handlePaste(_view, event) {
        if (latest.current.disabled) return true;
        const text = event.clipboardData?.getData('text/plain');
        if (text == null) return false;
        event.preventDefault(); const e = editorRef.current; if (e) e.commands.insertContent(new MarkdownSource().parse(e, text)); return true;
      },
    },
    onUpdate({ editor: e }) {
      if (!initialized.current) return;
      const value = source.current.serialize(e); emitted.current = value; latest.current.onChange(value);
      const selection = e.state.selection;
      const text = selection.$from.parent.textContent;
      if (!e.view.composing && selection.empty && selection.$from.parent.type.name === 'paragraph' && /^\/[^\n]*$/.test(text)) {
        slash.current = { from: selection.$from.start(), to: selection.$from.end() }; converting.current = false; setActiveIndex(0); setMenu('insert'); setFilter(text.slice(1));
      } else { slash.current = null; setMenu(null); }
    },
    onSelectionUpdate({ editor: e }) { positionToolbar(e); setRevision(n => n + 1); },
  });
  editorRef.current = editor;
  function positionToolbar(e: TiptapEditor, pos = e.state.selection.from) {
    if (!root.current) return;
    const block = richBlock(e, pos);
    if (!block) return;
    const from = block.pos;
    const element = e.view.nodeDOM(from);
    if (element instanceof HTMLElement) {
      const rect = element.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(element).lineHeight) || 26;
      setToolbar({ pos: from, top: rect.top - root.current.getBoundingClientRect().top + Math.min(rect.height, line) / 2 });
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
    const observer = new ResizeObserver(() => positionToolbar(editor));
    if (root.current) observer.observe(root.current); return () => observer.disconnect();
  }, [editor]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, filter]);
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
    const block = richBlockAt(editor, toolbar.pos);
    if (!block) return;
    const resolved = editor.state.doc.resolve(block.pos), parent = resolved.parent;
    const index = block.index + direction;
    if (index < 0 || index >= parent.childCount) return;
    const pos = direction < 0 ? block.pos - parent.child(index).nodeSize : block.pos + block.node.nodeSize;
    const target = { pos, parent: block.parent, index, node: parent.child(index) };
    moveRichBlock(editor, block, target, direction > 0); setMenu(null);
  }
  function stopDrag() {
    cancelAnimationFrame(frame.current); frame.current = 0; dragging.current = null; setDropTop(null);
    if (editorRef.current) editorRef.current.view.dragging = null;
  }
  function scrollDrag() {
    if (!dragging.current || !root.current) return;
    let scroller: HTMLElement | null = root.current;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    if (scroller) {
      const rect = scroller.getBoundingClientRect(), y = pointerY.current;
      const delta = y < rect.top + 56 ? -12 : y > rect.bottom - 56 ? 12 : 0;
      if (delta) scroller.scrollTop += delta;
    }
    frame.current = requestAnimationFrame(scrollDrag);
  }
  function dropAt(left: number, top: number) {
    if (!editor || !dragging.current) return null;
    const position = editor.view.posAtCoords({ left, top });
    const block = position ? richBlock(editor, position.pos) : null;
    const dom = block ? editor.view.nodeDOM(block.pos) : null;
    if (!block || block.parent !== dragging.current.parent || !(dom instanceof HTMLElement) || block.pos === dragging.current.pos) return null;
    const rect = dom.getBoundingClientRect();
    return { block, after: top >= (rect.top + rect.bottom) / 2, rect };
  }
  const query = filter.trim().toLowerCase();
  const items = insertItems.filter(item => (!converting.current || item.convertible) && (query ? `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(query) : !item.searchOnly));
  if (!converting.current && props.onImage && (!query || '图片 image photo'.includes(query))) items.push({ label: '图片', icon: ImageIcon, group: '其他内容', run: e => e });
  const closeMenu = () => { slash.current = null; insertion.current = null; setMenu(null); editor.commands.focus(); };
  function choose(item: MenuItem) {
    if (item.label === '图片') props.onImage?.(markdown => run({ label: '图片', run: chain => chain.insertContent(markdown, { contentType: 'markdown' }) }));
    else run(item);
  }
  return <Popover.Root open={menu !== null} onOpenChange={open => { if (!open) { slash.current = null; setMenu(null); } }}><div className="note-editor rich-editor" ref={root} onKeyDownCapture={event => { if (event.key === 'Escape') stopDrag(); }}
    onDragOverCapture={event => {
      if (!dragging.current) return;
      event.preventDefault(); event.stopPropagation(); pointerY.current = event.clientY;
      if (!frame.current) frame.current = requestAnimationFrame(scrollDrag);
      const target = dropAt(event.clientX, event.clientY);
      if (!target) { setDropTop(null); return; }
      const { after, rect } = target;
      setDropTop((after ? rect.bottom : rect.top) - root.current!.getBoundingClientRect().top);
      event.dataTransfer.dropEffect = 'move';
    }}
    onDropCapture={event => {
      if (!internalDrag.current) return;
      event.preventDefault(); event.stopPropagation();
      const target = dropAt(event.clientX, event.clientY);
      if (dragging.current && target) moveRichBlock(editor, dragging.current, target.block, target.after);
      stopDrag(); internalDrag.current = false;
    }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) { cancelAnimationFrame(frame.current); frame.current = 0; setDropTop(null); } }}
    onMouseMove={event => {
    if (menu || event.buttons || (event.target as HTMLElement).closest('.block-controls, .rich-menu, .rich-table-tools')) return;
    const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (position) positionToolbar(editor, position.pos);
  }}>
    <Popover.Anchor asChild><div className="block-controls" style={{ top: toolbar.top }}>
      <button type="button" aria-label="插入内容块" disabled={props.disabled} onClick={() => { const block = richBlockAt(editor, toolbar.pos);
        insertion.current = block && block.node.content.size ? toolbar.pos + block.node.nodeSize : null;
        editor.commands.setTextSelection(Math.min(toolbar.pos + 1, editor.state.doc.content.size)); slash.current = null; converting.current = false; setActiveIndex(0); setFilter(''); setMenu(menu === 'insert' ? null : 'insert'); }}><Plus size={18} /></button>
      <button type="button" aria-label="内容块操作" title="拖动以移动，点击打开菜单" disabled={props.disabled} draggable={!props.disabled} onDragStart={event => {
        if (editor.view.composing) { event.preventDefault(); return; }
        internalDrag.current = true; dragging.current = richBlockAt(editor, toolbar.pos);
        if (!dragging.current) { event.preventDefault(); return; }
        editor.commands.setNodeSelection(toolbar.pos);
        const slice = editor.state.selection.content();
        event.dataTransfer.setData('text/plain', dragging.current.node.textContent);
        const dom = editor.view.nodeDOM(toolbar.pos);
        if (dom instanceof HTMLElement) event.dataTransfer.setDragImage(dom, 0, 0);
        event.dataTransfer.effectAllowed = 'move';
        editor.view.dragging = { slice, move: true };
      }} onDragEnd={() => { stopDrag(); internalDrag.current = false; }} onClick={() => setMenu(menu === 'block' ? null : 'block')}><GripVertical size={18} /></button>
    </div></Popover.Anchor>
    <EditorContent editor={editor} />
    {!props.disabled && <RichTagSuggestions editor={editor} />}
    {dropTop != null && <div className="block-drop-indicator" style={{ top: dropTop }} />}
    {!props.disabled && editor.state.selection instanceof TextSelection && !editor.state.selection.empty && !menu && <div className="rich-inline-tools" style={{ top: Math.max(0, toolbar.top - 40) }} aria-label="文字格式">
      <button aria-label="粗体" aria-pressed={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button aria-label="斜体" aria-pressed={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
      <button aria-label="删除线" aria-pressed={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>
      <button aria-label="行内代码" aria-pressed={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>&lt;/&gt;</button>
      <RichFormatTools context="text" editor={editor} onImage={props.onImage} onError={props.onError} />
    </div>}
    {menu && <Popover.Portal><Popover.Content ref={menuRef} side="bottom" align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={event => { if (slash.current) event.preventDefault(); }} onCloseAutoFocus={event => event.preventDefault()} className={`rich-menu block-menu ${menu === 'insert' ? 'rich-insert-menu' : ''}`} role="menu" aria-label={menu === 'insert' ? '插入内容块菜单' : '内容块操作菜单'} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
      if (menu === 'insert') { if (event.target !== event.currentTarget.querySelector('.rich-insert-close')) handleInsertKey(event.nativeEvent); return; }
      if (['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
        const choices = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)'));
        const index = choices.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'Enter' && index < 0) { event.preventDefault(); choices[0]?.click(); }
        else if (event.key !== 'Enter') { event.preventDefault(); choices[(index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus(); }
      }
    }}>
      {menu === 'insert' ? <>
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
      </> : <>
        <button role="menuitem" disabled={richBlockAt(editor, toolbar.pos)?.index === 0} onClick={() => move(-1)}>上移</button><button role="menuitem" disabled={editor.state.doc.resolve(toolbar.pos).index() >= editor.state.doc.resolve(toolbar.pos).parent.childCount - 1} onClick={() => move(1)}>下移</button>
        <button role="menuitem" onClick={() => { const node = editor.state.doc.nodeAt(toolbar.pos); if (node) editor.commands.insertContentAt(toolbar.pos + node.nodeSize, node.toJSON()); setMenu(null); }}>复制</button>
        <button role="menuitem" onClick={() => { const node = editor.state.doc.nodeAt(toolbar.pos); if (node) editor.commands.deleteRange({ from: toolbar.pos, to: toolbar.pos + node.nodeSize }); setMenu(null); }}>删除</button>
        <button role="menuitem" disabled={!editor.state.doc.nodeAt(toolbar.pos)?.isTextblock || editor.state.doc.nodeAt(toolbar.pos)?.type.name === 'codeBlock'} onClick={() => { insertion.current = null; slash.current = null; converting.current = true; setFilter(''); setActiveIndex(0); editor.commands.setTextSelection(toolbar.pos + 1); setMenu('insert'); }}>转换为</button>
        <RichFormatTools context="block" editor={editor} onImage={props.onImage} onError={props.onError} />
      </>}
    </Popover.Content></Popover.Portal>}
    {!props.disabled && editor.isActive('table') && <div className="rich-table-tools" aria-label="表格操作">
      <button onClick={() => editor.chain().focus().addRowAfter().run()}>添加行</button><button onClick={() => editor.chain().focus().addColumnAfter().run()}>添加列</button>
      <select aria-label="列对齐" defaultValue="" onChange={event => { alignRichColumn(editor, event.target.value); event.target.value = ''; }}><option value="" disabled>对齐</option><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select>
      {editor.isActive('tableHeader') && <select aria-label="表头范围" value={editor.getAttributes('tableHeader').scope ?? ''} onChange={event => editor.chain().focus().updateAttributes('tableHeader', { scope: event.target.value || null }).run()}><option value="">自动</option><option value="col">列标题</option><option value="row">行标题</option></select>}
      <button onClick={() => editor.chain().focus().toggleHeaderRow().run()}>切换表头</button>
      <button onClick={() => editor.chain().focus().mergeOrSplit().run()}>合并／拆分单元格</button>
      <button disabled={!editor.isActive('tableRow') || (() => { const p = editor.state.selection.$from; for (let d = p.depth; d > 0; d--) if (p.node(d).type.name === 'tableRow') return p.index(d - 1) !== p.node(d - 1).childCount - 1; return true; })()} onClick={() => editor.chain().focus().updateAttributes('tableRow', { footer: !editor.getAttributes('tableRow').footer }).run()}>切换表尾行</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()}>删除行</button><button onClick={() => editor.chain().focus().deleteColumn().run()}>删除列</button>
    </div>}

  </div></Popover.Root>;
});
