import { test } from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, writeFile, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

test("aliases resolve into native constants and documentation without recreating retired Web outputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-token-test-"));
  try {
    const sourcePath = join(directory, "tokens.json");
    await writeFile(sourcePath, JSON.stringify({ spacing: { $type: "dimension", base: { $value: { value: 20, unit: "px" } } }, sidebar: { $type: "dimension", iconSize: { $value: "{spacing.base}" } }, radius: { $type: "dimension", lg: { $value: { value: 10, unit: "px" } } } }));
    const options = { sourcePath, outputRoot: directory };
    await buildTokens(options);
    assert.match(await readFile(join(directory, "apps/apple/Sources/DesignTokens.generated.swift"), "utf8"), /iconSize: CGFloat = 20/);
    assert.match(await readFile(join(directory, "design/TOKENS.generated.md"), "utf8"), /\| sidebar.iconSize \| 20 \|/);
    await assert.rejects(access(join(directory, "apps/ui/src/generated")), { code: "ENOENT" });
    await buildTokens({ ...options, check: true });
    const path = join(directory, "apps/apple/Sources/DesignTokens.generated.swift");
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

test("production constants retain the native logo, row height and missing-payload radius fallback", async () => {
  const sourcePath = fileURLToPath(new URL("../design/tokens/sidebar.tokens.json", import.meta.url));
  const tokens = JSON.parse(await readFile(sourcePath, "utf8"));
  assert.equal(tokens.sidebar.nativeLogoSize?.$value.value, 28);
  const directory = await mkdtemp(join(tmpdir(), "memocard-logo-token-test-"));
  try {
    await buildTokens({ sourcePath, outputRoot: directory });
    const swift = await readFile(join(directory, "apps/apple/Sources/DesignTokens.generated.swift"), "utf8");
    const pointValues = Object.fromEntries([...swift.matchAll(/static let (\w+): CGFloat = ([\d.]+)/g)].map(([, name, value]) => [name, Number(value)]));
    assert.equal(pointValues.nativeLogoSize, 28);
    assert.equal(pointValues.mobileRowMinHeight, 48);
    assert.equal(pointValues.lg, 10);
    assert.equal(swift, await readFile(new URL("../apps/apple/Sources/DesignTokens.generated.swift", import.meta.url), "utf8"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("the native sidebar fallback must exist before emitting Swift", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-native-token-test-"));
  try {
    const sourcePath = join(directory, "tokens.json");
    await writeFile(sourcePath, JSON.stringify({ sidebar: { $type: "dimension", iconSize: { $value: { value: 16, unit: "px" } } } }));
    await assert.rejects(buildTokens({ sourcePath, outputRoot: directory }), /native sidebar fallback/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unchanged builds preserve mtimes and changed tokens update native constants and documentation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-token-test-"));
  try {
    const sourcePath = join(directory, "tokens.json");
    const tokens = { sidebar: { $type: "dimension", iconSize: { $value: { value: 16, unit: "px" } } }, radius: { $type: "dimension", lg: { $value: { value: 10, unit: "px" } } } };
    await writeFile(sourcePath, JSON.stringify(tokens));
    const options = { sourcePath, outputRoot: directory };
    await buildTokens(options);
    const paths = ["apps/apple/Sources/DesignTokens.generated.swift", "design/TOKENS.generated.md"].map(path => join(directory, path));
    const oldTime = new Date("2001-01-01T00:00:00Z");
    await Promise.all(paths.map(path => utimes(path, oldTime, oldTime)));
    const mtimes = await Promise.all(paths.map(async path => (await stat(path)).mtimeMs));
    await buildTokens(options);
    assert.deepEqual(await Promise.all(paths.map(async path => (await stat(path)).mtimeMs)), mtimes);
    tokens.sidebar.iconSize.$value.value = 20;
    await writeFile(sourcePath, JSON.stringify(tokens));
    await buildTokens(options);
    assert.notEqual((await stat(paths[0])).mtimeMs, mtimes[0]);
    assert.notEqual((await stat(paths[1])).mtimeMs, mtimes[1]);
    assert.match(await readFile(paths[0], "utf8"), /iconSize: CGFloat = 20/);
    assert.match(await readFile(paths[1], "utf8"), /\| sidebar.iconSize \| 20 \|/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
