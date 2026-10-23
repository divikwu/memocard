import "../.storybook/preview.css";
import "../src/tag-colors.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { commands, userEvent } from "vitest/browser";
import { Dialog, DialogContent, DialogTitle } from "../src/components/ui/dialog";
import { ThemeProvider, useTheme } from "../src/features/theme/ThemeProvider";
import { ThemeStyle } from "../src/features/theme/ThemeStyle";
import { defineTheme } from "../src/features/theme/define-theme";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, PALETTE_VALUES, NEUTRAL_VALUES } from "../src/features/theme/preferences";
import { readIOSThemeRadius } from "../src/lib/ios-theme";
import { IOS_PALETTE_KEYS, readIOSPalette } from "../src/lib/ios-palette";
import { colorPixel, measurePair } from "./foundation-color-contrast";
import { builtCSS, builtOceanTheme, oceanTheme, ThemeDefinitionSample } from "./theme-definition.example";

const root = document.documentElement;
const attributes = ["class", "style", "data-palette", "data-neutral-palette", "data-radius", "data-heading-font", "data-body-font", "data-memocard-theme"];
let original: (string | null)[], stored: string | null;
const styles: HTMLStyleElement[] = [];
beforeEach(() => { original = attributes.map(name => root.getAttribute(name)); stored = localStorage.getItem(APPEARANCE_STORAGE_KEY); });
afterEach(() => {
  cleanup(); styles.splice(0).forEach(style => style.remove());
  attributes.forEach((name, index) => { const value = original[index]; if (value === null) root.removeAttribute(name); else root.setAttribute(name, value); });
  if (stored === null) localStorage.removeItem(APPEARANCE_STORAGE_KEY); else localStorage.setItem(APPEARANCE_STORAGE_KEY, stored);
});
function loadBuiltCSS() { const style = document.createElement("style"); style.textContent = builtCSS; document.head.append(style); styles.push(style); }
function snapshot(container: HTMLElement) {
  const samples = ["themed-body", "themed-card", "themed-action", "themed-link", "local-action"].map(id => {
    const style = getComputedStyle(container.querySelector(`[data-testid="${id}"]`)!);
    return [style.color, style.backgroundColor, style.borderColor, style.borderRadius, style.fontSize, style.transitionDuration];
  });
  return { samples, palette: readIOSPalette() };
}
for (const mode of ["light", "dark"] as const) for (const palette of PALETTE_VALUES) for (const neutral of NEUTRAL_VALUES) test(`runtime and built themes: ${mode} / ${palette} / ${neutral}`, () => {
  const saved = JSON.stringify({ ...DEFAULT_APPEARANCE, theme: mode, palette, neutralPalette: neutral });
  localStorage.setItem(APPEARANCE_STORAGE_KEY, saved);
  const view = render(<ThemeProvider definition={oceanTheme}><ThemeDefinitionSample /></ThemeProvider>);
  expect(root.dataset.palette).toBe(palette);
  expect(root.dataset.neutralPalette).toBe(neutral);
  expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe(saved);
  expect(measurePair(view.getByTestId("themed-action")).ratio).toBeGreaterThanOrEqual(4.5);
  expect(measurePair(view.getByTestId("themed-link")).ratio).toBeGreaterThanOrEqual(4.5);
  expect(getComputedStyle(view.getByTestId("local-action")).backgroundColor).toBe("rgb(18, 52, 86)");
  expect(getComputedStyle(view.getByTestId("brand-text")).color).toBe(mode === "dark" ? "rgb(191, 234, 255)" : "rgb(18, 52, 86)");
  const actual = snapshot(view.container);
  const button = getComputedStyle(view.getByTestId("themed-action"));
  expect(actual.palette!.primary).toEqual(colorPixel(button.backgroundColor));
  expect(Object.keys(actual.palette!).sort()).toEqual([...IOS_PALETTE_KEYS].sort());
  loadBuiltCSS();
  view.rerender(<ThemeProvider definition={builtOceanTheme}><ThemeDefinitionSample /></ThemeProvider>);
  expect(snapshot(view.container)).toEqual(actual);
  expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe(saved);
  expect(root.dataset.memocardTheme).toBe("ocean");
  expect(document.head.querySelectorAll("style[data-memocard-theme]")).toHaveLength(0);
});

test("theme changes follow mode controls, restore defaults and keep component instances", async () => {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(DEFAULT_APPEARANCE));
  function Controls() { const { setTheme } = useTheme(); return <button onClick={() => setTheme("dark")}>Dark mode</button>; }
  const view = render(<ThemeProvider><Controls /><ThemeDefinitionSample /></ThemeProvider>);
  const initial = snapshot(view.container), button = view.getByTestId("themed-action");
  view.rerender(<ThemeProvider definition={oceanTheme}><Controls /><ThemeDefinitionSample /></ThemeProvider>);
  expect(view.getByTestId("themed-action")).toBe(button);
  expect(snapshot(view.container).palette!.primary).not.toEqual(initial.palette!.primary);
  await userEvent.click(view.getByText("Dark mode"));
  await expect.poll(() => root.classList.contains("dark")).toBe(true);
  expect(readIOSPalette()!.primary).toEqual(colorPixel(getComputedStyle(button).backgroundColor));
  expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!).theme).toBe("dark");
  view.rerender(<ThemeProvider><Controls /><ThemeDefinitionSample /></ThemeProvider>);
  expect(root.hasAttribute("data-memocard-theme")).toBe(false);
  expect(document.head.querySelectorAll("style[data-memocard-theme]")).toHaveLength(0);
  expect(view.getByTestId("themed-action")).toBe(button);
});

test("numeric generators render through existing typography, shape and motion formulas", () => {
  root.classList.remove("dark");
  const theme = defineTheme({ name: "numeric", typography: { scale: { base: 18 }, body: { family: "Georgia", fallbacks: "serif" }, code: { family: "Menlo", fallbacks: "monospace" } }, radius: { base: 12 }, motion: { scale: .5 } });
  const view = render(<><ThemeStyle definition={theme} /><ThemeDefinitionSample /></>);
  const text = getComputedStyle(view.getByTestId("themed-text")), button = getComputedStyle(view.getByTestId("themed-action"));
  expect(text.fontSize).toBe("18px");
  expect(text.fontFamily).toContain("Georgia");
  expect(getComputedStyle(view.getByTestId("themed-code")).fontFamily).toMatch(/Menlo.*monospace/);
  expect(button.borderRadius).toBe("10px");
  expect(readIOSThemeRadius()).toBe(12);
  expect(button.transitionDuration.split(",").every(value => Number.parseFloat(value) === .075)).toBe(true);
  expect(getComputedStyle(root).getPropertyValue("--motion-duration-reduced").trim()).toBe("0.01ms");
});

test("runtime theme cleanup restores any existing selector and removes only its own style", () => {
  root.setAttribute("data-memocard-theme", "host");
  const view = render(<ThemeStyle definition={oceanTheme} />);
  expect(root.dataset.memocardTheme).toBe("ocean");
  expect(document.head.querySelectorAll("style[data-memocard-theme]")).toHaveLength(1);
  view.unmount();
  expect(root.dataset.memocardTheme).toBe("host");
  expect(document.head.querySelectorAll("style[data-memocard-theme]")).toHaveLength(0);
});


test("system appearance changes update a custom theme without rewriting the preference", async () => {
  const originalDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  await commands.setColorScheme("light");
  const saved = JSON.stringify({ ...DEFAULT_APPEARANCE, theme: "system" });
  localStorage.setItem(APPEARANCE_STORAGE_KEY, saved);
  const view = render(<ThemeProvider definition={oceanTheme}><ThemeDefinitionSample /></ThemeProvider>);
  try {
    expect(root.classList.contains("light")).toBe(true);
    const light = readIOSPalette()!.primary;
    await commands.setColorScheme("dark");
    await expect.poll(() => root.classList.contains("dark")).toBe(true);
    expect(readIOSPalette()!.primary).not.toEqual(light);
    expect(readIOSPalette()!.primary).toEqual(colorPixel(getComputedStyle(view.getByTestId("themed-action")).backgroundColor));
    expect(root.dataset.memocardTheme).toBe("ocean");
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe(saved);
  } finally {
    await commands.setColorScheme(originalDark ? "dark" : "light");
    await expect.poll(() => root.classList.contains("dark")).toBe(originalDark);
  }
});


for (const mode of ["light", "dark"]) test(`root definitions reach real dialog portals: ${mode}`, () => {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ ...DEFAULT_APPEARANCE, theme: mode }));
  render(<ThemeProvider definition={oceanTheme}><Dialog defaultOpen><DialogContent><DialogTitle>Theme portal</DialogTitle></DialogContent></Dialog></ThemeProvider>);
  const dialog = document.querySelector('[data-slot="dialog-content"]')!;
  const style = getComputedStyle(dialog), rootStyle = getComputedStyle(root);
  expect(colorPixel(style.backgroundColor)).toEqual(colorPixel(rootStyle.getPropertyValue("--surface-bg")));
  expect(colorPixel(style.color)).toEqual(readIOSPalette()!.foreground);
});


test("saved font choices remain above theme font defaults", () => {
  const saved = JSON.stringify(DEFAULT_APPEARANCE);
  localStorage.setItem(APPEARANCE_STORAGE_KEY, saved);
  const theme = defineTheme({ name: "font-default", typography: { body: { family: "Georgia", fallbacks: "serif" } } });
  const view = render(<ThemeProvider definition={theme}><ThemeDefinitionSample /></ThemeProvider>);
  expect(getComputedStyle(view.getByTestId("themed-text")).fontFamily).toContain("Geist Variable");
  expect(root.dataset.bodyFont).toBe(DEFAULT_APPEARANCE.bodyFont);
  expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe(saved);
});


test("native radius uses themed px/rem/calc lengths and keeps the original preference fallback", () => {
  root.style.fontSize = "20px";
  root.dataset.radius = "lg";
  root.dataset.memocardTheme = "radius-probe";
  root.style.setProperty("--radius", ".625rem");
  expect(readIOSThemeRadius()).toBeUndefined();
  for (const [value, expected] of [["12px", 12], ["1.25rem", 25], ["calc(1rem + 3px)", 23], ["0px", 0]] as const) {
    root.style.setProperty("--radius", value);
    expect(readIOSThemeRadius(), value).toBe(expected);
  }
  root.style.setProperty("--radius", "50%");
  expect(readIOSThemeRadius()).toBeUndefined();
  root.removeAttribute("data-memocard-theme");
  root.style.setProperty("--radius", "12px");
  expect(readIOSThemeRadius()).toBeUndefined();
});
