// Preserve the production cascade order before loading component styles.
import "../.storybook/preview.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { cleanup, render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../src/features/theme/ThemeProvider";
import { SidebarExample } from "./sidebar.example";
import { sidebarArgs } from "./sidebar.fixtures";
import { Input } from "../src/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../src/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { FoundationReference } from "./foundation-reference";
import { Button } from "../src/components/ui/button";
import { Textarea } from "../src/components/ui/textarea";
import { Select, SelectTrigger, SelectValue } from "../src/components/ui/select";
import { Separator } from "../src/components/ui/separator";

let rootStyle: string;
beforeEach(() => { rootStyle = document.documentElement.style.cssText; localStorage.clear(); });
afterEach(() => { cleanup(); document.documentElement.style.cssText = rootStyle; });

function expectLineFits(element: HTMLElement) {
  const style = getComputedStyle(element);
  const inset = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  expect(element.getBoundingClientRect().height - inset, element.outerHTML).toBeGreaterThanOrEqual(parseFloat(style.lineHeight) - 1.1);
}

for (const width of [320, 390, 1368]) test(`${width}px: sidebar keeps baseline density and grows with enlarged text`, async () => {
  await page.viewport(width, 960);
  render(<ThemeProvider><SidebarExample {...sidebarArgs({ vaultId: `density-${width}` })} /></ThemeProvider>);
  const notes = page.getByRole("button", { name: "所有笔记", exact: true });
  await expect.element(notes).toBeVisible();
  const row = notes.element() as HTMLElement;
  expect(row.getBoundingClientRect().height).toBe(width < 768 ? 48 : 32);
  document.documentElement.style.fontSize = "32px";
  await waitFor(() => {
    expect(parseFloat(getComputedStyle(row).fontSize)).toBe(width < 768 ? 32 : 28);
    expectLineFits(row);
  });
  const toggle = page.getByRole("button", { name: "展开或收起快捷筛选", exact: true });
  if (width < 768) {
    const panel = document.querySelector<HTMLElement>('[data-mobile="true"]')!;
    expect(panel.getBoundingClientRect().right).toBeLessThanOrEqual(width + 1);
    const target = toggle.element() as HTMLElement;
    const after = getComputedStyle(target, "::after");
    expect(target.getBoundingClientRect().width - parseFloat(after.left) - parseFloat(after.right)).toBeGreaterThanOrEqual(44);
    expect(target.getBoundingClientRect().height - parseFloat(after.top) - parseFloat(after.bottom)).toBeGreaterThanOrEqual(44);
  }
  await toggle.click();
  await expect.element(page.getByRole("button", { name: "有图片", exact: true })).toBeVisible();
  expectLineFits(page.getByRole("button", { name: "有图片", exact: true }).element() as HTMLElement);
});

for (const width of [320, 390, 1368]) test(`${width}px: form controls contain their line boxes at 100–200% text size`, async () => {
  await page.viewport(width, 960);
  const view = render(<ThemeProvider><div className="space-y-4 p-4">
    <Input aria-label="笔记标题" defaultValue="中文 Aa 0123" />
    <InputGroup><InputGroupAddon>标题</InputGroupAddon><InputGroupInput aria-label="分组标题" defaultValue="Note" /></InputGroup>
    <Tabs defaultValue="notes"><TabsList><TabsTrigger value="notes">笔记</TabsTrigger><TabsTrigger value="pinned">固定</TabsTrigger></TabsList></Tabs>
  </div></ThemeProvider>);
  for (const root of [16, 20, 32]) {
    document.documentElement.style.fontSize = `${root}px`;
    await waitFor(() => {
      for (const element of view.container.querySelectorAll<HTMLElement>('input, [data-slot="input-group-addon"], [role="tab"]')) expectLineFits(element);
      const group = view.container.querySelector<HTMLElement>('[data-slot="input-group"]')!;
      for (const child of group.children) expect(child.getBoundingClientRect().height).toBeLessThanOrEqual(group.getBoundingClientRect().height - 2 + 1);
    });
  }
  await page.getByRole("tab", { name: "固定", exact: true }).click();
  await expect.element(page.getByRole("tab", { name: "固定", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByText("标题", { exact: true }).click();
  await expect.element(page.getByRole("textbox", { name: "分组标题", exact: true })).toHaveFocus();
});

test("block input groups retain their original density", () => {
  const view = render(<ThemeProvider><InputGroup><InputGroupAddon align="block-start">标题</InputGroupAddon><InputGroupInput aria-label="块布局标题" defaultValue="Note" /></InputGroup></ThemeProvider>);
  expect(view.container.querySelector("input")!.getBoundingClientRect().height).toBe(36);
  expect(parseFloat(getComputedStyle(view.container.querySelector('[data-slot="input-group-addon"]')!).paddingTop)).toBe(8);
});

test("semantic density overrides reach real controls while caller overrides retain precedence", () => {
  const root = document.documentElement;
  root.style.setProperty("--size-element-xs", "30px");
  root.style.setProperty("--size-element-sm", "42px");
  root.style.setProperty("--size-element-md", "50px");
  root.style.setProperty("--size-element-lg", "58px");
  root.style.setProperty("--size-textarea-min", "90px");
  root.style.setProperty("--border-width", "3px");
  const view = render(<>
    <Button size="xs" data-testid="xs">XS</Button><Button size="sm" data-testid="sm">Small</Button>
    <Button data-testid="md">Default</Button><Button size="lg" data-testid="lg">Large</Button>
    <Button size="icon" data-testid="icon" aria-label="Icon">+</Button>
    <Button className="h-12" data-testid="height-override">Override</Button>
    <Button size="icon" className="size-6" data-testid="size-override" aria-label="Small icon">+</Button>
    <Button variant="outline" className="border-0" data-testid="border-override">No border</Button>
    <Input aria-label="Input" data-testid="input" />
    <InputGroup data-testid="group"><InputGroupInput aria-label="Group input" /></InputGroup>
    <Textarea aria-label="Textarea" data-testid="textarea" />
    <Select defaultValue="one" items={[{ value: "one", label: "One" }]}><SelectTrigger data-testid="select"><SelectValue /></SelectTrigger></Select>
    <Tabs defaultValue="one"><TabsList data-testid="tabs"><TabsTrigger value="one">One</TabsTrigger></TabsList></Tabs>
    <Separator data-testid="separator" />
  </>);
  for (const [id, height] of [["xs", 30], ["sm", 42], ["md", 50], ["lg", 58], ["icon", 50], ["input", 50], ["group", 42], ["select", 50], ["tabs", 50], ["height-override", 48], ["size-override", 24]] as const) {
    expect(view.getByTestId(id).getBoundingClientRect().height, id).toBe(height);
  }
  expect(view.getByTestId("icon").getBoundingClientRect().width).toBe(50);
  expect(view.getByTestId("size-override").getBoundingClientRect().width).toBe(24);
  for (const id of ["input", "group", "select"]) expect(getComputedStyle(view.getByTestId(id)).borderTopWidth, id).toBe("3px");
  expect(getComputedStyle(view.getByTestId("border-override")).borderTopWidth).toBe("0px");
  expect(getComputedStyle(view.getByTestId("textarea")).minHeight).toBe("90px");
  expect(view.getByTestId("separator").getBoundingClientRect().height).toBe(3);
});

test("sizing Docs measure production components and follow root scaling", async () => {
  await page.viewport(1368, 960);
  const view = render(<ThemeProvider><FoundationReference category="sizing" /></ThemeProvider>);
  const expected: Record<string, number> = { "Button / xs": 24, "Button / sm": 32, "Button / default": 36, "Button / lg": 40, "Button / icon-xs": 24, "Button / icon-sm": 32, "Button / icon": 36, "Button / icon-lg": 40, Input: 36, InputGroup: 32, "Select / default": 36, "Select / sm": 32, "Tabs / default": 36, "Tabs / line": 32, Textarea: 64 };
  const rows = [...view.container.querySelectorAll<HTMLElement>('[data-density-name]')];
  expect(rows.map(row => row.dataset.densityName)).toEqual(Object.keys(expected));
  for (const root of [16, 20, 32]) {
    document.documentElement.style.fontSize = `${root}px`;
    await waitFor(() => {
      for (const row of rows) {
        const metric = row.querySelector('[data-density-metric]')!.textContent!;
        const height = expected[row.dataset.densityName!] * root / 16;
        expect(metric).toContain(`${height}px`);
      }
    });
  }
  await page.getByRole("combobox", { name: "default 尺寸预览范围", exact: true }).click();
  await page.getByRole("option", { name: "最近", exact: true }).click();
  await expect.element(page.getByRole("combobox", { name: "default 尺寸预览范围", exact: true })).toHaveTextContent("最近");
});
