import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [baselineRef = "a53fb0a", directory = "build/verification/performance/sidebar-tags", ...extra] = process.argv.slice(2);
if (extra.length) throw new Error("Usage: node scripts/benchmark-sidebar-tags.mjs [baseline-ref] [output-directory]");
const output = resolve(root, directory);
const sourcePath = "apps/ui/ui-next/business/tag-navigation.tsx";
const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const baselineCommit = git(["rev-parse", baselineRef]);
const source = execFileSync("git", ["show", `${baselineCommit}:${sourcePath}`], { cwd: root, encoding: "utf8" });
const baselineModule = resolve(output, "tag-navigation-baseline.tsx");
mkdirSync(output, { recursive: true });
// The captured production component is unchanged apart from resolving its two
// relative imports from the temporary module location. No tracked source moves.
writeFileSync(baselineModule, source.replaceAll('"./sidebar-tree-item"', '"@/components/sidebar-tree-item"').replaceAll('"./tag-editor"', '"@/components/tag-editor"'));
writeFileSync(resolve(output, "metadata.json"), JSON.stringify({
  baselineCommit, workingTreeHead: git(["rev-parse", "HEAD"]),
  component: sourcePath,
  sourceSHA256: Object.fromEntries([sourcePath, "apps/ui/src/components/tag-tree-index.ts", "apps/ui/benchmarks/tag-navigation.performance.tsx", "apps/ui/benchmarks/vitest.config.ts"].map(path => [path, createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex")])),
  scope: "Serial production component source comparison in one runner; UI primitives/storage mocked; SSR excludes DOM/layout and is not frame-rate measurement.",
}, null, 2) + "\n");
try {
  for (const [label, module] of [["baseline", baselineModule], ["current", resolve(root, sourcePath)]]) {
    console.log(`Measuring ${label} TagNavigation (2 warmups, 11 samples per fixture).`);
    execFileSync("pnpm", ["--filter", "@memocard/ui", "exec", "vitest", "run", "--config", "benchmarks/vitest.config.ts"], {
      cwd: root, stdio: "inherit", env: { ...process.env, MEMOCARD_TAG_BENCH_SOURCE: module, MEMOCARD_TAG_BENCH_LABEL: label, MEMOCARD_TAG_BENCH_OUTPUT: resolve(output, `${label}.json`) },
    });
  }
} finally {
  rmSync(baselineModule, { force: true });
}
console.log(`TagNavigation baseline/current reports: ${output}`);
