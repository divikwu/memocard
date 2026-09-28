// Sidebar-10 composition, adapted from the official registry snapshot in docs/ui-reference.
import { ChevronDown, ChevronRight, FilePenLine, Files, FolderOpen, FolderPlus, Layers, Plus, Search, Settings2, ShieldCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge } from "@/components/ui/sidebar";

type SidebarView = "notes" | "drafts" | "settings";

export interface AppSidebarProps {
  view: SidebarView;
  tag: string | null;
  tags: { name: string; count: number }[];
  folders?: string[];
  folder?: string | null;
  onFolder?: (path: string) => void;
  draftCount: number;
  vaultName: string;
  connected?: boolean;
  modeLabel?: string;
  vaultStatusText: string;
  hasVaultIssue: boolean;
  canCreate: boolean;
  canChooseVault: boolean;
  canCreateVault: boolean;
  needsPermission: boolean;
  working: boolean;
  onNavigate: (view: SidebarView, tag?: string | null) => void;
  onNewNote: () => void;
  onSearch: () => void;
  onSelectVault: (create: boolean) => void;
  onReauthorize: () => void;
}


export function AppSidebar({ view, tag, tags, folders = [], folder = null, onFolder, draftCount, vaultName, connected = false, modeLabel, vaultStatusText, hasVaultIssue,
  canCreate, canChooseVault, canCreateVault, needsPermission, working,
  onNavigate, onNewNote, onSearch, onSelectVault, onReauthorize,
}: AppSidebarProps) {
  return <>
    <SidebarHeader>
      <SidebarMenu><SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton className="w-fit max-w-full px-1.5" />} aria-label={`笔记库：${vaultName}`}>
            <span className="flex aspect-square size-5 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"><Layers className="size-3" aria-hidden="true" /></span>
            <span className="truncate font-medium" title={vaultName}>{vaultName}</span><ChevronDown className="opacity-50" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded-lg">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">笔记库</DropdownMenuLabel>
              {connected && <DropdownMenuItem className="gap-2 p-2" onClick={() => onNavigate("notes")}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-xs border"><Layers className="size-4" /></span>
                <span className="min-w-0 truncate" title={vaultName}>{vaultName}</span>
              </DropdownMenuItem>}
              {modeLabel && <p className="px-2 pb-1 text-xs text-muted-foreground">{modeLabel}</p>}
              <p className="px-2 pb-2 text-xs text-muted-foreground">{vaultStatusText}</p>
              <DropdownMenuSeparator />
              {canChooseVault && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={() => onSelectVault(false)}><FolderOpen />打开已有笔记库</DropdownMenuItem>}
              {canCreateVault && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={() => onSelectVault(true)}><FolderPlus />创建新笔记库</DropdownMenuItem>}
              {needsPermission && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={onReauthorize}><ShieldCheck />重新授权文件夹</DropdownMenuItem>}
              <DropdownMenuItem className="gap-2 p-2" onClick={() => onNavigate("settings")}><Settings2 />笔记库设置</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem></SidebarMenu>
      <nav aria-label="主要导航"><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton disabled={!connected} onClick={onSearch}><Search /><span>搜索</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton disabled={!canCreate || working} onClick={onNewNote}><Plus /><span>新建笔记</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton isActive={view === "notes" && !tag && !folder} onClick={() => onNavigate("notes", null)}><Files /><span>所有笔记</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton isActive={view === "drafts"} onClick={() => onNavigate("drafts")}><FilePenLine /><span>草稿</span>{draftCount > 0 && <span className="sr-only">{draftCount} 条草稿</span>}</SidebarMenuButton>{draftCount > 0 && <SidebarMenuBadge aria-hidden="true">{draftCount}</SidebarMenuBadge>}</SidebarMenuItem>
      </SidebarMenu></nav>
    </SidebarHeader>
    <SidebarContent>
      {onFolder && folders.length > 0 && <SidebarGroup>
        <SidebarGroupLabel>目录</SidebarGroupLabel>
        <nav aria-label="目录"><FolderBranch path="notes" folders={folders} selected={view === "notes" ? folder : null} onSelect={onFolder} /></nav>
      </SidebarGroup>}
      <SidebarGroup><Collapsible defaultOpen>
        <SidebarGroupLabel><CollapsibleTrigger className="group flex h-full w-full items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><span>标签</span><ChevronRight className="ml-auto size-4 opacity-50 group-data-panel-open:rotate-90" aria-hidden="true" /></CollapsibleTrigger></SidebarGroupLabel>
        <CollapsibleContent><nav aria-label="标签"><SidebarMenu>
          {tags.map(item => <SidebarMenuItem key={item.name}>
            <SidebarMenuButton isActive={view === "notes" && tag === item.name} onClick={() => onNavigate("notes", item.name)} className="pr-8"><span aria-hidden="true" className="shrink-0">🏷️</span><span title={item.name}>{item.name}</span></SidebarMenuButton>
            <SidebarMenuBadge aria-hidden="true">{item.count}</SidebarMenuBadge>
          </SidebarMenuItem>)}
          {tags.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">添加标签后，会显示在这里。</li>}
        </SidebarMenu></nav></CollapsibleContent>
      </Collapsible></SidebarGroup>
      <SidebarGroup className="mt-auto"><SidebarGroupContent><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton isActive={view === "settings"} onClick={() => onNavigate("settings")}><Settings2 /><span>设置</span></SidebarMenuButton></SidebarMenuItem>
      </SidebarMenu>{hasVaultIssue && <p className="px-2 py-1 text-xs text-destructive">{vaultStatusText}</p>}</SidebarGroupContent></SidebarGroup>
    </SidebarContent>
  </>;
}

function FolderBranch({ path, folders, selected, onSelect }: { path: string; folders: string[]; selected: string | null; onSelect: (path: string) => void }) {
  const children = folders.filter(item => item.startsWith(path + "/") && !item.slice(path.length + 1).includes("/"));
  const name = path === "notes" ? "笔记目录" : path.slice(path.lastIndexOf("/") + 1);
  return <Collapsible defaultOpen={path === "notes"}>
    <div className="flex items-center">
      {children.length > 0 ? <CollapsibleTrigger aria-label={`展开或收起 ${path}`} className="group flex size-8 max-md:size-11 shrink-0 items-center justify-center rounded-md hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"><ChevronRight className="size-4 group-data-panel-open:rotate-90" /></CollapsibleTrigger> : <span className="w-8 max-md:w-11 shrink-0" />}
      <SidebarMenuButton isActive={selected === path} onClick={() => onSelect(path)} title={path}><span aria-hidden="true">📁</span><span>{name}</span></SidebarMenuButton>
    </div>
    {children.length > 0 && <CollapsibleContent className="ml-4 border-l border-sidebar-border pl-2">
      {children.map(child => <FolderBranch key={child} path={child} folders={folders} selected={selected} onSelect={onSelect} />)}
    </CollapsibleContent>}
  </Collapsible>;
}
