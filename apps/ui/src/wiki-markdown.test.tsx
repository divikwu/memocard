// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NoteMarkdown as Markdown } from "@ui-next/business/NoteMarkdown";
import { request } from "./bridge";
vi.mock("./bridge", () => ({ request: vi.fn() }));
vi.mock("./client-mode", () => ({ isBrowserVault: false, isLocalWeb: true }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("renders a wiki alias, resolves its target and dispatches the existing protected opening flow", async () => {
  vi.mocked(request).mockResolvedValue({ kind: "note", id: "11111111-1111-4111-8111-111111111111", path: "Projects/Target.md" });
  const opened = vi.fn(); window.addEventListener("memocard:open-note", opened);
  try {
    render(<Markdown body={'[[Projects/Target|目标]]\n\n`[[literal]]`\n\n```\n[[code]]\n```'} notePath="Home.md" />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    fireEvent.click(screen.getByRole("link", { name: "目标" }));
    await waitFor(() => expect(opened).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith("resolveLink", { target: "Projects/Target", sourcePath: "Home.md", wiki: true });
  } finally { window.removeEventListener("memocard:open-note", opened); }
});
it("resolves wiki images without rewriting their source or loading a remote URL", async () => {
  vi.mocked(request).mockResolvedValue({ kind: "image", path: "Images/pic.png" });
  render(<Markdown body="![[pic.png]]" notePath="Home.md" />);
  await waitFor(() => expect(screen.getByRole("img").getAttribute("src")).toBe("/api/assets/Images/pic.png"));
});
it("keeps a resolved wiki image mounted when unchanged notes are refreshed", async () => {
  vi.mocked(request).mockResolvedValue({ kind: "image", path: "Images/pic.png" });
  const { rerender } = render(<Markdown body="![[pic.png]]" notePath="Home.md" onError={() => {}} />);
  const image = screen.getByRole("img");
  await waitFor(() => expect(image.getAttribute("src")).toBe("/api/assets/Images/pic.png"));
  rerender(<Markdown body="![[pic.png]]" notePath="Home.md" onError={() => {}} />);
  expect(screen.getByRole("img")).toBe(image);
  expect(request).toHaveBeenCalledTimes(1);
});
it("resolves the new image when its source changes without remounting the image", async () => {
  vi.mocked(request).mockResolvedValueOnce({ kind: "image", path: "Images/first.png" })
    .mockResolvedValueOnce({ kind: "image", path: "Images/second.png" });
  const { rerender } = render(<Markdown body="![[first.png]]" notePath="Home.md" />);
  const image = screen.getByRole("img");
  await waitFor(() => expect(image.getAttribute("src")).toBe("/api/assets/Images/first.png"));
  rerender(<Markdown body="![[second.png]]" notePath="Home.md" />);
  await waitFor(() => expect(image.getAttribute("src")).toBe("/api/assets/Images/second.png"));
  expect(screen.getByRole("img")).toBe(image);
  expect(request).toHaveBeenCalledTimes(2);
});
