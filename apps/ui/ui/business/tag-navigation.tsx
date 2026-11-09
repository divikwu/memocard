import { recoverableLazy } from "../components/recoverable-lazy";
import { memo, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, useSidebar } from "../components/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/dropdown-menu";
import { SidebarTreeItem, TreeMoreButton } from "./sidebar-tree-item";
import { SidebarIcon } from "./sidebar-icons";
import { TagIcon } from "./property-icon-catalog";
const TagEditor = recoverableLazy(() => import("./tag-navigation-editor").then(module => ({ default: module.TagEditor })), "标签编辑");

type NavigationProps = { pinnedOnly?: boolean; onRename?: (from: string, to: string) => Promise<void>; vaultId?: string | null; tags: { name: string; count: number }[]; selected: string | null; onSelect: (path: string) => void };
type Preferences = { pinned: string[]; icons: Record<string, string> };
type TagRowProps = { tag: NavigationProps["tags"][number]; preferences: Preferences; selected: string | null; onSelect: (path: string) => void; onPin: (path: string) => void; onEdit: (path: string, anchor: HTMLElement) => void };

export function TagNavigation({ vaultId, tags, selected, onSelect, onRename, pinnedOnly = false }: NavigationProps) {
  const { isMobile } = useSidebar();
  const { preferences, error, togglePinned, saveAppearance } = useTagPreferences(vaultId);
  const actions = useRef({onSelect, togglePinned});
  useLayoutEffect(() => { actions.current = {onSelect, togglePinned}; });
  const select = useCallback((path:string) => actions.current.onSelect(path), []);
  const pin = useCallback((path:string) => { void actions.current.togglePinned(path); }, []);
  const [editing, setEditing] = useState<{ path: string; anchor: HTMLElement } | null>(null);
  const edit = useCallback((path:string,anchor:HTMLElement) => setEditing({path,anchor}), []);
  const byName = useMemo(() => new Map(tags.map(tag => [tag.name, tag])), [tags]);
  const pinned = preferences.pinned.flatMap(path => byName.get(path) ?? []);
  const common = { preferences, selected, onSelect: select, onPin: pin, onEdit: edit };
  return <>
    {pinned.length > 0 && <SidebarGroup className="ui-sidebar-tag-section"><Collapsible.Root defaultOpen><SidebarGroupLabel><Collapsible.Trigger className="ui-sidebar-section-toggle"><span>置顶标签</span><SidebarIcon name="right" className="text-secondary" /></Collapsible.Trigger></SidebarGroupLabel><Collapsible.Panel><nav aria-label="置顶标签" className="pt-1"><SidebarMenu>{pinned.map(tag => <TagNavigationRow key={tag.name} tag={tag} {...common} />)}</SidebarMenu></nav></Collapsible.Panel></Collapsible.Root></SidebarGroup>}
    {!pinnedOnly && <SidebarGroup className="ui-sidebar-tag-section"><Collapsible.Root defaultOpen>
      <SidebarGroupLabel><Collapsible.Trigger className="ui-sidebar-section-toggle"><span>标签</span><SidebarIcon name="right" className="text-secondary" /></Collapsible.Trigger></SidebarGroupLabel>
      <Collapsible.Panel><nav aria-label="标签" className="pt-1"><SidebarMenu>{Array.from(byName.values(), tag => <TagNavigationRow key={tag.name} tag={tag} {...common} />)}{tags.length === 0 && <li className="px-2 py-2 text-xs text-secondary">添加标签后，会显示在这里。</li>}</SidebarMenu></nav></Collapsible.Panel>
    </Collapsible.Root></SidebarGroup>}
    {error && <p role="alert" className="px-2 text-sm text-error">{error}</p>}
    {editing && <Suspense fallback={null}><TagEditor path={editing.path} anchor={editing.anchor} icon={preferences.icons[editing.path] || ""} mobile={isMobile} onClose={() => setEditing(null)} onSave={(name, icon) => saveAppearance(editing.path, name, icon, onRename)} /></Suspense>}
  </>;
}

const TagNavigationRow = memo(function TagNavigationRowView({ tag: {name: path, count}, preferences, selected, onSelect, onPin, onEdit }: TagRowProps) {
  const { isMobile } = useSidebar();
  const anchor = useRef<HTMLButtonElement>(null);
  const editing = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return <SidebarTreeItem className={menuOpen ? "ui-sidebar-tag-row-open" : undefined} label={path} icon={<TagIcon value={preferences.icons[path]} />} buttonProps={{ "aria-label": path, "aria-description": `${count} 条笔记`, onClick: () => onSelect(path) }} isActive={selected === path} accessories={<>
    <SidebarMenuBadge aria-hidden="true">{count}</SidebarMenuBadge>
    {!isMobile && <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}><DropdownMenuTrigger render={<TreeMoreButton ref={anchor} className="ui-sidebar-tag-more" aria-label={`标签操作 ${path}`} />} /><DropdownMenuContent side="right" align="start" sideOffset={8} finalFocus={() => {
      if (editing.current) { editing.current = false; if (anchor.current) onEdit(path, anchor.current); return false; }
      return true;
    }}><DropdownMenuItem onClick={() => onPin(path)}>{preferences.pinned.includes(path) ? "取消置顶" : "置顶标签"}</DropdownMenuItem><DropdownMenuItem onClick={() => { editing.current = true; }}>编辑名称/图标</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
  </>} />;
});
