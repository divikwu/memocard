import type { NotePage, NotePins, TagPreferenceState, VaultStatus } from "@memocard/contracts";
import type { Environment } from "../src/bridge";
import { noteQuickFilters } from "../src/note-filters";
import { createPreviewMock } from "./mock";

// Both mock state and preference writes belong to a single frame lifetime.
export function createStateFixture(scenario: string) {
  const base = createPreviewMock(scenario === "tags-empty" ? "empty" : ["filter-empty", "links-empty", "tags-complete", "combined-filter-empty", "pinned-empty", "tags-search-empty"].includes(scenario) ? "loading" : scenario);
  const capabilities = ["getNotePins", "setNotePinned", "getTagPreferences", "setTagPreferences"];
  let pins: NotePins = { pins: {}, contentHash: "preview-pins" };
  let preferences: TagPreferenceState = { pinned: [], icons: {}, groups: [], labels: {}, initialized: true, contentHash: "preview-tags" };
  async function request<T>(operation: string, params: Record<string, unknown> = {}): Promise<T> {
    let result: unknown;
    switch (operation) {
      case "getStatus": {
        const status = await base.request<VaultStatus>(operation, params);
        result = { ...status, capabilities: [...status.capabilities, ...capabilities] };
        break;
      }
      case "getEnvironment": {
        const environment = await base.request<Environment>(operation, params);
        result = { ...environment, capabilities: [...environment.capabilities, ...capabilities] };
        break;
      }
      case "getNotePins": result = pins; break;
      case "setNotePinned": {
        const next = { ...pins.pins };
        if (params.pinned) next[String(params.id)] = "2026-10-12T08:00:00Z";
        else delete next[String(params.id)];
        pins = { pins: next, contentHash: `${pins.contentHash}+` };
        result = pins;
        break;
      }
      case "getTagPreferences": result = preferences; break;
      case "setTagPreferences":
        preferences = { pinned: params.pinned as string[], icons: params.icons as Record<string, string>, groups: (params.groups as TagPreferenceState["groups"]) ?? preferences.groups, labels: (params.labels as TagPreferenceState["labels"]) ?? preferences.labels, initialized: true, contentHash: `${preferences.contentHash}+` };
        result = preferences;
        break;
      case "queryNotes": {
        const page = await base.request<NotePage>(operation, params);
        const types = [...(Array.isArray(params.quickFilters) ? params.quickFilters : []), ...(params.quickFilter ? [params.quickFilter] : [])];
        const filterCounts = { untagged: 0, images: 0, links: 0 };
        const quickFilterTagCounts: Record<string, number> = Object.create(null);
        for (const note of base.snapshot().notes) {
          if (note.deletedAt) continue;
          const filters = noteQuickFilters(note);
          for (const filter of filters) filterCounts[filter]++;
          if (filters.some(filter => types.includes(filter))) for (const tag of note.tags) quickFilterTagCounts[tag] = (quickFilterTagCounts[tag] ?? 0) + 1;
        }
        const filtered = page.notes.filter(note => (!params.pinned || pins.pins[note.id])
          && (!Array.isArray(params.tags) || params.tags.every(tag => note.tags.some(value => value === tag || (params.exactTags !== true && value.startsWith(`${tag}/`)))))
          && (!types.length || noteQuickFilters(note).some(filter => types.includes(filter))));
        result = { ...page, notes: filtered, filterCounts, quickFilterTagCounts };
        break;
      }
      case "listTags": {
        const list = await base.request<{tags: {name: string; count: number}[]}>(operation, params);
        const names = new Set(list.tags.map(tag => tag.name));
        result = params.flat ? {...list, tags: [...list.tags, ...Object.keys(preferences.labels ?? {}).filter(name => !names.has(name)).map(name => ({name, count: 0}))]} : list;
        break;
      }
      default: return base.request<T>(operation, params);
    }
    return structuredClone(result) as T;
  }
  return { ...base, request };
}
