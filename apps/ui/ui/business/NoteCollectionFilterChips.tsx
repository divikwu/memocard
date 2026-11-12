import type { ReactNode, Ref } from "react";
import { Button } from "../components/button";
import { TabsList, TabsTrigger } from "../components/tabs";
import { SidebarIcon } from "./sidebar-icons";
import { workspaceFilters } from "./navigation-model";
import type { NoteCollectionFiltersProps } from "./NoteCollectionFilters";

export function NoteTypeFilters({ activeTags, quickFilters, filterCounts, disabled, onChange }: Pick<NoteCollectionFiltersProps, "activeTags" | "quickFilters" | "filterCounts" | "disabled" | "onChange">) {
  return <div role="group" aria-label="类型" className="flex flex-wrap gap-2">
    <FilterChip label="全部类型" icon={<SidebarIcon name="layers" />} selected={quickFilters.length === 0} disabled={disabled} onSelect={() => onChange(activeTags, [])} />
    {workspaceFilters.map(filter => <FilterChip key={filter.id} label={filter.label} icon={<SidebarIcon name={filter.icon} />} count={filterCounts?.[filter.id]}
      description={filterCounts ? `全库 ${filterCounts[filter.id]} 条笔记` : undefined} selected={quickFilters.includes(filter.id)} disabled={disabled}
      onSelect={() => onChange(activeTags, [filter.id])} />)}
  </div>;
}

export function FilterChip({ label, icon, count, ariaLabel = label, description, selected, disabled, onSelect }: {
  label: string; icon: ReactNode; count?: number; ariaLabel?: string; description?: string;
  selected: boolean; disabled?: boolean; onSelect: () => void;
}) {
  return <Button variant="outline" className="group/filter-chip min-w-0 max-w-full bg-popover font-normal aria-pressed:bg-muted"
    aria-label={ariaLabel} aria-description={description} aria-pressed={selected} disabled={disabled} onClick={onSelect}>
    <span className="flex shrink-0 items-center text-secondary group-aria-pressed/filter-chip:text-primary">{icon}</span>
    <span className="truncate group-aria-pressed/filter-chip:font-medium" title={label}>{label}</span>
    {count !== undefined && <span className="shrink-0 text-secondary tabular-nums" aria-hidden="true">{count}</span>}
  </Button>;
}

export function NoteTypeTabs({ disabled, scrollerRef }: Pick<NoteCollectionFiltersProps, "disabled"> & { scrollerRef: Ref<HTMLDivElement> }) {
  const options = [{ id: "all", label: "全部类型", icon: "layers" as const }, ...workspaceFilters];
  return <TabsList ref={scrollerRef} variant="pill" activateOnFocus aria-label="类型" data-transparent-inactive
    className="ui-note-recent-tags gap-2 justify-start">
    {options.map(option => <TabsTrigger key={option.id} value={option.id} disabled={disabled} aria-label={option.label}
      className="group/type-tab flex-none gap-1.5 bg-control font-normal text-primary hover:bg-[color-mix(in_oklch,var(--color-background-control),var(--color-text-primary)_5%)] data-active:bg-surface data-active:font-medium data-active:hover:bg-surface">
      <span className="text-secondary group-data-active/type-tab:text-primary"><SidebarIcon name={option.icon} /></span>
      {option.label}
    </TabsTrigger>)}
  </TabsList>;
}
