import type { ComponentType, ComponentProps, SVGProps } from "react";
import { Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Note, NoteProperties as Properties, NoteProperty, PropertyChange, PropertyType, PropertyLabels } from '@memocard/contracts';
import type { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { request, errorMessage } from './bridge';
import { tagKey } from './inline-tags';
import { propertyTypeChange, listAsMultiSelect } from './property-type-change';
import { defaultPropertyLabel } from './property-labels';
import { formatPropertyDate } from './property-dates';
import { validPropertyNumber } from './property-numbers';

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
  Hash: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Button: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/button")["Button"]>, "render">>;
  PageNotice: ComponentType<ComponentProps<typeof import("@ui-next/business/PageNotice")["PageNotice"]>>;
  Input: ComponentType<ComponentProps<typeof import("@ui-next/components/input")["Input"]>>;
  Skeleton: ComponentType<ComponentProps<typeof import("@ui-next/components/skeleton")["Skeleton"]>>;
  NameEditor: ComponentType<ComponentProps<typeof import("@ui-next/business/property-editors")["NameEditor"]>>;
  Textarea: ComponentType<ComponentProps<typeof import("@ui-next/components/textarea")["Textarea"]>>;
  TagPill: ComponentType<Omit<ComponentProps<typeof import("@ui-next/business/property-editors")["TagPill"]>, "variant" | "render">>;
  Collapsible: ComponentType<ComponentProps<typeof import("@base-ui/react/collapsible")["Collapsible"]["Root"]>>;
  CollapsibleContent: ComponentType<ComponentProps<typeof import("@base-ui/react/collapsible")["Collapsible"]["Panel"]>>;
  CollapsibleTrigger: ComponentType<ComponentProps<typeof import("@base-ui/react/collapsible")["Collapsible"]["Trigger"]>>;
  Popover: ComponentType<ComponentProps<typeof import("@ui-next/components/popover")["Popover"]>>;
  PopoverTrigger: ComponentType<ComponentProps<typeof import("@ui-next/components/popover")["PopoverTrigger"]>>;
  PopoverContent: ComponentType<ComponentProps<typeof import("@ui-next/components/popover")["PopoverContent"]>>;
  DropdownMenu: ComponentType<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenu"]>>;
  DropdownMenuTrigger: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuTrigger"]>, "ref">>;
  DropdownMenuContent: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuContent"]>, "ref">>;
  DropdownMenuItem: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuItem"]>, "ref">>;
  DropdownMenuSeparator: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuSeparator"]>, "ref">>;
  DropdownMenuSub: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuSub"]>, "ref">>;
  DropdownMenuSubTrigger: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuSubTrigger"]>, "ref">>;
  DropdownMenuSubContent: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuSubContent"]>, "ref">>;
  DropdownMenuRadioGroup: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuRadioGroup"]>, "ref">>;
  DropdownMenuRadioItem: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/dropdown-menu")["DropdownMenuRadioItem"]>, "ref">>;
  Tooltip: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["Tooltip"]>>;
  TooltipContent: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["TooltipContent"]>>;
  TooltipProvider: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["TooltipProvider"]>>;
  TooltipTrigger: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["TooltipTrigger"]>>;
  ChoicePropertyEditor: ComponentType<ComponentProps<typeof import("@ui-next/business/property-editors")["ChoicePropertyEditor"]>>;
  ChoicePill: ComponentType<ComponentProps<typeof import("@ui-next/business/property-editors")["ChoicePill"]>>;
  DatePropertyPicker: ComponentType<ComponentProps<typeof import("@ui-next/business/property-editors")["DatePropertyPicker"]>>;
  ImagePropertyEditor: ComponentType<ComponentProps<typeof import("@ui-next/business/property-editors")["ImagePropertyEditor"]>>;
  TagPropertyEditor: ComponentType<ComponentProps<typeof import("@ui-next/business/property-editors")["TagPropertyEditor"]>>;
};

export function createNoteProperties(view: View) {
  const ConfirmationPopup = view.ConfirmationPopup ?? AlertDialog.Popup;
  const { Checkbox, CalendarDays, LoaderCircle, Check, ChevronDown, ChevronUp, Clock, FileText, Plus, Text, SquareCheck, Pencil, Trash2, Copy, CircleChevronDown, ListChecks, SlidersHorizontal, Image, Hash, Button, PageNotice, Input, Skeleton, NameEditor, Textarea, TagPill, Collapsible, CollapsibleContent, CollapsibleTrigger, Popover, PopoverTrigger, PopoverContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, ChoicePropertyEditor, ChoicePill, DatePropertyPicker, ImagePropertyEditor, TagPropertyEditor } = view;
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
function PropertyForm({ property, busy, onSave, onCancel, formRef, error, inPlace = false }: { inPlace?:boolean; formRef?:RefObject<HTMLFormElement | null>; error?:string; property:NoteProperty; busy:boolean; onSave:(change:PropertyChange)=>Promise<void>; onCancel:()=>void }) {
  const name = property.name;
  const type = property.type === 'unsupported' ? 'text' : property.type;
  const [text, setText] = useState(Array.isArray(property.value) ? property.value.join('\n') : typeof property.value === 'string' ? property.value : '');
  const [invalidNumber, setInvalidNumber] = useState(false);
  const numberErrorId = useId();
  const submitting = useRef(false);
  const cancelled = useRef(false);
  const textField = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!inPlace || !textField.current) return;
    textField.current.style.height = 'auto';
    textField.current.style.height = `${Math.max(32, textField.current.scrollHeight)}px`;
  }, [text, inPlace]);
  function save(value:PropertyChange['value']) {
    if (busy || submitting.current) return;
    if (type === 'number' && typeof value === 'string' && value !== '' && !validPropertyNumber(value)) { setInvalidNumber(true); return; }
    if (JSON.stringify(value) === JSON.stringify(property.value)) { onCancel(); return; }
    submitting.current = true;
    void onSave({name,type,value}).catch(() => undefined).finally(() => { submitting.current = false; });
  }
  return <form ref={formRef} className={inPlace ? 'note-property-inline shadow-lg' : 'space-y-2'} onBlur={event => {
    if (inPlace && !cancelled.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.requestSubmit();
  }} onKeyDown={event => {
    if (inPlace && event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); cancelled.current = true; onCancel(); }
  }} onSubmit={event => {
    event.preventDefault();
    save(text);
  }}>
    {type === 'date' ? <Suspense fallback={<span role="status">正在读取日期…</span>}><DatePropertyPicker autoFocus value={text} onChange={setText} onSelect={value => { setText(value); save(value); }} busy={busy} /></Suspense> : <Textarea ref={textField} autoFocus aria-label="属性值" inputMode={type === 'number' ? 'decimal' : undefined} aria-invalid={invalidNumber || undefined} aria-describedby={invalidNumber ? numberErrorId : undefined} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && (type === 'text' || type === 'number' || event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={type === 'number' ? '输入数字' : '输入属性值'} value={text} onChange={event => { setText(event.target.value); setInvalidNumber(false); }} disabled={busy} className={type === 'number' ? 'min-h-16 tabular-nums' : 'min-h-16'} />}
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

function NoteProperties({ note, savedProperties, saveError, renderHeader, pendingChanges = [], tags: bodyValues, relativePath, vaultBinding, canEdit, canRead = canEdit, busy, onApply, onApplyValue, onLocateTag, onChangeTag }: { note?:Note; savedProperties?:Properties; saveError?:string; renderHeader?:(notice:ReactNode, ownsSaveError:boolean)=>ReactNode; pendingChanges?:PropertyChange[]; tags:string[]; relativePath?:string; vaultBinding?:string; canEdit:boolean; canRead?:boolean; busy:boolean; onApply:(change:PropertyChange)=>Promise<void>; onApplyValue?:(change:PropertyChange, previous:PropertyChange)=>Promise<void>; onLocateTag?:(tag:string)=>void; onChangeTag?:(from:string,to:string | null)=>Promise<void> }) {
  const tags = [...new Set(bodyValues.map(tagKey))];
  const tooltipId = useId();
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
        setData({...value,properties:value.properties.map(listAsMultiSelect)});
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
  }, [note?.id, note?.contentHash, canRead, savedProperties, readRevision]);
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
  function systemName(key:keyof typeof systemNames) {
    const Icon = systemNames[key];
    const name = label(key);
    return <dt className="min-w-0">{canEdit ? <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" className="note-property-label note-property-name text-secondary" onFocus={event => { propertyTrigger.current = event.currentTarget; }} disabled={busy || !labelData} aria-label={`属性菜单 ${name}`} />}><Icon /><span className="truncate" title={name}>{name}</span></DropdownMenuTrigger><DropdownMenuContent align="start" className="note-property-menu" finalFocus={() => !renaming} aria-label={`管理属性 ${name}`}><DropdownMenuItem onClick={() => renameLabel(key)}><Pencil />重命名</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <span className="note-property-label text-secondary"><Icon className="size-4" /><span className="truncate" title={name}>{name}</span></span>}</dt>;
  }
  async function apply(change:PropertyChange, keepOpen = false) {
    setError('');
    const close = () => { if (!keepOpen) setEditing(current => current === change.name ? null : current); setAdding(false); setRemoving(null); setRenaming(null); };
    const property = change.name === 'tags' ? data?.tagProperty : data?.properties.find(property => property.name === change.name);
    const previous = property && property.type !== 'unsupported' ? { name: change.name, type: property.type, value: property.value ?? '', ...(change.name !== 'tags' && data?.definitionHash ? {definitionHash:data.definitionHash} : {}) } : undefined;
    const intent = {...change,...(change.name !== 'tags' && data?.definitionHash ? {definitionHash:data.definitionHash} : {})};
    const pending = previous && onApplyValue ? onApplyValue(intent, previous) : onApply(intent);
    if (!change.definition && !change.create && !change.remove) {
      setData(current => applyPendingChange(current, change));
      close();
      // The editor owns the durable intent and reports failures without reopening an old popup.
      void pending.catch(cause => setError(errorMessage(cause)));
      return;
    }
    try { await pending; close(); }
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
  const updated = noteTime(note?.updatedAt);
  const propertyTags = Array.isArray(data?.tagProperty?.value) ? [...new Set(data.tagProperty.value.map(tagKey))] : [];
  const mergedTags = [...new Set([...propertyTags, ...tags])];
  const tagBadges = loading && !data && !mergedTags.length ? <Skeleton className="h-5" style={{width:96}} /> : mergedTags.length ? <TooltipProvider delay={300}>{mergedTags.map(tag => {
    const source = propertyTags.includes(tag) ? tags.includes(tag) ? '属性和正文均有' : '属性标签' : '正文标签';
    const descriptionId = `${tooltipId}-${encodeURIComponent(tag)}`;
    return <Tooltip key={tag}><TooltipTrigger aria-describedby={descriptionId} render={<TagPill name={tag} />} /><TooltipContent id={descriptionId} role="tooltip" className="animate-none">{source}</TooltipContent></Tooltip>;
  })}</TooltipProvider> : <span className="note-property-empty">{canEdit && data?.tagProperty?.editable ? '添加标签' : '未添加标签'}</span>;
  const contextualError = Boolean(editing || adding || removing || renaming || typeChange);
  const notice = <>
    {error && (readFailed || error !== saveError) && !contextualError && <PageNotice title={readFailed ? '无法读取属性' : '属性操作未完成'} actions={readFailed ? <Button variant="outline" size="sm" disabled={busy || loading} onClick={() => setReadRevision(value => value+1)}>重试读取</Button> : undefined}>{error}</PageNotice>}
    {note && data && !data.writable && <PageNotice tone="info" title="部分属性只读">高级 YAML 语法请在源文件中编辑。</PageNotice>}
  </>;
  return <>
    {renderHeader ? renderHeader(notice, Boolean(error && error === saveError && contextualError)) : notice}
    {loading && !data && <span role="status" aria-label="正在读取属性" className="sr-only">正在读取属性…</span>}
    <Collapsible open={open} onOpenChange={setOpen} aria-label="笔记属性" aria-busy={loading} className="note-properties" data-updating={canEdit && note?.contentHash && (busy || loading) ? '' : undefined}>
    <dl>
      <div className="note-property-row">{systemName('system:tags')}<dd className="min-w-0">{canEdit && data?.tagProperty?.editable ? <Popover open={editing === 'tags'} onOpenChange={(value,details) => { if (busy) { details.cancel(); return; } if (value) locatingTag.current = false; setEditing(value ? 'tags' : null); setAdding(false); setError(''); }}><PopoverTrigger render={<Button variant="ghost" className="note-property-edit note-property-tags w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label="编辑标签" />}>{tagBadges}</PopoverTrigger><PopoverContent align="start" className="note-property-popup note-tag-popup" aria-label="编辑标签" finalFocus={() => !locatingTag.current}><TagPropertyEditor onChangeTag={onChangeTag} tags={propertyTags} bodyTags={tags} busy={busy || loading} error={error} onSave={value => apply({name:'tags',type:'list',value}, true)} onLocateTag={onLocateTag ? tag => { locatingTag.current = true; setEditing(null); onLocateTag(tag); } : undefined} /></PopoverContent></Popover> : <div className="note-property-value note-property-tags">{tagBadges}{data?.tagProperty?.type === 'unsupported' && <span className="text-secondary">属性标签 {display(data.tagProperty.value)} · 只读</span>}</div>}</dd></div>
    </dl>
    <CollapsibleContent>
      <dl>
        <div className="note-property-row">{systemName('system:updatedAt')}<dd className="note-property-value tabular-nums">{updated ? <time dateTime={note?.updatedAt}>{updated}</time> : note ? '未提供' : '尚未保存'}</dd></div>
        {[
          { key:'system:createdAt' as const, value:noteTime(note?.createdAt) ?? '未提供' },
          { key:'system:filename' as const, value:note ? relativePath?.split('/').pop() : '尚未保存' },
        ].map(({key,value}) => <div key={key} className="note-property-row">{systemName(key)}<dd className="note-property-value tabular-nums">{value}</dd></div>)}
        {data?.properties.map(property => {
          const {Icon} = propertyTypes[property.type === 'list' ? 'multiSelect' : property.type];
          const name = label(`property:${property.name}`);
          const editable = property.editable && canEdit && !!note?.contentHash;
          const choice = property.type === 'select' || property.type === 'multiSelect';
          const choiceValues = Array.isArray(property.value) ? property.value : property.value ? [String(property.value)] : [];
          const emptyValue = <span className="note-property-empty">{editable ? choice ? '选择选项' : property.type === 'date' ? '选择日期' : property.type === 'number' ? '输入数字' : '添加文本' : '未填写'}</span>;
          const hasValue = Array.isArray(property.value) ? property.value.length > 0 : property.value !== '' && property.value != null;
          const formattedValue = property.type === 'date' && typeof property.value === 'string' ? formatPropertyDate(property.value) : display(property.value);
          const value = choice ? choiceValues.length ? <span className="note-property-tags">{choiceValues.map((value,index) => <ChoicePill key={`${index}:${value}`} name={value} options={property.options} />)}</span> : emptyValue : hasValue ? formattedValue : emptyValue;
          return <div key={property.name} className="note-property-row">
            <dt className="min-w-0">{editable ? <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" className="note-property-label note-property-name text-secondary" onFocus={event => { propertyTrigger.current = event.currentTarget; }} disabled={busy || loading || !labelData} aria-label={`属性菜单 ${name}`} />}><Icon /><span className="truncate" title={name}>{name}</span></DropdownMenuTrigger><DropdownMenuContent align="start" className="note-property-menu" finalFocus={() => !renaming && !removing && !editing && !typeChange} aria-label={`管理属性 ${name}`}>
              <DropdownMenuItem onClick={() => { renameLabel(`property:${property.name}`); }}><Pencil />重命名</DropdownMenuItem>
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
            </DropdownMenuContent></DropdownMenu> : <span className="note-property-label text-secondary"><Icon /><span className="truncate" title={name}>{name}</span></span>}</dt>
            <dd className="min-w-0">{property.type === 'image' ? <Suspense fallback={<span role="status" aria-label="正在读取图片" className="flex h-8 items-center"><Skeleton className="h-8 w-12" /></span>}><ImagePropertyEditor key={`${note?.id}:${vaultBinding}:${property.name}`} name={name} value={typeof property.value === 'string' ? property.value : ''} noteId={note?.id} notePath={relativePath ?? note?.relativePath ?? 'notes/note.md'} vaultBinding={vaultBinding} editable={editable} busy={busy || loading} onSave={value => apply({name:property.name,type:'image',value})} /></Suspense> : property.type === 'checkbox' && property.editable ? <div className="note-property-value note-property-checkbox-value"><Checkbox.Root render={<button type="button" />} nativeButton checked={property.value === true} onCheckedChange={checked => { void toggleCheckbox(property.name,checked); }} disabled={!editable || busy || loading} aria-label={`切换属性 ${name}`} className="note-property-checkbox"><Checkbox.Indicator className="note-property-checkbox-indicator"><Check aria-hidden="true" strokeWidth={2.5} /></Checkbox.Indicator></Checkbox.Root></div> : editable ? property.type === 'text' || property.type === 'number' ? editing === property.name ? <PropertyForm inPlace property={property} error={error} busy={busy || loading} onSave={apply} onCancel={() => { setEditing(null); setError(''); }} /> : <Button variant="ghost" className="note-property-edit min-w-0 w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label={`编辑属性 ${name}`} onClick={() => { setEditing(property.name); setAdding(false); setError(''); }}>{value}</Button> : <Popover open={editing === property.name} onOpenChange={(value,details) => {
              if (value) { setEditing(property.name); setAdding(false); setError(''); }
              else if (busy) details.cancel();
              else if (choice) setEditing(null);
              else if (details.reason !== 'escape-key') { details.cancel(); formRef.current?.requestSubmit(); }
              else setEditing(null);
            }}><PopoverTrigger render={<Button variant="ghost" className="note-property-edit min-w-0 w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label={`编辑属性 ${name}`} />}>{value}</PopoverTrigger><PopoverContent align="start" sideOffset={choice ? ({anchor}) => -anchor.height : undefined} aria-label={`编辑属性 ${name}`} className={choice ? 'note-property-popup note-tag-popup' : property.type === 'date' ? 'note-property-popup note-date-popup' : 'note-property-popup'}>{choice ? <ChoicePropertyEditor property={property} error={error} busy={busy || loading} onSave={apply} /> : <PropertyForm property={property} formRef={formRef} error={error} busy={busy || loading} onSave={apply} onCancel={() => { setEditing(null); setError(''); }} />}</PopoverContent></Popover> : <div className="note-property-value text-secondary" title={property.editable ? undefined : "此属性暂不支持编辑"}>{value} {!property.editable && <span className="text-xs">只读</span>}</div>}</dd>
          </div>;
        })}
      </dl>
      {canEdit && <div className="py-1">
        <Popover open={adding} onOpenChange={value => { if (!busy) { setAdding(value); setEditing(null); setError(''); } }}><PopoverTrigger render={<Button variant="ghost" size="sm" className="note-property-action text-secondary" disabled={!note || !data?.writable || busy || loading} />}><Plus className="size-4" />添加属性</PopoverTrigger><PopoverContent align="start" aria-label="添加属性" className="note-property-popup note-property-create-popup"><PropertyCreator error={error} busy={busy || loading} onSave={apply} /></PopoverContent></Popover>
      </div>}
    </CollapsibleContent>
    <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="note-property-action text-secondary" />}><span className="flex size-4 shrink-0 items-center justify-center">{loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : open ? <ChevronUp /> : <ChevronDown />}</span>属性</CollapsibleTrigger>
    {renaming && <NameEditor initialName={renaming.name} anchor={renaming.anchor} side="bottom" align="start" sideOffset={4} className="w-80" title="重命名属性" inputLabel="新属性名" maxLength={100} selectOnFocus busy={busy} onSave={saveLabel} onClose={() => { setRenaming(null); setError(''); }} />}
    <AlertDialog.Root open={Boolean(typeChange)} onOpenChange={value => { if (!changingType && !value) { setTypeChange(null); setError(''); } }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className="note-property-backdrop bg-overlay backdrop-blur-sm" /><ConfirmationPopup className="note-property-confirm shadow-lg"><AlertDialog.Title className="break-words font-semibold">更改「{typeChange ? label(`property:${typeChange.property.name}`) : ''}」的类型？</AlertDialog.Title><AlertDialog.Description className="mt-2 break-words text-sm text-secondary">库内所有同名属性将改为「{typeChange ? propertyTypes[typeChange.type === 'list' ? 'multiSelect' : typeChange.type].label : ''}」。转换会丢值时不会修改笔记。</AlertDialog.Description>{error && <p role="alert" className="mt-2 break-words text-sm text-error">{error}</p>}<div className="note-property-confirm-actions"><AlertDialog.Close render={<Button variant="outline" size="sm" disabled={busy || changingType} />}>取消</AlertDialog.Close><Button variant="outline" size="sm" disabled={busy || changingType} onClick={() => {
        if (!typeChange || changingType) return;
        setChangingType(true);
        void apply({...propertyTypeChange(typeChange.property,typeChange.type),definition:true}).then(() => setTypeChange(null)).catch(() => undefined).finally(() => setChangingType(false));
      }}>确认更改</Button></div></ConfirmationPopup></AlertDialog.Portal>
    </AlertDialog.Root>
    <AlertDialog.Root open={Boolean(removing)} onOpenChange={value => { if (!busy && !value) setRemoving(null); }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className="note-property-backdrop bg-overlay backdrop-blur-sm" /><ConfirmationPopup className="note-property-confirm shadow-lg"><AlertDialog.Title className="break-words font-semibold">删除属性「{removing ? label(`property:${removing.name}`) : ''}」？</AlertDialog.Title><AlertDialog.Description className="mt-2 break-words text-sm text-secondary">将从所有笔记中删除此属性及已填写的值，此操作无法撤销。</AlertDialog.Description>{error && <p role="alert" className="mt-2 break-words text-sm text-error">{error}</p>}<div className="note-property-confirm-actions"><AlertDialog.Close render={<Button variant="outline" size="sm" disabled={busy} />}>取消</AlertDialog.Close><Button variant="outline" size="sm" className="text-error" disabled={busy} onClick={() => { if (removing) void apply({name:removing.name,remove:true}).catch(() => undefined); }}>确认删除</Button></div></ConfirmationPopup></AlertDialog.Portal>
    </AlertDialog.Root>
  </Collapsible></>;
}

  return NoteProperties;
}
