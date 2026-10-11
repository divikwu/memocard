import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Note, NoteProperties as Properties, NoteProperty, PropertyChange, PropertyType, PropertyLabels } from '@memocard/contracts';
import { Checkbox } from '@base-ui/react/checkbox';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { CalendarDays, ChevronDown, ChevronUp, Clock, FileText, Plus, Tags, Text, List, SquareCheck, Pencil, Trash2, Copy, CircleChevronDown, ListChecks, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NameEditor } from '@/components/name-editor';
import { Textarea } from '@/components/ui/textarea';
import TagPill from './TagPill';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ChoicePropertyEditor, { ChoicePill } from './ChoicePropertyEditor';
import DatePropertyPicker from './DatePropertyPicker';
import TagPropertyEditor from './TagPropertyEditor';
import { request, errorMessage } from './bridge';
import { tagKey } from './inline-tags';
import { propertyTypeChange } from './property-type-change';
import { defaultPropertyLabel } from './property-labels';

const noteTime = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }) : null;
};
const display = (value: NoteProperty['value']) => Array.isArray(value) ? value.join('、') : typeof value === 'boolean' ? value ? '已勾选' : '未勾选' : value || '空';
const editableTypes = ['text','select','multiSelect','list','date','checkbox'] as const;
const systemNames = {'system:tags':Tags,'system:updatedAt':Clock,'system:createdAt':CalendarDays,'system:filename':FileText};
const propertyTypes = {text:{label:'文本',Icon:Text},list:{label:'文本列表',Icon:List},select:{label:'选择',Icon:CircleChevronDown},multiSelect:{label:'多选',Icon:ListChecks},date:{label:'日期',Icon:CalendarDays},checkbox:{label:'复选框',Icon:SquareCheck},unsupported:{label:'只读',Icon:Text}};
function PropertyCreator({busy, error, onSave}: {busy:boolean; error?:string; onSave:(change:PropertyChange)=>Promise<void>}) {
  const [name, setName] = useState('');
  const submitting = useRef(false);
  function create(type:PropertyType) {
    if (busy || submitting.current || !name.trim()) return;
    submitting.current = true;
    const value = type === 'checkbox' ? false : ['list','multiSelect'].includes(type) ? [] : '';
    void onSave({name:name.trim(),type,value,create:true,...(type === 'select' || type === 'multiSelect' ? {options:[]} : {})}).catch(() => undefined).finally(() => { submitting.current = false; });
  }
  return <form className="note-property-create" onSubmit={event => event.preventDefault()}>
    <Input autoFocus aria-label="属性名" placeholder="属性名称" value={name} onChange={event => setName(event.target.value)} disabled={busy} />
    <div className="note-property-type-list" role="group" aria-label="属性类型"><span className="note-property-type-label">类型</span>{editableTypes.map(type => { const {Icon,label}=propertyTypes[type]; return <Button key={type} type="button" variant="ghost" size="sm" disabled={busy || !name.trim()} className="note-property-type-option" onClick={() => create(type)}><Icon />{label}</Button>; })}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
function PropertyForm({ property, busy, onSave, onCancel, formRef, error, inPlace = false }: { inPlace?:boolean; formRef?:RefObject<HTMLFormElement | null>; error?:string; property:NoteProperty; busy:boolean; onSave:(change:PropertyChange)=>Promise<void>; onCancel:()=>void }) {
  const name = property.name;
  const type = property.type === 'unsupported' ? 'text' : property.type;
  const [text, setText] = useState(Array.isArray(property.value) ? property.value.join('\n') : typeof property.value === 'string' ? property.value : '');
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
    if (JSON.stringify(value) === JSON.stringify(property.value)) { onCancel(); return; }
    submitting.current = true;
    void onSave({name,type,value}).catch(() => undefined).finally(() => { submitting.current = false; });
  }
  return <form ref={formRef} className={inPlace ? 'note-property-inline shadow-overlay' : 'space-y-2'} onBlur={event => {
    if (inPlace && !cancelled.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.requestSubmit();
  }} onKeyDown={event => {
    if (inPlace && event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); cancelled.current = true; onCancel(); }
  }} onSubmit={event => {
    event.preventDefault();
    save(type === 'list' ? text.split('\n').map(item => item.trim()).filter(Boolean) : text);
  }}>
    {type === 'date' ? <DatePropertyPicker autoFocus value={text} onChange={setText} onSelect={value => { setText(value); save(value); }} busy={busy} /> : <Textarea ref={textField} autoFocus aria-label="属性值" onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && (type === 'text' || event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={type === 'list' ? '每行一个值' : '输入属性值'} value={text} onChange={event => setText(event.target.value)} disabled={busy} className="min-h-16" />}
    {type === 'list' && <p className="text-xs text-muted-foreground">每行一个值，Ctrl / ⌘ + Enter 保存</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!inPlace && type !== 'date' && <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy}>保存属性</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>取消</Button></div>}
  </form>;
}
export default function NoteProperties({ note, tags: bodyValues, relativePath, canEdit, canRead = canEdit, busy, onApply, onLocateTag, onChangeTag }: { note?:Note; tags:string[]; relativePath?:string; canEdit:boolean; canRead?:boolean; busy:boolean; onApply:(change:PropertyChange)=>Promise<void>; onLocateTag?:(tag:string)=>void; onChangeTag?:(from:string,to:string | null)=>Promise<void> }) {
  const tags = [...new Set(bodyValues.map(tagKey))];
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Properties>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const propertyTrigger = useRef<HTMLButtonElement>(null);
  const locatingTag = useRef(false);
  const [renaming, setRenaming] = useState<{key:string; name:string; anchor:HTMLElement} | null>(null);
  const [labelData, setLabelData] = useState<PropertyLabels>();
  const label = (key:string) => labelData?.labels[key] ?? defaultPropertyLabel(key);
  const [removing, setRemoving] = useState<NoteProperty | null>(null);
  useEffect(() => {
    if (!open || !canRead) return;
    let active = true;
    setLoading(true); setError('');
    if (!note?.contentHash) setData(undefined);
    void request<Properties>('getNoteProperties', note?.contentHash ? {id:note.id} : {}).then(value => { if (active) setData(value); }).catch(cause => { if (active) setError(errorMessage(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, note?.id, note?.contentHash, canRead]);
  useEffect(() => {
    if (!open || !canRead) return;
    let active = true;
    setLabelData(undefined);
    void request<PropertyLabels>('getPropertyLabels').then(value => { if (active) setLabelData(value); }).catch(cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [open, note?.id, canRead]);
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
    return <dt className="min-w-0">{canEdit ? <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" className="note-property-label note-property-name text-muted-foreground" onFocus={event => { propertyTrigger.current = event.currentTarget; }} disabled={busy || !labelData} aria-label={`属性菜单 ${name}`} />}><Icon /><span className="truncate" title={name}>{name}</span></DropdownMenuTrigger><DropdownMenuContent align="start" className="note-property-menu" finalFocus={() => !renaming} aria-label={`管理属性 ${name}`}><DropdownMenuItem onClick={() => renameLabel(key)}><Pencil />重命名</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : <span className="note-property-label text-muted-foreground"><Icon className="size-4" /><span className="truncate" title={name}>{name}</span></span>}</dt>;
  }
  async function apply(change:PropertyChange, keepOpen = false) {
    setError('');
    try { await onApply({...change,...(change.name !== 'tags' && data?.definitionHash ? {definitionHash:data.definitionHash} : {})}); if (!keepOpen) setEditing(null); setAdding(false); setRemoving(null); setRenaming(null); }
    catch (cause) { setError(errorMessage(cause)); throw cause; }
  }
  function duplicate(property:NoteProperty) {
    const names = new Set(data?.properties.map(item => item.name));
    let name = '', index = 1;
    do { const suffix = ` 副本${index === 1 ? '' : index}`; name = property.name.slice(0, 100 - suffix.length) + suffix; index++; } while (names.has(name));
    void apply({name,type:property.type as PropertyType,value:property.value,create:true,...(property.options ? {options:property.options} : {})}).catch(() => undefined);
  }
  function switchType(property:NoteProperty, type:PropertyType) {
    if (busy || loading || property.type === type) return;
    setError(''); setEditing(null); setAdding(false);
    void apply({...propertyTypeChange(property, type),definition:true}).catch(() => undefined);
  }
  const updated = noteTime(note?.updatedAt);
  const propertyTags = Array.isArray(data?.tagProperty?.value) ? [...new Set(data.tagProperty.value.map(tagKey))] : [];
  const mergedTags = [...new Set([...propertyTags, ...tags])];
  const tagBadges = mergedTags.length ? <TooltipProvider delay={300}>{mergedTags.map(tag => {
    const source = propertyTags.includes(tag) ? tags.includes(tag) ? '属性和正文均有' : '属性标签' : '正文标签';
    const descriptionId = `${tooltipId}-${encodeURIComponent(tag)}`;
    return <Tooltip key={tag}><TooltipTrigger aria-describedby={descriptionId} render={<TagPill name={tag} />} /><TooltipContent id={descriptionId} role="tooltip" className="animate-none">{source}</TooltipContent></Tooltip>;
  })}</TooltipProvider> : <span className="text-muted-foreground">暂无标签</span>;
  return <Collapsible open={open} onOpenChange={setOpen} aria-label="笔记属性" className="note-properties">
    <CollapsibleContent>
      <dl>
        <div className="note-property-row">{systemName('system:tags')}<dd className="min-w-0">{canEdit && data?.tagProperty?.editable ? <Popover open={editing === 'tags'} onOpenChange={(value,details) => { if (busy) { details.cancel(); return; } if (value) locatingTag.current = false; setEditing(value ? 'tags' : null); setAdding(false); setError(''); }}><PopoverTrigger render={<Button variant="ghost" className="note-property-edit note-property-tags w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label="编辑标签" />}>{tagBadges}</PopoverTrigger><PopoverContent align="start" className="note-property-popup note-tag-popup" aria-label="编辑标签" finalFocus={() => !locatingTag.current}><TagPropertyEditor onChangeTag={onChangeTag} tags={propertyTags} bodyTags={tags} busy={busy || loading} error={error} onSave={value => apply({name:'tags',type:'list',value}, true)} onLocateTag={onLocateTag ? tag => { locatingTag.current = true; setEditing(null); onLocateTag(tag); } : undefined} /></PopoverContent></Popover> : <div className="note-property-value note-property-tags">{tagBadges}{data?.tagProperty?.type === 'unsupported' && <span className="text-muted-foreground">属性标签 {display(data.tagProperty.value)} · 只读</span>}</div>}</dd></div>
        <div className="note-property-row">{systemName('system:updatedAt')}<dd className="note-property-value tabular-nums">{updated ? <time dateTime={note?.updatedAt}>{updated}</time> : note ? '未提供' : '尚未保存'}</dd></div>
        {[
          { key:'system:createdAt' as const, value:noteTime(note?.createdAt) ?? '未提供' },
          { key:'system:filename' as const, value:note ? relativePath?.split('/').pop() : '尚未保存' },
        ].map(({key,value}) => <div key={key} className="note-property-row">{systemName(key)}<dd className="note-property-value tabular-nums">{value}</dd></div>)}
        {data?.properties.map(property => {
          const {Icon} = propertyTypes[property.type];
          const name = label(`property:${property.name}`);
          const editable = property.editable && canEdit && !!note?.contentHash;
          const choice = property.type === 'select' || property.type === 'multiSelect';
          const choiceValues = Array.isArray(property.value) ? property.value : property.value ? [String(property.value)] : [];
          const value = choice ? choiceValues.length ? <span className="note-property-tags">{choiceValues.map(value => <ChoicePill key={value} name={value} options={property.options} />)}</span> : <span className="text-muted-foreground">空</span> : Array.isArray(property.value) ? property.value.length ? <span className="note-property-chips">{property.value.map((item,index) => <Badge key={index} variant="secondary" className="font-normal">{item}</Badge>)}</span> : <span className="text-muted-foreground">空</span> : property.value ? display(property.value) : <span className="text-muted-foreground">空</span>;
          return <div key={property.name} className="note-property-row">
            <dt className="min-w-0">{editable ? <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" className="note-property-label note-property-name text-muted-foreground" onFocus={event => { propertyTrigger.current = event.currentTarget; }} disabled={busy || loading || !labelData} aria-label={`属性菜单 ${name}`} />}><Icon /><span className="truncate" title={name}>{name}</span></DropdownMenuTrigger><DropdownMenuContent align="start" className="note-property-menu" finalFocus={() => !renaming && !removing && !editing} aria-label={`管理属性 ${name}`}>
              <DropdownMenuItem onClick={() => { renameLabel(`property:${property.name}`); }}><Pencil />重命名</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><SlidersHorizontal />类型<span className="flex-1 text-right text-xs text-muted-foreground">{propertyTypes[property.type].label}</span></DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="note-property-menu" aria-label={`属性类型 ${name}`}>
                  <DropdownMenuRadioGroup value={property.type} onValueChange={type => switchType(property, type as PropertyType)}>
                    {editableTypes.map(type => { const {Icon:TypeIcon,label} = propertyTypes[type]; return <DropdownMenuRadioItem key={type} value={type} closeOnClick disabled={busy || loading}><TypeIcon />{label}</DropdownMenuRadioItem>; })}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setError(''); duplicate(property); }}><Copy />创建属性副本</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setError(''); setRemoving(property); }}><Trash2 />删除属性</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu> : <span className="note-property-label text-muted-foreground"><Icon /><span className="truncate" title={name}>{name}</span></span>}</dt>
            <dd className="min-w-0">{editable ? property.type === 'checkbox' ? <div className="note-property-value"><Checkbox.Root render={<button type="button" />} nativeButton checked={property.value === true} onCheckedChange={checked => { void apply({name:property.name,type:'checkbox',value:checked}).catch(() => undefined); }} disabled={busy || loading} aria-label={`切换属性 ${name}`} className="note-property-checkbox"><Checkbox.Indicator>✓</Checkbox.Indicator></Checkbox.Root></div> : property.type === 'text' ? editing === property.name ? <PropertyForm inPlace property={property} error={error} busy={busy || loading} onSave={apply} onCancel={() => { setEditing(null); setError(''); }} /> : <Button variant="ghost" className="note-property-edit min-w-0 w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label={`编辑属性 ${name}`} onClick={() => { setEditing(property.name); setAdding(false); setError(''); }}>{value}</Button> : <Popover open={editing === property.name} onOpenChange={(value,details) => {
              if (value) { setEditing(property.name); setAdding(false); setError(''); }
              else if (busy) details.cancel();
              else if (choice) setEditing(null);
              else if (details.reason !== 'escape-key') { details.cancel(); formRef.current?.requestSubmit(); }
              else setEditing(null);
            }}><PopoverTrigger render={<Button variant="ghost" className="note-property-edit min-w-0 w-full justify-start whitespace-normal text-left font-normal" disabled={busy || loading} aria-label={`编辑属性 ${name}`} />}>{value}</PopoverTrigger><PopoverContent align="start" aria-label={`编辑属性 ${name}`} className={choice ? 'note-property-popup note-tag-popup' : property.type === 'date' ? 'note-property-popup note-date-popup' : 'note-property-popup'}>{choice ? <ChoicePropertyEditor property={property} error={error} busy={busy || loading} onSave={apply} /> : <PropertyForm property={property} formRef={formRef} error={error} busy={busy || loading} onSave={apply} onCancel={() => { setEditing(null); setError(''); }} />}</PopoverContent></Popover> : <div className="note-property-value text-muted-foreground" title={property.editable ? undefined : "此属性暂不支持编辑"}>{property.type === 'checkbox' && property.editable ? <input type="checkbox" checked={property.value === true} disabled aria-label={`切换属性 ${name}`} className="note-property-checkbox" /> : value} {!property.editable && <span className="text-xs">只读</span>}</div>}</dd>
          </div>;
        })}
      </dl>
      {canEdit && <div className="py-1">
        {!note && <p className="text-sm text-muted-foreground">填写标题或正文并保存后，可编辑属性。</p>}
        {note && data && !data.writable && <p className="text-sm text-muted-foreground">高级 YAML 语法请在源文件中编辑。</p>}
        <Popover open={adding} onOpenChange={value => { if (!busy) { setAdding(value); setEditing(null); setError(''); } }}><PopoverTrigger render={<Button variant="ghost" size="sm" className="note-property-action text-muted-foreground" disabled={!note || !data?.writable || busy || loading} />}><Plus className="size-4" />添加属性</PopoverTrigger><PopoverContent align="start" aria-label="添加属性" className="note-property-popup note-property-create-popup"><PropertyCreator error={error} busy={busy || loading} onSave={apply} /></PopoverContent></Popover>
        {error && !editing && !adding && !removing && !renaming && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </div>}
    </CollapsibleContent>
    <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="note-property-action text-muted-foreground" />}><span className="flex size-4 shrink-0 items-center justify-center">{open ? <ChevronUp /> : <ChevronDown />}</span>属性</CollapsibleTrigger>
    {renaming && <NameEditor initialName={renaming.name} anchor={renaming.anchor} side="bottom" align="start" sideOffset={4} className="w-80" title="重命名属性" inputLabel="新属性名" maxLength={100} selectOnFocus busy={busy} onSave={saveLabel} onClose={() => { setRenaming(null); setError(''); }} />}
    <AlertDialog.Root open={Boolean(removing)} onOpenChange={value => { if (!busy && !value) setRemoving(null); }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className="note-property-backdrop" /><AlertDialog.Popup className="note-property-confirm shadow-lg"><AlertDialog.Title className="font-semibold">删除属性「{removing ? label(`property:${removing.name}`) : ''}」？</AlertDialog.Title><AlertDialog.Description className="mt-2 break-words text-sm text-muted-foreground">此属性及其值将从笔记中移除：{removing ? display(removing.value) : ''}</AlertDialog.Description><div className="note-property-confirm-actions"><AlertDialog.Close render={<Button variant="outline" disabled={busy} />}>取消</AlertDialog.Close><Button variant="outline" disabled={busy} onClick={() => { if (removing) void apply({name:removing.name,remove:true}).catch(() => undefined); }}>确认删除</Button></div>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</AlertDialog.Popup></AlertDialog.Portal>
    </AlertDialog.Root>
  </Collapsible>;
}
