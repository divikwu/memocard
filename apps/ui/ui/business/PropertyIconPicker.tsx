import { useLayoutEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { errorMessage } from "../../src/bridge";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { useIsMobile } from "../../src/hooks/use-mobile";
import { propertyIconGroups } from "./property-icon-catalog";
import "./note-properties.css";

export function useIconPickerScroll(contentKey: string | number) {
  const scroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const updateEdges = () => {
      element.toggleAttribute("data-overflow-top", element.scrollTop > 1);
      element.toggleAttribute("data-overflow-bottom", element.scrollTop + element.clientHeight < element.scrollHeight - 1);
    };
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    element.addEventListener("scroll", updateEdges, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", updateEdges); };
  }, [contentKey]);
  return scroll;
}

export function PropertyIconPicker({ id, selected, ready, readError, disabled, onRetry, onSave, onSelect }: {
  id: string;
  selected?: string;
  ready: boolean;
  readError?: string;
  disabled: boolean;
  onRetry: () => void;
  onSave: (value: string) => Promise<void>;
  onSelect: () => void;
}) {
  const mobile = useIsMobile();
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function save(value: string) {
    if (submitting.current || disabled) return;
    submitting.current = true;
    setError("");
    try { await onSave(value); onSelect(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { submitting.current = false; }
  }

  return <section id={id} aria-label="属性图标选项" className="note-property-icon-picker">
    {!ready ? readError
      ? <div role="alert"><p>{readError}</p><Button variant="ghost" onClick={onRetry}>重试</Button></div>
      : <p role="status" className="text-secondary">正在读取图标设置…</p>
      : <>
        <IconOptions selected={selected} disabled={disabled} autoFocus={!mobile} onSelect={value => void save(value)} />
        {error && <p role="alert" className="text-error">{error}</p>}
      </>}
  </section>;
}

export function IconOptions({ selected, disabled, onSelect, autoFocus, query: sharedQuery }: {
  selected?: string; disabled: boolean; onSelect: (value: string) => void; autoFocus?: boolean; query?: string;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const query = sharedQuery ?? localQuery;
  const needle = query.trim().toLowerCase();
  const results = useIconPickerScroll(needle);
  const groups = Object.entries(propertyIconGroups).map(([group, items]) =>
    [group, items.filter(([name, label]) => name.includes(needle) || label.includes(needle))] as const
  ).filter(([, items]) => items.length > 0);

  return <div className="note-property-icon-options flex flex-col gap-2">
    {sharedQuery === undefined && <Input className="px-2" autoFocus={autoFocus} disabled={disabled} aria-label="搜索图标" placeholder="搜索图标" value={query} onChange={event => setLocalQuery(event.target.value)} />}
    <div ref={results} className="note-property-icon-results icon-picker-scroll-fade">
      {groups.map(([group, items]) => <div key={group} role="group" aria-label={group}>
        <p className="p-2 text-xs text-secondary">{group}</p>
        <div className="note-property-icon-grid">{items.map(([name, label, icon]) => {
          const value = `icon:${name}`;
          return <Button key={name} type="button" size="icon-sm" variant="ghost" aria-label={label} aria-pressed={selected === value} data-ui-tooltip={label} disabled={disabled} onClick={() => onSelect(value)}>
            <HugeiconsIcon icon={icon} size={18} strokeWidth={2} aria-hidden="true" />
          </Button>;
        })}</div>
      </div>)}
      {!groups.length && <p role="status" className="px-1 py-2 text-secondary">没有匹配的图标</p>}
    </div>
  </div>;

}
