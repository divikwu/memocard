// @vitest-environment jsdom
import type { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TooltipHints } from "./tooltip";

const lifecycle = vi.hoisted(() => ({ complete: undefined as TooltipPrimitive.Root.Props["onOpenChangeComplete"] }));
vi.mock("@base-ui/react/tooltip", async importOriginal => {
  const original = await importOriginal<typeof import("@base-ui/react/tooltip")>();
  return { ...original, Tooltip: { ...original.Tooltip, Root: (props: TooltipPrimitive.Root.Props) => {
    lifecycle.complete = props.onOpenChangeComplete;
    return <original.Tooltip.Root {...props} />;
  } } };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("ignores an old close completion after a new delegated hint opens", async () => {
  const user = userEvent.setup();
  render(<TooltipHints><button data-ui-tooltip="第一个提示">第一个</button><button data-ui-tooltip="第二个提示">第二个</button></TooltipHints>);
  await user.hover(screen.getByRole("button", { name: "第一个" }));
  expect((await screen.findByRole("tooltip")).textContent).toBe("第一个提示");
  await user.keyboard("{Escape}");
  const finishClosing = lifecycle.complete!;
  await user.hover(screen.getByRole("button", { name: "第二个" }));
  expect((await screen.findByRole("tooltip")).textContent).toBe("第二个提示");
  act(() => finishClosing(false));
  expect(screen.getByRole("tooltip").textContent).toBe("第二个提示");
});

it("keeps the new hint open after the pointer crosses an unlabelled element", () => {
  vi.useFakeTimers();
  render(<TooltipHints><button data-ui-tooltip="标题提示">标题</button><span>间隔</span><button data-ui-tooltip="路径提示">路径</button></TooltipHints>);
  const title = screen.getByRole("button", { name: "标题" });
  const gap = screen.getByText("间隔");
  const path = screen.getByRole("button", { name: "路径" });
  fireEvent.pointerOver(title, { pointerType: "mouse" });
  expect(screen.getByRole("tooltip").textContent).toBe("标题提示");
  fireEvent.pointerOut(title, { pointerType: "mouse", relatedTarget: gap });
  fireEvent.pointerOver(gap, { pointerType: "mouse", relatedTarget: title });
  fireEvent.pointerOut(gap, { pointerType: "mouse", relatedTarget: path });
  fireEvent.pointerOver(path, { pointerType: "mouse", relatedTarget: gap });
  expect(screen.getByRole("tooltip").textContent).toBe("路径提示");
  act(() => { vi.advanceTimersByTime(100); });
  expect(screen.getByRole("tooltip").textContent).toBe("路径提示");
});
