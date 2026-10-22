// Match main.tsx: establish the base layer order before importing component styles.
import "../.storybook/preview.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src/features/theme/ThemeProvider";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE } from "../src/features/theme/preferences";
import { TypographySettings } from "../src/features/typography/TypographySettings";
import { STORAGE_KEY } from "../src/features/typography/preferences";
import { Button } from "../src/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../src/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../src/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../src/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../src/components/ui/input-group";
import { Markdown } from "../src/markdown";
import "../src/rich-editor.css";
import "../src/rich-format-tools.css";
import "../src/import-layout.css";

let rootStyle: string, rootClass: string;
let spacingStyle: HTMLStyleElement | undefined;
beforeEach(() => {
  rootStyle = document.documentElement.style.cssText;
  rootClass = document.documentElement.className;
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  spacingStyle?.remove(); spacingStyle = undefined;
  document.documentElement.style.cssText = rootStyle;
  document.documentElement.className = rootClass;
});

function Controls() {
  return <>
    <div className="flex flex-wrap gap-2"><Button>保存</Button><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}>菜单</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>复制</DropdownMenuItem><DropdownMenuItem>导出</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
    <Tabs defaultValue="notes"><TabsList aria-label="分类"><TabsTrigger value="notes">笔记</TabsTrigger><TabsTrigger value="pinned">固定</TabsTrigger></TabsList><TabsContent value="notes">笔记内容</TabsContent><TabsContent value="pinned">固定内容</TabsContent></Tabs>
    <Select defaultValue="all"><SelectTrigger aria-label="范围"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">全部</SelectItem><SelectItem value="recent">最近</SelectItem></SelectContent></Select>
    <InputGroup><InputGroupAddon>标题</InputGroupAddon><InputGroupInput aria-label="标题" defaultValue="中英文 Note" /></InputGroup>
    <Button className="text-xs font-normal">局部覆盖</Button>
  </>;
}
const body = '# 标题 `code`\n\n第一段中文与 English typography，支持长文字自然换行。\n\n第二段保留 **`强调代码`**、普通 `code` 和 **重点文字**。\n\n```js\nconst note = "MemoCard";\n```';
function mount(theme = "light") {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...DEFAULT_APPEARANCE, theme }));
  return render(<ThemeProvider><main className="min-w-0 space-y-4 p-4"><Controls /><div className="note-page-width"><Markdown body={body} /></div></main></ThemeProvider>);
}
const metrics = (element: Element) => {
  const style = getComputedStyle(element);
  return [parseFloat(style.fontSize), Number(style.fontWeight), parseFloat(style.lineHeight)];
};

// Use production components, including their portaled popups, rather than equivalent class strings.
test("shared label roles reach controls and menus while explicit regular/small variants survive", async () => {
  await page.viewport(1368, 960);
  const view = mount();
  const save = within(view.container).getByRole("button", { name: "保存" });
  expect(metrics(save)[0]).toBe(14);
  expect(metrics(save)[1]).toBe(500);
  document.documentElement.style.setProperty("--text-label-size", "1.125rem");
  document.documentElement.style.setProperty("--text-label-weight", "600");
  document.documentElement.style.setProperty("--text-label-leading", "1.75");
  await waitFor(() => {
    for (const element of [save, ...view.container.querySelectorAll('[data-slot="tabs-trigger"], [data-slot="input-group-addon"]')]) expect(metrics(element)).toEqual([18, 600, 31.5]);
    for (const element of view.container.querySelectorAll('[data-slot="select-trigger"], input[data-slot="input-group-control"]')) expect(metrics(element)).toEqual([18, 400, 31.5]);
  });
  expect(metrics(within(view.container).getByRole("button", { name: "局部覆盖" })).slice(0, 2)).toEqual([12, 400]);
  await page.getByRole("button", { name: "菜单", exact: true }).click();
  const item = page.getByRole("menuitem", { name: "复制" });
  await expect.element(item).toBeVisible();
  expect(metrics(document.querySelector('[role="menuitem"]')!)).toEqual([18, 400, 31.5]);
  await item.click();
  await page.getByRole("combobox", { name: "范围" }).click();
  await expect.element(page.getByRole("option", { name: "最近", exact: true })).toBeVisible();
  expect(metrics(document.querySelector('[role="option"]')!)).toEqual([18, 400, 31.5]);
  await page.getByRole("option", { name: "最近", exact: true }).click();
});

test("inline code preserves heading and strong emphasis while blocks remain regular", async () => {
  const view = mount();
  const markdown = view.container.querySelector(".markdown")!;
  expect(metrics(markdown.querySelector("h1 code")!)[1]).toBe(600);
  expect(metrics(markdown.querySelector("strong code")!)[1]).toBe(600);
  expect(metrics(markdown.querySelector("p > code")!)[1]).toBe(400);
  expect(metrics(markdown.querySelector("pre code")!)[1]).toBe(400);
});

test("editor menus and helper text consume shared roles and follow root text resizing", async () => {
  const labels = ["rich-inline-tools", "rich-format-menu", "rich-properties", "rich-table-tools", "rich-math-input", "rich-tag-suggestions", "rich-block-menu", "rich-footnote"];
  const view = render(<>{labels.map(name => <div key={name} className={name}>中文 Editor</div>)}<span className="rich-preserved-label">保留内容</span><div className="typeset"><div className="typeset-scroll" data-overflow="true" /></div></>);
  for (const root of [16, 20, 32]) {
    document.documentElement.style.fontSize = `${root}px`;
    await waitFor(() => {
      for (const name of labels) {
        const measured = metrics(view.container.querySelector(`.${name}`)!);
        expect(measured.slice(0, 2)).toEqual([root * .875, 400]);
        expect(measured[2]).toBeCloseTo(root * .875 * 1.4286, 2);
      }
      expect(metrics(view.container.querySelector(".rich-preserved-label")!)[0]).toBe(root * .75);
      expect(parseFloat(getComputedStyle(view.container.querySelector(".typeset-scroll")!, "::after").fontSize)).toBe(root * .75);
    });
  }
  document.documentElement.style.setProperty("--text-label-size", "1.125rem");
  document.documentElement.style.setProperty("--text-label-leading", "1.75");
  for (const name of labels) expect(metrics(view.container.querySelector(`.${name}`)!)).toEqual([36, 400, 63]);
});

test("settings label baseline pixels honestly at a changed root without migrating stored preferences", async () => {
  document.documentElement.style.fontSize = "20px";
  const view = render(<ThemeProvider><TypographySettings /></ThemeProvider>);
  expect(within(view.container).getByRole("combobox", { name: "字号" }).textContent).toContain("16px 基准");
  await waitFor(() => expect(metrics(view.container.querySelector(".markdown p")!)[0]).toBe(20));
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("720px");
  await page.getByRole("combobox", { name: "字号" }).click();
  await page.getByRole("option", { name: "18px 基准", exact: true }).click();
  await waitFor(() => expect(metrics(view.container.querySelector(".markdown p")!)[0]).toBe(22.5));
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).size).toBe("18");
  expect(document.documentElement.style.getPropertyValue("--note-measure")).toBe("810px");
});

function expectFits(container: HTMLElement) {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  const paragraphs = [...container.querySelectorAll<HTMLElement>(".markdown > p")];
  for (const paragraph of paragraphs) expect(paragraph.scrollWidth).toBeLessThanOrEqual(paragraph.clientWidth + 1);
  expect(paragraphs[1].getBoundingClientRect().top).toBeGreaterThanOrEqual(paragraphs[0].getBoundingClientRect().bottom);
  for (const element of container.querySelectorAll<HTMLElement>('button, [role="tab"]')) {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        expect(rect.left).toBeGreaterThanOrEqual(box.left - 1);
        expect(rect.right).toBeLessThanOrEqual(box.right + 1);
        expect(rect.top).toBeGreaterThanOrEqual(box.top - 1);
        expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 1);
      }
    }
  }
}

for (const width of [320, 390, 1368]) for (const theme of ["light", "dark"]) {
  test(`${width}px ${theme}: 100–200% text resizing and spacing overrides preserve content and actions`, async () => {
    await page.viewport(width, 960);
    const view = mount(theme);
    for (const root of [16, 20, 32]) {
      document.documentElement.style.fontSize = `${root}px`;
      await waitFor(() => expect(metrics(view.container.querySelector(".markdown p")!)[0]).toBe(root));
      expectFits(view.container);
      spacingStyle = document.createElement("style");
      spacingStyle.textContent = '* {line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p {margin-bottom:2em!important}';
      document.head.append(spacingStyle);
      await waitFor(() => expect(parseFloat(getComputedStyle(view.container.querySelector(".markdown p")!).lineHeight)).toBe(root * 1.5));
      expectFits(view.container);
      spacingStyle.remove(); spacingStyle = undefined;
    }
    await page.getByRole("tab", { name: "固定", exact: true }).click();
    await expect.element(page.getByRole("tabpanel", { name: "固定", exact: true })).toHaveTextContent("固定内容");
    await page.getByRole("button", { name: "菜单", exact: true }).click();
    await expect.element(page.getByRole("menuitem", { name: "导出" })).toBeVisible();
    await page.getByRole("menuitem", { name: "导出" }).click();
  });
}
