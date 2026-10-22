import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrowserCommand } from "vitest/node";
import type { Locator } from "playwright";
import catalog from "../../../design/token-coverage.generated.json" with { type: "json" };
import iconCatalog from "../../../design/icon-usage.generated.json" with { type: "json" };
import spacingCatalog from "../../../design/spacing-usage.generated.json" with { type: "json" };
import typographyCatalog from "../../../design/typography-usage.generated.json" with { type: "json" };
import { verifyTypographyRoles } from "./typography-role-regression.ts";
import { FONT_FAMILIES, FONT_VALUES } from "../src/lib/font-options.ts";

export type FoundationReferenceCase = { width: 320 | 390 | 1368; theme: "light" | "dark"; palette: "mono" | "blue" };

async function auditDocument(root: Locator) {
  const reading = await root.evaluate(element => {
    const headings = [...element.querySelectorAll("h1, h2, h3")].map(heading => heading.textContent!.trim());
    const ids = [...element.querySelectorAll("[id]")].map(node => node.id);
    const sections = [...element.querySelectorAll(".foundation-body > section[id]")];
    const links = [...element.querySelectorAll<HTMLAnchorElement>('.foundation-toc a, h2 a')];
    const names = [...element.querySelectorAll("[data-token-kind][data-token-name]")].map(node => node.getAttribute("data-token-name"));
    const tableStyles = [...element.querySelectorAll("table")].map(table => {
      const header = getComputedStyle(table.querySelector("thead th")!);
      const cell = getComputedStyle(table.querySelector("tbody th, tbody td")!);
      return { font: header.fontFamily, size: header.fontSize, padding: cell.padding, alignment: cell.verticalAlign, lineHeight: cell.lineHeight };
    });
    const header = getComputedStyle(element.querySelector(".foundation-header")!);
    const h1 = getComputedStyle(element.querySelector("h1")!);
    return {
      headings, ids, names,
      mainHeadings: element.querySelectorAll("h1").length,
      linksValid: links.every(link => link.target === "_self" && element.querySelector(link.hash)),
      sectionsValid: sections.every(section => section.getAttribute("aria-labelledby") === section.querySelector("h2")?.id),
      sectionCount: sections.length,
      tocCount: element.querySelectorAll(".foundation-toc a").length,
      tableLabels: [...element.querySelectorAll("table")].map(table => table.getAttribute("aria-label")),
      tableStyles,
      headerStyle: { font: h1.fontFamily, size: h1.fontSize, weight: h1.fontWeight, margin: header.marginBottom, padding: header.paddingBottom },
      nestedTables: element.querySelectorAll("tbody tbody, table table").length,
      tableFits: [...element.querySelectorAll(".foundation-table-wrap")].every(table => table.scrollWidth <= table.clientWidth + 1),
    };
  });
  assert.equal(reading.mainHeadings, 1);
  assert.equal(new Set(reading.headings).size, reading.headings.length, "Page and section headings must not repeat");
  assert.equal(new Set(reading.ids).size, reading.ids.length, "Section IDs must be unique");
  assert.equal(new Set(reading.names).size, reading.names.length, "Each definition appears once per page");
  assert(reading.linksValid && reading.sectionsValid, "Every local link and section label resolves within this document");
  assert.equal(reading.tocCount, reading.sectionCount);
  assert(reading.tableLabels.every(Boolean));
  assert.equal(new Set(reading.tableLabels).size, reading.tableLabels.length);
  for (const style of reading.tableStyles) assert.deepEqual(style, reading.tableStyles[0], "Table typography, padding and alignment share one layout");
  assert.equal(reading.nestedTables, 0);
  assert(reading.tableFits, "Table contents must fit their containers");
  assert.equal(await root.getByText("读取中…", { exact: true }).count(), 0);
  return reading.headerStyle;
}

export const verifyFoundationReference: BrowserCommand<[FoundationReferenceCase], { definitions: number; sections: number }> = async ({ context, project }, options) => {
  const isolated = await context.browser()!.newContext({ viewport: { width: options.width, height: 960 }, reducedMotion: "reduce" });
  const page = await isolated.newPage();
  const base = (project.getProvidedContext() as { storybookFontTestUrl: string }).storybookFontTestUrl;
  const url = new URL("iframe.html", base);
  url.searchParams.set("id", "foundations-tokens--docs");
  url.searchParams.set("viewMode", "docs");
  url.searchParams.set("globals", `theme:${options.theme};palette:${options.palette}`);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => { if (["script", "stylesheet"].includes(request.resourceType()) && request.failure()?.errorText !== "net::ERR_ABORTED") errors.push(`${request.url()}: ${request.failure()?.errorText}`); });
  const directory = resolve("../../build/verification/foundation-reference");
  const definitions = catalog.css.filter(token => token.layer !== "adapter");
  try {
    await page.goto(url.href, { waitUntil: "domcontentloaded" });
    const root = page.locator('.foundation-document[data-foundation-page="all"]');
    await root.locator("h1").waitFor();
    await page.waitForFunction(() => document.querySelector(".foundation-document")?.getAttribute("aria-busy") === "false");
    const headerStyle = await auditDocument(root);
    for (const [kind, expected] of [["css", definitions.length], ["runtime", 0], ["portable", catalog.portable.length], ["contract", 0], ["external", 0]] as const) {
      assert.equal(await root.locator(`[data-token-kind="${kind}"]`).count(), expected, kind);
    }
    assert.deepEqual(await root.locator('[data-token-kind="css"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name")).sort()), definitions.map(token => token.name).sort());
    assert.deepEqual(await root.locator('[data-token-kind="portable"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name")).sort()), catalog.portable.map(token => token.name).sort());
    assert.equal(await root.locator('.foundation-control-preview, .foundation-type-preview, .foundation-focus-preview, .foundation-example-link, #foundation-adapters, #foundation-usage, #foundation-motion, #foundation-responsive').count(), 0);
    await page.waitForFunction(mode => document.querySelector(".foundation-document")?.getAttribute("data-token-mode") === mode, options.theme);
    assert.equal(await root.locator("[data-color-mode]").count(), definitions.filter(token => token.type === "color").length);
    assert.equal(await root.locator(`[data-color-mode="${options.theme === "light" ? "dark" : "light"}"]`).count(), 0);
    assert.equal(await root.locator(`[data-token-name="--background"] [data-color-mode="${options.theme}"] code`).innerText(), options.theme === "light" ? "#ffffff" : "#0a0a0a");
    const current = await page.evaluate(({ mode, palette }) => {
      const root = document.documentElement;
      const swatch = document.createElement("span");
      swatch.style.color = "var(--primary)";
      document.body.append(swatch);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(swatch).color;
      context.fillRect(0, 0, 1, 1);
      const rgba = [...context.getImageData(0, 0, 1, 1).data];
      swatch.remove();
      const expected = `#${rgba.slice(0, rgba[3] === 255 ? 3 : 4).map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
      return { expected, rootUnchanged: root.classList.contains(mode) && root.dataset.palette === palette };
    }, { mode: options.theme, palette: options.palette });
    assert(current.rootUnchanged, "The sampler must not mutate the Docs theme");
    assert.equal(await root.locator(`[data-token-kind="css"][data-token-name="--primary"] [data-color-mode="${options.theme}"] code`).innerText(), current.expected);
    const shadow = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--overlay-shadow").trim());
    assert.equal(await root.locator('[data-token-name="--overlay-shadow"] td code').innerText(), shadow);
    assert.equal(await root.locator("details, summary").count(), 0);
    assert.equal(await root.getByText("读取中…", { exact: true }).count(), 0);
    for (const selector of [".foundation-table-wrap", ".foundation-swatch"]) {
      assert.equal(await root.locator(selector).first().evaluate(element => getComputedStyle(element).borderTopLeftRadius), "10px");
    }
    const toc = root.getByRole("navigation", { name: "本页内容" });
    await toc.getByRole("link", { name: "Spacing tokens", exact: true }).click();
    await page.waitForFunction(() => location.hash === "#foundation-spacing" && Math.abs(document.getElementById("foundation-spacing")!.getBoundingClientRect().top - 32) < 2);
    assert.equal(await toc.getByRole("link", { name: "Spacing tokens", exact: true }).getAttribute("aria-current"), "location");
    await page.waitForFunction(() => {
      const root = document.querySelector(".foundation-document")!;
      return root.scrollWidth <= root.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1;
    });
    const measurements = await page.evaluate(() => ({ width: innerWidth, toc: getComputedStyle(document.querySelector(".foundation-toc")!).position }));
    assert.equal(measurements.toc, options.width >= 800 ? "sticky" : "static");
    const sections = await root.locator(".foundation-body > section").count();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `spacing-${options.width}-${options.theme}.png`) });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(() => document.querySelector('.foundation-toc a[href="#foundation-colors"]')?.getAttribute("aria-current") === "location");
    await page.screenshot({ path: resolve(directory, `all-tokens-${options.width}-${options.theme}.png`) });
    // Category navigation uses Storybook's real manager, rather than a replacement navigation shell.
    if (options.width === 1368 && options.theme === "light") {
      await page.goto(new URL("?path=/docs/foundations-tokens--docs", base).href);
      const frame = page.frameLocator("#storybook-preview-iframe");
      await frame.getByRole("heading", { name: "All tokens", exact: true }).waitFor();
      await frame.locator('.foundation-document[aria-busy="false"]').waitFor();
      assert(await page.locator("#foundations-tokens--docs").isVisible());
      const index = await (await page.request.get(new URL("index.json", base).href)).json();
      for (const name of ["default", "dark"]) {
        const id = `internal-callout-colors--${name}`;
        assert(index.entries[id].tags.includes("test"), `${id} tests production callouts`);
        assert(!index.entries[id].tags.includes("dev"), `${id} stays hidden`);
      }
      assert.equal(index.entries["internal-callout-colors--docs"], undefined);
      for (const name of ["default", "dark", "mobile"]) {
        const id = `foundations-tokens--${name}`;
        assert(index.entries[id].tags.includes("test"), `${id} remains tested`);
        assert(!index.entries[id].tags.includes("dev"), `${id} is hidden from navigation`);
        assert.equal(await page.locator(`#${id}`).count(), 0);
      }
      assert(index.entries["foundations-tokens--live-palette"].tags.includes("test"));
      assert(!index.entries["foundations-tokens--live-palette"].tags.includes("dev"));
      assert.equal(await page.locator("#foundations-tokens--live-palette").count(), 0);
      assert.equal(index.entries["foundations-colors--default"].name, "Diagnostics");
      assert(!index.entries["foundations-colors--default"].tags.includes("dev"));
      assert(index.entries["foundations-colors--default"].tags.includes("test"));
      for (const name of ["dark", "blue-slate", "dark-teal", "mobile", "live-palette"]) {
        const id = `foundations-colors--${name}`;
        assert(index.entries[id].tags.includes("test"), `${id} retains its ID and test`);
        assert(!index.entries[id].tags.includes("dev"), `${id} is hidden from navigation`);
      }
      assert.equal(index.entries["foundations-effects--default"].name, "Diagnostics");
      for (const name of ["default", "dark", "reduced-motion", "regression"]) {
        const id = `foundations-effects--${name}`;
        assert(index.entries[id].tags.includes("test"), `${id} retains its ID and test`);
        assert(!index.entries[id].tags.includes("dev"), `${id} stays hidden`);
      }
      assert(index.entries["foundations-icons--reference"].tags.includes("test"));
      assert(!index.entries["foundations-icons--reference"].tags.includes("dev"));
      assert(index.entries["foundations-shape--reference"].tags.includes("test"));
      assert(!index.entries["foundations-shape--reference"].tags.includes("dev"));
      for (const id of ["foundations-spacing--reference", "foundations-sizing--reference", "foundations-typography--default", "foundations-typography--compact-boundary", "foundations-typography--spacious-boundary", "foundations-typography--mobile-responsive"]) {
        assert(index.entries[id].tags.includes("test"), `${id} retains its ID and tests`);
        assert(!index.entries[id].tags.includes("dev"), `${id} stays hidden`);
      }
      assert(index.entries["foundations-typography--mobile-responsive"].tags.includes("mobile"));
      for (const id of ["components-sheet--interaction"]) {
        assert(index.entries[id].tags.includes("dev"), `${id} owns the visible check`);
        assert(index.entries[id].tags.includes("test"), `${id} retains its interaction assertions`);
      }
      for (const name of ["reference", "reduced-motion"]) {
        const id = `foundations-motion--${name}`;
        assert(index.entries[id].tags.includes("test"), `${id} remains tested`);
        assert(!index.entries[id].tags.includes("dev"), `${id} stays hidden`);
      }
      await page.screenshot({ path: resolve(directory, "storybook-foundations.png") });
      const managerURL = page.url();
      const navigation = page.waitForEvent("framenavigated");
      await frame.getByRole("navigation", { name: "本页内容" }).getByRole("link", { name: "Spacing tokens", exact: true }).click();
      assert.notEqual(await navigation, page.mainFrame(), "A section link must not navigate the Storybook manager");
      assert.equal(page.url(), managerURL);
      await page.waitForFunction(() => {
        const preview = (document.querySelector("#storybook-preview-iframe") as HTMLIFrameElement).contentWindow!;
        return preview.location.hash === "#foundation-spacing" && Math.abs(preview.document.getElementById("foundation-spacing")!.getBoundingClientRect().top - 32) < 2
          && preview.document.querySelector('.foundation-toc a[href="#foundation-spacing"]')?.getAttribute("aria-current") === "location";
      });
      await page.screenshot({ path: resolve(directory, "manager-section-navigation.png") });
      const headingNavigation = page.waitForEvent("framenavigated");
      await frame.getByRole("heading", { name: "Color tokens", exact: true }).getByRole("link").click();
      assert.notEqual(await headingNavigation, page.mainFrame(), "A heading link must remain in the preview");
      assert.equal(page.url(), managerURL);
      for (const mode of ["dark", "light"] as const) {
        await page.getByRole("button", { name: /产品明暗主题/ }).click();
        await page.locator(`[id$="-opt-${mode}"]`).click();
        await frame.locator(`.foundation-document[data-token-mode="${mode}"][aria-busy="false"]`).waitFor();
        const background = frame.locator('[data-token-name="--background"] [data-color-mode]');
        assert.equal(await background.count(), 1);
        assert.equal(await background.getAttribute("data-color-mode"), mode);
        assert.equal(await background.locator("code").innerText(), mode === "light" ? "#ffffff" : "#0a0a0a");
        assert.equal(await frame.locator('iframe[title="Token value resolver"]').count(), 1);
        await page.screenshot({ path: resolve(directory, `toolbar-${mode}.png`) });
      }
      for (const token of catalog.portable.filter(token => token.name.startsWith("radius."))) {
        const choice = token.name.split(".")[1];
        await page.getByRole("button", { name: /圆角设置/ }).click();
        await page.locator(`[id$="-opt-${choice}"]`).click();
        await page.waitForFunction(choice => (document.querySelector("#storybook-preview-iframe") as HTMLIFrameElement).contentDocument!.documentElement.dataset.radius === choice, choice);
        await page.waitForFunction(value => (document.querySelector("#storybook-preview-iframe") as HTMLIFrameElement).contentDocument!.querySelector('[data-token-name="--radius-lg"] td > code:first-child')?.textContent === value, token.value);
        for (const selector of [".foundation-table-wrap", ".foundation-swatch"]) {
          assert.equal(await frame.locator(selector).first().evaluate(element => getComputedStyle(element).borderTopLeftRadius), token.value, `${selector} follows ${choice}`);
        }
        assert.equal(await frame.locator('[data-token-name="radius.md"] .foundation-radius-preview').evaluate(element => getComputedStyle(element).borderTopLeftRadius), "8px", "Fixed baselines retain their own radius");
        if (choice === "none" || choice === "2xl") await page.screenshot({ path: resolve(directory, `radius-${choice}.png`) });
      }
      await page.getByRole("button", { name: /圆角设置/ }).click();
      await page.locator('[id$="-opt-lg"]').click();
      await page.locator("#foundations-colors--docs").waitFor();
      assert.equal(await page.locator('#storybook-explorer-tree a[id^="foundations-colors--"]').count(), 1);
      assert.equal(await page.locator("#foundations-colors--default").count(), 0);
      for (const name of ["dark", "blue-slate", "dark-teal", "mobile", "live-palette"]) {
        assert.equal(await page.locator(`#foundations-colors--${name}`).count(), 0);
      }
      for (const name of ["state-regression", "state-regression-dark", "state-regression-blue-slate", "state-regression-dark-teal", "state-regression-mobile"]) {
        const id = `foundations-colors--${name}`;
        assert(index.entries[id].tags.includes("test"), `${id} remains tested`);
        assert(!index.entries[id].tags.includes("dev"), `${id} is hidden from navigation`);
        assert.equal(await page.locator(`#${id}`).count(), 0);
      }
      await page.locator("#foundations-colors--docs").click();
      await frame.locator('.foundation-document[data-foundation-page="colors"][aria-busy="false"]').waitFor();
      await page.screenshot({ path: resolve(directory, "sidebar-foundations.png") });
      await page.goto(new URL("?path=/story/foundations-colors--default", base).href);
      await frame.locator('.foundation-color-diagnostics[aria-busy="false"]').waitFor();
      assert.equal(await frame.locator('tbody tr[data-pair-id]').count(), 22);
      assert.equal(await page.locator("#foundations-colors--default").count(), 0, "Direct diagnostics routes remain hidden from navigation");
      await page.screenshot({ path: resolve(directory, "diagnostics-manager.png") });
      await page.locator("#foundations-effects--docs").waitFor();
      assert.equal(await page.locator('#storybook-explorer-tree a[id^="foundations-effects--"]').count(), 1);
      for (const name of ["default", "dark", "reduced-motion", "regression"]) assert.equal(await page.locator(`#foundations-effects--${name}`).count(), 0);
      await page.locator("#foundations-effects--docs").click();
      await frame.locator('.foundation-document[data-foundation-page="elevation"][aria-busy="false"]').waitFor();
      await page.screenshot({ path: resolve(directory, "elevation-sidebar.png") });
      await page.locator("#foundations-icons--docs").click();
      await frame.locator('.foundation-document[data-foundation-page="icons"]').waitFor();
      assert.equal(await page.locator('#storybook-explorer-tree a[id^="foundations-icons--"]').count(), 1);
      assert.equal(await page.locator("#foundations-icons--reference").count(), 0);
      await page.screenshot({ path: resolve(directory, "icons-sidebar.png") });
      await page.locator("#foundations-motion--docs").click();
      await frame.locator('.foundation-document[data-foundation-page="motion"][aria-busy="false"]').waitFor();
      assert.equal(await page.locator('#storybook-explorer-tree a[id^="foundations-motion--"]').count(), 1);
      for (const name of ["reference", "reduced-motion"]) assert.equal(await page.locator(`#foundations-motion--${name}`).count(), 0);
      await page.screenshot({ path: resolve(directory, "motion-sidebar.png") });
      await page.locator("#foundations-shape--docs").click();
      await frame.locator('.foundation-document[data-foundation-page="shape"][aria-busy="false"]').waitFor();
      assert.equal(await page.locator('#storybook-explorer-tree a[id^="foundations-shape--"]').count(), 1);
      assert.equal(await page.locator("#foundations-shape--reference").count(), 0);
      for (const token of catalog.portable.filter(token => token.name.startsWith("radius."))) {
        const choice = token.name.split(".")[1];
        await page.getByRole("button", { name: /圆角设置/ }).click();
        await page.locator(`[id$="-opt-${choice}"]`).click();
        await page.waitForFunction(value => (document.querySelector("#storybook-preview-iframe") as HTMLIFrameElement).contentDocument!.querySelector('[data-token-name="--radius-lg"] td > code:first-child')?.textContent === value, token.value);
        assert.equal(await frame.locator('[data-token-name="radius.md"] td code').innerText(), "8px / pt");
        assert.equal(await frame.locator('[data-token-name="radius.md"] .foundation-radius-preview').evaluate(element => getComputedStyle(element).borderTopLeftRadius), "8px");
        const baseline = parseFloat(token.value);
        const expected: Record<string, number> = { sm: Math.max(0, baseline - 4), md: Math.max(0, baseline - 2), lg: baseline, xl: baseline + 4, "2xl": baseline * 1.8, "3xl": baseline * 2.2, "4xl": baseline * 2.6 };
        await page.waitForFunction(expected => {
          const preview = (document.querySelector("#storybook-preview-iframe") as HTMLIFrameElement).contentDocument!;
          return Object.entries(expected).every(([level, value]) => {
            const element = preview.querySelector(`[data-token-name="--radius-${level}"] .foundation-radius-preview`)!;
            return Math.abs(parseFloat(preview.defaultView!.getComputedStyle(element).borderTopLeftRadius) - value) < 0.001;
          });
        }, expected);
        for (const [level, value] of Object.entries(expected)) {
          const row = frame.locator(`[data-token-name="--radius-${level}"]`);
          assert(Math.abs(parseFloat(await row.locator("td > code:first-child").innerText()) - value) < 0.001, `${choice} retains the original ${level} formula`);
          assert(Math.abs(parseFloat(await row.locator(".foundation-radius-preview").evaluate(element => getComputedStyle(element).borderTopLeftRadius)) - value) < 0.001);
        }
      }
      await page.screenshot({ path: resolve(directory, "shape-sidebar.png") });
      for (const category of ["spacing", "typography"]) {
        await page.locator(`#foundations-${category}--docs`).click();
        await frame.locator(`.foundation-document[data-foundation-page="${category}"][aria-busy="false"]`).waitFor();
        assert.equal(await page.locator(`#storybook-explorer-tree a[id^="foundations-${category}--"]`).count(), 1);
        await page.screenshot({ path: resolve(directory, `${category}-sidebar.png`) });
      }
      assert.equal(await page.locator('#storybook-explorer-tree [id="foundations-sizing"], #storybook-explorer-tree [id^="foundations-sizing--"]').count(), 0, "Sizing is hidden from the sidebar");
      await page.goto(new URL("?path=/docs/foundations-sizing--docs", base).href);
      await frame.locator('.foundation-document[data-foundation-page="sizing"][aria-busy="false"]').waitFor();
      assert.equal(await page.locator('#storybook-explorer-tree [id="foundations-sizing"], #storybook-explorer-tree [id^="foundations-sizing--"]').count(), 0, "The preserved direct route does not restore the sidebar entry");
      for (const [id, text] of [
        ["components-button--docs", "文字与图标按钮分别展示四种尺寸"],
        ["components-input--docs", "InputGroup 组合默认为"],
        ["components-textarea--docs", "最小高度为 min-h-16"],
        ["components-select--docs", "default 使用 h-9、sm 使用 h-8"],
        ["components-tabs--docs", "横向 default 列表使用 h-9、line 使用 h-8"],
        ["sidebar-full-sidebar--docs", "移动展开控件的视觉框 40px、命中区 44px"],
      ]) {
        await page.goto(new URL(`iframe.html?id=${id}&viewMode=docs`, base).href);
        await page.waitForFunction(expected => document.querySelector(".sbdocs-content")?.textContent?.includes(expected), text);
      }
      for (const [category, selector] of [["sizing", 'table[aria-label="Web control dimensions"]'], ["typography", ".foundation-type-preview"], ["effects", 'table[aria-label="Tailwind shadow scale"]'], ["motion", 'table[aria-label="Motion reference"]']] as const) {
        await page.goto(new URL(`iframe.html?id=foundations-${category}--docs&viewMode=docs`, base).href);
        await page.locator('.foundation-document[aria-busy="false"]').waitFor();
        assert(await page.locator(selector).isVisible(), `${category} keeps its content`);
        assert.equal(await page.locator('[data-token-kind="contract"], [data-token-kind="runtime"], [data-token-kind="external"], #foundation-adapters').count(), 0);
      }
      for (const category of ["spacing", "sizing"]) {
        await page.goto(new URL(`iframe.html?id=foundations-${category}--reference&viewMode=story&embed=true`, base).href);
        await page.locator(`.foundation-document[data-foundation-page="${category}"][aria-busy="false"]`).waitFor();
        assert.equal(await page.locator('[data-token-kind="portable"]').count(), catalog.portable.filter(token => token.category === category).length);
      }
    }
    for (const category of ["colors", "spacing", "typography", "sizing"] as const) {
      const categoryURL = new URL("iframe.html", base);
      categoryURL.searchParams.set("id", `foundations-${category}--docs`);
      categoryURL.searchParams.set("viewMode", "docs");
      categoryURL.searchParams.set("globals", `theme:${options.theme};palette:${options.palette}`);
      await page.goto(categoryURL.href, { waitUntil: "domcontentloaded" });
      const document = page.locator(`.foundation-document[data-foundation-page="${category}"][aria-busy="false"]`);
      await document.waitFor();
      assert.deepEqual(await auditDocument(document), headerStyle);
      assert.equal(await document.locator(".foundation-example-link, details, summary").count(), 0);
      assert.deepEqual(await document.locator('[data-token-kind="portable"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name")).sort()), catalog.portable.filter(token => token.category === category).map(token => token.name).sort());
      assert.deepEqual(await document.locator('[data-token-kind="css"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name")).sort()), catalog.css.filter(token => token.category === (category === "colors" ? "color" : category) && token.layer !== "adapter").map(token => token.name).sort());
      if (category === "colors") {
        const groups = [
          { id: "colors", title: "基础表面与文字", names: ["--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground", "--muted", "--muted-foreground"] },
          { id: "colors-actions", title: "操作与状态", names: ["--primary", "--primary-foreground", "--secondary", "--secondary-foreground", "--accent", "--accent-foreground", "--accent-text", "--emphasis", "--emphasis-foreground", "--destructive"] },
          { id: "colors-feedback", title: "边界与反馈", names: ["--border", "--input", "--ring", "--hover-bg"] },
          { id: "colors-sidebar", title: "侧栏", names: ["--sidebar", "--sidebar-foreground", "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-primary", "--sidebar-primary-foreground", "--sidebar-border", "--sidebar-ring"] },
          { id: "colors-chart", title: "图表", names: ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] },
        ];
        assert.deepEqual(await document.locator(".foundation-body > section").evaluateAll(elements => elements.map(element => element.id)), [...groups.map(group => `foundation-${group.id}`), "foundation-tags", "foundation-callouts", "foundation-palettes"]);
        assert.deepEqual(await document.locator(".foundation-toc a").allTextContents(), [...groups.map(group => group.title), "Tag colors", "Callout colors", "Palette tokens"]);
        for (const group of groups) {
          const section = document.locator(`#foundation-${group.id}`);
          assert.equal(await section.getByRole("table").count(), 1);
          assert.deepEqual(await section.locator('[data-token-kind="css"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name"))), group.names);
          await document.getByRole("navigation", { name: "本页内容" }).getByRole("link", { name: group.title, exact: true }).click();
          await page.waitForFunction(id => location.hash === `#foundation-${id}` && window.document.querySelector(`.foundation-toc a[href="#foundation-${id}"]`)?.getAttribute("aria-current") === "location", group.id);
        }
        await document.getByRole("navigation", { name: "本页内容" }).getByRole("link", { name: "基础表面与文字", exact: true }).click();
        await page.screenshot({ path: resolve(directory, `color-sections-${options.width}-${options.theme}.png`) });
      }
      if (category === "typography") {
        assert.deepEqual(await document.locator(".foundation-body > section").evaluateAll(elements => elements.map(element => element.id)), ["foundation-typography", "foundation-typography-fonts", "foundation-typography-size", "foundation-typography-weight", "foundation-typography-leading"]);
        assert.deepEqual(await document.locator(".foundation-toc a").allTextContents(), ["通用文字样式", "字体", "基础字号", "基础字重", "基础行高"]);
        for (const id of ["foundation-typography-notes", "foundation-title-typography-notes"]) {
          assert.equal(await document.locator(`#${id}`).count(), 1);
          assert.equal(await document.locator(`#${id}`).evaluate(element => element.closest("h2")?.id), "foundation-title-typography");
        }
        assert.equal(await document.locator(".foundation-type-preview").count(), 1);
        assert.deepEqual(await document.locator("[data-font-token]").evaluateAll(elements => elements.map(element => element.getAttribute("data-font-token")).sort()), catalog.css.filter(token => token.category === "typography" && token.type === "fontFamily" && token.layer !== "adapter").map(token => token.name).sort());
        const fonts = await document.locator("[data-font-token]").evaluateAll(elements => elements.map(element => {
          const probe = window.document.createElement("span");
          probe.style.fontFamily = `var(${element.getAttribute("data-font-token")})`;
          window.document.body.append(probe);
          const expected = getComputedStyle(probe).fontFamily;
          probe.remove();
          return { actual: getComputedStyle(element).fontFamily, expected };
        }));
        assert(fonts.every(font => font.actual === font.expected), "Every displayed font sample consumes its declared role");
        assert.deepEqual(await document.getByRole("table", { name: "typography CSS definitions" }).locator("thead th").allTextContents(), ["Token", "Value"]);
        assert(await document.locator('[data-font-state="idle"]').count() > 0, "Offscreen font choices stay unloaded");
        assert.equal(await document.locator('[data-font-state="idle"] .foundation-font-choice[style]').count(), 0, "Offscreen rows must not request their font through CSS");
        // Font samples are intentionally lazy: visit each row before asserting its rendered stack.
        for (const row of await document.locator("[data-font-choice]").all()) {
          await row.scrollIntoViewIfNeeded();
          await row.locator('.foundation-font-choice[style]').waitFor();
        }
        await page.evaluate(() => window.document.fonts.ready);
        const choices = document.getByRole("table", { name: "Typography font choices" });
        assert.deepEqual(await choices.locator("[data-font-choice]").evaluateAll(rows => rows.map(row => row.getAttribute("data-font-choice"))), [...FONT_VALUES]);
        const fontChoices = await choices.locator("[data-font-choice]").evaluateAll((rows, families) => rows.map(row => {
          const sample = row.querySelector(".foundation-font-choice")!, probe = window.document.createElement("span");
          probe.style.fontFamily = families[row.getAttribute("data-font-choice")!];
          window.document.body.append(probe);
          const expected = getComputedStyle(probe).fontFamily;
          probe.remove();
          return { actual: getComputedStyle(sample).fontFamily, expected };
        }), FONT_FAMILIES as Record<string, string>);
        assert(fontChoices.every(font => font.actual === font.expected), "Font choices consume the production font stacks");
        if (options.width === 1368 && options.theme === "light") {
          await page.evaluate(() => {
            const sample = window.document.createElement("div");
            sample.id = "typography-italic-regression";
            sample.className = "markdown typeset";
            sample.style.cssText = 'position:fixed;top:0;left:0;width:320px;background:white;color:black;z-index:99999;font-family:"Noto Sans Variable";font-size:16px;';
            sample.innerHTML = '<em style="font-style:normal">MemoCard italic fiy</em>';
            window.document.body.append(sample);
          });
          const emphasis = page.locator("#typography-italic-regression em");
          try {
            const normal = await emphasis.screenshot({ path: resolve(directory, "typography-normal.png") });
            await emphasis.evaluate(element => { element.style.removeProperty("font-style"); });
            const italic = await emphasis.screenshot({ path: resolve(directory, "typography-italic.png") });
            assert(!normal.equals(italic), "Markdown emphasis must render a different italic glyph shape");
            assert(await page.evaluate(() => [...window.document.fonts].some(face => face.family.includes("Noto Sans Variable") && face.style === "italic" && face.status === "loaded")), "Use the real default italic face");
            await emphasis.evaluate(element => { element.style.fontStyle = "normal"; });
            assert(normal.equals(await emphasis.screenshot()), "Normal text is unchanged after using italic");
          } finally { await page.locator("#typography-italic-regression").evaluate(element => element.remove()); }
          const codeWidths = await page.evaluate(families => families.map(family => {
            const canvas = window.document.createElement("canvas").getContext("2d")!;
            canvas.font = `16px ${family}`;
            return Math.abs(canvas.measureText("iiii").width - canvas.measureText("WWWW").width);
          }), [FONT_FAMILIES["geist-mono"], FONT_FAMILIES["jetbrains-mono"]]);
          assert(codeWidths.every(difference => difference < 0.01), "Both offered code fonts preserve ASCII column widths");
        }
        const roles = document.locator("[data-text-role]");
        assert.equal(await roles.count(), 8);
        assert.equal(await roles.locator('[data-token-kind="css"]').count(), 24);
        assert.equal(await document.locator("[data-typography-property]").count(), 0, "The usage scan stays in the engineering catalog, not the normative role tables");
        const roleReadings = await roles.evaluateAll(rows => rows.map(row => {
          const sample = row.querySelector("[data-role-sample]")!;
          const style = getComputedStyle(sample);
          return { actual: row.querySelector("[data-role-metrics]")!.textContent!.split(" / ").map(parseFloat), expected: [style.fontSize, style.fontWeight, style.lineHeight].map(parseFloat) };
        }));
        assert(roleReadings.every(reading => reading.actual.every((value, index) => Math.abs(value - reading.expected[index]) < .01)), "Role summaries show actual composed metrics, rounded only for readability");
        assert.equal(await document.locator('#foundation-typography-size table').count(), 1, "One rem size scale replaces parallel fixed and relative scales");
        assert.equal(await document.getByRole("table", { name: "Typography size scale" }).count(), 1);
        assert.equal(await document.locator('[data-type-scale="size"]').count(), 7);
        for (const scale of ["size", "weight", "leading"]) {
          const rows = document.locator(`[data-type-scale="${scale}"]`);
          assert(await rows.count() > 0);
          assert.equal(await rows.locator("th code").evaluateAll(elements => elements.every(element => element.textContent!.startsWith("--"))), true);
        }
        assert.equal(await document.locator('[data-scale-name="--leading-normal"] td > code').innerText(), "1.5");
        for (const scale of ["weight", "leading"]) assert.equal(await document.locator(`[data-type-scale="${scale}"]`).count(), 3);
        const weights = await document.locator('[data-type-scale="weight"]').evaluateAll(rows => rows.map(row => Number(getComputedStyle(row.querySelector(".foundation-font-role")!).fontWeight)));
        assert.deepEqual(weights, [400, 500, 600]);
        const leading = await document.locator('[data-type-scale="leading"]').evaluateAll(rows => rows.map(row => { const style = getComputedStyle(row.querySelector(".foundation-font-role")!); return parseFloat(style.lineHeight) / parseFloat(style.fontSize); }));
        assert.deepEqual(leading, [1.25, 1.5, 1.75]);
        const sizeRows = document.locator('[data-type-scale="size"]');
        const readings = await sizeRows.evaluateAll(rows => rows.map(row => ({
          primary: row.querySelector("[data-typography-pixels]")!.textContent,
          actual: getComputedStyle(row.querySelector('[data-type-property="font-size"]')!).fontSize,
          source: row.querySelector("td code")!.textContent,
          name: row.getAttribute("data-scale-name")!,
        })));
        assert(readings.every(row => row.primary === row.actual && row.source!.endsWith("rem")), "Web scale shows computed px and preserves its variable definition");
        const base = document.locator("[data-typography-size-basis]");
        const rootSize = await page.evaluate(() => getComputedStyle(window.document.documentElement).fontSize);
        assert.deepEqual(await base.locator("code").allTextContents(), [rootSize, "16px"]);
        if (options.width === 1368 && options.theme === "light") {
          const previous = await page.evaluate(() => { const style = window.document.documentElement.style; const previous = style.fontSize; style.fontSize = "20px"; return previous; });
          try {
            await page.waitForFunction(() => window.document.querySelector('[data-scale-name="--font-size-sm"] [data-typography-pixels]')?.textContent === "17.5px");
            assert.equal(await document.locator('[data-scale-name="--font-size-xs"] [data-typography-pixels]').innerText(), "15px");
            assert.equal(await document.locator('[data-role-sample="heading"]').evaluate(element => getComputedStyle(element).fontSize), "30px");
            assert.equal(await document.locator('[data-role-sample="code"]').evaluate(element => getComputedStyle(element).fontSize), "17.5px");
            await verifyTypographyRoles(page);
          } finally {
            await page.evaluate(previous => { window.document.documentElement.style.fontSize = previous; }, previous);
            await page.waitForFunction(expected => window.document.querySelector('[data-typography-size-basis] code')?.textContent === expected, rootSize);
          }
        }
        assert.equal(await document.getByRole("table", { name: "Typography portable font sizes" }).count(), 0);
        assert.equal(await document.getByRole("table", { name: "Typography native rules" }).count(), 0);
        assert.equal(await document.locator("[data-typography-portable], [data-native-typography]").count(), 0);
        const nativeEngineering = await readFile(new URL("../../../design/native-typography.md", import.meta.url), "utf8");
        for (const token of catalog.portable.filter(token => /FontSize$/.test(token.name))) {
          assert(nativeEngineering.includes(`| \`${token.name}\` | \`${parseFloat(token.value)}\` |`), `Native documentation retains ${token.name}`);
        }
        assert(nativeEngineering.includes("当前无原生直接消费者，不作为生效的 14pt 原生字号"));
        for (const entry of typographyCatalog.native) {
          assert(nativeEngineering.includes(`| \`${entry.property}\` | \`${entry.value}\` |`), `Native documentation retains ${entry.value}`);
          for (const location of entry.locations) assert(nativeEngineering.includes(`../${location.source}#L${location.line}`));
        }
        assert.equal(await document.getByRole("table", { name: "Typography preference options" }).count(), 0);
        assert.equal(await document.getByRole("table", { name: "Typography reading widths" }).count(), 0);
        const engineering = await readFile(new URL("../../../design/typography.md", import.meta.url), "utf8");
        for (const row of [
          "| `size` | 14px 基准 / 15px 基准 / 16px 基准 / 18px 基准 | 16px 基准 |",
          "| `leading` | 1.6 / 1.75 / 1.9 | 1.6 |",
          "| `measure` | 60 / 70 / 80 / 90 | 90 |",
          "| `flow` | 1em / 1.25em / 2em | 1em |",
          "| 窄 | `60` | `设置字号 × 28` | 448px |",
          "| 适中 | `70` | `设置字号 × 33` | 528px |",
          "| 宽 | `80` | `设置字号 × 37` | 592px |",
          "| 宽松 | `90` | `设置字号 × 45` | 720px |",
        ]) assert(engineering.includes(row), `Engineering documentation retains ${row}`);
        assert.equal(await document.getByRole("combobox").count(), 0);
        await verifyTypographyRoles(page);
      } else if (category !== "colors") {
        const dimensions = document.getByRole("table", { name: `${category} portable dimensions` });
        assert.deepEqual(await dimensions.locator("thead th").allTextContents(), (category === "spacing" || category === "sizing") ? ["Token", "Value"] : ["Token", "Value", "Preview"]);
        for (const row of await dimensions.locator("tbody tr").all()) {
          const value = parseFloat(await row.locator("td code").innerText());
          const preview: number = await row.locator(category === "spacing" || category === "sizing" ? ".foundation-spacing-preview" : ".foundation-dimension-preview > span").evaluate(element => element.getBoundingClientRect().width);
          assert.equal(preview, value, "Dimension previews retain the existing px baseline");
        }
        if (category === "spacing") {
          assert.deepEqual(await document.locator(".foundation-body > section").evaluateAll(elements => elements.map(element => element.id)), ["foundation-spacing-web", "foundation-spacing"]);
          assert.deepEqual(await document.locator(".foundation-body h2").allTextContents(), ["Web 间距标尺", "跨端间距基准"]);
          const scale = document.getByRole("table", { name: "Web spacing scale" });
          assert.deepEqual(await scale.locator("thead th").allTextContents(), ["Token", "Value"]);
          assert.deepEqual(await scale.locator("tbody tr").evaluateAll(rows => rows.map(row => ({ step: row.getAttribute("data-token-name")!.replace("spacing-", ""), value: row.getAttribute("data-spacing-expression") }))), spacingCatalog.scale);
          const measured = await scale.locator("tbody tr").evaluateAll((rows, upstream) => rows.map(row => {
            const preview = row.querySelector<HTMLElement>(".foundation-spacing-preview")!;
            const actual = preview.getBoundingClientRect().width;
            const probe = window.document.createElement("span");
            probe.style.width = upstream;
            probe.style.display = "block";
            probe.style.position = "fixed";
            window.document.body.append(probe);
            const base = parseFloat(getComputedStyle(probe).width);
            probe.remove();
            const step = row.getAttribute("data-token-name")!.replace("spacing-", "");
            return { actual, label: parseFloat(row.querySelector("td code")!.textContent!), expected: step === "px" ? 1 : Number(step) * base };
          }), spacingCatalog.upstream.value);
          assert(measured.every(item => Math.abs(item.actual - item.expected) < 0.01 && Math.abs(item.label - item.expected) < 0.01), "Web labels and bar widths resolve the upstream scale");
          for (const table of [scale, dimensions]) {
            const rows = await table.locator("tbody tr").evaluateAll(elements => elements.map(row => {
              const preview = row.querySelector<HTMLElement>(".foundation-spacing-preview")!, bar = preview.getBoundingClientRect();
              const label = row.querySelector("td code")!.getBoundingClientRect();
              return { cells: row.children.length, start: bar.left, height: bar.height, gap: label.left - bar.right, center: Math.abs((label.top + label.bottom - bar.top - bar.bottom) / 2) };
            }));
            assert(rows.every(row => row.cells === 2 && Math.abs(row.start - rows[0].start) < 0.01 && row.height === 8 && row.gap === 8 && row.center < 1), "Spacing bars share an aligned origin, inline value and vertical center");
          }
          if (options.width === 1368 && options.theme === "light") {
            const original = await page.evaluate(() => { const style = window.document.documentElement.style; const previous = style.fontSize; style.fontSize = "20px"; return previous; });
            await page.waitForFunction(() => window.document.querySelector('[data-token-name="spacing-16"] td code')?.textContent === "80px");
            assert.deepEqual(await dimensions.locator("tbody td:first-of-type code").allTextContents(), catalog.portable.filter(token => token.category === "spacing").map(token => `${parseFloat(token.value)}px / pt`));
            await page.evaluate(previous => { window.document.documentElement.style.fontSize = previous; }, original);
            await page.waitForFunction(() => window.document.querySelector('[data-token-name="spacing-16"] td code')?.textContent === "64px");
          }
        } else {
          const controls = document.getByRole("table", { name: "Web control dimensions" });
          assert.deepEqual(await controls.locator("thead th").allTextContents(), ["Component / Size", "Value · Preview"]);
          assert.equal(await controls.locator("tbody tr").count(), 15);
          assert.deepEqual(await controls.getByRole("button", { name: "保存", exact: true }).evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height)), [24, 32, 36, 40]);
          assert.deepEqual(await controls.locator('[data-density-name^="Button / icon"] button').evaluateAll(elements => elements.map(element => [element.getBoundingClientRect().width, element.getBoundingClientRect().height])), [[24, 24], [32, 32], [36, 36], [40, 40]]);
          for (const row of await controls.locator("tbody tr").all()) {
            const measured = await row.locator("[data-density-metric]").innerText();
            const sample = row.locator('.foundation-control-preview > :first-child');
            const height = await sample.evaluate(element => (element.querySelector('[data-slot="tabs-list"]') || element).getBoundingClientRect().height);
            assert(measured.includes(`${height}px`), `${measured} matches the production control height ${height}`);
          }
        }
      }
      assert.equal(await document.getByText("读取中…", { exact: true }).count(), 0);
      assert.equal(await document.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && window.document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: resolve(directory, `${category}-docs-${options.width}-${options.theme}.png`), fullPage: true });
    }
    const shapeURL = new URL("iframe.html", base);
    shapeURL.searchParams.set("id", "foundations-shape--docs");
    shapeURL.searchParams.set("viewMode", "docs");
    const shapeRadius = options.width === 390 ? "none" : "lg";
    shapeURL.searchParams.set("globals", `theme:${options.theme};palette:${options.palette};radius:${shapeRadius}`);
    await page.goto(shapeURL.href, { waitUntil: "domcontentloaded" });
    const shape = page.locator('.foundation-document[data-foundation-page="shape"][aria-busy="false"]');
    await shape.waitFor();
    assert.deepEqual(await auditDocument(shape), headerStyle);
    assert.deepEqual(await shape.locator("h2").allTextContents(), ["圆角选项", "当前主题圆角"]);
    assert.equal(await shape.getByRole("heading", { name: "Shape tokens", exact: true }).count(), 0);
    assert.equal(await shape.getByRole("table").count(), 2);
    for (const label of ["shape portable dimensions", "shape CSS definitions"]) {
      assert.deepEqual(await shape.getByRole("table", { name: label }).locator("thead th").allTextContents(), ["Token", "Value", "Preview"]);
    }
    assert.equal(await shape.getByText("交互区域圆角 · 独立规则", { exact: true }).count(), 1);
    assert.deepEqual(await shape.locator('[data-token-kind="css"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name")).sort()), catalog.css.filter(token => token.category === "shape").map(token => token.name).sort());
    assert.deepEqual(await shape.locator('[data-token-kind="portable"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name")).sort()), catalog.portable.filter(token => token.category === "shape").map(token => token.name).sort());
    assert.equal(await shape.getByLabel("当前圆角基准").innerText(), `--radius = ${shapeRadius === "none" ? "0px" : "10px"}`);
    for (const token of catalog.css.filter(token => token.category === "shape" && token.name.startsWith("--radius-"))) {
      assert.equal(await shape.locator(`[data-token-name="${token.name}"] .foundation-radius-formula`).innerText(), token.declarations[0].value);
    }
    assert.equal(await shape.locator('[data-token-kind="portable"] .foundation-radius-formula, [data-token-name^="--hover-"] .foundation-radius-formula').count(), 0);
    const shapeRows = await shape.locator("tr[data-token-name]").evaluateAll(rows => rows.map(row => {
      const cells = row.querySelectorAll("th, td"), preview = row.querySelector(".foundation-radius-preview")!;
      return { valueLeft: cells[1].getBoundingClientRect().left, previewLeft: cells[2].getBoundingClientRect().left, width: preview.getBoundingClientRect().width, height: preview.getBoundingClientRect().height };
    }));
    assert(shapeRows.every(row => Math.abs(row.valueLeft - shapeRows[0].valueLeft) < 1 && Math.abs(row.previewLeft - shapeRows[0].previewLeft) < 1 && row.width === (options.width < 480 ? 56 : 64) && row.height === (options.width < 480 ? 48 : 56)), "Both Shape tables align values and enlarged previews");
    assert.equal(await shape.locator('[data-token-name="--radius-lg"] td > code:first-child').innerText(), shapeRadius === "none" ? "0px" : "10px");
    assert.equal(await shape.locator('[data-token-name="--radius-xl"] td > code:first-child').innerText(), shapeRadius === "none" ? "4px" : "14px");
    assert.equal(await shape.locator('[data-token-name="--hover-row-radius"] td code').innerText(), "8px");
    assert.equal(await shape.locator('[data-token-name="--hover-action-radius"] td code').innerText(), "4px");
    assert.equal(await shape.locator('[data-token-name="radius.md"] .foundation-radius-preview').evaluate(element => getComputedStyle(element).borderTopLeftRadius), "8px");
    await shape.getByRole("navigation", { name: "本页内容" }).getByRole("link", { name: "当前主题圆角", exact: true }).click();
    await page.waitForFunction(() => location.hash === "#foundation-shape-current");
    assert.equal(await shape.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: resolve(directory, `shape-docs-${options.width}-${options.theme}.png`), fullPage: true });
    const elevationURL = new URL("iframe.html", base);
    elevationURL.searchParams.set("id", "foundations-effects--docs");
    elevationURL.searchParams.set("viewMode", "docs");
    elevationURL.searchParams.set("globals", `theme:${options.theme};palette:${options.palette}`);
    await page.goto(elevationURL.href, { waitUntil: "domcontentloaded" });
    const elevation = page.locator('.foundation-document[data-foundation-page="elevation"][aria-busy="false"]');
    await elevation.waitFor();
    assert.deepEqual(await auditDocument(elevation), headerStyle);
    assert.deepEqual(await elevation.locator('[data-token-kind="css"]').evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name")).sort()), catalog.css.filter(token => token.category === "effects" && token.layer !== "adapter").map(token => token.name).sort());
    assert.equal(await elevation.locator(".foundation-focus-preview, .foundation-example-link").count(), 0);
    assert.equal(await elevation.getByRole("button", { name: "用 Tab 检查焦点", exact: true }).count(), 0);
    assert.equal(await elevation.locator(".foundation-header, .foundation-section-description").getByText(/焦点/).count(), 0);
    const shadowTable = elevation.getByRole("table", { name: "Tailwind shadow scale" });
    const scales = [
      { label: "Tailwind shadow scale", prefix: "shadow", levels: ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] },
      { label: "Tailwind inset shadow scale", prefix: "inset-shadow", levels: ["2xs", "xs", "sm"] },
      { label: "Tailwind drop shadow scale", prefix: "drop-shadow", levels: ["xs", "sm", "md", "lg", "xl", "2xl"] },
    ];
    for (const scale of scales) {
      assert.deepEqual(await elevation.getByRole("table", { name: scale.label }).locator("tbody tr").evaluateAll(rows => rows.map(row => row.getAttribute("data-token-name"))), scale.levels.map(level => `--${scale.prefix}-${level}`));
    }
    const upstream = await readFile(resolve("node_modules/tailwindcss/theme.css"), "utf8");
    const projectShadows = catalog.css.filter(token => token.category === "effects" && token.type === "shadow" && token.layer !== "adapter");
    const projectValues = await page.evaluate(names => Object.fromEntries(names.map(name => [name, getComputedStyle(document.documentElement).getPropertyValue(name).trim()])), projectShadows.map(token => token.name));
    const shadowDefinitions = [...upstream.matchAll(/^\s*(--(?:shadow|inset-shadow|drop-shadow)-(?:2xs|xs|sm|md|lg|xl|2xl)):\s*([^;]+);/gm)].map(([, name, value]) => ({ name, value }));
    shadowDefinitions.push(...projectShadows.map(token => ({ name: token.name, value: projectValues[token.name] })));
    for (const { name, value } of shadowDefinitions) {
      const row = elevation.locator(`[data-token-name="${name}"]`);
      assert.equal(await row.locator("td code").innerText(), value);
      const reading = await row.locator(".foundation-shadow-preview").evaluate((element, { value, drop }) => {
        const property = drop ? "filter" : "box-shadow";
        const probe = document.createElement("span");
        probe.style.setProperty(property, drop ? `drop-shadow(${value})` : value);
        document.body.append(probe);
        const expected = getComputedStyle(probe).getPropertyValue(property);
        probe.remove();
        return { actual: getComputedStyle(element).getPropertyValue(property), expected };
      }, { value, drop: name.startsWith("--drop-shadow-") });
      assert.notEqual(reading.expected, "none");
      assert.equal(reading.actual, reading.expected, name);
    }
    for (const label of [...scales.map(scale => scale.label), "elevation CSS definitions"]) {
      assert.deepEqual(await elevation.getByRole("table", { name: label }).locator("thead th").allTextContents(), ["Token", `Value · ${options.theme}`]);
    }
    const previews = await elevation.locator(".foundation-shadow-preview").evaluateAll(elements => elements.map(element => {
      const { left, width, height } = element.getBoundingClientRect();
      return { left, width, height };
    }));
    assert.equal(previews.length, 16 + projectShadows.length);
    assert.equal(await elevation.locator("svg.foundation-drop-shadow-preview path").count(), 6);
    assert(await elevation.locator(".foundation-drop-shadow-preview").evaluateAll(elements => elements.every(element => getComputedStyle(element).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(element).boxShadow === "none")));
    assert(previews.every(preview => Math.abs(preview.left - previews[0].left) < 1 && preview.width === 64 && preview.height === 40), "Upstream and project shadow previews share one column and size");
    assert.equal(await elevation.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1), true);
    await shadowTable.screenshot({ path: resolve(directory, `shadow-scale-${options.width}-${options.theme}.png`) });
    for (const scale of scales.slice(1)) await elevation.getByRole("table", { name: scale.label }).screenshot({ path: resolve(directory, `${scale.prefix}-scale-${options.width}-${options.theme}.png`) });
    await elevation.screenshot({ path: resolve(directory, `elevation-layout-${options.width}-${options.theme}.png`) });
    const drawerURL = new URL("iframe.html", base);
    drawerURL.searchParams.set("id", "components-sheet--interaction");
    drawerURL.searchParams.set("viewMode", "story");
    drawerURL.searchParams.set("embed", "true");
    drawerURL.searchParams.set("globals", `theme:${options.theme};palette:${options.palette};radius:${options.width === 390 ? "none" : "lg"}`);
    await page.goto(drawerURL.href, { waitUntil: "domcontentloaded" });
    const drawer = page.locator("#storybook-root > main");
    await drawer.getByRole("heading", { name: "浮层检查", exact: true }).waitFor();
    assert.deepEqual(await drawer.getByRole("heading").allTextContents(), ["浮层检查"]);
    assert.deepEqual(await drawer.getByRole("button").allTextContents(), ["打开抽屉"]);
    assert.equal(await drawer.locator("p, output, section, [data-testid='sidebar-icon']").count(), 0);
    assert.equal(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1), true);
    const trigger = drawer.getByRole("button", { name: "打开抽屉", exact: true });
    await page.keyboard.press("Tab");
    assert(await trigger.evaluate(element => element === document.activeElement), "Tab reaches the drawer trigger");
    await drawer.screenshot({ path: resolve(directory, `elevation-diagnostics-${options.width}-${options.theme}.png`) });
    for (const escape of [true, false]) {
      await trigger.press("Enter");
      const sheet = page.getByRole("dialog", { name: "抽屉检查", exact: true });
      await sheet.waitFor({ state: "visible" });
      assert.equal(await sheet.getAttribute("data-slot"), "sheet-content");
      await page.locator('[data-slot="sheet-overlay"]').waitFor({ state: "visible" });
      const close = sheet.getByRole("button", { name: "关闭", exact: true });
      await page.waitForFunction(() => Boolean(document.activeElement?.closest('[data-slot="sheet-content"]')));
      await page.waitForFunction(() => {
        const bounds = document.querySelector('[data-slot="sheet-content"]')?.getBoundingClientRect();
        return bounds && bounds.right <= innerWidth + 1 && bounds.left >= -1;
      });
      if (escape) await page.keyboard.press("Escape");
      else await close.click();
      await sheet.waitFor({ state: "detached" });
      await page.waitForFunction(() => document.activeElement?.textContent === "打开抽屉");
    }
    const iconsURL = new URL("iframe.html", base);
    iconsURL.searchParams.set("id", "foundations-icons--docs");
    iconsURL.searchParams.set("viewMode", "docs");
    iconsURL.searchParams.set("globals", `theme:${options.theme};palette:${options.palette}`);
    await page.goto(iconsURL.href, { waitUntil: "domcontentloaded" });
    const iconPage = page.locator('.foundation-document[data-foundation-page="icons"][aria-busy="false"]');
    await iconPage.waitFor();
    assert.deepEqual(await auditDocument(iconPage), headerStyle);
    assert.deepEqual(await iconPage.locator(".foundation-icon-grid code").allTextContents(), iconCatalog.icons.map(icon => icon.name));
    assert.equal(await iconPage.locator(".foundation-note, details, summary").count(), 0);
    const iconPreviews = await iconPage.locator(".foundation-icon-grid > div > span").evaluateAll(elements => Promise.all(elements.map(async element => {
      const style = getComputedStyle(element);
      const image = new Image();
      image.src = JSON.parse(style.maskImage.slice(4, -1));
      await image.decode();
      return { width: style.width, height: style.height, loaded: image.naturalWidth, color: style.backgroundColor, foreground: style.color };
    })));
    assert.equal(iconPreviews.length, iconCatalog.icons.length);
    assert(iconPreviews.every(icon => icon.width === "24px" && icon.height === "24px" && icon.loaded === 24 && icon.color === icon.foreground));
    assert.equal(await iconPage.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: resolve(directory, `project-icons-${options.width}-${options.theme}.png`) });
    const motionURL = new URL("iframe.html", base);
    motionURL.searchParams.set("id", "foundations-motion--docs");
    motionURL.searchParams.set("viewMode", "docs");
    motionURL.searchParams.set("globals", `theme:${options.theme};palette:${options.palette}`);
    await page.goto(motionURL.href, { waitUntil: "domcontentloaded" });
    const motion = page.locator('.foundation-document[data-foundation-page="motion"][aria-busy="false"]');
    await motion.waitFor();
    assert.deepEqual(await auditDocument(motion), headerStyle);
    const motionRows = motion.getByRole("table", { name: "Motion reference", exact: true }).locator("tbody tr");
    assert.equal(await motionRows.count(), 7);
    assert.deepEqual(await motionRows.locator("td:first-of-type > code:first-of-type").allTextContents(), ["150ms", "180ms", "200ms", "200ms", "200ms", "180ms", "2s"]);
    assert.equal(await motion.getByRole("table", { name: "Reduced motion rules", exact: true }).locator("tbody tr").count(), 4);
    assert.equal(await motion.locator(".foundation-example-link").count(), 0);
    assert.equal(await motion.getByRole("region", { name: "动效演示", exact: true }).count(), 1);
    assert.equal(await motion.getByLabel("动效抽屉状态").count(), 0);
    const expectedSheetEasing = await motionRows.nth(2).locator("td:first-of-type > code").nth(1).innerText();
    const motionReadings = [];
    for (const preference of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion: preference });
      await page.waitForFunction(preference => document.querySelector('output[aria-label="当前动效媒体偏好"]')?.textContent?.startsWith(preference), preference);
      await motion.getByRole("button", { name: "播放动效", exact: true }).click();
      const sample = page.getByRole("dialog", { name: "动效演示", exact: true });
      await sample.waitFor({ state: "visible" });
      const reading = await sample.evaluate(element => {
        const style = getComputedStyle(element);
        const ms = (value: string) => Math.max(...value.split(",").map(part => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000)));
        return { animation: ms(style.animationDuration), transition: ms(style.transitionDuration), easing: style.transitionTimingFunction };
      });
      assert.equal(reading.animation, preference === "reduce" ? 0.01 : 200);
      assert.equal(reading.transition, preference === "reduce" ? 0.01 : 200);
      assert.equal(reading.easing, expectedSheetEasing);
      motionReadings.push(reading);
      await sample.getByRole("button", { name: "关闭", exact: true }).click();
      await sample.waitFor({ state: "detached" });
    }
    assert(motionReadings[1].animation < motionReadings[0].animation);
    assert.equal(await motion.evaluate(element => element.scrollWidth <= element.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: resolve(directory, `motion-docs-${options.width}-${options.theme}.png`) });
    const diagnosticsURL = new URL("iframe.html", base);
    diagnosticsURL.searchParams.set("id", "foundations-colors--default");
    diagnosticsURL.searchParams.set("viewMode", "story");
    diagnosticsURL.searchParams.set("embed", "true");
    diagnosticsURL.searchParams.set("globals", `theme:${options.theme};palette:${options.palette}`);
    await page.goto(diagnosticsURL.href, { waitUntil: "domcontentloaded" });
    const diagnostics = page.locator('.foundation-color-diagnostics[aria-busy="false"]');
    await diagnostics.waitFor();
    assert((await diagnostics.getByLabel("颜色诊断汇总").innerText()).startsWith(`${options.theme} / ${options.palette} /`));
    assert.equal(await diagnostics.locator('tbody tr[data-pair-id]').count(), 22);
    assert.equal(await diagnostics.getByRole("table").locator("thead th").count(), 4);
    assert.equal(await diagnostics.getByRole("heading", { name: "界面语义色", exact: true }).count(), 0);
    assert.equal(await diagnostics.getByRole("heading", { name: "标签颜色", exact: true }).count(), 0);
    const failedPairs = await diagnostics.locator('tr:has(output[data-result="fail"])').evaluateAll(rows => rows.map(row => row.getAttribute("data-pair-id")));
    assert.deepEqual(failedPairs, options.palette === "blue" ? ["primary"] : []);
    if (options.palette === "blue") assert(Math.abs(Number(await diagnostics.getByLabel("primary 对比度", { exact: true }).getAttribute("data-ratio")) - 3.761777718) < 0.001);
    assert.equal(await diagnostics.locator('output[data-result="diagnostic"]').count(), 1);
    assert.equal(await diagnostics.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
    assert.equal(await diagnostics.getByRole("region", { name: "交互状态", exact: true }).count(), 0);
    assert.equal(await diagnostics.getByRole("button").count(), 0);
    assert.equal(await diagnostics.getByRole("textbox").count(), 0);
    assert.equal(await diagnostics.getByRole("tab").count(), 0);
    await page.screenshot({ path: resolve(directory, `diagnostics-${options.width}-${options.theme}.png`) });
    assert.deepEqual(errors, []);
    return { definitions: definitions.length, sections };
  } catch (error) {
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: resolve(directory, `failure-${options.width}-${options.theme}.png`) }).catch(() => undefined);
    throw error;
  } finally { await isolated.close(); }
};
