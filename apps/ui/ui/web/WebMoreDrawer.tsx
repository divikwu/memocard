import type { RefObject } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import { workspaceActions, workspaceVaultActions, type WorkspaceNavigationProps } from "../business/navigation-model";
import { SidebarIcon } from "../business/sidebar-icons";
import { Button } from "../components/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "../components/drawer";
import { Separator } from "../components/separator";

export default function WebMoreDrawer({ navigation: p, open, onOpenChange, finalFocus }: {
  navigation: WorkspaceNavigationProps; open: boolean; onOpenChange: (open: boolean) => void; finalFocus: RefObject<HTMLButtonElement | null>;
}) {
  const actions = workspaceActions(p);
  return <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
    <DrawerContent finalFocus={finalFocus}>
      <DrawerHeader className="flex-row items-center justify-between gap-2 px-4 py-1 text-start md:pl-6 md:pr-3.5 md:pt-4 md:pb-0">
        <DrawerTitle className="min-w-0 text-base font-semibold md:text-xl md:font-medium">更多</DrawerTitle>
        <DrawerClose render={<Button variant="ghost" size="icon" aria-label="关闭更多" />}><SidebarIcon name="close" /></DrawerClose>
      </DrawerHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 px-4 pt-2 pb-4">
        {(p.draftCount ?? 0) > 0 && <>
          <DrawerClose render={<Button variant="ghost" className="web-top-more-item" />} disabled={actions.drafts.disabled} onClick={actions.drafts.run}><SidebarIcon name="notebook" />{actions.drafts.label}</DrawerClose>
          <Separator className="mx-2 data-horizontal:w-auto" />
        </>}
        <div role="group" aria-label="笔记库" className="space-y-1">
          <h3 className="truncate px-2 py-2 text-xs text-secondary">{p.vaultName}</h3>
          {workspaceVaultActions(p).map(vault => <DrawerClose key={vault.vaultId} render={<Button variant="ghost" className="web-top-more-item" />} disabled={vault.disabled} onClick={vault.run}><SidebarIcon name="layers" /><span className="min-w-0 flex-1 truncate">{vault.name}</span>{vault.active && <span aria-label="当前笔记库"><SidebarIcon name="check" /></span>}</DrawerClose>)}
          {p.canChooseVault && <DrawerClose render={<Button variant="ghost" className="web-top-more-item" />} disabled={actions.openVault.disabled} onClick={actions.openVault.run}><SidebarIcon name="folder" />{actions.openVault.label}</DrawerClose>}
          {p.canCreateVault && <DrawerClose render={<Button variant="ghost" className="web-top-more-item" />} disabled={actions.createVault.disabled} onClick={actions.createVault.run}><SidebarIcon name="folderAdd" />{actions.createVault.label}</DrawerClose>}
          {p.needsPermission && <DrawerClose render={<Button variant="ghost" className="web-top-more-item" />} disabled={actions.reauthorize.disabled} onClick={actions.reauthorize.run}><SidebarIcon name="shield" />{actions.reauthorize.label}</DrawerClose>}
          <DrawerClose render={<Button variant="ghost" className="web-top-more-item" />} disabled={actions.refresh.disabled} onClick={actions.refresh.run}><HugeiconsIcon icon={RefreshIcon} strokeWidth={2} aria-hidden="true" />{actions.refresh.label}</DrawerClose>
        </div>
        <Separator className="mx-2 data-horizontal:w-auto" />
        <div className="space-y-1">
          <DrawerClose render={<Button variant="ghost" className="web-top-more-item" />} onClick={actions.settings.run}><SidebarIcon name="settings" />{actions.settings.label}</DrawerClose>
          <DrawerClose render={<Button variant="ghost" className="web-top-more-item" />} disabled={actions.trash.disabled} onClick={actions.trash.run}><SidebarIcon name="trash" />{actions.trash.label}</DrawerClose>
        </div>
      </div>
    </DrawerContent>
  </Drawer>;
}
