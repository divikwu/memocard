import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

// Static dependency closures include the entry, shared chunks and their CSS.
// Dynamic children are measured explicitly in the routes that use them.
export function routeFiles(manifest, entries = []) {
  const visited = new Set(), files = new Set();
  function collect(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (!entry) throw new Error(`Missing route asset: ${key}`);
    files.add(entry.file);
    for (const css of entry.css ?? []) files.add(css);
    for (const dependency of entry.imports ?? []) collect(dependency);
  }
  collect("index.html");
  for (const entry of entries) collect(entry);
  return files;
}

export function checkCurrentManifest(manifest) {
  for (const key of Object.keys(manifest)) {
    if (/^src\/(?:components\/(?!name-editor\.core)|generated\/design-tokens\.(?:css|ts)$|(?:Editor|RichMarkdownEditor|NoteProperties|NotePreview|markdown)\.tsx|features\/theme\/Theme)/.test(key)
      || /(?:^|\/)(?:\.storybook(?:-next)?|stories|preview|test-support|ui-state-fixtures|mascot-fixtures)\//.test(key)) {
      throw new Error(`Retired or development-only UI module in production manifest: ${key}`);
    }
  }
}

export function checkCurrentStylesheet(css, asset) {
  const stylesheet = postcss.parse(css, { from: asset });
  stylesheet.walkDecls(declaration => {
    const owner = declaration.parent;
    if (owner.type !== "rule" || !owner.selectors.some(selector => /^(?::root|:host|html|body|\.ui-next-theme)(?:$|[.#:\[])/.test(selector.trim()))) return;
    if (/^--(?:radius|sidebar-(?:desktop-row-height|mobile-row-min-height|icon-size|content-gap|row-gap|logo-size|mobile-font-size|desktop-font-size|toggle-visual-size|touch-target-size|horizontal-padding))$/.test(declaration.prop)) {
      throw new Error(`Retired Web token in ${asset}: ${declaration.prop}`);
    }
  });
  stylesheet.walkRules(rule => {
    const selector = rule.selector.replace(/\\(.)/g, "$1");
    if (selector.includes(".grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]")) {
      throw new Error(`Retired collection layout utility in ${asset}: ${rule.selector}`);
    }
  });
}

export async function checkUIBundle(root = resolve("apps/ui/dist")) {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  const assets = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
  if (!assets.length) throw new Error("UI build does not reference an initial JS or CSS asset.");
  const manifest = JSON.parse(await readFile(resolve(root, ".vite/manifest.json"), "utf8"));
  checkCurrentManifest(manifest);
  // Current theme and bundled font faces are shared once in the entry CSS.
  // Retain the 600 KiB single-JS cap. The measured 2026-10-25 entry is
  // 393,846 CSS bytes / 316,274 combined gzip bytes; caps reserve 4% / 7%.
  // Font package limits reflect all 26 current choices, including normal and
  // italic subsets plus both Chinese companions; these are not initial transfers.
  const limits = { js: 600 * 1024, css: 400 * 1024, gzip: 330 * 1024, normalFonts: 3.75 * 1024 * 1024, italicFonts: 3.75 * 1024 * 1024, cjkFonts: 10.5 * 1024 * 1024 };
  let compressed = 0;
  for (const asset of routeFiles(manifest)) {
    const bytes = await readFile(resolve(root, asset)), suffix = asset.split(".").pop();
    if (bytes.length > limits[suffix]) throw new Error(`${asset} is ${bytes.length} bytes; the initial ${suffix.toUpperCase()} budget is ${limits[suffix]} bytes.`);
    compressed += gzipSync(bytes).length;
  }
  if (compressed > limits.gzip) throw new Error(`Initial JS and CSS gzip size is ${compressed} bytes; budget is ${limits.gzip} bytes.`);
  const metrics = [];
  for (const route of [
    { name: "list", entries: [], raw: 1120, gzip: 330 },
    { name: "list with card previews", entries: ["ui-next/business/NotePreview.tsx"], raw: 1780, gzip: 525 },
    { name: "home with quick capture", entries: ["ui-next/business/QuickCapture.tsx"], raw: 1500, gzip: 450 },
    { name: "home with capture and card previews", entries: ["ui-next/business/QuickCapture.tsx", "ui-next/business/NotePreview.tsx"], raw: 2140, gzip: 645 },
    { name: "iOS home with native chrome", entries: ["ui-next/native/IOSAppChrome.tsx", "ui-next/business/QuickCapture.tsx"], raw: 1520, gzip: 455 },
    { name: "mobile home with swipe capture", entries: ["ui-next/business/QuickCapture.tsx", "ui-next/components/sheet-swipe.tsx"], raw: 1510, gzip: 450 },
    { name: "search", entries: ["ui-next/business/NoteSearchDialog.tsx"], raw: 1800, gzip: 530 },
    { name: "trash", entries: ["ui-next/business/TrashPage.tsx"], raw: 1800, gzip: 535 },
    { name: "settings", entries: ["ui-next/web/WebSettings.tsx"], raw: 1850, gzip: 545 },
    { name: "detail with preserved Markdown", entries: ["ui-next/business/Editor.tsx", "ui-next/business/NoteMarkdown.tsx"], raw: 2700, gzip: 820 },
  ]) {
    let raw = 0, gzip = 0;
    for (const file of routeFiles(manifest, route.entries)) {
      const bytes = await readFile(resolve(root, file));
      raw += bytes.length; gzip += gzipSync(bytes).length;
    }
    if (raw > route.raw * 1024 || gzip > route.gzip * 1024) throw new Error(`${route.name} exceeds its route budget: ${raw} raw / ${gzip} gzip bytes.`);
    metrics.push({ name: route.name, raw, gzip });
    console.log(`${route.name}: ${raw} raw / ${gzip} gzip bytes.`);
  }
  const fonts = { normal: 0, italic: 0, cjk: 0 };
  for (const entry of await readdir(resolve(root, "assets"))) {
    const bytes = await readFile(resolve(root, "assets", entry));
    if (/\.woff2?$/.test(entry)) {
      const group = /^noto-(?:sans|serif)-sc-/.test(entry) ? "cjk" : entry.includes("-italic-") ? "italic" : "normal";
      fonts[group] += bytes.length;
    }
    if (entry.endsWith(".css") && !assets.includes(`assets/${entry}`) && /@layer\s+utilities\s*\{/.test(bytes.toString("utf8"))) throw new Error(`Lazy CSS ${entry} emits global utilities that can override responsive styles.`);
    if (entry.endsWith(".css")) checkCurrentStylesheet(bytes.toString("utf8"), entry);
    if (/\.(?:js|css)$/.test(entry) && /radix/i.test(bytes.toString("utf8"))) throw new Error(`Radix reference in shipped UI asset: ${entry}`);
  }
  // The existing 26 UI font choices package normal/italic subsets; both Chinese
  // companions have separate limits and are fetched only for matching glyphs.
  for (const group of Object.keys(fonts)) if (fonts[group] > limits[`${group}Fonts`]) throw new Error(`Packaged ${group} fonts are ${fonts[group]} bytes; budget is ${limits[`${group}Fonts`]} bytes.`);
  console.log(`UI bundle budget passed: ${compressed} initial gzip bytes; fonts ${JSON.stringify(fonts)}.`);
  return { initialGzip: compressed, routes: metrics, fonts };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkUIBundle();
