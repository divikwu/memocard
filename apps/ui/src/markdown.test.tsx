import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";
import { assetUrl, externalUrl } from "./urls";

describe("safe note rendering", () => {
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "memocard-ui://app/index.html", "//remote.test/", "java\nscript:alert(1)"])("refuses unsafe links: %s", (url) => {
    expect(externalUrl(url)).toBeNull();
  });
  it("allows ordinary web links and mail links", () => {
    expect(externalUrl("https://example.com/note?q=hi")).toBe("https://example.com/note?q=hi");
    expect(externalUrl("mailto:hello@example.com")).toBe("mailto:hello@example.com");
  });
  it.each(["../secret.png", "assets/%2e%2e/secret.png", "https://tracker.test/a.png", "file:///a.png", "memocard-asset://other/a.png", "assets/%252e%252e/a.png", "assets/a.svg", "/secret.png"])("refuses unowned or unsafe images: %s", (path) => {
    expect(assetUrl(path)).toBeNull();
  });
  it("maps owned relative image paths to the native asset scheme", () => {
    expect(assetUrl("../assets/今天.png")).toBe("memocard-asset://vault/assets/%E4%BB%8A%E5%A4%A9.png");
    expect(assetUrl("memocard-asset://vault/assets/photo.jpg")).toBe("memocard-asset://vault/assets/photo.jpg");
    expect(assetUrl("../assets/photo.jpg")).toBe("memocard-asset://vault/assets/photo.jpg");
    expect(assetUrl("../assets/../../private.png")).toBeNull();
  });
  it("resolves images from the actual note directory after an external move", () => {
    expect(assetUrl("../../assets/photo.jpg", "notes/folder/moved.md")).toBe("memocard-asset://vault/assets/photo.jpg");
    expect(assetUrl("../assets/photo.jpg", "notes/folder/moved.md")).toBeNull();
    expect(assetUrl("assets/photo.jpg", "notes/note.md")).toBeNull();
    const html = renderToStaticMarkup(<Markdown notePath="notes/folder/moved.md" body="![photo](../../assets/photo.jpg)" />);
    expect(html).toContain('src="memocard-asset://vault/assets/photo.jpg"');
  });
  it.each(["../../../assets/a.png", "../../%2e%2e/assets/a.png", "../../assets%2fa.png", "memocard-asset://vault/assets/../a.png"])("rejects escaped or encoded navigation from nested notes: %s", (path) => {
    expect(assetUrl(path, "notes/folder/moved.md")).toBeNull();
  });
  it("allows encoded file names without treating them as navigation", () => {
    expect(assetUrl("../../assets/my%20photo.png", "notes/folder/moved.md")).toBe("memocard-asset://vault/assets/my%20photo.png");
  });
  it.each(["my%23photo.png", "my%3Fphoto.png", "100%25.png"])("preserves safely encoded filename characters: %s", (name) => {
    expect(assetUrl(`../assets/${name}`)).toBe(`memocard-asset://vault/assets/${name}`);
  });
  it("does not render raw HTML or remote image sources", () => {
    const html = renderToStaticMarkup(<Markdown body={'<script>alert(1)</script>\n\n![pixel](https://tracker.test/a.png)\n\n[bad](javascript:alert)'} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("src=");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("仅显示笔记库中的图片");
  });
});
