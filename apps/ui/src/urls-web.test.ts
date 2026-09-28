import { describe, expect, it, vi } from "vitest";
import { assetUrl } from "./urls";

vi.mock("./client-mode", () => ({ isLocalWeb: true }));

describe("local web asset URLs", () => {
  it("resolves native and relative paths to authenticated same-origin assets", () => {
    expect(assetUrl("../../assets/今天.png", "notes/folder/note.md")).toBe("/api/assets/assets/%E4%BB%8A%E5%A4%A9.png");
    expect(assetUrl("memocard-asset://vault/assets/photo.jpg")).toBe("/api/assets/assets/photo.jpg");
  });
  it.each(["../../../private.png", "../../%2e%2e/assets/a.png", "../../assets%2fa.png", "https://example.com/image.png", "../../assets/a.svg"])("keeps the same ownership checks for %s", (source) => {
    expect(assetUrl(source, "notes/folder/note.md")).toBeNull();
  });
});
