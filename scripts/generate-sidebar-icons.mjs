// Export the same Lucide geometry as H5 for the native iOS sidebar.
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const require = createRequire(new URL("../apps/ui/package.json", import.meta.url));
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const lucide = require("lucide-react");
const license = await readFile(join(dirname(require.resolve("lucide-react/package.json")), "LICENSE"), "utf8");
const icons = {
  house: "House", "note.text": "Notebook", calendar: "CalendarDays",
  number: "Hash", photo: "Image", link: "Link", gearshape: "Settings2",
  "chevron.right": "ChevronRight", magnifyingglass: "Search", xmark: "X",
};

for (const [symbol, component] of Object.entries(icons)) {
  // Keep bridge symbol names; only the sidebar replaces their artwork.
  const directory = new URL(`../apps/apple/Resources/Assets.xcassets/Lucide-${symbol}.imageset/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  const svg = renderToStaticMarkup(createElement(lucide[component], { color: "#000000" }));
  await writeFile(new URL("icon.svg", directory), `<!-- ${license.replace(/^---$/gm, "")} -->\n${svg}\n`);
  await writeFile(new URL("Contents.json", directory), JSON.stringify({
    images: [{ filename: "icon.svg", idiom: "universal" }],
    info: { author: "xcode", version: 1 },
    properties: { "preserves-vector-representation": true, "template-rendering-intent": "template" },
  }, null, 2) + "\n");
}
