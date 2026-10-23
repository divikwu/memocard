import { radiusValues } from "../generated/design-tokens";
import { DEFAULT_APPEARANCE, type RadiusChoice } from "../features/theme/preferences";
import { REFERENCE_ROOT_SIZE } from "../features/typography/scale";

// The existing native rowRadius field uses logical points, matching CSS px in
// the viewport. Keep the portable preference fallback until a theme is active.
export function readIOSThemeRadius(): number | undefined {
  const root = document.documentElement;
  if (!root.hasAttribute("data-memocard-theme")) return;
  const valueAtRoot = getComputedStyle(root).getPropertyValue("--radius").trim();
  const preference = radiusValues[root.dataset.radius as RadiusChoice] ?? radiusValues[DEFAULT_APPEARANCE.radius];
  const rem = valueAtRoot.match(/^([\d.]+)rem$/);
  if (rem && Number(rem[1]) * REFERENCE_ROOT_SIZE === preference) return;
  const sample = document.createElement("span");
  sample.style.cssText = "position:fixed;width:0;height:0;visibility:hidden;pointer-events:none;border-top-left-radius:var(--radius)";
  root.append(sample);
  const value = getComputedStyle(sample).borderTopLeftRadius;
  sample.remove();
  if (!/^\d+(?:\.\d+)?px$/.test(value)) return;
  return Number.parseFloat(value);
}
