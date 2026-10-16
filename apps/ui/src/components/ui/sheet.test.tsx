// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";
import { swipeSheet as swipe } from "./sheet-swipe.test-utils";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", () => ({matches:false,addEventListener() {},removeEventListener() {}}));
});

function mobilePointers() {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("matchMedia", () => ({matches:true,addEventListener() {},removeEventListener() {}}));
}

it("dismisses mobile bottom sheets from the handle or header and rebounds short or cancelled drags", async () => {
  mobilePointers();
  const user = userEvent.setup();
  render(<Sheet><SheetTrigger>打开菜单</SheetTrigger><SheetContent side="bottom" swipeToClose><SheetHeader><SheetTitle>菜单</SheetTitle></SheetHeader><p>可滚动内容</p></SheetContent></Sheet>);
  await user.click(screen.getByRole("button", {name:"打开菜单"}));
  let popup = screen.getByRole("dialog");
  await waitFor(() => expect(popup.hasAttribute("data-swipe-ready")).toBe(true));
  swipe(popup.querySelector('[data-slot="sheet-handle"]')!, 20);
  expect(screen.getByRole("dialog")).toBe(popup);
  expect(popup.style.getPropertyValue("--sheet-swipe-y")).toBe("0px");
  swipe(screen.getByText("可滚动内容"), 160);
  expect(popup.style.getPropertyValue("--sheet-swipe-y")).toBe("0px");
  swipe(screen.getByRole("heading", {name:"菜单"}), 160, true);
  expect(screen.getByRole("dialog")).toBe(popup);
  swipe(popup.querySelector('[data-slot="sheet-handle"]')!, 160);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button", {name:"打开菜单"}));
  popup = screen.getByRole("dialog");
  await waitFor(() => expect(popup.hasAttribute("data-swipe-ready")).toBe(true));
  swipe(screen.getByRole("heading", {name:"菜单"}), 160);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("blocks mobile swipe dismissal while disabled and leaves desktop bottom sheets unchanged", async () => {
  mobilePointers();
  const user = userEvent.setup();
  const view = render(<Sheet><SheetTrigger>打开菜单</SheetTrigger><SheetContent side="bottom" swipeToClose swipeDisabled><SheetHeader><SheetTitle>菜单</SheetTitle></SheetHeader></SheetContent></Sheet>);
  await user.click(screen.getByRole("button", {name:"打开菜单"}));
  const popup = screen.getByRole("dialog");
  await waitFor(() => expect(popup.hasAttribute("data-swipe-ready")).toBe(true));
  swipe(screen.getByRole("heading", {name:"菜单"}), 160);
  expect(screen.getByRole("dialog")).toBe(popup);
  expect(popup.hasAttribute("data-sheet-dragging")).toBe(false);
  view.unmount();
  vi.stubGlobal("innerWidth", 1024);
  vi.stubGlobal("matchMedia", () => ({matches:false,addEventListener() {},removeEventListener() {}}));
  render(<Sheet defaultOpen><SheetContent side="bottom" swipeToClose><SheetTitle>桌面菜单</SheetTitle></SheetContent></Sheet>);
  expect(screen.getByRole("dialog").querySelector('[data-slot="sheet-handle"]')).toBeNull();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("closes a sheet by Escape and its close button, preserving state styles and trigger focus", async () => {
  const user = userEvent.setup();
  render(<Sheet><SheetTrigger>打开侧栏</SheetTrigger><SheetContent style={state => ({ color: state.open ? "red" : "blue" })}><SheetTitle>侧栏</SheetTitle></SheetContent></Sheet>);
  const trigger = screen.getByRole("button", { name: "打开侧栏" });
  await user.click(trigger);
  expect((screen.getByRole("dialog") as HTMLElement).style.color).toBe("red");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "关闭" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
