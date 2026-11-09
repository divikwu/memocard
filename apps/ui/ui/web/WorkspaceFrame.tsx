import { type ReactNode } from "react";
import type { AppViewState } from "../../src/App";
import { isNative } from "../../src/bridge";
import { SidebarProvider, SidebarInset } from "../components/sidebar";
import { TooltipHints } from "../components/tooltip";
import { ThemeScope, useThemeScopeProps } from "../components/theme-scope";
import { previewAppearanceStyle, usePreviewAppearance } from "../preview-mode";
import { useWebAppearance } from "./WebAppearance";
import { workspaceNavigation } from "./WorkspaceNavigation";
import { AppearanceRuntimeProvider, useAppearanceRuntime, useWorkspaceAppearance } from "./appearance/AppearanceRuntime";
import type { NavigationControlsProps } from "./appearance/contracts";

export function LayoutNavigationControls(props: NavigationControlsProps) {
  const layout = useWorkspaceAppearance();
  const Controls = layout?.applied.adapter.NavigationControls;
  return Controls ? <Controls {...props} /> : null;
}

// This component and the SidebarInset/content path stay fixed for every layout.
export function WorkspaceFrame({ state, leading, overlays, children }: {
  state: AppViewState;
  leading: ReactNode;
  overlays: ReactNode;
  children: ReactNode;
}) {
  const appearance = useWebAppearance();
  const preview = usePreviewAppearance();
  const enabled = !isNative && !state.nativeChrome;
  const runtime = useAppearanceRuntime({
    requested: appearance?.value.interfaceTheme ?? "classic",
    revision: appearance?.themeRevision,
    mobile: state.isMobile,
    enabled,
    commit: id => appearance?.setInterfaceTheme ? appearance.setInterfaceTheme(id) : appearance?.onChange({ ...appearance.value, interfaceTheme: id }),
  });
  const value = appearance?.value ?? preview;
  const style = previewAppearanceStyle(value);
  return <AppearanceRuntimeProvider value={runtime}><ThemeScope value={{
    mode: preview.mode,
    themeId: enabled ? runtime.applied.themeId : undefined,
    layoutId: enabled ? runtime.applied.layoutId : undefined,
    palette: appearance?.value.palette,
    neutral: appearance?.value.neutralPalette,
    style,
  }}><TooltipHints><FrameSurface state={state} leading={leading} overlays={overlays}>{children}</FrameSurface></TooltipHints></ThemeScope></AppearanceRuntimeProvider>;
}

function FrameSurface({ state: s, leading, overlays, children }: { state: AppViewState; leading: ReactNode; overlays: ReactNode; children: ReactNode }) {
  const scope = useThemeScopeProps();
  const runtime = useWorkspaceAppearance()!;
  const { TopNavigation, SideNavigation } = runtime.applied.adapter;
  const navigation = workspaceNavigation(s, runtime.applied.themeId);
  return <div {...scope} className={`${scope.className} web-app sb-unstyled`} data-web-client={!s.nativeChrome && !isNative || undefined} data-native-chrome={s.nativeChrome ? "true" : undefined} data-detail={s.detailView || undefined}>
    {leading}
    {!s.nativeChrome && TopNavigation && <TopNavigation {...navigation} />}
    <SidebarProvider open={s.sidebarOpen} onOpenChange={s.onSidebarOpenChange} openMobile={s.menuOpen} onOpenMobileChange={s.onMenuOpenChange} persistState={false} className="web-app-shell">
      {!s.nativeChrome && SideNavigation && <SideNavigation {...navigation} />}
      <SidebarInset className="web-app-main">{children}</SidebarInset>
    </SidebarProvider>
    {overlays}
  </div>;
}
