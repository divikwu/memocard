import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrowserCommand } from "vitest/node";
import type { DocsFontCase } from "./docs-font-regression.ts";

export type ComponentFontCase = Omit<DocsFontCase, "id"> & { id: string; story: string };

// Exercise standard Docs, its isolated primary preview, and a standalone story.
export const verifyComponentFont: BrowserCommand<[ComponentFontCase], { states: number; subsets: number }> = async ({ context, project }, options) => {
  const isolated = await context.browser()!.newContext({ viewport: { width: options.width, height: 844 } });
  const page = await isolated.newPage();
  const base = (project.getProvidedContext() as { storybookFontTestUrl: string }).storybookFontTestUrl;
  const requested = new Set<string>();
  const external = new Set<string>();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => {
    if (request.resourceType() !== "font") errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const dir = resolve(process.env.MEMOCARD_FONT_TEST_ARTIFACTS ?? "../../build/verification/docs-fonts");
  const label = `${options.id}-${options.width}-${options.theme}-${options.font ?? (options.offline ? "offline" : "loaded")}`;
  const family = options.font ? "Geist Variable" : "Noto Sans SC Variable";
  const settleFonts = async (id: string | null = null) => {
    // A story can render before its dynamic font CSS registers FontFace entries.
    await page.waitForFunction(({ id, family }) => {
      const doc = id ? (document.getElementById(id) as HTMLIFrameElement).contentDocument! : document;
      return [...doc.fonts].some(face => face.family.includes(family));
    }, { id, family });
    await page.evaluate(id => (id ? (document.getElementById(id) as HTMLIFrameElement).contentDocument! : document).fonts.ready.then(() => undefined), id);
  };
  const url = (mode: "docs" | "story") => {
    const target = new URL("iframe.html", base);
    target.searchParams.set("id", `${options.id}--${mode === "docs" ? "docs" : options.story}`);
    target.searchParams.set("viewMode", mode);
    target.searchParams.set("embed", "true");
    target.searchParams.set("globals", `theme:${options.theme}${options.font ? `;headingFont:${options.font};bodyFont:${options.font}` : ""}`);
    return target.href;
  };
  try {
    await isolated.route(/noto-sans-sc-.*\.woff2(?:\?|$)/, async route => {
      requested.add(route.request().url());
      await gate;
      if (options.offline) await route.abort("internetdisconnected");
      else await route.continue();
    });
    page.on("request", request => {
      if (request.resourceType() === "font" && new URL(request.url()).origin !== new URL(base).origin) external.add(request.url());
    });
    await page.goto(url("docs"), { waitUntil: "domcontentloaded" });
    await page.locator(".sbdocs-title").waitFor();
    const primary = page.locator(".sbdocs-content iframe").first();
    await primary.scrollIntoViewIfNeeded();
    const previewId = await primary.getAttribute("id");
    await page.waitForFunction(({ id, font }) => {
      const doc = (document.getElementById(id!) as HTMLIFrameElement).contentDocument;
      return doc?.documentElement.dataset.bodyFont === font && Boolean(doc.querySelector("#storybook-root")?.childElementCount);
    }, { id: previewId, font: options.font ?? "noto-sans-sc" });
    if (!options.font) await page.waitForFunction(() => [...document.fonts].some(face => face.family.includes("Noto Sans SC") && face.status === "loading"));
    // Text and the embedded example must render before any Noto request settles.
    assert(await page.frameLocator(`iframe[id="${previewId}"]`).locator("#storybook-root").isVisible());
    release();
    await settleFonts();
    await settleFonts(previewId);
    const embeddedMetrics = await page.evaluate(id => {
      const frame = document.getElementById(id!) as HTMLIFrameElement;
      const doc = frame.contentDocument!;
      return { width: doc.documentElement.scrollWidth, viewport: frame.clientWidth, dark: doc.documentElement.classList.contains("dark") };
    }, previewId);
    assert(embeddedMetrics.width <= embeddedMetrics.viewport + 1, `Embedded: ${JSON.stringify(embeddedMetrics)}`);
    assert.equal(embeddedMetrics.dark, options.theme === "dark");
    const cdp = await isolated.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const glyphs = async (nodeId: number, selector: string) => {
      const node = await cdp.send("DOM.querySelector", { nodeId, selector });
      assert(node.nodeId, selector);
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: node.nodeId });
      assert(fonts.length > 0, selector);
      if (options.offline) assert(fonts.every(font => !font.isCustomFont), JSON.stringify(fonts));
      else if (options.font) assert(fonts.every(font => !font.familyName.includes("Noto Sans SC") || !font.isCustomFont));
      else assert(fonts.every(font => font.isCustomFont && font.familyName.includes("Noto Sans SC")), `${selector}: ${JSON.stringify(fonts)}`);
    };
    const checkPage = async () => {
      const metrics = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth, viewport: window.innerWidth,
        font: getComputedStyle(document.body).fontFamily,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      }));
      assert(metrics.width <= metrics.viewport + 1, JSON.stringify(metrics));
      assert(metrics.font.includes(family), JSON.stringify(metrics));
      assert.equal(metrics.theme, options.theme);
    };
    await checkPage();
    let { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
    await glyphs(root.nodeId, ".sbdocs-title");
    await glyphs(root.nodeId, ".sbdocs-content p");
    if ((await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".docblock-argstable th" })).nodeId) await glyphs(root.nodeId, ".docblock-argstable th");
    for (const code of await page.locator(".sbdocs-content pre").all()) assert(!(await code.evaluate(el => getComputedStyle(el).fontFamily)).includes("Noto Sans SC"));
    // Query the embedded document through its frame owner rather than assuming
    // computed font-family proves that downloaded glyphs are actually used.
    const findFrame = (node: typeof root): typeof root | undefined => node.nodeName === "IFRAME" && node.contentDocument
      ? node.contentDocument : node.children?.map(findFrame).find(Boolean);
    const embedded = findFrame(root);
    assert(embedded);
    await glyphs(embedded.nodeId, '#storybook-root label, #storybook-root button:not([role="switch"]), #storybook-root output');
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: resolve(dir, `${label}-Docs.png`), fullPage: true });
    await page.goto(url("story"), { waitUntil: "domcontentloaded" });
    await page.waitForFunction(font => document.documentElement.dataset.bodyFont === font && Boolean(document.querySelector("#storybook-root")?.childElementCount), options.font ?? "noto-sans-sc");
    await settleFonts();
    await checkPage();
    ({ root } = await cdp.send("DOM.getDocument", { depth: 1 }));
    await glyphs(root.nodeId, '#storybook-root label, #storybook-root button:not([role="switch"]), #storybook-root output');
    await page.screenshot({ path: resolve(dir, `${label}-Story.png`), fullPage: true });
    assert.equal(external.size, 0);
    if (options.font) assert.equal(requested.size, 0);
    else assert(requested.size > 0 && requested.size < 101, `Unexpected subset count: ${requested.size}`);
    const result = { states: 3, subsets: requested.size };
    await writeFile(resolve(dir, `${label}.json`), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    release();
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, `${label}-failure.json`), JSON.stringify({ errors, message: String(error) }, null, 2));
    await page.screenshot({ path: resolve(dir, `${label}-failure.png`), timeout: 3000 }).catch(() => undefined);
    throw error;
  } finally {
    release();
    await isolated.close();
  }
};
