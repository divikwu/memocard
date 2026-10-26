// Native rowRadius uses logical points, matching the resolved CSS viewport length.
export function readIOSThemeRadius(): number | undefined {
  const theme = document.querySelector(".web-app.ui-theme") ?? document.documentElement;
  if (!getComputedStyle(theme).getPropertyValue("--radius-element").trim()) return;
  const sample = document.createElement("span");
  sample.style.cssText = "position:fixed;width:0;height:0;visibility:hidden;pointer-events:none;border-top-left-radius:var(--radius-element)";
  theme.append(sample);
  const value = getComputedStyle(sample).borderTopLeftRadius;
  sample.remove();
  if (!/^\d+(?:\.\d+)?px$/.test(value)) return;
  return Number.parseFloat(value);
}
