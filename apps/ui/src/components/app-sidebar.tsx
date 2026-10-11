// Sidebar-10 composition, adapted from the official registry snapshot in docs/ui-reference.
import { lazy, Suspense } from "react";
import { CalendarDays, CircleHelp, Check, ChevronDown, Notebook, FolderOpen, FolderPlus, Layers, Plus, Search, Settings2, ShieldCheck } from "lucide-react";
import type { NoteFilterCounts, NoteQuickFilter } from "@memocard/contracts";
import type { RegisteredVault } from "../bridge";
import { NoteFilterNavigation } from "./note-filter-navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarRail } from "@/components/ui/sidebar";
import { SidebarTreeItem } from "./sidebar-tree-item";

type SidebarView = "notes" | "settings";
const TagNavigation = lazy(() => import("./tag-navigation").then(module => ({ default: module.TagNavigation })));

export interface AppSidebarProps {
  view: SidebarView;
  tag: string | null;
  quickFilter?: NoteQuickFilter | null;
  filterCounts?: NoteFilterCounts;
  tags: { name: string; count: number }[];
  vaultName: string;
  vaultId?: string | null;
  registeredVaults?: RegisteredVault[];
  onRenameTag?: (from: string, to: string) => Promise<void>;
  connected?: boolean;
  vaultStatusText: string;
  hasVaultIssue: boolean;
  canCreate: boolean;
  canChooseVault: boolean;
  canCreateVault: boolean;
  needsPermission: boolean;
  working: boolean;
  onNavigate: (view: SidebarView, tag?: string | null, quickFilter?: NoteQuickFilter | null) => void;
  onNewNote: () => void;
  onSearch: () => void;
  onSelectVault: (create: boolean) => void;
  onActivateVault: (vaultId: string) => void;
  onReauthorize: () => void;
}


export function AppSidebar({ view, tag, quickFilter = null, filterCounts, tags, vaultName, vaultId, registeredVaults = [], onRenameTag, connected = false, vaultStatusText, hasVaultIssue,
  canCreate, canChooseVault, canCreateVault, needsPermission, working,
  onNavigate, onNewNote, onSearch, onSelectVault, onActivateVault, onReauthorize,
}: AppSidebarProps) {
  return <Sidebar id="desktop-sidebar" aria-label="笔记导航" className="border-r-0">
    <SidebarHeader>
      <button type="button" aria-label="MemoCard，返回所有笔记" className="flex h-10 items-center gap-2 rounded-md px-1.5 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-sidebar-ring" onClick={() => onNavigate("notes", null)}>
        <img src="./favicon.png" alt="" draggable={false} className="size-8 shrink-0 object-contain" />
        <span className="truncate text-sm font-semibold">MemoCard</span>
      </button>
      <nav aria-label="主要导航"><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton disabled={!connected} onClick={onSearch}><Search /><span>搜索</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton disabled={!canCreate || working} onClick={onNewNote}><Plus /><span>新建笔记</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarTreeItem label="所有笔记" icon={<Notebook className="size-3.5" />} buttonProps={{ onClick: () => onNavigate("notes", null) }} isActive={view === "notes" && !tag && !quickFilter} defaultOpen={false} toggleLabel="展开或收起快捷筛选">
          <NoteFilterNavigation view={view} quickFilter={quickFilter} filterCounts={filterCounts} connected={connected} onNavigate={onNavigate} />
        </SidebarTreeItem>
      </SidebarMenu></nav>
    </SidebarHeader>
    <SidebarContent>
      <Suspense fallback={<div className="h-12" />}><TagNavigation key={vaultId || "disconnected"} vaultId={vaultId} onRename={onRenameTag} tags={tags} selected={view === "notes" ? tag : null} onSelect={name => onNavigate("notes", name)} /></Suspense>
      <SidebarGroup className="mt-auto"><SidebarGroupContent><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton aria-disabled="true" className="aria-disabled:opacity-100" title="日历功能暂未开放"><CalendarDays /><span>日历</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton aria-disabled="true" className="aria-disabled:opacity-100" title="帮助功能暂未开放"><CircleHelp /><span>Help</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarMenuButton className="w-full" aria-label={`笔记库：${vaultName}`}>
              <Layers aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium" title={vaultName}>{vaultName}</span><ChevronDown className="opacity-50" aria-hidden="true" />
            </SidebarMenuButton>} />
            <DropdownMenuContent side="top" align="start" className="w-64 rounded-lg">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">笔记库</DropdownMenuLabel>
                {(registeredVaults.length ? registeredVaults : connected && vaultId ? [{ vaultId, name: vaultName, active: true }] : []).map((vault, index) =>
                  <DropdownMenuItem key={vault.vaultId} aria-label={vault.name} className="gap-2 p-2" disabled={working} onClick={() => vault.active ? onNavigate("notes") : onActivateVault(vault.vaultId)}>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-xs border"><Layers className="size-4" /></span>
                    <span className="min-w-0 flex-1 truncate" title={vault.name}>{vault.name}</span>
                    {vault.active && <Check className="size-4" aria-label="当前笔记库" />}
                    {registeredVaults.length > 1 && index < 9 && <DropdownMenuShortcut aria-hidden="true">⌥{index + 1}</DropdownMenuShortcut>}
                  </DropdownMenuItem>)}
                <DropdownMenuSeparator />
                {canChooseVault && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={() => onSelectVault(false)}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><FolderOpen className="size-4" aria-hidden="true" /></span><span className="font-medium">打开已有笔记库</span></DropdownMenuItem>}
                {canCreateVault && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={() => onSelectVault(true)}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><FolderPlus className="size-4" aria-hidden="true" /></span><span className="font-medium">创建新笔记库</span></DropdownMenuItem>}
                {needsPermission && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={onReauthorize}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><ShieldCheck className="size-4" aria-hidden="true" /></span><span className="font-medium">重新授权文件夹</span></DropdownMenuItem>}
                <DropdownMenuItem className="gap-2 p-2" onClick={() => onNavigate("settings")}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><Settings2 className="size-4" aria-hidden="true" /></span><span className="font-medium">笔记库设置</span></DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>{hasVaultIssue && <p className="px-2 py-1 text-xs text-destructive">{vaultStatusText}</p>}</SidebarGroupContent></SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>;
}
