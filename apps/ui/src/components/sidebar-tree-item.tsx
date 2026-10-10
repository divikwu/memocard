import type { ComponentProps, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSubButton, SidebarMenuSubItem } from "./ui/sidebar";

type SidebarTreeItemProps = {
  label: string;
  icon: ReactNode;
  buttonProps: ComponentProps<"button">;
  isActive: boolean;
  nested?: boolean;
  defaultOpen?: boolean;
  toggleLabel?: string;
  accessories?: ReactNode;
  children?: ReactNode;
};

export function SidebarTreeItem({ label, icon, buttonProps, isActive, nested = false, defaultOpen = true, toggleLabel, accessories, children }: SidebarTreeItemProps) {
  const Item = nested ? SidebarMenuSubItem : SidebarMenuItem;
  const MenuButton = nested ? SidebarMenuSubButton : SidebarMenuButton;
  return <Item className="w-full min-w-0">
    <Collapsible defaultOpen={defaultOpen} className="w-full min-w-0">
      <div className="group/tree-row relative w-full min-w-0">
        <MenuButton isActive={isActive} render={<button type="button" {...buttonProps} className="w-full translate-x-0 pr-8"><span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">{icon}</span><span>{label}</span></button>} />
        {children && <CollapsibleTrigger render={<SidebarMenuAction aria-label={toggleLabel} className={`md:opacity-0 group-hover/tree-row:opacity-100 group-has-[:focus-visible]/tree-row:opacity-100 left-1.5 bg-sidebar-accent text-sidebar-accent-foreground data-[panel-open]:rotate-90 ${nested ? " top-1" : ""}`}><ChevronRight aria-hidden="true" /></SidebarMenuAction>} />}
        {accessories}
      </div>
      {children && <CollapsibleContent className="w-full min-w-0">{children}</CollapsibleContent>}
    </Collapsible>
  </Item>;
}
