// @vitest-environment jsdom
import { createRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { undo, redo } from "@codemirror/commands";
import { LiveMarkdownEditor } from "./LiveMarkdownEditor";
import { request } from "./bridge";

vi.mock("./bridge", () => ({ request: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./client-mode", () => ({ isBrowserVault: false, isLocalWeb: false }));

function view() {
  const editor = EditorView.findFromDOM(screen.getByRole("textbox", { name: "笔记内容" }));
  if (!editor) throw new Error("Missing CodeMirror view");
  return editor;
}

function setup(body = "", options: Partial<React.ComponentProps<typeof LiveMarkdownEditor>> = {}) {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const onError = vi.fn();
  function Harness() {
    const [value, setValue] = useState(body);
    return <LiveMarkdownEditor value={value} onChange={(next) => { onChange(next); setValue(next); }}
      notePath="notes/note.md" disabled={false} onSave={onSave} onError={onError} {...options} />;
  }
  return { ...render(<Harness />), onChange, onSave, onError };
}

beforeEach(() => {
  vi.mocked(request).mockClear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("inline Markdown editor", () => {
  it("renders formatting in the same editable surface without changing the source on mount", () => {
    const source = "# Heading\n\n**bold** and *italic* and ~~deleted~~ and `code`\n\n- list\n> quote";
    const { onChange, container } = setup(source);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("textbox", { name: "笔记内容" }).getAttribute("contenteditable")).toBe("true");
    expect(container.querySelector(".mc-live-heading-1")?.textContent).toBe("Heading");
    expect(container.querySelector(".mc-live-strong")?.textContent).toBe("bold");
    expect(container.querySelector(".mc-live-emphasis")?.textContent).toBe("italic");
    expect(container.querySelector(".mc-live-strike")?.textContent).toBe("deleted");
    expect(view().state.sliceDoc()).toBe(source);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reveals syntax on the current line and hides it again after leaving that line", () => {
    const { container } = setup("**bold**\n\nnext");
    expect(container.querySelector(".mc-live-strong")?.textContent).toBe("bold");
    act(() => { view().focus(); view().dispatch({ selection: { anchor: 3 } }); });
    expect(container.querySelector(".mc-live-strong")?.textContent).toBe("**bold**");
    act(() => view().dispatch({ selection: { anchor: view().state.doc.length } }));
    expect(container.querySelector(".mc-live-strong")?.textContent).toBe("bold");
  });

  it("preserves mixed line endings and unfamiliar Markdown when editing another paragraph", () => {
    const source = "原文\r\n\r\n| a | b |\n| - | - |\r\n\n[ref]: https://example.com \"title\"\n\n<custom>literal</custom>\n\n[^n]: 未知扩展\r\n";
    const { onChange } = setup(source);
    act(() => view().dispatch({ changes: { from: 0, to: 2, insert: "修改" } }));
    expect(onChange).toHaveBeenLastCalledWith(source.replace("原文", "修改"));
    expect(view().state.sliceDoc()).toBe(source.replace("原文", "修改"));
  });

  it("renders only vault images and retains their relative Markdown through undo and redo", () => {
    const source = "# Test\n\n![local](../../assets/photo.png)\n\n";
    const { onChange } = setup(source, { notePath: "notes/folder/note.md" });
    expect(screen.getByRole("img", { name: "local" }).getAttribute("src")).toBe("memocard-asset://vault/assets/photo.png");
    act(() => view().dispatch({ changes: { from: view().state.doc.length, insert: "new" } }));
    expect(onChange).toHaveBeenLastCalledWith(`${source}new`);
    act(() => { undo(view()); });
    expect(onChange).toHaveBeenLastCalledWith(source);
    act(() => { redo(view()); });
    expect(onChange).toHaveBeenLastCalledWith(`${source}new`);
  });

  it("does not render HTML, remote images or unsafe links", () => {
    const source = '<script>alert(1)</script>\n<img src="https://example.com/track.png" onerror="alert(1)">\n\n![remote](https://example.com/x.png)\n![data](data:image/png;base64,AAAA)\n![escape](../../outside.png)\n![encoded](../assets/%2e%2e/x.png)\n[bad](javascript:alert%281%29)';
    const { container } = setup(source);
    expect(container.querySelector("script,img,a")).toBeNull();
    expect(view().state.sliceDoc()).toBe(source);
    expect(request).not.toHaveBeenCalled();
  });

  it("opens safe links only on modified click using the native bridge", () => {
    setup("[link](https://example.com/path)");
    const link = screen.getByRole("link", { name: "link" });
    fireEvent.click(link);
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(link, { metaKey: true });
    expect(request).toHaveBeenCalledWith("openExternal", { url: "https://example.com/path" });
  });

  it.each(["&amp;", "&#38;", "&#x26;"])("decodes Markdown URL entities %s only for display and navigation", (entity) => {
    const source = `[link](https://example.com/?a=1${entity}b=2)\n\n![local](../assets/a${entity}b.png)\n\n`;
    const { onChange } = setup(source);
    const link = screen.getByRole("link", { name: "link" });
    expect(link.getAttribute("href")).toBe("https://example.com/?a=1&b=2");
    expect(screen.getByRole("img", { name: "local" }).getAttribute("src")).toBe("memocard-asset://vault/assets/a%26b.png");
    fireEvent.click(link, { ctrlKey: true });
    expect(request).toHaveBeenCalledWith("openExternal", { url: "https://example.com/?a=1&b=2" });
    expect(view().state.sliceDoc()).toBe(source);
    expect(onChange).not.toHaveBeenCalled();
    act(() => view().dispatch({ changes: { from: source.length, insert: "changed" } }));
    expect(onChange).toHaveBeenLastCalledWith(`${source}changed`);
  });

  it("validates decoded schemes and paths before creating links or images", () => {
    const source = "[bad](javascript&colon;alert%281%29)\n![remote](https&colon;//example.com/x.png)\n![escape](../assets/&#46;&#46;/&#46;&#46;/outside.png)\n![encoded](../assets/&#37;2e&#37;2e/x.png)";
    const { container } = setup(source);
    expect(container.querySelector("a,img")).toBeNull();
    expect(view().state.sliceDoc()).toBe(source);
    expect(request).not.toHaveBeenCalled();
  });

  it("updates paths and disabled state without replacing document, cursor or history", () => {
    const onChange = vi.fn();
    const props = { value: "![local](../../assets/photo.png)\n\n", onChange, onSave: vi.fn(), onError: vi.fn(), disabled: false, notePath: "notes/note.md" };
    const { rerender } = render(<LiveMarkdownEditor {...props} />);
    const originalView = view();
    act(() => originalView.dispatch({ selection: { anchor: 5 }, changes: { from: originalView.state.doc.length, insert: "edited" } }));
    rerender(<LiveMarkdownEditor {...props} value={`${props.value}edited`} notePath="notes/folder/note.md" disabled />);
    expect(view()).toBe(originalView);
    expect(view().state.selection.main.head).toBe(5);
    expect(screen.getByRole("img", { name: "local" }).getAttribute("src")).toBe("memocard-asset://vault/assets/photo.png");
    expect(view().state.facet(EditorState.readOnly)).toBe(true);
    expect(view().contentDOM.getAttribute("contenteditable")).toBe("false");
    rerender(<LiveMarkdownEditor {...props} value={`${props.value}edited`} notePath="notes/folder/note.md" />);
    act(() => { undo(view()); });
    expect(onChange).toHaveBeenLastCalledWith(props.value);
  });

  it("applies an external image append without echoing it, and keeps it undoable", () => {
    const props = { value: "笔记", onChange: vi.fn(), onSave: vi.fn(), onError: vi.fn(), disabled: false, notePath: "notes/note.md" };
    const { rerender } = render(<LiveMarkdownEditor {...props} />);
    act(() => view().dispatch({ selection: { anchor: 2 } }));
    const appended = `${props.value}\n\n![图片](../assets/photo.png)\n\n`;
    rerender(<LiveMarkdownEditor {...props} value={appended} />);
    expect(view().state.selection.main.head).toBe(appended.length);
    expect(screen.getByRole("img", { name: "图片" })).toBeTruthy();
    expect(props.onChange).not.toHaveBeenCalled();
    act(() => { undo(view()); });
    expect(props.onChange).toHaveBeenLastCalledWith(props.value);
  });

  it("forwards the actual editable element for dialog focus and guards composition save", () => {
    const ref = createRef<HTMLDivElement>();
    const { onSave } = setup("中文", { ref });
    const field = screen.getByRole("textbox", { name: "笔记内容" });
    expect(ref.current).toBe(field);
    fireEvent.keyDown(field, { key: "Enter", metaKey: true, isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true, keyCode: 229 });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });
    expect(onSave).toHaveBeenCalledOnce();
    expect(view().state.sliceDoc()).toBe("中文");
  });
});
