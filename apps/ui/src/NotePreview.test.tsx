// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NotePreview } from "./NotePreview";

vi.mock("./bridge", () => ({ request: vi.fn() }));
vi.mock("./client-mode", () => ({ isBrowserVault: false }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("renders Markdown in drafts and exposes the full long note without entering edit mode", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(720);
  render(<NotePreview body={"## 草稿标题\n\n**重要内容**"} notePath="notes/folder/note.md" onError={vi.fn()} />);
  expect(screen.getByRole("heading", { name: "草稿标题" })).toBeTruthy();
  expect(screen.getByText("重要内容").tagName).toBe("STRONG");
  const expand = screen.getByRole("button", { name: "展开全文" });
  expect(expand.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(expand);
  expect(screen.getByRole("button", { name: "收起全文" }).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "收起全文" }));
  expect(screen.getByRole("button", { name: "展开全文" })).toBeTruthy();
});

it("hides standalone duplicate tag lines only in compact card previews", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  render(<NotePreview compact hiddenTags={["写回验收"]} body={"正文里的 #写回验收 保留\n\n#写回验收"} onError={vi.fn()} />);
  expect(screen.getByText("正文里的 #写回验收 保留")).toBeTruthy();
  expect(screen.queryByText("#写回验收")).toBeNull();
});
