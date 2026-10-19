import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { desktopGlobals } from "../.storybook/viewports";
import { NoteCollectionExample } from "./note-collection.example";

const meta = {
  title: "business/note collection",
  component: NoteCollectionExample,
  globals: desktopGlobals,
  args: { home: false, state: "ready", onQueryChange: fn(), onSelectTag: fn(), onOpen: fn(), onNewNote: fn(), onLoadMore: fn(), onTabChange: fn(), onError: fn() },
  parameters: {
    layout: "fullscreen",
    docs: { story: { height: "900px" }, description: { component: "生产 NoteCollection 的列表、卡片、主页标签页与真实 NotePreview 阅读闭环。示例仅承担调用方的本地查询、标签、分页和返回状态；不连接笔记库，也不复制编辑器。iOS 使用同一份 Web 内容，H5 视口故事不替代 iPhone WKWebView 验收。Docs 初始展示各状态，Canvas 的 play 验证交互。" } },
  },
} satisfies Meta<typeof NoteCollectionExample>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BrowseAndOpen: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "cards");
    await expect(canvas.getAllByRole("listitem").filter(item => item.hasAttribute("data-note-id"))).toHaveLength(5);
    await expect(canvas.getByText("+1")).toBeVisible();
    const cards = canvas.getByRole("tab", { name: "卡片布局" });
    await userEvent.click(cards);
    await userEvent.keyboard("{ArrowRight}");
    const list = canvas.getByRole("tab", { name: "列表布局" });
    await expect(list).toHaveFocus();
    await expect(list).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("tabpanel", { name: "列表布局" })).toHaveAttribute("id", list.getAttribute("aria-controls"));
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "list");
    await userEvent.click(canvas.getAllByRole("button", { name: "筛选标签 产品" })[0]);
    await expect(args.onSelectTag).toHaveBeenCalledWith("产品");
    await expect(args.onOpen).not.toHaveBeenCalled();
    await expect(canvas.getByRole("status")).toHaveTextContent("当前标签：产品");
    await expect(canvas.queryByRole("button", { name: "打开 周末散步" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "打开 项目计划" }));
    await expect(args.onOpen).toHaveBeenCalledOnce();
    await expect(args.onOpen).toHaveBeenCalledWith("collection-plan");
    const detail = within(canvas.getByRole("region", { name: "笔记详情" }));
    await expect(detail.getByRole("heading", { name: "项目计划" })).toBeVisible();
    await expect(detail.getByRole("heading", { name: "本周安排" })).toBeVisible();
    await userEvent.click(detail.getByRole("button", { name: "返回笔记集合" }));
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "list");
    await expect(canvas.getByRole("status")).toHaveTextContent("当前标签：产品");
    await userEvent.click(canvas.getByRole("button", { name: "清除标签筛选" }));
    const search = canvas.getByRole("textbox", { name: "搜索当前视图笔记" });
    await userEvent.type(search, "散步");
    await expect(args.onQueryChange).toHaveBeenLastCalledWith("散步");
    await expect(canvas.getByRole("button", { name: "打开 周末散步" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "打开 项目计划" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "打开 周末散步" }));
    await expect(canvas.getByText("沿着河边慢慢走，记下傍晚的颜色和今天的小发现。")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await expect(canvas.getByRole("textbox", { name: "搜索当前视图笔记" })).toHaveValue("散步");
    await expect(canvas.queryByRole("button", { name: "打开 项目计划" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "清空当前搜索" }));
    await expect(canvas.getByRole("textbox", { name: "搜索当前视图笔记" })).toHaveValue("");
    await userEvent.click(canvas.getByRole("tab", { name: "卡片布局" }));
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "cards");
    await userEvent.click(canvas.getByRole("button", { name: "打开 新内容" }));
    await expect(args.onOpen).toHaveBeenLastCalledWith("collection-untitled");
    await expect(canvas.getByText("还没来得及命名的一条记录，也可以从列表中打开。")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await userEvent.click(canvas.getByRole("button", { name: "新建" }));
    await expect(args.onNewNote).toHaveBeenCalledOnce();
    await expect(canvas.getByLabelText("新建笔记请求")).toHaveTextContent("已请求打开现有的新建笔记流程");
    await expect(args.onError).not.toHaveBeenCalled();
  },
};

export const HomeRecentAndPinned: Story = {
  args: { home: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "list");
    await userEvent.click(canvas.getByRole("button", { name: "卡片布局" }));
    await userEvent.click(canvas.getByRole("tab", { name: /已固定/ }));
    await expect(args.onTabChange).toHaveBeenCalledWith("pinned");
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "cards");
    await expect(canvas.getByRole("button", { name: "打开 周末散步" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "打开 阅读摘录" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "打开 项目计划" }));
    await expect(args.onOpen).toHaveBeenCalledWith("collection-plan");
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await expect(canvas.getByRole("tab", { name: /已固定/ })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("button", { name: "卡片布局" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("tab", { name: "最近更新" }));
    await expect(args.onTabChange).toHaveBeenLastCalledWith("recent");
    await expect(canvas.getByRole("button", { name: "打开 阅读摘录" })).toBeVisible();
  },
};

export const Loading: Story = {
  args: { state: "loading" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status", { name: "正在读取笔记库" })).toBeInTheDocument();
    await expect(canvas.queryByRole("list", { name: "笔记列表" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "列表布局" }));
    await expect(canvas.getByRole("tab", { name: "列表布局" })).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("status", { name: "正在读取笔记库" })).toBeInTheDocument();
  },
};

export const EmptyAndSearch: Story = {
  args: { state: "empty" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("笔记库中还没有笔记")).toBeVisible();
    const search = canvas.getByRole("textbox", { name: "搜索当前视图笔记" });
    await userEvent.type(search, "不存在");
    await expect(canvas.getByText("没有找到相关笔记")).toBeVisible();
    await expect(args.onQueryChange).toHaveBeenLastCalledWith("不存在");
    await userEvent.click(canvas.getByRole("button", { name: "清空当前搜索" }));
    await expect(search).toHaveValue("");
    await expect(canvas.getByText("笔记库中还没有笔记")).toBeVisible();
    await expect(args.onOpen).not.toHaveBeenCalled();
  },
};

export const Unavailable: Story = {
  args: { state: "unavailable" },
  parameters: { docs: { description: { story: "保留已读入的笔记；搜索、打开和新建由生产组件的能力参数禁用，布局与标签仍沿用已有行为。" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "搜索当前视图笔记" })).toBeDisabled();
    const open = canvas.getByRole("button", { name: "打开 项目计划" });
    await expect(open).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "新建" })).toBeDisabled();
    await expect(args.onOpen).not.toHaveBeenCalled();
    await expect(args.onNewNote).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("tab", { name: "列表布局" }));
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "list");
  },
};

export const Pagination: Story = {
  args: { state: "pagination" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const collection = () => canvas.getByRole("list", { name: "笔记列表" });
    await expect(collection().children).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "加载更多" }));
    await expect(collection().children).toHaveLength(4);
    await expect(args.onLoadMore).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: "加载更多" }));
    await expect(collection().children).toHaveLength(5);
    await expect(args.onLoadMore).toHaveBeenCalledTimes(2);
    await expect(canvas.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
  },
};

export const Paging: Story = {
  args: { state: "paging" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const paging = canvas.getByRole("button", { name: "加载更多" });
    await expect(paging).toBeDisabled();
    await expect(canvas.getByRole("list", { name: "笔记列表" }).children).toHaveLength(2);
    await expect(args.onLoadMore).not.toHaveBeenCalled();
  },
};

export const MobileBrowseAndOpen: Story = {
  tags: ["mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  parameters: { docs: { story: { height: "844px" }, description: { story: "沿用移动端隐藏集合工具栏的现有样式；布局由 App 外层菜单管理，此处验证默认卡片的标签、打开和返回。" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "cards");
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    await expect(canvas.queryByRole("tab", { name: "列表布局" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("textbox", { name: "搜索当前视图笔记" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getAllByRole("button", { name: "筛选标签 产品" })[0]);
    await expect(args.onSelectTag).toHaveBeenCalledWith("产品");
    await userEvent.click(canvas.getByRole("button", { name: "打开 项目计划" }));
    await expect(args.onOpen).toHaveBeenCalledOnce();
    await expect(args.onOpen).toHaveBeenCalledWith("collection-plan");
    await expect(canvas.getByRole("heading", { name: "本周安排" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("当前标签：产品");
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "cards");
    await userEvent.click(canvas.getByRole("button", { name: "清除标签筛选" }));
    await expect(canvas.getByRole("button", { name: "打开 周末散步" })).toBeVisible();
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(390);
    await expect(args.onError).not.toHaveBeenCalled();
  },
};

export const MobileSavedList: Story = {
  tags: ["mobile"],
  globals: { viewport: { value: "mobile", isRotated: false } },
  beforeEach: () => { localStorage.setItem("memocard:note-layout", "list"); },
  parameters: { docs: { story: { height: "844px" }, description: { story: "读取外层菜单已保存的列表布局；不在组件故事中伪造移动端布局入口。" } } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "list");
    await expect(canvas.queryByRole("tab", { name: "列表布局" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "打开 新内容" }));
    await expect(args.onOpen).toHaveBeenCalledWith("collection-untitled");
    await expect(canvas.getByText("还没来得及命名的一条记录，也可以从列表中打开。")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "返回笔记集合" }));
    await expect(canvas.getByRole("list", { name: "笔记列表" })).toHaveAttribute("data-layout", "list");
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  },
};
