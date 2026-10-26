// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Note, NotePage } from "@memocard/contracts";
import { useNoteSearch, type NoteSearchSession } from "./use-note-search";

const bridge = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./bridge", () => ({ request: bridge.request, errorMessage: String }));
const note = (id: string): Note => ({ id, title: id, body: id, tags: [], relativePath: `${id}.md`, createdAt: "2026-10-26T00:00:00Z", updatedAt: "2026-10-26T00:00:00Z", contentHash: id, sourceUrl: "" });
const page = (ids: string[], nextCursor: string | null = null): NotePage => ({ notes: ids.map(note), nextCursor, coverage: { complete: true, indexed: ids.length, pending: 0, issues: 0, indexedAt: "2026-10-26T00:00:00Z" } });
function setup() {
  const sessionRef = createRef<NoteSearchSession>();
  const view = renderHook(() => useNoteSearch({ open: true, available: true, preserveSession: true, isMobile: true, sessionRef }));
  return { ...view, sessionRef };
}
beforeEach(() => { bridge.request.mockReset(); });
afterEach(cleanup);

it("keeps query, scroll and loaded pages while removing the last active result and refreshing cursors", async () => {
  let deleted = false;
  bridge.request.mockImplementation(async (_operation, params) => params.cursor
    ? page(deleted ? ["second", "third"] : ["third", "deleted"], deleted ? "fresh-tail" : "old-tail")
    : page(deleted ? ["new-before", "first"] : ["first", "second"], deleted ? "fresh-page" : "old-page"));
  const { result, sessionRef } = setup();
  await waitFor(() => expect(result.current.notes).toHaveLength(2));
  act(() => result.current.setQuery("query retained"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.loadMore());
  act(() => result.current.setSelected(3));
  const list = document.createElement("div"), row = document.createElement("button");
  const reveal = vi.fn(); row.scrollIntoView = reveal;
  vi.spyOn(list, "querySelector").mockReturnValue(row);
  result.current.resultScroll.current = 275;
  act(() => result.current.attachList(list));
  deleted = true;
  act(() => sessionRef.current!.removeNote("deleted"));
  expect(result.current.notes.map(note => note.id)).toEqual(["first", "second", "third"]);
  expect(result.current.active?.id).toBe("third");
  await waitFor(() => expect(result.current.page?.nextCursor).toBe("fresh-tail"));
  expect(result.current.query).toBe("query retained");
  expect(result.current.selected).toBe(3);
  expect(result.current.active?.id).toBe("third");
  expect(result.current.resultScroll.current).toBe(275);
  expect(list.scrollTop).toBe(275);
  expect(reveal).not.toHaveBeenCalled();
  expect(bridge.request.mock.calls.slice(-2)).toEqual([
    ["queryNotes", { query: "query retained", tags: [], sort: "updatedAt", limit: 30 }],
    ["queryNotes", { query: "query retained", tags: [], sort: "updatedAt", limit: 30, cursor: "fresh-page" }],
  ]);
  act(() => result.current.moveSelection(-1));
  expect(reveal).toHaveBeenCalledOnce();
});

it("ignores a pre-deletion query response arriving after fresh results", async () => {
  let finishOld!: (value: NotePage) => void;
  bridge.request.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(page(["kept"]));
  const { result, sessionRef } = setup();
  await waitFor(() => expect(finishOld).toBeTypeOf("function"));
  act(() => sessionRef.current!.removeNote("deleted"));
  await waitFor(() => expect(result.current.notes.map(note => note.id)).toEqual(["kept"]));
  await act(async () => finishOld(page(["deleted"])));
  expect(result.current.notes.map(note => note.id)).toEqual(["kept"]);
  expect(result.current.loading).toBe(false);
});

it("discards late pagination, keeps the surviving active identity and allows fresh pagination", async () => {
  let finishOld!: (value: NotePage) => void;
  let deleted = false;
  bridge.request.mockImplementation((_operation, params) => {
    if (params.cursor === "old-page") return new Promise(resolve => { finishOld = resolve; });
    if (params.cursor === "fresh-page") return Promise.resolve(page(["fourth"]));
    return Promise.resolve(page(deleted ? ["kept", "third"] : ["deleted", "kept"], deleted ? "fresh-page" : "old-page"));
  });
  const { result, sessionRef } = setup();
  await waitFor(() => expect(result.current.notes).toHaveLength(2));
  act(() => result.current.setSelected(1));
  let oldPage!: Promise<void>;
  act(() => { oldPage = result.current.loadMore(); });
  await waitFor(() => expect(finishOld).toBeTypeOf("function"));
  deleted = true;
  act(() => sessionRef.current!.removeNote("deleted"));
  expect(result.current.active?.id).toBe("kept");
  await waitFor(() => expect(result.current.page?.nextCursor).toBe("fresh-page"));
  await act(async () => { finishOld(page(["deleted", "stale"])); await oldPage; });
  expect(result.current.notes.map(note => note.id)).toEqual(["kept", "third"]);
  await act(async () => result.current.loadMore());
  expect(result.current.notes.map(note => note.id)).toEqual(["kept", "third", "fourth"]);
});

it("does not blacklist a restored identity from a later query", async () => {
  let deleted = false;
  bridge.request.mockImplementation(async (_operation, params) => page(params.query === "restored" || !deleted ? ["restored"] : []));
  const { result, sessionRef } = setup();
  await waitFor(() => expect(result.current.notes).toHaveLength(1));
  deleted = true;
  act(() => sessionRef.current!.removeNote("restored"));
  await waitFor(() => expect(result.current.paging).toBe(false));
  expect(result.current.notes).toEqual([]);
  expect(result.current.active).toBeUndefined();
  act(() => result.current.setQuery("restored"));
  await waitFor(() => expect(result.current.notes[0]?.id).toBe("restored"));
});

it("retries a fresh cursor chain without clearing retained pages or query on a stale cursor", async () => {
  let deleted = false, stale = true;
  bridge.request.mockImplementation((_operation, params) => {
    if (params.cursor && deleted && stale) { stale = false; return Promise.reject({ code: "STALE_CURSOR" }); }
    if (params.cursor) return Promise.resolve(page(["third"]));
    return Promise.resolve(page(deleted ? ["kept"] : ["deleted", "kept"], deleted ? "fresh-page" : "old-page"));
  });
  const { result, sessionRef } = setup();
  await waitFor(() => expect(result.current.notes).toHaveLength(2));
  act(() => result.current.setQuery("same query"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.loadMore());
  deleted = true;
  act(() => sessionRef.current!.removeNote("deleted"));
  await waitFor(() => expect(result.current.paging).toBe(false));
  expect(result.current.query).toBe("same query");
  expect(result.current.notes.map(note => note.id)).toEqual(["kept", "third"]);
  expect(result.current.error).toBe("");
  expect(bridge.request.mock.calls.filter(([, params]) => params.cursor === "fresh-page")).toHaveLength(2);
});

it.each(["old-tail", null])("retries a failed retained refresh without using the old %s cursor or losing session state", async nextCursor => {
  let deleted = false, fail = true;
  bridge.request.mockImplementation((_operation, params) => {
    if (deleted && !params.cursor && fail) { fail = false; return Promise.reject(new Error("Network failure")); }
    if (params.cursor) return Promise.resolve(page(["third"], deleted ? "fresh-tail" : nextCursor));
    return Promise.resolve(page(deleted ? ["first"] : ["first", "deleted"], deleted ? "fresh-page" : "old-page"));
  });
  const { result, sessionRef } = setup();
  await waitFor(() => expect(result.current.notes).toHaveLength(2));
  act(() => result.current.setQuery("same query"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => result.current.loadMore());
  act(() => result.current.setSelected(2));
  const list = document.createElement("div"); result.current.resultScroll.current = 225;
  act(() => result.current.attachList(list));
  deleted = true;
  const calls = bridge.request.mock.calls.length;
  act(() => sessionRef.current!.removeNote("deleted"));
  await waitFor(() => expect(result.current.error).toContain("Network failure"));
  expect(result.current.page?.nextCursor).toBe(nextCursor);
  await act(async () => result.current.retrySearch());
  await waitFor(() => expect(result.current.page?.nextCursor).toBe("fresh-tail"));
  expect(result.current.notes.map(note => note.id)).toEqual(["first", "third"]);
  expect(result.current.active?.id).toBe("third");
  expect(result.current.query).toBe("same query");
  expect(result.current.resultScroll.current).toBe(225);
  expect(list.scrollTop).toBe(225);
  expect(result.current.error).toBe("");
  expect(bridge.request.mock.calls.slice(calls)).toEqual([
    ["queryNotes", { query: "same query", tags: [], sort: "updatedAt", limit: 30 }],
    ["queryNotes", { query: "same query", tags: [], sort: "updatedAt", limit: 30 }],
    ["queryNotes", { query: "same query", tags: [], sort: "updatedAt", limit: 30, cursor: "fresh-page" }],
  ]);
});
