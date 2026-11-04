import { useLayoutEffect, useState, type ReactNode } from "react";
import { workspaceActions, workspaceVaultActions, type WorkspaceNavigationProps } from "./navigation-model";
export type AppSidebarProps = WorkspaceNavigationProps;
import { Button } from "../components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Separator } from "../components/separator";
import { Sheet, SheetClose, SheetCloseButton, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/sheet";
import { Sidebar, SidebarContent, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuSub, SidebarRail, SidebarTrigger, useSidebar } from "../components/sidebar";
import { Skeleton } from "../components/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import { SidebarIcon } from "./sidebar-icons";
import { SidebarTreeItem } from "./sidebar-tree-item";
import { TagNavigation } from "./tag-navigation";
import "./sidebar.css";


export function AppSidebar(props: AppSidebarProps) {
  const { view, tag, quickFilter = null, filterCounts, tags, loadingTags = false, vaultName, vaultId, registeredVaults = [], onRenameTag, vaultStatusText, hasVaultIssue, canChooseVault, canCreateVault, needsPermission, working, onNavigate, onRefresh, draftCount = 0, onOpenDrafts } = props;
  const actions = workspaceActions(props);
  const { isMobile, setOpenMobile } = useSidebar();
  const [tagScroller, setTagScroller] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!tagScroller) return;
    const updateEdges = () => {
      tagScroller.toggleAttribute("data-overflow-top", tagScroller.scrollTop > 1);
      tagScroller.toggleAttribute("data-overflow-bottom", tagScroller.scrollTop + tagScroller.clientHeight < tagScroller.scrollHeight - 1);
    };
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(tagScroller);
    observer.observe(tagScroller.firstElementChild!);
    tagScroller.addEventListener("scroll", updateEdges, { passive: true });
    return () => { observer.disconnect(); tagScroller.removeEventListener("scroll", updateEdges); };
  }, [tagScroller]);
  const navigate: AppSidebarProps["onNavigate"] = (nextView, nextTag, nextFilter) => {
    onNavigate(nextView, nextTag, nextFilter);
    if (isMobile) setOpenMobile(false);
  };
  const action = (run: () => void) => () => { run(); if (isMobile) setOpenMobile(false); };
  const vaults = registeredVaults.length ? registeredVaults : props.connected && vaultId ? [{ vaultId, name: vaultName, active: true }] : [];
  const vaultTrigger = <Button type="button" variant="ghost" size="icon" className="ui-sidebar-brand-menu size-7 text-secondary max-md:size-element-lg" aria-label={`笔记库：${vaultName}`} data-ui-tooltip={`笔记库：${vaultName}`}>
    <SidebarIcon name="down" />
  </Button>;
  const vaultItems = <>
    {workspaceVaultActions(props, vaults).map((vault, index) => <VaultMenuItem key={vault.vaultId} mobile={isMobile} aria-label={vault.name} disabled={vault.disabled} onClick={action(vault.run)}>
      <span className="ui-sidebar-vault-icon"><SidebarIcon name="layers" /></span><span className="min-w-0 flex-1 truncate" data-ui-tooltip={vault.name} data-ui-tooltip-overflow>{vault.name}</span>{vault.active && <span aria-label="当前笔记库"><SidebarIcon name="check" /></span>}
      {!isMobile && registeredVaults.length > 1 && index < 9 && <DropdownMenuShortcut aria-hidden="true">⌥{index + 1}</DropdownMenuShortcut>}
    </VaultMenuItem>)}
    {isMobile ? <Separator className="my-2" /> : <DropdownMenuSeparator />}
    {canChooseVault && <VaultMenuItem mobile={isMobile} disabled={actions.openVault.disabled} onClick={actions.openVault.run}><span className="ui-sidebar-vault-icon"><SidebarIcon name="folder" /></span><span>{actions.openVault.label}</span></VaultMenuItem>}
    {canCreateVault && <VaultMenuItem mobile={isMobile} disabled={actions.createVault.disabled} onClick={actions.createVault.run}><span className="ui-sidebar-vault-icon"><SidebarIcon name="folderAdd" /></span><span>{actions.createVault.label}</span></VaultMenuItem>}
    {needsPermission && <VaultMenuItem mobile={isMobile} disabled={actions.reauthorize.disabled} onClick={action(actions.reauthorize.run)}><span className="ui-sidebar-vault-icon"><SidebarIcon name="shield" /></span><span>{actions.reauthorize.label}</span></VaultMenuItem>}
    {onRefresh && <VaultMenuItem mobile={isMobile} disabled={actions.refresh.disabled} onClick={action(actions.refresh.run)}><span className="ui-sidebar-vault-icon"><HugeiconsIcon icon={RefreshIcon} className="size-4" aria-hidden="true" /></span><span>{actions.refresh.label}</span></VaultMenuItem>}
    {onOpenDrafts && draftCount > 0 && <VaultMenuItem mobile={isMobile} onClick={action(actions.drafts.run)}><span className="ui-sidebar-vault-icon"><SidebarIcon name="notebook" /></span><span>{actions.drafts.label}</span></VaultMenuItem>}
    <VaultMenuItem mobile={isMobile} onClick={action(actions.settings.run)}><span className="ui-sidebar-vault-icon"><SidebarIcon name="settings" /></span><span>笔记库设置</span></VaultMenuItem>
    <VaultMenuItem mobile={isMobile} disabled={actions.trash.disabled} aria-current={view === "trash" ? "page" : undefined} onClick={action(actions.trash.run)}><span className="ui-sidebar-vault-icon"><SidebarIcon name="trash" /></span><span>{actions.trash.label}</span></VaultMenuItem>
    <VaultMenuItem mobile={isMobile} disabled data-ui-tooltip="帮助功能暂未开放"><span className="ui-sidebar-vault-icon"><SidebarIcon name="help" /></span><span>帮助</span></VaultMenuItem>
  </>;

  return <Sidebar id="desktop-sidebar" aria-label="笔记导航" className="ui-business-sidebar border-r-0 border-transparent">
    <SidebarHeader>
      <div className="ui-sidebar-brand-header flex w-full max-w-full items-center">
        {!isMobile && <SidebarTrigger className="ui-sidebar-logo-trigger" />}
        <Button type="button" variant="ghost" className="ui-sidebar-brand w-full min-w-0 justify-start" aria-label="MemoCard，返回主页" onClick={() => navigate("home", null)}><img src="./favicon.png" alt="" draggable={false} className="ui-sidebar-logo" /><span className="truncate text-base font-semibold">MemoCard</span></Button>
        {isMobile ? <Sheet><SheetTrigger render={vaultTrigger} /><SheetContent side="bottom" className="ui-sidebar-vault-sheet" showCloseButton={false} forceBackdrop swipeToClose swipeDisabled={working}><SheetHeader className="flex-row items-center justify-between p-0"><div><SheetTitle>笔记库</SheetTitle><SheetDescription className="sr-only">切换或管理笔记库。</SheetDescription></div><SheetCloseButton aria-label="关闭笔记库菜单" /></SheetHeader><div className="min-h-0 overflow-y-auto overscroll-contain">{vaultItems}</div></SheetContent></Sheet> : <DropdownMenu><DropdownMenuTrigger render={vaultTrigger} /><DropdownMenuContent side="bottom" align="end" className="w-64 p-1"><DropdownMenuGroup><DropdownMenuLabel className="text-xs text-secondary">笔记库</DropdownMenuLabel>{vaultItems}</DropdownMenuGroup></DropdownMenuContent></DropdownMenu>}
      </div>
      {hasVaultIssue && <p role="status" className="px-3 py-2 text-xs text-error">{vaultStatusText}</p>}
      <nav aria-label="主要导航"><SidebarMenu>
        {!isMobile && <>
          <SidebarTreeItem label={actions.search.label} icon={<SidebarIcon name="search" />} isActive={false} buttonProps={{ disabled: actions.search.disabled, onClick: action(actions.search.run) }} />
          <SidebarTreeItem label={actions.newNote.label} icon={<SidebarIcon name="add" />} isActive={false} buttonProps={{ disabled: actions.newNote.disabled, onClick: action(actions.newNote.run) }} />
        </>}
        <SidebarTreeItem label={actions.home.label} icon={<SidebarIcon name="home" />} isActive={view === "home"} buttonProps={{ onClick: action(actions.home.run) }} />
        <SidebarTreeItem label={actions.notes.label} icon={<SidebarIcon name="notebook" />} buttonProps={{ onClick: action(actions.notes.run) }} isActive={view === "notes" && !tag && !quickFilter} defaultOpen={false} toggleLabel="展开或收起快捷筛选">
          <SidebarMenuSub className="mr-0 translate-x-0 pr-0">{actions.filters.map(filter => <SidebarTreeItem key={filter.id} nested label={filter.label} icon={<SidebarIcon name={filter.icon} />} isActive={view === "notes" && quickFilter === filter.id} buttonProps={{ disabled: filter.disabled, onClick: action(filter.run), "aria-label": filter.label, "aria-description": filterCounts ? `${filterCounts[filter.id]} 条笔记` : undefined }} accessories={filterCounts && <SidebarMenuBadge aria-hidden="true">{filterCounts[filter.id]}</SidebarMenuBadge>} />)}</SidebarMenuSub>
        </SidebarTreeItem>
        <SidebarTreeItem label="日历" icon={<SidebarIcon name="calendar" />} isActive={false} buttonProps={{ "aria-disabled": "true", className: "aria-disabled:opacity-100", "data-ui-tooltip": "日历功能暂未开放" }} />
        <SidebarTreeItem label={actions.tags.label} icon={<SidebarIcon name="hash" />} isActive={view === "tags"} buttonProps={{ onClick: action(actions.tags.run) }} />
      </SidebarMenu></nav>
    </SidebarHeader>
    <SidebarContent ref={setTagScroller} className="ui-sidebar-tag-scroll" onFocusCapture={event => {
      if (document.documentElement.dataset.uiInputModality === "keyboard") event.target.scrollIntoView({ block: "nearest" });
    }}><div className="ui-sidebar-tag-scroll-body">{loadingTags ? <SidebarGroup role="status" aria-label="正在读取标签"><div className="grid gap-3 p-2">{[0, 1, 2].map(index => <Skeleton key={index} className="h-element-sm rounded-full" />)}</div></SidebarGroup> : <TagNavigation key={vaultId || "disconnected"} vaultId={vaultId} onRename={onRenameTag} tags={tags} selected={view === "notes" ? tag : null} onSelect={path => navigate("notes", path)} />}</div></SidebarContent>
    <SidebarRail />
  </Sidebar>;
}

function VaultMenuItem({ mobile, children, ...props }: { mobile: boolean; children: ReactNode; disabled?: boolean; onClick?: () => void; "aria-label"?: string; "aria-current"?: "page"; "data-ui-tooltip"?: string }) {
  return mobile ? <SheetClose render={<Button type="button" variant="ghost" className="ui-sidebar-vault-menu-item" />} {...props}>{children}</SheetClose> : <DropdownMenuItem className="gap-2 p-2" {...props}>{children}</DropdownMenuItem>;
}
