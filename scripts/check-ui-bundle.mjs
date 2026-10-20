import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const root = resolve("apps/ui/dist");
const html = await readFile(resolve(root, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+\.(?:js|css))"/g)].map((match) => match[1]);
if (!assets.length) throw new Error("UI build does not reference an initial JS or CSS asset.");

// Utilities are emitted once in the entry CSS so lazy routes cannot override responsive rules.
// Reserve 4 KiB gzip for the shared layout-matched loading shells.
// Reserve 1 KiB gzip for the mobile capture sheet and its shared styles.
// Shared backdrop blur utilities add less than 2 KiB CSS.
// Mobile home and collection layout controls share full-width responsive styles.
const limits = { js: 600 * 1024, css: 95 * 1024, gzip: 188 * 1024, fonts: 1024 * 1024 };
let compressed = 0;
for (const asset of assets) {
  const bytes = await readFile(resolve(root, asset));
  const suffix = asset.split(".").pop();
  if ((suffix === "js" || suffix === "css") && bytes.length > limits[suffix]) {
    throw new Error(`${asset} is ${bytes.length} bytes; the initial ${suffix.toUpperCase()} budget is ${limits[suffix]} bytes.`);
  }
  compressed += gzipSync(bytes).length;
}
if (compressed > limits.gzip) throw new Error(`Initial JS and CSS gzip size is ${compressed} bytes; budget is ${limits.gzip} bytes.`);
// Include static dependencies of lazy routes; index.html alone misses editor and preview cost.
const manifest = JSON.parse(await readFile(resolve(root, ".vite/manifest.json"), "utf8"));
for (const route of [
  // Editable page-style tags share Tiptap's caret/history engine: 340 KiB raw / 110 KiB gzip above plain capture.
  { name: "home with quick capture", entries: ["src/components/quick-capture.tsx", "src/components/home-mascot.tsx", "src/components/note-collection.tsx"], raw: 1640 * 1024, gzip: 510 * 1024 },
  // The new native route includes view models and tag color styles: 16 KiB raw / 2 KiB gzip above Web home.
  { name: "iOS home with native chrome", entries: ["src/components/ios-app-chrome.tsx", "src/components/quick-capture.tsx", "src/components/home-mascot.tsx", "src/components/note-collection.tsx"], raw: 1656 * 1024, gzip: 512 * 1024 },
  // Reserve 2 KiB raw for the shared mobile header and vault-backed tag preferences; gzip budgets stay unchanged.
  { name: "mobile home with title layout menu", entries: ["src/components/quick-capture.tsx", "src/components/home-mascot.tsx", "src/components/note-collection.tsx", "src/components/mobile-tag-actions.tsx"], raw: 1645 * 1024, gzip: 510 * 1024 },
  { name: "mobile home with swipe capture", entries: ["src/components/quick-capture.tsx", "src/components/home-mascot.tsx", "src/components/note-collection.tsx", "src/components/mobile-tag-actions.tsx", "src/components/ui/sheet-swipe.tsx"], raw: 1648 * 1024, gzip: 512 * 1024 },
  // Reserve 9 KiB for mobile navigation, shared saved layout state, optional swipe loading, and overlays.
  { name: "list", entries: ["src/components/note-collection.tsx"], raw: 1263 * 1024, gzip: 383 * 1024 },
  { name: "mobile list with quick capture", entries: ["src/components/note-collection.tsx", "src/components/quick-capture.tsx"], raw: 1640 * 1024, gzip: 510 * 1024 },
  { name: "mobile tag with actions", entries: ["src/components/note-collection.tsx", "src/components/quick-capture.tsx", "src/components/mobile-tag-actions.tsx"], raw: 1642 * 1024, gzip: 510 * 1024 },
  // Shared capture sheet styles and optional swipe loading add less than 2 KiB gzip to the detail entry.
  { name: "detail", entries: ["src/Editor.tsx"], raw: 1750 * 1024, gzip: 527 * 1024 },
  { name: "detail with preserved Markdown", entries: ["src/Editor.tsx", "src/markdown.tsx"], raw: 2100 * 1024, gzip: 630 * 1024 },
]) {
  const visited = new Set();
  const files = new Set();
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
  for (const entry of route.entries) collect(entry);
  let raw = 0, gzip = 0;
  for (const file of files) {
    const bytes = await readFile(resolve(root, file));
    raw += bytes.length; gzip += gzipSync(bytes).length;
  }
  if (raw > route.raw || gzip > route.gzip) throw new Error(`${route.name} exceeds its route budget: ${raw} raw / ${gzip} gzip bytes.`);
  console.log(`${route.name}: ${raw} raw / ${gzip} gzip bytes.`);
}
const fontFiles = (await readdir(resolve(root, "assets"), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.woff2?$/.test(entry.name));
let fonts = 0;
for (const entry of fontFiles) fonts += (await readFile(resolve(root, "assets", entry.name))).length;
if (fonts > limits.fonts) throw new Error(`Packaged fonts are ${fonts} bytes; the font budget is ${limits.fonts} bytes.`);
for (const entry of await readdir(resolve(root, "assets"))) {
  if (entry.endsWith(".css") && !assets.includes(`assets/${entry}`)
      && /@layer\s+utilities\s*\{/.test(await readFile(resolve(root, "assets", entry), "utf8"))) {
    throw new Error(`Lazy CSS ${entry} emits global utilities that can override responsive styles.`);
  }
  if (/\.(?:js|css)$/.test(entry) && /radix/i.test(await readFile(resolve(root, "assets", entry), "utf8"))) {
    throw new Error(`Radix reference in shipped UI asset: ${entry}`);
  }
}
console.log(`UI bundle budget passed: ${assets.join(", ")} (${compressed} initial gzip bytes, ${fonts} font bytes).`);
