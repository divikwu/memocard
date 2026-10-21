import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrowserCommand } from "vitest/node";

export type DocsFontCase = { id: "components-button" | "component-docs-template"; width: 320 | 390; theme: "light" | "dark"; offline: boolean; font?: "geist" };

// These regressions exercise the real Storybook bootstrap and isolated story
// documents. Run against a local dev server or a served storybook-static build.
export const verifyDocsFont: BrowserCommand<[DocsFontCase], { states: number; subsets: number; fontBytes: number }> = async ({ context, project }, options) => {
  const isolated = await context.browser()!.newContext({ viewport: { width: options.width, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await isolated.newPage();
  const base = (project.getProvidedContext() as { storybookFontTestUrl: string }).storybookFontTestUrl;
  const url = new URL("iframe.html", base);
  url.searchParams.set("id", `${options.id}--docs`);
  url.searchParams.set("viewMode", "docs");
  url.searchParams.set("globals", `theme:${options.theme}${options.font ? `;headingFont:${options.font};bodyFont:${options.font}` : ""}`);
  const requested = new Set<string>();
  const external = new Set<string>();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => {
    if (request.resourceType() !== "font") errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let released = false;
  const artifactDir = resolve(process.env.MEMOCARD_FONT_TEST_ARTIFACTS ?? "../../build/verification/docs-fonts");
  const label = `${options.id}-${options.width}-${options.theme}-${options.offline ? "offline" : options.font ?? "loaded"}`;
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
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    const tabs = page.locator(".component-docs-tab-list");
    await tabs.getByRole("tab", { name: "Overview", exact: true }).waitFor();
    const family = options.font ? "Geist Variable" : "Noto Sans SC Variable";
    await page.waitForFunction(font => getComputedStyle(document.querySelector(".component-docs-tab-list")!).fontFamily.includes(font), family);
    if (!options.font) await page.waitForFunction(() => [...document.fonts].some(face => face.family.includes("Noto Sans SC") && face.status === "loading"));
    // Fonts are deliberately withheld. Text and navigation must already work.
    assert(await page.locator(".sbdocs-title").isVisible());
    assert((await page.locator(".sbdocs-title").boundingBox())!.height > 0);
    const bootFrames = async (name: string) => {
      const panel = page.getByRole("tabpanel", { name, exact: true });
      await panel.waitFor();
      for (const frame of await panel.locator("iframe").all()) {
        await frame.scrollIntoViewIfNeeded();
        // Settle each lazy document before scrolling on; a cold browser can
        // defer an iframe again if it leaves the viewport during bootstrap.
        const id = await frame.getAttribute("id");
        await page.waitForFunction(({ id, font }) => {
          const doc = (document.getElementById(id!) as HTMLIFrameElement).contentDocument;
          return Boolean(doc?.querySelector("#storybook-root")?.childElementCount) && doc?.documentElement.dataset.bodyFont === font;
        }, { id, font: options.font ?? "noto-sans-sc" });
      }
    };
    await tabs.getByRole("tab", { name: "Properties", exact: true }).click();
    if (options.id === "components-button") await page.frameLocator('iframe[title="Properties"]').getByRole("button", { name: "保存", exact: true }).waitFor();
    else await page.getByRole("textbox", { name: "文档标题（name）" }).waitFor();
    // Keep application resources available: only font requests report an
    // offline network error. This does not claim offline installation support.
    await tabs.getByRole("tab", { name: "Accessibility", exact: true }).click();
    await page.getByRole("tabpanel", { name: "Accessibility", exact: true }).waitFor();
    released = true;
    release();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const cdp = await isolated.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    let states = 0;
    for (const tabName of ["Overview", "Properties", "Accessibility"]) {
      await tabs.getByRole("tab", { name: tabName, exact: true }).click();
      const panel = page.getByRole("tabpanel", { name: tabName, exact: true });
      await panel.waitFor();
      await bootFrames(tabName);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll<HTMLIFrameElement>('.component-docs-panel:not([hidden]) iframe')].map(frame => frame.contentDocument!.fonts.ready));
      });
      const metrics = await page.evaluate(() => {
        const list = document.querySelector(".component-docs-tab-list")!;
        const panel = document.querySelector<HTMLElement>('.component-docs-panel:not([hidden])')!;
        return {
          width: document.documentElement.scrollWidth, viewport: window.innerWidth,
          gap: panel.getBoundingClientRect().top - list.getBoundingClientRect().bottom,
          font: getComputedStyle(list).fontFamily,
          size: getComputedStyle(list.querySelector("button")!).fontSize,
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        };
      });
      assert(metrics.width <= metrics.viewport + 1, JSON.stringify(metrics));
      assert.equal(metrics.gap, 40);
      assert.equal(metrics.size, "14px");
      assert.equal(metrics.theme, options.theme);
      assert(metrics.font.includes(family));
      const { root } = await cdp.send("DOM.getDocument", { depth: 1 });
      // Mixed paragraph proves CJK + Latin use the actual downloaded face.
      for (const selector of [".sbdocs-title", ".component-docs-tab-list button", ".component-docs > p"]) {
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
        if (!nodeId) continue;
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        assert(fonts.length > 0, selector);
        if (options.offline) assert(fonts.every(font => !font.isCustomFont), JSON.stringify(fonts));
        else if (options.font) assert(fonts.every(font => !font.familyName.includes("Noto Sans SC") || !font.isCustomFont));
        else assert(fonts.length > 0 && fonts.every(font => font.isCustomFont && font.familyName.includes("Noto Sans SC")), JSON.stringify(fonts));
      }
      if (tabName === "Properties") {
        if (options.id === "components-button") {
          const frame = page.frameLocator('iframe[title="Properties"]');
          await frame.getByRole("button", { name: "保存", exact: true }).click();
          assert.match(await frame.locator("output").innerText(), /1/);
          await frame.getByRole("combobox", { name: "variant", exact: true }).click();
          await frame.getByRole("option", { name: "secondary", exact: true }).click();
          await frame.locator('[data-slot="select-content"]').waitFor({ state: "hidden" });
          await frame.getByRole("button", { name: "切换预览与代码" }).click();
          const source = frame.getByRole("region", { name: "Button 代码", exact: true });
          const code = await source.locator("pre").innerText();
          assert.match(code, /secondary/);
          await source.getByRole("button", { name: "Copy", exact: true }).click();
          assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);
          await frame.getByRole("button", { name: "Reset", exact: true }).click();
          await frame.getByRole("button", { name: "切换预览与代码" }).click();
        } else {
          const input = page.getByRole("textbox", { name: "文档标题（name）" });
          await input.fill("ComponentDocumentationWithAnExtremelyLongUnbrokenEnglishTitle — 中英文标题");
          assert(await page.locator(".sbdocs-title").evaluate(el => el.scrollWidth <= el.clientWidth + 1));
          await page.getByRole("combobox", { name: "name", exact: true }).click();
          await page.getByRole("option", { name: "Button", exact: true }).click();
          await page.locator('[data-slot="select-content"]').waitFor({ state: "hidden" });
          await page.getByRole("button", { name: "切换预览与代码", exact: true }).click();
          const source = page.getByRole("region", { name: "ComponentDocsTemplate 代码", exact: true });
          const code = await source.locator("pre").innerText();
          assert.match(code, /Button/);
          await source.getByRole("button", { name: "Copy", exact: true }).click();
          assert.equal(await page.evaluate(() => navigator.clipboard.readText()), code);
          await page.getByRole("button", { name: "恢复默认标题" }).click();
          await page.getByRole("button", { name: "切换预览与代码", exact: true }).click();
        }
      }
      const frameMetrics = await page.evaluate(() => [...document.querySelectorAll<HTMLIFrameElement>('.component-docs-panel:not([hidden]) iframe')].map(frame => {
        const doc = frame.contentDocument!;
        return { width: doc.documentElement.scrollWidth, viewport: frame.clientWidth, font: frame.contentWindow!.getComputedStyle(doc.body).fontFamily, url: frame.src };
      }));
      for (const m of frameMetrics) {
        assert(m.width <= m.viewport + 1, JSON.stringify(m));
        assert(m.font.includes(family), JSON.stringify(m));
      }
      // Capture the resting page, after controls have finished closing and
      // with locally scrolled parameter tables restored to their first column.
      await page.evaluate(() => {
        for (const doc of [document, ...[...document.querySelectorAll<HTMLIFrameElement>('.component-docs-panel:not([hidden]) iframe')].map(frame => frame.contentDocument!)]) {
          for (const table of doc.querySelectorAll<HTMLElement>(".component-docs-properties-table-wrap")) table.scrollLeft = 0;
        }
      });
      await mkdir(artifactDir, { recursive: true });
      await page.screenshot({ path: resolve(artifactDir, `${label}-${tabName}.png`), fullPage: true });
      states++;
    }
    assert.equal(external.size, 0);
    if (options.font) assert.equal(requested.size, 0, "Saved/explicit Geist choice must not download Noto subsets");
    else {
      const registered = await page.evaluate(() => [...document.fonts].filter(face => face.family.includes("Noto Sans SC")).length);
      assert(requested.size > 1 && requested.size < registered, `Unexpected SC subset count: ${requested.size} / ${registered}`);
    }
    const fontBytes = await page.evaluate(() => performance.getEntriesByType("resource").filter(entry => entry.name.includes("noto-sans-sc-")).reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).encodedBodySize, 0));
    const result = { states, subsets: requested.size, fontBytes };
    await writeFile(resolve(artifactDir, `${label}.json`), JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    released = true;
    release();
    await mkdir(artifactDir, { recursive: true });
    await writeFile(resolve(artifactDir, `${label}-failure.json`), JSON.stringify({ errors, message: String(error) }, null, 2));
    await page.screenshot({ path: resolve(artifactDir, `${label}-failure.png`), timeout: 3000 }).catch(() => undefined);
    throw error;
  } finally {
    if (!released) release();
    await isolated.close();
  }
};
