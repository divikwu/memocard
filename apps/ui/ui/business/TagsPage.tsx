import { Fragment, Suspense, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import { useIsMobile } from "../hooks/use-mobile";
import { recoverableLazy } from "../components/recoverable-lazy";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { indexTags } from "../../src/components/tag-tree-index";
import { tagKey } from "../../src/inline-tags";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/table";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/empty";
import { Skeleton } from "../components/skeleton";
import { SidebarIcon } from "./sidebar-icons";
import { TreeRow } from "./sidebar-tree-item";
import { TagIcon } from "./property-icon-catalog";
import "./TagsPage.css";

const TagEditor = recoverableLazy(() => import("./tag-navigation-editor").then(module => ({ default: module.TagEditor })), "标签编辑");

const rowId = (path: string) => `tag-directory-${Array.from(path, char => char.codePointAt(0)!.toString(16)).join("-")}`;

type Tag = { name: string; count: number };
type TagsPageProps = {
  tags: Tag[];
  vaultId?: string | null;
  loading: boolean;
  connected: boolean;
  disabled: boolean;
  canRename: boolean;
  onSelect: (path: string) => void;
  onRename: (from: string, to: string) => Promise<void>;
};

export function TagsPage({ tags, vaultId, loading, connected, disabled, canRename, onSelect, onRename }: TagsPageProps) {
  const { preferences, error, togglePinned, saveAppearance } = useTagPreferences(vaultId);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mobile = useIsMobile();
  const [editing, setEditing] = useState<{path: string; anchor: HTMLElement; picker: boolean} | null>(null);
  const [pinning, setPinning] = useState(false);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const directory = useRef<HTMLElement>(null);
  const returnPath = useRef("");
  const index = useMemo(() => indexTags(tags), [tags]);
  const needle = query.trim().toLocaleLowerCase();
  const matches = useMemo(() => tags.filter(tag => tag.name.toLocaleLowerCase().includes(needle)), [tags, needle]);
  const isExpanded = (path: string) => expanded[path] ?? !path.includes("/");
  const branches = [...index.children.keys()];
  const allExpanded = branches.every(isExpanded);
  const edit = (path: string, anchor: HTMLElement, picker = false) => { returnPath.current = path; setEditing(current => current?.anchor === anchor ? null : {path, anchor, picker}); };
  useEffect(() => {
    if (focusPath === null) return;
    const target = [...directory.current?.querySelectorAll<HTMLButtonElement>("[data-tag-path]") ?? []].find(button => button.dataset.tagPath === focusPath);
    (target ?? search.current)?.focus();
    setFocusPath(null);
  }, [focusPath, tags]);
  const pin = async (path: string) => {
    setPinning(true);
    try { await togglePinned(path); }
    finally { setPinning(false); }
  };
  const row = (tag: Tag, depth = 0, flat = false, lastSibling = false): React.ReactNode => {
    const children = index.children.get(tag.name) ?? [];
    const open = isExpanded(tag.name);
    return <Fragment key={tag.name}>
      <TagRow tag={tag} depth={depth} lastSibling={lastSibling} icon={preferences.icons[tag.name]} pinned={preferences.pinned.includes(tag.name)} iconEditorOpen={editing?.path === tag.name && editing.picker} expanded={!flat && children.length ? open : undefined} childIds={open ? children.map(child => rowId(child.name)).join(" ") : undefined} flat={flat}
        disabled={disabled || !connected} pinDisabled={pinning} canRename={canRename}
        onToggle={() => setExpanded(current => ({...current, [tag.name]: !open}))} onSelect={() => onSelect(tag.name)} onPin={() => void pin(tag.name)} onEdit={(anchor, picker) => edit(tag.name, anchor, picker)}
        onRename={async (name, restoreFocus) => { await saveAppearance(tag.name, name, undefined, onRename); if (restoreFocus) setFocusPath(tagKey(name)); }} />
      {!flat && open && children.map((child, position) => row(child, depth + 1, false, position === children.length - 1))}
    </Fragment>;
  };
  return <section ref={directory} className="ui-tag-directory" aria-label="标签目录">
    <div className="ui-tag-directory-toolbar">
      <div className="ui-collection-search"><SidebarIcon name="search" className="ui-collection-search-icon" /><Input ref={search} value={query} aria-label="搜索标签" placeholder="搜索标签" className="ui-collection-search-input" onChange={event => setQuery(event.target.value)} />{query && <Button variant="ghost" size="icon-xs" className="ui-collection-search-clear" aria-label="清空标签搜索" onClick={() => { setQuery(""); search.current?.focus(); }}><SidebarIcon name="close" /></Button>}</div>
      <Button variant="outline" size="default" className="bg-surface text-primary dark:bg-surface" disabled={disabled || loading || !branches.length || Boolean(needle)} onClick={() => setExpanded(Object.fromEntries(branches.map(path => [path, !allExpanded])))}>{branches.length && allExpanded ? "全部收起" : "全部展开"}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <div className="ui-tag-directory-panel" aria-busy={loading}>
      {loading && !tags.length ? <div role="status" aria-label="正在读取标签" className="grid gap-2 p-2">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-8 rounded-xl" />)}</div>
        : matches.length ? <Table className="ui-tag-directory-table" aria-label={needle ? "标签搜索结果" : "标签层级"}>
          <colgroup><col /><col className="ui-tag-directory-count-column" /><col className="ui-tag-directory-actions-column" /></colgroup>
          <TableHeader><TreeRow render={<TableRow />}><TableHead scope="col" className="ui-tag-directory-label-heading">标签</TableHead><TableHead scope="col" className="ui-tag-directory-count-heading" data-ui-tooltip="包含子标签，按笔记去重">笔记数</TableHead><TableHead scope="col" className="ui-tag-directory-actions-heading">置顶</TableHead></TreeRow></TableHeader>
          <TableBody>{(needle ? matches : index.roots).map(tag => row(tag, 0, Boolean(needle)))}</TableBody>
        </Table>
        : <Empty><EmptyHeader><EmptyTitle>{!connected ? "连接笔记库后查看标签" : needle ? "没有找到相关标签" : "还没有标签"}</EmptyTitle><EmptyDescription>{!connected ? "从左上角选择笔记库。" : needle ? "换个关键词，或清空搜索。" : "在笔记中添加标签后，会显示在这里。"}</EmptyDescription></EmptyHeader>{needle && <EmptyContent><Button variant="outline" onClick={() => { setQuery(""); search.current?.focus(); }}>清空搜索</Button></EmptyContent>}</Empty>}
    </div>
    {editing && <Suspense fallback={null}><TagEditor key={editing.path} path={editing.path} anchor={editing.anchor} anchorIsTrigger={editing.picker} icon={preferences.icons[editing.path] ?? ""} mobile={mobile} initialPickerOpen={editing.picker} onClose={() => setEditing(null)} finalFocus={() => editing.anchor.isConnected ? editing.anchor : [...directory.current?.querySelectorAll<HTMLButtonElement>("[data-tag-path]") ?? []].find(button => button.dataset.tagPath === returnPath.current) ?? search.current ?? false}
      onSave={async (name, icon) => { await saveAppearance(editing.path, name, icon, onRename); returnPath.current = tagKey(name); }} /></Suspense>}
  </section>;
}

function TagRow({ tag, depth, lastSibling, icon, pinned, iconEditorOpen, expanded, childIds, flat, disabled, pinDisabled, canRename, onToggle, onSelect, onPin, onEdit, onRename }: {
  tag: Tag; depth: number; lastSibling: boolean; icon?: string; pinned: boolean; iconEditorOpen: boolean; expanded?: boolean; childIds?: string; flat: boolean; disabled: boolean; pinDisabled: boolean; canRename: boolean;
  onToggle: () => void; onSelect: () => void; onPin: () => void; onEdit: (anchor: HTMLElement, picker?: boolean) => void; onRename: (name: string, restoreFocus: boolean) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [restoreFocus, setRestoreFocus] = useState(false);
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const label = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const cancelled = useRef(false);
  const pointerDown = useRef(false);
  const pointerSubmit = useRef<(() => void) | null>(null);
  const separator = tag.name.lastIndexOf("/");
  const name = tag.name.slice(separator + 1);
  const cancel = (restoreFocus = true) => { if (!submitting.current) { cancelled.current = true; setRenaming(false); setError(""); setRestoreFocus(restoreFocus); } };
  useEffect(() => { if (restoreFocus && !renaming) { label.current?.focus(); setRestoreFocus(false); } }, [restoreFocus, renaming]);
  useEffect(() => { if (renaming) { input.current?.focus(); input.current?.select(); } }, [renaming]);
  useEffect(() => {
    if (!renaming) return;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(fallback);
      pointerDown.current = false;
      const submit = pointerSubmit.current;
      pointerSubmit.current = null;
      submit?.();
    };
    const down = () => { pointerDown.current = true; };
    const up = () => { pointerDown.current = false; fallback = setTimeout(finish, 0); };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("click", finish, true);
    document.addEventListener("pointercancel", finish, true);
    window.addEventListener("blur", finish);
    return () => {
      clearTimeout(fallback); pointerSubmit.current = null;
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("click", finish, true);
      document.removeEventListener("pointercancel", finish, true);
      window.removeEventListener("blur", finish);
    };
  }, [renaming]);
  const save = async (restoreFocus = false) => {
    if (submitting.current || cancelled.current) return;
    const value = draft.trim();
    if (!value || value.includes("/")) { setError(!value ? "请输入标签名称" : "名称不能包含 /，可点击标签图标编辑完整路径"); input.current?.focus(); return; }
    if (value === name) { cancel(restoreFocus); return; }
    submitting.current = true; setSaving(true); setError("");
    try { await onRename(tag.name.slice(0, separator + 1) + value, restoreFocus); setRenaming(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请重试"); }
    finally { submitting.current = false; setSaving(false); }
  };
  return <>
    <TreeRow render={<TableRow />} id={rowId(tag.name)} className="ui-tag-directory-row" data-flat={flat || undefined} aria-busy={saving || undefined}>
      <TableCell><div className="ui-tag-directory-label" style={{"--tag-depth": depth} as CSSProperties}>
        {depth > 0 && <span className="ui-tag-directory-guide" data-end={lastSibling || undefined} aria-hidden="true" style={{"--tag-guide-depth": depth - 1} as CSSProperties} />}
        {expanded === undefined ? <span className="ui-tag-directory-toggle-space" /> : <Button variant="ghost" size="icon-sm" className="ui-tag-directory-toggle" aria-label={`${expanded ? "收起" : "展开"}标签 ${tag.name}`} aria-expanded={expanded} aria-controls={childIds} disabled={disabled || saving} onClick={onToggle}><SidebarIcon name={expanded ? "down" : "right"} /></Button>}
        <Button variant="ghost" size="icon-sm" className="ui-tag-directory-icon" aria-label={`编辑标签图标 ${tag.name}`} aria-haspopup="dialog" aria-expanded={iconEditorOpen} disabled={disabled || !canRename || saving} onClick={event => onEdit(event.currentTarget, true)}><TagIcon value={icon} /></Button>
        <div className="ui-tag-directory-name">
          {renaming ? <form className="ui-tag-directory-name-form" onSubmit={event => { event.preventDefault(); void save(); }} onBlur={event => {
            if (cancelled.current || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            const form = event.currentTarget;
            if (pointerDown.current) pointerSubmit.current = () => form.requestSubmit();
            else form.requestSubmit();
          }} onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
            <Input ref={input} aria-label={`标签名称 ${tag.name}`} value={draft} disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) void save(true);
            }} />
            {saving && <span role="status" className="sr-only">保存中…</span>}
          </form> : <Button ref={label} variant="ghost" className="ui-tag-directory-name-button" data-tag-path={tag.name} aria-label={`编辑标签名称 ${tag.name}`} disabled={disabled || !canRename} onClick={() => { cancelled.current = false; setDraft(name); setError(""); setRenaming(true); }}>{name}</Button>}
          {flat && !renaming && separator >= 0 && <span className="ui-tag-directory-path">{tag.name.slice(0, separator)}</span>}
        </div>
      </div></TableCell>
      <TableCell><Button variant="ghost" size="sm" className="ui-tag-directory-count" aria-label={`查看标签 ${tag.name} 的笔记`} aria-description={`${tag.count} 条笔记，包含子标签，按笔记去重`} disabled={disabled || saving} onClick={onSelect}>{tag.count}</Button></TableCell>
      <TableCell><div className="ui-tag-directory-actions">
        <Button variant="ghost" size="icon-sm" className="ui-tag-directory-pin" aria-label={`${pinned ? "取消置顶" : "置顶标签"} ${tag.name}`} aria-pressed={pinned} disabled={disabled || pinDisabled || saving} onClick={onPin}><HugeiconsIcon icon={PinIcon} fill={pinned ? "currentColor" : "none"} aria-hidden="true" /></Button>
      </div></TableCell>
    </TreeRow>
    {error && <TableRow className="ui-tag-directory-error"><TableCell colSpan={3}><p id={errorId} role="alert">{error}</p></TableCell></TableRow>}
  </>;
}
