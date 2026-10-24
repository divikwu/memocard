import type { ComponentProps, ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from "../components/sidebar";
import { Button } from "../components/button";
import { cn } from "../lib/utils";
import { SidebarIcon } from "./sidebar-icons";
import "./sidebar.css";

export type SidebarTreeItemProps = {
  label: string;
  className?: string;
  icon: ReactNode;
  buttonProps: ComponentProps<"button">;
  isActive: boolean;
  nested?: boolean;
  defaultOpen?: boolean;
  toggleLabel?: string;
  accessories?: ReactNode;
  children?: ReactNode;
};

export function SidebarTreeItem({ label, className, icon, buttonProps, isActive, nested = false, defaultOpen = true, toggleLabel, accessories, children }: SidebarTreeItemProps) {
  const Item = nested ? SidebarMenuSubItem : SidebarMenuItem;
  const MenuButton = nested ? SidebarMenuSubButton : SidebarMenuButton;
  const { className: buttonClassName, ...button } = buttonProps;
  return <Item className="w-full min-w-0">
    <Collapsible.Root defaultOpen={defaultOpen} className="w-full min-w-0">
      <div className={cn("next-sidebar-tree-row group/tree-row relative min-w-0", className)}>
        <MenuButton isActive={isActive} aria-current={isActive ? "page" : undefined} className={cn("next-sidebar-row w-full translate-x-0", buttonClassName)} render={<button type="button" {...button} />}>
          <span aria-hidden="true" className={cn("next-sidebar-row-icon flex size-4 shrink-0 items-center justify-center", children && "next-sidebar-branch-icon", typeof icon === "string" && "next-sidebar-emoji")}>{icon}</span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </MenuButton>
        {children && <Collapsible.Trigger render={<Button type="button" variant="ghost" size="icon-xs" className="next-sidebar-tree-toggle" aria-label={toggleLabel ?? `展开或收起 ${label}`} disabled={button.disabled} />}><SidebarIcon name="right" className="transition-transform duration-fast ease-standard" /></Collapsible.Trigger>}
        <div className="next-sidebar-row-actions absolute inset-y-0 right-1 flex items-center gap-0.5">
          {accessories}
        </div>
      </div>
      {children && <Collapsible.Panel className="next-sidebar-tree-panel">{children}</Collapsible.Panel>}
    </Collapsible.Root>
  </Item>;
}
