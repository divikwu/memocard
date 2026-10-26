import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { componentPath, defaultBaseline, readBaseline, rebaseImports } from "./benchmark-sidebar-tags.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

test("reads the exact requested revision and clearly rejects pre-UI-next sources", t => {
  const repository = mkdtempSync(join(tmpdir(), "memocard-benchmark-git-"));
  t.after(() => rmSync(repository, { recursive: true, force: true }));
  const git = args => execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const commit = (path, source) => {
    mkdirSync(dirname(join(repository, path)), { recursive: true });
    writeFileSync(join(repository, path), source);
    git(["add", "--", path]);
    git(["commit", "-qm", "fixture"]);
    return git(["rev-parse", "HEAD"]);
  };
  git(["init", "-q"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Benchmark Test"]);
  const legacy = commit("apps/ui/src/components/tag-navigation.tsx", "legacy implementation\n");
  const source = 'export const TagNavigation = "published source";\n';
  const published = commit(componentPath, source);
  commit(componentPath, 'export const TagNavigation = "newer source";\n');
  assert.deepEqual(readBaseline(published, repository), { commit: published, source });
  assert.throws(() => readBaseline(legacy, repository), /compares UI-next component sources.*Legacy UI dependencies are not restored/);
  assert.throws(() => readBaseline("missing-baseline", repository), /Cannot resolve baseline.*Fetch that commit/);
  assert.equal(defaultBaseline, "de51cec");
});

test("rebases every relative static and lazy dependency without changing package imports", () => {
  const source = `import { useState } from "react";
import { indexTags } from "../../src/components/tag-tree-index";
import { useSidebar } from '../components/sidebar';
const loadEditor = () => import("./tag-navigation-editor");
import "./sidebar.css";
`;
  const captured = rebaseImports(source);
  assert.ok(captured.includes('from "react"'));
  for (const relative of ["../../src/components/tag-tree-index", "../components/sidebar", "./tag-navigation-editor", "./sidebar.css"]) {
    const absolute = resolve(root, dirname(componentPath), relative);
    assert.ok(captured.includes(JSON.stringify(absolute)), relative);
  }
  assert.throws(() => rebaseImports('import "./retired-component";'), /Historical dependency.*no longer exists/);
});

test("both the real current module and a relocated snapshot render with the benchmark mocks", { timeout: 30_000 }, t => {
  mkdirSync(join(root, "build"), { recursive: true });
  const output = mkdtempSync(join(root, "build", "benchmark-regression-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  const snapshot = join(output, "snapshot.tsx");
  writeFileSync(snapshot, rebaseImports(readFileSync(join(root, componentPath), "utf8")));
  for (const [label, source] of [["snapshot", snapshot], ["current", join(root, componentPath)]]) {
    const reportPath = join(output, `${label}.json`);
    execFileSync("pnpm", ["--filter", "@memocard/ui", "exec", "vitest", "run", "--config", "benchmarks/vitest.config.ts"], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20_000,
      env: { ...process.env, MEMOCARD_TAG_BENCH_SOURCE: source, MEMOCARD_TAG_BENCH_LABEL: label, MEMOCARD_TAG_BENCH_OUTPUT: reportPath, MEMOCARD_TAG_BENCH_SIZES: "10" },
    });
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.equal(report.label, label);
    assert.deepEqual(report.results.map(({ shape, size }) => [shape, size]), [["flat", 10], ["branches", 10], ["missing-parents", 10]]);
    for (const result of report.results) {
      assert.equal(result.samples, 11);
      assert.equal(result.timingsMs.length, 11);
      assert.equal(result.visits, 10);
    }
  }
});
