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
  // Model Firefox's readable descriptors, which cannot be changed in place.
  const setProperty = vi.fn(() => { throw new DOMException("Can't set descriptor", "NotSupportedError"); });
  const fontRule = (values: Record<string, string>) => {
    const names = Object.keys(values);
    return { type: CSSRule.FONT_FACE_RULE, style: Object.assign({ length: names.length, getPropertyValue: (name: string) => values[name] || "", setProperty }, names) } as unknown as CSSFontFaceRule;
  };
  const initial = { "font-family": '"Noto Sans SC Variable"', src: 'local("Noto Sans SC"), url("./chinese.woff2?v=1#glyph") format("woff2")', "font-style": "normal", "font-weight": "100 900", "font-display": "swap", "unicode-range": "U+4E2D", "font-stretch": "75% 125%", "font-feature-settings": '"kern"' };
  const before = { type: CSSRule.STYLE_RULE } as CSSRule;
  const other = fontRule({ ...initial, src: 'url("./other-slice.woff2")', "unicode-range": "U+6587" });
  const rules = [before, fontRule(initial), other];
  const insertRule = vi.fn((text: string, index: number) => {
    const values = Object.fromEntries(text.replace(/^@font-face\s*\{|\}$/g, "").split(";").filter(value => value.trim()).map(value => {
      const colon = value.indexOf(":");
      return [value.slice(0, colon).trim(), value.slice(colon + 1).trim()];
    }));
    rules.splice(index, 0, fontRule(values));
    return index;
  });
  const deleteRule = vi.fn((index: number) => { rules.splice(index, 1); });
  vi.spyOn(document, "styleSheets", "get").mockReturnValue([{ href: "https://example.test/fonts/styles.css", cssRules: rules, insertRule, deleteRule }] as unknown as StyleSheetList);
  const rule = () => rules[1] as CSSFontFaceRule;
  const descriptors = () => Object.keys(initial).filter(name => name !== "src").map(name => rule().style.getPropertyValue(name));
  const original = descriptors();
  const originalOther = other.style.getPropertyValue("src");
  faces = [{ family: "Noto Sans SC Variable", status: "error", style: "normal", weight: "100 900", unicodeRange: "U+4E2D" } as FontFace];
  load.mockImplementation(async (query: string) => {
    if (query.includes("Noto Sans SC Variable")) throw new DOMException("Still offline", "NetworkError");
    return [{}];
  });
  await expect(loadPreviewFonts(["noto-sans"])).rejects.toThrow("Still offline");
  expect(rule().style.getPropertyValue("src")).toContain("v=1&font-retry=1#glyph");
  expect(rule().style.getPropertyValue("src")).toContain('local("Noto Sans SC"), url("https://example.test/fonts/chinese.woff2');
  load.mockImplementation(async () => { faces = []; return [{}]; });
  await expect(loadPreviewFonts(["noto-sans"])).resolves.toEqual([[{}]]);
  expect(rule().style.getPropertyValue("src")).toContain("v=1&font-retry=2#glyph");
  expect(descriptors()).toEqual(original);
  expect(other.style.getPropertyValue("src")).toBe(originalOther);
  expect(rules).toHaveLength(3);
  expect(rules[0]).toBe(before);
  expect(rules[2]).toBe(other);
  expect(insertRule.mock.calls.map(([, index]) => index)).toEqual([1, 1]);
  expect(deleteRule.mock.calls).toEqual([[2], [2]]);
  expect(setProperty).not.toHaveBeenCalled();
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

it("loads the Chinese serif fallback for a legacy UI Songti choice while keeping note fallback independent", async () => {
  const { loadPreviewFonts } = await import("./preview-fonts");
  await loadPreviewFonts(["songti"], false);
  expect(load).not.toHaveBeenCalled();
  await loadPreviewFonts(["songti"]);
  expect(load).toHaveBeenCalledExactlyOnceWith('400 16px "Noto Serif SC Variable"', "中文");
});

it("keeps real serif CSS out of the default page and loads it when serif or legacy Songti is selected", async () => {
  const { createServer } = await import("vite");
  const { chromium } = await import("playwright");
  const { fileURLToPath, URL: NodeURL } = await import("node:url");
  const uiRoot = fileURLToPath(new NodeURL("../", import.meta.url));
  const server = await createServer({
    configFile: `${uiRoot}vite.config.ts`, logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false, open: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: "font-selection-probe", configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/__font-selection") return next();
        response.setHeader("Content-Type", "text/html");
        response.end('<script type="module">import "/ui-next/styles.css"; import {loadPreviewFonts} from "/ui-next/preview-fonts.ts"; window.loadFonts=loadPreviewFonts;</script>');
      });
    } }],
  });
  let browser:Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await server.listen();
    const address = server.httpServer!.address();
    if (!address || typeof address === "string") throw new Error("Missing font probe listener");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const requests:string[] = [];
    page.on("request", request => { requests.push(request.url()); });
    await page.goto(`http://127.0.0.1:${address.port}/__font-selection`);
    await page.waitForFunction(() => "loadFonts" in window);
    const families = () => page.evaluate(() => [...document.fonts].map(face => ({family: face.family, style: face.style})));
    expect((await families()).some(face => face.family.includes("Noto Serif"))).toBe(false);
    await page.evaluate(() => (window as unknown as {loadFonts: (fonts:string[], companion?:boolean) => Promise<unknown>}).loadFonts(["noto-sans"]));
    expect(requests.some(url => url.includes("noto-serif"))).toBe(false);
    await page.evaluate(() => (window as unknown as {loadFonts: (fonts:string[]) => Promise<unknown>}).loadFonts(["noto-serif"]));
    const loaded = await families();
    expect(loaded.some(face => face.family.includes("Noto Serif Variable") && face.style === "normal")).toBe(true);
    expect(loaded.some(face => face.family.includes("Noto Serif Variable") && face.style === "italic")).toBe(true);
    expect(loaded.some(face => face.family.includes("Noto Serif SC Variable"))).toBe(true);
    await page.close();

    const legacy = await browser.newPage();
    await legacy.goto(`http://127.0.0.1:${address.port}/__font-selection`);
    await legacy.waitForFunction(() => "loadFonts" in window);
    await legacy.evaluate(() => (window as unknown as {loadFonts: (fonts:string[]) => Promise<unknown>}).loadFonts(["songti"]));
    const fallback = await legacy.evaluate(() => [...document.fonts].map(face => face.family));
    expect(fallback.some(family => family.includes("Noto Serif SC Variable"))).toBe(true);
    expect(fallback.some(family => family.includes("Noto Serif Variable"))).toBe(false);
  } finally { await browser?.close(); await server.close(); }
}, 20_000);
