import type { FontChoice } from "@/lib/font-options";

const geistItalic = { family: "Geist Variable", load: () => import("@fontsource-variable/geist/files/geist-latin-wght-italic.woff2?url") };

const pending = new Map<FontChoice, Promise<unknown>>();

async function loadFont(font: FontChoice) {
  if (font === "geist") {
    const { default: url } = await geistItalic.load();
    document.fonts.add(new FontFace(geistItalic.family, `url(${url})`, { style: "italic", weight: "100 900" }));
    return;
  }
  if (font === "noto-sans-sc") {
    // Keep this CSS import separate so the build retains its preload dependency.
    await import("@fontsource-variable/noto-sans-sc/wght.css");
    return;
  }
  const module = await import("./optional-fonts");
  return module.loadOptionalFont(font);
}

export function loadFonts(fonts: FontChoice[]): Promise<unknown[]> {
  return Promise.all([...new Set(fonts)].map((font) => {
    if (font === "pingfang" || font === "songti") return Promise.resolve();
    let request = pending.get(font);
    if (!request) {
      // CSS keeps the CJK unicode-range subsets demand-loaded by the browser;
      // FontFace.load() here would eagerly fetch every registered subset.
      request = loadFont(font).catch((error) => {
        pending.delete(font);
        throw error;
      });
      pending.set(font, request);
    }
    return request;
  }));
}
