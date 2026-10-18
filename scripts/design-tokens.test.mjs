import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTokens, validateTokens } from "./build-design-tokens.mjs";

test("rejects invalid dimensions rather than emitting unusable platform values", () => {
  for (const value of [{ value: -1, unit: "px" }, { value: 16, unit: "pt" }, { value: "16", unit: "px" }]) {
    assert.throws(() => validateTokens({ sidebar: { $type: "dimension", icon: { $value: value } } }), /Invalid dimension/);
  }
});

test("rejects nested groups and names that cannot be represented by the platform outputs", () => {
  const token = { $value: { value: 16, unit: "px" } };
  for (const entries of [{ mobile: { rowHeight: token } }, { "row-height": token }, { class: token }]) {
    assert.throws(() => validateTokens({ sidebar: { $type: "dimension", ...entries } }), /flat token|platform token name/);
  }
});

test("shared aliases resolve in both platforms and check mode detects drift without overwriting it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-token-test-"));
  try {
    const sourcePath = join(directory, "tokens.json");
    await writeFile(sourcePath, JSON.stringify({ spacing: { $type: "dimension", base: { $value: { value: 20, unit: "px" } } }, sidebar: { $type: "dimension", iconSize: { $value: "{spacing.base}" } }, radius: { $type: "dimension", lg: { $value: { value: 10, unit: "px" } } } }));
    const options = { sourcePath, outputRoot: directory };
    await buildTokens(options);
    const css = await readFile(join(directory, "apps/ui/src/generated/design-tokens.css"), "utf8");
    assert.match(css, /--sidebar-icon-size: 20px/);
    assert.doesNotMatch(css, /--design-spacing-/);
    assert.match(css, /--radius: 0.625rem/);
    assert.match(css, /:root\[data-radius="lg"\] \{ --radius: 0.625rem; \}/);
    assert.match(await readFile(join(directory, "apps/apple/Sources/DesignTokens.generated.swift"), "utf8"), /iconSize: CGFloat = 20/);
    await buildTokens({ ...options, check: true });
    const path = join(directory, "apps/ui/src/generated/design-tokens.ts");
    await writeFile(path, "manual change");
    await assert.rejects(buildTokens({ ...options, check: true }), /stale/);
    assert.equal(await readFile(path, "utf8"), "manual change");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("broken token aliases fail the build", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-token-test-"));
  try {
    const sourcePath = join(directory, "tokens.json");
    await writeFile(sourcePath, JSON.stringify({ sidebar: { $type: "dimension", iconSize: { $value: "{missing.token}" } } }));
    await assert.rejects(buildTokens({ sourcePath, outputRoot: directory }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unchanged builds preserve generated file mtimes and changed tokens still update both platforms", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-token-test-"));
  try {
    const sourcePath = join(directory, "tokens.json");
    const tokens = { sidebar: { $type: "dimension", iconSize: { $value: { value: 16, unit: "px" } } }, radius: { $type: "dimension", lg: { $value: { value: 10, unit: "px" } } } };
    await writeFile(sourcePath, JSON.stringify(tokens));
    const options = { sourcePath, outputRoot: directory };
    await buildTokens(options);
    const paths = ["apps/ui/src/generated/design-tokens.css", "apps/ui/src/generated/design-tokens.ts", "apps/apple/Sources/DesignTokens.generated.swift", "design/TOKENS.generated.md"].map(path => join(directory, path));
    const oldTime = new Date("2001-01-01T00:00:00Z");
    await Promise.all(paths.map(path => utimes(path, oldTime, oldTime)));
    const mtimes = await Promise.all(paths.map(async path => (await stat(path)).mtimeMs));
    await buildTokens(options);
    assert.deepEqual(await Promise.all(paths.map(async path => (await stat(path)).mtimeMs)), mtimes);
    tokens.sidebar.iconSize.$value.value = 20;
    await writeFile(sourcePath, JSON.stringify(tokens));
    await buildTokens(options);
    assert.notEqual((await stat(paths[0])).mtimeMs, mtimes[0]);
    assert.notEqual((await stat(paths[2])).mtimeMs, mtimes[2]);
    assert.match(await readFile(paths[0], "utf8"), /--sidebar-icon-size: 20px/);
    assert.match(await readFile(paths[2], "utf8"), /iconSize: CGFloat = 20/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
