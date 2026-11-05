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
const selectors = vi.hoisted(() => {
  let rejectTags!: (error: Error) => void, rejectChoices!: (error: Error) => void;
  const tags = new Promise<never>((_, fail) => { rejectTags = fail; });
  const choices = new Promise<never>((_, fail) => { rejectChoices = fail; });
  return { tags, choices, rejectTags, rejectChoices };
});
vi.mock("./DatePropertyPicker", () => calendar.pending);
vi.mock("./TagPropertyEditor", () => selectors.tags);
vi.mock("./ChoicePropertyEditor", () => selectors.choices);
vi.mock("../../src/bridge", () => ({ request: async (operation: string) => operation === "getPropertyLabels" ? { labels: {}, contentHash: "labels" } : operation === "listTags" ? { tags: [] } : {}, errorMessage: (error: Error) => error.message }));

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
    expect(alert.textContent).toBe("加载失败重试");
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

it("preserves selected tags and choices across chunk failure and recovery", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const host = document.createElement("div"); document.body.append(host);
  const apply = vi.fn(), uncaught = vi.fn();
  const root = createRoot(host, { onCaughtError: () => {}, onUncaughtError: uncaught });
  const user = userEvent.setup();
  try {
    await act(async () => { root.render(<NoteProperties note={{ id: "failed-selectors", contentHash: "hash" } as Note} tags={["正文"]} canEdit busy={false} onApply={apply} savedProperties={{
      contentHash: "hash", writable: true,
      tagProperty: { name: "tags", type: "list", value: ["project/yami", "area"], editable: true },
      properties: [
        { name: "单选", type: "select", value: "设计", options: [{ name: "设计", color: "blue" }], editable: true },
        { name: "多选", type: "multiSelect", value: ["设计", "开发"], editable: true },
      ],
    }} />); });
    await user.click(await within(host).findByRole("button", { name: "编辑标签" }));
    const tags = await within(document.body).findByRole("dialog", { name: "编辑标签" });
    await act(async () => { selectors.rejectTags(new Error("chunk unavailable")); });
    expect((await within(tags).findByRole("alert")).textContent).toBe("加载失败重试");
    expect(tags.querySelector('.note-tag-header')!.textContent).toBe("project/yamiarea正文");
    expect(tags.querySelectorAll('.note-tag-header button')).toHaveLength(0);
    vi.doMock("./TagPropertyEditor", async () => vi.importActual("./TagPropertyEditor"));
    await user.click(within(tags).getByRole("button", { name: "重试加载标签" }));
    await within(tags).findByRole("combobox", { name: "搜索或新建属性标签" });
    expect(within(tags).getByRole("toolbar", { name: "已选标签" }).textContent).toContain("project/yami");
    await user.keyboard("{Escape}");
    await user.click(within(host).getByRole("button", { name: "编辑属性 单选" }));
    const single = await within(document.body).findByRole("dialog", { name: "编辑属性 单选" });
    await act(async () => { selectors.rejectChoices(new Error("chunk unavailable")); });
    await within(single).findByRole("alert");
    expect(single.querySelector('.note-tag-header')!.textContent).toBe("设计");
    expect(single.querySelector('.note-tag-header .note-tag-color-blue')).toBeTruthy();
    await user.keyboard("{Escape}");
    await user.click(within(host).getByRole("button", { name: "编辑属性 多选" }));
    const multiple = await within(document.body).findByRole("dialog", { name: "编辑属性 多选" });
    expect((await within(multiple).findByRole("alert")).textContent).toBe("加载失败重试");
    expect(multiple.querySelector('.note-tag-header')!.textContent).toBe("设计开发");
    vi.doMock("./ChoicePropertyEditor", async () => vi.importActual("./ChoicePropertyEditor"));
    await user.click(within(multiple).getByRole("button", { name: "重试加载选项" }));
    await within(multiple).findByRole("combobox", { name: "搜索或创建选项" });
    expect(within(multiple).getByRole("button", { name: "移除选项 开发" })).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    expect(uncaught).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
    vi.doUnmock("./TagPropertyEditor"); vi.doUnmock("./ChoicePropertyEditor");
  }
}, 20_000);
