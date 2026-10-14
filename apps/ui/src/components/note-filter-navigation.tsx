import { Hash, Image, Link } from "lucide-react";
import type { AppSidebarProps } from "./app-sidebar";
import { noteFilterLabels } from "../note-filter-labels";
import { SidebarMenuBadge, SidebarMenuSub } from "./ui/sidebar";
import { SidebarTreeItem } from "./sidebar-tree-item";

export function NoteFilterNavigation({ view, quickFilter, filterCounts, connected, onNavigate }: Pick<AppSidebarProps, "view" | "quickFilter" | "filterCounts" | "connected" | "onNavigate">) {
  return <SidebarMenuSub aria-label="快捷筛选" className="mr-0 translate-x-0 pr-0">
    {([ ["untagged", Hash], ["images", Image], ["links", Link] ] as const).map(([filter, Icon]) => <SidebarTreeItem key={filter} nested label={noteFilterLabels[filter]} icon={<Icon className="size-3.5" />} buttonProps={{ "aria-label": noteFilterLabels[filter], "aria-description": filterCounts ? `${filterCounts[filter]} 条笔记` : undefined, disabled: !connected, onClick: () => onNavigate("notes", null, filter) }} isActive={view === "notes" && quickFilter === filter}
      accessories={filterCounts && <SidebarMenuBadge aria-hidden="true" className="top-1 text-muted-foreground/65 peer-hover/menu-button:text-muted-foreground/65 peer-data-[active=true]/menu-button:text-muted-foreground/65">{filterCounts[filter]}</SidebarMenuBadge>} />)}
  </SidebarMenuSub>;
}
