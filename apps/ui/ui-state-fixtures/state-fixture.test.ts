import { expect, it, vi } from "vitest";
import type { Note, NotePage, NotePins, VaultStatus } from "@memocard/contracts";
import { createStateFixture } from "./state-fixture";
import { noteId, scenarios } from "./catalog";

it("keeps all scene transports in memory and refuses real host operations", async () => {
  const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network must be unreachable"));
  try {
    for (const scene of scenarios) {
      const fixture = createStateFixture(scene.id);
      await fixture.request("getStatus").catch(() => {});
      for (const operation of ["openExternal", "openWeb", "setMCPEnabled", "importAttachment"]) await expect(fixture.request(operation)).rejects.toMatchObject({ code: "PREVIEW_ONLY" });
    }
    expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); }
});

it("resets new pin and tag preferences with the fixture instance", async () => {
  const first = createStateFixture("loading");
  const second = createStateFixture("loading");
  await first.request("setNotePinned", { id: noteId, pinned: true });
  await first.request("setTagPreferences", { pinned: ["验收"], icons: { "验收": "🌱" } });
  expect((await first.request<NotePins>("getNotePins")).pins[noteId]).toBeTruthy();
  expect((await second.request<NotePins>("getNotePins")).pins).toEqual({});
  expect((await first.request<NotePage>("queryNotes", { pinned: true })).notes.map(note => note.id)).toEqual([noteId]);
  expect((await second.request<NotePage>("queryNotes", { pinned: true })).notes).toEqual([]);
  expect(await second.request("getTagPreferences")).toMatchObject({ pinned: [], icons: {} });
});

it("restores the list after clearing an empty image filter", async () => {
  const fixture = createStateFixture("filter-empty");
  expect((await fixture.request<NotePage>("queryNotes", { quickFilter: "images" })).notes).toHaveLength(0);
  expect((await fixture.request<NotePage>("queryNotes")).notes).toHaveLength(6);
});

it("lets a new note appear after creating it in the empty vault", async () => {
  const fixture = createStateFixture("empty");
  expect((await fixture.request<NotePage>("queryNotes")).notes).toHaveLength(0);
  await fixture.request("saveNote", { id: "preview-new", body: "第一条笔记", title: "新记录" });
  expect((await fixture.request<NotePage>("queryNotes")).notes).toMatchObject([{ id: "preview-new", body: "第一条笔记" }]);
});

it("can retry property writes without modifying the failed value first", async () => {
  const fixture = createStateFixture("property-save-error");
  const before = fixture.snapshot();
  const change = { id: noteId, name: "摘要", type: "text", value: "重试后的值" };
  await expect(fixture.request("updateNoteProperty", change)).rejects.toMatchObject({ code: "IO_ERROR" });
  expect(fixture.snapshot()).toEqual(before);
  fixture.retry();
  expect(await fixture.request<Note>("updateNoteProperty", change)).toMatchObject({ propertyData: { properties: expect.arrayContaining([expect.objectContaining({ name: "摘要", value: "重试后的值" })]) } });
});

it("does not enable writes when the browser lacks folder access", async () => {
  const fixture = createStateFixture("unsupported");
  const status = await fixture.request<VaultStatus>("getStatus");
  expect(status.connected).toBe(false);
  expect(status.capabilities).not.toContain("saveNote");
  expect(status.capabilities).not.toContain("selectVault");
});
