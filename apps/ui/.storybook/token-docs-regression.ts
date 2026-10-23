import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrowserCommand } from "vitest/node";

export type TokenDocsCase = { id: "domain-tokens" | "theme-definition"; width: 320 | 1024; theme: "light" | "dark" };

export const verifyTokenDocs: BrowserCommand<[TokenDocsCase], void> = async ({ context, project }, options) => {
  const isolated = await context.browser()!.newContext({ viewport: { width: options.width, height: 900 }, reducedMotion: "reduce" });
  const page = await isolated.newPage();
  const base = (project.getProvidedContext() as { storybookFontTestUrl: string }).storybookFontTestUrl;
  const url = new URL("", base);
  url.searchParams.set("path", `/docs/foundations-${options.id}--docs`);
  url.searchParams.set("globals", `theme:${options.theme};palette:mono`);
  const directory = resolve("../../build/verification/astryx-storybook-optimize");
  const label = `${options.id}-${options.width}-${options.theme}`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    const docs = page.frameLocator("#storybook-preview-iframe");
    await docs.getByRole("heading", { name: options.id.replaceAll("-", " "), exact: true }).waitFor();
    const primary = docs.frameLocator('iframe[title="Default"]');
    const dark = docs.frameLocator('iframe[title="Dark"]');
    const sample = options.id === "domain-tokens" ? "[data-data-role]" : '[data-testid="themed-action"]';
    for (const preview of [primary, dark]) {
      await preview.locator(sample).first().waitFor({ state: "visible" });
      await preview.locator("html").evaluate(element => element.ownerDocument.fonts.ready.then(() => undefined));
    }
    // A fixed Dark story must not turn the Docs document or Default story dark.
    assert.equal(await docs.locator("html").getAttribute("class"), options.theme, "Docs follows the toolbar after both previews load");
    assert.equal(await primary.locator("html").getAttribute("class"), options.theme, "Default follows the toolbar");
    assert.equal(await dark.locator("html").getAttribute("class"), "dark", "Dark keeps its explicit story override");
    assert.equal(await docs.locator("html").getAttribute("data-memocard-theme"), null, "Theme styles stay in their preview documents");

    for (const title of ["Default", "Dark"]) {
      const frame = docs.locator(`iframe[title="${title}"]`);
      await frame.scrollIntoViewIfNeeded();
      const preview = docs.frameLocator(`iframe[title="${title}"]`);
      const height = await frame.evaluate(element => element.clientHeight);
      const content = await preview.locator("html").evaluate(element => ({ height: element.scrollHeight, width: element.scrollWidth, viewport: element.clientWidth }));
      assert(content.height <= height + 1, `${title} content fits without an inner vertical scroll: ${content.height} / ${height}`);
      assert(content.width <= content.viewport + 1, `${title} stays within the preview width`);
    }

    for (const mode of [options.theme === "light" ? "dark" : "light", options.theme]) {
      await page.getByRole("button", { name: /产品明暗主题/ }).click();
      await page.locator(`[id$="-opt-${mode}"]`).click();
      await page.waitForFunction(mode => {
        const doc = document.querySelector<HTMLIFrameElement>("#storybook-preview-iframe")?.contentDocument;
        const preview = doc?.querySelector<HTMLIFrameElement>('iframe[title="Default"]')?.contentDocument;
        const fixed = doc?.querySelector<HTMLIFrameElement>('iframe[title="Dark"]')?.contentDocument;
        return doc?.documentElement?.className === mode && preview?.documentElement?.className === mode && fixed?.documentElement?.className === "dark";
      }, mode);
    }

    await docs.getByRole("switch", { name: "Show code", exact: true }).first().click();
    await docs.locator("pre").filter({ hasText: "export function" }).last().waitFor({ state: "visible" });
    const usage = (await docs.locator("pre").allTextContents()).join("\n");
    if (options.id === "domain-tokens") {
      assert(usage.includes('domains/data.css') && usage.includes('domains/syntax.css'), "CSS imports are copyable in Docs");
      assert(usage.includes('fill-data-categorical-blue') && usage.includes('text-syntax-keyword'), "Examples use the public Tailwind roles");
      assert.equal(await docs.getByRole("heading", { name: "按需加载", exact: true }).count(), 1);
    } else {
      assert(usage.includes('defineTheme') && usage.includes('extends: base') && usage.includes('ThemeProvider'), "The full inheritance and application example is copyable");
      assert.equal(await docs.getByRole("heading", { name: "语义类名对照", exact: true }).count(), 1);
      await primary.getByRole("button", { name: "预编译 CSS", exact: true }).click();
      assert.equal(await primary.locator("html").getAttribute("data-memocard-theme"), "ocean");
      await primary.getByRole("button", { name: "原有主题", exact: true }).click();
      assert.equal(await primary.locator("html").getAttribute("data-memocard-theme"), null);
      assert.equal(await docs.locator("html").getAttribute("data-memocard-theme"), null);
      assert.equal(await dark.locator("html").getAttribute("data-memocard-theme"), "ocean");
    }
    assert.equal(await docs.locator("body").evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, "Docs has no page-level horizontal overflow");
    assert.deepEqual(errors, []);
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${label}.png`), fullPage: true });
  } catch (error) {
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `${label}-failure.png`), fullPage: true });
    await writeFile(resolve(directory, `${label}-failure.txt`), String(error));
    throw error;
  } finally { await isolated.close(); }
};
