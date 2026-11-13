import { Suspense, useRef, useState } from "react";
import type { NoteFilterCounts, NoteQuickFilter } from "@memocard/contracts";
import { HugeiconsIcon } from "@hugeicons/react";
import FilterHorizontalIcon from "@hugeicons/core-free-icons/FilterHorizontalIcon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import { Button } from "../components/button";
import { recoverableLazy } from "../components/recoverable-lazy";
import type { DirectoryTag } from "./TagDirectoryList";

const NoteCollectionFilterDrawer = recoverableLazy(() => import("./NoteCollectionFilterDrawer"), "笔记筛选");

export type NoteCollectionFiltersProps = {
  tags: DirectoryTag[];
  tagsLoading?: boolean;
  vaultId?: string | null;
  activeTags: string[];
  quickFilters: NoteQuickFilter[];
  filterCounts?: NoteFilterCounts;
  disabled?: boolean;
  onChange: (tags: string[], filters: NoteQuickFilter[]) => void;
};

export function NoteCollectionFilters(props: NoteCollectionFiltersProps) {
  const [open, setOpen] = useState<boolean | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const count = props.activeTags.length + props.quickFilters.length;
  return <>
    <div className="ui-note-filter-control relative inline-flex shrink-0">
    <Button ref={trigger} variant="secondary" disabled={props.disabled} aria-haspopup="dialog" aria-expanded={Boolean(open)} onClick={() => setOpen(true)}
      aria-label={count ? `筛选笔记，已选 ${count} 项` : "筛选笔记"} className={`ui-note-filter-trigger rounded-full data-[active]:bg-surface${count > 0 ? " md:pr-9" : ""}`} data-active={count > 0 || undefined}>
      <HugeiconsIcon icon={FilterHorizontalIcon} aria-hidden="true" strokeWidth={2} />筛选{count > 0 && <span className="text-xs tabular-nums">{count}</span>}
    </Button>
    {count > 0 && <Button variant="ghost" size="icon-xs" disabled={props.disabled} aria-label="清除所有筛选" className="absolute inset-y-0 right-1.5 my-auto hidden text-secondary md:inline-flex"
      onClick={() => { props.onChange([], []); trigger.current?.focus(); }}>
      <HugeiconsIcon icon={Cancel01Icon} aria-hidden="true" strokeWidth={2} />
    </Button>}
    </div>
    {open !== null && <Suspense fallback={<span role="status" className="sr-only">正在打开筛选…</span>}>
      <NoteCollectionFilterDrawer {...props} open={open} onOpenChange={setOpen} finalFocus={trigger} />
    </Suspense>}
  </>;
}
