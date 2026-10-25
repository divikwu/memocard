import type { NotePage, NotePins, TagPreferenceState, VaultStatus } from "@memocard/contracts";
import type { Environment } from "../src/bridge";
import { createPreviewMock } from "./mock";

// Both mock state and preference writes belong to a single frame lifetime.
export function createStateFixture(scenario: string) {
  const base = createPreviewMock(scenario === "filter-empty" ? "loading" : scenario);
  const capabilities = ["getNotePins", "setNotePinned", "getTagPreferences", "setTagPreferences"];
  let pins: NotePins = { pins: {}, contentHash: "preview-pins" };
  let preferences: TagPreferenceState = { pinned: [], icons: {}, initialized: true, contentHash: "preview-tags" };
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
        preferences = { pinned: params.pinned as string[], icons: params.icons as Record<string, string>, initialized: true, contentHash: `${preferences.contentHash}+` };
        result = preferences;
        break;
      case "queryNotes": {
        const page = await base.request<NotePage>(operation, params);
        const filtered = page.notes.filter(note => (!params.pinned || pins.pins[note.id])
          && (!Array.isArray(params.tags) || params.tags.every(tag => note.tags.some(value => value === tag || value.startsWith(`${tag}/`))))
          && (params.quickFilter !== "untagged" || !note.tags.length)
          && (params.quickFilter !== "images" || /!\[|<img/.test(note.body))
          && (params.quickFilter !== "links" || /https?:|\[\[/.test(note.body)));
        result = { ...page, notes: filtered };
        break;
      }
      default: return base.request<T>(operation, params);
    }
    return structuredClone(result) as T;
  }
  return { ...base, request };
}
