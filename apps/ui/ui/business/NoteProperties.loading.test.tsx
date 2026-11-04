// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Note } from "@memocard/contracts";
import { NoteProperties } from "./NoteProperties";
import { RichMarkdownEditor } from "./RichMarkdownEditor";

const calendar = vi.hoisted(() => {
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_, fail) => { reject = fail; });
  return { pending, reject };
});
vi.mock("./DatePropertyPicker", () => calendar.pending);
vi.mock("../../src/bridge", () => ({ request: async (operation: string) => operation === "getPropertyLabels" ? { labels: {}, contentHash: "labels" } : {}, errorMessage: (error: Error) => error.message }));

it("keeps unsaved content and properties mounted while a date chunk waits, fails and retries", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const host = document.createElement("div"); document.body.append(host);
  const uncaught = vi.fn(), apply = vi.fn();
  const root = createRoot(host, { onCaughtError: () => {}, onUncaughtError: uncaught });
  const note = { id: "loading", contentHash: "hash" } as Note;
  const properties = { contentHash: "hash", writable: true, properties: [{ name: "日期", type: "date" as const, value: "2026-10-12", editable: true }] };
  try {
    await act(async () => { root.render(<main>
      <RichMarkdownEditor value="未保存的正文" notePath="loading.md" disabled={false} onChange={() => {}} onSave={() => {}} onError={() => {}} />
      <NoteProperties note={note} tags={[]} canEdit busy={false} savedProperties={properties} onApply={apply} />
    </main>); });
    const content = await within(host).findByRole("textbox", { name: "笔记内容" });
    await userEvent.setup().click(within(host).getByRole("button", { name: "更多属性" }));
    const fields = within(host).getByLabelText("笔记属性");
    await userEvent.setup().click(await within(host).findByRole("button", { name: "编辑属性 日期" }));
    const popup = await within(document.body).findByRole("dialog", { name: "编辑属性 日期" });
    expect(within(popup).getByRole("status").textContent).toContain("正在读取日期");
    await act(async () => { calendar.reject(new TypeError("Failed to fetch dynamically imported module")); });
    const alert = await within(popup).findByRole("alert");
    expect(alert.textContent).toContain("无法打开日期");
    expect(within(host).getByRole("textbox", { name: "笔记内容" })).toBe(content);
    expect(content.textContent).toContain("未保存的正文");
    expect(within(host).getByLabelText("笔记属性")).toBe(fields);
    vi.doMock("./DatePropertyPicker", async () => vi.importActual("./DatePropertyPicker"));
    await userEvent.setup().click(within(alert).getByRole("button", { name: "重试加载日期" }));
    await waitFor(() => expect(within(popup).getByRole("textbox", { name: "属性值" })).toHaveProperty("value", "10/12/2026"), { timeout: 10_000 });
    expect(within(host).getByRole("textbox", { name: "笔记内容" })).toBe(content);
    expect(apply).not.toHaveBeenCalled();
    expect(uncaught).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.doUnmock("./DatePropertyPicker");
  }
}, 20_000);
