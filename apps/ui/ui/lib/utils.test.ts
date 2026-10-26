import { expect, test } from "vitest";
import { cn, cnState } from "./utils";

test.each([
  ["h-element-md", "h-12"],
  ["h-12", "h-element-sm"],
  ["h-element-md", "h-auto"],
  ["data-[size=sm]:h-element-sm", "data-[size=sm]:h-12"],
  ["duration-fast-max", "duration-medium-min"],
  ["duration-medium-min", "duration-100"],
  ["shadow-med", "shadow-none"],
  ["ease-standard", "ease-linear"],
])("caller utility %s is replaced by %s", (base, override) => {
  expect(cn(base, override)).toBe(override);
});

test("border width overrides preserve the caller's independent color", () => {
  expect(cn("border-(length:--border-width) border-border", "border-0")).toBe("border-border border-0");
});

test("state callbacks use the same semantic override rules without losing their state", () => {
  const classes = cnState((state: { disabled: boolean }) => state.disabled ? "duration-100 shadow-none" : "", "duration-fast-max shadow-med");
  expect(typeof classes).toBe("function");
  if (typeof classes !== "function") throw new Error("Expected state callback");
  expect(classes({ disabled: true })).toBe("duration-100 shadow-none");
  expect(classes({ disabled: false })).toBe("duration-fast-max shadow-med");
});
