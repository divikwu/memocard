import { isPreviewFont, type PreviewFont } from "./preview-fonts";

export const PREVIEW_RADII = [
  { value: "default", title: "默认 · 8px", radius: "0.5rem" },
  { value: "none", title: "None · 0px", radius: "0rem" },
  { value: "small", title: "Small · 7.2px", radius: "0.45rem" },
  { value: "medium", title: "Medium · 10px", radius: "0.625rem" },
  { value: "large", title: "Large · 14px", radius: "0.875rem" },
] as const;

export const LEGACY_PREVIEW_RADII = [
  { value: "legacy-xs", title: "已有设置 · 4px", radius: "0.25rem" },
  { value: "legacy-sm", title: "已有设置 · 6px", radius: "0.375rem" },
  { value: "legacy-xl", title: "已有设置 · 12px", radius: "0.75rem" },
  { value: "legacy-2xl", title: "已有设置 · 16px", radius: "1rem" },
] as const;
type PreviewRadius = (typeof PREVIEW_RADII)[number]["value"] | (typeof LEGACY_PREVIEW_RADII)[number]["value"];
const allRadii = [...PREVIEW_RADII, ...LEGACY_PREVIEW_RADII];
export const getPreviewRadius = (radius: PreviewRadius) => allRadii.find(option => option.value === radius)!;

export type PreviewAppearance = {
  radius: PreviewRadius;
  headingFont: PreviewFont | "inherit";
  bodyFont: PreviewFont;
};

export const DEFAULT_PREVIEW_APPEARANCE: PreviewAppearance = {
  radius: "default", headingFont: "inherit", bodyFont: "noto-sans",
};

export function parsePreviewAppearance(globals: Record<string, unknown>): PreviewAppearance {
  return {
    radius: allRadii.find(option => option.value === globals.radius)?.value ?? DEFAULT_PREVIEW_APPEARANCE.radius,
    headingFont: globals.headingFont === "inherit" ? "inherit" : isPreviewFont(globals.headingFont) ? globals.headingFont : DEFAULT_PREVIEW_APPEARANCE.headingFont,
    bodyFont: isPreviewFont(globals.bodyFont) ? globals.bodyFont : DEFAULT_PREVIEW_APPEARANCE.bodyFont,
  };
}
