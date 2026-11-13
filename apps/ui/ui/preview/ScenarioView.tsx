import { useEffect, useRef } from "react";
import type { AppViewState } from "../../src/App";
import { renderWebApp } from "../web/WebAppView";
import type { Scenario } from "./scenarios";

const draftDialogs = new Set(["draft-single", "draft-many", "draft-versions", "draft-dismissed", "draft-reminder-error", "draft-restore-error"]);

// Use the shared controller to prepare scenes whose entry controls changed.
export function ScenarioView({ state, scenario }: { state: AppViewState; scenario: Scenario }) {
  const prepared = useRef(false);
  useEffect(() => {
    if (prepared.current || state.loading || !state.status) return;
    if (draftDialogs.has(scenario.id)) {
      if (!state.drafts.records.length) return;
      prepared.current = true;
      state.drafts.onOpenChange(true);
    } else if (scenario.id === "folder-cancel") {
      if (!state.sidebar.canChooseVault) return;
      prepared.current = true;
      void state.sidebar.onSelectVault(false);
    } else if (scenario.id === "refresh-timeout") {
      if (!state.collection.notes.length) return;
      prepared.current = true;
      state.onRefreshBackground();
    } else if (scenario.id === "search-empty") {
      prepared.current = true;
      state.onSearch();
    } else if (scenario.id === "pinned-empty") {
      if (!state.collection.home) { void state.onNavigate("home"); return; }
      prepared.current = true;
      state.collection.home.onTabChange("pinned");
    } else if (scenario.id === "tags-empty" || scenario.id === "tags-search-empty") {
      prepared.current = true;
      void state.onNavigate("tags");
    } else if (scenario.id === "combined-filter-empty") {
      if (!state.collection.filters) return;
      prepared.current = true;
      state.collection.filters.onChange(["验收"], ["images"]);
    } else if (["filter-empty", "links-empty", "tags-complete"].includes(scenario.id)) {
      prepared.current = true;
      void state.onNavigate("notes", null, scenario.id === "links-empty" ? "links" : scenario.id === "tags-complete" ? "untagged" : "images");
    }
  }, [state, scenario.id]);
  return renderWebApp(state);
}
