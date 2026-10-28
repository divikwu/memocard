import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { Menu } from '@base-ui/react/menu';
import { alignRichColumn } from './rich-table';
import { editRichStructure } from './rich-blocks';
import type { RichEditorUI } from './rich-editor-core';

function tableContext(editor: Editor) {
  const selection = editor.state.selection;
  const $cell = selection instanceof CellSelection ? selection.$anchorCell : null;
  const $pos = $cell ?? selection.$from;
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name !== 'table') continue;
    const table = $pos.node(depth), start = $pos.start(depth);
    const cellPos = $cell?.pos ?? ($pos.depth > depth + 1 ? $pos.before(depth + 2) : null);
    if (cellPos == null) return null;
    const map = TableMap.get(table), rect = map.findCell(cellPos - start);
    return { table, start, map, cellPos, row: rect.top, column: rect.left };
  }
  return null;
}

export function createRichTableTools(icons: RichEditorUI['icons'], uiClassName: string) {
  const { Table, Plus, ArrowUp, ArrowDown, ChevronRight, Trash2, Check } = icons;
  return function RichTableTools({ editor, blocked, onMenuOpenChange }: { editor: Editor; blocked: boolean; onMenuOpenChange: (open: boolean) => void }) {
    const [open, setOpen] = useState<'row' | 'column' | 'table' | null>(null);
    const activeMenu = useRef<typeof open>(null);
    const closeReasons = useRef<Partial<Record<NonNullable<typeof open>, string>>>({});
    const tools = useRef<HTMLDivElement>(null);
    const outline = useRef<HTMLDivElement>(null);
    const saved = useRef({ doc: editor.state.doc, selection: editor.state.selection });
    const { state, editable, focused } = useEditorState({ editor, selector: ({ editor }) => ({ state: editor.state, editable: editor.isEditable, focused: editor.isFocused }) });
    const context = tableContext(editor);
    const textSelected = state.selection instanceof TextSelection && !state.selection.empty;
    const visible = !!context && editable && !blocked && (!textSelected || open !== null) && (focused || open !== null || !!tools.current?.contains(document.activeElement));

    const cellPos = context?.cellPos;
    useEffect(() => () => onMenuOpenChange(false), [onMenuOpenChange]);
    useEffect(() => {
      if (blocked || !editable || cellPos == null || saved.current.doc !== state.doc) { activeMenu.current = null; setOpen(null); onMenuOpenChange(false); }
    }, [blocked, editable, cellPos, state.doc, onMenuOpenChange]);
    useLayoutEffect(() => {
      if (!visible || cellPos == null || !tools.current) return;
      const element = editor.view.nodeDOM(cellPos);
      if (!(element instanceof HTMLElement)) return;
      const wrapper = element.closest('.tableWrapper'), root = tools.current.closest('.rich-editor');
      if (!wrapper || !(root instanceof HTMLElement)) return;
      const position = () => {
        const bar = tools.current;
        if (!bar) return;
        bar.hidden = false;
        const cell = element.getBoundingClientRect(), bounds = root.getBoundingClientRect(), clip = wrapper.getBoundingClientRect();
        const surface = root.closest('.note-page-scroll')?.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportTop = Math.max(surface?.top ?? 0, viewport?.offsetTop ?? 0);
        const viewportBottom = Math.min(surface?.bottom ?? window.innerHeight, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight));
        const left = Math.max(clip.left, Math.min(cell.left, clip.right - bar.offsetWidth));
        const top = cell.top - bar.offsetHeight - 6;
        bar.style.left = `${Math.max(0, left - bounds.left)}px`;
        const preferredTop = top < viewportTop ? cell.bottom + 6 : top;
        bar.style.top = `${Math.max(viewportTop, Math.min(preferredTop, viewportBottom - bar.offsetHeight)) - bounds.top}px`;
        bar.hidden = cell.bottom < viewportTop || cell.top > viewportBottom || cell.right <= clip.left || cell.left >= clip.right;
        const mark = outline.current;
        if (mark) {
          mark.hidden = bar.hidden;
          mark.style.left = `${Math.max(cell.left, clip.left) - bounds.left}px`;
          mark.style.top = `${cell.top - bounds.top}px`;
          mark.style.width = `${Math.max(0, Math.min(cell.right, clip.right) - Math.max(cell.left, clip.left))}px`;
          mark.style.height = `${cell.height}px`;
        }
      };
      position();
      const observer = new ResizeObserver(position);
      observer.observe(wrapper); observer.observe(element);
      window.addEventListener('resize', position);
      document.addEventListener('scroll', position, true);
      window.visualViewport?.addEventListener('resize', position);
      window.visualViewport?.addEventListener('scroll', position);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true);
        window.visualViewport?.removeEventListener('resize', position); window.visualViewport?.removeEventListener('scroll', position);
      };
    }, [editor, state, visible, cellPos]);

    const changeOpen = (kind: typeof open, next: boolean) => {
      if (next) saved.current = { doc: editor.state.doc, selection: editor.state.selection };
      if (!next && activeMenu.current !== kind) return;
      activeMenu.current = next ? kind : null;
      setOpen(next ? kind : null); onMenuOpenChange(next);
    };
    const run = (command: () => void) => {
      if (!editor.isEditable || editor.isDestroyed || saved.current.doc !== editor.state.doc) return;
      editor.view.dispatch(editor.state.tr.setSelection(saved.current.selection));
      editRichStructure(editor, command);
      if (open) closeReasons.current[open] = 'command';
      activeMenu.current = null; setOpen(null); onMenuOpenChange(false);
      editor.view.focus();
    };
    if (!visible || !context) return null;
    const rowHeader = context.table.firstChild!.content.content.every(cell => cell.type.name === 'tableHeader');
    const columnHeader = Array.from({ length: context.map.height }, (_, row) => context.table.nodeAt(context.map.map[row * context.map.width])?.type.name === 'tableHeader').every(Boolean);
    const canMerge = editor.can().mergeCells(), canSplit = editor.can().splitCell();
    const lastRow = context.row === context.map.height - 1;
    const item = (label: string, command: () => void, Icon = Plus, disabled = false, destructive = false) => <Menu.Item key={label} disabled={disabled} data-variant={destructive ? 'destructive' : undefined} onClick={() => run(command)}><Icon aria-hidden="true" /><span>{label}</span></Menu.Item>;
    const menu = (kind: NonNullable<typeof open>, label: string, children: ReactNode) => <Menu.Root open={open === kind} modal={false} onOpenChange={(next, details) => { if (!next) closeReasons.current[kind] = details.reason; changeOpen(kind, next); }}>
      <Menu.Trigger type="button" aria-keyshortcuts={kind === 'table' ? 'Shift+F10' : undefined} title={kind === 'table' ? '表格选项（Shift+F10）' : undefined} onMouseDown={event => event.preventDefault()} aria-label={kind === 'row' ? `第 ${context.row + 1} 行操作` : kind === 'column' ? `第 ${context.column + 1} 列操作` : '表格选项'}>{kind === 'table' && <Table aria-hidden="true" />}<span>{label}</span><ArrowDown aria-hidden="true" /></Menu.Trigger>
      <Menu.Portal><Menu.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50"><Menu.Popup className={`rich-block-menu rich-table-menu ${uiClassName}`} aria-label={`${label}操作菜单`} finalFocus={() => !editor.isEditable || blocked || activeMenu.current !== null || ['outside-press', 'focus-out'].includes(closeReasons.current[kind] ?? '') ? false : editor.view.dom}>
        <div className="block-menu-label">{kind === 'table' ? '表格设置' : `第 ${kind === 'row' ? context.row + 1 : context.column + 1} ${label}`}</div>
        {children}
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>;
    return <><div ref={outline} className="rich-table-cell-outline" aria-hidden="true" /><div ref={tools} className="rich-table-tools" role="group" aria-label="表格操作" onKeyDown={event => { if (event.key === 'Escape' && !open) { event.preventDefault(); editor.view.focus(); } }}>
      {menu('row', '行', <>
        {item('在上方插入行', () => { editor.commands.addRowBefore(); }, ArrowUp)}
        {item('在下方插入行', () => { editor.commands.addRowAfter(); }, ArrowDown)}
        <Menu.Separator />
        {item('删除当前行', () => { editor.commands.deleteRow(); }, Trash2, false, true)}
      </>)}
      {menu('column', '列', <>
        {item('在左侧插入列', () => { editor.commands.addColumnBefore(); })}
        {item('在右侧插入列', () => { editor.commands.addColumnAfter(); }, ChevronRight)}
        <Menu.Separator />
        <Menu.RadioGroup value={context.table.nodeAt(context.cellPos - context.start)?.attrs.align ?? 'left'} onValueChange={align => run(() => alignRichColumn(editor, align))}>
          {(['left', 'center', 'right'] as const).map((align, index) => <Menu.RadioItem closeOnClick key={align} value={align}><span>{['左对齐', '居中', '右对齐'][index]}</span><Menu.RadioItemIndicator><Check aria-hidden="true" /></Menu.RadioItemIndicator></Menu.RadioItem>)}
        </Menu.RadioGroup>
        <Menu.Separator />
        {item('删除当前列', () => { editor.commands.deleteColumn(); }, Trash2, false, true)}
      </>)}
      {menu('table', '表格', <>
        <Menu.CheckboxItem closeOnClick checked={rowHeader} onClick={() => run(() => { editor.commands.toggleHeaderRow(); })}><span>标题行</span><Menu.CheckboxItemIndicator><Check aria-hidden="true" /></Menu.CheckboxItemIndicator></Menu.CheckboxItem>
        <Menu.CheckboxItem closeOnClick checked={columnHeader} onClick={() => run(() => { editor.commands.toggleHeaderColumn(); })}><span>标题列</span><Menu.CheckboxItemIndicator><Check aria-hidden="true" /></Menu.CheckboxItemIndicator></Menu.CheckboxItem>
        <Menu.Separator />
        {item('合并单元格', () => { editor.commands.mergeCells(); }, Table, !canMerge)}
        {item('拆分单元格', () => { editor.commands.splitCell(); }, Table, !canSplit)}
        <Menu.Separator />
        <Menu.CheckboxItem closeOnClick disabled={!lastRow} checked={!!editor.getAttributes('tableRow').footer} onClick={() => run(() => { editor.commands.updateAttributes('tableRow', { footer: !editor.getAttributes('tableRow').footer }); })}><span>表尾行</span><Menu.CheckboxItemIndicator><Check aria-hidden="true" /></Menu.CheckboxItemIndicator></Menu.CheckboxItem>
        {editor.isActive('tableHeader') && <>
          <Menu.Separator /><div className="block-menu-label">当前表头范围</div>
          {([null, 'col', 'row'] as const).map((scope, index) => <Menu.CheckboxItem closeOnClick key={String(scope)} checked={(editor.getAttributes('tableHeader').scope ?? null) === scope} onClick={() => run(() => { editor.commands.updateAttributes('tableHeader', { scope }); })}><span>{['自动识别', '列标题', '行标题'][index]}</span><Menu.CheckboxItemIndicator><Check aria-hidden="true" /></Menu.CheckboxItemIndicator></Menu.CheckboxItem>)}
        </>}
        <Menu.Separator />
        {item('删除表格', () => { editor.commands.deleteTable(); }, Trash2, false, true)}
      </>)}
    </div></>;
  };
}
