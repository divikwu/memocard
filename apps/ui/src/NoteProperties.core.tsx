import type { ComponentType, ComponentProps, SVGProps } from "react";
import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type DragEvent } from 'react';
import type { Note, NoteProperties as Properties, NoteProperty, PropertyChange, PropertyType, PropertyLabels, PropertyVisibility } from '@memocard/contracts';
import type { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { request, errorMessage } from './bridge';
import { tagKey } from './inline-tags';
import { propertyTypeChange, listAsMultiSelect } from './property-type-change';
import { defaultPropertyLabel } from './property-labels';
import { formatPropertyDate } from './property-dates';
import { validPropertyNumber } from './property-numbers';
import { usePropertyLayout } from './use-property-layout';
import { orderProperties, isPropertyVisible, propertyVisibility } from './property-layout';

type View = {
  ConfirmationPopup?: ComponentType<ComponentProps<typeof AlertDialog.Popup>>;
  Checkbox: { Root: ComponentType<CheckboxPrimitive.Root.Props>; Indicator: ComponentType<CheckboxPrimitive.Indicator.Props> };
  CalendarDays: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  LoaderCircle: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Check: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  ChevronDown: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  ChevronUp: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Clock: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  FileText: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Plus: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Text: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  SquareCheck: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Pencil: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Trash2: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Copy: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  CircleChevronDown: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  ListChecks: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  SlidersHorizontal: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Image: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  GripVertical: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Hash: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Button: ComponentType<Omit<ComponentProps<typeof import("@ui/components/button")["Button"]>, "render">>;
  PageNotice: ComponentType<ComponentProps<typeof import("@ui/business/PageNotice")["PageNotice"]>>;
  Input: ComponentType<ComponentProps<typeof import("@ui/components/input")["Input"]>>;
  Skeleton: ComponentType<ComponentProps<typeof import("@ui/components/skeleton")["Skeleton"]>>;
  NameEditor: ComponentType<ComponentProps<typeof import("@ui/business/property-editors")["NameEditor"]>>;
  Textarea: ComponentType<ComponentProps<typeof import("@ui/components/textarea")["Textarea"]>>;
  TagPill: ComponentType<Omit<ComponentProps<typeof import("@ui/business/property-editors")["TagPill"]>, "variant" | "render">>;
  Collapsible: ComponentType<ComponentProps<typeof import("@base-ui/react/collapsible")["Collapsible"]["Root"]>>;
  CollapsibleContent: ComponentType<ComponentProps<typeof import("@base-ui/react/collapsible")["Collapsible"]["Panel"]>>;
  CollapsibleTrigger: ComponentType<ComponentProps<typeof import("@base-ui/react/collapsible")["Collapsible"]["Trigger"]>>;
  Popover: ComponentType<ComponentProps<typeof import("@ui/components/popover")["Popover"]>>;
  PopoverTrigger: ComponentType<ComponentProps<typeof import("@ui/components/popover")["PopoverTrigger"]>>;
  PopoverContent: ComponentType<ComponentProps<typeof import("@ui/components/popover")["PopoverContent"]>>;
  DropdownMenu: ComponentType<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenu"]>>;
  DropdownMenuTrigger: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuTrigger"]>, "ref">>;
  DropdownMenuContent: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuContent"]>, "ref">>;
  DropdownMenuItem: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuItem"]>, "ref">>;
  DropdownMenuSeparator: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuSeparator"]>, "ref">>;
  DropdownMenuSub: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuSub"]>, "ref">>;
  DropdownMenuSubTrigger: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuSubTrigger"]>, "ref">>;
  DropdownMenuSubContent: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuSubContent"]>, "ref">>;
  DropdownMenuRadioGroup: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuRadioGroup"]>, "ref">>;
  DropdownMenuRadioItem: ComponentType<Omit<ComponentProps<typeof import("@ui/components/dropdown-menu")["DropdownMenuRadioItem"]>, "ref">>;
  Tooltip: ComponentType<ComponentProps<typeof import("@ui/components/tooltip")["Tooltip"]>>;
  TooltipContent: ComponentType<ComponentProps<typeof import("@ui/components/tooltip")["TooltipContent"]>>;
  TooltipProvider: ComponentType<ComponentProps<typeof import("@ui/components/tooltip")["TooltipProvider"]>>;
  TooltipTrigger: ComponentType<ComponentProps<typeof import("@ui/components/tooltip")["TooltipTrigger"]>>;
  ChoicePropertyEditor: ComponentType<ComponentProps<typeof import("@ui/business/property-editors")["ChoicePropertyEditor"]>>;
  ChoicePill: ComponentType<ComponentProps<typeof import("@ui/business/property-editors")["ChoicePill"]>>;
  DatePropertyPicker: ComponentType<ComponentProps<typeof import("@ui/business/property-editors")["DatePropertyPicker"]>>;
  ImagePropertyEditor: ComponentType<ComponentProps<typeof import("@ui/business/property-editors")["ImagePropertyEditor"]>>;
  TagPropertyEditor: ComponentType<ComponentProps<typeof import("@ui/business/property-editors")["TagPropertyEditor"]>>;
};

export function createNoteProperties(view: View) {
  const ConfirmationPopup = view.ConfirmationPopup ?? AlertDialog.Popup;
  const { Checkbox, CalendarDays, LoaderCircle, Check, ChevronDown, ChevronUp, Clock, FileText, Plus, Text, SquareCheck, Pencil, Trash2, Copy, CircleChevronDown, ListChecks, SlidersHorizontal, Image, Hash, GripVertical, Button, PageNotice, Input, Skeleton, NameEditor, Textarea, TagPill, Collapsible, CollapsibleContent, CollapsibleTrigger, Popover, PopoverTrigger, PopoverContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor } = view;
const noteTime = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('en-US', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).replace(',', '') : null;
};
const display = (value: NoteProperty['value']) => Array.isArray(value) ? value.join('、') : typeof value === 'boolean' ? value ? '已勾选' : '未勾选' : value || '空';
const editableTypes = ['text','number','select','multiSelect','date','checkbox','image'] as const;
const systemNames = {'system:tags':Hash,'system:updatedAt':Clock,'system:createdAt':CalendarDays,'system:filename':FileText};
const propertyTypes = {text:{label:'文本',Icon:Text},number:{label:'数字',Icon:Hash},select:{label:'选择',Icon:CircleChevronDown},multiSelect:{label:'多选',Icon:ListChecks},date:{label:'日期',Icon:CalendarDays},checkbox:{label:'复选框',Icon:SquareCheck},image:{label:'图片',Icon:Image},unsupported:{label:'只读',Icon:Text}};
function PropertyCreator({busy, error, onSave}: {busy:boolean; error?:string; onSave:(change:PropertyChange)=>Promise<void>}) {
  const [name, setName] = useState('');
  const submitting = useRef(false);
  function create(type:PropertyType) {
    if (busy || submitting.current || !name.trim()) return;
    submitting.current = true;
    const value = type === 'checkbox' ? false : type === 'multiSelect' ? [] : '';
    void onSave({name:name.trim(),type,value,create:true,...(type === 'select' || type === 'multiSelect' ? {options:[]} : {})}).catch(() => undefined).finally(() => { submitting.current = false; });
  }
  return <form className="note-property-create" onSubmit={event => event.preventDefault()}>
    <Input autoFocus aria-label="属性名" placeholder="属性名称" value={name} onChange={event => setName(event.target.value)} disabled={busy} />
    <div className="note-property-type-list" role="group" aria-label="属性类型"><span className="note-property-type-label">类型</span>{editableTypes.map(type => { const {Icon,label}=propertyTypes[type]; return <Button key={type} type="button" variant="ghost" size="sm" disabled={busy || !name.trim()} className="note-property-type-option" onClick={() => create(type)}><Icon />{label}</Button>; })}</div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
  </form>;
}
function PropertyForm({ property, busy, onSave, onCancel, onCloseIntent, formRef, error, inPlace = false }: { inPlace?:boolean; formRef?:RefObject<HTMLFormElement | null>; error?:string; property:NoteProperty; busy:boolean; onSave:(change:PropertyChange)=>Promise<void>; onCancel:()=>void; onCloseIntent?:(keyboard:boolean)=>void }) {
  const name = property.name;
  const type = property.type === 'unsupported' ? 'text' : property.type;
  const [text, setText] = useState(Array.isArray(property.value) ? property.value.join('\n') : typeof property.value === 'string' ? property.value : '');
  const [invalidNumber, setInvalidNumber] = useState(false);
  const numberErrorId = useId();
  const submitting = useRef(false);
  const cancelled = useRef(false);
  const pointerDown = useRef(false);
  const pointerSubmit = useRef<(() => void) | null>(null);
  const textField = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!inPlace) return;
    let fallback:ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(fallback);
      pointerDown.current = false;
      const submit = pointerSubmit.current;
      pointerSubmit.current = null;
      submit?.();
    };
    const down = () => { pointerDown.current = true; };
    const up = () => { pointerDown.current = false; fallback = setTimeout(finish,0); };
    document.addEventListener('pointerdown',down,true);
    document.addEventListener('pointerup',up,true);
    document.addEventListener('click',finish,true);
    document.addEventListener('pointercancel',finish,true);
    window.addEventListener('blur',finish);
    return () => {
      clearTimeout(fallback); pointerSubmit.current = null;
      document.removeEventListener('pointerdown',down,true);
      document.removeEventListener('pointerup',up,true);
      document.removeEventListener('click',finish,true);
      document.removeEventListener('pointercancel',finish,true);
      window.removeEventListener('blur',finish);
    };
  }, [inPlace]);
  const resize = useCallback(() => {
    const field = textField.current;
    if (!inPlace || !field) return;
    field.style.height = '0px';
    field.style.height = `${Math.max(32, field.scrollHeight)}px`;
  }, [inPlace]);
  useLayoutEffect(resize, [text, resize]);
  useLayoutEffect(() => {
    const field = textField.current;
    if (!inPlace || !field) return;
    let width = field.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return;
      width = field.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(resize);
    });
    observer.observe(field);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [inPlace, resize]);
  function save(value:PropertyChange['value'], keyboard = false) {
    if (busy || submitting.current) return;
    if (type === 'number' && typeof value === 'string' && value !== '' && !validPropertyNumber(value)) { setInvalidNumber(true); return; }
    onCloseIntent?.(keyboard);
    if (JSON.stringify(value) === JSON.stringify(property.value)) { onCancel(); return; }
    submitting.current = true;
    void onSave({name,type,value}).catch(() => undefined).finally(() => { submitting.current = false; });
  }
  return <form ref={formRef} className={inPlace ? 'note-property-inline' : 'space-y-2'} onBlur={event => {
    if (inPlace && !cancelled.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      const form = event.currentTarget;
      // Keep rows in place until the pointer's click target has been determined.
      if (pointerDown.current) pointerSubmit.current = () => form.requestSubmit();
      else form.requestSubmit();
    }
  }} onKeyDown={event => {
    if (inPlace && event.key === 'Escape' && !event.nativeEvent.isComposing && !busy) { event.preventDefault(); event.stopPropagation(); cancelled.current = true; onCloseIntent?.(true); onCancel(); }
  }} onSubmit={event => {
    event.preventDefault();
    save(text);
  }}>
    {type === 'date' ? <Suspense fallback={<span role="status">正在读取日期…</span>}><DatePropertyPicker autoFocus value={text} onChange={setText} onSelect={value => { setText(value); save(value); }} busy={busy} /></Suspense> : <Textarea ref={textField} autoFocus aria-label="属性值" inputMode={type === 'number' ? 'decimal' : undefined} aria-invalid={invalidNumber || undefined} aria-describedby={invalidNumber ? numberErrorId : undefined} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && (type === 'text' || type === 'number' || event.ctrlKey || event.metaKey)) { event.preventDefault(); if (inPlace) save(text,true); else event.currentTarget.form?.requestSubmit(); } }} placeholder={type === 'number' ? '输入数字' : '输入属性值'} value={text} onChange={event => { setText(event.target.value); setInvalidNumber(false); }} disabled={busy} className={type === 'number' ? 'min-h-16 tabular-nums' : 'min-h-16'} />}
    {invalidNumber && <p id={numberErrorId} role="alert" className="text-sm text-error">请输入有效数字。</p>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    {!inPlace && type !== 'date' && <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy}>保存属性</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>取消</Button></div>}
  </form>;
}
function applyPendingChange(current:Properties | undefined, change:PropertyChange):Properties | undefined {
  if (!current) return current;
  if (change.name === 'tags') return {...current,tagProperty:{...current.tagProperty!,value:change.value ?? []}};
  const existing = current.properties.find(property => property.name === change.name);
  const updated:NoteProperty = {...existing,name:change.renameTo ?? change.name,type:change.type ?? existing?.type ?? 'text',value:change.value ?? existing?.value ?? '',editable:true,...(change.options ? {options:change.options} : {})};
  return {...current,properties:change.remove ? current.properties.filter(property => property.name !== change.name) : existing ? current.properties.map(property => property.name === change.name ? updated : property) : [...current.properties,updated]};
}

function NoteProperties({ note, scopeKey = note?.id ?? 'new', savedProperties, saveError, renderHeader, pendingChanges = [], tags: bodyValues, inheritedTags = [], relativePath, vaultBinding, canEdit, canRead = canEdit, busy, onApply, onApplyValue, onLocateTag, onChangeTag }: { note?:Note; scopeKey?:string; savedProperties?:Properties; saveError?:string; renderHeader?:(notice:ReactNode, ownsSaveError:boolean)=>ReactNode; pendingChanges?:PropertyChange[]; tags:string[]; inheritedTags?:string[]; relativePath?:string; vaultBinding?:string; canEdit:boolean; canRead?:boolean; busy:boolean; onApply:(change:PropertyChange)=>Promise<void>; onApplyValue?:(change:PropertyChange, previous:PropertyChange)=>Promise<void>; onLocateTag?:(tag:string)=>void; onChangeTag?:(from:string,to:string | null)=>Promise<void> }) {
  const tags = [...new Set(bodyValues.map(tagKey))];
  const inheritedKey = JSON.stringify(inheritedTags);
  const tooltipId = useId();
  const propertyListId = useId();
  const propertyActionId = useId();
  const [open, setOpen] = useState(false);
  const [sourceData, setData] = useState<Properties>();
  const displayedSource = savedProperties?.contentHash === note?.contentHash && savedProperties ? {...savedProperties,properties:savedProperties.properties.map(listAsMultiSelect)} : sourceData;
  const data = pendingChanges.reduce(applyPendingChange, displayedSource);
  const [loading, setLoading] = useState(canRead);
  const hasPropertyData = useRef(false);
  const [error, setError] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const [readRevision, setReadRevision] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [imageInteractions, setImageInteractions] = useState<ReadonlySet<string>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const propertyTrigger = useRef<HTMLButtonElement>(null);
  const locatingTag = useRef(false);
  const [renaming, setRenaming] = useState<{key:string; name:string; anchor:HTMLElement} | null>(null);
  const [labelData, setLabelData] = useState<PropertyLabels>();
  const label = (key:string) => labelData?.labels[key] ?? defaultPropertyLabel(key);
  const [removing, setRemoving] = useState<NoteProperty | null>(null);
  const [typeChange, setTypeChange] = useState<{property:NoteProperty;type:PropertyType} | null>(null);
  const [changingType, setChangingType] = useState(false);
  const presentation = usePropertyLayout(scopeKey, canRead, vaultBinding);
  const [layoutAnnouncement, setLayoutAnnouncement] = useState('');
  const panelTrigger = useRef<HTMLButtonElement>(null);
  const inlineCell = useRef<HTMLElement | null>(null);
  const keyboardFocus = useRef<string | null>(null);
  const blurClosing = useRef<string | null>(null);
  const focusAfterLayout = useRef<string | null>(null);
  const dragging = useRef<string | null>(null);
  const dropTarget = useRef<HTMLElement | null>(null);
  const updated = noteTime(note?.updatedAt);
  const propertyTags = Array.isArray(data?.tagProperty?.value) ? [...new Set(data.tagProperty.value.map(tagKey))] : [];
  const mergedTags = [...new Set([...propertyTags, ...tags, ...(!data && !note?.contentHash ? inheritedTags : [])])];
  const rowValues = new Map<string, unknown>([
    ['system:tags',mergedTags.length || data?.tagProperty?.type !== 'unsupported' ? mergedTags : data.tagProperty.value],['system:updatedAt',note?.updatedAt],['system:createdAt',note?.createdAt],['system:filename',note ? relativePath ?? note.relativePath : undefined],
    ...(data?.properties.map(property => [`property:${property.name}`,property.value] as [string,unknown]) ?? []),
  ]);
  const orderedKeys = orderProperties([...rowValues.keys()],presentation.layout.order,key => key);
  const hiddenKeys = new Set(orderedKeys.filter(key => !isPropertyVisible(presentation.layout,key,rowValues.get(key))));
  const editingKey = editing === null ? null : editing === 'tags' ? 'system:tags' : `property:${editing}`;
  const shownKeys = orderedKeys.filter(key => open || key === editingKey || imageInteractions.has(key) || !hiddenKeys.has(key));
  const canArrange = canEdit && presentation.writable && !presentation.saving && !busy && !loading;
  useEffect(() => { setOpen(false); setEditing(null); setAdding(false); setRemoving(null); setRenaming(null); setTypeChange(null); setImageInteractions(new Set()); setLayoutAnnouncement(''); keyboardFocus.current = null; blurClosing.current = null; inlineCell.current = null; }, [scopeKey,vaultBinding]);
  useLayoutEffect(() => {
    const name = keyboardFocus.current;
    if (!name || editing === name || busy || loading) return;
    keyboardFocus.current = null;
    if (document.activeElement !== document.body && document.activeElement?.isConnected) return;
    const target = hiddenKeys.has(`property:${name}`) && !open ? panelTrigger.current : inlineCell.current?.querySelector<HTMLButtonElement>('.note-property-edit');
    target?.focus({preventScroll:true});
  });
  useEffect(() => {
    const key = focusAfterLayout.current;
    if (!key || presentation.saving || key === editingKey || imageInteractions.has(key)) return;
    if (hiddenKeys.has(key) && !open && (document.activeElement === document.body || !document.activeElement?.isConnected)) panelTrigger.current?.focus({preventScroll:true});
    focusAfterLayout.current = null;
  });
  const hiddenInteraction = open ? undefined : orderedKeys.find(key => hiddenKeys.has(key) && (key === editingKey || imageInteractions.has(key)));
  useEffect(() => {
    if (hiddenInteraction && (hiddenInteraction !== editingKey || editing !== blurClosing.current)) focusAfterLayout.current = hiddenInteraction;
  }, [hiddenInteraction,editing,editingKey]);
  useEffect(() => { if (!editing) blurClosing.current = null; }, [editing]);

  useEffect(() => {
    if (!canRead) return;
    setReadFailed(false);
    if (note?.contentHash && savedProperties?.contentHash === note.contentHash) {
      hasPropertyData.current = true;
      setData({...savedProperties,properties:savedProperties.properties.map(listAsMultiSelect)});
      setLoading(false); setError('');
      return;
    }
    let active = true;
    setLoading(!hasPropertyData.current); setError('');
    if (!note?.contentHash) { hasPropertyData.current = false; setData(undefined); }
    let retry:ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const value = await request<Properties>('getNoteProperties', {...(note?.contentHash ? {id:note.id} : {}),deferWhileIndexing:true});
        if (!active) return;
        hasPropertyData.current = true;
        setData({...value,properties:value.properties.map(listAsMultiSelect),...(!note?.contentHash ? {tagProperty:{name:'tags',type:'list',value:JSON.parse(inheritedKey) as string[],editable:true}} : {})});
      } catch (cause) {
        if (!active) return;
        if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'INDEXING') {
          retry = setTimeout(() => { void load(); }, 1000);
          return;
        }
        setReadFailed(true); setError(errorMessage(cause));
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; clearTimeout(retry); };
  }, [note?.id, note?.contentHash, canRead, savedProperties, readRevision, inheritedKey]);
  useEffect(() => {
    if (!canRead) return;
    let active = true;
    setLabelData(undefined);
    void request<PropertyLabels>('getPropertyLabels').then(value => { if (active) setLabelData(value); }).catch(cause => { if (active) { setReadFailed(true); setError(errorMessage(cause)); } });
    return () => { active = false; };
  }, [note?.id, canRead, readRevision]);
  function renameLabel(key:string) { if (!propertyTrigger.current) return; setRenaming({key,name:label(key),anchor:propertyTrigger.current}); setEditing(null); setAdding(false); setError(''); }
  async function saveLabel(name:string) {
    if (!renaming || !labelData || name === renaming.name) return;
    setError('');
    try {
      const saved = await request<PropertyLabels>('renamePropertyLabel',{key:renaming.key,label:name,baseHash:labelData.contentHash});
      setLabelData(saved); setRenaming(null);
    } catch (cause) {
      setError(errorMessage(cause));
      try { setLabelData(await request<PropertyLabels>('getPropertyLabels')); } catch { /* Keep the last known configuration and the input. */ }
      throw cause;
    }
  }
  function saveVisibility(key:string, mode:PropertyVisibility) {
    focusAfterLayout.current = key;
    void presentation.update(current => ({...current,visibility:{...current.visibility,[key]:mode}})).then(() => {
      setLayoutAnnouncement(`${label(key)}已${mode === 'always' ? '设为始终显示' : mode === 'hidden' ? '隐藏' : '设为空时隐藏'}`);
    }).catch(() => { focusAfterLayout.current = null; });
  }
  function moveProperty(key:string, target:string, after = false) {
    if (!canArrange || key === target) return;
    void presentation.update(current => {
      const order = [...new Set([...current.order,...orderedKeys])].filter(value => value !== key);
      order.splice(order.indexOf(target) + (after ? 1 : 0),0,key);
      return {...current,order};
    }).then(() => setLayoutAnnouncement(`${label(key)}已移动到${label(target)}${after ? '之后' : '之前'}`)).catch(() => undefined);
  }
  function moveBy(key:string, direction:number) {
    const target = shownKeys[shownKeys.indexOf(key)+direction];
    if (target) moveProperty(key,target,direction > 0);
  }
  function clearDrop() { dropTarget.current?.removeAttribute('data-drop-position'); dropTarget.current = null; }
  function dragOver(event:DragEvent<HTMLDivElement>) {
    if (!dragging.current || !canArrange) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'move';
    const row = event.currentTarget;
    const bounds = row.getBoundingClientRect();
    const after = event.clientY > bounds.top + bounds.height/2;
    if (dropTarget.current !== row) clearDrop();
    row.dataset.dropPosition = after ? 'after' : 'before'; dropTarget.current = row;
  }
  function grip(key:string) {
    return canEdit && presentation.writable ? <button type="button" className="note-property-grip text-secondary" draggable={canArrange} disabled={busy || loading} aria-disabled={!canArrange || undefined} aria-label={`拖动属性 ${label(key)}`} title="拖动排序；也可使用上、下方向键" onKeyDown={event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault(); event.stopPropagation(); moveBy(key,event.key === 'ArrowUp' ? -1 : 1);
    }} onClick={event => {
      if (!canArrange) return;
      const trigger = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.note-property-name');
      trigger?.focus(); trigger?.click();
    }} onDragStart={event => {
      event.stopPropagation(); dragging.current = key; event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-memocard-property',key);
      const row = event.currentTarget.closest<HTMLElement>('.note-property-row');
      if (row) event.dataTransfer.setDragImage(row,8,16);
    }} onDragEnd={event => { event.stopPropagation(); dragging.current = null; clearDrop(); }}><GripVertical aria-hidden="true" /></button> : null;
  }
  function arrangementMenu(key:string) {
    if (!presentation.writable) return null;
    const index = shownKeys.indexOf(key);
    return <><DropdownMenuSeparator /><DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={presentation.saving}><SlidersHorizontal />属性可见性</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="note-property-menu" aria-label={`${label(key)}的属性可见性`}>
        <DropdownMenuRadioGroup value={propertyVisibility(presentation.layout,key)} onValueChange={mode => saveVisibility(key,mode as PropertyVisibility)}>
          <DropdownMenuRadioItem value="always" closeOnClick>始终显示</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="hide-empty" closeOnClick>为空时隐藏</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="hidden" closeOnClick>始终隐藏</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub><DropdownMenuItem disabled={!canArrange || index <= 0} onClick={() => moveBy(key,-1)}><ChevronUp />上移</DropdownMenuItem><DropdownMenuItem disabled={!canArrange || index === shownKeys.length-1} onClick={() => moveBy(key,1)}><ChevronDown />下移</DropdownMenuItem></>;
  }
  function nameCell(key:string, Icon:View['Hash'], controls?:ReactNode, property?:NoteProperty) {
    const name = label(key);
    const valueEditable = Boolean(property?.editable && (!note || data?.writable));
    const definitionEditable = !property || Boolean(valueEditable && note?.contentHash);
    const menu = canEdit && (!property || valueEditable || presentation.writable);
    return <dt className="min-w-0"><div className="note-property-name-cell">{grip(key)}{menu ? <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" className="note-property-label note-property-name text-secondary" onFocus={event => { propertyTrigger.current = event.currentTarget; }} disabled={busy || loading || !labelData || (!definitionEditable && !presentation.writable)} aria-label={`属性菜单 ${name}`} />}><Icon /><span className="truncate" title={name}>{name}</span></DropdownMenuTrigger><DropdownMenuContent align="start" className="note-property-menu" finalFocus={() => {
      if (renaming || removing || editing || typeChange) return false;
      return hiddenKeys.has(key) && !open ? panelTrigger.current ?? false : true;
    }} aria-label={`管理属性 ${name}`}>
      {definitionEditable && <DropdownMenuItem onClick={() => renameLabel(key)}><Pencil />重命名</DropdownMenuItem>}
      {controls}{arrangementMenu(key)}
    </DropdownMenuContent></DropdownMenu> : <span className="note-property-label text-secondary"><Icon /><span className="truncate" title={name}>{name}</span></span>}</div></dt>;
  }
  function systemName(key:keyof typeof systemNames) { return nameCell(key,systemNames[key]); }
  async function apply(change:PropertyChange, keepOpen = false) {
    setError('');
    const key = change.name === 'tags' ? 'system:tags' : `property:${change.name}`;
    const value = change.name === 'tags' ? [...(Array.isArray(change.value) ? change.value : []),...tags] : change.value;
    const activeEditor = editing === change.name || imageInteractions.has(key);
    const hidesEditor = activeEditor && !open && !isPropertyVisible(presentation.layout,key,value);
    const hiddenEditor = activeEditor && !open && hiddenKeys.has(key);
    if (hidesEditor && (change.name === 'tags' || keyboardFocus.current === change.name)) focusAfterLayout.current = key;
    const close = () => { if (!keepOpen || hidesEditor) setEditing(current => current === change.name ? null : current); if (change.type !== 'image' || change.create || change.remove || change.definition) { setAdding(false); setRemoving(null); setRenaming(null); } };
    const property = change.name === 'tags' ? data?.tagProperty : data?.properties.find(property => property.name === change.name);
    const previous = property && property.type !== 'unsupported' ? { name: change.name, type: property.type, value: property.value ?? '', ...(change.name !== 'tags' && data?.definitionHash ? {definitionHash:data.definitionHash} : {}) } : undefined;
    const intent = {...change,...(change.name !== 'tags' && data?.definitionHash ? {definitionHash:data.definitionHash} : {})};
    const pending = previous && onApplyValue ? onApplyValue(intent, previous) : onApply(intent);
    const valueOnly = !change.definition && !change.create && !change.remove;
    if (valueOnly && change.type !== 'image' && !hidesEditor && !hiddenEditor) {
      setData(current => applyPendingChange(current, change));
      close();
      // The editor owns the durable intent and reports failures without reopening an old popup.
      void pending.catch(cause => setError(errorMessage(cause)));
      return;
    }
    try { await pending; if (valueOnly) setData(current => applyPendingChange(current, change)); close(); }
    catch (cause) { setError(errorMessage(cause)); throw cause; }
  }
  async function toggleCheckbox(name:string, value:boolean) {
    if (busy || loading) return;
    await apply({name,type:'checkbox',value});
  }
  function duplicate(property:NoteProperty) {
    const names = new Set(data?.properties.map(item => item.name));
    let name = '', index = 1;
    do { const suffix = ` 副本${index === 1 ? '' : index}`; name = property.name.slice(0, 100 - suffix.length) + suffix; index++; } while (names.has(name));
    void apply({name,type:property.type as PropertyType,value:property.value,create:true,copyFrom:property.name,...(property.options ? {options:property.options} : {})}).catch(() => undefined);
  }
  function switchType(property:NoteProperty, type:PropertyType) {
    if (busy || loading || property.type === type) return;
    setError(''); setEditing(null); setAdding(false);
    setTypeChange({property,type});
  }
  const tagBadges = loading && !data && !mergedTags.length ? <Skeleton className="h-5" style={{width:96}} /> : mergedTags.length ? <TooltipProvider delay={300}>{mergedTags.map(tag => {
    const source = propertyTags.includes(tag) ? tags.includes(tag) ? '属性和正文均有' : '属性标签' : '正文标签';
    const descriptionId = `${tooltipId}-${encodeURIComponent(tag)}`;
    return <Tooltip key={tag}><TooltipTrigger aria-describedby={descriptionId} render={<TagPill name={tag} />} /><TooltipContent id={descriptionId} role="tooltip" className="animate-none">{source}</TooltipContent></Tooltip>;
  })}</TooltipProvider> : <span className="note-property-empty">{canEdit && data?.tagProperty?.editable ? '添加标签' : '未添加标签'}</span>;
  const rowNodes = new Map<string,ReactNode>();
  rowNodes.set('system:tags', <>{systemName('system:tags')}<dd className="min-w-0">{canEdit && data?.tagProperty?.editable ? <Popover open={editing === 'tags'} onOpenChange={(value,details) => { if (busy) { details.cancel(); return; } if (value) locatingTag.current = false; setEditing(value ? 'tags' : null); setAdding(false); setError(''); }}><PopoverTrigger render={<Button variant="ghost" className="note-property-edit note-property-tags w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label="编辑标签" />}>{tagBadges}</PopoverTrigger><PopoverContent align="start" className="note-property-popup note-tag-popup" aria-label="编辑标签" finalFocus={() => !locatingTag.current}><TagPropertyEditor onChangeTag={onChangeTag} tags={propertyTags} bodyTags={tags} busy={busy || loading} error={error} onSave={value => apply({name:'tags',type:'list',value}, true)} onLocateTag={onLocateTag ? tag => { locatingTag.current = true; setEditing(null); onLocateTag(tag); } : undefined} /></PopoverContent></Popover> : <div className="note-property-value note-property-tags">{tagBadges}{data?.tagProperty?.type === 'unsupported' && <span className="text-secondary">属性标签 {display(data.tagProperty.value)} · 只读</span>}</div>}</dd></>);
  rowNodes.set('system:updatedAt', <>{systemName('system:updatedAt')}<dd className="note-property-value tabular-nums">{updated ? <time dateTime={note?.updatedAt}>{updated}</time> : note ? '未提供' : '尚未保存'}</dd></>);
  rowNodes.set('system:createdAt', <>{systemName('system:createdAt')}<dd className="note-property-value tabular-nums">{noteTime(note?.createdAt) ?? '未提供'}</dd></>);
  rowNodes.set('system:filename', <>{systemName('system:filename')}<dd className="note-property-value tabular-nums">{note ? (relativePath ?? note.relativePath)?.split('/').pop() : '尚未保存'}</dd></>);
  for (const property of data?.properties ?? []) {
          const {Icon} = propertyTypes[property.type === 'list' ? 'multiSelect' : property.type];
          const name = label(`property:${property.name}`);
          const editable = property.editable && canEdit;
          const choice = property.type === 'select' || property.type === 'multiSelect';
          const choiceValues = Array.isArray(property.value) ? property.value : property.value ? [String(property.value)] : [];
          const emptyValue = <span className="note-property-empty">{editable ? choice ? '选择选项' : property.type === 'date' ? '选择日期' : property.type === 'number' ? '输入数字' : '添加文本' : '未填写'}</span>;
          const hasValue = Array.isArray(property.value) ? property.value.length > 0 : property.value !== '' && property.value != null;
          const formattedValue = property.type === 'date' && typeof property.value === 'string' ? formatPropertyDate(property.value) : display(property.value);
          const value = choice ? choiceValues.length ? <span className="note-property-tags">{choiceValues.map((value,index) => <ChoicePill key={`${index}:${value}`} name={value} options={property.options} />)}</span> : emptyValue : hasValue ? formattedValue : emptyValue;
          rowNodes.set(`property:${property.name}`, <>
            {nameCell(`property:${property.name}`,Icon,editable && note?.contentHash ? <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><SlidersHorizontal />类型<span className="flex-1 text-right text-xs text-secondary">{propertyTypes[property.type === 'list' ? 'multiSelect' : property.type].label}</span></DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="note-property-menu" aria-label={`属性类型 ${name}`}>
                  <DropdownMenuRadioGroup value={property.type} onValueChange={type => switchType(property, type as PropertyType)}>
                    {editableTypes.map(type => { const {Icon:TypeIcon,label} = propertyTypes[type]; return <DropdownMenuRadioItem key={type} value={type} closeOnClick disabled={busy || loading}><TypeIcon />{label}</DropdownMenuRadioItem>; })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setError(''); duplicate(property); }}><Copy />创建属性副本</DropdownMenuItem>
              <DropdownMenuItem className="note-property-delete" onClick={() => { setError(''); setRemoving(property); }}><Trash2 />删除属性</DropdownMenuItem>
            </> : undefined,property)}
            <dd className="min-w-0">{property.type === 'image' ? <Suspense fallback={<span role="status" aria-label="正在读取图片" className="note-property-image-trigger flex items-center"><Skeleton className="h-6 w-12" /></span>}><ImagePropertyEditor key={`${scopeKey}:${vaultBinding}:${property.name}`} name={name} value={typeof property.value === 'string' ? property.value : ''} noteId={note?.id} notePath={relativePath ?? note?.relativePath ?? 'notes/note.md'} vaultBinding={vaultBinding} editable={editable} busy={busy || loading} onInteractionChange={active => setImageInteractions(current => { const key = `property:${property.name}`; if (current.has(key) === active) return current; const next = new Set(current); if (active) next.add(key); else next.delete(key); return next; })} onSave={value => apply({name:property.name,type:'image',value})} /></Suspense> : property.type === 'checkbox' && property.editable ? <div className="note-property-value note-property-checkbox-value"><Checkbox.Root render={<button type="button" />} nativeButton checked={property.value === true} onCheckedChange={checked => { void toggleCheckbox(property.name,checked); }} disabled={!editable || busy || loading} aria-label={`切换属性 ${name}`} className="note-property-checkbox"><Checkbox.Indicator className="note-property-checkbox-indicator"><Check aria-hidden="true" strokeWidth={2.5} /></Checkbox.Indicator></Checkbox.Root></div> : editable ? property.type === 'text' || property.type === 'number' ? editing === property.name ? <PropertyForm inPlace property={property} onCloseIntent={keyboard => { keyboardFocus.current = keyboard ? property.name : null; blurClosing.current = keyboard ? null : property.name; if (!keyboard) focusAfterLayout.current = null; }} error={error} busy={busy || loading} onSave={apply} onCancel={() => { setEditing(null); setError(''); }} /> : <Button variant="ghost" className="note-property-edit min-w-0 w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label={`编辑属性 ${name}`} onClick={event => { inlineCell.current = event.currentTarget.parentElement; setEditing(property.name); setAdding(false); setError(''); }}>{value}</Button> : <Popover open={editing === property.name} onOpenChange={(value,details) => {
              if (value) { setEditing(property.name); setAdding(false); setError(''); }
              else if (busy) details.cancel();
              else if (choice) setEditing(null);
              else if (details.reason !== 'escape-key') { details.cancel(); formRef.current?.requestSubmit(); }
              else setEditing(null);
            }}><PopoverTrigger render={<Button variant="ghost" className="note-property-edit min-w-0 w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label={`编辑属性 ${name}`} />}>{value}</PopoverTrigger><PopoverContent align="start" sideOffset={choice ? ({anchor}) => -anchor.height : undefined} aria-label={`编辑属性 ${name}`} className={choice ? 'note-property-popup note-tag-popup' : property.type === 'date' ? 'note-property-popup note-date-popup' : 'note-property-popup'}>{choice ? <ChoicePropertyEditor property={property} error={error} busy={busy || loading} onSave={apply} /> : <PropertyForm property={property} formRef={formRef} error={error} busy={busy || loading} onSave={apply} onCancel={() => { setEditing(null); setError(''); }} />}</PopoverContent></Popover> : <div className="note-property-value text-secondary" title={property.editable ? undefined : "此属性暂不支持编辑"}>{value} {!property.editable && <span className="text-xs">只读</span>}</div>}</dd>
          </>);
  }
  const contextualError = Boolean(editing || adding || removing || renaming || typeChange);
  const notice = <>
    {presentation.error && <PageNotice title="属性布局未更新" actions={<Button variant="outline" size="sm" onClick={presentation.retry}>重新读取设置</Button>}>{presentation.error}</PageNotice>}
    {error && (readFailed || error !== saveError) && !contextualError && <PageNotice title={readFailed ? '无法读取属性' : '属性操作未完成'} actions={readFailed ? <Button variant="outline" size="sm" disabled={busy || loading} onClick={() => setReadRevision(value => value+1)}>重试读取</Button> : undefined}>{error}</PageNotice>}
    {note && data && !data.writable && <PageNotice tone="info" title="部分属性只读">高级 YAML 语法请在源文件中编辑。</PageNotice>}
  </>;
  return <>
    {renderHeader ? renderHeader(notice, Boolean(error && error === saveError && contextualError)) : notice}
    {layoutAnnouncement && <span className="sr-only" role="status" aria-live="polite">{layoutAnnouncement}</span>}
    {loading && !data && <span role="status" aria-label="正在读取属性" className="sr-only">正在读取属性…</span>}
    <Collapsible open={open} onOpenChange={setOpen} aria-label="笔记属性" aria-busy={loading} className="note-properties" data-updating={canEdit && note?.contentHash && (busy || loading) ? '' : undefined}>
      <dl id={propertyListId} className="note-property-group">{shownKeys.map(key => <div key={key} className="note-property-row" data-property-key={key} data-property-hidden={hiddenKeys.has(key) ? '' : undefined} onDragOver={dragOver} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) clearDrop(); }} onDrop={event => {
        if (!dragging.current || !canArrange) return;
        event.preventDefault(); event.stopPropagation();
        const source = dragging.current; const after = event.currentTarget.dataset.dropPosition === 'after';
        dragging.current = null; clearDrop(); moveProperty(source,key,after);
      }}>{rowNodes.get(key)}</div>)}</dl>
    <CollapsibleContent id={propertyActionId}>
      {canEdit && <div className="note-property-row note-property-add-row">
        <Popover open={adding} onOpenChange={value => { if (!busy) { setAdding(value); setEditing(null); setError(''); } }}><PopoverTrigger render={<Button variant="ghost" size="sm" className="note-property-action text-secondary" disabled={(!note ? !data : !data?.writable) || busy || loading} />}><Plus className="size-4" />添加属性</PopoverTrigger><PopoverContent align="start" aria-label="添加属性" className="note-property-popup note-property-create-popup"><PropertyCreator error={error} busy={busy || loading} onSave={apply} /></PopoverContent></Popover>
      </div>}
    </CollapsibleContent>
    <div className="note-property-footer"><CollapsibleTrigger aria-controls={`${propertyListId} ${propertyActionId}`} render={<Button variant="ghost" size="sm" ref={panelTrigger} className="note-property-action note-property-toggle text-secondary" />}><span className="flex size-4 shrink-0 items-center justify-center">{loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : open ? <ChevronUp /> : <ChevronDown />}</span>{open ? '收起' : '更多属性'}</CollapsibleTrigger></div>
    {renaming && <NameEditor initialName={renaming.name} anchor={renaming.anchor} side="bottom" align="start" sideOffset={4} className="w-80" title="重命名属性" inputLabel="新属性名" maxLength={100} selectOnFocus busy={busy} onSave={saveLabel} onClose={() => { setRenaming(null); setError(''); }} />}
    <AlertDialog.Root open={Boolean(typeChange)} onOpenChange={value => { if (!changingType && !value) { setTypeChange(null); setError(''); } }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className="note-property-backdrop bg-overlay backdrop-blur-sm" /><ConfirmationPopup className="note-property-confirm surface-floating shadow-high"><AlertDialog.Title className="break-words font-semibold">更改「{typeChange ? label(`property:${typeChange.property.name}`) : ''}」的类型？</AlertDialog.Title><AlertDialog.Description className="mt-2 break-words text-sm text-secondary">库内所有同名属性将改为「{typeChange ? propertyTypes[typeChange.type === 'list' ? 'multiSelect' : typeChange.type].label : ''}」。转换会丢值时不会修改笔记。</AlertDialog.Description>{error && <p role="alert" className="mt-2 break-words text-sm text-error">{error}</p>}<div className="note-property-confirm-actions"><AlertDialog.Close render={<Button variant="outline" size="sm" disabled={busy || changingType} />}>取消</AlertDialog.Close><Button variant="outline" size="sm" disabled={busy || changingType} onClick={() => {
        if (!typeChange || changingType) return;
        setChangingType(true);
        void apply({...propertyTypeChange(typeChange.property,typeChange.type),definition:true}).then(() => setTypeChange(null)).catch(() => undefined).finally(() => setChangingType(false));
      }}>确认更改</Button></div></ConfirmationPopup></AlertDialog.Portal>
    </AlertDialog.Root>
    <AlertDialog.Root open={Boolean(removing)} onOpenChange={value => { if (!busy && !value) setRemoving(null); }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className="note-property-backdrop bg-overlay backdrop-blur-sm" /><ConfirmationPopup className="note-property-confirm surface-floating shadow-high"><AlertDialog.Title className="break-words font-semibold">删除属性「{removing ? label(`property:${removing.name}`) : ''}」？</AlertDialog.Title><AlertDialog.Description className="mt-2 break-words text-sm text-secondary">将从所有笔记中删除此属性及已填写的值，此操作无法撤销。</AlertDialog.Description>{error && <p role="alert" className="mt-2 break-words text-sm text-error">{error}</p>}<div className="note-property-confirm-actions"><AlertDialog.Close render={<Button variant="outline" size="sm" disabled={busy} />}>取消</AlertDialog.Close><Button variant="outline" size="sm" className="text-error" disabled={busy} onClick={() => { if (removing) void apply({name:removing.name,remove:true}).catch(() => undefined); }}>确认删除</Button></div></ConfirmationPopup></AlertDialog.Portal>
    </AlertDialog.Root>
  </Collapsible></>;
}

  return NoteProperties;
}
