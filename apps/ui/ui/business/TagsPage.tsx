import { Fragment, Suspense, useEffect, useEffectEvent, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown02Icon from "@hugeicons/core-free-icons/ArrowDown02Icon";
import ArrowUp02Icon from "@hugeicons/core-free-icons/ArrowUp02Icon";
import { useIsMobile } from "../hooks/use-mobile";
import { recoverableLazy } from "../components/recoverable-lazy";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import type { TagGroup } from "@memocard/contracts";
import { createId } from "../../src/uuid";
import { normalizePropertyTag, tagKey } from "../../src/inline-tags";
import { Button } from "../components/button";
import { CreateButton } from "./CreateButton";
import { Input } from "../components/input";
import { Textarea } from "../components/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/table";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/empty";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Skeleton } from "../components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { SidebarIcon } from "./sidebar-icons";
import { TreeMoreButton, TreeRow, TreeToggleButton } from "./sidebar-tree-item";
import { TagIcon } from "./property-icon-catalog";
import { FoldersIcon } from "./folders-icon";
import "./note-properties.css";
import "./TagsPage.css";

const TagEditor = recoverableLazy(() => import("./tag-navigation-editor").then(module => ({ default: module.TagEditor })), "标签编辑");

const groupIcon = <HugeiconsIcon icon={FoldersIcon} className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />;

type Tag = { name: string; count: number };
type TagDraft = { kind: "label" | "group"; anchor: HTMLElement; group?: TagGroup };
type GroupSort = { column: "name" | "count"; descending: boolean };
type TagsPageProps = {
  tags: Tag[];
  heading?: ReactNode;
  vaultId?: string | null;
  loading: boolean;
  connected: boolean;
  disabled: boolean;
  canRename: boolean;
  onSelect: (path: string) => void;
  onRename: (from: string, to: string) => Promise<void>;
};

export function TagsPage({ tags: indexedTags, heading, vaultId, loading, connected, disabled, canRename, onSelect, onRename }: TagsPageProps) {
  const { preferences, error, togglePinned, saveAppearance, updatePreferences } = useTagPreferences(vaultId);
  const tags = useMemo(() => {
    const known = new Set(indexedTags.map(tag => tag.name));
    const unused = Object.keys(preferences.labels ?? {}).filter(name => !known.has(name));
    return unused.length ? [...indexedTags, ...unused.map(name => ({name, count: 0}))] : indexedTags;
  }, [indexedTags, preferences.labels]);
  const [sort, setSort] = useState<GroupSort>({column: "name", descending: false});
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [draft, setDraft] = useState<TagDraft | null>(null);
  const mobile = useIsMobile();
  const [editing, setEditing] = useState<{path: string; anchor: HTMLElement; list?: string; groupId?: string} | null>(null);
  const [pinning, setPinning] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);
  const [focusPath, setFocusPath] = useState<{name: string; groupId?: string} | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const directory = useRef<HTMLElement>(null);
  const returnPath = useRef("");
  const needle = query.trim().toLocaleLowerCase();
  const matches = useMemo(() => tags.filter(tag => tag.name.toLocaleLowerCase().includes(needle)), [tags, needle]);
  const groups = useMemo(() => {
    const grouped = new Map<string, Tag[]>();
    for (const tag of [...matches].sort((a, b) => a.name.localeCompare(b.name))) {
      const initial = tag.name.normalize("NFD").charAt(0).toUpperCase();
      const group = /^[0-9A-Z]$/.test(initial) ? initial : "其他";
      const entries = grouped.get(group);
      if (entries) entries.push(tag);
      else grouped.set(group, [tag]);
    }
    return [...grouped].sort(([a], [b]) => a === "其他" ? 1 : b === "其他" ? -1 : a.localeCompare(b));
  }, [matches]);
  const descriptions = new Map(Object.entries(preferences.labels ?? {}));
  const tagGroups = preferences.groups ?? [];
  const editedGroup = tagGroups.find(group => group.id === editing?.groupId);
  const direction = sort.descending ? -1 : 1;
  const visibleGroups = tagGroups.flatMap(group => {
    const members = new Set(group.tags);
    const matchesName = group.name.toLocaleLowerCase().includes(needle);
    const entries = (matchesName ? tags : matches).filter(tag => members.has(tag.name));
    entries.sort((a, b) => {
      const order = sort.column === "count" ? a.count - b.count : 0;
      return direction * (order || a.name.localeCompare(b.name));
    });
    return matchesName || entries.length || draft?.group?.id === group.id ? [{group, entries}] : [];
  }).sort((a, b) => (sort.column === "name" ? direction : 1) * a.group.name.localeCompare(b.group.name));
  const canEditGroups = connected && !disabled && canRename;
  const updateGroups = (update: (groups: TagGroup[]) => TagGroup[]) =>
    updatePreferences(current => ({ ...current, groups: update(current.groups ?? []) }));
  const renameGroup = (id: string, name: string) => updateGroups(current => {
    if (!name) throw new Error("请输入群组名称。");
    if (!current.some(group => group.id === id)) throw new Error("这个群组已被删除。");
    assertGroupNameAvailable(current, id, name);
    return current.map(group => group.id === id ? {...group, name} : group);
  });
  const updateGroupDetails = (id: string, details: Partial<Pick<TagGroup, "description" | "icon" | "color">>) => updateGroups(current => {
    if (!current.some(group => group.id === id)) throw new Error("这个群组已被删除。");
    return current.map(group => group.id === id ? {...group, ...details} : group);
  });
  const saveLabel = async (name: string, description: string, isNew: boolean) => {
    if (isNew && tags.some(tag => tag.name === name)) throw new Error("这个标签已存在。");
    await updatePreferences(current => {
      if (isNew && Object.hasOwn(current.labels ?? {}, name)) throw new Error("这个标签已存在。");
      return {...current, labels: {...current.labels, [name]: description}};
    });
    window.dispatchEvent(new CustomEvent("memocard:event", {detail: {type: "tagsChanged"}}));
  };
  const edit = (path: string, anchor: HTMLElement, list?: string) => {
    returnPath.current = path;
    setEditing(current => current?.anchor === anchor ? null : {path, anchor, list});
  };
  const membershipMenu = (tag: string) => <DropdownMenuSub>
    <DropdownMenuSubTrigger>加入群组</DropdownMenuSubTrigger>
    <DropdownMenuSubContent aria-label={`加入群组 ${tag}`}>
      {tagGroups.length === 0 && <DropdownMenuItem disabled>还没有标签群组</DropdownMenuItem>}
      {tagGroups.map(group =>
        <DropdownMenuCheckboxItem key={group.id} closeOnClick={false} disabled={savingMembership} checked={group.tags.includes(tag)} onCheckedChange={checked => {
          setSavingMembership(true);
          void updateGroups(current => current.map(item => item.id !== group.id ? item : {
            ...item, tags: checked ? [...new Set([...item.tags, tag])] : item.tags.filter(name => name !== tag),
          })).catch(() => {}).finally(() => setSavingMembership(false));
        }}>{group.name}</DropdownMenuCheckboxItem>)}
    </DropdownMenuSubContent>
  </DropdownMenuSub>;
  useEffect(() => {
    if (focusPath === null) return;
    const target = [...directory.current?.querySelectorAll<HTMLButtonElement>("[data-tag-path]") ?? []].find(button => button.dataset.tagPath === focusPath.name && button.closest("tbody")?.dataset.tagGroup === focusPath.groupId);
    (target ?? search.current)?.focus();
    setFocusPath(null);
  }, [focusPath, tags]);
  const pin = async (path: string) => {
    setPinning(true);
    try { await togglePinned(path); }
    finally { setPinning(false); }
  };
  const status = loading && !tags.length ? <div role="status" aria-label="正在读取标签" className="grid gap-2 p-2">{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-8 rounded-xl" />)}</div>
    : !matches.length ? <Empty><EmptyHeader><EmptyTitle>{!connected ? "连接笔记库后查看标签" : needle ? "没有找到相关标签" : "还没有标签"}</EmptyTitle><EmptyDescription>{!connected ? "从左上角选择笔记库。" : needle ? "换个关键词，或清空搜索。" : "在笔记中添加标签后，会显示在这里。"}</EmptyDescription></EmptyHeader>{needle && <EmptyContent><Button variant="outline" onClick={() => { setQuery(""); search.current?.focus(); }}>清空搜索</Button></EmptyContent>}</Empty> : null;
  const chips = (entries: Tag[], label: string) => <ul role="list" aria-label={label}>
        {entries.map(tag => <li key={tag.name} data-tag={encodeURIComponent(tag.name)}>
          <Button variant="secondary" size="sm" className="ui-tag-directory-chip" aria-label={`查看标签 ${tag.name} 的笔记`} aria-description={`${tag.count} 条笔记`} disabled={disabled || !connected} onClick={() => onSelect(tag.name)}>
            {canRename ? <span className="ui-tag-directory-chip-icon-space" aria-hidden="true" /> : <TagIcon value={preferences.icons[tag.name]} />}
            <span className="ui-tag-directory-chip-name" title={tag.name}>{tag.name}</span>
            <span className="ui-tag-directory-chip-count" aria-hidden="true">{tag.count}</span>
          </Button>
          {canRename && <Button variant="ghost" size="icon-sm" className="ui-tag-directory-chip-icon" data-tag-path={tag.name} aria-label={`编辑标签图标 ${tag.name}`} aria-haspopup="dialog" aria-expanded={editing?.path === tag.name && editing.list === label} disabled={disabled || !connected} onClick={event => edit(tag.name, event.currentTarget, label)}>
            <TagIcon value={preferences.icons[tag.name]} />
          </Button>}
          {connected && !disabled && <TagActionsMenu label={`标签操作 ${tag.name}`} className="ui-tag-directory-chip-menu">
            {(getAnchor, afterClose) => <>
              {canEditGroups && <DropdownMenuItem onClick={() => afterClose(() => {
                getAnchor()?.closest("li")?.querySelector<HTMLButtonElement>("button[data-tag-path]")?.click();
              })}>编辑名称/图标</DropdownMenuItem>}
              {canEditGroups && membershipMenu(tag.name)}
              <DropdownMenuItem disabled={pinning} onClick={() => void pin(tag.name)}>
                {preferences.pinned.includes(tag.name) ? "取消置顶" : "置顶标签"}
              </DropdownMenuItem>
            </>}
          </TagActionsMenu>}
        </li>)}
  </ul>;
  const draftRows = (value: TagDraft) => <TagDraftRows key={value.group?.id ?? value.kind} draft={value} disabled={!canEditGroups}
    onClose={() => {
      setDraft(current => current === value ? null : current);
      requestAnimationFrame(() => {
        if (value.anchor.isConnected && document.activeElement === document.body) value.anchor.focus();
      });
    }}
    onSaveLabel={async (name, description) => {
      await saveLabel(name, description, true);
      if (view === "all") setQuery(current => name.toLocaleLowerCase().includes(current.trim().toLocaleLowerCase()) ? current : "");
    }} updateGroups={updateGroups} />;
  const groupSection = (group: TagGroup, entries: Tag[]) => {
    const { id, name } = group;
    if (draft?.group?.id === id) return draftRows(draft);
    const open = !collapsed.has(id);
    const iconClass = group.color ? `ui-tag-directory-icon note-tag-color-${group.color}` : "ui-tag-directory-icon";
    return <Fragment key={id}>
      <TableBody><TreeRow render={<TableRow />} className="ui-tag-directory-row ui-tag-directory-group-row">
        <TableCell>
          <div className="ui-tag-directory-group-name">
            <TreeToggleButton aria-label={`${open ? "收起" : "展开"}群组 ${name}`} aria-expanded={open} onClick={() => setCollapsed(current => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })} />
            {canEditGroups ? <Button variant="ghost" size="icon-sm" className={iconClass}
              aria-label={`编辑群组图标 ${name}`} aria-haspopup="dialog" aria-expanded={editing?.groupId === id}
              onClick={event => setEditing({path: "", groupId: id, anchor: event.currentTarget})}>
              <TagIcon value={group.icon} fallback={groupIcon} />
            </Button> : <span className={`${iconClass} ui-tag-directory-icon-static`}><TagIcon value={group.icon} fallback={groupIcon} /></span>}
            <h2 className="min-w-0 flex-1" aria-label={name}>{canEditGroups
              ? <GroupTagTextField value={name} label="群组名称" maxLength={80} onSave={value => renameGroup(id, value)} />
              : <span className="block truncate">{name}</span>}
            </h2>
          </div>
        </TableCell>
        <TableCell className="ui-tag-directory-description">
          {canEditGroups ? <GroupTagTextField value={group.description ?? ""} label="群组说明" itemName={name}
            placeholder="添加说明…" maxLength={280} onSave={value => updateGroupDetails(id, {description: value || undefined})} /> : group.description}
        </TableCell>
        <TableCell />
        <TableCell><div className="ui-tag-directory-actions">
          {canEditGroups && <TagActionsMenu label={`群组操作 ${name}`}>
            {(getAnchor, afterClose) => <DropdownMenuItem disabled={!!draft} onClick={() => afterClose(() => {
              const anchor = getAnchor();
              if (anchor) setDraft({kind: "group", group, anchor});
            })}>编辑群组</DropdownMenuItem>}
          </TagActionsMenu>}
        </div></TableCell>
      </TreeRow></TableBody>
      {open && <TableBody aria-label={name} data-tag-group={id}>
        {entries.length ? entries.map(tag => {
          const description = descriptions.get(tag.name) ?? "";
          const editorOpen = editing?.path === tag.name && editing.list === id;
          return <TagTableRow key={tag.name} tag={tag} disabled={disabled || !connected}
            icon={preferences.icons[tag.name]} iconDisabled={!canRename} iconEditorOpen={editorOpen}
            onEdit={anchor => edit(tag.name, anchor, id)} onSelect={() => onSelect(tag.name)}
            name={canEditGroups ? <GroupTagTextField value={tag.name} label="标签名称" itemName={tag.name}
              onSave={async (value, keyboard) => {
                const next = normalizePropertyTag(value);
                if (!next || next.includes("/")) throw new Error("请输入有效的单层标签名称，不能包含 /、空格或使用纯数字。");
                await saveAppearance(tag.name, next, undefined, onRename);
                if (keyboard && next !== tag.name) setFocusPath({name: next, groupId: id});
              }} /> : <Button variant="ghost" className="ui-tag-directory-name-button" title={tag.name}
                disabled={disabled || !connected} onClick={() => onSelect(tag.name)}>{tag.name}</Button>}
            description={canEditGroups ? <GroupTagTextField value={description} label="标签说明" itemName={tag.name}
              placeholder="添加说明…" maxLength={280} onSave={value => saveLabel(tag.name, value, false)} /> : description}
            actions={canEditGroups && <TagActionsMenu label={`标签操作 ${tag.name}`}>
              {(getAnchor, afterClose) => <>
                <DropdownMenuItem onClick={() => afterClose(() => {
                  getAnchor()?.closest("tr")?.querySelector<HTMLButtonElement>("button[data-tag-path]")?.click();
                })}>编辑标签名称</DropdownMenuItem>
                {membershipMenu(tag.name)}
                <DropdownMenuItem onClick={() => onSelect(tag.name)}>查看关联笔记</DropdownMenuItem>
              </>}
            </TagActionsMenu>}
          />;
        }) : <TableRow><TableCell colSpan={4} className="ui-tag-directory-group-empty text-secondary">{needle ? "没有匹配的标签" : "还没有添加标签"}</TableCell></TableRow>}
      </TableBody>}
    </Fragment>;
  };
  return <section ref={directory} className="ui-tag-directory" aria-label="标签目录">
    <div className={heading ? "ui-tag-directory-toolbar web-collection-heading" : "ui-tag-directory-toolbar"}>
      {heading}
      <div className="ui-collection-search"><SidebarIcon name="search" className="ui-collection-search-icon" /><Input ref={search} value={query} aria-label="搜索标签" placeholder="搜索标签" className="ui-collection-search-input" onChange={event => setQuery(event.target.value)} />{query && <Button variant="ghost" size="icon-xs" className="ui-collection-search-clear" aria-label="清空标签搜索" onClick={() => { setQuery(""); search.current?.focus(); }}><SidebarIcon name="close" /></Button>}</div>
    </div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <Tabs value={view} onValueChange={value => { setDraft(null); setView(value); }} className="ui-tag-directory-panel ui-tag-directory-tabs">
      <div className="ui-tag-directory-tab-header">
        <TabsList aria-label="标签视图"><TabsTrigger value="all">全部</TabsTrigger><TabsTrigger value="groups">标签群组</TabsTrigger></TabsList>
        <div className="ui-tag-directory-tools">
          {view === "groups" && <CreateButton disabled={!canEditGroups || !!draft} onClick={event => setDraft({kind: "group", anchor: event.currentTarget})}>新建群组</CreateButton>}
          <CreateButton disabled={!canEditGroups || !!draft} onClick={event => setDraft({kind: "label", anchor: event.currentTarget})}>新建标签</CreateButton>
        </div>
      </div>
      <TabsContent value="all" aria-busy={loading}>
        {view === "all" && draft && <Table className="ui-tag-directory-table ui-tag-directory-table-grouped ui-tag-directory-draft-table" aria-label="标签草稿">
          <colgroup><col /><col className="ui-tag-directory-description-column" /><col span={2} className="w-0" /></colgroup>
          {draftRows(draft)}
        </Table>}
        {status ?? <div className="ui-tag-directory-groups">
          {groups.map(([initial, entries]) => <div key={initial} className="ui-tag-directory-group"><h2>{initial}</h2>{chips(entries, initial)}</div>)}
        </div>}
      </TabsContent>
      <TabsContent value="groups" aria-busy={loading}>
        {visibleGroups.length || draft ? <TagDirectoryTable label="群组标签列表" sort={sort} onSort={column => setSort(current => ({
          column, descending: current.column === column && !current.descending,
        }))}>
          {draft && !tagGroups.some(group => group.id === draft.group?.id) && draftRows(draft)}
          {visibleGroups.map(({group, entries}) => groupSection(group, entries))}
        </TagDirectoryTable> : (loading || !connected) && status ? status : <Empty>
          <EmptyHeader><EmptyTitle>{tagGroups.length ? "没有找到相关群组" : "还没有标签群组"}</EmptyTitle></EmptyHeader>
        </Empty>}
      </TabsContent>
    </Tabs>
    {editing && (!editing.groupId || editedGroup) && <Suspense fallback={null}><TagEditor key={editing.groupId ? `group:${editing.groupId}` : `tag:${editing.path}`} path={editedGroup?.name ?? editing.path} anchor={editing.anchor} anchorIsTrigger
      icon={(editedGroup ? editedGroup.icon : preferences.icons[editing.path]) ?? ""} mobile={mobile} initialPickerOpen
      groupAppearance={editedGroup && {
        icon: groupIcon,
        color: editedGroup.color,
        onChangeColor: color => updateGroupDetails(editedGroup.id, {color: color === "default" ? undefined : color}),
      }}
      onClose={() => setEditing(null)} finalFocus={() => editing.anchor.isConnected ? editing.anchor : [...directory.current?.querySelectorAll<HTMLButtonElement>("[data-tag-path]") ?? []].find(button => button.dataset.tagPath === returnPath.current) ?? search.current ?? false}
      onSave={async (name, icon) => {
        if (editedGroup) {
          if (icon === undefined) {
            await renameGroup(editedGroup.id, name);
            return;
          }
          await updateGroupDetails(editedGroup.id, {icon: icon || undefined});
          return;
        }
        await saveAppearance(editing.path, name, icon, onRename);
        returnPath.current = tagKey(name);
      }} /></Suspense>}
  </section>;
}

function TagActionsMenu({ label, className = "ui-tag-directory-menu", children }: {
  label: string;
  className?: string;
  children: (getAnchor: () => HTMLButtonElement | null, afterClose: (action: () => void) => void) => ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingAction = useRef<(() => void) | null>(null);
  const handoffFocus = useRef(false);
  return <DropdownMenu onOpenChange={open => { if (open) handoffFocus.current = false; }} onOpenChangeComplete={open => {
    if (!open) {
      const action = pendingAction.current;
      pendingAction.current = null;
      action?.();
    }
  }}>
    <DropdownMenuTrigger render={<TreeMoreButton ref={trigger} className={className} aria-label={label} />} />
    <DropdownMenuContent align="end" aria-label={label} finalFocus={() => !handoffFocus.current}>{children(() => trigger.current, action => {
      handoffFocus.current = true;
      pendingAction.current = action;
    })}</DropdownMenuContent>
  </DropdownMenu>;
}

function TagDirectoryTable({ label, sort, onSort, children }: {
  label: string; sort: GroupSort; onSort: (column: GroupSort["column"]) => void; children: ReactNode;
}) {
  const heading = (column: GroupSort["column"], text: string, className: string) =>
    <TableHead scope="col" className={className} aria-sort={sort.column === column ? sort.descending ? "descending" : "ascending" : undefined}>
      <button type="button" className="ui-tag-directory-sort" onClick={() => onSort(column)}>
        {text}{sort.column === column && <HugeiconsIcon icon={sort.descending ? ArrowDown02Icon : ArrowUp02Icon} strokeWidth={1.5} aria-hidden="true" />}
      </button>
    </TableHead>;
  return <Table className="ui-tag-directory-table ui-tag-directory-table-grouped" aria-label={label}>
    <colgroup><col /><col className="ui-tag-directory-description-column" /><col className="ui-tag-directory-count-column" /><col className="ui-tag-directory-actions-column" /></colgroup>
    <TableHeader><TreeRow render={<TableRow />}>
      {heading("name", "名称", "ui-tag-directory-label-heading")}
      <TableHead scope="col" className="ui-tag-directory-description">说明</TableHead>
      {heading("count", "笔记数", "ui-tag-directory-count-heading")}
      <TableHead scope="col" className="ui-tag-directory-actions-heading"><span className="sr-only">操作</span></TableHead>
    </TreeRow></TableHeader>
    {children}
  </Table>;
}

function TagTableRow({ tag, icon, iconDisabled, iconEditorOpen, disabled, name, description, actions, onSelect, onEdit }: {
  tag: Tag; icon?: string; iconDisabled: boolean; iconEditorOpen: boolean; disabled: boolean;
  name: ReactNode; description?: ReactNode; actions: ReactNode; onSelect: () => void; onEdit: (anchor: HTMLElement) => void;
}) {
  const leading = <TagIcon value={icon} />;
  return <TreeRow render={<TableRow />} className="ui-tag-directory-row ui-tag-directory-member" data-tag={encodeURIComponent(tag.name)}>
    <TableCell><div className="ui-tag-directory-label">
      {iconDisabled ? <span className="ui-tag-directory-icon ui-tag-directory-icon-static">{leading}</span> : <Button variant="ghost" size="icon-sm" className="ui-tag-directory-icon" aria-label={`编辑标签图标 ${tag.name}`} aria-haspopup="dialog" aria-expanded={iconEditorOpen} disabled={disabled || iconDisabled} onClick={event => onEdit(event.currentTarget)}>{leading}</Button>}
      <div className="ui-tag-directory-name">{name}</div>
      <svg className="ui-tag-directory-branch" width="10" height="9" viewBox="0 0 10 9" aria-hidden="true" focusable="false">
        <path d="M.5 0v3a5 5 0 0 0 5 5h4" fill="none" stroke="currentColor" strokeLinecap="round" />
      </svg>
    </div></TableCell>
    <TableCell className="ui-tag-directory-description">{description}</TableCell>
    <TableCell><Button variant="ghost" size="sm" className="ui-tag-directory-count" aria-label={`查看标签 ${tag.name} 的笔记`} aria-description={`${tag.count} 条笔记`} disabled={disabled} onClick={onSelect}>{tag.count}</Button></TableCell>
    <TableCell><div className="ui-tag-directory-actions">{actions}</div></TableCell>
  </TreeRow>;
}

function useSubmitOnBlur(active: boolean) {
  const pointerDown = useRef(false);
  const pointerSubmit = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!active) return;
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
  }, [active]);
  return (form: HTMLFormElement) => {
    // Wait for the click target before saving a value that may reorder the rows.
    if (pointerDown.current) pointerSubmit.current = () => form.requestSubmit();
    else form.requestSubmit();
  };
}

function observeTagFieldWidth(row: HTMLElement, name: HTMLElement, description: HTMLElement) {
  const updateWidth = () => {
    const width = Math.min(name.getBoundingClientRect().width, description.getBoundingClientRect().width);
    if (width > 0) row.style.setProperty("--tag-field-available-width", `${width}px`);
  };
  updateWidth();
  const observer = new ResizeObserver(updateWidth);
  observer.observe(name);
  observer.observe(description);
  return () => observer.disconnect();
}

function GroupTagTextField({ value, label, itemName, placeholder, maxLength, onSave }: {
  value: string;
  label: "群组名称" | "标签名称" | "标签说明" | "群组说明";
  itemName?: string;
  placeholder?: string;
  maxLength?: number;
  onSave: (value: string, keyboard: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const cancelled = useRef(false);
  const active = draft !== null;
  const renaming = label === "群组名称" || label === "标签名称";
  const submitOnBlur = useSubmitOnBlur(active);
  const errorId = useId();
  useLayoutEffect(() => {
    if (!active) return;
    const row = input.current?.closest("tr");
    if (!row) return;
    const [name, description] = row.querySelectorAll<HTMLElement>(".ui-tag-directory-text-field");
    if (name && description) return observeTagFieldWidth(row, name, description);
  }, [active]);
  useEffect(() => { if (active) input.current?.focus(); }, [active]);

  function close(restoreFocus: boolean) {
    cancelled.current = true;
    setDraft(null);
    setError("");
    if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus());
  }

  async function save(keyboard: boolean) {
    if (draft === null || cancelled.current || submitting.current) return;
    const next = draft.trim();
    if (next === value) { close(keyboard); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave(next, keyboard);
      close(keyboard);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <div className="ui-tag-directory-text-field">
    <Button ref={trigger} variant="ghost" className={`ui-tag-directory-name-button${placeholder ? " ui-tag-directory-description-button" : ""}`}
      title={value} data-tag-path={label === "标签名称" ? itemName : undefined} aria-label={`${value ? "编辑" : "添加"}${label} ${itemName ?? value}`}
      onClick={() => { cancelled.current = false; setDraft(value); }} aria-hidden={active || undefined} tabIndex={active ? -1 : undefined}>
      {value || placeholder}
    </Button>
    {active && <form className="note-property-inline" onSubmit={event => { event.preventDefault(); void save(false); }}
      onBlur={event => {
        if (!cancelled.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) submitOnBlur(event.currentTarget);
      }}>
      <Textarea ref={input} rows={1} aria-label={label} maxLength={maxLength} value={draft} readOnly={busy}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        onChange={event => { setDraft(event.target.value); setError(""); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if (event.key === "Escape" && !submitting.current) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          } else if (event.key === "Enter" && (!event.shiftKey || renaming)) {
            event.preventDefault();
            if (!event.shiftKey) void save(true);
          }
        }} />
      {error && <p id={errorId} role="alert" className="text-sm text-error">{error}</p>}
    </form>}
  </div>;
}

function assertGroupNameAvailable(groups: TagGroup[], id: string, name: string) {
  if (groups.some(group => group.id !== id && tagKey(group.name) === tagKey(name))) {
    throw new Error("这个群组名称已被使用。");
  }
}

function TagDraftRows({ draft, disabled, onClose, onSaveLabel, updateGroups }: {
  draft: TagDraft;
  disabled: boolean;
  onClose: () => void;
  onSaveLabel: (name: string, description: string) => Promise<void>;
  updateGroups: (update: (groups: TagGroup[]) => TagGroup[]) => Promise<void>;
}) {
  const { group, kind } = draft;
  const isGroup = kind === "group";
  const title = group ? "编辑群组" : isGroup ? "新建群组" : "新建标签";
  const rows = useRef<HTMLTableSectionElement>(null);
  const nameInput = useRef<HTMLTextAreaElement>(null);
  const nameSpace = useRef<HTMLDivElement>(null);
  const descriptionSpace = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = disabled || busy;
  const descriptionLabel = isGroup ? "群组说明" : "标签说明";
  useEffect(() => { nameInput.current?.focus(); }, []);
  useEffect(() => {
    const name = nameSpace.current;
    const description = descriptionSpace.current;
    const rowGroup = rows.current;
    if (name && description && rowGroup) return observeTagFieldWidth(rowGroup, name, description);
  }, []);

  async function saveGroup(remove: boolean) {
    const id = group?.id ?? createId();
    await updateGroups(current => {
      if (remove) return current.filter(item => item.id !== id);
      const existing = current.find(item => item.id === id);
      if (group && !existing) throw new Error("这个群组已被删除。");
      const nextName = name.trim();
      const nextDescription = description.trim() || undefined;
      const savedName = existing && group?.name === nextName ? existing.name : nextName;
      const savedDescription = existing && group?.description === nextDescription ? existing.description : nextDescription;
      assertGroupNameAvailable(current, id, savedName);
      if (!existing) return [...current, {id, name: savedName, description: savedDescription, tags: []}];
      return current.map(item => item.id === id ? {...item, name: savedName, description: savedDescription} : item);
    });
  }

  async function commit(remove = false) {
    if (pending.current || disabled || (!remove && !name.trim())) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (isGroup) await saveGroup(remove);
      else {
        const tag = normalizePropertyTag(name);
        if (!tag || tag.includes("/")) throw new Error("请输入有效的单层标签名称，不能包含 /、空格或使用纯数字。");
        await onSaveLabel(tag, description.trim());
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const finishOutside = useEffectEvent((event: MouseEvent) => {
    const target = event.target;
    if (pending.current || !(target instanceof Node) || rows.current?.contains(target) || draft.anchor.contains(target)) return;
    if (name.trim()) void commit();
    else onClose();
  });
  useEffect(() => {
    const onClick = (event: MouseEvent) => finishOutside(event);
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return <TableBody ref={rows} aria-label={title} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Escape" && !pending.current) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === "Enter" && !event.shiftKey && event.target instanceof HTMLTextAreaElement) {
      event.preventDefault();
      void commit();
    }
  }}>
    <TableRow className="ui-tag-directory-row ui-tag-draft-row" aria-busy={busy}>
      <TableCell>
        <div className="ui-tag-directory-group-name ui-tag-draft-name">
          <span className="ui-tag-directory-icon ui-tag-directory-icon-static">{isGroup ? <TagIcon value={group?.icon} fallback={groupIcon} /> : <TagIcon />}</span>
          <div ref={nameSpace} className="min-w-0 flex-1">
            <div className="note-property-inline ui-tag-draft-field">
              <Textarea ref={nameInput} rows={1} enterKeyHint="done" aria-label={isGroup ? "群组名称" : "标签名称"} placeholder={isGroup ? "群组名称" : "标签名称"}
                maxLength={isGroup ? 80 : undefined} value={name} disabled={blocked}
                onChange={event => setName(event.target.value.replaceAll("\n", ""))}
                onKeyDown={event => {
                  if (event.key === "Enter" && event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) event.preventDefault();
                }} />
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="ui-tag-directory-description">
        <div ref={descriptionSpace}>
          {editingDescription ? <div className="note-property-inline ui-tag-draft-field">
            <Textarea autoFocus rows={1} aria-label={descriptionLabel} placeholder="添加说明…"
              maxLength={280} value={description} readOnly={blocked} onChange={event => setDescription(event.target.value)}
              onBlur={() => setEditingDescription(false)} />
          </div> : <Button variant="ghost" className="ui-tag-directory-name-button ui-tag-directory-description-button"
            aria-label={`${description.trim() ? "编辑" : "添加"}${descriptionLabel}`} disabled={blocked || !name.trim()}
            onClick={() => setEditingDescription(true)}>
            {description.trim() || "添加说明…"}
          </Button>}
        </div>
      </TableCell>
      <TableCell colSpan={2} />
    </TableRow>
    {(group || error) && <TableRow className="ui-tag-draft-details">
      <TableCell colSpan={4}>
        {group && <div className="text-end"><Button type="button" variant="ghost" size="sm" className="text-error" disabled={blocked} onClick={() => void commit(true)}>删除群组</Button></div>}
        {error && <p role="alert" className="px-2 text-error">{error}</p>}
      </TableCell>
    </TableRow>}
  </TableBody>;
}
