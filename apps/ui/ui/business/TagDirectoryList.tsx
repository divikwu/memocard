import { useMemo, type ReactNode } from "react";
import { Button } from "../components/button";
import "./TagDirectoryList.css";

export type DirectoryTag = { name: string; count: number };

export function TagDirectoryList({ tags, renderTag, className = "" }: { className?: string; tags: DirectoryTag[]; renderTag: (tag: DirectoryTag, initial: string) => ReactNode }) {
  const groups = useMemo(() => {
    const grouped = new Map<string, DirectoryTag[]>();
    for (const tag of [...tags].sort((a, b) => a.name.localeCompare(b.name))) {
      const initial = tag.name.normalize("NFD").charAt(0).toUpperCase();
      const group = /^[0-9A-Z]$/.test(initial) ? initial : "其他";
      const entries = grouped.get(group);
      if (entries) entries.push(tag);
      else grouped.set(group, [tag]);
    }
    return [...grouped].sort(([a], [b]) => a === "其他" ? 1 : b === "其他" ? -1 : a.localeCompare(b));
  }, [tags]);
  return <div className={`ui-tag-directory-groups ${className}`}>
    {groups.map(([initial, entries]) => <div key={initial} className="ui-tag-directory-group">
      <h2>{initial}</h2>
      <ul role="list" aria-label={initial}>
        {entries.map(tag => <li key={tag.name} data-tag={encodeURIComponent(tag.name)}>{renderTag(tag, initial)}</li>)}
      </ul>
    </div>)}
  </div>;
}

export function TagDirectoryChip({ tag, icon, disabled, onSelect }: {
  tag: DirectoryTag; icon: ReactNode; disabled?: boolean; onSelect: () => void;
}) {
  return <Button variant="secondary" className="ui-tag-directory-chip" data-tag-path={tag.name} aria-label={`查看标签 ${tag.name} 的笔记`}
    aria-description={`${tag.count} 条笔记`} disabled={disabled} onClick={onSelect}>
    {icon}
    <span className="ui-tag-directory-chip-name" title={tag.name}>{tag.name}</span>
    <span className="ui-tag-directory-chip-count" aria-hidden="true">{tag.count}</span>
  </Button>;
}
