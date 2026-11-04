import type { AppViewState } from "../../src/App";
import type { WorkspaceNavigationProps } from "../business/navigation-model";

export function workspaceNavigation(state: AppViewState): WorkspaceNavigationProps {
  return {
    ...state.sidebar,
    canRefresh: state.canRefresh,
    onRefresh: state.isMobile ? undefined : state.onRefresh,
    draftCount: state.isMobile ? 0 : state.drafts.records.length,
    onOpenDrafts: () => state.drafts.onOpenChange(true),
    searchAvailable: state.search.available,
    searchOpen: state.search.open,
    onSearch: state.onSearch,
  };
}
