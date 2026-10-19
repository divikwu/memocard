import { readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function checkTokenConsumption({ tokenPath = resolve(root, "design/tokens/sidebar.tokens.json"), mappingPath = resolve(root, "design/token-consumption.md") } = {}) {
  const source = JSON.parse(await readFile(tokenPath, "utf8"));
  const tokens = Object.entries(source).filter(([group]) => !group.startsWith("$"))
    .flatMap(([group, entries]) => Object.keys(entries).filter(key => !key.startsWith("$")).map(key => `${group}.${key}`));
  const content = await readFile(mappingPath, "utf8");
  const rows = [...content.matchAll(/^\| `((?:spacing|radius|sidebar)\.[^`]+)` \| ([^|]+) \|([^\n]+)$/gm)];
  const seen = new Set();
  for (const [, token, status, consumers] of rows) {
    if (!tokens.includes(token)) throw new Error(`Unknown mapped token: ${token}`);
    if (seen.has(token)) throw new Error(`Duplicate mapped token: ${token}`);
    if (!["active", "alias", "baseline-only"].includes(status.trim())) throw new Error(`Unknown consumption status: ${token}`);
    const platforms = consumers.trim().replace(/\|$/, "").split("|");
    if (platforms.length !== 2 || platforms.some(cell => !cell.trim())) throw new Error(`Missing platform consumption: ${token}`);
    seen.add(token);
  }
  const missing = tokens.filter(token => !seen.has(token));
  if (missing.length) throw new Error(`Unmapped tokens: ${missing.join(", ")}`);
  for (const [, link] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (link.startsWith("#") || /^[a-z]+:/i.test(link)) continue;
    await access(resolve(dirname(mappingPath), link.split("#")[0]));
  }
  return seen.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Token consumption map passed: ${await checkTokenConsumption()} portable tokens; linked sources exist.`);
}
