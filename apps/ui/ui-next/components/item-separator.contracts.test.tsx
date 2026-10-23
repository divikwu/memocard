// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ItemSeparator } from "./item";

afterEach(cleanup);

it("resolves ItemSeparator orientation classes and merges local overrides", () => {
  const className = vi.fn(({ orientation }: { orientation: "horizontal" | "vertical" }) => `my-4 bg-warning-muted custom-${orientation}`);
  const view = render(<ItemSeparator className={className} />);
  const separator = screen.getByRole("separator");
  expect(separator.classList.contains("custom-horizontal")).toBe(true);
  expect(separator.classList.contains("my-4")).toBe(true);
  expect(separator.classList.contains("my-2")).toBe(false);
  expect(separator.classList.contains("bg-warning-muted")).toBe(true);
  expect(separator.classList.contains("bg-border")).toBe(false);
  view.rerender(<ItemSeparator orientation="vertical" className={className} />);
  expect(separator.classList.contains("custom-vertical")).toBe(true);
  expect(separator.classList.contains("custom-horizontal")).toBe(false);
  expect(className).toHaveBeenLastCalledWith({ orientation: "vertical" });
  view.rerender(<ItemSeparator className="my-6 bg-error" />);
  expect(separator.classList.contains("my-6")).toBe(true);
  expect(separator.classList.contains("my-2")).toBe(false);
  expect(separator.classList.contains("bg-error")).toBe(true);
  expect(separator.classList.contains("bg-border")).toBe(false);
});
