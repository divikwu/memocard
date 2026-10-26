import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { expect, it } from "vitest";

const uiRoot = fileURLToPath(new URL("../../", import.meta.url));
const retired = path.join(uiRoot, "preview");

it("keeps the retired preview absent and uses the current preview configuration", () => {
  expect(existsSync(retired)).toBe(false);
  const { scripts } = JSON.parse(readFileSync(path.join(uiRoot, "package.json"), "utf8"));
  expect(scripts["dev:states"]).toBe("vite --config vite.preview.config.ts");
  expect(existsSync(path.join(uiRoot, "vite.preview.config.ts"))).toBe(true);
});

it("keeps retired UI source, generated Web tokens and stories absent", () => {
  for (const entry of ["src/components/ui", "src/lib/utils.ts", "src/generated/design-tokens.css", "src/generated/design-tokens.ts", "stories"]) {
    expect(existsSync(path.join(uiRoot, entry)), entry).toBe(false);
  }
});

it("has no active relative module dependency on the retired preview", () => {
  const pending = ["src", "ui", "ui-state-fixtures", "mascot-fixtures", "test-support", ".storybook"].map(folder => path.join(uiRoot, folder));
  while (pending.length) {
    const folder = pending.pop()!;
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) { pending.push(file); continue; }
      if (!/\.[jt]sx?$/.test(file)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(/(?:from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']/g)) {
        const resolved = path.resolve(path.dirname(file), match[1]);
        expect(resolved === retired || resolved.startsWith(`${retired}${path.sep}`), `${file} imports ${match[1]}`).toBe(false);
      }
    }
  }
});
