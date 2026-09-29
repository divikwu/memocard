import { useRef, useState, useSyncExternalStore } from "react";
import { ChevronRight, MoreHorizontal, Search, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge, SidebarMenuAction, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar";
import { TagEditor } from "./tag-editor";
import { renamedTag } from "@/rename-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Preferences = { pinned: string[]; icons: Record<string, string> };
type NavigationProps = { onRename?: (from: string, to: string) => Promise<void>; vaultId?: string | null; tags: { name: string; count: number }[]; selected: string | null; onSelect: (path: string) => void };
type TagBranchProps = Omit<NavigationProps, "vaultId"> & { path: string; preferences: Preferences; onPin: (path: string) => void; onIcon: (path: string, anchor: HTMLElement) => void; flat?: boolean };
const changeEvent = "memocard:tag-preferences";
function subscribe(callback: () => void) {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(changeEvent, callback); window.removeEventListener("storage", callback); };
}
function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function parse(raw: string | null): Preferences {
  try {
    const value = JSON.parse(raw || "null");
    return { pinned: Array.isArray(value?.pinned) ? value.pinned.filter((x: unknown) => typeof x === "string") : [], icons: Object.fromEntries(Object.entries(value?.icons || {}).filter(([, x]) => typeof x === "string")) as Record<string, string> };
  } catch { return { pinned: [], icons: {} }; }
}

export function TagNavigation({ vaultId, tags, selected, onSelect, onRename }: NavigationProps) {
  const key = `memocard:tags:${vaultId || "disconnected"}`;
  const raw = useSyncExternalStore(subscribe, () => read(key));
  const preferences = parse(raw);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ path: string; anchor: HTMLElement } | null>(null);
  const [error, setError] = useState("");
  function save(next: Preferences) {
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(changeEvent)); setError(""); return true; }
    catch { setError("无法保存标签设置，请检查浏览器存储权限。"); return false; }
  }
  const common = { tags, selected, onSelect, preferences,
    onPin: (path: string) => save({ ...preferences, pinned: preferences.pinned.includes(path) ? preferences.pinned.filter(x => x !== path) : [...preferences.pinned, path] }),
    onIcon: (path: string, anchor: HTMLElement) => setEditing({ path, anchor }),
  };
  const pinned = preferences.pinned.filter(path => tags.some(tag => tag.name === path));
  const matches = tags.filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <>
    {pinned.length > 0 && <SidebarGroup><SidebarGroupLabel>置顶标签</SidebarGroupLabel><nav aria-label="置顶标签"><SidebarMenu>{pinned.map(path => <TagBranch key={path} path={path} flat {...common} />)}</SidebarMenu></nav></SidebarGroup>}
    <SidebarGroup><Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
      <SidebarGroupLabel className="gap-1"><CollapsibleTrigger className="group flex h-full min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><span>标签</span><ChevronRight className="size-4 opacity-50 group-data-[state=open]:rotate-90" aria-hidden="true" /></CollapsibleTrigger><Button variant="ghost" size="icon-xs" type="button" aria-label={searchOpen ? "关闭标签搜索" : "搜索标签"} className="flex size-6 items-center justify-center rounded-md hover:bg-sidebar-accent focus-visible:ring-2" onClick={() => { setSearchOpen(!searchOpen); setQuery(""); setTagsOpen(true); }}>{searchOpen ? <X className="size-3.5" /> : <Search className="size-3.5" />}</Button></SidebarGroupLabel>
      {searchOpen && <Input autoFocus aria-label="搜索标签" placeholder="搜索标签…" value={query} onChange={event => setQuery(event.target.value)} className="mb-2 h-8" />}
      <CollapsibleContent><nav aria-label="标签"><SidebarMenu>
        {query.trim() ? matches.map(tag => <TagBranch key={tag.name} path={tag.name} flat {...common} />) : tags.filter(tag => !tag.name.includes("/")).map(tag => <TagBranch key={tag.name} path={tag.name} {...common} />)}
        {(query.trim() ? matches.length === 0 : tags.length === 0) && <li className="px-2 py-2 text-xs text-muted-foreground">{query.trim() ? "没有匹配的标签" : "添加标签后，会显示在这里。"}</li>}
      </SidebarMenu></nav></CollapsibleContent>
    </Collapsible>{error && <p role="alert" className="px-2 text-xs text-destructive">{error}</p>}</SidebarGroup>
    {editing && <TagEditor path={editing.path} anchor={editing.anchor} initialIcon={preferences.icons[editing.path] || ""} onClose={() => setEditing(null)} onSave={async (name, icon) => {
      if (name !== editing.path) {
        if (!onRename) throw new Error("当前连接不支持标签重命名。");
        await onRename(editing.path, name);
      }
      const next = { pinned: [...new Set(preferences.pinned.map(path => renamedTag(path, editing.path, name)))], icons: Object.fromEntries(Object.entries(preferences.icons).map(([path, value]) => [renamedTag(path, editing.path, name), value])) };
      next.icons[name] = icon;
      if (!save(next)) throw new Error("笔记已保存，但标签外观未能保存，请检查存储权限。");
    }} /> }
  </>;
}

function TagBranch({ path, tags, selected, onSelect, preferences, onPin, onIcon, flat = false }: TagBranchProps) {
  const menuAnchor = useRef<HTMLButtonElement>(null);
  const openingEditor = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const children = flat ? [] : tags.filter(item => item.name.startsWith(path + "/") && !item.name.slice(path.length + 1).includes("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const nested = !flat && path.includes("/");
  const Item = nested ? SidebarMenuSubItem : SidebarMenuItem;
  const MenuButton = nested ? SidebarMenuSubButton : SidebarMenuButton;
  return <Item>
    <Collapsible defaultOpen>
      <div className="group/tag-row relative">
        <MenuButton asChild isActive={selected === path}><button type="button" aria-label={path} onClick={() => onSelect(path)} title={path} className="translate-x-0 pr-8"><span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">{preferences.icons[path] || "🏷️"}</span><span>{flat ? path : name}</span></button></MenuButton>
        {children.length > 0 && <CollapsibleTrigger asChild><SidebarMenuAction aria-label={`展开或收起标签 ${path}`} className={`md:opacity-0 group-hover/tag-row:opacity-100 group-has-[:focus-visible]/tag-row:opacity-100 left-2 bg-sidebar-accent text-sidebar-accent-foreground data-[state=open]:rotate-90 ${nested ? " top-1" : ""}`}><ChevronRight aria-hidden="true" /></SidebarMenuAction></CollapsibleTrigger>}
        <SidebarMenuBadge aria-hidden="true" className={`${menuOpen ? "opacity-0" : ""} group-hover/tag-row:opacity-0 group-focus-within/tag-row:opacity-0 max-md:hidden text-muted-foreground/65 peer-hover/menu-button:text-muted-foreground/65 peer-data-[active=true]/menu-button:text-muted-foreground/65 ${nested ? "top-1" : ""}`}>{tags.find(item => item.name === path)?.count}</SidebarMenuBadge>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild><SidebarMenuAction ref={menuAnchor} aria-label={`标签操作 ${path}`} className={`md:opacity-0 group-hover/tag-row:opacity-100 group-focus-within/tag-row:opacity-100 data-[state=open]:opacity-100 ${nested ? " top-1" : ""}`}><MoreHorizontal /></SidebarMenuAction></DropdownMenuTrigger>
          <DropdownMenuContent onCloseAutoFocus={event => { if (openingEditor.current) { event.preventDefault(); openingEditor.current = false; if (menuAnchor.current) onIcon(path, menuAnchor.current); } }}><DropdownMenuItem onClick={() => onPin(path)}>{preferences.pinned.includes(path) ? "取消置顶" : "置顶标签"}</DropdownMenuItem><DropdownMenuItem onSelect={() => { openingEditor.current = true; }}>编辑名称/图标</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
      {children.length > 0 && <CollapsibleContent><SidebarMenuSub>
        {children.map(child => <TagBranch key={child.name} path={child.name} tags={tags} selected={selected} onSelect={onSelect} preferences={preferences} onPin={onPin} onIcon={onIcon} />)}
      </SidebarMenuSub></CollapsibleContent>}
    </Collapsible>
  </Item>;
}
