import { REFERENCE_ROOT_SIZE, fontSizes, lineHeights, textStyles } from "../typography/scale.ts";
import { themeTokenDefinitions } from "../../generated/theme-contract.ts";
import { generateThemeColor, type ColorConfig } from "./generate-theme-color.ts";
import type { TokenValue } from "./theme-types.ts";

export type ThemeAxes = {
  color?: ColorConfig;
  typography?: {
    scale?: { base: number; ratio?: number };
    body?: { family: string; fallbacks?: string };
    heading?: { family: string; fallbacks?: string };
    code?: { family: string; fallbacks?: string };
  };
  radius?: { base: number; multiplier?: number };
  motion?: { scale: number };
};
function fields(value: object, allowed: string[], label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label} configuration.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${label} field: ${key}`);
}
function immutable<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
function positive(value: number, label: string, zero = false) {
  if (!Number.isFinite(value) || (zero ? value < 0 : value <= 0)) throw new Error(`${label} must be ${zero ? "non-negative" : "positive"} and finite.`);
}

export function generateThemeValues(input: ThemeAxes, base?: ThemeAxes) {
  const tokens: Record<string, TokenValue> = {};
  const axes: ThemeAxes = structuredClone(base ?? {});
  if (input.color !== undefined) {
    fields(input.color, ["accent", "neutralStyle", "contrast"], "color");
    const color = Object.fromEntries(Object.entries(input.color).filter(([, value]) => value !== undefined)) as ColorConfig;
    axes.color = { ...axes.color, ...color };
    Object.assign(tokens, generateThemeColor(axes.color));
  }
  if (input.typography !== undefined) {
    fields(input.typography, ["scale", "body", "heading", "code"], "typography");
    const previous = axes.typography;
    axes.typography = { ...previous, ...input.typography };
    if (input.typography.scale !== undefined) {
      fields(input.typography.scale, ["base", "ratio"], "typography.scale");
      const scale = { ...previous?.scale, ...input.typography.scale };
      positive(scale.base, "Typography base");
      if (scale.ratio !== undefined) positive(scale.ratio, "Typography ratio");
      axes.typography.scale = scale;
      const sizes = Object.fromEntries(Object.entries(fontSizes).map(([name, rem], index) => [name, scale.ratio === undefined ? rem * scale.base : scale.base * scale.ratio ** (index - 2)]));
      for (const [name, size] of Object.entries(sizes)) {
        tokens[`--font-size-${name}`] = `${Math.round(size / REFERENCE_ROOT_SIZE * 1e6) / 1e6}rem`;
        const height = Math.max(Math.round(size * lineHeights.normal / 4) * 4, Math.ceil((size + 4) / 4) * 4);
        tokens[`--line-height-${name}`] = String(Math.round(height / size * 1e4) / 1e4);
      }
      for (const [name, style] of Object.entries(textStyles)) {
        const size = sizes[style.size];
        const height = Math.max(Math.round(size * lineHeights[style.leading] / 4) * 4, Math.ceil((size + 4) / 4) * 4);
        tokens[`--text-${name}-size`] = `var(--font-size-${style.size})`;
        tokens[`--text-${name}-leading`] = String(Math.round(height / size * 1e4) / 1e4);
        tokens[`--text-${name}-weight`] = `var(--font-weight-${style.weight})`;
      }
    }
    for (const role of ["body", "heading", "code"] as const) {
      const font = input.typography[role];
      if (font === undefined) continue;
      fields(font, ["family", "fallbacks"], `typography.${role}`);
      if (typeof font.family !== "string" || !font.family.trim() || /[";{}<>]/.test(font.family)) throw new Error(`Invalid ${role} font family.`);
      if (font.fallbacks !== undefined && typeof font.fallbacks !== "string") throw new Error(`Invalid ${role} font fallbacks.`);
      const value = `"${font.family}"${font.fallbacks ? `, ${font.fallbacks}` : ""}`;
      tokens[role === "code" ? "--note-mono-font" : `--app-font-${role}`] = value;
      if (role === "code") tokens["--app-font-mono"] = value;
    }
    if (input.typography.body && !axes.typography.heading) tokens["--app-font-heading"] = tokens["--app-font-body"];
  }
  if (input.radius !== undefined) {
    fields(input.radius, ["base", "multiplier"], "radius");
    axes.radius = { ...axes.radius, ...input.radius };
    positive(axes.radius.base, "Radius base", true);
    positive(axes.radius.multiplier ?? 1, "Radius multiplier", true);
    tokens["--radius"] = `${axes.radius.base * (axes.radius.multiplier ?? 1)}px`;
  }
  if (input.motion !== undefined) {
    fields(input.motion, ["scale"], "motion");
    axes.motion = { ...axes.motion, ...input.motion };
    positive(axes.motion.scale, "Motion scale", true);
    for (const name of ["fast", "normal", "panel", "pulse"]) {
      const token = `--motion-duration-${name}`, value = themeTokenDefinitions[token][0].value;
      const match = value.match(/^([\d.]+)(ms|s)$/)!;
      tokens[token] = `${Math.round(Number(match[1]) * axes.motion.scale * 1e6) / 1e6}${match[2]}`;
    }
  }
  return { axes: immutable(structuredClone(axes)), tokens };
}
