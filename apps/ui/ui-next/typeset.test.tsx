// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { afterEach, expect, it, vi } from "vitest";
import { Button } from "./components/button";
import { Typeset } from "./components/typeset";

afterEach(cleanup);

it("preserves native div refs, attributes, events and caller classes", async () => {
  const user = userEvent.setup();
  const ref = createRef<HTMLDivElement>();
  const click = vi.fn();
  render(<Typeset ref={ref} id="reading-region" role="region" aria-labelledby="reading-title" lang="zh-CN" className="max-w-prose p-6" style={{ fontSize: "18px" }} onClick={click}>
    <h2 id="reading-title">阅读说明</h2>
  </Typeset>);
  const region = screen.getByRole("region", { name: "阅读说明" });
  expect(region.tagName).toBe("DIV");
  expect(ref.current).toBe(region);
  expect(region.id).toBe("reading-region");
  expect(region.lang).toBe("zh-CN");
  expect(region.getAttribute("data-slot")).toBe("typeset");
  expect(region.classList.contains("typeset")).toBe(true);
  expect(region.classList.contains("typeset-memocard")).toBe(true);
  expect(region.classList.contains("max-w-prose")).toBe(true);
  expect(region.classList.contains("p-6")).toBe(true);
  expect(region.style.fontSize).toBe("18px");
  await user.click(screen.getByRole("heading", { name: "阅读说明" }));
  expect(click).toHaveBeenCalledTimes(1);
});

it("keeps rendered Markdown headings, nested lists, links, tables and code semantic", () => {
  const markdown = [
    "# 组件规范",
    "",
    "阅读 [组件文档](https://example.com/docs) 中的 **重要说明**，并使用 `Typeset`。",
    "",
    "- 第一项",
    "  - 嵌套项目",
    "- 第二项",
    "",
    "> 这是一段引用。",
    "",
    "| 名称 | 状态 |",
    "| --- | --- |",
    "| Button | 已完成 |",
    "",
    "```ts",
    'const label = "继续阅读";',
    "```",
  ].join("\n");
  render(<Typeset><ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown></Typeset>);
  expect(screen.getByRole("heading", { level: 1, name: "组件规范" })).toBeTruthy();
  const link = screen.getByRole("link", { name: "组件文档" });
  expect(link.getAttribute("href")).toBe("https://example.com/docs");
  expect(screen.getByText("重要说明").tagName).toBe("STRONG");
  expect(screen.getAllByRole("list")).toHaveLength(2);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByText("嵌套项目").closest("li")?.parentElement?.closest("li")).toBeTruthy();
  expect(screen.getByText("这是一段引用。").closest("blockquote")).toBeTruthy();
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["名称", "状态"]);
  expect(within(table).getByRole("cell", { name: "Button" })).toBeTruthy();
  expect(within(table).getByRole("cell", { name: "已完成" })).toBeTruthy();
  expect(screen.getByText("Typeset", { exact: true }).tagName).toBe("CODE");
  const code = screen.getByText('const label = "继续阅读";', { exact: false });
  expect(code.tagName).toBe("CODE");
  expect(code.parentElement?.tagName).toBe("PRE");
});

it("keeps opt-out content markers and embedded controls intact", async () => {
  const user = userEvent.setup();
  const save = vi.fn();
  render(<Typeset>
    <p>内容中的操作区。</p>
    <section className="not-typeset" aria-label="收藏操作"><Button onClick={save}>收藏</Button></section>
    <section data-not-typeset aria-label="编辑操作"><label htmlFor="note-title">笔记标题</label><input id="note-title" defaultValue="草稿" /></section>
  </Typeset>);
  expect(screen.getByRole("region", { name: "收藏操作" }).classList.contains("not-typeset")).toBe(true);
  expect(screen.getByRole("region", { name: "编辑操作" }).hasAttribute("data-not-typeset")).toBe(true);
  await user.click(screen.getByRole("button", { name: "收藏" }));
  expect(save).toHaveBeenCalledTimes(1);
  const input = screen.getByRole("textbox", { name: "笔记标题" }) as HTMLInputElement;
  await user.clear(input);
  await user.type(input, "新的标题");
  expect(input.value).toBe("新的标题");
});

it("preserves existing content and active input state when Markdown is appended", async () => {
  const user = userEvent.setup();
  const firstChunk = "## 阅读记录\n\n第一段已经完成。";
  const content = (markdown: string) => <Typeset>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    <div data-not-typeset><label htmlFor="reading-note">阅读备注</label><input id="reading-note" defaultValue="" /></div>
  </Typeset>;
  const view = render(content(firstChunk));
  const heading = screen.getByRole("heading", { level: 2, name: "阅读记录" });
  const input = screen.getByRole("textbox", { name: "阅读备注" }) as HTMLInputElement;
  await user.type(input, "保留我的输入");
  view.rerender(content(`${firstChunk}\n\n新追加的内容。\n\n- 新项目`));
  expect(screen.getByRole("heading", { level: 2, name: "阅读记录" })).toBe(heading);
  expect(screen.getByText("第一段已经完成。")).toBeTruthy();
  expect(screen.getByText("新追加的内容。")).toBeTruthy();
  expect(screen.getByRole("listitem").textContent).toBe("新项目");
  expect(screen.getByRole("textbox", { name: "阅读备注" })).toBe(input);
  expect(input.value).toBe("保留我的输入");
  expect(document.activeElement).toBe(input);
});
