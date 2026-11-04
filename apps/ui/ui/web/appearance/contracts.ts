import type { ComponentType } from "react";
import type { WorkspaceNavigationProps, WorkspaceView } from "../../business/navigation-model";

export type NavigationControlsProps = {
  position: "header" | "collection";
  view: WorkspaceView;
  detail: boolean;
  mobile: boolean;
  native: boolean;
  sidebarOpen: boolean;
};
export type LayoutAdapter = {
  TopNavigation?: ComponentType<WorkspaceNavigationProps>;
  SideNavigation?: ComponentType<WorkspaceNavigationProps>;
  NavigationControls?: ComponentType<NavigationControlsProps>;
};
export type AppearanceCatalog<LayoutId extends string = string> = {
  themes: Readonly<Record<string, {
    label: string;
    layouts: { desktop: LayoutId; mobile: LayoutId };
    loadStyles: () => Promise<unknown>;
  }>>;
  layouts: Readonly<Record<LayoutId, {
    viewport: "desktop" | "mobile";
    load: () => Promise<LayoutAdapter>;
  }>>;
};
export type AppearanceResolution = {
  themeId: string;
  layoutId: string;
  themeFallback: "unknown" | null;
  layoutFallback: "unsupported-viewport" | null;
};
