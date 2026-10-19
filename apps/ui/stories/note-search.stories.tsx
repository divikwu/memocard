import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookRequestHandler } from "../.storybook/bridge";
import { desktopGlobals } from "../.storybook/viewports";
import { NoteSearchExample } from "./note-search.example";
import { createSearchFixture, type SearchFixtureMode } from "./note-search.fixtures";

let fixture: ReturnType<typeof createSearchFixture>;
async function searchDialog(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  const dialog = await body.findByRole("dialog", { name: "搜索笔记" });
  const search = within(dialog);
  const input = search.getByRole("combobox", { name: "搜索笔记" });
  if (!(input as HTMLInputElement).disabled) await waitFor(() => expect(input).toHaveFocus());
  return { body, search, input };
}

const meta = {
  title: "business/note search",
  component: NoteSearchExample,
  globals: desktopGlobals,
  args: { available: true, initialOpen: true, preserveSession: false, onOpenNote: fn(), onOpenChange: fn() },
  parameters: {
    layout: "fullscreen",
    docs: { story: { height: "900px" }, description: { component: "真实 NoteSearchDialog、Markdown 预览与受控开合入口。数据操作只进入本故事的内存 queryNotes fixture。Docs 的嵌入故事不自动播放：初始展示最近笔记、加载、空库、不可用或错误；搜索高亮、分页及会话过程可手动操作，或在 Canvas 查看 play 验证。H5 是 Web Sheet，不能作为 iOS 原生搜索的验收。" } },
  },
  beforeEach: ({ parameters }) => {
    fixture = createSearchFixture((parameters.searchFixture ?? "normal") as SearchFixtureMode);
    return setStorybookRequestHandler(fixture.request);
  },
} satisfies Meta<typeof NoteSearchExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopResults: Story = {
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
  parameters: { searchFixture: "loading", docs: { description: { story: "首次最近笔记请求保持加载；输入“计划”即可完成新查询。play 还会释放晚到的首次响应，验证它不会覆盖当前查询。" } } },
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
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const { body, search, input } = await searchDialog(canvasElement);
    await search.findByRole("option", { name: "项目计划" });
    await userEvent.type(input, "计划");
    await search.findByRole("listbox", { name: "搜索结果" });
    await waitFor(() => expect(search.getByRole("listbox")).toHaveAttribute("aria-busy", "false"));
    await userEvent.click(search.getByRole("button", { name: "加载更多结果" }));
    await search.findByRole("option", { name: "计划复盘" });
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onOpenNote).toHaveBeenCalledOnce();
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
