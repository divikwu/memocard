// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { readIOSThemeRadius } from "./ios-theme";
afterEach(() => { vi.restoreAllMocks(); document.querySelector(".web-app")?.remove(); });
it("does not publish a radius when unified tokens are unavailable", () => {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: () => "" } as unknown as CSSStyleDeclaration);
  expect(readIOSThemeRadius()).toBeUndefined();
});
it.each([["12px", 12], ["0px", 0], ["14.5px", 14.5], ["50%", undefined]])("samples the unified control radius and removes its probe: %s", (value, expected) => {
  const theme = document.createElement("div"); theme.className = "web-app ui-next-theme"; document.body.append(theme);
  const read = vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: () => ".5rem", borderTopLeftRadius: value } as unknown as CSSStyleDeclaration);
  expect(readIOSThemeRadius()).toBe(expected);
  expect(read.mock.calls[0][0]).toBe(theme);
  expect(theme.childElementCount).toBe(0);
});
