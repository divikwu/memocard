// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const load = vi.fn();
let faces: FontFace[];
beforeEach(() => {
  vi.resetModules();
  faces = [];
  load.mockReset().mockResolvedValue([{}]);
  Object.defineProperty(document, "fonts", { configurable: true, value: { load, ready: Promise.resolve(), [Symbol.iterator]: () => faces[Symbol.iterator]() } });
});
afterEach(() => { vi.restoreAllMocks(); });

it("shares duplicate font work across concurrent selections and skips system fonts", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  await Promise.all([loadPreviewFonts(["geist", "geist"]), loadPreviewFonts(["geist", "system-mono"])]);
  expect(load).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenCalledWith('400 16px "Geist Variable"', "Aa");
  expect(load).toHaveBeenCalledWith('400 16px "Noto Sans SC Variable"', "中文");
});

it("rejects missing font faces and permits a later selection to retry", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  load.mockResolvedValueOnce([]);
  await expect(loadPreviewFonts(["geist"])).rejects.toThrow("Unable to load Geist.");
  await expect(loadPreviewFonts(["geist"])).resolves.toEqual([[{}]]);
  expect(load).toHaveBeenCalledTimes(4);
});

it.each([
  ["noto-sans", "Noto Sans SC Variable"],
  ["noto-serif", "Noto Serif SC Variable"],
] as const)("rejects a failed Chinese companion for %s and permits retry", async (font, family) => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  load.mockImplementation(async (query: string) => {
    if (query.includes(family)) throw new DOMException("Chinese font offline", "NetworkError");
    return [{}];
  });
  await expect(loadPreviewFonts([font])).rejects.toThrow("Chinese font offline");
  load.mockResolvedValue([{}]);
  await expect(loadPreviewFonts([font])).resolves.toEqual([[{}]]);
  expect(load).toHaveBeenCalledWith(`400 16px "${family}"`, "中文");
});

it("waits for the Chinese companion instead of reporting Latin-only success", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  let completeChinese!: (faces: object[]) => void;
  load.mockImplementation((query: string) => query.includes("Noto Sans SC Variable")
    ? new Promise(resolve => { completeChinese = resolve; }) : Promise.resolve([{}]));
  let ready = false;
  const request = loadPreviewFonts(["noto-sans"]).then(() => { ready = true; });
  await vi.waitFor(() => expect(completeChinese).toBeTypeOf("function"));
  expect(ready).toBe(false);
  completeChinese([{}]);
  await request;
  expect(ready).toBe(true);
});

it("rejects an unregistered Chinese companion instead of accepting system fallback", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  load.mockImplementation(async (query: string) => query.includes("Noto Serif SC Variable") ? [] : [{}]);
  await expect(loadPreviewFonts(["noto-serif"])).rejects.toThrow("Unable to load Noto Serif.");
});

it("also rejects failed visible Chinese slices outside the representative sample", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  faces = [{ family: "Noto Sans SC Variable", status: "error", style: "normal", weight: "100 900", unicodeRange: "U+9FFF" } as FontFace];
  await expect(loadPreviewFonts(["noto-sans"])).rejects.toThrow("Unable to load Noto Sans.");
});

it("refreshes only failed font sources on repeated retries, preserving all font descriptors", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  // jsdom drops font-face descriptors; model the CSSOM that browsers expose.
  const fontRule = (range: string, source: string) => {
    const values = new Map(Object.entries({ "font-family": '"Noto Sans SC Variable"', src: source, "font-style": "normal", "font-weight": "100 900", "font-display": "swap", "unicode-range": range }));
    return { type: CSSRule.FONT_FACE_RULE, style: { getPropertyValue: (name: string) => values.get(name) || "", setProperty: (name: string, value: string) => values.set(name, value) } } as unknown as CSSFontFaceRule;
  };
  const rule = fontRule("U+4E2D", 'url("./chinese.woff2?v=1") format("woff2")');
  const other = fontRule("U+6587", 'url("./other-slice.woff2")');
  vi.spyOn(document, "styleSheets", "get").mockReturnValue([{ href: "https://example.test/fonts/styles.css", cssRules: [rule, other] }] as unknown as StyleSheetList);
  const descriptors = () => ["font-family", "font-style", "font-weight", "font-display", "unicode-range"].map(name => rule.style.getPropertyValue(name));
  const original = descriptors();
  const originalOther = other.style.getPropertyValue("src");
  faces = [{ family: "Noto Sans SC Variable", status: "error", style: "normal", weight: "100 900", unicodeRange: "U+4E2D" } as FontFace];
  load.mockImplementation(async (query: string) => {
    if (query.includes("Noto Sans SC Variable")) throw new DOMException("Still offline", "NetworkError");
    return [{}];
  });
  await expect(loadPreviewFonts(["noto-sans"])).rejects.toThrow("Still offline");
  expect(rule.style.getPropertyValue("src")).toContain("v=1&font-retry=1");
  expect(rule.style.getPropertyValue("src")).toContain("https://example.test/fonts/chinese.woff2");
  load.mockImplementation(async () => { faces = []; return [{}]; });
  await expect(loadPreviewFonts(["noto-sans"])).resolves.toEqual([[{}]]);
  expect(rule.style.getPropertyValue("src")).toContain("v=1&font-retry=2");
  expect(descriptors()).toEqual(original);
  expect(other.style.getPropertyValue("src")).toBe(originalOther);
});

it("keeps system Chinese note fallback independent without letting its cache bypass UI checks", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  await loadPreviewFonts(["noto-sans"], false);
  expect(load).toHaveBeenCalledExactlyOnceWith('400 16px "Noto Sans Variable"', "Aa");
  load.mockImplementation(async (query: string) => {
    if (query.includes("Noto Sans SC Variable")) throw new Error("Chinese font offline");
    return [{}];
  });
  await expect(loadPreviewFonts(["noto-sans"])).rejects.toThrow("Chinese font offline");
});

it("still checks Chinese when a note explicitly chooses Noto Sans SC", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  await loadPreviewFonts(["noto-sans-sc"], false);
  expect(load).toHaveBeenCalledExactlyOnceWith('400 16px "Noto Sans SC Variable"', "中文");
});
