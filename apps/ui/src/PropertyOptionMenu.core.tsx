import type { ComponentType, ComponentProps, SVGProps } from "react";
import { useRef, useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { tagColors, type TagColor } from './tag-colors';
import { errorMessage } from './error-messages';

type View = {
  Check: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Hash: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  MoreHorizontal: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Trash2: ComponentType<Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number }>;
  Button: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/button")["Button"]>, "render">>;
  Input: ComponentType<ComponentProps<typeof import("@/components/ui/input")["Input"]>>;
  DropdownMenu: ComponentType<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenu"]>>;
  DropdownMenuTrigger: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenuTrigger"]>, "ref">>;
  DropdownMenuContent: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenuContent"]>, "ref">>;
  DropdownMenuItem: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenuItem"]>, "ref">>;
  DropdownMenuGroup: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenuGroup"]>, "ref">>;
  DropdownMenuLabel: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenuLabel"]>, "ref">>;
  DropdownMenuRadioGroup: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenuRadioGroup"]>, "ref">>;
  DropdownMenuSeparator: ComponentType<Omit<ComponentProps<typeof import("@/components/ui/dropdown-menu")["DropdownMenuSeparator"]>, "ref">>;
  TagPill: ComponentType<Omit<ComponentProps<typeof import("./TagPill")["default"]>, "variant" | "render">>;
};

export function createPropertyOptionMenu(view: View) {
  const { Check, Hash, MoreHorizontal, Trash2, Button, Input, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuSeparator, TagPill } = view;
type PropertyOptionMenuProps = {
  name:string;
  kind:'标签' | '选项';
  color:TagColor;
  disabled:boolean;
  normalizeName:(name:string)=>string | null;
  onChangeName?:(from:string,to:string | null)=>Promise<void>;
  onChangeColor:(color:TagColor)=>void | Promise<void>;
  deleteDescription:string;
};

function PropertyOptionMenu({name:tag, kind, color, disabled, normalizeName, onChangeName, onChangeColor, deleteDescription}:PropertyOptionMenuProps) {
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(tag);
  const [removing, setRemoving] = useState(false);
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  const normalized = normalizeName(name);
  async function change(to:string | null) {
    if (pending.current || disabled || !onChangeName) return;
    pending.current = true; setWorking(true); setError('');
    try { await onChangeName(tag, to); setOpen(false); setRemoving(false); }
    catch (cause) { setError(cause instanceof Error ? errorMessage(cause) : `无法更新${kind}，请重试。`); }
    finally { pending.current = false; setWorking(false); }
  }
  return <>
    <DropdownMenu modal={false} open={open} onOpenChange={(value, details) => {
      if (working) { details.cancel(); return; }
      setOpen(value);
      if (value) { setName(tag); setError(''); }
    }}>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" disabled={disabled || working} aria-label={onChangeName ? `管理${kind} ${tag}` : `设置${kind}颜色 ${tag}`} className="note-tag-color-trigger shrink-0" />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className={onChangeName ? 'note-property-option-menu w-56' : 'note-property-option-menu w-44'} aria-label={onChangeName ? `${kind}设置 ${tag}` : `${kind}颜色 ${tag}`}>
        {onChangeName ? <form className="px-2 py-1.5" onSubmit={event => { event.preventDefault(); if (normalized && normalized !== tag) void change(normalized); }}>
          <Input autoFocus aria-label={`${kind}名称`} value={name} disabled={disabled || working} className="h-8 min-w-0 text-sm" onChange={event => setName(event.target.value)} onFocus={event => event.target.select()} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); if (event.key !== 'Escape') event.stopPropagation(); }} />
        </form> : <DropdownMenuGroup><DropdownMenuLabel className="truncate" title={tag}><TagPill name={tag} /></DropdownMenuLabel></DropdownMenuGroup>}
        {onChangeName && <><DropdownMenuItem disabled={disabled || working} onClick={() => { setError(''); setRemoving(true); }}><Trash2 />删除{kind}</DropdownMenuItem><DropdownMenuSeparator /></>}
        <DropdownMenuGroup><DropdownMenuLabel className="text-xs text-secondary">颜色</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={color} onValueChange={async value => {
          if (pending.current || disabled) return;
          pending.current = true; setWorking(true); setError('');
          try { await onChangeColor(value as TagColor); setOpen(false); }
          catch (cause) { setError(cause instanceof Error ? errorMessage(cause) : `无法保存${kind}颜色，请重试。`); }
          finally { pending.current = false; setWorking(false); }
        }}>
          {tagColors.map(([id, label]) => <Menu.RadioItem key={id} value={id} disabled={disabled || working} closeOnClick={false} className={`note-tag-color-option note-tag-color-${id}`}><span aria-hidden="true" className="note-tag-color-swatch"><Hash className="size-3" /></span><span className="flex-1">{label}</span><Menu.RadioItemIndicator className="note-tag-color-check ml-auto flex size-4 shrink-0 items-center justify-center"><Check aria-hidden="true" className="size-4" /></Menu.RadioItemIndicator></Menu.RadioItem>)}
        </DropdownMenuRadioGroup></DropdownMenuGroup>
        {working && <p role="status" className="px-2 py-1 text-xs text-secondary">正在更新{kind}…</p>}
        {error && <p role="alert" className="px-2 py-1 text-xs text-error">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog.Root open={removing} onOpenChange={value => { if (!working) setRemoving(value); }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className="note-property-backdrop bg-overlay backdrop-blur-sm" /><AlertDialog.Popup className="note-property-confirm shadow-lg"><AlertDialog.Title className="break-words font-semibold">删除{kind}「{tag}」？</AlertDialog.Title><AlertDialog.Description className="mt-2 text-sm text-secondary">{deleteDescription}</AlertDialog.Description>{error && <p role="alert" className="mt-2 break-words text-sm text-error">{error}</p>}<div className="note-property-confirm-actions"><AlertDialog.Close render={<Button variant="outline" size="sm" disabled={disabled || working} />}>取消</AlertDialog.Close><Button variant="outline" size="sm" className="text-error" disabled={disabled || working} onClick={() => void change(null)}>{working ? '正在删除…' : '确认删除'}</Button></div></AlertDialog.Popup></AlertDialog.Portal>
    </AlertDialog.Root>
  </>;
}

  return PropertyOptionMenu;
}
