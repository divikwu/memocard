import { expect, test } from "vitest";
import { cn } from "./utils";

test("caller sizes replace semantic dimensions in both directions", () => {
  expect(cn("h-element-md", "h-12")).toBe("h-12");
  expect(cn("h-12", "h-element-sm")).toBe("h-element-sm");
  expect(cn("size-md", "size-6")).toBe("size-6");
  expect(cn("size-6", "size-sm")).toBe("size-sm");
  expect(cn("min-h-textarea", "min-h-12")).toBe("min-h-12");
  expect(cn("h-element-md", "h-auto")).toBe("h-auto");
  expect(cn("data-[size=sm]:h-element-sm", "data-[size=sm]:h-12")).toBe("data-[size=sm]:h-12");
});

test("explicit border overrides replace the shared width without losing color", () => {
  expect(cn("border-(length:--border-width) border-input", "border-0")).toBe("border-input border-0");
  expect(cn("border-2", "border-(length:--border-width)")).toBe("border-(length:--border-width)");
});

test("caller shadow utilities replace semantic state feedback", () => {
  expect(cn("input-state", "inset-shadow-none")).toBe("inset-shadow-none");
  expect(cn("aria-pressed:inset-shadow-selected", "aria-pressed:inset-shadow-none")).toBe("aria-pressed:inset-shadow-none");
  expect(cn("inset-shadow-error", "inset-shadow-success")).toBe("inset-shadow-success");
});
