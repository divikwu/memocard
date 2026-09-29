import { readFile, readdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const root = resolve("apps/ui/dist");
const html = await readFile(resolve(root, "index.html"), "utf8");
const assets = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+\.(?:js|css))"/g)].map((match) => match[1]);
if (!assets.length) throw new Error("UI build does not reference an initial JS or CSS asset.");

const limits = { js: 600 * 1024, css: 85 * 1024, gzip: 210 * 1024, fonts: 1024 * 1024 };
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
const fontFiles = (await readdir(resolve(root, "assets"), { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.woff2?$/.test(entry.name));
let fonts = 0;
for (const entry of fontFiles) fonts += (await readFile(resolve(root, "assets", entry.name))).length;
if (fonts > limits.fonts) throw new Error(`Packaged fonts are ${fonts} bytes; the font budget is ${limits.fonts} bytes.`);
console.log(`UI bundle budget passed: ${assets.join(", ")} (${compressed} initial gzip bytes, ${fonts} font bytes).`);
