import { FONT_VALUES, type FontChoice } from "@/lib/font-options";

export const THEME_VALUES = ["light", "dark", "system"] as const;
export const PALETTE_VALUES = ["lime", "green", "emerald", "teal", "cyan", "sky", "blue", "mono"] as const;
export const NEUTRAL_VALUES = ["slate", "neutral"] as const;
export const RADIUS_VALUES = ["none", "xs", "sm", "md", "lg", "xl", "2xl"] as const;

export type Theme = (typeof THEME_VALUES)[number];
export type Palette = (typeof PALETTE_VALUES)[number];
export type NeutralPalette = (typeof NEUTRAL_VALUES)[number];
export type RadiusChoice = (typeof RADIUS_VALUES)[number];
export type Appearance = {
  theme: Theme;
  palette: Palette;
  neutralPalette: NeutralPalette;
  headingFont: FontChoice;
  bodyFont: FontChoice;
  radius: RadiusChoice;
};

// Match Becoming's application defaults, including its explicit light-mode override.
export const DEFAULT_APPEARANCE: Appearance = {
  theme: "light", palette: "blue", neutralPalette: "neutral",
  headingFont: "geist", bodyFont: "geist", radius: "lg",
};
export const APPEARANCE_STORAGE_KEY = "memocard-appearance-v1";

function option<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === "string" && values.includes(value as T) ? value as T : fallback;
}

export function parseAppearance(raw: string | null): Appearance {
  if (!raw) return { ...DEFAULT_APPEARANCE };
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { ...DEFAULT_APPEARANCE }; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ...DEFAULT_APPEARANCE };
  const value = data as Record<string, unknown>;
  return {
    theme: option(value.theme, THEME_VALUES, DEFAULT_APPEARANCE.theme),
    palette: option(value.palette, PALETTE_VALUES, DEFAULT_APPEARANCE.palette),
    neutralPalette: option(value.neutralPalette, NEUTRAL_VALUES, DEFAULT_APPEARANCE.neutralPalette),
    headingFont: option(value.headingFont, FONT_VALUES, DEFAULT_APPEARANCE.headingFont),
    bodyFont: option(value.bodyFont, FONT_VALUES, DEFAULT_APPEARANCE.bodyFont),
    radius: option(value.radius, RADIUS_VALUES, DEFAULT_APPEARANCE.radius),
  };
}
