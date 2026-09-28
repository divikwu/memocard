// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindNoteImage } from "./note-image";
import { readBrowserAsset } from "./browser-vault";

const state = vi.hoisted(() => ({ binding: "vault-a", browser: true }));
vi.mock("./client-mode", () => ({ get isBrowserVault() { return state.browser; } }));
vi.mock("./browser-vault", () => ({ readBrowserAsset: vi.fn(), getBrowserVaultBinding: () => state.binding }));

beforeEach(() => {
  state.binding = "vault-a";
  state.browser = true;
  vi.mocked(readBrowserAsset).mockReset();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:http://localhost/image");
    static revokeObjectURL = vi.fn();
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("directory-backed image rendering", () => {
  it("reads only the validated vault path and releases the generated URL", async () => {
    vi.mocked(readBrowserAsset).mockResolvedValue(new Blob(["image"], { type: "image/png" }));
    const image = document.createElement("img");
    const dispose = bindNoteImage(image, "memocard-asset://vault/assets/my%20photo.png");
    await Promise.resolve();
    expect(readBrowserAsset).toHaveBeenCalledWith("assets/my photo.png", "vault-a");
    expect(image.src).toBe("blob:http://localhost/image");
    dispose();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost/image");
    expect(image.hasAttribute("src")).toBe(false);
  });
  it.each(["switch", "unmount"])("discards a late image after %s", async (reason) => {
    let resolve!: (value: Blob) => void;
    vi.mocked(readBrowserAsset).mockReturnValue(new Promise((done) => { resolve = done; }));
    const image = document.createElement("img");
    const dispose = bindNoteImage(image, "memocard-asset://vault/assets/image.png");
    if (reason === "switch") state.binding = "vault-b";
    else dispose();
    resolve(new Blob(["image"]));
    await Promise.resolve();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(image.hasAttribute("src")).toBe(false);
  });
  it("does not fetch arbitrary remote images or supplied blob URLs", () => {
    const image = document.createElement("img");
    bindNoteImage(image, "https://tracker.test/image.png");
    bindNoteImage(image, "blob:http://localhost/untrusted");
    expect(readBrowserAsset).not.toHaveBeenCalled();
  });
  it("keeps native image delivery unchanged", () => {
    state.browser = false;
    const image = document.createElement("img");
    bindNoteImage(image, "memocard-asset://vault/assets/image.png");
    expect(image.src).toBe("memocard-asset://vault/assets/image.png");
    expect(readBrowserAsset).not.toHaveBeenCalled();
  });
});
