import themeCSS from "tailwindcss/theme.css?raw";
import tailwindPackage from "tailwindcss/package.json";

export type PaletteColor = { name: string; family: string; shade: string; value: string };
export type PaletteGroup = { id: string; label: string; colors: PaletteColor[] };

// Keep the installed Tailwind theme as the only source for primitive color values.
export const paletteColors: PaletteColor[] = [...themeCSS.matchAll(/(--color-([\w-]+)):\s*([^;]+);/g)].map(([, name, suffix, value]) => {
  const scale = suffix.match(/^(.+)-(\d+)$/);
  return { name, family: scale?.[1] ?? "base", shade: scale?.[2] ?? suffix, value: value.trim() };
});

const groups = new Map<string, PaletteGroup>();
for (const color of paletteColors) {
  let group = groups.get(color.family);
  if (!group) {
    group = { id: color.family, label: color.family === "base" ? "Black & White" : color.family[0].toUpperCase() + color.family.slice(1), colors: [] };
    groups.set(color.family, group);
  }
  group.colors.push(color);
}

export const paletteGroups = [...groups.values()];
export const paletteVersion = tailwindPackage.version;
