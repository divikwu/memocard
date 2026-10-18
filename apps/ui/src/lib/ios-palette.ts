export const IOS_PALETTE_KEYS = [
  "background", "foreground", "muted", "muted-foreground", "accent", "border",
  "primary", "primary-foreground", "sidebar", "sidebar-foreground", "sidebar-accent", "sidebar-border",
  ...["default", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"].flatMap(color => [`tag-${color}-bg`, `tag-${color}-fg`]),
] as const;

// Browser-only: resolve the current CSS theme through the same renderer used by the Web UI.
// Native surfaces and Debug preview fixtures consume these RGBA values without a second theme parser.
export function readIOSPalette(): Record<string, number[]> | undefined {
  if (typeof CanvasRenderingContext2D === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const style = getComputedStyle(document.documentElement);
  const colors: Record<string, number[]> = {};
  for (const key of IOS_PALETTE_KEYS) {
    const value = style.getPropertyValue(`--${key}`).trim();
    if (!value) continue;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    colors[key] = Array.from(context.getImageData(0, 0, 1, 1).data);
  }
  return colors;
}
