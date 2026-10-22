// Export the same Lucide geometry as H5 for the native iOS sidebar.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/ui/package.json", import.meta.url));
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const lucide = require("lucide-react");
const license = await readFile(join(dirname(require.resolve("lucide-react/package.json")), "LICENSE"), "utf8");
export const sidebarIconComponents = {
  house: "House", "note.text": "Notebook", calendar: "CalendarDays",
  number: "Hash", photo: "Image", link: "Link", gearshape: "Settings2",
  "chevron.right": "ChevronRight", magnifyingglass: "Search", xmark: "X",
};

export async function buildSidebarIcons({ check = false, outputRoot = root } = {}) {
  const stale = [];
  for (const [symbol, component] of Object.entries(sidebarIconComponents)) {
    // Keep bridge symbol names; only the sidebar replaces their artwork.
    const directory = `apps/apple/Resources/Assets.xcassets/Lucide-${symbol}.imageset`;
    const svg = renderToStaticMarkup(createElement(lucide[component], { color: "#000000" }));
    const outputs = {
      "icon.svg": `<!-- ${license.replace(/^---$/gm, "")} -->\n${svg}\n`,
      "Contents.json": JSON.stringify({
        images: [{ filename: "icon.svg", idiom: "universal" }],
        info: { author: "xcode", version: 1 },
        properties: { "preserves-vector-representation": true, "template-rendering-intent": "template" },
      }, null, 2) + "\n",
    };
    for (const [filename, content] of Object.entries(outputs)) {
      const destination = join(directory, filename), path = join(outputRoot, destination);
      let existing;
      try { existing = await readFile(path, "utf8"); } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (existing === content) continue;
      if (check) stale.push(destination);
      else {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content);
      }
    }
  }
  if (stale.length) throw new Error(`Sidebar icon outputs are missing or stale:\n${stale.join("\n")}\nRun pnpm icons:build.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => arg !== "--check")) throw new Error("Usage: node scripts/generate-sidebar-icons.mjs [--check]");
  await buildSidebarIcons({ check: args.includes("--check") });
  console.log(args.includes("--check") ? "Sidebar icon outputs are current." : "Generated sidebar icon assets.");
}
