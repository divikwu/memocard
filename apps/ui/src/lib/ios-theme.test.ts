// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readIOSThemeRadius } from "./ios-theme";
const root = document.documentElement;
const names = ["data-memocard-theme", "data-radius"], original = names.map(name => root.getAttribute(name));
afterEach(() => { vi.restoreAllMocks(); names.forEach((name, index) => { const value = original[index]; if (value === null) root.removeAttribute(name); else root.setAttribute(name, value); }); });
it("keeps the portable fallback without an active definition or an altered base", () => {
  root.removeAttribute("data-memocard-theme");
  const read = vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: () => ".625rem" } as unknown as CSSStyleDeclaration);
  expect(readIOSThemeRadius()).toBeUndefined();
  expect(read).not.toHaveBeenCalled();
  root.dataset.memocardTheme = "color-only"; root.dataset.radius = "lg";
  expect(readIOSThemeRadius()).toBeUndefined();
  expect(read).toHaveBeenCalledTimes(1);
});
it.each([["12px", 12], ["0px", 0], ["14.5px", 14.5], ["50%", undefined]])("samples a representable themed length and removes the probe: %s", (value, expected) => {
  root.dataset.memocardTheme = "custom";
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: () => "12px", borderTopLeftRadius: value } as unknown as CSSStyleDeclaration);
  const count = root.childElementCount;
  expect(readIOSThemeRadius()).toBe(expected);
  expect(root.childElementCount).toBe(count);
});
