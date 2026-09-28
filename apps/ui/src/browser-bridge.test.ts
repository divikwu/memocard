// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBridge, createBrowserFileTransport } from "./bridge";

afterEach(() => vi.restoreAllMocks());

describe("independent browser transport", () => {
  it("dispatches the picker to the filesystem immediately without an HTTP call", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const files = vi.fn().mockResolvedValue({ ok: true, data: { cancelled: true } });
    const pending = createBridge(createBrowserFileTransport(files), 0)("selectVault", { create: false });
    expect(files).toHaveBeenCalledWith(expect.objectContaining({ operation: "selectVault", params: { create: false } }));
    await expect(pending).resolves.toEqual({ cancelled: true });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("passes the original vault binding into direct file writes", async () => {
    const files = vi.fn().mockResolvedValue({ ok: false, error: { code: "VAULT_CHANGED", message: "已切换笔记库", retryable: false } });
    const params = { id: "note", body: "保留草稿", tags: [], baseHash: "old", vaultBinding: "previous" };
    await expect(createBridge(createBrowserFileTransport(files), 0)("saveNote", params)).rejects.toMatchObject({ code: "VAULT_CHANGED" });
    expect(files).toHaveBeenCalledWith(expect.objectContaining({ params }));
  });
  it("opens only safe external links without a native service", async () => {
    const opener = vi.spyOn(window, "open").mockReturnValue(null);
    const files = vi.fn();
    const request = createBridge(createBrowserFileTransport(files), 0);
    await request("openExternal", { url: "https://example.com/" });
    expect(opener).toHaveBeenCalledWith("https://example.com/", "_blank", "noopener,noreferrer");
    await expect(request("openExternal", { url: "javascript:alert(1)" })).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(files).not.toHaveBeenCalled();
  });
});
