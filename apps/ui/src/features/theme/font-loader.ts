import type { FontChoice } from "@/lib/font-options";

type FontAsset = { family: string; load: () => Promise<{ default: string }> };

const assets: Partial<Record<FontChoice, FontAsset>> = {
  inter: { family: "Inter Variable", load: () => import("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url") },
  "noto-sans": { family: "Noto Sans Variable", load: () => import("@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2?url") },
  "nunito-sans": { family: "Nunito Sans Variable", load: () => import("@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2?url") },
  figtree: { family: "Figtree Variable", load: () => import("@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url") },
  roboto: { family: "Roboto Variable", load: () => import("@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2?url") },
  raleway: { family: "Raleway Variable", load: () => import("@fontsource-variable/raleway/files/raleway-latin-wght-normal.woff2?url") },
  "dm-sans": { family: "DM Sans Variable", load: () => import("@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url") },
  "public-sans": { family: "Public Sans Variable", load: () => import("@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2?url") },
  outfit: { family: "Outfit Variable", load: () => import("@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?url") },
  oxanium: { family: "Oxanium Variable", load: () => import("@fontsource-variable/oxanium/files/oxanium-latin-wght-normal.woff2?url") },
  manrope: { family: "Manrope Variable", load: () => import("@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url") },
  "space-grotesk": { family: "Space Grotesk Variable", load: () => import("@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url") },
  montserrat: { family: "Montserrat Variable", load: () => import("@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2?url") },
  "ibm-plex-sans": { family: "IBM Plex Sans Variable", load: () => import("@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url") },
  "source-sans-3": { family: "Source Sans 3 Variable", load: () => import("@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url") },
  "instrument-sans": { family: "Instrument Sans Variable", load: () => import("@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url") },
  "geist-mono": { family: "Geist Mono Variable", load: () => import("@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url") },
  "jetbrains-mono": { family: "JetBrains Mono Variable", load: () => import("@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url") },
  "noto-serif": { family: "Noto Serif Variable", load: () => import("@fontsource-variable/noto-serif/files/noto-serif-latin-wght-normal.woff2?url") },
  "roboto-slab": { family: "Roboto Slab Variable", load: () => import("@fontsource-variable/roboto-slab/files/roboto-slab-latin-wght-normal.woff2?url") },
  merriweather: { family: "Merriweather Variable", load: () => import("@fontsource-variable/merriweather/files/merriweather-latin-wght-normal.woff2?url") },
  lora: { family: "Lora Variable", load: () => import("@fontsource-variable/lora/files/lora-latin-wght-normal.woff2?url") },
  "playfair-display": { family: "Playfair Display Variable", load: () => import("@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url") },
  "eb-garamond": { family: "EB Garamond Variable", load: () => import("@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url") },
};

const pending = new Map<FontChoice, Promise<unknown>>();

async function loadFont(asset: FontAsset): Promise<void> {
  const { default: url } = await asset.load();
  const face = await new FontFace(asset.family, `url(${url})`, { style: "normal", weight: "100 900" }).load();
  document.fonts.add(face);
}

export function loadFonts(fonts: FontChoice[]): Promise<unknown[]> {
  return Promise.all([...new Set(fonts)].map((font) => {
    const asset = assets[font];
    if (!asset && font !== "noto-sans-sc") return Promise.resolve();
    let request = pending.get(font);
    if (!request) {
      // CSS keeps the CJK unicode-range subsets demand-loaded by the browser;
      // FontFace.load() here would eagerly fetch every registered subset.
      request = (font === "noto-sans-sc" ? import("@fontsource-variable/noto-sans-sc/wght.css") : loadFont(asset!)).catch((error) => {
        pending.delete(font);
        throw error;
      });
      pending.set(font, request);
    }
    return request;
  }));
}
