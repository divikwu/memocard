import { useRef } from "react";
import { workspaceActions, type WorkspaceNavigationProps } from "../business/navigation-model";
import { HugeiconsIcon } from "@hugeicons/react";
import Menu01Icon from "@hugeicons/core-free-icons/Menu01Icon";
import { Button } from "../components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/dropdown-menu";
import Moon02Icon from "@hugeicons/core-free-icons/Moon02Icon";
import Sun03Icon from "@hugeicons/core-free-icons/Sun03Icon";
import { useSlidingHover } from "../components/sliding-hover";
import { SidebarIcon } from "../business/sidebar-icons";
import { useWebAppearance } from "./WebAppearance";
import { usePreviewMode } from "../preview-mode";

export function WebRailNavigation(p: WorkspaceNavigationProps) {
  const appearance = useWebAppearance();
  const mode = usePreviewMode();
  const actions = workspaceActions(p);
  const activeView = p.view;
  const notesActive = activeView === "notes" && (!p.tag || Boolean(p.quickFilter));
  const tagsCurrent = activeView === "tags" || (activeView === "notes" && p.tag && !p.quickFilter) ? "page" : undefined;
  return <nav className="web-desktop-rail" aria-label="桌面导航" data-ui-tooltip-side="right">
      <Button variant="ghost" size="icon" className="web-top-logo" aria-label="MemoCard，返回主页" onClick={actions.home.run}><img src="./favicon.png" draggable={false} alt="" /></Button>
      <div role="group" className="web-rail-group web-rail-primary" aria-label="主要入口">
        <Button variant="ghost" size="icon" aria-label="主页" data-ui-tooltip="主页" aria-current={activeView === "home" ? "page" : undefined} onClick={actions.home.run}><SidebarIcon name="home" /></Button>
        <Button variant="ghost" size="icon" aria-label={actions.newNote.label} data-ui-tooltip={actions.newNote.label} disabled={actions.newNote.disabled} onClick={actions.newNote.run}><SidebarIcon name="add" /></Button>
        <Button variant="ghost" size="icon" aria-label="搜索" data-ui-tooltip="搜索" aria-haspopup="dialog" aria-expanded={p.searchOpen} disabled={actions.search.disabled} onClick={actions.search.run}><SidebarIcon name="search" /></Button>
        <Button variant="ghost" size="icon" aria-label="笔记" data-ui-tooltip="笔记" aria-current={notesActive ? "page" : undefined} onClick={actions.notes.run}><SidebarIcon name="notebook" /></Button>
        <Button variant="ghost" size="icon" aria-label="标签" data-ui-tooltip="标签" aria-current={tagsCurrent} onClick={actions.tags.run}><SidebarIcon name="hash" /></Button>
      </div>
      <div role="group" className="web-rail-group web-rail-footer" aria-label="外观和设置">
        <DropdownMenu>
          <DropdownMenuTrigger disabled={!appearance} render={<Button variant="ghost" size="icon" aria-label="颜色模式" data-ui-tooltip="颜色模式" />}>
            <HugeiconsIcon icon={mode === "dark" ? Moon02Icon : Sun03Icon} strokeWidth={2} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" aria-label="颜色模式">
            <DropdownMenuRadioGroup value={appearance?.value.theme} onValueChange={theme => {
              if (theme === "light" || theme === "dark" || theme === "system") appearance?.onChange({ ...appearance.value, theme });
            }}>
              <DropdownMenuRadioItem closeOnClick value="light">浅色</DropdownMenuRadioItem>
              <DropdownMenuRadioItem closeOnClick value="dark">深色</DropdownMenuRadioItem>
              <DropdownMenuRadioItem closeOnClick value="system">跟随系统</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" aria-label="设置" data-ui-tooltip="设置" aria-current={activeView === "settings" ? "page" : undefined} onClick={actions.settings.run}><SidebarIcon name="settings" /></Button>
      </div>
    </nav>;
}

export function WebDetailNavigation(p: WorkspaceNavigationProps) {
  const hover = useSlidingHover();
  const trigger = useRef<HTMLButtonElement>(null);
  const openSearch = useRef(false);
  const openedByHover = useRef(false);
  const actions = workspaceActions(p);
  // Base UI 1.9's Menu.Popup reads initialFocus at runtime but omits it from its public type.
  const hoverFocusProps = { initialFocus: () => !openedByHover.current };
  return <DropdownMenu onOpenChange={(open, event) => {
    if (open) openedByHover.current = event.reason === "trigger-hover";
    else hover.onPointerLeave();
  }}>
    <DropdownMenuTrigger openOnHover render={<Button ref={trigger} variant="ghost" size="icon" className="web-header-icon" aria-label="导航菜单" />}><HugeiconsIcon icon={Menu01Icon} strokeWidth={2} aria-hidden="true" /></DropdownMenuTrigger>
    <DropdownMenuContent aria-label="导航菜单" className="ui-slide-hover" {...hoverFocusProps} {...hover}
      onKeyDownCapture={hover.onPointerLeave}
      finalFocus={() => {
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
