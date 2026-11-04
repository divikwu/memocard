import type { PropertyOption } from "@memocard/contracts";

export function ChoicePill({name, options}: {name:string; options?:PropertyOption[]}) {
  const color = options?.find(option => option.name === name)?.color ?? 'default';
  return <span className={`note-tag-pill note-tag-color-${color}`}>{name}</span>;
}
