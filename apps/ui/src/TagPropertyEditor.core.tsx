import type { ComponentType, ComponentProps, SVGProps } from "react";
import PropertyOptionList from './PropertyOptionList';
import { useEffect, useId, useRef, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { cn } from '@/lib/utils';
import { request, errorMessage } from './bridge';
import { normalizePropertyTag, tagKey } from './inline-tags';

type View = {
  TagColorMenu: ComponentType<ComponentProps<typeof import("@ui-next/business/property-editors")["TagColorMenu"]>>;
  X: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Button: ComponentType<Omit<ComponentProps<typeof import("@ui-next/components/button")["Button"]>, "render">>;
  TagPill: ComponentType<Omit<ComponentProps<typeof import("@ui-next/business/property-editors")["TagPill"]>, "variant" | "render">>;
  Tooltip: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["Tooltip"]>>;
  TooltipContent: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["TooltipContent"]>>;
  TooltipProvider: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["TooltipProvider"]>>;
  TooltipTrigger: ComponentType<ComponentProps<typeof import("@ui-next/components/tooltip")["TooltipTrigger"]>>;
};

export function createTagPropertyEditor(view: View) {
  const { TagColorMenu, X, Button, TagPill, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = view;
function TagPropertyEditor({ tags: propertyValues, bodyTags: bodyValues = [], busy, error, onSave, onLocateTag, onChangeTag }: { tags:string[]; bodyTags?:string[]; busy:boolean; error:string; onSave:(tags:string[])=>Promise<void>; onLocateTag?:(tag:string)=>void; onChangeTag?:(from:string,to:string | null)=>Promise<void> }) {
  const tags = [...new Set(propertyValues.map(tagKey))];
  const bodyTags = [...new Set(bodyValues.map(tagKey))];
  const tooltipId = useId();
  const [selected, setSelected] = useState(tags);
  const propertyKey = JSON.stringify(tags);
  const propertyRevision = useRef({ key: propertyKey, revision: 0 });
  if (propertyRevision.current.key !== propertyKey) propertyRevision.current = { key: propertyKey, revision: propertyRevision.current.revision + 1 };
  useEffect(() => { setSelected(JSON.parse(propertyKey)); }, [propertyKey]);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [suggestionError, setSuggestionError] = useState('');
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    void request<{tags:{name:string}[]}>('listTags').then(result => { if (active) setOptions(result.tags.map(tag => tagKey(tag.name))); }).catch(cause => { if (active) setSuggestionError(errorMessage(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const normalized = normalizePropertyTag(query);
  const search = tagKey(query.trim().replace(/^#/, ''));
  const known = [...new Set([...selected, ...bodyTags, ...options])];
  const matches = known.filter(tag => !bodyTags.includes(tag) && !selected.includes(tag) && tag.includes(search));
  const create = !loading && !suggestionError && normalized && !known.includes(normalized) ? normalized : null;
  const candidates = create ? [...matches, create] : matches;
  const bodyOnly = [...new Set(bodyTags)].filter(tag => !selected.includes(tag));
  const disabled = busy || pending;
  async function save(next:string[]) {
    if (disabled || saving.current) return;
    saving.current = true; setPending(true);
    const revision = propertyRevision.current.revision;
    try {
      await onSave(next);
      if (revision === propertyRevision.current.revision) { setSelected(next); input.current?.focus(); }
      setOptions(previous => [...new Set([...previous, ...next])]);
      if (next.length > selected.length) setQuery('');
    }
    catch { /* The parent keeps the error and input visible. */ }
    finally { saving.current = false; setPending(false); }
  }
  function tagLink(tag:string, shared = false) {
    const descriptionId = `${tooltipId}-${encodeURIComponent(tag)}`;
    return <Tooltip><TooltipTrigger aria-describedby={descriptionId} render={<Button type="button" variant="ghost" size="sm" className={cn('h-5 shrink text-sm font-normal whitespace-normal', shared ? 'min-w-0 px-0' : 'note-tag-chip note-tag-pill')} disabled={disabled} data-tag={encodeURIComponent(tag)} aria-label={`定位正文标签 ${tag}`} onClick={() => onLocateTag?.(tag)} onKeyDown={event => { if (shared && (event.key === 'Enter' || event.key === ' ')) event.stopPropagation(); }} />}>{tag}</TooltipTrigger><TooltipContent id={descriptionId} role="tooltip" sideOffset={6} className="animate-none">{shared ? '属性和正文均有，点击定位' : '正文标签，点击定位'}</TooltipContent></Tooltip>;
  }
  return <TooltipProvider delay={300}><div className="note-tag-editor" aria-busy={pending}>
    <Combobox.Root multiple inline open autoHighlight items={candidates} filter={null} value={selected} inputValue={query} readOnly={disabled}
      onInputValueChange={(value, details) => { if (details.reason === 'input-change') setQuery(value); else details.cancel(); }}
      onValueChange={(next, details) => { if (disabled || saving.current || (details.event instanceof KeyboardEvent && (details.event.isComposing || details.event.repeat))) details.cancel(); else void save(next); }}>
      <Combobox.Chips className="note-tag-input" role="toolbar" aria-label="已选标签">
        <div className="note-tag-header"><div className="note-tag-selected" onClick={event => { if (event.target === event.currentTarget) input.current?.focus(); }}>
          {selected.map(tag => {
            const shared = bodyTags.includes(tag) && onLocateTag;
            const sourceId = `${tooltipId}-source-${encodeURIComponent(tag)}`;
            const removeId = `${tooltipId}-remove-${encodeURIComponent(tag)}`;
            const source = bodyTags.includes(tag) ? '属性和正文均有' : '属性标签，可移除';
            return <span key={tag} className="note-tag-selected-item"><Combobox.Chip data-tag={encodeURIComponent(tag)} className="note-tag-chip note-tag-pill" aria-description={source}>{shared ? tagLink(tag, true) : <Tooltip><TooltipTrigger aria-describedby={sourceId} render={<span />}>{tag}</TooltipTrigger><TooltipContent id={sourceId} role="tooltip" className="animate-none">{source}</TooltipContent></Tooltip>}<Tooltip><TooltipTrigger aria-describedby={removeId} render={<Combobox.ChipRemove className="note-tag-remove" aria-label={`移除属性标签 ${tag}`} disabled={disabled} />}><X className="size-3" /></TooltipTrigger><TooltipContent id={removeId} role="tooltip" className="animate-none">移除属性标签，保留正文标签</TooltipContent></Tooltip></Combobox.Chip></span>;
          })}
          {bodyOnly.map(tag => <span key={tag} className="note-tag-selected-item">{onLocateTag ? tagLink(tag) : <Tooltip><TooltipTrigger render={<span data-tag={encodeURIComponent(tag)} className="note-tag-chip note-tag-pill" />} aria-description="正文标签，请在正文中编辑">{tag}</TooltipTrigger><TooltipContent role="tooltip" className="animate-none">正文标签，请在正文中编辑</TooltipContent></Tooltip>}</span>)}
          <Combobox.Input ref={input} autoFocus className="note-tag-search" aria-label="搜索或新建属性标签" aria-describedby={`${tooltipId}-search-hint`} onKeyDownCapture={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); } }} />
        </div></div>
      </Combobox.Chips>
      <p id={`${tooltipId}-search-hint`} className="note-tag-hint text-xs text-secondary">选择或创建</p>
      <PropertyOptionList label="可选属性标签" count={candidates.length}>
        {(tag:string) => {
          const item = <Combobox.Item key={tag} value={tag} disabled={disabled} data-tag={encodeURIComponent(tag)} className="note-tag-option" aria-label={tag === create ? `新建标签 ${tag}` : `属性标签 ${tag}`}>
            {tag === create && <span>新建</span>}
            <TagPill name={tag} className="min-w-0 shrink" />
          </Combobox.Item>;
          return <div key={tag} className="note-tag-option-row">{item}{tag !== create && <TagColorMenu tag={tag} disabled={disabled} onChangeTag={onChangeTag ? async (from, to) => { try { await onChangeTag(from, to); } finally { setRevision(value => value + 1); } } : undefined} />}</div>;
        }}
      </PropertyOptionList>
      {!candidates.length && <p className="text-xs text-secondary">{loading ? '正在加载标签…' : query.trim() ? normalized ? '没有匹配的标签' : '标签不能包含空格或纯数字，可用 / 分层。' : known.length ? '没有其他标签，输入名称可新建。' : '输入名称，创建第一个标签。'}</p>}
    </Combobox.Root>
    {pending && <p role="status" className="text-xs text-secondary">正在保存标签…</p>}
    {(error || suggestionError) && <p role="alert" className="text-sm text-error">{error || suggestionError}</p>}
  </div></TooltipProvider>;
}

  return TagPropertyEditor;
}
