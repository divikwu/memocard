import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ComponentType, type ComponentProps } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { TextSelection, type SelectionBookmark, type Transaction } from '@tiptap/pm/state';
import type { NotePage } from '@memocard/contracts';
import { Popover } from '@base-ui/react/popover';
import { useIsMobile } from './hooks/use-mobile';
import { request } from './bridge';
import { externalUrl, internalTarget } from './urls';
import { editRichStructure } from './rich-blocks';
import { fileTitle } from './note-files';

type Properties = { kind: 'link' | 'abbr'; value: string; wiki: boolean };
const marks = [['bold', '粗体'], ['italic', '斜体'], ['strike', '删除线'], ['code', '行内代码'], ['mark', '高亮'], ['sup', '上标'], ['sub', '下标'], ['kbd', '键盘标记']] as const;
function markState(editor: Editor, name: string): boolean | 'mixed' {
  let marked = false, plain = false;
  const { from, to } = editor.state.selection;
  editor.state.doc.nodesBetween(from, to, node => {
    if (node.isText) { if (node.marks.some(mark => mark.type.name === name || name === 'link' && mark.type.name === 'wikiLink')) marked = true; else plain = true; }
  });
  return marked ? plain ? 'mixed' : true : false;
}
export type RichFormatUI = {
  uiClassName?: string;
  icons: Record<'Link' | 'Highlighter' | 'MoreHorizontal' | 'Superscript' | 'Subscript' | 'Keyboard' | 'Info' | 'Check' | 'Minus' | 'Code' | 'Strikethrough' | 'Unlink' | 'RemoveFormatting' | 'FileText' | 'X', import('./rich-editor-core').RichIcon>;
  Dialog: typeof import('./components/ui/dialog').Dialog;
  DialogContent: ComponentType<ComponentProps<typeof import('./components/ui/dialog').DialogContent>>;
  DialogTitle: ComponentType<ComponentProps<typeof import('./components/ui/dialog').DialogTitle>>;
  Input: ComponentType<ComponentProps<typeof import('./components/ui/input').Input>>;
  Button: ComponentType<Omit<ComponentProps<typeof import('./components/ui/button').Button>, 'render'>>;
  Select: typeof import('./components/ui/select').Select;
  SelectContent: ComponentType<ComponentProps<typeof import('./components/ui/select').SelectContent>>;
  SelectItem: ComponentType<Omit<ComponentProps<typeof import('./components/ui/select').SelectItem>, 'ref'>>;
  SelectTrigger: ComponentType<ComponentProps<typeof import('./components/ui/select').SelectTrigger>>;
  SelectValue: ComponentType<ComponentProps<typeof import('./components/ui/select').SelectValue>>;
};
export function createRichFormatTools({ uiClassName = '', icons, Dialog, DialogContent, DialogTitle, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue }: RichFormatUI) {
const { Link, Highlighter, MoreHorizontal, Superscript, Subscript, Keyboard, Info, Check, Minus, Code, Strikethrough, Unlink, RemoveFormatting, FileText, X } = icons;
return function RichFormatTools({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<Properties | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [matches, setMatches] = useState<NotePage['notes']>([]);
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const errorId = useId(), helpId = useId();
  const [position, setPosition] = useState({ top: 0, left: 0, visible: false, sheetBottom: 12, sheetHeight: window.innerHeight - 24 });
  const toolbar = useRef<HTMLDivElement>(null), linkAnchor = useRef<HTMLButtonElement>(null), moreAnchor = useRef<HTMLButtonElement>(null), propertyInput = useRef<HTMLInputElement>(null);
  const bookmark = useRef<SelectionBookmark | null>(null);
  const mobile = useIsMobile();
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({ from: e.state.selection.from, to: e.state.selection.to, formats: marks.map(([name]) => markState(e, name)), link: markState(e, 'link') }) });
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
  }, [editor, state.from, state.to, mobile]);
  useLayoutEffect(() => { if (properties?.kind) propertyInput.current?.focus({ preventScroll: true }); }, [properties?.kind]);
  useEffect(() => {
    const map = ({ transaction }: { transaction: Transaction }) => { if (bookmark.current && transaction.docChanged) bookmark.current = bookmark.current.map(transaction.mapping); };
    editor.on('transaction', map); return () => { editor.off('transaction', map); };
  }, [editor]);
  useEffect(() => {
    let active = true;
    if (properties?.kind !== 'link' || !properties.wiki) return;
    const timer = setTimeout(() => { void request<NotePage>('queryNotes', { query: search, tags: [], limit: 12 }).then(page => { if (active) { setMatches(page.notes); setSearchError(''); setSearching(false); } }).catch(() => { if (active) { setSearchError('无法读取笔记，请直接输入目标路径。'); setSearching(false); } }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [properties?.kind, properties?.wiki, search]);
  function restore() {
    if (bookmark.current) editor.view.dispatch(editor.state.tr.setSelection(bookmark.current.resolve(editor.state.doc)));
    editor.view.focus();
  }
  function show(kind: Properties['kind']) {
    bookmark.current = editor.state.selection.getBookmark();
    const wiki = editor.isActive('wikiLink');
    const value = kind === 'link' ? String(editor.getAttributes(wiki ? 'wikiLink' : 'link')[wiki ? 'target' : 'href'] ?? '') : String(editor.getAttributes('abbr').title ?? '');
    setSearch(''); setSearchError(''); setError(''); setMatches([]); setSearching(kind === 'link' && wiki); setProperties({ kind, value, wiki }); setPropertiesOpen(true); setOpen(false);
  }
  function close() { restore(); setPropertiesOpen(false); bookmark.current = null; }
  function finishPropertyClose(next: boolean) { if (!next && !propertiesOpen) { setProperties(null); setError(''); } }
  function toggle(name: string) {
    restore();
    editRichStructure(editor, () => { const chain = editor.chain(); (markState(editor, name) === true ? chain.unsetMark(name) : chain.setMark(name)).run(); });
    setOpen(false); bookmark.current = null;
  }
  function removeLink() {
    restore(); editRichStructure(editor, () => { editor.chain().unsetMark('link').unsetMark('wikiLink').run(); });
    setOpen(false); if (properties) close(); else bookmark.current = null;
  }
  function apply() {
    if (!properties || !editor.isEditable) return;
    const p = { ...properties, value: properties.value.trim() };
    if (!p.value) { setError(p.kind === 'link' ? '请输入链接地址。' : '请输入缩写的完整含义。'); propertyInput.current?.focus(); return; }
    if (p.kind === 'link' && (p.wiki ? !internalTarget(p.value) || /[[\]|\r\n]/.test(p.value) : !(externalUrl(p.value) || internalTarget(p.value)))) { setError(p.wiki ? '请输入有效的笔记路径。' : '请输入有效的网页地址或相对路径。'); propertyInput.current?.focus(); return; }
    restore();
    editRichStructure(editor, () => {
      const chain = editor.chain();
      if (p.kind === 'link') chain.unsetMark('link').unsetMark('wikiLink').setMark(p.wiki ? 'wikiLink' : 'link', p.wiki ? { target: p.value } : { href: p.value }).run();
      else chain.setMark('abbr', { title: p.value }).run();
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
    const Icon = ({ strike: Strikethrough, code: Code, sup: Superscript, sub: Subscript, kbd: Keyboard })[name as 'strike' | 'code' | 'sup' | 'sub' | 'kbd'];
    const item = typeof child === 'string';
    return <button key={name} className={item ? 'rich-format-item' : undefined} aria-label={label} aria-pressed={active} title={`${label}${active === 'mixed' ? '（混合格式）' : ''}`} onMouseDown={event => event.preventDefault()} onClick={() => toggle(name)}>{item && Icon && <Icon aria-hidden="true" />}{item ? <span>{child}</span> : child}{item && <span className="rich-format-check" aria-hidden="true">{active === true ? <Check /> : active === 'mixed' ? <Minus /> : null}</span>}</button>;
  };
  const more = <div aria-label="扩展文字格式" onKeyDown={menuKeys}>
    <div className="rich-format-group">{mobile && <>{formatButton(2, '删除线')}{formatButton(3, '行内代码')}</>}{marks.slice(5).map(([, label], index) => formatButton(index + 5, label))}<button className="rich-format-item" onClick={() => show('abbr')}><Info aria-hidden="true" /><span>缩写说明</span><span className="rich-format-check" aria-hidden="true">{markState(editor, 'abbr') && <Check />}</span></button></div>
    <div className="rich-format-group"><button className="rich-format-item" onClick={() => show('link')}><Link aria-hidden="true" /><span>编辑链接</span></button><button className="rich-format-item" disabled={!state.link} onClick={removeLink}><Unlink aria-hidden="true" /><span>移除链接</span></button></div>
    <div className="rich-format-group"><button className="rich-format-item" onClick={() => { restore(); editRichStructure(editor, () => { let chain = editor.chain(); for (const [name] of marks) chain = chain.unsetMark(name); chain.unsetMark('abbr').run(); }); setOpen(false); bookmark.current = null; }}><RemoveFormatting aria-hidden="true" /><span>清除文字样式</span></button></div>
  </div>;
  const propertyTitle = properties?.kind === 'abbr' ? '缩写说明' : '编辑链接';
  const selectedText = editor.state.doc.textBetween(state.from, state.to, ' ').slice(0, 160);
  const fields = properties && <div className="rich-format-form">
    <p className="rich-format-preview" title={selectedText}>{selectedText}</p>
    {properties.kind === 'link' && <>
      <div className="rich-format-field"><span>链接类型</span><Select value={properties.wiki ? 'wiki' : 'link'} onValueChange={value => { if (!value) return; setProperties({ ...properties, wiki: value === 'wiki' }); setError(''); setMatches([]); setSearching(value === 'wiki'); setSearchError(''); }}><SelectTrigger className="rich-format-select" aria-label="链接类型"><SelectValue>{properties.wiki ? 'Wiki 笔记链接' : '网页或文件链接'}</SelectValue></SelectTrigger><SelectContent align="start" className="rich-type-options"><SelectItem value="link">网页或文件链接</SelectItem><SelectItem value="wiki">Wiki 笔记链接</SelectItem></SelectContent></Select></div>
      {properties.wiki && <div className="rich-format-field"><label htmlFor={`${helpId}-search`}>查找笔记</label><Input id={`${helpId}-search`} aria-label="搜索目标笔记" placeholder="搜索笔记标题或路径" value={search} onChange={event => { setSearch(event.target.value); setMatches([]); setSearchError(''); setSearching(true); }} onKeyDown={event => { if (event.key === 'ArrowDown') { const first = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[role=option]'); if (first) { event.preventDefault(); first.focus(); } } }} />
        <div className="rich-link-results" role="listbox" aria-label="匹配笔记" aria-busy={searching} onKeyDown={event => { if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return; const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]')); if (!options.length) return; event.preventDefault(); const index = options.indexOf(document.activeElement as HTMLButtonElement); options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length].focus(); }}>
          {matches.map(note => <button key={note.id} role="option" aria-selected={properties.value === note.relativePath} onClick={() => { setProperties({ ...properties, value: note.relativePath }); setError(''); propertyInput.current?.focus(); }}><FileText aria-hidden="true" /><span><span>{note.title?.trim() || fileTitle(note.relativePath)}</span><small>{note.relativePath}</small></span></button>)}
        </div>
        <p className="rich-format-hint" role="status">{searching ? '正在查找笔记…' : searchError || (!matches.length ? '没有匹配的笔记，可直接输入路径。' : '')}</p>
      </div>}
    </>}
    <div className="rich-format-field"><label htmlFor={`${helpId}-value`}>{properties.kind === 'link' ? '链接地址' : '完整含义'}</label><Input id={`${helpId}-value`} ref={propertyInput} aria-label={properties.kind === 'link' ? '链接地址' : '缩写说明'} aria-invalid={!!error} aria-describedby={error ? errorId : helpId} placeholder={properties.kind === 'link' ? properties.wiki ? '例如：notes/项目计划.md' : 'https://example.com' : '填写缩写的完整含义'} value={properties.value} onChange={event => { setProperties({ ...properties, value: event.target.value }); setError(''); }} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); apply(); } }} />
      {error ? <p id={errorId} className="rich-format-error" role="alert">{error}</p> : <p id={helpId} className="rich-format-hint">{properties.kind === 'abbr' ? '悬停在缩写上时显示这段说明。' : properties.wiki ? '选择笔记或输入相对路径。' : '支持网页地址、邮箱链接和相对文件路径。'}</p>}
    </div>
    <div className="rich-property-actions">{properties.kind === 'link' && state.link && <Button variant="ghost" className="rich-property-remove" onClick={removeLink}>移除链接</Button>}{properties.kind === 'abbr' && markState(editor, 'abbr') && <Button variant="ghost" className="rich-property-remove" onClick={() => { restore(); editRichStructure(editor, () => { editor.commands.unsetMark('abbr'); }); close(); }}>移除说明</Button>}<Button variant="ghost" onClick={close}>取消</Button><Button onClick={apply}>保存</Button></div>
  </div>;
  return <>
    <div ref={toolbar} className={`rich-inline-tools ${uiClassName}`} style={{ top: position.top, left: position.left, visibility: position.visible ? 'visible' : 'hidden' }} role="toolbar" aria-label="文字格式" onKeyDown={event => { if (event.key === 'Escape' && !open && !properties) { event.preventDefault(); setPosition(current => ({ ...current, visible: false })); editor.view.focus(); }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); if (index >= 0) { event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length].focus(); } } }}>
      {formatButton(0, <strong>B</strong>)}{formatButton(1, <em>I</em>)}{!mobile && <>{formatButton(2, <s>S</s>)}{formatButton(3, <span>&lt;/&gt;</span>)}</>}
      <button ref={linkAnchor} aria-label="链接" title="编辑链接" aria-pressed={state.link} onMouseDown={event => event.preventDefault()} onClick={() => show('link')}><Link aria-hidden="true" /></button>
      {formatButton(4, <Highlighter aria-hidden="true" />)}
      <Popover.Root open={!mobile && open} onOpenChange={next => { setOpen(next); if (next) { setProperties(null); setPropertiesOpen(false); bookmark.current = editor.state.selection.getBookmark(); } else if (!properties) { restore(); bookmark.current = null; } }}><Popover.Trigger ref={moreAnchor} aria-label="更多格式" title="更多格式" onClick={mobile ? () => { setProperties(null); setPropertiesOpen(false); bookmark.current = editor.state.selection.getBookmark(); setOpen(true); } : undefined}><MoreHorizontal aria-hidden="true" /></Popover.Trigger>
        <Popover.Portal><Popover.Positioner align="end" sideOffset={8} collisionPadding={12} collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }} className="z-50"><Popover.Popup className={`rich-menu rich-format-menu ${uiClassName}`} aria-label="更多格式" finalFocus={properties ? false : () => editor.view.dom}>{more}</Popover.Popup></Popover.Positioner></Popover.Portal>
      </Popover.Root>
    </div>
    <Popover.Root open={!mobile && propertiesOpen} onOpenChange={next => { if (!next && propertiesOpen) close(); }} onOpenChangeComplete={finishPropertyClose}><Popover.Portal><Popover.Positioner anchor={properties?.kind === 'abbr' ? moreAnchor : linkAnchor} sideOffset={8} collisionPadding={12} collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }} className="z-50"><Popover.Popup className={`rich-properties rich-link-popup ${uiClassName}`} aria-label={propertyTitle} initialFocus={() => propertyInput.current} finalFocus={() => editor.view.dom}>
      <div className="rich-format-header"><Popover.Title>{propertyTitle}</Popover.Title><Popover.Close aria-label="关闭弹窗" render={<Button variant="ghost" size="icon-sm" />}><X aria-hidden="true" /></Popover.Close></div>{fields}
    </Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>
    <Dialog open={mobile && (open || propertiesOpen)} onOpenChangeComplete={finishPropertyClose} onOpenChange={next => { if (!next) { if (propertiesOpen) close(); else { setOpen(false); restore(); bookmark.current = null; } } }}><DialogContent aria-describedby={undefined} className={`rich-properties rich-format-sheet ${uiClassName}`} showCloseButton={false} style={{ translate: 'none', bottom: `calc(${position.sheetBottom}px + env(safe-area-inset-bottom))`, maxHeight: position.sheetHeight }} initialFocus={properties ? () => propertyInput.current : undefined} finalFocus={() => editor.view.dom}>
      <div className="rich-format-header"><DialogTitle>{properties ? propertyTitle : '更多格式'}</DialogTitle><Button variant="ghost" size="icon-sm" aria-label="关闭弹窗" onClick={() => { if (properties) close(); else { setOpen(false); restore(); bookmark.current = null; } }}><X aria-hidden="true" /></Button></div>{properties ? fields : more}
    </DialogContent></Dialog>
  </>;
}
}
