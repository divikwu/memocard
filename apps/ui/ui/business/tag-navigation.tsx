import { recoverableLazy } from "../components/recoverable-lazy";
import { memo, Suspense, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { indexTags } from "../../src/components/tag-tree-index";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuSub, useSidebar } from "../components/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Button } from "../components/button";
import { SidebarTreeItem } from "./sidebar-tree-item";
import { SidebarIcon } from "./sidebar-icons";
const TagEditor = recoverableLazy(() => import("./tag-navigation-editor").then(module => ({ default: module.TagEditor })), "标签编辑");

type NavigationProps = { onRename?: (from: string, to: string) => Promise<void>; vaultId?: string | null; tags: { name: string; count: number }[]; selected: string | null; onSelect: (path: string) => void };
type Preferences = { pinned: string[]; icons: Record<string, string> };
type TagBranchProps = { index: ReturnType<typeof indexTags>; path: string; preferences: Preferences; selected: string | null; onSelect: (path: string) => void; onPin: (path: string) => void; onEdit: (path: string, anchor: HTMLElement) => void; root?: boolean };

export function TagNavigation({ vaultId, tags, selected, onSelect, onRename }: NavigationProps) {
  const { isMobile } = useSidebar();
  const { preferences, error, togglePinned, saveAppearance } = useTagPreferences(vaultId);
  const actions = useRef({onSelect, togglePinned});
  useLayoutEffect(() => { actions.current = {onSelect, togglePinned}; });
  const select = useCallback((path:string) => actions.current.onSelect(path), []);
  const pin = useCallback((path:string) => { void actions.current.togglePinned(path); }, []);
  const [editing, setEditing] = useState<{ path: string; anchor: HTMLElement } | null>(null);
  const edit = useCallback((path:string,anchor:HTMLElement) => setEditing({path,anchor}), []);
  const index = useMemo(() => indexTags(tags), [tags]);
  const pinned = preferences.pinned.filter(path => index.byName.has(path));
  const common = { index, preferences, selected, onSelect: select, onPin: pin, onEdit: edit };
  return <>
    {pinned.length > 0 && <SidebarGroup className="ui-sidebar-tag-section"><Collapsible.Root defaultOpen><SidebarGroupLabel><Collapsible.Trigger className="ui-sidebar-section-toggle"><span>置顶标签</span><SidebarIcon name="right" className="text-secondary" /></Collapsible.Trigger></SidebarGroupLabel><Collapsible.Panel><nav aria-label="置顶标签" className="pt-1"><SidebarMenu>{pinned.map(path => <TagBranch key={path} path={path} root {...common} />)}</SidebarMenu></nav></Collapsible.Panel></Collapsible.Root></SidebarGroup>}
    <SidebarGroup className="ui-sidebar-tag-section"><Collapsible.Root defaultOpen>
      <SidebarGroupLabel><Collapsible.Trigger className="ui-sidebar-section-toggle"><span>标签</span><SidebarIcon name="right" className="text-secondary" /></Collapsible.Trigger></SidebarGroupLabel>
      <Collapsible.Panel><nav aria-label="标签" className="pt-1"><SidebarMenu>{index.roots.map(tag => <TagBranch key={tag.name} path={tag.name} {...common} />)}{tags.length === 0 && <li className="px-2 py-2 text-xs text-secondary">添加标签后，会显示在这里。</li>}</SidebarMenu></nav></Collapsible.Panel>
    </Collapsible.Root>{error && <p role="alert" className="px-2 text-sm text-error">{error}</p>}</SidebarGroup>
    {editing && <Suspense fallback={null}><TagEditor path={editing.path} anchor={editing.anchor} initialIcon={preferences.icons[editing.path] || ""} mobile={isMobile} onClose={() => setEditing(null)} onSave={(name, icon) => saveAppearance(editing.path, name, icon, onRename)} /></Suspense>}
  </>;
}

const TagBranch = memo(function TagBranchView({ path, index, preferences, selected, onSelect, onPin, onEdit, root = false }: TagBranchProps) {
  const { isMobile } = useSidebar();
  const anchor = useRef<HTMLButtonElement>(null);
  const editing = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const children = index.children.get(path) || [];
  const nested = !root && path.includes("/");
  return <SidebarTreeItem className={menuOpen ? "ui-sidebar-tag-row-open" : undefined} nested={nested} label={root ? path : path.slice(path.lastIndexOf("/") + 1)} icon={preferences.icons[path] || <SidebarIcon name="hash" />} buttonProps={{ "aria-label": path, "aria-description": `${index.byName.get(path)?.count ?? 0} 条笔记`, title: path, onClick: () => onSelect(path) }} isActive={selected === path} toggleLabel={`展开或收起标签 ${path}`} accessories={<>
    <SidebarMenuBadge aria-hidden="true">{index.byName.get(path)?.count}</SidebarMenuBadge>
    {!isMobile && <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}><DropdownMenuTrigger render={<Button ref={anchor} type="button" size="icon-xs" variant="ghost" className="ui-sidebar-tag-more" aria-label={`标签操作 ${path}`} />}><SidebarIcon name="more" className="size-3" /></DropdownMenuTrigger><DropdownMenuContent side="right" align="start" sideOffset={8} finalFocus={() => {
      if (editing.current) { editing.current = false; if (anchor.current) onEdit(path, anchor.current); return false; }
      return true;
    }}><DropdownMenuItem onClick={() => onPin(path)}>{preferences.pinned.includes(path) ? "取消置顶" : "置顶标签"}</DropdownMenuItem><DropdownMenuItem onClick={() => { editing.current = true; }}>编辑名称/图标</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
  </>}>
    {children.length > 0 && <SidebarMenuSub className="mr-0 translate-x-0 pr-0">{children.map(child => <TagBranch key={child.name} path={child.name} index={index} preferences={preferences} selected={selected} onSelect={onSelect} onPin={onPin} onEdit={onEdit} />)}</SidebarMenuSub>}
  </SidebarTreeItem>;
});
