// Sidebar-10 composition, adapted from the official registry snapshot in docs/ui-reference.
import { Check, ChevronDown, FilePenLine, Files, FolderOpen, FolderPlus, Layers, Plus, Search, Settings2, ShieldCheck } from "lucide-react";
import type { RegisteredVault } from "../bridge";
import { TagNavigation } from "./tag-navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge, SidebarRail } from "@/components/ui/sidebar";

type SidebarView = "notes" | "drafts" | "settings";

export interface AppSidebarProps {
  view: SidebarView;
  tag: string | null;
  tags: { name: string; count: number }[];
  draftCount: number;
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
  onNavigate: (view: SidebarView, tag?: string | null) => void;
  onNewNote: () => void;
  onSearch: () => void;
  onSelectVault: (create: boolean) => void;
  onActivateVault: (vaultId: string) => void;
  onReauthorize: () => void;
}


export function AppSidebar({ view, tag, tags, draftCount, vaultName, vaultId, registeredVaults = [], onRenameTag, connected = false, vaultStatusText, hasVaultIssue,
  canCreate, canChooseVault, canCreateVault, needsPermission, working,
  onNavigate, onNewNote, onSearch, onSelectVault, onActivateVault, onReauthorize,
}: AppSidebarProps) {
  return <Sidebar id="desktop-sidebar" aria-label="笔记导航" className="border-r-0">
    <SidebarHeader>
      <SidebarMenu><SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><SidebarMenuButton className="w-fit max-w-full px-1.5" aria-label={`笔记库：${vaultName}`}>
            <span className="flex aspect-square size-5 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"><Layers className="size-3" aria-hidden="true" /></span>
            <span className="truncate font-medium" title={vaultName}>{vaultName}</span><ChevronDown className="opacity-50" aria-hidden="true" />
          </SidebarMenuButton></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-lg">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">笔记库</DropdownMenuLabel>
              {(registeredVaults.length ? registeredVaults : connected && vaultId ? [{ vaultId, name: vaultName, active: true }] : []).map(vault =>
                <DropdownMenuItem key={vault.vaultId} className="gap-2 p-2" disabled={working} onClick={() => vault.active ? onNavigate("notes") : onActivateVault(vault.vaultId)}>
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-xs border"><Layers className="size-4" /></span>
                  <span className="min-w-0 flex-1 truncate" title={vault.name}>{vault.name}</span>
                  {vault.active && <Check className="size-4" aria-label="当前笔记库" />}
                </DropdownMenuItem>)}
              <DropdownMenuSeparator />
              {canChooseVault && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={() => onSelectVault(false)}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><FolderOpen className="size-4" aria-hidden="true" /></span><span className="font-medium text-muted-foreground">打开已有笔记库</span></DropdownMenuItem>}
              {canCreateVault && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={() => onSelectVault(true)}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><FolderPlus className="size-4" aria-hidden="true" /></span><span className="font-medium text-muted-foreground">创建新笔记库</span></DropdownMenuItem>}
              {needsPermission && <DropdownMenuItem className="gap-2 p-2" disabled={working} onClick={onReauthorize}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><ShieldCheck className="size-4" aria-hidden="true" /></span><span className="font-medium text-muted-foreground">重新授权文件夹</span></DropdownMenuItem>}
              <DropdownMenuItem className="gap-2 p-2" onClick={() => onNavigate("settings")}><span className="flex size-6 items-center justify-center rounded-md border bg-background"><Settings2 className="size-4" aria-hidden="true" /></span><span className="font-medium text-muted-foreground">笔记库设置</span></DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem></SidebarMenu>
      <nav aria-label="主要导航"><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton disabled={!connected} onClick={onSearch}><Search /><span>搜索</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton disabled={!canCreate || working} onClick={onNewNote}><Plus /><span>新建笔记</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton isActive={view === "notes" && !tag} onClick={() => onNavigate("notes", null)}><Files /><span>所有笔记</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton isActive={view === "drafts"} onClick={() => onNavigate("drafts")}><FilePenLine /><span>草稿</span>{draftCount > 0 && <span className="sr-only">{draftCount} 条草稿</span>}</SidebarMenuButton>{draftCount > 0 && <SidebarMenuBadge aria-hidden="true">{draftCount}</SidebarMenuBadge>}</SidebarMenuItem>
      </SidebarMenu></nav>
    </SidebarHeader>
    <SidebarContent>
      <TagNavigation key={vaultId || "disconnected"} vaultId={vaultId} onRename={onRenameTag} tags={tags} selected={view === "notes" ? tag : null} onSelect={name => onNavigate("notes", name)} />
      <SidebarGroup className="mt-auto"><SidebarGroupContent><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton isActive={view === "settings"} onClick={() => onNavigate("settings")}><Settings2 /><span>设置</span></SidebarMenuButton></SidebarMenuItem>
      </SidebarMenu>{hasVaultIssue && <p className="px-2 py-1 text-xs text-destructive">{vaultStatusText}</p>}</SidebarGroupContent></SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>;
}
