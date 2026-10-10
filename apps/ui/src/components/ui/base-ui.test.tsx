// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Switch } from "./switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("composes render elements without losing refs, children or click handlers", async () => {
  const ref = createRef<HTMLButtonElement>(), outer = vi.fn(), inner = vi.fn();
  render(<Button ref={ref} onClick={outer} render={<button onClick={inner}>操作</button>} />);
  const button = screen.getByRole("button", { name: "操作" });
  expect(ref.current).toBe(button);
  await userEvent.click(button);
  expect(outer).toHaveBeenCalledOnce();
  expect(inner).toHaveBeenCalledOnce();
});

it("opens a dialog, focuses its input and restores trigger focus on Escape", async () => {
  const user = userEvent.setup();
  render(<Dialog><DialogTrigger render={<Button>搜索</Button>} /><DialogContent><DialogTitle>查找</DialogTitle><input aria-label="查询" /></DialogContent></Dialog>);
  const trigger = screen.getByRole("button", { name: "搜索" });
  await user.click(trigger);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "查询" })));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("selects with the keyboard and restores the select trigger", async () => {
  const user = userEvent.setup(), change = vi.fn();
  render(<Select defaultValue="light" items={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }]} onValueChange={change}><SelectTrigger aria-label="模式"><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="light">浅色</SelectItem><SelectItem value="dark">深色</SelectItem></SelectContent></Select>);
  const trigger = screen.getByRole("combobox", { name: "模式" });
  await user.click(trigger);
  expect(await screen.findByRole("option", { name: "浅色" })).toBeTruthy();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(change.mock.calls.at(-1)?.[0]).toBe("dark");
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(document.activeElement).toBe(trigger);
  expect(trigger.textContent).toContain("深色");
});

it("toggles switches by keyboard while leaving disabled switches unchanged", async () => {
  const user = userEvent.setup(), change = vi.fn();
  render(<><Switch aria-label="启用" onCheckedChange={change} /><Switch aria-label="禁用" disabled onCheckedChange={change} /></>);
  await user.tab();
  await user.keyboard(" ");
  expect(screen.getByRole("switch", { name: "启用" }).getAttribute("aria-checked")).toBe("true");
  expect(change).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("switch", { name: "禁用" }));
  expect(change).toHaveBeenCalledOnce();
});

it("styles disabled switches using their Base UI state attribute", () => {
  render(<Switch aria-label="禁用" disabled />);
  const control = screen.getByRole("switch", { name: "禁用" });
  expect(control.hasAttribute("data-disabled")).toBe(true);
  expect(control.matches(":disabled")).toBe(false);
  expect(control.classList.contains("data-[disabled]:opacity-50")).toBe(true);
  expect(control.classList.contains("data-[disabled]:cursor-not-allowed")).toBe(true);
});

it("moves between tabs by keyboard and exposes the active panel", async () => {
  const user = userEvent.setup();
  render(<Tabs defaultValue="one"><TabsList><TabsTrigger value="one">一</TabsTrigger><TabsTrigger value="two">二</TabsTrigger></TabsList><TabsContent value="one">第一页</TabsContent><TabsContent value="two">第二页</TabsContent></Tabs>);
  await user.tab();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "二" }).hasAttribute("data-active")).toBe(true);
  expect(screen.getByRole("tabpanel").textContent).toBe("第二页");
});

it("uses the panel-open state for collapsible triggers", async () => {
  render(<Collapsible><CollapsibleTrigger>高级</CollapsibleTrigger><CollapsibleContent>选项</CollapsibleContent></Collapsible>);
  const trigger = screen.getByRole("button", { name: "高级" });
  await userEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.hasAttribute("data-panel-open")).toBe(true);
  expect(screen.getByText("选项")).toBeTruthy();
});
