// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ThemeScope } from "./theme-scope";
import { TooltipHints } from "./tooltip";
import { Button } from "./button";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Fixture({ mode = "light", local = false }: { mode?: "light" | "dark"; local?: boolean }) {
  return <ThemeScope value={{ mode, themeId: "paper", palette: "blue", neutral: "slate" }}>
    <TooltipHints><Dialog open><DialogContent data-ui-theme={local ? "dark" : undefined}><DialogTitle>作用域对话框</DialogTitle>
      <Popover><PopoverTrigger render={<Button data-ui-tooltip="局部提示" />}>嵌套浮层</PopoverTrigger><PopoverContent aria-label="嵌套内容"><DropdownMenu><DropdownMenuTrigger render={<Button />}>嵌套菜单</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>菜单动作</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PopoverContent></Popover>
    </DialogContent></Dialog></TooltipHints>
  </ThemeScope>;
}

it("updates stable portal roots without rebuilding dialogs or nested popovers", async () => {
  const user = userEvent.setup(); const view = render(<Fixture />);
  const dialog = await screen.findByRole("dialog", { name: "作用域对话框" });
  expect(dialog.getAttribute("data-ui-theme")).toBe("light");
  const portal = dialog.closest('[data-slot="dialog-portal"]')!;
  expect(portal.getAttribute("data-interface-theme")).toBe("paper");
  expect(portal.getAttribute("data-web-palette")).toBe("blue");
  await user.click(screen.getByRole("button", { name: "嵌套浮层" }));
  const popover = await screen.findByRole("dialog", { name: "嵌套内容" });
  const scope = popover.closest("[data-appearance-scope]")!;
  view.rerender(<Fixture mode="dark" />);
  expect(screen.getByRole("dialog", { name: "作用域对话框" })).toBe(dialog);
  expect(screen.getByRole("dialog", { name: "嵌套内容" })).toBe(popover);
  expect(dialog.closest('[data-slot="dialog-portal"]')).toBe(portal);
  expect(popover.closest("[data-appearance-scope]")).toBe(scope);
  expect(scope.getAttribute("data-ui-theme")).toBe("dark");
  expect(dialog.getAttribute("data-ui-theme")).toBe("dark");
});

it("retains a local dialog override for its backdrop and nested menu", async () => {
  const user = userEvent.setup(); render(<Fixture local />);
  const dialog = await screen.findByRole("dialog", { name: "作用域对话框" });
  expect(dialog.getAttribute("data-ui-theme")).toBe("dark");
  const overlay = document.querySelector('[data-slot="dialog-overlay"]')!;
  expect(overlay.getAttribute("data-ui-theme")).toBe("dark");
  await user.click(screen.getByRole("button", { name: "嵌套浮层" }));
  await user.click(await screen.findByRole("button", { name: "嵌套菜单" }));
  const menu = await screen.findByRole("menu");
  expect(menu.closest("[data-appearance-scope]")?.getAttribute("data-ui-theme")).toBe("dark");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "嵌套菜单" }));
});


it("scopes delegated tooltip hints to their local dialog anchor", async () => {
  const user = userEvent.setup(); render(<Fixture local />);
  await user.hover(await screen.findByRole("button", { name: "嵌套浮层" }));
  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip.closest("[data-appearance-scope]")?.getAttribute("data-ui-theme")).toBe("dark");
});


it.each([false, true])("retains popup class and style callbacks alongside scope inputs (sheet: %s)", async sheet => {
  const Root = sheet ? Sheet : Dialog;
  const Content = sheet ? SheetContent : DialogContent;
  const Title = sheet ? SheetTitle : DialogTitle;
  render(<ThemeScope value={{ mode: "light", style: { "--ui-preview-body": "monospace" } as React.CSSProperties }}>
    <Root open><Content className={state => state.open ? "callback-open" : "callback-closed"} style={state => ({ padding: state.open ? 13 : 0 })}><Title>回调浮层</Title></Content></Root>
  </ThemeScope>);
  const popup = await screen.findByRole("dialog", { name: "回调浮层" });
  expect(popup.classList.contains("fixed")).toBe(true);
  expect(popup.classList.contains("callback-open")).toBe(true);
  expect(popup.style.padding).toBe("13px");
  expect(popup.style.getPropertyValue("--ui-preview-body")).toBe("monospace");
});
