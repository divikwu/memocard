import StyleDictionary from "style-dictionary";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const kebab = name => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const header = "Generated from design/tokens/sidebar.tokens.json. Run pnpm tokens:build; do not edit.";
const outputs = {
  "design-tokens.css": "apps/ui/src/generated/design-tokens.css",
  "design-tokens.ts": "apps/ui/src/generated/design-tokens.ts",
  "DesignTokens.generated.swift": "apps/apple/Sources/DesignTokens.generated.swift",
  "TOKENS.generated.md": "design/TOKENS.generated.md",
};

export function validateTokens(source) {
  const reserved = new Set("class struct enum protocol extension func var let init deinit import static self Self super case default switch return throw throws try catch do if else for while repeat break continue guard defer in is as associatedtype typealias operator subscript where public private internal fileprivate open final override lazy weak unowned some any true false nil".split(" "));
  for (const [groupName, group] of Object.entries(source)) {
    if (groupName.startsWith("$")) continue;
    if (!["spacing", "radius", "sidebar"].includes(groupName) || !group || typeof group !== "object") throw new Error(`Unsupported token group: ${groupName}`);
    for (const [name, token] of Object.entries(group)) {
      if (name.startsWith("$")) continue;
      if ((!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name) && !(groupName === "radius" && name === "2xl")) || reserved.has(name)) throw new Error(`Invalid platform token name: ${name}`);
      if (!token || typeof token !== "object" || Array.isArray(token) || !("$value" in token)) throw new Error(`Expected a flat token: ${groupName}.${name}`);
      const type = token.$type ?? group.$type;
      const value = token.$value;
      if (type !== "dimension") throw new Error(`Unsupported token type for ${name}: ${type}`);
      if (typeof value === "string" && /^\{[\w.]+\}$/.test(value)) continue;
      if (!value || value.unit !== "px" || !Number.isFinite(value.value) || value.value < 0) throw new Error(`Invalid dimension: ${name}`);
    }
  }
}

function values(dictionary, group) {
  return Object.fromEntries(dictionary.allTokens.filter(token => token.path[0] === group).map(token => [token.path[1], token.$value.value]));
}

StyleDictionary.registerFormat({ name: "memocard/css", format: ({ dictionary }) => {
  // Base spacing resolves aliases; native-only metrics do not ship as unused Web variables.
  const nativeOnly = new Set(["indent", "brandFontSize", "captionFontSize", "nativeLogoSize"]);
  const radii = values(dictionary, "radius");
  if (!Number.isFinite(radii.lg)) throw new Error("radius.lg is required for the default Web radius.");
  const declarations = [`  --radius: ${radii.lg / 16}rem;`, ...Object.entries(values(dictionary, "sidebar"))
    .filter(([name]) => !nativeOnly.has(name))
    .map(([name, value]) => `  --sidebar-${kebab(name)}: ${value}px;`)];
  const radius = Object.entries(radii).map(([name, value]) => `:root[data-radius="${name}"] { --radius: ${value / 16}rem; }`);
  return `/* ${header} */\n:root {\n${declarations.join("\n")}\n}\n${radius.join("\n")}\n`;
} });
StyleDictionary.registerFormat({ name: "memocard/ts", format: ({ dictionary }) => {
  return `// ${header}\n` + [["spacing", "spacingValues"], ["radius", "radiusValues"], ["sidebar", "sidebarTokens"]].map(([group, name]) => `export const ${name} = ${JSON.stringify(values(dictionary, group), null, 2)} as const;\n`).join("\n");
} });
StyleDictionary.registerFormat({ name: "memocard/swift", format: ({ dictionary }) => {
  return `// ${header}\nimport CoreGraphics\n\n` + [["radius", "DesignRadius"], ["sidebar", "SidebarTokens"]].map(([group, name]) => `enum ${name} {\n${Object.entries(values(dictionary, group)).map(([key, value]) => `    static let ${key === "2xl" ? "radius2xl" : key}: CGFloat = ${value}`).join("\n")}\n}\n`).join("\n");
} });
StyleDictionary.registerFormat({ name: "memocard/docs", format: ({ dictionary }) => {
  const rows = dictionary.allTokens.map(token => `| ${token.path.join(".")} | ${token.$value.value} | ${token.$description ?? ""} |`);
  return `<!-- ${header} -->\n# Portable sidebar tokens\n\nBaselines map to CSS logical pixels and native points. Radius CSS uses rem with the existing 16px baseline; this does not equate physical device pixels with points. Runtime colors and system control metrics are outside this table.\n\n| Token | Baseline | Purpose |\n| --- | ---: | --- |\n${rows.join("\n")}\n`;
} });

export async function buildTokens({ check = false, sourcePath = join(root, "design/tokens/sidebar.tokens.json"), outputRoot = root } = {}) {
  const tokens = JSON.parse(await readFile(sourcePath, "utf8"));
  validateTokens(tokens);
  const temporary = await mkdtemp(join(tmpdir(), "memocard-tokens-"));
  try {
    const formats = ["memocard/css", "memocard/ts", "memocard/swift", "memocard/docs"];
    const dictionary = new StyleDictionary({ tokens, usesDtcg: true, log: { verbosity: "silent", errors: { brokenReferences: "throw" } }, platforms: {
      generated: { buildPath: `${temporary}/`, files: Object.keys(outputs).map((destination, index) => ({ destination, format: formats[index] })) },
    } });
    await dictionary.buildAllPlatforms();
    for (const [filename, destination] of Object.entries(outputs)) {
      const content = await readFile(join(temporary, filename), "utf8"), path = join(outputRoot, destination);
      let existing;
      try { existing = await readFile(path, "utf8"); } catch { /* A missing generated file is stale too. */ }
      if (check) {
        if (existing !== content) throw new Error(`${destination} is stale. Run pnpm tokens:build.`);
      } else if (existing !== content) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content);
      }
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildTokens({ check: process.argv.includes("--check") });
  console.log(process.argv.includes("--check") ? "Design token outputs are current." : "Generated CSS, TS, Swift and token documentation.");
}
