import { hexToHct, hctToHex, tonalPalette, hexWithAlpha } from "./hct.ts";
import { contrastRatio, parseHex } from "./color-math.ts";
import type { TokenValue } from "./theme-types.ts";

export type ColorConfig = {
  accent?: string | readonly [string, string];
  neutralStyle?: "warm" | "cool" | "neutral";
  contrast?: "standard" | "high";
};
const stops = { 50: 99, 100: 95, 200: 90, 300: 80, 400: 70, 500: 60, 600: 50, 700: 40, 800: 30, 900: 20, 950: 10 };

export function generateThemeColor(config: ColorConfig): Record<string, TokenValue> {
  for (const key of Object.keys(config)) if (!["accent", "neutralStyle", "contrast"].includes(key)) throw new Error(`Unknown color field: ${key}`);
  const seeds = typeof config.accent === "string" ? [config.accent, config.accent] : config.accent ?? ["#0064E0", "#0064E0"];
  if (seeds.length !== 2 || seeds.some(seed => !parseHex(seed))) throw new Error("Color accent must be a #RRGGBB seed or a light/dark pair.");
  if (config.neutralStyle !== undefined && !["warm", "cool", "neutral"].includes(config.neutralStyle)) throw new Error("Unknown neutral style.");
  if (config.contrast !== undefined && !["standard", "high"].includes(config.contrast)) throw new Error("Unknown contrast level.");
  const chroma = { warm: 7, cool: 5, neutral: 3 }[config.neutralStyle ?? "cool"];
  const high = config.contrast === "high";
  const palettes = seeds.map(seed => {
    const hct = hexToHct(seed);
    return { hue: hct.hue, N: tonalPalette(hct.hue, chroma), V: tonalPalette(hct.hue, chroma + 3), P: tonalPalette(hct.hue, Math.max(hct.chroma, 48)) };
  });
  const [light, dark] = palettes;
  const result: Record<string, TokenValue> = {};
  const set = (name: string, lightValue: string, darkValue: string) => { result[name] = [lightValue, darkValue]; };
  for (const [stop, tone] of Object.entries(stops)) set(`--neutral-${stop}`, light.N[tone], dark.N[tone]);
  if (config.accent !== undefined) {
    for (const [stop, tone] of Object.entries(stops)) set(`--accent-${stop}`, light.P[tone], dark.P[tone]);
    set("--primary", light.P[40], dark.P[80]);
    set("--primary-foreground", light.P[100], dark.P[20]);
    result["--text-accent-color"] = "var(--primary)";
    result["--accent-text"] = "var(--primary)";
    set("--accent-muted-bg", "color-mix(in srgb, var(--primary) 20%, transparent)", "color-mix(in srgb, var(--primary) 25%, transparent)");
    set("--focus-outline-color", light.P[40], dark.P[80]);
  }
  set("--foreground", light.N[high ? 0 : 10], dark.N[high ? 99 : 90]);
  set("--muted-foreground", light.V[high ? 20 : 30], dark.V[high ? 80 : 70]);
  set("--text-disabled-color", light.V[60], dark.V[40]);
  set("--icon-disabled-color", light.V[60], dark.V[40]);
  result["--icon-primary-color"] = "var(--foreground)";
  result["--icon-secondary-color"] = "var(--muted-foreground)";
  set("--background", light.N[95], dark.N[5]);
  set("--surface-bg", light.N[99], dark.N[10]);
  set("--card", light.N[99], dark.N[10]);
  set("--popover", light.N[99], dark.N[20]);
  set("--muted", light.N[95], dark.N[20]);
  set("--sidebar", light.N[95], dark.N[10]);
  set("--inverted-bg", light.N[10], dark.N[99]);
  set("--secondary", hexWithAlpha(light.N[10], .1), hexWithAlpha(dark.N[90], .2));
  result["--secondary-foreground"] = "var(--foreground)";
  result["--sidebar-foreground"] = "var(--foreground)";
  result["--sidebar-accent-foreground"] = "var(--foreground)";
  result["--accent-foreground"] = "var(--foreground)";
  set("--accent", hexWithAlpha(light.N[10], .1), hexWithAlpha(dark.N[90], .2));
  set("--overlay-bg", hexWithAlpha(light.N[10], .4), hexWithAlpha(dark.N[10], .6));
  set("--tint-hover-color", light.N[10], dark.N[100]);
  set("--hover-bg", hexWithAlpha(light.N[10], .05), hexWithAlpha(dark.N[100], .05));
  set("--pressed-bg", hexWithAlpha(light.N[10], .1), hexWithAlpha(dark.N[100], .1));
  set("--border", hexWithAlpha(light.N[10], high ? .2 : .1), hexWithAlpha(dark.N[95], high ? .2 : .1));
  const border = palettes.map(({ hue, N }, index) => {
    let tone = high ? 50 : index === 0 ? 70 : 30;
    const backgrounds = index === 0 ? [N[95], N[99]] : [N[5], N[10], N[20]];
    let color = hctToHex({ hue, chroma: chroma + 3, tone });
    while (backgrounds.some(background => contrastRatio(color, background) < 3) && tone > 0 && tone < 100) {
      tone += index === 0 ? -1 : 1;
      color = hctToHex({ hue, chroma: chroma + 3, tone });
    }
    return color;
  });
  set("--border-emphasized-color", border[0], border[1]);
  result["--input"] = "var(--border-emphasized-color)";
  result["--sidebar-border"] = "var(--border)";
  set("--track-bg", light.V[70], dark.V[30]);
  result["--shadow-color"] = "#000000";
  return result;
}
