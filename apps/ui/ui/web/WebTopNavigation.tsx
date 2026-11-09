import { useState } from "react";
import { workspaceActions, workspaceVaultActions, type WorkspaceNavigationProps } from "../business/navigation-model";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft02Icon from "@hugeicons/core-free-icons/ArrowLeft02Icon";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import { Button } from "../components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "../components/popover";
import { SidebarGroup, SidebarMenu, SidebarProvider, SidebarSeparator } from "../components/sidebar";
import { tabsListVariants, tabsPillTriggerStyles } from "../components/tabs";
import { SidebarIcon } from "../business/sidebar-icons";
import { SidebarTreeItem } from "../business/sidebar-tree-item";
import { TagNavigation } from "../business/tag-navigation";
import { cn } from "../lib/utils";
import "./layouts/topbar.css";

export function WebTopNavigation(p: WorkspaceNavigationProps) {
  const [tagsOpen, setTagsOpen] = useState(false);
  const actions = workspaceActions(p);
  const activeView = p.detailView ? undefined : p.view;
  const moreActive = activeView === "settings" || activeView === "trash" || (activeView === "notes" && Boolean(p.quickFilter));
  return <header className="web-topbar"><div className="web-topbar-inner">
    <div className="web-top-brand">
      {p.detailBack
        ? <Button variant="ghost" size="icon" className="web-top-back" aria-label={p.detailBack.label} onClick={p.detailBack.run}>
          <HugeiconsIcon icon={ArrowLeft02Icon} viewBox="2 2 20 20" aria-hidden="true" />
        </Button>
        : <Button variant="ghost" size="icon" className="web-top-logo" aria-label="MemoCard，返回主页" onClick={actions.home.run}><img src="./favicon.png" draggable={false} alt="" /></Button>}
    </div>
    <nav aria-label="顶部导航" data-variant="pill" data-transparent-inactive className={cn(tabsListVariants({ variant: "pill" }), "web-top-links rounded-none")}>
      <Button variant="ghost" data-slot="tabs-trigger" className={tabsPillTriggerStyles} aria-current={activeView === "home" ? "page" : undefined} onClick={actions.home.run}>{actions.home.label}</Button>
      <Button variant="ghost" data-slot="tabs-trigger" className={tabsPillTriggerStyles} aria-current={activeView === "notes" && !p.tag && !p.quickFilter ? "page" : undefined} onClick={actions.notes.run}>{actions.notes.label}</Button>
      <Popover open={tagsOpen} onOpenChange={setTagsOpen}><PopoverTrigger render={<Button variant="ghost" data-slot="tabs-trigger" className={tabsPillTriggerStyles} aria-current={activeView === "tags" || (activeView === "notes" && p.tag && !p.quickFilter) ? "page" : undefined} />}>{actions.tags.label}</PopoverTrigger><PopoverContent className="web-top-menu web-top-tags" align="start" collisionPadding={12}>
        <PopoverTitle className="sr-only">浏览标签</PopoverTitle>
        <SidebarProvider persistState={false} className="ui-business-sidebar web-top-tag-tree">
          <SidebarGroup><SidebarMenu><SidebarTreeItem label="所有标签" icon={<SidebarIcon name="hash" />} isActive={p.view === "tags"} buttonProps={{ onClick: () => { setTagsOpen(false); actions.tags.run(); } }} /></SidebarMenu></SidebarGroup>
          <SidebarSeparator />
          <TagNavigation key={p.vaultId || "disconnected"} vaultId={p.vaultId} tags={p.tags} selected={p.view === "notes" ? p.tag : null} onRename={p.onRenameTag} onSelect={tag => { setTagsOpen(false); p.onNavigate("notes", tag); }} />
        </SidebarProvider>
      </PopoverContent></Popover>
      <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" data-slot="tabs-trigger" className={tabsPillTriggerStyles} aria-current={moreActive ? "page" : undefined} />}>更多</DropdownMenuTrigger><DropdownMenuContent align="start" className="web-top-menu">
        <DropdownMenuItem onClick={actions.settings.run}><SidebarIcon name="settings" />{actions.settings.label}</DropdownMenuItem>
        <DropdownMenuItem disabled={actions.trash.disabled} onClick={actions.trash.run}><SidebarIcon name="trash" />{actions.trash.label}</DropdownMenuItem>
        {(p.draftCount ?? 0) > 0 && <DropdownMenuItem onClick={actions.drafts.run}><SidebarIcon name="notebook" />{actions.drafts.label}</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuGroup><DropdownMenuLabel>快捷筛选</DropdownMenuLabel>
          {actions.filters.map(filter => <DropdownMenuItem key={filter.id} disabled={filter.disabled} onClick={filter.run}><SidebarIcon name={filter.icon} />{filter.label}</DropdownMenuItem>)}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup><DropdownMenuLabel className="truncate">{p.vaultName}</DropdownMenuLabel>
        {workspaceVaultActions(p).map(vault => <DropdownMenuItem key={vault.vaultId} disabled={vault.disabled} onClick={vault.run}><SidebarIcon name="layers" /><span className="min-w-0 flex-1 truncate">{vault.name}</span>{vault.active && <span aria-label="当前笔记库"><SidebarIcon name="check" /></span>}</DropdownMenuItem>)}
        {p.canChooseVault && <DropdownMenuItem disabled={actions.openVault.disabled} onClick={actions.openVault.run}><SidebarIcon name="folder" />{actions.openVault.label}</DropdownMenuItem>}
        {p.canCreateVault && <DropdownMenuItem disabled={actions.createVault.disabled} onClick={actions.createVault.run}><SidebarIcon name="folderAdd" />{actions.createVault.label}</DropdownMenuItem>}
        {p.needsPermission && <DropdownMenuItem disabled={actions.reauthorize.disabled} onClick={actions.reauthorize.run}><SidebarIcon name="shield" />{actions.reauthorize.label}</DropdownMenuItem>}
        <DropdownMenuItem disabled={actions.refresh.disabled} onClick={actions.refresh.run}><HugeiconsIcon icon={RefreshIcon} strokeWidth={2} aria-hidden="true" className="size-4" />{actions.refresh.label}</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent></DropdownMenu>
    </nav>
    <div className="web-top-actions">
      <Button variant="ghost" size="icon" className="web-top-search" aria-label="搜索" aria-haspopup="dialog" aria-expanded={p.searchOpen} disabled={actions.search.disabled} onClick={actions.search.run}><SidebarIcon name="search" /></Button>
    </div>
  </div></header>;
}
