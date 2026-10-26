import { expect, it, vi } from "vitest";
import type { Note, NotePage, TrashList } from "@memocard/contracts";
import { createWorkspaceFixture } from "./workspace-fixture";

const collectionParams = { query: "", tags: [], limit: 30 };
const searchParams = { ...collectionParams, sort: "updatedAt" };

it("prepares identical rich notes and fixed deletion timestamps for both UI implementations", async () => {
  const oldUI = await createWorkspaceFixture("review-editor");
  const newUI = await createWorkspaceFixture("review-editor");
  const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const oldNote = await oldUI.request<Note>("getNote", { id });
  const newNote = await newUI.request<Note>("getNote", { id });
  expect(newNote).toEqual(oldNote);
  expect(newNote.body).toContain("```ts");
  expect(newNote.body).toContain("[[Weekend reading list]]");
  await oldUI.request("deleteNote", { id });
  await newUI.request("deleteNote", { id });
  expect(await newUI.request("getTrash")).toEqual(await oldUI.request("getTrash"));
});

it("prepares matching trash data with a restorable full note and long title and path", async () => {
  const fixture = await createWorkspaceFixture("review-trash");
  const list = await fixture.request<TrashList>("getTrash");
  expect(list.notes).toHaveLength(2);
  expect(list.notes[1].title!.length).toBeGreaterThan(60);
  expect(list.notes[1].relativePath.length).toBeGreaterThan(70);
  const preview = await fixture.request<{ note: Note }>("getTrashedNote", { trashKey: list.notes[0].trashKey });
  expect(preview.note.body).toContain("#生活/咖啡");
  await fixture.request("restoreNote", { trashKey: list.notes[0].trashKey });
  expect((await fixture.request<TrashList>("getTrash")).notes).toHaveLength(1);
  expect((await fixture.request<NotePage>("queryNotes")).notes.some(note => note.id === preview.note.id)).toBe(true);
});

it("paginates search without truncating the full workspace list", async () => {
  const fixture = await createWorkspaceFixture("review-search");
  const all = await fixture.request<NotePage>("queryNotes", collectionParams);
  const first = await fixture.request<NotePage>("queryNotes", searchParams);
  const next = await fixture.request<NotePage>("queryNotes", { ...searchParams, cursor: first.nextCursor });
  expect(all.notes).toHaveLength(6);
  expect(all.nextCursor).toBeNull();
  expect(first.notes).toHaveLength(2);
  expect(first.nextCursor).toBeTruthy();
  expect(next.nextCursor).toBeNull();
  expect([...first.notes, ...next.notes]).toEqual(all.notes);
});

it("isolates search failure from workspace loading and retains trash issue records", async () => {
  const search = await createWorkspaceFixture("review-search-error");
  expect((await search.request<NotePage>("queryNotes", collectionParams)).notes).toHaveLength(6);
  await expect(search.request("queryNotes", searchParams)).rejects.toMatchObject({ code: "IO_ERROR" });
  const trash = await createWorkspaceFixture("review-trash-issues");
  const list = await trash.request<TrashList>("getTrash");
  expect(list.notes).toHaveLength(2);
  expect(list.issues).toHaveLength(1);
});

it("keeps the notes collection available while only the search request remains loading", async () => {
  const fixture = await createWorkspaceFixture("review-search-loading");
  const settled = vi.fn();
  void fixture.request("queryNotes", searchParams).then(settled, settled);
  const collection = await fixture.request<NotePage>("queryNotes", collectionParams);
  expect(collection.notes).toHaveLength(6);
  expect(collection.nextCursor).toBeNull();
  expect(settled).not.toHaveBeenCalled();
});
