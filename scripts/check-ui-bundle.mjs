import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const root = resolve("apps/ui/dist");
const html = await readFile(resolve(root, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+\.(?:js|css))"/g)].map((match) => match[1]);
if (!assets.length) throw new Error("UI build does not reference an initial JS or CSS asset.");

const limits = { js: 600 * 1024, css: 85 * 1024, gzip: 180 * 1024, fonts: 1024 * 1024 };
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
  { name: "list", entries: ["src/components/note-collection.tsx"], raw: 1250 * 1024, gzip: 380 * 1024 },
  { name: "detail", entries: ["src/Editor.tsx"], raw: 1750 * 1024, gzip: 520 * 1024 },
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
  if (/\.(?:js|css)$/.test(entry) && /radix/i.test(await readFile(resolve(root, "assets", entry), "utf8"))) {
    throw new Error(`Radix reference in shipped UI asset: ${entry}`);
  }
}
console.log(`UI bundle budget passed: ${assets.join(", ")} (${compressed} initial gzip bytes, ${fonts} font bytes).`);
