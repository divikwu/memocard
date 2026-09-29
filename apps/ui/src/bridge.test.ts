import { afterEach, describe, expect, it, vi } from "vitest";
import { BridgeFailure, createBridge, reconnectVault } from "./bridge";
import type { Note, NotePage, VaultStatus } from "@memocard/contracts";
import fixture from "../../../tests/fixtures/bridge-v1.json";

afterEach(() => vi.useRealTimers());

describe("native bridge", () => {
  it("replaces the current page with the newly authorized local Web URL", () => {
    const location = { replace: vi.fn(), reload: vi.fn() };
    reconnectVault("http://127.0.0.1:5194/#/connect?token=next", location);
    expect(location.replace).toHaveBeenCalledWith("http://127.0.0.1:5194/#/connect?token=next");
    expect(location.reload).toHaveBeenCalledOnce();
  });
  it("invokes directory selection synchronously within the user's click", async () => {
    const transport = vi.fn().mockResolvedValue({ ok: true, data: { connected: true } });
    const pending = createBridge(transport)("selectVault");
    expect(transport).toHaveBeenCalledTimes(1);
    await pending;
  });
  it("waits for browser file commits rather than reporting a timeout before close", async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    const pending = createBridge(() => new Promise((done) => { finish = done; }), 0)("saveNote");
    await vi.advanceTimersByTimeAsync(60_000);
    finish({ ok: true, data: { saved: true } });
    await expect(pending).resolves.toEqual({ saved: true });
  });
  it("reads the shared native/MCP fixture without losing source or coverage fields", async () => {
    const sourceNote: Note = fixture.note.data;
    const sourceStatus: VaultStatus = fixture.status.data;
    const page: NotePage = { notes: [sourceNote], nextCursor: null, coverage: sourceStatus.coverage };
    const bridge = createBridge(async ({ operation }) => operation === "getNote" ? fixture.note : operation === "getStatus" ? fixture.status : { ok: true, data: page });
    expect(fixture.formatVersion).toBe(1);
    await expect(bridge<Note>("getNote", { id: sourceNote.id })).resolves.toEqual(sourceNote);
    await expect(bridge<VaultStatus>("getStatus")).resolves.toEqual(sourceStatus);
    await expect(bridge<NotePage>("queryNotes", { query: "中文" })).resolves.toEqual(page);
  });
  it("preserves the error contract shared with the native core and MCP", async () => {
    await expect(createBridge(async () => fixture.error)("getNote", { id: fixture.note.data.id })).rejects.toMatchObject(fixture.error.error);
  });
  it("refuses browser-only persistence", async () => {
    await expect(createBridge()("saveNote", { body: "keep me" })).rejects.toMatchObject({ code: "NATIVE_REQUIRED" });
  });
  it("preserves native conflict code without reporting a successful save", async () => {
    const transport = vi.fn().mockResolvedValue({ ok: false, error: { code: "REVISION_CONFLICT", message: "文件已经更新", retryable: false } });
    await expect(createBridge(transport)("saveNote")).rejects.toMatchObject({ code: "REVISION_CONFLICT", message: "文件已经更新", retryable: false });
  });
  it("returns a timeout for an unanswered native request", async () => {
    vi.useFakeTimers();
    const call = createBridge(() => new Promise(() => {}), 50)("getStatus");
    const assertion = expect(call).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
    await vi.advanceTimersByTimeAsync(51);
    await assertion;
  });
  it("allows a native picker to remain open past the data timeout", async () => {
    vi.useFakeTimers();
    let finish: ((value: unknown) => void) | undefined;
    const call = createBridge(() => new Promise((resolve) => { finish = resolve; }), 50)("selectVault");
    await vi.advanceTimersByTimeAsync(500);
    finish?.({ ok: true, data: { connected: true } });
    await expect(call).resolves.toEqual({ connected: true });
  });
  it("rejects malformed replies and transport failures", async () => {
    await expect(createBridge(async () => ({ ok: true }))("getStatus")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(createBridge(async () => { throw new Error("disconnected"); })("getStatus")).rejects.toBeInstanceOf(BridgeFailure);
  });
  it("passes Unicode and quotes as data in a versioned request", async () => {
    const transport = vi.fn().mockResolvedValue({ ok: true, data: { saved: true } });
    const params = { body: '记住 "今天"\n🌱', tags: ["工作"] };
    await expect(createBridge(transport)("saveNote", params)).resolves.toEqual({ saved: true });
    expect(transport).toHaveBeenCalledWith({ version: 1, requestId: expect.any(String), operation: "saveNote", params });
  });
});
