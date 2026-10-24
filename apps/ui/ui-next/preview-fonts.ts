const sansFallback = '"Noto Sans SC Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const serifFallback = '"Noto Serif SC Variable", Georgia, serif';
const monoFallback = '"Noto Sans SC Variable", ui-monospace, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export const PREVIEW_FONTS = [
  { id: "geist", label: "Geist", fontFamily: `"Geist Variable", ${sansFallback}`, group: "Sans" },
  { id: "inter", label: "Inter", fontFamily: `"Inter Variable", ${sansFallback}`, group: "Sans" },
  { id: "noto-sans", label: "Noto Sans", fontFamily: `"Noto Sans Variable", ${sansFallback}`, group: "Sans" },
  { id: "nunito-sans", label: "Nunito Sans", fontFamily: `"Nunito Sans Variable", ${sansFallback}`, group: "Sans" },
  { id: "figtree", label: "Figtree", fontFamily: `"Figtree Variable", ${sansFallback}`, group: "Sans" },
  { id: "roboto", label: "Roboto", fontFamily: `"Roboto Variable", ${sansFallback}`, group: "Sans" },
  { id: "raleway", label: "Raleway", fontFamily: `"Raleway Variable", ${sansFallback}`, group: "Sans" },
  { id: "dm-sans", label: "DM Sans", fontFamily: `"DM Sans Variable", ${sansFallback}`, group: "Sans" },
  { id: "public-sans", label: "Public Sans", fontFamily: `"Public Sans Variable", ${sansFallback}`, group: "Sans" },
  { id: "outfit", label: "Outfit", fontFamily: `"Outfit Variable", ${sansFallback}`, group: "Sans" },
  { id: "oxanium", label: "Oxanium", fontFamily: `"Oxanium Variable", ${sansFallback}`, group: "Sans" },
  { id: "manrope", label: "Manrope", fontFamily: `"Manrope Variable", ${sansFallback}`, group: "Sans" },
  { id: "space-grotesk", label: "Space Grotesk", fontFamily: `"Space Grotesk Variable", ${sansFallback}`, group: "Sans" },
  { id: "montserrat", label: "Montserrat", fontFamily: `"Montserrat Variable", ${sansFallback}`, group: "Sans" },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", fontFamily: `"IBM Plex Sans Variable", ${sansFallback}`, group: "Sans" },
  { id: "source-sans-3", label: "Source Sans 3", fontFamily: `"Source Sans 3 Variable", ${sansFallback}`, group: "Sans" },
  { id: "instrument-sans", label: "Instrument Sans", fontFamily: `"Instrument Sans Variable", ${sansFallback}`, group: "Sans" },
  { id: "geist-mono", label: "Geist Mono", fontFamily: `"Geist Mono Variable", ${monoFallback}`, group: "Mono" },
  { id: "jetbrains-mono", label: "JetBrains Mono", fontFamily: `"JetBrains Mono Variable", ${monoFallback}`, group: "Mono" },
  { id: "noto-serif", label: "Noto Serif", fontFamily: `"Noto Serif Variable", ${serifFallback}`, group: "Serif" },
  { id: "roboto-slab", label: "Roboto Slab", fontFamily: `"Roboto Slab Variable", ${serifFallback}`, group: "Serif" },
  { id: "merriweather", label: "Merriweather", fontFamily: `"Merriweather Variable", ${serifFallback}`, group: "Serif" },
  { id: "lora", label: "Lora", fontFamily: `"Lora Variable", ${serifFallback}`, group: "Serif" },
  { id: "playfair-display", label: "Playfair Display", fontFamily: `"Playfair Display Variable", ${serifFallback}`, group: "Serif" },
  { id: "eb-garamond", label: "EB Garamond", fontFamily: `"EB Garamond Variable", ${serifFallback}`, group: "Serif" },
  { id: "system-mono", label: "System Mono", fontFamily: 'ui-monospace, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace', group: "Mono" },
] as const;

// Existing device preferences remain available without expanding the toolbar.
export const LEGACY_PREVIEW_FONTS = [
  { id: "noto-sans-sc", label: "Noto Sans SC", fontFamily: '"Noto Sans SC Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', group: "Sans" },
  { id: "pingfang", label: "PingFang", fontFamily: '"PingFang SC", "Noto Sans SC Variable", system-ui, sans-serif', group: "Sans" },
  { id: "songti", label: "Songti", fontFamily: '"Songti SC", "STSong", "Noto Serif SC Variable", serif', group: "Serif" },
] as const;
export type PreviewFont = (typeof PREVIEW_FONTS)[number]["id"] | (typeof LEGACY_PREVIEW_FONTS)[number]["id"];
const allFonts = [...PREVIEW_FONTS, ...LEGACY_PREVIEW_FONTS];
export const getPreviewFont = (font: PreviewFont) => allFonts.find(option => option.id === font)!;
export const isPreviewFont = (font: unknown): font is PreviewFont => allFonts.some(option => option.id === font);

const loaders = {
  geist: () => Promise.all([import("@fontsource-variable/geist/wght.css"), import("@fontsource-variable/geist/wght-italic.css")]),
  inter: () => Promise.all([import("@fontsource-variable/inter/wght.css"), import("@fontsource-variable/inter/wght-italic.css")]),
  "noto-sans": () => import("@fontsource-variable/noto-sans/wght-italic.css"),
  "nunito-sans": () => Promise.all([import("@fontsource-variable/nunito-sans/wght.css"), import("@fontsource-variable/nunito-sans/wght-italic.css")]),
  figtree: () => Promise.all([import("@fontsource-variable/figtree/wght.css"), import("@fontsource-variable/figtree/wght-italic.css")]),
  roboto: () => Promise.all([import("@fontsource-variable/roboto/wght.css"), import("@fontsource-variable/roboto/wght-italic.css")]),
  raleway: () => Promise.all([import("@fontsource-variable/raleway/wght.css"), import("@fontsource-variable/raleway/wght-italic.css")]),
  "dm-sans": () => Promise.all([import("@fontsource-variable/dm-sans/wght.css"), import("@fontsource-variable/dm-sans/wght-italic.css")]),
  "public-sans": () => Promise.all([import("@fontsource-variable/public-sans/wght.css"), import("@fontsource-variable/public-sans/wght-italic.css")]),
  outfit: () => import("@fontsource-variable/outfit/wght.css"),
  oxanium: () => import("@fontsource-variable/oxanium/wght.css"),
  manrope: () => import("@fontsource-variable/manrope/wght.css"),
  "space-grotesk": () => import("@fontsource-variable/space-grotesk/wght.css"),
  montserrat: () => Promise.all([import("@fontsource-variable/montserrat/wght.css"), import("@fontsource-variable/montserrat/wght-italic.css")]),
  "ibm-plex-sans": () => Promise.all([import("@fontsource-variable/ibm-plex-sans/wght.css"), import("@fontsource-variable/ibm-plex-sans/wght-italic.css")]),
  "source-sans-3": () => Promise.all([import("@fontsource-variable/source-sans-3/wght.css"), import("@fontsource-variable/source-sans-3/wght-italic.css")]),
  "instrument-sans": () => Promise.all([import("@fontsource-variable/instrument-sans/wght.css"), import("@fontsource-variable/instrument-sans/wght-italic.css")]),
  "geist-mono": () => Promise.all([import("@fontsource-variable/geist-mono/wght.css"), import("@fontsource-variable/geist-mono/wght-italic.css")]),
  "jetbrains-mono": () => Promise.all([import("@fontsource-variable/jetbrains-mono/wght.css"), import("@fontsource-variable/jetbrains-mono/wght-italic.css")]),
  "noto-serif": () => import("@fontsource-variable/noto-serif/wght-italic.css"),
  "roboto-slab": () => import("@fontsource-variable/roboto-slab/wght.css"),
  merriweather: () => Promise.all([import("@fontsource-variable/merriweather/wght.css"), import("@fontsource-variable/merriweather/wght-italic.css")]),
  lora: () => Promise.all([import("@fontsource-variable/lora/wght.css"), import("@fontsource-variable/lora/wght-italic.css")]),
  "playfair-display": () => Promise.all([import("@fontsource-variable/playfair-display/wght.css"), import("@fontsource-variable/playfair-display/wght-italic.css")]),
  "eb-garamond": () => Promise.all([import("@fontsource-variable/eb-garamond/wght.css"), import("@fontsource-variable/eb-garamond/wght-italic.css")]),
  "noto-sans-sc": () => Promise.resolve(),
} satisfies Record<Exclude<PreviewFont, "system-mono" | "pingfang" | "songti">, () => Promise<unknown>>;

const pending = new Map<string, Promise<unknown>>();
let retryAttempt = 0;

function retryFailedFontFaces(families: string[]) {
  const failed = [...document.fonts].filter(face => face.status === "error" && families.includes(face.family.replace(/["']/g, "")));
  if (!failed.length) return;
  const attempt = String(++retryAttempt);
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const { style } = rule as CSSFontFaceRule;
      if (!failed.some(face => face.family.replace(/["']/g, "") === style.getPropertyValue("font-family").replace(/["']/g, "")
        && face.style === (style.getPropertyValue("font-style") || "normal")
        && face.weight === (style.getPropertyValue("font-weight") || "normal")
        && face.unicodeRange.replace(/\s/g, "").toLowerCase() === (style.getPropertyValue("unicode-range") || "U+0-10FFFF").replace(/\s/g, "").toLowerCase())) continue;
      // A failed FontFace cannot load again; changing src creates a fresh face.
      style.setProperty("src", style.getPropertyValue("src").replace(/url\((["']?)(.*?)\1\)/g, (_match, _quote, source: string) => {
        const url = new URL(source, sheet.href || document.baseURI);
        url.searchParams.set("font-retry", attempt);
        return `url("${url.href}")`;
      }));
    }
  }
}

export function loadPreviewFonts(fonts: PreviewFont[], includeChineseCompanion = true): Promise<unknown[]> {
  return Promise.all([...new Set(fonts)].map(font => {
    if (font === "system-mono" || font === "pingfang" || font === "songti") return Promise.resolve();
    const key = `${font}:${includeChineseCompanion}`;
    let request = pending.get(key);
    if (!request) {
      const option = getPreviewFont(font);
      request = loaders[font]().then(async () => {
        const stack = option.fontFamily.split(",").map(family => family.trim().replace(/["']/g, ""));
        const families = [...new Set([stack[0], ...(includeChineseCompanion ? stack.filter(family => family.endsWith(" SC Variable")) : [])])];
        retryFailedFontFaces(families);
        const faces = await Promise.all(families.map(async family => {
          // Common punctuation overlaps many CJK subsets; use Han characters only.
          const loaded = await document.fonts.load(`400 16px "${family}"`, family.endsWith(" SC Variable") ? "中文" : "Aa");
          if (!loaded.length) throw new Error(`Unable to load ${option.label}.`);
          return loaded;
        }));
        await document.fonts.ready;
        if ([...document.fonts].some(face => face.status === "error" && families.includes(face.family.replace(/["']/g, "")))) throw new Error(`Unable to load ${option.label}.`);
        return faces[0];
      }).catch(error => {
        pending.delete(key);
        throw error;
      });
      pending.set(key, request);
    }
    return request;
  }));
}
