import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ComponentType, type ComponentProps } from 'react';
import { getMarkRange, useEditorState, type Editor } from '@tiptap/react';
import { TextSelection, type SelectionBookmark, type Transaction } from '@tiptap/pm/state';
import type { NotePage } from '@memocard/contracts';
import { Popover } from '@base-ui/react/popover';
import { request } from './bridge';
import { externalUrl, internalTarget } from './urls';
import { editRichStructure } from './rich-blocks';
import { fileTitle } from './note-files';

const linkPlacement = {
  align: 'center',
  sideOffset: 6,
  collisionPadding: 12,
  collisionAvoidance: { side: 'flip', align: 'shift', fallbackAxisSide: 'none' },
} as const;

type Properties = { value: string; existingLink: boolean; linkText?: string };
function editorLink(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href], a[data-wiki-target]') : null;
}

function linkMarkRange(editor: Editor, anchor: HTMLAnchorElement) {
  if (!editor.view.dom.contains(anchor)) return;
  const from = editor.view.posAtDOM(anchor, 0);
  const $from = editor.state.doc.resolve(from);
  const mark = $from.nodeAfter?.marks.find(candidate =>
    candidate.type.name === 'wikiLink' ? candidate.attrs.target === anchor.getAttribute('data-wiki-target')
      : candidate.type.name === 'link' && candidate.attrs.href === anchor.getAttribute('href'));
  return mark && getMarkRange($from, mark.type, mark.attrs);
}
const emailAddress = /^[^\s@/:?#<>]+@[^\s@/:?#<>]+\.[^\s@/:?#<>]+$/;
const marks = [['bold', '粗体'], ['italic', '斜体'], ['strike', '删除线'], ['code', '行内代码'], ['mark', '高亮'], ['sup', '上标'], ['sub', '下标']] as const;
function markState(editor: Editor, name: string): boolean | 'mixed' {
  let marked = false, plain = false;
  const { from, to } = editor.state.selection;
  editor.state.doc.nodesBetween(from, to, node => {
    if (node.isText) { if (node.marks.some(mark => mark.type.name === name || name === 'link' && mark.type.name === 'wikiLink')) marked = true; else plain = true; }
  });
  return marked ? plain ? 'mixed' : true : false;
}
export type RichFormatUI = {
  PopoverPortal?: ComponentType<ComponentProps<typeof Popover.Portal>>;
  uiClassName?: string;
  icons: Record<'Link' | 'Highlighter' | 'MoreHorizontal' | 'Superscript' | 'Subscript' | 'Check' | 'Minus' | 'Code' | 'Bold' | 'Italic' | 'Strikethrough' | 'Unlink' | 'RemoveFormatting' | 'FileText' | 'Globe' | 'Copy' | 'Pencil' | 'X', import('./rich-editor-core').RichIcon>;
  Dialog: typeof import('@ui/components/dialog').Dialog;
  DialogContent: ComponentType<ComponentProps<typeof import('@ui/components/dialog').DialogContent>>;
  DialogTitle: ComponentType<ComponentProps<typeof import('@ui/components/dialog').DialogTitle>>;
  MobileDialogHeader?: ComponentType<{ title: string; onClose: () => void }>;
  Toolbar?: ComponentType<ComponentProps<'div'>> | 'div';
  Input: ComponentType<ComponentProps<typeof import('@ui/components/input').Input>>;
  Button: ComponentType<Omit<ComponentProps<typeof import('@ui/components/button').Button>, 'render'>>;
};
export function createRichFormatTools({ PopoverPortal = Popover.Portal, uiClassName = '', icons, Dialog, DialogContent, DialogTitle, MobileDialogHeader, Toolbar = 'div', Input, Button }: RichFormatUI) {
const { Link, Highlighter, MoreHorizontal, Superscript, Subscript, Check, Minus, Code, Bold, Italic, Strikethrough, Unlink, RemoveFormatting, FileText, Globe, Copy, Pencil, X } = icons;
return function RichFormatTools({ editor, mobile, onOpenLink, onError }: { editor: Editor; mobile: boolean; onOpenLink: (anchor: HTMLAnchorElement) => void; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<Properties | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [matches, setMatches] = useState<NotePage['notes']>([]);
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [hoverLink, setHoverLink] = useState<HTMLAnchorElement | null>(null);
  const [editAnchor, setEditAnchor] = useState<HTMLAnchorElement | null>(null);
  const [copied, setCopied] = useState(false);
  const linkPopup = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const errorId = useId(), helpId = useId();
  const titleInput = useRef<HTMLInputElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, visible: false, sheetBottom: 12, sheetHeight: window.innerHeight - 24 });
  const toolbar = useRef<HTMLDivElement>(null), propertyInput = useRef<HTMLInputElement>(null);
  const bookmark = useRef<SelectionBookmark | null>(null);
  const originalHoveredLink = useRef<Properties | null>(null);
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({ from: e.state.selection.from, to: e.state.selection.to, formats: marks.map(([name]) => markState(e, name)), link: markState(e, 'link') }) });
  const hasTextSelection = editor.state.selection instanceof TextSelection && state.from !== state.to;
  const linkPreviewOpen = !!hoverLink && !hasTextSelection && !open && !propertiesOpen;
  const hasProperties = properties !== null;
  const showRecent = hasProperties && !properties.value.trim();
  useEffect(() => {
    const dom = editor.view.dom;
    function reveal(anchor: HTMLAnchorElement, delay: number) {
      if (open || propertiesOpen || !editor.state.selection.empty || !linkMarkRange(editor, anchor)) return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        if (!dom.contains(anchor) || !editor.state.selection.empty) return;
        setCopied(false);
        setHoverLink(anchor);
      }, delay);
    }
    function enter(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      const anchor = editorLink(event.target);
      if (anchor && anchor !== editorLink(event.relatedTarget)) reveal(anchor, 160);
    }
    function leave(event: PointerEvent | FocusEvent) {
      const anchor = editorLink(event.target);
      if (!anchor || anchor === editorLink(event.relatedTarget) || (event.relatedTarget instanceof Node && linkPopup.current?.contains(event.relatedTarget))) return;
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setHoverLink(null), 240);
    }
    function focus(event: FocusEvent) {
      const anchor = editorLink(event.target);
      if (anchor) reveal(anchor, 0);
    }
    function keyboard(event: globalThis.KeyboardEvent) {
      if (!editorLink(event.target)) return;
      if (event.key === 'ArrowDown' && linkPopup.current) {
        event.preventDefault();
        event.stopPropagation();
        linkPopup.current.querySelector('button')?.focus();
      }
      if (event.key === 'Escape') {
        clearTimeout(hoverTimer.current);
        setHoverLink(null);
      }
    }
    function clearPreview() {
      clearTimeout(hoverTimer.current);
      setHoverLink(null);
    }
    dom.addEventListener('pointerover', enter);
    dom.addEventListener('pointerout', leave);
    dom.addEventListener('focusin', focus);
    dom.addEventListener('focusout', leave);
    dom.addEventListener('keydown', keyboard, true);
    editor.on('update', clearPreview);
    return () => {
      clearTimeout(hoverTimer.current);
      dom.removeEventListener('pointerover', enter);
      dom.removeEventListener('pointerout', leave);
      dom.removeEventListener('focusin', focus);
      dom.removeEventListener('focusout', leave);
      dom.removeEventListener('keydown', keyboard, true);
      editor.off('update', clearPreview);
    };
  }, [editor, open, propertiesOpen]);
  useLayoutEffect(() => {
    const place = () => {
      if (!toolbar.current || !(editor.state.selection instanceof TextSelection) || editor.state.selection.empty) return;
      const start = editor.view.coordsAtPos(editor.state.selection.from), end = editor.view.coordsAtPos(editor.state.selection.to);
      const viewport = window.visualViewport;
      let left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      let right = left + (viewport?.width ?? window.innerWidth), bottom = top + (viewport?.height ?? window.innerHeight);
      for (let parent = editor.view.dom.parentElement; parent; parent = parent.parentElement) {
        if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)) { const rect = parent.getBoundingClientRect(); top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
      }
      const width = toolbar.current.offsetWidth, height = toolbar.current.offsetHeight;
      left += 12; right -= 12;
      const anchor = start.bottom > top && start.top < bottom ? start : end;
      const visible = anchor.bottom > top && anchor.top < bottom && bottom - top >= height + 12;
      const center = start.top === end.top ? (start.left + end.right) / 2 : anchor.left;
      setPosition({ left: Math.max(left, Math.min(center - width / 2, right - width)), top: Math.max(top + 6, Math.min(anchor.top - height - 8 >= top ? anchor.top - height - 8 : anchor.bottom + 8, bottom - height - 6)), visible, sheetBottom: Math.max(12, window.innerHeight - (viewport?.offsetTop ?? 0) - (viewport?.height ?? window.innerHeight) + 12), sheetHeight: (viewport?.height ?? window.innerHeight) - 24 });
    };
    place();
    const observer = new ResizeObserver(place); if (toolbar.current) observer.observe(toolbar.current);
    document.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
    return () => { observer.disconnect(); document.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place); };
  }, [editor, state.from, state.to, mobile, editAnchor]);
  useLayoutEffect(() => { if (hasProperties) (editAnchor ? propertyInput.current : titleInput.current ?? propertyInput.current)?.focus({ preventScroll: true }); }, [hasProperties, editAnchor]);
  useEffect(() => {
    const map = ({ transaction }: { transaction: Transaction }) => { if (bookmark.current && transaction.docChanged) bookmark.current = bookmark.current.map(transaction.mapping); };
    editor.on('transaction', map); return () => { editor.off('transaction', map); };
  }, [editor]);
  useEffect(() => {
    let active = true;
    if (!propertiesOpen || (!search && !showRecent)) return;
    const query = showRecent ? { sort: 'updatedAt', limit: 4 } : { query: search, tags: [], limit: 12 };
    const timer = setTimeout(() => { void request<NotePage>('queryNotes', query).then(page => { if (active) { setMatches(page.notes); setSearchError(''); setSearching(false); } }).catch(() => { if (active) { setSearchError('无法读取笔记，请直接输入目标路径。'); setSearching(false); } }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [propertiesOpen, search, showRecent]);
  function restore() {
    if (bookmark.current) editor.view.dispatch(editor.state.tr.setSelection(bookmark.current.resolve(editor.state.doc)));
    editor.view.focus();
  }
  function showLink(anchor: HTMLAnchorElement | null = null) {
    clearTimeout(hoverTimer.current);
    setHoverLink(null);
    setEditAnchor(anchor);
    bookmark.current = editor.state.selection.getBookmark();
    const wiki = editor.isActive('wikiLink');
    const value = String(editor.getAttributes(wiki ? 'wikiLink' : 'link')[wiki ? 'target' : 'href'] ?? '');
    const { $from, from, to } = editor.state.selection;
    const selectedNode = $from.nodeAfter;
    const linkText = value && !$from.textOffset && selectedNode?.isText && selectedNode.nodeSize === to - from ? selectedNode.text : undefined;
    setSearch(''); setSearchError(''); setError(''); setTitleError(''); setMatches([]); setSearching(!value);
    const draft = { value: wiki ? `[[${value}]]` : value, existingLink: !!value, linkText };
    originalHoveredLink.current = anchor ? draft : null;
    setProperties(draft);
    setPropertiesOpen(true); setOpen(false);
  }
  function changePropertyValue(value: string) {
    if (!properties) return;
    setProperties({ ...properties, value }); setError('');
    const text = value.trim();
    const query = text.startsWith('[[')
      ? text.slice(2).replace(/\]\]$/, '').trim()
      : internalTarget(text) && !/[/?#]/.test(text) && !emailAddress.test(text) ? text : '';
    if (query === search && (!text) === showRecent) return;
    setSearch(query); setMatches([]); setSearchError(''); setSearching(!text || !!query);
  }
  function selectNote(path: string) {
    if (!properties) return;
    const draft = { ...properties, value: `[[${path}]]` };
    if (addingLink) { apply(draft); return; }
    setProperties(draft);
    setSearch(''); setMatches([]); setSearchError(''); setSearching(false); setError('');
    propertyInput.current?.focus();
  }
  function close() { originalHoveredLink.current = null; restore(); setPropertiesOpen(false); bookmark.current = null; }
  function finishPropertyClose(next: boolean) { if (!next && !propertiesOpen) { setProperties(null); setEditAnchor(null); setError(''); } }
  function dismissProperties(details: Pick<Popover.Root.ChangeEventDetails, 'reason' | 'cancel'>) {
    const original = originalHoveredLink.current;
    const edited = original && properties && (properties.value.trim() !== original.value.trim() || properties.linkText !== original.linkText);
    if (edited && (details.reason === 'outside-press' || details.reason === 'focus-out')) {
      details.cancel();
      apply();
    } else {
      close();
    }
  }
  function editHoveredLink(anchor: HTMLAnchorElement) {
    const range = linkMarkRange(editor, anchor);
    if (!range || !editor.isEditable) return;
    editor.commands.setTextSelection(range);
    showLink(anchor);
  }
  async function copyLink(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch { onError('无法复制链接。'); }
  }
  function toggle(name: string) {
    restore();
    editRichStructure(editor, () => { const chain = editor.chain(); (markState(editor, name) === true ? chain.unsetMark(name) : chain.setMark(name)).run(); });
    setOpen(false); bookmark.current = null;
  }
  function removeLink() {
    restore(); editRichStructure(editor, () => { editor.chain().unsetMark('link').unsetMark('wikiLink').run(); });
    setOpen(false); if (properties) close(); else bookmark.current = null;
  }
  function apply(draft = properties) {
    if (!draft || !editor.isEditable) return;
    const p = { ...draft, value: draft.value.trim() };
    if (!p.value) { setError('请输入链接地址。'); propertyInput.current?.focus(); return; }
    const wiki = p.value.startsWith('[[');
    const target = wiki && p.value.endsWith(']]') ? p.value.slice(2, -2).trim() : '';
    const href = emailAddress.test(p.value) ? `mailto:${p.value}` : p.value;
    if (wiki ? !internalTarget(target) || /[[\]|\r\n]/.test(target) : !(externalUrl(href) || internalTarget(href))) {
      setError(wiki ? '请输入有效的笔记路径。' : '请输入有效的网页地址或相对路径。');
      propertyInput.current?.focus();
      return;
    }
    if (p.linkText !== undefined && (!p.linkText.trim() || (wiki && p.linkText.includes(']')))) {
      setTitleError(p.linkText.trim() ? '笔记链接文字不能包含右方括号。' : '请输入链接文字。');
      titleInput.current?.focus();
      return;
    }
    originalHoveredLink.current = null;
    restore();
    editRichStructure(editor, () => {
      const chain = editor.chain();
      const { from, to } = editor.state.selection;
      const title = p.linkText;
      if (title !== undefined && title !== editor.state.doc.textBetween(from, to)) {
        chain.command(({ tr }) => {
          tr.insertText(title, from, to);
          tr.setSelection(TextSelection.create(tr.doc, from, from + title.length));
          return true;
        });
      }
      chain.unsetMark('link').unsetMark('wikiLink').setMark(wiki ? 'wikiLink' : 'link', wiki ? { target } : { href }).run();
    });
    close();
  }
  function menuKeys(event: KeyboardEvent<HTMLElement>) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.rich-format-group button:not(:disabled)'));
    if (!buttons.length) return;
    event.preventDefault(); event.stopPropagation();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length].focus();
  }
  const formatButton = (index: number, child: React.ReactNode) => {
    const [name, label] = marks[index], active = state.formats[index];
    const Icon = ({ strike: Strikethrough, code: Code, sup: Superscript, sub: Subscript })[name as 'strike' | 'code' | 'sup' | 'sub'];
    const item = typeof child === 'string';
    const hint = active === 'mixed' ? `${label}（混合格式）` : item ? undefined : label;
    return <button key={name} className={item ? 'rich-format-item' : undefined} aria-label={label} aria-pressed={active} data-ui-tooltip={hint} onMouseDown={event => event.preventDefault()} onClick={() => toggle(name)}>{item && Icon && <Icon aria-hidden="true" />}{item ? <span>{child}</span> : child}{item && <span className="rich-format-check" aria-hidden="true">{active === true ? <Check /> : active === 'mixed' ? <Minus /> : null}</span>}</button>;
  };
  const more = <div aria-label="扩展文字格式" onKeyDown={menuKeys}>
    <div className="rich-format-group">{mobile && <>{formatButton(2, '删除线')}{formatButton(3, '行内代码')}</>}{marks.slice(5).map(([, label], index) => formatButton(index + 5, label))}</div>
    <div className="rich-format-group"><button className="rich-format-item" onClick={() => showLink()}><Link aria-hidden="true" /><span>编辑链接</span></button><button className="rich-format-item" disabled={!state.link} onClick={removeLink}><Unlink aria-hidden="true" /><span>移除链接</span></button></div>
    <div className="rich-format-group"><button className="rich-format-item" onClick={() => { restore(); editRichStructure(editor, () => { let chain = editor.chain(); for (const [name] of marks) chain = chain.unsetMark(name); chain.unsetMark('abbr').unsetMark('kbd').run(); }); setOpen(false); bookmark.current = null; }}><RemoveFormatting aria-hidden="true" /><span>清除文字样式</span></button></div>
  </div>;
  const propertyTitle = '编辑链接';
  const addingLink = hasProperties && !properties.existingLink;
  const linkResultsStatus = searching ? (showRecent ? '正在读取笔记…' : '正在查找笔记…') : searchError || (search && !matches.length ? '没有匹配的笔记，可直接输入路径。' : '');
  const wikiTarget = hoverLink?.getAttribute('data-wiki-target');
  const hoveredAddress = wikiTarget ?? hoverLink?.getAttribute('href');
  const selectedText = editor.state.doc.textBetween(state.from, state.to, ' ').slice(0, 160);
  const linkTextField = properties?.existingLink && <div className="rich-format-field">
    {properties.linkText === undefined ? <>
      <span className="rich-link-results-label">链接文字</span>
      <p className="rich-format-preview" data-ui-tooltip={selectedText} data-ui-tooltip-overflow>{selectedText}</p>
    </> : <>
      <label htmlFor={`${helpId}-text`}>链接文字</label>
      <Input className="rich-link-text-input" id={`${helpId}-text`} ref={titleInput} value={properties.linkText}
        enterKeyHint={editAnchor ? 'done' : undefined}
        aria-invalid={Boolean(titleError)} aria-describedby={titleError ? `${helpId}-text-error` : undefined}
        onChange={event => { setProperties({ ...properties, linkText: event.target.value }); setTitleError(''); }}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); apply(); } }} />
      {titleError && <p id={`${helpId}-text-error`} className="rich-format-error" role="alert">{titleError}</p>}
    </>}
  </div>;
  const fields = properties && <div className="rich-format-form">
    {!editAnchor && linkTextField}
    <div className="rich-format-field">
      {properties.existingLink && <label htmlFor={`${helpId}-value`}>链接地址</label>}
      <Input id={`${helpId}-value`} ref={propertyInput} aria-label="链接地址"
        enterKeyHint={addingLink || editAnchor ? 'done' : undefined}
        aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="输入链接或笔记名称"
        value={properties.value} onChange={event => changePropertyValue(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && (search || showRecent)) {
            const first = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[role=option]');
            if (first) { event.preventDefault(); first.focus(); }
          }
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); apply(); }
        }} />
      {error && <p id={errorId} className="rich-format-error" role="alert">{error}</p>}
      {(search || showRecent) && (matches.length > 0 || linkResultsStatus) && <div className="rich-link-suggestions">
        {matches.length > 0 && <p className="rich-link-results-label" id={`${helpId}-results`}>{showRecent ? '最近更新的笔记' : '匹配笔记'}</p>}
        <div className="rich-link-results" role="listbox" aria-labelledby={matches.length > 0 ? `${helpId}-results` : undefined} aria-busy={searching} onKeyDown={event => { if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return; const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]')); if (!options.length) return; event.preventDefault(); const index = options.indexOf(document.activeElement as HTMLButtonElement); options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length].focus(); }}>
          {matches.map(note => <button key={note.id} role="option" aria-selected={properties.value === `[[${note.relativePath}]]`} onClick={() => selectNote(note.relativePath)}><FileText aria-hidden="true" /><span>{note.title?.trim() || fileTitle(note.relativePath)}</span></button>)}
        </div>
        <p className="rich-format-hint" role="status">{linkResultsStatus}</p>
      </div>}
    </div>
    {editAnchor && linkTextField}
  </div>;
  const canRemoveLink = hasProperties && state.link;
  const footer = properties && (!addingLink || canRemoveLink) && <div className="rich-format-footer">
    {canRemoveLink && <Button variant="ghost" className="rich-property-remove" onClick={removeLink}><Unlink aria-hidden="true" />移除链接</Button>}
    {!addingLink && !editAnchor && <><Button variant="ghost" onClick={close}>取消</Button><Button onClick={() => apply()}>保存</Button></>}
  </div>;
  const propertyCard = editAnchor ? ' rich-link-edit-card' : addingLink ? ' rich-link-add-card' : '';
  return <>
    {linkPreviewOpen && hoverLink && hoveredAddress && <Popover.Root open onOpenChange={(next, details) => {
      if (next) return;
      clearTimeout(hoverTimer.current);
      setHoverLink(null);
      if (details.reason === 'escape-key') editor.view.focus();
    }}><PopoverPortal><Popover.Positioner anchor={hoverLink} {...linkPlacement} className="z-50">
      <Popover.Popup ref={linkPopup} className={`rich-link-hover ${uiClassName}`} aria-label="链接操作" initialFocus={false} finalFocus={false}
        onPointerEnter={() => clearTimeout(hoverTimer.current)}
        onPointerLeave={event => {
          if (editorLink(event.relatedTarget) === hoverLink || linkPopup.current?.contains(document.activeElement)) return;
          clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => setHoverLink(null), 240);
        }}>
        <Button className="rich-link-hover-address" variant="ghost" size="sm" title={hoveredAddress} onClick={() => { setHoverLink(null); onOpenLink(hoverLink); }}>
          {wikiTarget ? <FileText aria-hidden="true" /> : <Globe aria-hidden="true" />}<span>{hoveredAddress}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="复制链接" title="复制链接" onClick={() => void copyLink(hoveredAddress)}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="编辑" title="编辑" onClick={() => editHoveredLink(hoverLink)}><Pencil aria-hidden="true" /></Button>
        <span className="sr-only" role="status">{copied ? '已复制链接' : ''}</span>
      </Popover.Popup>
    </Popover.Positioner></PopoverPortal></Popover.Root>}
    {hasTextSelection && !editAnchor && <Toolbar ref={toolbar} className={`rich-inline-tools ${uiClassName}`} style={{ top: position.top, left: position.left, visibility: position.visible ? 'visible' : 'hidden' }} role="toolbar" aria-label="文字格式" onKeyDown={event => { if (event.key === 'Escape' && !open && !properties) { event.preventDefault(); setPosition(current => ({ ...current, visible: false })); editor.view.focus(); }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); if (index >= 0) { event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length].focus(); } } }}>
      {formatButton(0, <Bold aria-hidden="true" />)}{formatButton(1, <Italic aria-hidden="true" />)}
      {!mobile && <>{formatButton(2, <Strikethrough aria-hidden="true" />)}{formatButton(3, <Code aria-hidden="true" />)}</>}
      <button aria-label="链接" data-ui-tooltip="编辑链接" aria-pressed={state.link} onMouseDown={event => event.preventDefault()} onClick={() => showLink()}><Link aria-hidden="true" /></button>
      {formatButton(4, <Highlighter aria-hidden="true" />)}
      <Popover.Root open={!mobile && open} onOpenChange={next => { setOpen(next); if (next) { setProperties(null); setPropertiesOpen(false); bookmark.current = editor.state.selection.getBookmark(); } else if (!properties) { restore(); bookmark.current = null; } }}><Popover.Trigger aria-label="更多格式" data-ui-tooltip="更多格式" onClick={mobile ? () => { setProperties(null); setPropertiesOpen(false); bookmark.current = editor.state.selection.getBookmark(); setOpen(true); } : undefined}><MoreHorizontal aria-hidden="true" /></Popover.Trigger>
        <PopoverPortal><Popover.Positioner align="end" sideOffset={8} collisionPadding={12} collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }} className="z-50"><Popover.Popup className={`rich-menu rich-format-menu ${uiClassName}`} aria-label="更多格式" finalFocus={properties ? false : () => editor.view.dom}>{more}</Popover.Popup></Popover.Positioner></PopoverPortal>
      </Popover.Root>
    </Toolbar>}
    <Popover.Root open={!mobile && propertiesOpen} onOpenChange={(next, details) => { if (!next && propertiesOpen) dismissProperties(details); }} onOpenChangeComplete={finishPropertyClose}><PopoverPortal><Popover.Positioner anchor={editAnchor ?? toolbar} {...(editAnchor ? linkPlacement : { ...linkPlacement, align: 'start', sideOffset: 8 })} className="z-50"><Popover.Popup className={`rich-properties rich-link-popup ${uiClassName}${propertyCard}`} aria-label={propertyTitle} initialFocus={() => editAnchor ? propertyInput.current : titleInput.current ?? propertyInput.current} finalFocus={() => editor.view.dom}>
      {addingLink || editAnchor ? <Popover.Title className="sr-only">{propertyTitle}</Popover.Title> : <div className="rich-format-header"><Popover.Title>{propertyTitle}</Popover.Title><Popover.Close aria-label="关闭弹窗" render={<Button variant="ghost" size="icon-sm" className="text-secondary" />}><X aria-hidden="true" /></Popover.Close></div>}
      {fields}
      {footer}
    </Popover.Popup></Popover.Positioner></PopoverPortal></Popover.Root>
    <Dialog open={mobile && (open || propertiesOpen)} onOpenChangeComplete={finishPropertyClose} onOpenChange={(next, details) => { if (!next) { if (propertiesOpen) dismissProperties(details); else { setOpen(false); restore(); bookmark.current = null; } } }}><DialogContent aria-describedby={undefined} className={`rich-properties rich-format-sheet ${uiClassName}${propertyCard}`} showCloseButton={false} style={{ translate: 'none', bottom: `calc(${position.sheetBottom}px + env(safe-area-inset-bottom))`, maxHeight: position.sheetHeight }} initialFocus={properties ? () => titleInput.current ?? propertyInput.current : undefined} finalFocus={() => editor.view.dom}>
      {MobileDialogHeader ? <MobileDialogHeader title={properties ? propertyTitle : '更多格式'} onClose={() => { if (properties) close(); else { setOpen(false); restore(); bookmark.current = null; } }} /> : <div className="rich-format-header"><DialogTitle>{properties ? propertyTitle : '更多格式'}</DialogTitle><Button variant="ghost" size="icon-sm" aria-label="关闭弹窗" onClick={() => { if (properties) close(); else { setOpen(false); restore(); bookmark.current = null; } }}><X aria-hidden="true" /></Button></div>}
      {fields ?? more}
      {footer}
    </DialogContent></Dialog>
  </>;
}
}
