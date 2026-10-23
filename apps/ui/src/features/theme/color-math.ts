export function parseHex(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
export function formatHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
export function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const rgb = parseHex(hex);
    if (!rgb) throw new Error(`Expected a six-digit hex color: ${hex}`);
    return Object.values(rgb).map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
