import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { setStorybookRequestHandler } from "../.storybook/bridge";
import { ComponentDocsPage } from "../.storybook/component-docs";
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

const usage = `import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NoteSearchDialog } from "@/components/note-search-dialog";

export function NoteSearch({ available, vaultName, onOpenNote }: {
  available: boolean;
  vaultName: string;
  onOpenNote: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  return <>
    <Button ref={trigger} onClick={() => setOpen(true)}>搜索笔记</Button>
    <NoteSearchDialog
      open={open}
      onOpenChange={setOpen}
      vaultName={vaultName}
      available={available}
      returnFocus={trigger}
      onOpenNote={id => { onOpenNote(id); setOpen(false); }}
    />
  </>;
}`;

const meta = {
  title: "business/note search",
  component: NoteSearchExample,
  globals: desktopGlobals,
  args: { available: true, initialOpen: true, preserveSession: false, onOpenNote: fn(), onOpenChange: fn() },
  argTypes: {
    available: { control: "boolean", description: "传给生产组件的可查询状态；false 时禁用输入并显示连接提示。", table: { type: { summary: "boolean" } } },
    initialOpen: { control: false, description: "仅为 NoteSearchExample 的初始开合值，不是 NoteSearchDialog prop；在故事挂载时读取。", table: { type: { summary: "boolean" } } },
    preserveSession: { control: "boolean", description: "传给生产组件；保留挂载时关闭后保留查询、结果、选中项和结果滚动位置。", table: { type: { summary: "boolean" } } },
    onOpenNote: { control: false, description: "示例记录生产组件返回的笔记 ID，并关闭搜索；真实 App 需执行导航。", table: { type: { summary: "(id: string) => void" } } },
    onOpenChange: { control: false, description: "观察示例受控开合的事件；生产组件的 open 由调用方维护。", table: { type: { summary: "(open: boolean) => void" } } },
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      story: { height: "900px" },
      description: { component: "搜索当前笔记库的标题与正文，查看最近笔记、按关键词筛选并打开结果。桌面弹窗可同时预览正文；H5 使用底部搜索面板。" },
      page: () => <ComponentDocsPage
        usage={usage}
        anatomy={"`NoteSearchDialog` 管理搜索输入、按日期分组的结果、加载与错误反馈、分页及正文预览。调用方提供打开入口，维护 `open`，处理 `onOpenNote` 的导航和关闭；组件不直接切换 App 路由。"}
        guidelines={`- 用于全库搜索；当前列表的局部筛选继续使用列表搜索框。
- 用法从按钮打开搜索；Docs 默认先展示已打开的初始面板，便于查看布局。
- 默认先显示最近更新的笔记；输入关键词后搜索标题与正文。清空关键词回到最近笔记。
- 区分空笔记库、无匹配、尚未连接、加载和读取失败；读取失败提供重试，分页失败保留已显示结果。部分文件未读入时显示覆盖提示。
- 需要从笔记返回搜索时，保持组件挂载并传入 \`preserveSession\`；默认关闭会话后重新查询。它不负责跨刷新或跨设备保存搜索。
- 下方示例仅使用内存笔记；生产接入必须已有 MemoCard 数据 bridge 与当前笔记库连接。复制用法不会安装数据服务或创建真实笔记库。
- Docs 展示初始状态且允许手动操作；输入“计划”查看示例高亮。完整搜索、重试、分页及关闭返回过程在 Canvas 的 play 中验证。`}
        accessibility={`- 可用时打开搜索会聚焦输入；上下方向键选择结果，Enter 打开，Escape 关闭。输入法组合期间不会用 Enter 打开结果。
- 输入使用 combobox 与 listbox / option 关联，选中项通过 \`aria-activedescendant\` 表达；加载、结果数量和错误有状态提示。
- 默认关闭会把焦点返回仍挂载的 \`returnFocus\` 元素；\`preserveSession=true\` 时组件不主动恢复关闭焦点，由调用方管理查看笔记与返回路径。H5 还提供“退出搜索”入口。`}
        platform={`- 桌面 Web 使用 Dialog；窗口足够宽高时显示正文预览。H5 使用 Sheet，并保留可视视口与键盘适配。
- iOS App 通过现有 search surface 桥接复用查询与状态，由原生搜索输入、键盘和 overlay 渲染；此页 H5 不能替代原生验收。
- Xcode：选择 \`MemoCardiOS\` 与 iPhone Simulator，打开 \`apps/apple/Sources/NativeChrome.swift\` 的 \`Search · Recent\` 或 \`Search · Results · Dark Large\` Preview。
- 预览和内存 fixture 不覆盖真实笔记库、系统输入法、旧 OS 或真机；相关边界见 [搜索与快速记录规范](https://github.com/divikwu/memocard/blob/main/design/components/search-capture.md)。`}
        api={`以下为生产 \`NoteSearchDialog\` 的全部 props；下表之外的 \`initialOpen\` 仅属于本页示例。

| Prop | 类型 | 必填 / 默认 | 契约 |
| --- | --- | --- | --- |
| \`open\` | \`boolean\` | 必填 | 调用方控制搜索是否打开。 |
| \`onOpenChange\` | \`(open: boolean) => void\` | 必填 | 接收关闭等开合请求，调用方更新 \`open\`。 |
| \`vaultName\` | \`string\` | 必填 | 用于搜索输入的笔记库名称提示；不建立数据连接。 |
| \`available\` | \`boolean\` | 必填 | 当前是否可查询；false 时禁用输入且不发起查询。 |
| \`returnFocus\` | \`RefObject<HTMLElement \\| null>\` | 必填 | 默认关闭后的焦点目标；会话保留模式由调用方管理焦点。 |
| \`onOpenNote\` | \`(id: string) => void\` | 必填 | 返回笔记 ID；调用方执行导航，并按需要关闭搜索。 |
| \`preserveSession\` | \`boolean\` | 可选，false | 保持挂载时保留查询、结果、选中与结果滚动位置。 |

查询、加载、错误、重试和分页由生产组件及现有 bridge 管理；不是额外的可控 props。`}
        exampleArgs={["available", "initialOpen", "preserveSession", "onOpenNote", "onOpenChange"]}
      />,
    },
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
