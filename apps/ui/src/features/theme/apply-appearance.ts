import { FONT_FAMILIES } from "@/lib/font-options";
import type { Appearance } from "./preferences";

export function applyAppearance(root: HTMLElement, appearance: Appearance, resolvedTheme: "light" | "dark") {
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
  root.dataset.palette = appearance.palette;
  root.dataset.neutralPalette = appearance.neutralPalette;
  root.dataset.headingFont = appearance.headingFont;
  root.dataset.bodyFont = appearance.bodyFont;
  root.dataset.radius = appearance.radius;
  root.style.setProperty("--app-font-heading", FONT_FAMILIES[appearance.headingFont]);
  root.style.setProperty("--app-font-body", FONT_FAMILIES[appearance.bodyFont]);
}
