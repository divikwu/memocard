import type { ReactNode } from "react";
import type { NoteQuickFilter } from "@memocard/contracts";
import type { AppSidebarProps } from "../../src/components/app-sidebar";
import { Button } from "../components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Separator } from "../components/separator";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/sheet";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarRail, SidebarTrigger, useSidebar } from "../components/sidebar";
import { Skeleton } from "../components/skeleton";
import { SidebarIcon } from "./sidebar-icons";
import { SidebarTreeItem } from "./sidebar-tree-item";
import { TagNavigation } from "./tag-navigation";
import "./sidebar.css";

export type { AppSidebarProps };

const filters: { id: NoteQuickFilter; label: string; icon: "hash" | "image" | "link" }[] = [
  { id: "untagged", label: "无标签", icon: "hash" },
  { id: "images", label: "有图片", icon: "image" },
  { id: "links", label: "有链接", icon: "link" },
];

export function AppSidebar({ view, tag, quickFilter = null, filterCounts, tags, loadingTags = false, vaultName, vaultId, registeredVaults = [], onRenameTag, connected = false, canTrash = false, vaultStatusText, hasVaultIssue, canCreate, canChooseVault, canCreateVault, needsPermission, working, onNavigate, onNewNote, onSearch, onSelectVault, onActivateVault, onReauthorize }: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const navigate: AppSidebarProps["onNavigate"] = (nextView, nextTag, nextFilter) => {
    onNavigate(nextView, nextTag, nextFilter);
    if (isMobile) setOpenMobile(false);
  };
  const action = (run: () => void) => () => { run(); if (isMobile) setOpenMobile(false); };
  const vaults = registeredVaults.length ? registeredVaults : connected && vaultId ? [{ vaultId, name: vaultName, active: true }] : [];
  const vaultTrigger = <SidebarMenuButton className="next-sidebar-row w-full data-popup-open:bg-muted" aria-label={`笔记库：${vaultName}`}>
    <SidebarIcon name="layers" /><span className="min-w-0 flex-1 truncate font-medium" title={vaultName}>{vaultName}</span><SidebarIcon name="down" className="text-secondary" />
  </SidebarMenuButton>;
  const vaultItems = <>
    {vaults.map((vault, index) => <VaultMenuItem key={vault.vaultId} mobile={isMobile} aria-label={vault.name} disabled={working} onClick={vault.active ? () => navigate("notes") : action(() => onActivateVault(vault.vaultId))}>
      <span className="next-sidebar-vault-icon"><SidebarIcon name="layers" /></span><span className="min-w-0 flex-1 truncate" title={vault.name}>{vault.name}</span>{vault.active && <span aria-label="当前笔记库"><SidebarIcon name="check" /></span>}
      {!isMobile && registeredVaults.length > 1 && index < 9 && <DropdownMenuShortcut aria-hidden="true">⌥{index + 1}</DropdownMenuShortcut>}
    </VaultMenuItem>)}
    {isMobile ? <Separator className="my-2" /> : <DropdownMenuSeparator />}
    {canChooseVault && <VaultMenuItem mobile={isMobile} disabled={working} onClick={action(() => onSelectVault(false))}><span className="next-sidebar-vault-icon"><SidebarIcon name="folder" /></span><span>打开已有笔记库</span></VaultMenuItem>}
    {canCreateVault && <VaultMenuItem mobile={isMobile} disabled={working} onClick={action(() => onSelectVault(true))}><span className="next-sidebar-vault-icon"><SidebarIcon name="folderAdd" /></span><span>创建新笔记库</span></VaultMenuItem>}
    {needsPermission && <VaultMenuItem mobile={isMobile} disabled={working} onClick={action(onReauthorize)}><span className="next-sidebar-vault-icon"><SidebarIcon name="shield" /></span><span>重新授权文件夹</span></VaultMenuItem>}
    <VaultMenuItem mobile={isMobile} onClick={() => navigate("settings")}><span className="next-sidebar-vault-icon"><SidebarIcon name="settings" /></span><span>笔记库设置</span></VaultMenuItem>
    <VaultMenuItem mobile={isMobile} disabled={!connected || !canTrash} aria-current={view === "trash" ? "page" : undefined} onClick={() => navigate("trash")}><span className="next-sidebar-vault-icon"><SidebarIcon name="trash" /></span><span>回收站</span></VaultMenuItem>
    <VaultMenuItem mobile={isMobile} disabled title="帮助功能暂未开放"><span className="next-sidebar-vault-icon"><SidebarIcon name="help" /></span><span>帮助</span></VaultMenuItem>
  </>;

  return <Sidebar id="desktop-sidebar" aria-label="笔记导航" className="next-business-sidebar border-r-0">
    <SidebarHeader>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" className="next-sidebar-brand min-w-0 flex-1 justify-start" aria-label="MemoCard，返回主页" onClick={() => navigate("home", null)}><img src="./favicon.png" alt="" draggable={false} className="next-sidebar-logo" /><span className="truncate text-base font-semibold">MemoCard</span></Button>
        {!isMobile && <SidebarTrigger className="shrink-0" />}
      </div>
      <nav aria-label="主要导航"><SidebarMenu>
        {!isMobile && <>
          <SidebarMenuItem><SidebarMenuButton className="next-sidebar-row" disabled={!connected} onClick={action(onSearch)} title="搜索 (⌘ / Ctrl K)"><SidebarIcon name="search" /><span>搜索</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton className="next-sidebar-row" disabled={!canCreate || working} onClick={action(onNewNote)}><SidebarIcon name="add" /><span>新建笔记</span></SidebarMenuButton></SidebarMenuItem>
        </>}
        <SidebarMenuItem><SidebarMenuButton className="next-sidebar-row" isActive={view === "home"} aria-current={view === "home" ? "page" : undefined} onClick={() => navigate("home")}><SidebarIcon name="home" /><span>主页</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarTreeItem label="所有笔记" icon={<SidebarIcon name="notebook" />} buttonProps={{ onClick: () => navigate("notes", null) }} isActive={view === "notes" && !tag && !quickFilter} defaultOpen={false} toggleLabel="展开或收起快捷筛选">
          <SidebarMenuSub className="mr-0 translate-x-0 pr-0">{filters.map(filter => <SidebarTreeItem key={filter.id} nested label={filter.label} icon={<SidebarIcon name={filter.icon} />} isActive={view === "notes" && quickFilter === filter.id} buttonProps={{ disabled: !connected, onClick: () => navigate("notes", null, filter.id), "aria-label": filter.label, "aria-description": filterCounts ? `${filterCounts[filter.id]} 条笔记` : undefined }} accessories={filterCounts && <SidebarMenuBadge aria-hidden="true">{filterCounts[filter.id]}</SidebarMenuBadge>} />)}</SidebarMenuSub>
        </SidebarTreeItem>
        <SidebarMenuItem><SidebarMenuButton aria-disabled="true" className="next-sidebar-row aria-disabled:opacity-100" title="日历功能暂未开放"><SidebarIcon name="calendar" /><span>日历</span></SidebarMenuButton></SidebarMenuItem>
      </SidebarMenu></nav>
    </SidebarHeader>
    <SidebarContent>{loadingTags ? <SidebarGroup role="status" aria-label="正在读取标签"><div className="grid gap-3 p-2">{[0, 1, 2].map(index => <Skeleton key={index} className="h-element-sm rounded-full" />)}</div></SidebarGroup> : <TagNavigation key={vaultId || "disconnected"} vaultId={vaultId} onRename={onRenameTag} tags={tags} selected={view === "notes" ? tag : null} onSelect={path => navigate("notes", path)} />}</SidebarContent>
    <SidebarFooter className="shrink-0"><SidebarGroup className="p-0"><SidebarGroupContent><SidebarMenu><SidebarMenuItem>
      {isMobile ? <Sheet><SheetTrigger render={vaultTrigger} /><SheetContent side="bottom" className="next-sidebar-vault-sheet" showCloseButton={false} forceBackdrop swipeToClose swipeDisabled={working}><SheetHeader className="flex-row items-center justify-between p-0"><div><SheetTitle>笔记库</SheetTitle><SheetDescription className="sr-only">切换或管理笔记库。</SheetDescription></div><SheetClose render={<Button type="button" variant="ghost" size="icon-sm" aria-label="关闭笔记库菜单" />}><SidebarIcon name="close" /></SheetClose></SheetHeader><div className="min-h-0 overflow-y-auto overscroll-contain">{vaultItems}</div></SheetContent></Sheet> : <DropdownMenu><DropdownMenuTrigger render={vaultTrigger} /><DropdownMenuContent side="top" align="start" className="w-64"><DropdownMenuGroup><DropdownMenuLabel className="text-xs text-secondary">笔记库</DropdownMenuLabel>{vaultItems}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu>}
    </SidebarMenuItem></SidebarMenu>{hasVaultIssue && <p role="status" className="px-3 py-2 text-xs text-error">{vaultStatusText}</p>}</SidebarGroupContent></SidebarGroup></SidebarFooter>
    <SidebarRail />
  </Sidebar>;
}

function VaultMenuItem({ mobile, children, ...props }: { mobile: boolean; children: ReactNode; disabled?: boolean; onClick?: () => void; "aria-label"?: string; "aria-current"?: "page"; title?: string }) {
  return mobile ? <SheetClose render={<Button type="button" variant="ghost" className="next-sidebar-vault-menu-item" />} {...props}>{children}</SheetClose> : <DropdownMenuItem className="gap-2 p-2" {...props}>{children}</DropdownMenuItem>;
}
