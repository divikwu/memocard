// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EmojiPicker } from "./tag-navigation-editor";

let resize: () => void;
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("only fades edges that have more Emoji beyond the current scroll position", () => {
  render(<EmojiPicker selected="" disabled={false} onSelect={vi.fn()} />);
  const grid = screen.getByLabelText("Emoji");
  Object.defineProperties(grid, {
    clientHeight: { configurable: true, value: 220 },
    scrollHeight: { configurable: true, value: 580 },
  });
  resize();
  expect(grid.hasAttribute("data-overflow-top")).toBe(false);
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(true);
  fireEvent.scroll(grid, { target: { scrollTop: 36 } });
  expect(grid.hasAttribute("data-overflow-top")).toBe(true);
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(true);
  fireEvent.scroll(grid, { target: { scrollTop: 360 } });
  expect(grid.hasAttribute("data-overflow-top")).toBe(true);
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(false);
  fireEvent.scroll(grid, { target: { scrollTop: 0 } });
  expect(grid.hasAttribute("data-overflow-top")).toBe(false);
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(true);
});

it("removes fades when resized or filtered results fit without scrolling", () => {
  render(<EmojiPicker selected="" disabled={false} onSelect={vi.fn()} />);
  const grid = screen.getByLabelText("Emoji");
  Object.defineProperties(grid, {
    clientHeight: { configurable: true, value: 220 },
    scrollHeight: { configurable: true, value: 580 },
  });
  resize();
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(true);
  Object.defineProperty(grid, "clientHeight", { configurable: true, value: 600 });
  resize();
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(false);
  Object.defineProperty(grid, "clientHeight", { configurable: true, value: 220 });
  resize();
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(true);
  Object.defineProperty(grid, "scrollHeight", { configurable: true, value: 36 });
  fireEvent.change(screen.getByRole("textbox", { name: "搜索 Emoji" }), { target: { value: "警告" } });
  expect(grid.hasAttribute("data-overflow-top")).toBe(false);
  expect(grid.hasAttribute("data-overflow-bottom")).toBe(false);
});
