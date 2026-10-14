// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./sheet";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
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
