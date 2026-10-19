type RGB = readonly number[];

// WCAG 2.2 relative luminance in sRGB; compare the unrounded ratio with 4.5.
// https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
export function contrastRatio(foreground: RGB, background: RGB): number {
  const luminance = (rgb: RGB) => rgb.slice(0, 3).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function colorPixel(value: string): number[] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
  if (!CSS.supports("color", value)) throw new Error(`Unsupported sample color: ${value}`);
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
}

// The samples use flat backgrounds and opacity:1. Canvas resolves their actual
// computed CSS colors to sRGB and composites translucent tag/hover fills over
// the explicitly painted backdrop, then composites the text color over that.
// This is a specified-color measurement, not a glyph/anti-aliasing screenshot.
export function measurePair(sample: HTMLElement) {
  const style = getComputedStyle(sample);
  if (style.opacity !== "1" || style.backgroundImage !== "none") throw new Error("Contrast samples require a flat, fully opaque element.");
  const backdrop = getComputedStyle(sample.parentElement!).backgroundColor;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" })!;
  for (const value of [backdrop, style.backgroundColor, style.color]) {
    if (!CSS.supports("color", value)) throw new Error(`Unsupported sample color: ${value}`);
  }
  context.fillStyle = backdrop;
  context.fillRect(0, 0, 1, 1);
  if (context.getImageData(0, 0, 1, 1).data[3] !== 255) throw new Error("Contrast samples require an opaque backdrop.");
  context.fillStyle = style.backgroundColor;
  context.fillRect(0, 0, 1, 1);
  const background = [...context.getImageData(0, 0, 1, 1).data];
  context.fillStyle = style.color;
  context.fillRect(0, 0, 1, 1);
  const foreground = [...context.getImageData(0, 0, 1, 1).data];
  return { ratio: contrastRatio(foreground, background), foreground, background };
}
