import type { ReactNode } from "react";
import { Skeleton } from "../components/skeleton";
import "./TagsPageLayout.css";

export function TagChipsLoading() {
  return <div role="status" aria-label="正在读取标签" className="grid gap-2 p-2">
    <span className="sr-only">正在读取标签…</span>
    <div aria-hidden="true" className="grid gap-2">
      <Skeleton className="h-4 w-14" />
      <div className="flex flex-wrap gap-2"><Skeleton className="h-element-sm w-20" /><Skeleton className="h-element-sm w-24" /><Skeleton className="h-element-sm w-16" /></div>
    </div>
  </div>;
}

export function TagsLoading({ heading, minimal }: { heading?: ReactNode; minimal: boolean }) {
  const tools = <div className="ui-tag-directory-search-actions justify-end" aria-hidden="true"><Skeleton className="h-element-md w-40 max-w-full" /><Skeleton className="h-element-md w-16" /></div>;
  return <div className="ui-tag-directory" data-slot="tags-skeleton">
    {(heading || !minimal) && <div className={heading ? "ui-tag-directory-toolbar web-collection-heading" : "ui-tag-directory-toolbar"}>
      {heading}{!minimal && tools}
    </div>}
    <div className="ui-tag-directory-tabs flex flex-col">
      <div className="ui-tag-directory-tab-header" aria-hidden="true">
        {minimal ? <><div className="flex gap-2"><Skeleton className="h-element-md w-16" /><Skeleton className="h-element-md w-24" /></div>{tools}</> : <Skeleton className="h-element-md w-full rounded-full" />}
      </div>
      <div className="ui-tag-directory-panel"><TagChipsLoading /></div>
    </div>
  </div>;
}
