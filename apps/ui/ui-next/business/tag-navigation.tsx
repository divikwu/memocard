import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { indexTags } from "../../src/components/tag-tree-index";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuSub, useSidebar } from "../components/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { SidebarTreeItem } from "./sidebar-tree-item";
import { SidebarIcon } from "./sidebar-icons";
const TagEditor = lazy(() => import("./tag-navigation-editor").then(module => ({ default: module.TagEditor })));

type NavigationProps = { onRename?: (from: string, to: string) => Promise<void>; vaultId?: string | null; tags: { name: string; count: number }[]; selected: string | null; onSelect: (path: string) => void };
type Preferences = { pinned: string[]; icons: Record<string, string> };
type TagBranchProps = { index: ReturnType<typeof indexTags>; path: string; preferences: Preferences; selected: string | null; onSelect: (path: string) => void; onPin: (path: string) => void; onEdit: (path: string, anchor: HTMLElement) => void; flat?: boolean; root?: boolean };

export function TagNavigation({ vaultId, tags, selected, onSelect, onRename }: NavigationProps) {
  const { isMobile } = useSidebar();
  const { preferences, error, togglePinned, saveAppearance } = useTagPreferences(vaultId);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ path: string; anchor: HTMLElement } | null>(null);
  const index = useMemo(() => indexTags(tags), [tags]);
  const pinned = preferences.pinned.filter(path => index.byName.has(path));
  const needle = query.trim().toLocaleLowerCase();
  const matches = needle ? tags.filter(tag => tag.name.toLocaleLowerCase().includes(needle)) : [];
  const common = { index, preferences, selected, onSelect, onPin: (path: string) => { void togglePinned(path); }, onEdit: (path: string, anchor: HTMLElement) => setEditing({ path, anchor }) };
  return <>
    {pinned.length > 0 && <SidebarGroup className="next-sidebar-tag-section"><Collapsible.Root defaultOpen><SidebarGroupLabel><Collapsible.Trigger className="next-sidebar-section-toggle"><span>置顶标签</span><SidebarIcon name="right" className="text-secondary" /></Collapsible.Trigger></SidebarGroupLabel><Collapsible.Panel><nav aria-label="置顶标签" className="pt-1"><SidebarMenu>{pinned.map(path => <TagBranch key={path} path={path} root {...common} />)}</SidebarMenu></nav></Collapsible.Panel></Collapsible.Root></SidebarGroup>}
    <SidebarGroup className="next-sidebar-tag-section"><Collapsible.Root open={tagsOpen} onOpenChange={setTagsOpen}>
      <SidebarGroupLabel className="gap-2"><Collapsible.Trigger className="next-sidebar-section-toggle"><span>标签</span><SidebarIcon name="right" className="text-secondary" /></Collapsible.Trigger><Button type="button" size="icon-sm" variant="ghost" className="-mr-1.5" aria-label={searchOpen ? "关闭标签搜索" : "搜索标签"} aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setQuery(""); setTagsOpen(true); }}><SidebarIcon name={searchOpen ? "close" : "search"} /></Button></SidebarGroupLabel>
      {searchOpen && <Input autoFocus aria-label="搜索标签" placeholder="搜索标签…" value={query} onChange={event => setQuery(event.target.value)} className="mt-1 mb-0.5 h-element-md rounded-full" />}
      <Collapsible.Panel><nav aria-label="标签" className={searchOpen ? "pt-0" : "pt-1"}><SidebarMenu>{needle ? matches.map(tag => <TagBranch key={tag.name} path={tag.name} flat {...common} />) : index.roots.map(tag => <TagBranch key={tag.name} path={tag.name} {...common} />)}{(needle ? matches.length === 0 : tags.length === 0) && <li className="px-2 py-2 text-xs text-secondary">{needle ? "没有匹配的标签" : "添加标签后，会显示在这里。"}</li>}</SidebarMenu></nav></Collapsible.Panel>
    </Collapsible.Root>{error && <p role="alert" className="px-2 text-sm text-error">{error}</p>}</SidebarGroup>
    {editing && <Suspense fallback={null}><TagEditor path={editing.path} anchor={editing.anchor} initialIcon={preferences.icons[editing.path] || ""} mobile={isMobile} onClose={() => setEditing(null)} onSave={(name, icon) => saveAppearance(editing.path, name, icon, onRename)} /></Suspense>}
  </>;
}

function TagBranch({ path, index, preferences, selected, onSelect, onPin, onEdit, flat = false, root = false }: TagBranchProps) {
  const { isMobile } = useSidebar();
  const anchor = useRef<HTMLButtonElement>(null);
  const editing = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const children = flat ? [] : index.children.get(path) || [];
  const nested = !flat && !root && path.includes("/");
  return <SidebarTreeItem className={menuOpen ? "next-sidebar-tag-row-open" : undefined} nested={nested} label={flat || root ? path : path.slice(path.lastIndexOf("/") + 1)} icon={preferences.icons[path] || <SidebarIcon name="hash" />} buttonProps={{ "aria-label": path, "aria-description": `${index.byName.get(path)?.count ?? 0} 条笔记`, title: path, onClick: () => onSelect(path) }} isActive={selected === path} toggleLabel={`展开或收起标签 ${path}`} accessories={<>
    <SidebarMenuBadge aria-hidden="true">{index.byName.get(path)?.count}</SidebarMenuBadge>
    {!isMobile && <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}><DropdownMenuTrigger render={<Button ref={anchor} type="button" size="icon-xs" variant="ghost" className="next-sidebar-tag-more" aria-label={`标签操作 ${path}`} />}><SidebarIcon name="more" className="size-3" /></DropdownMenuTrigger><DropdownMenuContent side="right" align="start" sideOffset={8} finalFocus={() => {
      if (editing.current) { editing.current = false; if (anchor.current) onEdit(path, anchor.current); return false; }
      return true;
    }}><DropdownMenuItem onClick={() => onPin(path)}>{preferences.pinned.includes(path) ? "取消置顶" : "置顶标签"}</DropdownMenuItem><DropdownMenuItem onClick={() => { editing.current = true; }}>编辑名称/图标</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
  </>}>
    {children.length > 0 && <SidebarMenuSub className="mr-0 translate-x-0 pr-0">{children.map(child => <TagBranch key={child.name} path={child.name} index={index} preferences={preferences} selected={selected} onSelect={onSelect} onPin={onPin} onEdit={onEdit} />)}</SidebarMenuSub>}
  </SidebarTreeItem>;
}
