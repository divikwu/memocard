import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Note, NotePage } from "@memocard/contracts";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookClientMode, setStorybookRequestHandler } from "../../.storybook/bridge";
import { NoteCollection } from "../business/NoteCollection";
import { TrashPage } from "../business/TrashPage";
import { Button } from "../components/button";
import { createWorkspaceFixture } from "../web/workspace-fixture";
import { usePreviewMode } from "../preview-mode";

const operations = fn<(operation: string) => void>();

function BusinessParityFixture() {
  const mode = usePreviewMode();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [width, setWidth] = useState(1280);
  useEffect(() => {
    let active = true;
    let detach: (() => void) | undefined;
    const restoreMode = setStorybookClientMode("browser");
    const originalStorage = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, String(value)); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } });
    void createWorkspaceFixture().then(async fixture => {
      const seeds = fixture.snapshot().notes;
      for (const note of seeds.filter(note => ["今天的手冲记录", "让设计语言走进真实页面"].includes(note.title ?? ""))) await fixture.request("deleteNote", { id: note.id });
      const page = await fixture.request<NotePage>("queryNotes");
      if (!active) return;
      detach = setStorybookRequestHandler((operation, params) => { operations(operation); return fixture.request(operation, params); });
      setNotes(page.notes);
    });
    return () => { active = false; detach?.(); restoreMode(); Object.defineProperty(window, "localStorage", originalStorage); };
  }, []);
  return <div className="ui-next-theme sb-unstyled p-4" data-ui-theme={mode}>
    <h1 className="mb-2 type-heading-1">Sidebar-10 业务布局回归</h1>
    <p className="mb-4 text-sm text-secondary">测试专用固定宽容器；在桌面视口运行自动断言。仅操作内存笔记，不连接真实笔记库。</p>
    <div className="mb-4 flex flex-wrap gap-2">{[1280, 768, 767, 390, 320].map(value => <Button key={value} variant="outline" size="sm" onClick={() => setWidth(value)} aria-pressed={width === value}>宽度 {value}</Button>)}</div>
    {notes ? <>
      <div style={{ width, maxWidth: "none" }} data-testid="collection-width-fixture">
        <NoteCollection notes={notes} query="" onQueryChange={() => {}} searchPlaceholder="布局验收" searchDisabled hasMore={false} paging={false} loadMoreDisabled canOpen={false} canCreate={false} onNewNote={() => {}} onOpen={() => {}} onSelectTag={() => {}} onLoadMore={() => {}} onError={() => {}} formatDate={() => "2026-10-22"} />
      </div>
      <div className="mt-8 max-w-3xl"><TrashPage vaultId="preview-only-vault" refreshVersion={0} onRestored={() => {}} canPermanentlyDelete /></div>
    </> : <p role="status">正在准备布局验收…</p>}
  </div>;
}

const meta = { title: "verification/Sidebar-10 business parity", id: "ui-next-sidebar10-business-parity", component: BusinessParityFixture, parameters: { layout: "fullscreen" }, beforeEach: () => { operations.mockClear(); } } satisfies Meta<typeof BusinessParityFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LayoutAndCardActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole("list", { name: "笔记列表" });
    await waitFor(() => expect(getComputedStyle(list).gridTemplateColumns.trim().split(/\s+/)).toHaveLength(3));
    await userEvent.click(canvas.getByRole("button", { name: "列表布局" }));
    for (const width of [768, 767, 390, 320]) {
      await userEvent.click(canvas.getByRole("button", { name: `宽度 ${width}` }));
      const tags = list.querySelector<HTMLElement>(".next-note-tags")!;
      const date = list.querySelector<HTMLElement>(".next-note-list-date")!;
      await waitFor(() => {
        expect(getComputedStyle(tags).display === "none").toBe(width < 768);
        expect(getComputedStyle(date).display === "none").toBe(width < 768);
      });
      if (width < 768) for (const open of within(list).getAllByRole("button", { name: /^打开 / })) expect(open.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    await userEvent.click(canvas.getByRole("button", { name: "宽度 390" }));
    const open = await canvas.findByRole("button", { name: "查看已删除笔记：今天的手冲记录" });
    const card = open.closest<HTMLElement>(".next-trash-card")!;
    card.scrollIntoView({ block: "center", behavior: "instant" });
    await waitFor(() => {
      const bounds = card.getBoundingClientRect();
      const hit = canvasElement.ownerDocument.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + 8);
      expect(hit?.closest("button")).toBe(open);
    });
    await userEvent.click(open);
    const body = within(canvasElement.ownerDocument.body);
    await body.findByRole("dialog", { name: "今天的手冲记录" });
    await expect(operations).toHaveBeenCalledWith("getTrashedNote");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(open).toHaveFocus());
    operations.mockClear();
    await userEvent.click(canvas.getByRole("button", { name: "永久删除笔记：让设计语言走进真实页面" }));
    const confirmation = await body.findByRole("dialog", { name: "永久删除「让设计语言走进真实页面」？" });
    await expect(operations).not.toHaveBeenCalledWith("getTrashedNote");
    await userEvent.click(within(confirmation).getByRole("button", { name: "取消" }));
    await expect(operations).not.toHaveBeenCalledWith("permanentlyDeleteNote");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(canvas.getByRole("button", { name: "恢复笔记：让设计语言走进真实页面" }));
    await waitFor(() => expect(canvas.queryByRole("button", { name: "查看已删除笔记：让设计语言走进真实页面" })).not.toBeInTheDocument());
    await expect(operations).toHaveBeenCalledWith("restoreNote");
    await expect(operations).not.toHaveBeenCalledWith("getTrashedNote");
    await expect(open).toBeInTheDocument();
  },
};
