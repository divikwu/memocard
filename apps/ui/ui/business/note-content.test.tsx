// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NoteMarkdown } from "./NoteMarkdown";
import { NotePreview } from "./NotePreview";
import { compactPreviewBody } from "../../src/note-preview";

vi.mock("../../src/bridge", () => ({ request: vi.fn(), isBrowserVault: false, isLocalWeb: false }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("retains the shared safe Markdown pipeline, complete semantics, WikiLinks and local attachments", () => {
  const body = '## 思考\n\n[[相关笔记|关联]]\n\n![本地图片](../assets/photo.png)\n\n- [x] 完成\n- [ ] 待办\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n$E=mc^2$\n\n说明[^1]\n\n[^1]: 脚注\n\n<p><mark>重点</mark> <kbd>Enter</kbd></p>\n\n<aside data-callout="blue" data-callout-icon="🧭"><p>提示</p></aside>\n\n<figure data-image-columns="40,60"><img src="../assets/a.png" alt="第一张"><img src="../assets/b.png" alt="第二张"></figure>';
  const html = renderToStaticMarkup(<NoteMarkdown body={body} notePath="notes/note.md" />);
  for (const tag of ["h2", "table", "math", "mark", "kbd", "aside", "figure"]) expect(html).toContain(`<${tag}`);
  expect(html).toContain("typeset-memocard");
  expect(html).toContain("memocard-internal:");
  expect(html).toContain('src="memocard-asset://vault/assets/photo.png"');
  expect(html).toContain('data-callout="blue"');
  expect(html).toContain('grid-template-columns:40fr 60fr');
  expect(html).toContain('data-footnotes');
  for (const target of [...html.matchAll(/href="#([^" ]+)"/g)].map(match => match[1])) expect(html).toContain(`id="${target}"`);
});

it("rejects active HTML, remote tracking images and escaped vault paths", () => {
  const html = renderToStaticMarkup(<NoteMarkdown body={'<script>alert(1)</script><iframe src="https://tracker.test"></iframe><img src="https://tracker.test/pixel" onerror="alert(1)">\n\n[坏链接](javascript:alert)\n\n![逃逸](../../../assets/photo.png)\n\n<aside data-callout="url(evil)" style="position:fixed"><p>正文</p></aside>'} />);
  for (const unsafe of ["<script", "<iframe", "onerror", "javascript:", 'src="https:', "position:fixed", 'data-callout="url']) expect(html).not.toContain(unsafe);
  expect(html).toContain("仅显示笔记库中的图片");
});

it("exposes full note expansion without changing the editing mode", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(720);
  render(<NotePreview body={"## 草稿标题\n\n**正文**"} onError={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "草稿标题" })).toBeTruthy();
  expect(screen.getByText("正文").tagName).toBe("STRONG");
  const expand = screen.getByRole("button", { name: "展开全文" });
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(expand);
  expect(screen.getByRole("button", { name: "收起全文" }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "收起全文" }));
  expect(screen.getByRole("button", { name: "展开全文" })).toBeTruthy();
});

it("keeps compact previews noninteractive while preserving inline tags and fenced code", () => {
  const body = '正文里的 #工作 保留\n\n#工作 #设计\n\n```md\n#工作\n```\n\n[链接](https://example.com)\n\n![本地图片](../assets/photo.png)\n\n<details><summary>详情</summary><p>说明</p></details>\n\n- [x] 完成\n- [ ] 待办';
  const compact = compactPreviewBody(body, ["工作", "设计"]);
  expect(compact).toContain("正文里的 #工作 保留");
  expect(compact).not.toContain("#工作 #设计");
  expect(compact).toContain("```md\n#工作\n```");
  const html = renderToStaticMarkup(<NoteMarkdown body={compact} compact interactive={false} />);
  for (const interactive of ["<button", "<a ", "<input", "<details", "tabindex="]) expect(html).not.toContain(interactive);
  expect(html).toContain('alt="本地图片"');
  expect(html).toContain('class="note-task-indicator" aria-hidden="true" data-checked="true"');
  expect(html).toContain('class="note-task-indicator" aria-hidden="true" data-checked="false"');
  expect(html).not.toMatch(/[☐☑]/);
});

it("isolates footnote IDs between notes and retains source for Mermaid diagrams", () => {
  const body = '说明[^1]\n\n[^1]: 脚注\n\n```mermaid\ngraph TD; A-->B\n```';
  const html = renderToStaticMarkup(<><NoteMarkdown body={body} /><NoteMarkdown body={body} /></>);
  const ids = [...html.matchAll(/ id="([^" ]+)"/g)].map(match => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
  expect(html).toContain('class="language-mermaid"');
  expect(html).toContain("Mermaid 显示模式");
  expect(html).toContain("源码与图形");
});
