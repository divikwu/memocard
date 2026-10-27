import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookRequestHandler } from "../../test-support/bridge";
import { createSearchFixture, type SearchFixtureMode } from "../../test-support/note-search.fixtures";
import { NoteSearchDialog } from "../business/NoteSearchDialog";
import { Button } from "../components/button";
import { usePreviewMode } from "../preview-mode";

let fixture: ReturnType<typeof createSearchFixture>;
async function searchDialog(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = await body.findByRole("dialog", { name: "搜索笔记" });
  await waitFor(() => expect(dialog).toBeVisible());
  const search = within(dialog);
  const input = search.getByRole("combobox", { name: "搜索笔记" });
  if (!(input as HTMLInputElement).disabled) await waitFor(() => expect(input).toHaveFocus());
  return { body, search, input };
}

type SearchExampleProps = { available: boolean; initialOpen: boolean; preserveSession: boolean; onOpenNote: (id: string) => void; onOpenChange: (open: boolean) => void };
function SearchExample({ available, initialOpen, preserveSession, onOpenNote, onOpenChange }: SearchExampleProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(initialOpen);
  const [openedNote, setOpenedNote] = useState<string | null>(null);
  const mode = usePreviewMode();
  const changeOpen = (next: boolean) => { setOpen(next); onOpenChange(next); };
  return <main className="ui-theme min-h-dvh space-y-4 p-6 text-primary sb-unstyled" data-ui-theme={mode}>
    <h1 className="type-heading-1">笔记搜索</h1>
    <p className="max-w-lg text-sm text-secondary">搜索示例使用内存数据。输入“计划”查看筛选、预览和分页。</p>
    <Button ref={trigger} onClick={() => changeOpen(true)}>{openedNote ? "返回搜索" : "打开搜索"}</Button>
    <output aria-label="已打开笔记" className="block text-sm text-secondary">{openedNote ?? "尚未打开笔记"}</output>
    <NoteSearchDialog open={open} available={available} preserveSession={preserveSession} returnFocus={trigger} vaultName="Storybook 示例库" onOpenChange={changeOpen} onOpenNote={id => { setOpenedNote(id); onOpenNote(id); changeOpen(false); }} />
  </main>;
}

const meta = {
  title: "business/note search",
  id: "ui-business-note-search",
  component: SearchExample,
  args: { available: true, initialOpen: true, preserveSession: false, onOpenNote: fn(), onOpenChange: fn() },
  argTypes: { onOpenNote: { control: false }, onOpenChange: { control: false }, initialOpen: { control: false } },
  parameters: { layout: "fullscreen", docs: { description: { component: "使用共享查询控制器、200ms去抖、分页与epoch保护。桌面Dialog/H5Sheet保留搜索会话、焦点返回与键盘交互，示例不读取真实笔记库。" } } },
  beforeEach: ({ parameters }) => {
    fixture = createSearchFixture((parameters.searchFixture ?? "normal") as SearchFixtureMode);
    return setStorybookRequestHandler(fixture.request);
  },
} satisfies Meta<typeof SearchExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopResults: Story = {};

export const DesktopResultsRegression: Story = {
  ...DesktopResults,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const { body, search } = await searchDialog(canvasElement);
    await search.findByRole("listbox", { name: "最近更新的笔记" });
    await search.findByRole("option", { name: "周末散步" });
    const preview = search.getByRole("complementary", { name: "笔记预览" });
    await expect(within(preview).getByRole("heading", { name: "项目计划" })).toBeVisible();
    await expect(within(preview).getByText(/这是项目计划正文/)).toBeVisible();
    await expect(fixture.calls[0]).toEqual({ operation: "queryNotes", params: { query: "", tags: [], sort: "updatedAt", limit: 30 } });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog", { name: "搜索笔记" })).not.toBeInTheDocument());
    const trigger = canvas.getByRole("button", { name: "打开搜索" });
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
    await userEvent.click(trigger);
    const reopened = await searchDialog(canvasElement);
    await userEvent.type(reopened.input, "计划");
    const result = await reopened.search.findByRole("option", { name: "计划清单" });
    await waitFor(() => expect(reopened.search.queryByRole("option", { name: "周末散步" })).not.toBeInTheDocument());
    await expect(reopened.search.getByRole("listbox", { name: "搜索结果" })).toHaveAttribute("aria-busy", "false");
    await expect(result.querySelector("mark")).toHaveTextContent("计划");
    await userEvent.keyboard("{ArrowDown}");
    await expect(result).toHaveAttribute("aria-selected", "true");
    await expect(reopened.input).toHaveAttribute("aria-activedescendant", result.id);
    await expect(within(reopened.search.getByRole("complementary", { name: "笔记预览" })).getByText("这是计划清单正文。")).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpenNote).toHaveBeenCalledOnce();
    await expect(args.onOpenNote).toHaveBeenCalledWith("search-checklist");
    await waitFor(() => expect(body.queryByRole("dialog", { name: "搜索笔记" })).not.toBeInTheDocument());
    await expect(canvas.getByLabelText("已打开笔记")).toHaveTextContent("search-checklist");
  },
};

export const Loading: Story = {
  parameters: { searchFixture: "loading", docs: { description: { story: "首次最近笔记请求保持加载；手动输入“计划”即可完成新查询。晚到响应保护由隐藏回归测试验证。" } } },
};

export const LoadingRegression: Story = {
  ...Loading,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const { search, input } = await searchDialog(canvasElement);
    await waitFor(() => expect(fixture.calls).toHaveLength(1));
    await expect(search.getByRole("status")).toHaveTextContent("正在搜索笔记");
    await expect(search.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
    await expect(search.queryByRole("option")).not.toBeInTheDocument();
    await userEvent.type(input, "计划");
    await search.findByRole("option", { name: "项目计划" });
    await expect(search.getAllByRole("option")).toHaveLength(3);
    await fixture.releaseLoading();
    await userEvent.keyboard("{ArrowDown}");
    await expect(search.getByRole("listbox", { name: "搜索结果" })).toHaveAttribute("aria-busy", "false");
    await expect(search.getAllByRole("option")).toHaveLength(3);
    await expect(search.queryByRole("option", { name: "周末散步" })).not.toBeInTheDocument();
    const selected = search.getByRole("option", { name: "计划清单" });
    await expect(selected).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-activedescendant", selected.id);
    await expect(search.getByRole("status")).toHaveTextContent("已显示 3 条结果");
    await expect(fixture.calls.at(-1)?.params.query).toBe("计划");
  },
};

export const Empty: Story = {
  parameters: { searchFixture: "empty" },
};

export const EmptyRegression: Story = {
  ...Empty,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const { search, input } = await searchDialog(canvasElement);
    await search.findByText("笔记库中还没有笔记");
    await userEvent.type(input, "不存在");
    await search.findByText("没有找到相关笔记");
    await expect(search.queryByRole("option")).not.toBeInTheDocument();
    await userEvent.click(search.getByRole("button", { name: "清空搜索" }));
    await search.findByText("笔记库中还没有笔记");
    await expect(input).toHaveValue("");
    await expect(input).toHaveFocus();
  },
};

export const Unavailable: Story = {
  args: { available: false },
  play: async ({ canvasElement, args }) => {
    const { search, input } = await searchDialog(canvasElement);
    await search.findByText("请先连接笔记库，再搜索内容。");
    await expect(input).toBeDisabled();
    await expect(search.queryByRole("option")).not.toBeInTheDocument();
    await expect(fixture.calls).toHaveLength(0);
    await expect(args.onOpenNote).not.toHaveBeenCalled();
  },
};

export const RetryAndPagination: Story = {
  parameters: { searchFixture: "retry-paging" },
};

export const RetryAndPaginationRegression: Story = {
  ...RetryAndPagination,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const { search } = await searchDialog(canvasElement);
    await expect(await search.findByRole("alert")).toHaveTextContent("示例搜索读取失败");
    await userEvent.click(search.getByRole("button", { name: "重试" }));
    await search.findByRole("option", { name: "项目计划" });
    await expect(search.getAllByRole("option")).toHaveLength(2);
    await expect(search.getByText("部分文件尚未读入，搜索结果可能不完整。")).toBeVisible();
    await userEvent.click(search.getByRole("button", { name: "加载更多结果" }));
    await expect(await search.findByRole("alert")).toHaveTextContent("示例下一页读取失败");
    await expect(search.getAllByRole("option")).toHaveLength(2);
    await userEvent.click(search.getByRole("button", { name: "重试" }));
    await search.findByRole("option", { name: "计划复盘" });
    await expect(search.getAllByRole("option")).toHaveLength(3);
    await expect(search.queryByRole("alert")).not.toBeInTheDocument();
    await expect(search.queryByRole("button", { name: "加载更多结果" })).not.toBeInTheDocument();
    await expect(fixture.calls.slice(-2).map(call => call.params)).toEqual([
      { query: "", tags: [], sort: "updatedAt", limit: 30, cursor: "search-page-2" },
      { query: "", tags: [], sort: "updatedAt", limit: 30, cursor: "search-page-2" },
    ]);
  },
};

export const MobilePreservedSession: Story = {
  tags: ["mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  args: { preserveSession: true },
  parameters: { searchFixture: "paging", docs: { story: { height: "844px" } } },
};

export const MobilePreservedSessionRegression: Story = {
  ...MobilePreservedSession,
  tags: ["mobile", "!dev", "!autodocs"],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const { body, search, input } = await searchDialog(canvasElement);
    await search.findByRole("option", { name: "项目计划" });
    await userEvent.type(input, "计划");
    await search.findByRole("listbox", { name: "搜索结果" });
    await waitFor(() => expect(fixture.calls.at(-1)?.params).toEqual({ query: "计划", tags: [], sort: "updatedAt", limit: 30 }));
    await waitFor(() => expect(search.getByRole("listbox")).toHaveAttribute("aria-busy", "false"));
    await userEvent.click(search.getByRole("button", { name: "加载更多结果" }));
    await search.findByRole("option", { name: "计划复盘" });
    // Base UI restores the removed paging control's focus to the Popup again next frame.
    await waitFor(() => expect(body.getByRole("dialog", { name: "搜索笔记" })).toHaveFocus());
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await userEvent.click(input);
    const selected = search.getByRole("option", { name: "计划清单" });
    try {
      await waitFor(() => {
        expect(input).toHaveFocus();
        expect(search.getByRole("listbox")).toHaveAttribute("aria-busy", "false");
        expect(search.getAllByRole("option")).toHaveLength(3);
      });
      await userEvent.keyboard("{ArrowDown}");
      await waitFor(() => {
        expect(selected).toHaveAttribute("aria-selected", "true");
        expect(input).toHaveAttribute("aria-activedescendant", selected.id);
        expect(input).toHaveFocus();
      });
      await userEvent.keyboard("{Enter}");
      await expect(args.onOpenNote).toHaveBeenCalledOnce();
    } catch (cause) {
      const active = canvasElement.ownerDocument.activeElement;
      console.error("Search session keyboard state", JSON.stringify({
        focus: { tag: active?.tagName, label: active?.getAttribute("aria-label") },
        input: { connected: input.isConnected, value: (input as HTMLInputElement).value, activeDescendant: input.getAttribute("aria-activedescendant") },
        busy: search.queryByRole("listbox")?.getAttribute("aria-busy"),
        options: search.queryAllByRole("option").map(option => ({ name: option.getAttribute("aria-label"), selected: option.getAttribute("aria-selected") })),
        calls: fixture.calls,
      }));
      throw cause;
    }
    await expect(args.onOpenNote).toHaveBeenCalledWith("search-checklist");
    await waitFor(() => expect(body.queryByRole("dialog", { name: "搜索笔记" })).not.toBeInTheDocument());
    const requests = fixture.calls.length;
    await userEvent.click(canvas.getByRole("button", { name: "返回搜索" }));
    const reopened = await searchDialog(canvasElement);
    await expect(reopened.input).toHaveValue("计划");
    await expect(reopened.search.getAllByRole("option")).toHaveLength(3);
    await expect(reopened.search.getByRole("option", { name: "计划清单" })).toHaveAttribute("aria-selected", "true");
    await expect(fixture.calls).toHaveLength(requests);
    await userEvent.click(reopened.search.getByRole("button", { name: "退出搜索" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "搜索笔记" })).not.toBeInTheDocument());
    await expect(args.onOpenChange).toHaveBeenLastCalledWith(false);
  },
};
