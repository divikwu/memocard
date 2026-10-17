import { lazy, Suspense, useRef, useState } from "react";
import { ChevronRight, Hash, MoreHorizontal, Search, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuAction, SidebarMenuSub } from "@/components/ui/sidebar";
import { SidebarTreeItem } from "./sidebar-tree-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTagPreferences } from "@/hooks/use-tag-preferences";
const TagEditor = lazy(() => import("./tag-editor").then(module => ({ default: module.TagEditor })));
const TagColorStyles = lazy(() => import("@/TagColorStyles"));

type Preferences = { pinned: string[]; icons: Record<string, string> };
type NavigationProps = { onRename?: (from: string, to: string) => Promise<void>; vaultId?: string | null; tags: { name: string; count: number }[]; selected: string | null; onSelect: (path: string) => void };
type TagBranchProps = Omit<NavigationProps, "vaultId"> & { path: string; preferences: Preferences; onPin: (path: string) => void; onIcon: (path: string, anchor: HTMLElement) => void; isMobile: boolean; flat?: boolean; root?: boolean };
export function TagNavigation({ vaultId, tags, selected, onSelect, onRename }: NavigationProps) {
  const isMobile = useIsMobile();
  const { preferences, error, togglePinned, saveAppearance } = useTagPreferences(vaultId);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ path: string; anchor: HTMLElement } | null>(null);
  const common = { tags, selected, onSelect, preferences, isMobile,
    onPin: togglePinned,
    onIcon: (path: string, anchor: HTMLElement) => setEditing({ path, anchor }),
  };
  const pinned = preferences.pinned.filter(path => tags.some(tag => tag.name === path));
  const matches = tags.filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    <Suspense fallback={null}><TagColorStyles /></Suspense>
    {pinned.length > 0 && <SidebarGroup className="group/tag-section"><Collapsible defaultOpen>
      <SidebarGroupLabel className="gap-1"><CollapsibleTrigger className="group flex h-full min-w-0 flex-1 items-center gap-1 rounded-(--hover-row-radius) text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-sidebar-ring"><span>置顶标签</span><ChevronRight className="size-4 opacity-50 group-data-[panel-open]:rotate-90" aria-hidden="true" /></CollapsibleTrigger></SidebarGroupLabel>
      <CollapsibleContent><nav aria-label="置顶标签" className="pt-1"><SidebarMenu>{pinned.map(path => <TagBranch key={path} path={path} root {...common} />)}</SidebarMenu></nav></CollapsibleContent>
    </Collapsible></SidebarGroup>}
    <SidebarGroup className="group/tag-section"><Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
      <SidebarGroupLabel className="gap-1 pl-0"><CollapsibleTrigger className="group flex h-full pl-2 min-w-0 flex-1 items-center gap-1 rounded-(--hover-row-radius) text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-sidebar-ring"><span>标签</span><ChevronRight className="size-4 opacity-50 group-data-[panel-open]:rotate-90" aria-hidden="true" /></CollapsibleTrigger><Button variant="ghost" size="icon-sm" type="button" aria-label={searchOpen ? "关闭标签搜索" : "搜索标签"} aria-expanded={searchOpen} className={cn("-mr-1.5 flex size-8 items-center justify-center rounded-md hover:bg-hover focus-visible:ring-2", searchOpen && "bg-hover")} onClick={() => { setSearchOpen(!searchOpen); setQuery(""); setTagsOpen(true); }}>{searchOpen ? <X className="size-4" /> : <Search className="size-4" />}</Button></SidebarGroupLabel>
      {searchOpen && <Input autoFocus aria-label="搜索标签" placeholder="搜索标签…" value={query} onChange={event => setQuery(event.target.value)} className="mt-1 mb-2 h-8 bg-background focus:bg-background! dark:focus:bg-muted!" />}
      <CollapsibleContent><nav aria-label="标签" className="pt-1"><SidebarMenu>
        {query.trim() ? matches.map(tag => <TagBranch key={tag.name} path={tag.name} flat {...common} />) : tags.filter(tag => !tag.name.includes("/")).map(tag => <TagBranch key={tag.name} path={tag.name} {...common} />)}
        {(query.trim() ? matches.length === 0 : tags.length === 0) && <li className="px-2 py-2 text-xs text-muted-foreground">{query.trim() ? "没有匹配的标签" : "添加标签后，会显示在这里。"}</li>}
      </SidebarMenu></nav></CollapsibleContent>
    </Collapsible>{error && <p role="alert" className="px-2 text-xs text-destructive">{error}</p>}</SidebarGroup>
    {editing && <Suspense fallback={null}><TagEditor path={editing.path} anchor={editing.anchor} initialIcon={preferences.icons[editing.path] || ""} onClose={() => setEditing(null)} onSave={(name, icon) => saveAppearance(editing.path, name, icon, onRename)} /></Suspense> }
  </>;
}

function TagBranch({ path, tags, selected, onSelect, preferences, onPin, onIcon, isMobile, flat = false, root = false }: TagBranchProps) {
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const openingEditor = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const children = flat ? [] : tags.filter(item => item.name.startsWith(path + "/") && !item.name.slice(path.length + 1).includes("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const nested = !flat && !root && path.includes("/");
  return <SidebarTreeItem className={`sidebar-tag-row${menuOpen ? " sidebar-tag-row-open" : ""}`} nested={nested} label={flat || root ? path : name} icon={preferences.icons[path] || <Hash className="size-4" />} buttonProps={{ "aria-label": path, onClick: () => onSelect(path), title: path }} isActive={selected === path} toggleLabel={`展开或收起标签 ${path}`} accessories={<>
        <SidebarMenuBadge aria-hidden="true" className={`opacity-0 group-hover/tag-section:opacity-100 group-has-[:focus-visible]/tag-section:opacity-100 ${menuOpen ? "opacity-0!" : ""} group-hover/tree-row:opacity-0! group-focus-within/tree-row:opacity-0! max-md:hidden text-muted-foreground/65 peer-hover/menu-button:text-muted-foreground/65 peer-data-[active=true]/menu-button:text-muted-foreground/65 top-1.5`}>{tags.find(item => item.name === path)?.count}</SidebarMenuBadge>
        {!isMobile && <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger render={<SidebarMenuAction ref={menuAnchor} aria-label={`标签操作 ${path}`} className={`sidebar-tag-more md:opacity-0 group-hover/tree-row:opacity-100 group-focus-within/tree-row:opacity-100 data-[popup-open]:opacity-100 ${nested ? " top-1" : ""}`}><MoreHorizontal /></SidebarMenuAction>} />
          <DropdownMenuContent side={isMobile ? "bottom" : "right"} align={isMobile ? "end" : "start"} sideOffset={8} finalFocus={() => { if (openingEditor.current) { openingEditor.current = false; if (menuAnchor.current) onIcon(path, menuAnchor.current); return false; } return true; }}><DropdownMenuItem onClick={() => onPin(path)}>{preferences.pinned.includes(path) ? "取消置顶" : "置顶标签"}</DropdownMenuItem><DropdownMenuItem onClick={() => { openingEditor.current = true; }}>编辑名称/图标</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>}
      </>}>
      {children.length > 0 && <SidebarMenuSub className="mr-0 translate-x-0 pr-0">
        {children.map(child => <TagBranch key={child.name} path={child.name} tags={tags} selected={selected} onSelect={onSelect} preferences={preferences} onPin={onPin} onIcon={onIcon} isMobile={isMobile} />)}
      </SidebarMenuSub>}
    </SidebarTreeItem>;
}
