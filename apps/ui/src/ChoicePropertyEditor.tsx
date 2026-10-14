import { useEffect, useRef, useState } from 'react';
import type { NoteProperty, PropertyChange, PropertyOption } from '@memocard/contracts';
import { Combobox } from '@base-ui/react/combobox';
import { X } from 'lucide-react';
import PropertyOptionList from './PropertyOptionList';
import PropertyOptionMenu from './PropertyOptionMenu';

function normalizeOptionName(value:string) {
  const name = value.trim();
  return name.length > 0 && name.length <= 100 && ![...name].some(character => character.charCodeAt(0) < 32) ? name : null;
}

export function ChoicePill({name, options}: {name:string; options?:PropertyOption[]}) {
  const color = options?.find(option => option.name === name)?.color ?? 'default';
  return <span className={`note-tag-pill note-tag-color-${color}`}>{name}</span>;
}
export default function ChoicePropertyEditor({property, busy, error, onSave}: {property:NoteProperty; busy:boolean; error:string; onSave:(change:PropertyChange, keepOpen?:boolean)=>Promise<void>}) {
  const multiple = property.type === 'multiSelect';
  const [options, setOptions] = useState(property.options ?? []);
  const [selected, setSelected] = useState(Array.isArray(property.value) ? property.value : property.value ? [String(property.value)] : []);
  const propertyKey = JSON.stringify([property.value, property.options]);
  const propertyRevision = useRef({ key: propertyKey, revision: 0 });
  if (propertyRevision.current.key !== propertyKey) propertyRevision.current = { key: propertyKey, revision: propertyRevision.current.revision + 1 };
  useEffect(() => {
    const [value, options] = JSON.parse(propertyKey);
    setSelected(Array.isArray(value) ? value : value ? [String(value)] : []);
    setOptions(options ?? []);
  }, [propertyKey]);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const name = query.trim();
  const valid = normalizeOptionName(name) !== null;
  const create = valid && options.length < 200 && !options.some(option => option.name === name) ? name : null;
  const candidates = options.filter(option => option.name.toLocaleLowerCase().includes(name.toLocaleLowerCase())).map(option => option.name);
  if (create) candidates.push(create);
  const disabled = busy || pending;
  async function save(next:string[], nextOptions = options, keepOpen = multiple, optionRename?:{from:string;to:string}) {
    if (disabled || saving.current) return false;
    saving.current = true; setPending(true);
    const revision = propertyRevision.current.revision;
    try {
      await onSave({name:property.name,type:multiple ? 'multiSelect' : 'select',value:multiple ? next : next[0] ?? '',options:nextOptions,...(JSON.stringify(nextOptions) !== JSON.stringify(options) ? {definition:true} : {}),...(optionRename ? {optionRename} : {})}, keepOpen);
      if (revision === propertyRevision.current.revision) { setSelected(next); setOptions(nextOptions); input.current?.focus(); }
      setQuery('');
      return true;
    } catch { return false; /* Preserve input and selection; the parent displays the error. */ }
    finally { saving.current = false; setPending(false); }
  }
  return <div className="note-tag-editor" data-empty={candidates.length === 0 && !name ? '' : undefined} aria-busy={pending}>
    <Combobox.Root multiple inline open autoHighlight items={candidates} filter={null} value={selected} inputValue={query} readOnly={disabled}
      onInputValueChange={(value,details) => { if (details.reason === 'input-change') setQuery(value); else details.cancel(); }}
      onValueChange={(next,details) => {
        if (disabled || saving.current || (details.event instanceof KeyboardEvent && (details.event.isComposing || details.event.repeat))) { details.cancel(); return; }
        const added = next.find(value => !selected.includes(value));
        const selection = multiple ? next : added ? [added] : [];
        const nextOptions = added === create ? [...options,{name:added,color:'default' as const}] : options;
        void save(selection,nextOptions);
      }}>
      <Combobox.Chips className="note-tag-input" aria-label="已选选项">
        <div className="note-tag-header"><div className="note-tag-selected" onClick={event => { if (event.target === event.currentTarget) input.current?.focus(); }}>
        {selected.map((value,index) => <Combobox.Chip key={`${index}:${value}`} className={`note-tag-chip note-tag-pill note-tag-color-${options.find(option => option.name === value)?.color ?? 'default'}`}>
          <span>{value}</span><Combobox.ChipRemove className="note-tag-remove" disabled={disabled} aria-label={`移除选项 ${value}`}><X className="size-3" /></Combobox.ChipRemove>
        </Combobox.Chip>)}
        <Combobox.Input ref={input} autoFocus aria-label="搜索或创建选项" placeholder={selected.length ? '' : '搜索或创建选项…'} className="note-tag-search" onKeyDownCapture={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); } }} />
        </div></div>
      </Combobox.Chips>
      <p className="note-tag-hint text-xs text-muted-foreground">选择或创建{multiple ? '多个选项' : '一个选项'}</p>
      <PropertyOptionList label="可选选项" count={candidates.length} multiple={multiple}>
        {(value:string) => <div key={value} className="note-tag-option-row">
          <Combobox.Item value={value} disabled={disabled} className="note-tag-option" aria-label={value === create ? `创建选项 ${value}` : `选项 ${value}`}>
            {value === create && <span className="text-muted-foreground">创建</span>}<ChoicePill name={value} options={options} />
          </Combobox.Item>
          {value !== create && <PropertyOptionMenu name={value} kind="选项" color={options.find(option => option.name === value)?.color ?? 'default'} disabled={disabled} normalizeName={normalizeOptionName}
            onChangeName={async (from,to) => {
              if (to !== null && options.some(option => option.name === to && option.name !== from)) throw new Error('同名选项已存在。');
              const nextOptions = to === null ? options.filter(option => option.name !== from) : options.map(option => option.name === from ? {...option,name:to} : option);
              const next = selected.flatMap(name => name !== from ? [name] : to === null ? [] : [to]);
              if (!await save(next,nextOptions,true,to !== null ? {from,to} : undefined)) throw new Error('无法更新选项，请重试。');
            }}
            onChangeColor={async color => {
              if (!await save(selected,options.map(option => option.name === value ? {...option,color} : option),true)) throw new Error('无法保存选项颜色，请重试。');
            }}
            deleteDescription={`将从库内所有「${property.name}」属性中删除此选项及对应已选值，其他属性和标签保留。`} /> }
        </div>}
      </PropertyOptionList>
      {!candidates.length && name && <p className="note-tag-hint text-xs text-muted-foreground">没有匹配的选项，名称最多 100 个字。</p>}
    </Combobox.Root>
    {error && <p role="alert" className="px-3 pb-2 text-sm text-destructive">{error}</p>}
  </div>;
}
