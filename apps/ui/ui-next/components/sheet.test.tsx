// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { swipeSheet } from "../../src/components/ui/sheet-swipe.test-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

beforeEach(() => {
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("preserves mobile bottom-sheet swipe, cancellation and content-scroll boundaries", async () => {
  const user = userEvent.setup();
  render(<Sheet><SheetTrigger>打开笔记库</SheetTrigger><SheetContent side="bottom" swipeToClose><SheetHeader><SheetTitle>笔记库</SheetTitle></SheetHeader><p>笔记库列表</p></SheetContent></Sheet>);
  const trigger = screen.getByRole("button", { name: "打开笔记库" });
  await user.click(trigger);
  const popup = screen.getByRole("dialog", { name: "笔记库" });
  await waitFor(() => expect(popup.hasAttribute("data-swipe-ready")).toBe(true));
  swipeSheet(popup.querySelector('[data-slot="sheet-handle"]')!, 20);
  expect(screen.getByRole("dialog")).toBe(popup);
  expect(popup.style.getPropertyValue("--sheet-swipe-y")).toBe("0px");
  swipeSheet(screen.getByText("笔记库列表"), 160);
  expect(screen.getByRole("dialog")).toBe(popup);
  swipeSheet(screen.getByRole("heading", { name: "笔记库" }), 160, true);
  expect(screen.getByRole("dialog")).toBe(popup);
  swipeSheet(screen.getByRole("heading", { name: "笔记库" }), 160);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("blocks swipe while a vault operation is busy and leaves desktop sheets without a mobile handle", async () => {
  const user = userEvent.setup();
  const view = render(<Sheet><SheetTrigger>打开笔记库</SheetTrigger><SheetContent side="bottom" swipeToClose swipeDisabled><SheetHeader><SheetTitle>笔记库</SheetTitle></SheetHeader></SheetContent></Sheet>);
  await user.click(screen.getByRole("button", { name: "打开笔记库" }));
  const popup = screen.getByRole("dialog");
  await waitFor(() => expect(popup.hasAttribute("data-swipe-ready")).toBe(true));
  swipeSheet(screen.getByRole("heading", { name: "笔记库" }), 160);
  expect(screen.getByRole("dialog")).toBe(popup);
  expect(popup.hasAttribute("data-sheet-dragging")).toBe(false);
  view.unmount();
  vi.stubGlobal("innerWidth", 1024);
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  render(<Sheet defaultOpen><SheetContent side="bottom" swipeToClose><SheetTitle>桌面笔记库</SheetTitle></SheetContent></Sheet>);
  expect(screen.getByRole("dialog").querySelector('[data-slot="sheet-handle"]')).toBeNull();
});
