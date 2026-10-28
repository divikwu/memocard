import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NoteMarkdown as Markdown } from "@ui/business/NoteMarkdown";
import { assetUrl, externalUrl } from "./urls";

describe("safe note rendering", () => {
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///etc/passwd", "memocard-ui://app/index.html", "//remote.test/", "java\nscript:alert(1)"])("refuses unsafe links: %s", (url) => {
    expect(externalUrl(url)).toBeNull();
  });
  it("allows ordinary web links and mail links", () => {
    expect(externalUrl("https://example.com/note?q=hi")).toBe("https://example.com/note?q=hi");
    expect(externalUrl("mailto:hello@example.com")).toBe("mailto:hello@example.com");
  });
  it.each(["assets/%2e%2e/secret.png", "https://tracker.test/a.png", "file:///a.png", "memocard-asset://other/a.png", "assets/a.svg", "/secret.png"])("refuses unowned or unsafe images: %s", (path) => {
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
    expect(assetUrl("../assets/photo.jpg", "notes/folder/moved.md")).toBe("memocard-asset://vault/notes/assets/photo.jpg");
    expect(assetUrl("assets/photo.jpg", "notes/note.md")).toBe("memocard-asset://vault/notes/assets/photo.jpg");
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
  it("does not render unsafe HTML or remote image sources", () => {
    const html = renderToStaticMarkup(<Markdown body={'<script>alert(1)</script>\n\n![pixel](https://tracker.test/a.png)\n\n[bad](javascript:alert)'} />);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("src=");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("仅显示笔记库中的图片");
  });
});

it('renders complete safe content formats including tables, footnotes and MathML', () => {
  const html = renderToStaticMarkup(<Markdown body={'#### 四级\n\n##### 五级\n\n###### 六级\n\n| A | B |\n| --- | ---: |\n| 1 | 2 |\n\n说明[^1]\n\n[^1]: 脚注\n\n$E=mc^2$\n\n<p><mark>重点</mark> <kbd>Enter</kbd> <abbr title="测试">T</abbr></p>\n\n<figure><figcaption>图片说明</figcaption></figure>'} />);
  for (const tag of ['h4', 'h5', 'h6', 'table', 'math', 'mark', 'kbd', 'abbr', 'figure', 'figcaption']) expect(html).toContain(`<${tag}`);
  expect(html).toContain('data-footnotes');
  expect(html).toContain('typeset-scroll');
});
it('sanitizes active HTML, styles, remote images and embedded content', () => {
  const html = renderToStaticMarkup(<Markdown body={'<aside onclick="alert(1)" style="position:fixed"><p>安全内容</p></aside><iframe src="https://remote.test"></iframe><img src="https://remote.test/pixel" onerror="alert(1)"><svg onload="alert(1)"></svg>'} />);
  expect(html).toContain('<aside');
  for (const unsafe of ['onclick', 'onerror', 'onload', '<iframe', '<svg', 'position:fixed', 'src="https://']) expect(html).not.toContain(unsafe);
});
it.each([true, false])('unwraps removed HTML block types without hiding their text (interactive: %s)', interactive => {
  const html = renderToStaticMarkup(<Markdown interactive={interactive} body={'<details><summary>旧摘要</summary><p>旧正文</p></details>\n\n<dl><dt>旧术语</dt><dd><p>旧释义</p></dd></dl>'} />);
  for (const tag of ['details', 'summary', 'dl', 'dt', 'dd']) expect(html).not.toContain(`<${tag}`);
  for (const text of ['旧摘要', '旧正文', '旧术语', '旧释义']) expect(html).toContain(text);
});
it('renders validated image columns and callouts without accepting arbitrary styles', () => {
 const html=renderToStaticMarkup(<Markdown body={'<aside data-callout="blue" data-callout-icon="🧭" style="position:fixed"><p>第一段</p><p>第二段</p></aside>\n\n<figure data-image-columns="40,60" style="position:fixed"><img src="../assets/a.png" alt="第一张"><img src="../assets/b.png" alt="第二张"></figure>'} />);
 expect(html).toContain('data-callout="blue"');expect(html).toContain('data-callout-icon="🧭"');
 expect(html).toContain('data-image-columns="40,60"');expect(html).toContain('grid-template-columns:40fr 60fr');
 expect(html).toContain('aria-label="查看大图 第一张"');expect(html).not.toContain('position:fixed');
 const invalid=renderToStaticMarkup(<Markdown body={'<figure data-image-columns="1,9999"><p>内容</p></figure><aside data-callout="url(evil)"><p>说明</p></aside>'} />);
 expect(invalid).not.toContain('data-image-columns=');expect(invalid).not.toContain('data-callout=');
});
it('renders the callout palette and rejects unvalidated text colors', () => {
 for(const color of ['default','gray','brown','orange','yellow','green','blue','purple','pink','red']) {
  const html=renderToStaticMarkup(<Markdown body={`<aside data-callout="${color}" data-callout-text-color="${color}" data-callout-icon="🧑🏽‍💻"><p>正文</p></aside>`} />);
  expect(html).toContain(`data-callout="${color}"`);expect(html).toContain(`data-callout-text-color="${color}"`);expect(html).toContain('🧑🏽‍💻');
 }
 const html=renderToStaticMarkup(<Markdown body={'<aside data-callout="gray" data-callout-text-color="url(evil)" style="color:red"><p>正文</p></aside>'} />);
 expect(html).not.toContain('data-callout-text-color');expect(html).not.toContain('color:red');
});

it('keeps sanitized footnote anchors connected to their targets', () => {
  const html = renderToStaticMarkup(<Markdown body={'注释[^1]\n\n[^1]: 内容'} />);
  const targets = [...html.matchAll(/href="#([^" ]+)"/g)].map(match => match[1]);
  expect(targets.length).toBeGreaterThan(0);
  for (const target of targets) expect(html).toContain(`id="${target}"`);
});

it('isolates footnote targets between notes on the same page', () => {
  const body = '注释[^1]\n\n[^1]: 内容';
  const html = renderToStaticMarkup(<><Markdown body={body} /><Markdown body={body} /></>);
  const ids = [...html.matchAll(/ id="([^" ]+)"/g)].map(match => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
});
