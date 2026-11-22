import { Suspense, useRef, useState } from "react";
import { workspaceActions, type WorkspaceNavigationProps } from "../business/navigation-model";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowLeft02Icon from "@hugeicons/core-free-icons/ArrowLeft02Icon";
import EqualIcon from "@hugeicons/core-free-icons/EqualIcon";
import { Button } from "../components/button";
import { recoverableLazy } from "../components/recoverable-lazy";
import { tabsListVariants, tabsPillTriggerStyles } from "../components/tabs";
import { SidebarIcon } from "../business/sidebar-icons";
import { cn } from "../lib/utils";
import { loadWebMoreDrawer } from "./loadWebMoreDrawer";

const WebMoreDrawer = recoverableLazy(loadWebMoreDrawer, "更多");

export function WebTopNavigation(p: WorkspaceNavigationProps) {
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const actions = workspaceActions(p);
  const activeView = p.detailView ? undefined : p.view;
  const notesActive = activeView === "notes" && (!p.tag || Boolean(p.quickFilter));
  const tagsCurrent = activeView === "tags" || (activeView === "notes" && p.tag && !p.quickFilter) ? "page" : undefined;
  const moreActive = activeView === "settings" || activeView === "trash";
  return <><header className="web-topbar" data-ui-tooltip-side="bottom"><div className="web-topbar-inner">
    <div className="web-top-brand">
      {p.detailBack
        ? <Button variant="ghost" size="icon" className="web-top-icon" aria-label={p.detailBack.label} onClick={p.detailBack.run}>
          <HugeiconsIcon icon={ArrowLeft02Icon} viewBox="2 2 20 20" aria-hidden="true" />
        </Button>
        : <Button variant="ghost" size="icon" className="web-top-logo" aria-label="MemoCard，返回主页" onClick={actions.home.run}><img src="./favicon.png" draggable={false} alt="" /></Button>}
    </div>
    <nav aria-label="顶部导航" data-variant="pill" data-transparent-inactive className={cn(tabsListVariants({ variant: "pill" }), "web-top-links rounded-none")}>
      <Button variant="ghost" data-slot="tabs-trigger" className={tabsPillTriggerStyles} aria-current={activeView === "home" ? "page" : undefined} onClick={actions.home.run}>{actions.home.label}</Button>
      <Button variant="ghost" data-slot="tabs-trigger" className={tabsPillTriggerStyles} aria-current={notesActive ? "page" : undefined} onClick={actions.notes.run}>笔记</Button>
      <Button variant="ghost" data-slot="tabs-trigger" className={tabsPillTriggerStyles} aria-current={tagsCurrent} onClick={actions.tags.run}>{actions.tags.label}</Button>
    </nav>
    <div className="web-top-actions">
      <Button variant="ghost" size="icon" className="web-top-icon" aria-label={actions.newNote.label}
        data-ui-tooltip={actions.newNote.label} disabled={actions.newNote.disabled} onClick={actions.newNote.run}><SidebarIcon name="add" /></Button>
      <Button variant="ghost" size="icon" className="web-top-icon" aria-label="搜索" data-ui-tooltip="搜索" aria-haspopup="dialog" aria-expanded={p.searchOpen} disabled={actions.search.disabled} onClick={actions.search.run}><SidebarIcon name="search" /></Button>
      <Button ref={moreTrigger} variant="ghost" size="icon" className="web-top-icon" aria-label="更多" data-ui-tooltip="更多" aria-haspopup="dialog" aria-expanded={Boolean(moreOpen)} aria-current={moreActive ? "page" : undefined} onClick={() => setMoreOpen(true)}><HugeiconsIcon icon={EqualIcon} strokeWidth={2} aria-hidden="true" /></Button>
    </div>
  </div></header>
    {moreOpen !== null && <Suspense fallback={<span role="status" className="sr-only">正在打开更多…</span>}>
      <WebMoreDrawer fromTopbar navigation={p} open={moreOpen} onOpenChange={setMoreOpen} finalFocus={moreTrigger} />
    </Suspense>}
  </>;
}
