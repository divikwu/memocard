import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export const defaultBaseline = "de51cec";
export const componentPath = "apps/ui/ui-next/business/tag-navigation.tsx";
const hash = source => createHash("sha256").update(source).digest("hex");

export function readBaseline(ref = defaultBaseline, repository = root) {
  const git = args => execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  let commit;
  try { commit = git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).trim(); }
  catch { throw new Error(`Cannot resolve baseline ${ref}. Fetch that commit or use the published UI-next baseline ${defaultBaseline}.`); }
  try { return { commit, source: git(["show", `${commit}:${componentPath}`]) }; }
  catch { throw new Error(`Baseline ${ref} has no ${componentPath}. This benchmark compares UI-next component sources; use ${defaultBaseline} or a later UI-next revision. Legacy UI dependencies are not restored.`); }
}

export function rebaseImports(source, repository = root) {
  // Only the captured module is historical. Both runs use today's shared helpers
  // and the same mocked presentation/storage, rather than copying another UI tree.
  const directory = dirname(resolve(repository, componentPath));
  return source.replace(/\b(from\s*|import\s*\(\s*|import\s*)(["'])(\.[^"']+)\2/g, (_match, prefix, _quote, specifier) => {
    const target = resolve(directory, specifier);
    if (!["", ".ts", ".tsx", ".js", ".jsx"].some(suffix => existsSync(target + suffix))) {
      throw new Error(`Historical dependency ${specifier} no longer exists at ${target}. Choose a compatible UI-next baseline.`);
    }
    return prefix + JSON.stringify(target.replaceAll("\\", "/"));
  });
}

function run() {
  const [baselineRef = defaultBaseline, directory = "build/verification/performance/sidebar-tags", ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error("Usage: node scripts/benchmark-sidebar-tags.mjs [baseline-ref] [output-directory]");
  const baseline = readBaseline(baselineRef);
  const captured = rebaseImports(baseline.source);
  const output = resolve(root, directory);
  const baselineModule = resolve(output, "tag-navigation-baseline.tsx");
  mkdirSync(output, { recursive: true });
  for (const name of ["baseline.json", "current.json"]) rmSync(resolve(output, name), { force: true });
  writeFileSync(baselineModule, captured);
  try {
    writeFileSync(resolve(output, "metadata.json"), JSON.stringify({
      baselineCommit: baseline.commit,
      workingTreeHead: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      component: componentPath,
      baselineSourceSHA256: hash(baseline.source),
      sourceSHA256: Object.fromEntries([componentPath, "apps/ui/src/components/tag-tree-index.ts", "apps/ui/benchmarks/tag-navigation.performance.tsx", "apps/ui/benchmarks/vitest.config.ts"].map(path => [path, hash(readFileSync(resolve(root, path)))])),
      scope: "Historical/current TagNavigation module sources with current shared dependencies and identical mocked presentation/storage; serial SSR cold mounts exclude DOM/layout, do not compare complete historical apps and are not frame-rate measurements.",
    }, null, 2) + "\n");
    for (const [label, module] of [["baseline", baselineModule], ["current", resolve(root, componentPath)]]) {
      console.log(`Measuring ${label} TagNavigation (2 warmups, 11 samples per fixture).`);
      execFileSync("pnpm", ["--filter", "@memocard/ui", "exec", "vitest", "run", "--config", "benchmarks/vitest.config.ts"], {
        cwd: root, stdio: "inherit", env: { ...process.env, MEMOCARD_TAG_BENCH_SOURCE: module, MEMOCARD_TAG_BENCH_LABEL: label, MEMOCARD_TAG_BENCH_OUTPUT: resolve(output, `${label}.json`) },
      });
    }
  } finally { rmSync(baselineModule, { force: true }); }
  console.log(`TagNavigation baseline/current reports: ${output}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
