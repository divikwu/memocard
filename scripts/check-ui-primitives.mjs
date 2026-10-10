import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

async function filesAt(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesAt(path) : [path];
  }))).flat();
}

const files = ["apps/ui/package.json", "pnpm-lock.yaml", ...(await filesAt("apps/ui/src"))];
for (const file of files.filter(file => /\.(?:json|yaml|tsx?|css)$/.test(file))) {
  if (/radix/i.test(await readFile(file, "utf8"))) throw new Error(`Radix reference in active UI: ${file}`);
}
const config = JSON.parse(await readFile("apps/ui/components.json", "utf8"));
if (!config.style.startsWith("base-")) throw new Error("shadcn must generate Base UI components.");
console.log("UI primitives passed: Base UI only; no Radix in source, dependencies or lockfile.");
