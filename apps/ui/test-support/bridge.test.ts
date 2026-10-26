import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserVaultBinding, isBrowserVault, readBrowserAsset, request, resetStorybookBridge, setStorybookBrowserAssets, setStorybookRequestHandler } from "./bridge";

afterEach(resetStorybookBridge);

describe("Storybook data isolation", () => {
  it("rejects operations and assets until a fixture explicitly supplies them", async () => {
    expect(isBrowserVault).toBe(false);
    expect(getBrowserVaultBinding()).toBeNull();
    await expect(request("saveNote")).rejects.toThrow("no data operation");
    await expect(readBrowserAsset("assets/image.png")).rejects.toThrow("no asset");
  });

  it("forwards only to the installed fixture and restores default rejection", async () => {
    const handler = vi.fn().mockResolvedValue({ notes: [] });
    const cleanup = setStorybookRequestHandler(handler);
    await expect(request("queryNotes", { query: "example" })).resolves.toEqual({ notes: [] });
    expect(handler).toHaveBeenCalledWith("queryNotes", { query: "example" });
    cleanup();
    await expect(request("queryNotes")).rejects.toThrow("no data operation");
  });

  it("does not let an earlier cleanup remove the next story's handler", async () => {
    const cleanup = setStorybookRequestHandler(() => "old");
    setStorybookRequestHandler(() => "current");
    cleanup();
    await expect(request("queryNotes")).resolves.toBe("current");
    resetStorybookBridge();
    await expect(request("queryNotes")).rejects.toThrow("no data operation");
  });

  it("limits assets to the current memory fixture and binding", async () => {
    const image = new Blob(["fixture"], { type: "image/png" });
    const cleanup = setStorybookBrowserAssets({ "assets/image.png": image });
    const previousBinding = getBrowserVaultBinding()!;
    expect(isBrowserVault).toBe(true);
    await expect(readBrowserAsset("assets/image.png", previousBinding)).resolves.toBe(image);
    await expect(readBrowserAsset("../private.png", previousBinding)).rejects.toThrow("no asset");
    await expect(readBrowserAsset("toString", previousBinding)).rejects.toThrow("no asset");
    setStorybookBrowserAssets({ "assets/image.png": image });
    cleanup();
    expect(getBrowserVaultBinding()).not.toBe(previousBinding);
    await expect(readBrowserAsset("assets/image.png", previousBinding)).rejects.toThrow("no asset");
    resetStorybookBridge();
    expect(isBrowserVault).toBe(false);
    await expect(readBrowserAsset("assets/image.png")).rejects.toThrow("no asset");
  });
});
