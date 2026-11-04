import { AppSidebar } from "../../business/sidebar";
import { SidebarTrigger } from "../../components/sidebar";
import { Separator } from "../../components/separator";
import type { LayoutAdapter, NavigationControlsProps } from "../appearance/contracts";

function SidebarNavigationControls(p: NavigationControlsProps) {
  const inHeading = !p.native && !p.mobile && !p.detail && (p.view === "notes" || p.view === "tags");
  const control = p.mobile ? <SidebarTrigger className="web-header-icon" /> : <span className="ui-sidebar-brand-header web-sidebar-logo"><img src="./favicon.png" alt="" draggable={false} className="ui-sidebar-logo" /><SidebarTrigger className="web-header-icon ui-sidebar-logo-trigger" /></span>;
  if (p.position === "collection") return inHeading && !p.sidebarOpen ? control : null;
  return <>
    {!inHeading && (p.mobile ? !p.detail : !p.sidebarOpen) && control}
    {(p.mobile || p.detail) && !p.mobile && !p.sidebarOpen && <Separator orientation="vertical" className="web-header-separator" />}
  </>;
}

export const sidebarLayout: LayoutAdapter = { SideNavigation: AppSidebar, NavigationControls: SidebarNavigationControls };
