import { Suspense, useRef, useState } from "react";
import { workspaceActions, type WorkspaceNavigationProps } from "../business/navigation-model";
import { HugeiconsIcon } from "@hugeicons/react";
import Menu01Icon from "@hugeicons/core-free-icons/Menu01Icon";
import { Button } from "../components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/dropdown-menu";
import { recoverableLazy } from "../components/recoverable-lazy";
import { SidebarIcon } from "../business/sidebar-icons";
import { loadWebMoreDrawer } from "./loadWebMoreDrawer";

const WebMoreDrawer = recoverableLazy(loadWebMoreDrawer, "切换笔记库");

export function WebRailNavigation(p: WorkspaceNavigationProps) {
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const actions = workspaceActions(p);
  const activeView = p.view;
  const notesActive = activeView === "notes" && (!p.tag || Boolean(p.quickFilter));
  const tagsCurrent = activeView === "tags" || (activeView === "notes" && p.tag && !p.quickFilter) ? "page" : undefined;
  const vaultLabel = `笔记库：${p.vaultName}`;
  return <>
    <nav className="web-desktop-rail" aria-label="桌面导航" data-ui-tooltip-side="right">
      <Button variant="ghost" size="icon" className="web-top-logo" aria-label="MemoCard，返回主页" onClick={actions.home.run}><img src="./favicon.png" draggable={false} alt="" /></Button>
      <div className="web-rail-group" role="group" aria-label="主要入口">
        <Button variant="ghost" size="icon" aria-label="主页" data-ui-tooltip="主页" aria-current={activeView === "home" ? "page" : undefined} onClick={actions.home.run}><SidebarIcon name="home" /></Button>
        <Button variant="ghost" size="icon" aria-label={actions.newNote.label} data-ui-tooltip={actions.newNote.label} disabled={actions.newNote.disabled} onClick={actions.newNote.run}><SidebarIcon name="add" /></Button>
        <Button variant="ghost" size="icon" aria-label="搜索" data-ui-tooltip="搜索" aria-haspopup="dialog" aria-expanded={p.searchOpen} disabled={actions.search.disabled} onClick={actions.search.run}><SidebarIcon name="search" /></Button>
        <Button variant="ghost" size="icon" aria-label="笔记" data-ui-tooltip="笔记" aria-current={notesActive ? "page" : undefined} onClick={actions.notes.run}><SidebarIcon name="notebook" /></Button>
        <Button variant="ghost" size="icon" aria-label="标签" data-ui-tooltip="标签" aria-current={tagsCurrent} onClick={actions.tags.run}><SidebarIcon name="hash" /></Button>
      </div>
      <div className="web-rail-group web-rail-footer" role="group" aria-label="笔记库和设置">
        <Button ref={moreTrigger} variant="ghost" size="icon" aria-label={vaultLabel} data-ui-tooltip={vaultLabel}
          aria-haspopup="dialog" aria-expanded={Boolean(moreOpen)} aria-current={activeView === "trash" ? "page" : undefined} onClick={() => setMoreOpen(true)}><SidebarIcon name="layers" /></Button>
        <Button variant="ghost" size="icon" aria-label="设置" data-ui-tooltip="设置" aria-current={activeView === "settings" ? "page" : undefined} onClick={actions.settings.run}><SidebarIcon name="settings" /></Button>
      </div>
    </nav>
    {moreOpen !== null && <Suspense fallback={<span role="status" className="sr-only">正在打开笔记库…</span>}>
      <WebMoreDrawer navigation={p} open={moreOpen} onOpenChange={setMoreOpen} finalFocus={moreTrigger} />
    </Suspense>}
  </>;
}

export function WebDetailNavigation(p: WorkspaceNavigationProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const openSearch = useRef(false);
  const openedByHover = useRef(false);
  const actions = workspaceActions(p);
  // Base UI 1.9's Menu.Popup reads initialFocus at runtime but omits it from its public type.
  const hoverFocusProps = { initialFocus: () => !openedByHover.current };
  return <DropdownMenu onOpenChange={(open, event) => {
    if (open) openedByHover.current = event.reason === "trigger-hover";
  }}>
    <DropdownMenuTrigger openOnHover render={<Button ref={trigger} variant="ghost" size="icon" className="web-header-icon" aria-label="导航菜单" />}><HugeiconsIcon icon={Menu01Icon} strokeWidth={2} aria-hidden="true" /></DropdownMenuTrigger>
    <DropdownMenuContent aria-label="导航菜单" {...hoverFocusProps} finalFocus={() => {
      if (!openSearch.current) return true;
      openSearch.current = false;
      trigger.current?.focus();
      actions.search.run();
      return false;
    }}>
      <DropdownMenuItem onClick={actions.home.run}><SidebarIcon name="home" />主页</DropdownMenuItem>
      <DropdownMenuItem onClick={actions.notes.run}><SidebarIcon name="notebook" />笔记</DropdownMenuItem>
      <DropdownMenuItem onClick={actions.tags.run}><SidebarIcon name="hash" />标签</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={actions.newNote.disabled} onClick={actions.newNote.run}><SidebarIcon name="add" />{actions.newNote.label}</DropdownMenuItem>
      <DropdownMenuItem disabled={actions.search.disabled} onClick={() => { openSearch.current = true; }}><SidebarIcon name="search" />{actions.search.label}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
