import type { ComponentType } from 'react';

export function PropertyOptionsLoading({ label, Skeleton }: { label:string; Skeleton:ComponentType<{className?:string}> }) {
  return <div role="status" aria-label={label} className="note-tag-loading">
    <span className="sr-only">{label}</span>
    {["w-2/3", "w-1/2", "w-3/4"].map(width => <div key={width} className="note-tag-loading-row" aria-hidden="true"><Skeleton className={`h-5 ${width}`} /></div>)}
  </div>;
}
