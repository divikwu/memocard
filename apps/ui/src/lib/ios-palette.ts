export const IOS_PALETTE_KEYS = [
  "background", "foreground", "muted", "muted-foreground", "accent", "border",
  "primary", "primary-foreground", "sidebar", "sidebar-foreground", "sidebar-accent", "sidebar-border",
  ...["default", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"].flatMap(color => [`tag-${color}-bg`, `tag-${color}-fg`]),
] as const;

const IOS_PALETTE_TOKENS: Record<string, string> = {
  background: "--color-background-body", foreground: "--color-text-primary",
  muted: "--color-background-muted", "muted-foreground": "--color-text-secondary",
  accent: "--color-overlay-hover", border: "--color-border",
  primary: "--color-accent", "primary-foreground": "--color-on-accent",
  sidebar: "--color-background-sidebar", "sidebar-foreground": "--color-text-primary",
  "sidebar-accent": "--color-overlay-hover", "sidebar-border": "--color-border",
};

// Resolve the same semantic tokens used by the unified Web and native content.
export function readIOSPalette(): Record<string, number[]> | undefined {
  if (typeof CanvasRenderingContext2D === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const theme = document.querySelector(".web-app.ui-theme") ?? document.documentElement;
  const style = getComputedStyle(theme);
  const colors: Record<string, number[]> = {};
  for (const key of IOS_PALETTE_KEYS) {
    const value = style.getPropertyValue(IOS_PALETTE_TOKENS[key] ?? `--${key}`).trim();
    if (!value) continue;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    colors[key] = Array.from(context.getImageData(0, 0, 1, 1).data);
  }
  return colors;
}
