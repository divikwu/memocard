import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Page } from "playwright";

// Exercise the production cascade, including styles loaded only by search and content views.
export async function verifyTypographyRoles(page: Page) {
  const search = await page.addStyleTag({ path: resolve(process.cwd(), "src/components/note-search-dialog.css") });
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.id = "typography-role-fixture";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.cssText = "position:fixed;left:-10000px;width:720px;--note-size:var(--font-size-base);--note-scale:1;--note-summary-size:var(--font-size-sm);--note-leading:1.6;--note-flow:1em;--note-measure:720px";
    fixture.innerHTML = `<div class="note-page-width"><textarea class="note-page-title">标题</textarea><article data-body class="markdown typeset"><h1>标题</h1><p>正文 <code>code</code></p><p>第二段</p></article><div class="typeset-summary"><article class="markdown typeset"><p>摘要</p><p>第二段</p></article></div><div class="typeset-summary note-card-preview"><article class="markdown typeset"><h1>卡片标题</h1><p><strong>重点</strong></p><p>第二段</p></article></div><h2 class="note-search-preview-title">搜索结果</h2><div class="note-search-preview-content"><article class="markdown typeset"><h1>标题</h1><h2>二级</h2><h3>三级</h3><p>预览</p><p>第二段</p></article></div><button class="type-label">按钮</button><button class="type-label text-xs">小按钮</button><button class="type-label text-base font-semibold">调用方覆盖</button><span class="type-supporting">辅助文字</span><span class="legacy-bold" style="font-weight:var(--font-weight-bold)">兼容强调</span></div>`;
    document.body.append(fixture);
  });
  try {
    for (const changed of [false, true]) {
      if (changed) await page.locator("#typography-role-fixture").evaluate(fixture => {
        const values = { "--note-size": "var(--font-size-lg)", "--note-scale": "1.125", "--note-summary-size": "var(--font-size-base)", "--note-measure": "666px", "--text-label-weight": "600" };
        for (const [name, value] of Object.entries(values)) (fixture as HTMLElement).style.setProperty(name, value);
      });
      // The existing reduced-motion rule still runs a 0.01ms transition. Read settled metrics.
      await page.waitForFunction(changed => {
        const root = document.getElementById("typography-role-fixture")!;
        const body = getComputedStyle(root.querySelector("[data-body]")!);
        const factor = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
        return Math.abs(parseFloat(body.fontSize) - (changed ? 18 : 16) * factor) < .01;
      }, changed);
      const readings = await page.locator("#typography-role-fixture").evaluate(root => {
        const metric = (selector: string) => { const style = getComputedStyle(root.querySelector(selector)!); return [parseFloat(style.fontSize), parseFloat(style.fontWeight), parseFloat(style.lineHeight), parseFloat(style.marginBlockStart)]; };
        return {
          title: metric(".note-page-title"), body: metric("[data-body] p + p"), heading: metric("[data-body] h1"), code: metric("[data-body] code"), card: metric(".note-card-preview p + p"), cardHeading: metric(".note-card-preview h1"), cardStrong: metric(".note-card-preview strong"),
          summary: metric(".typeset-summary:not(.note-card-preview) p + p"), searchTitle: metric(".note-search-preview-title"), search: metric(".note-search-preview-content p + p"),
          searchH1: metric(".note-search-preview-content h1"), searchH2: metric(".note-search-preview-content h2"), searchH3: metric(".note-search-preview-content h3"),
          button: metric("button"), small: metric("button.text-xs"), override: metric("button.text-base"), supporting: metric(".type-supporting"), legacyBold: metric(".legacy-bold"),
          root: parseFloat(getComputedStyle(document.documentElement).fontSize), width: getComputedStyle(root.querySelector(".note-page-width")!).maxWidth,
        };
      });
      const close = (actual: number[], expected: number[]) => expected.forEach((value, i) => assert(Math.abs(actual[i] - value) < .01, `${actual} should match ${expected}`));
      const factor = readings.root / 16;
      const expected = (actual: number[], values: number[]) => close(actual, values.map((value, index) => index === 1 ? value : value * factor));
      expected(readings.title, [32, 600, 40]);
      expected(readings.body, changed ? [18, 400, 28.8, 18] : [16, 400, 25.6, 16]);
      expected(readings.heading, changed ? [27, 600, 36] : [24, 600, 32]);
      expected(readings.code, changed ? [15.75, 400, 22.5] : [14, 400, 20]);
      expected(readings.card, [14, 400, 20, 5.6]);
      for (const actual of [readings.cardHeading, readings.cardStrong]) expected(actual, [14, changed ? 600 : 500, 20]);
      expected(readings.summary, changed ? [16, 400, 25.6, 12] : [14, 400, 22.4, 10.5]);
      expected(readings.searchTitle, [20, 600, 24]);
      expected(readings.search, [14, 400, 20, 11.9]);
      for (const actual of [readings.searchH1, readings.searchH2]) expected(actual, [16, 600, 24]);
      expected(readings.searchH3, [14, 600, 20]);
      expected(readings.button, [14, changed ? 600 : 500, 20]);
      expected(readings.small, [12, changed ? 600 : 500, 20]);
      expected(readings.override, [16, 600, 24]);
      expected(readings.supporting, [12, 400, 20]);
      assert.equal(readings.legacyBold[1], 600);
      assert.equal(readings.width, changed ? "666px" : "720px");
    }
  } finally {
    await page.locator("#typography-role-fixture").evaluate(element => element.remove());
    await search.evaluate(element => element.parentNode!.removeChild(element));
  }
}
