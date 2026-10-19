import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { buildSidebarIcons } from "./generate-sidebar-icons.mjs";

const assets = "apps/apple/Resources/Assets.xcassets";

test("exports all ten Lucide sidebar icons with vector template metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-icons-test-"));
  try {
    await buildSidebarIcons({ outputRoot: directory });
    const names = await readdir(join(directory, assets));
    assert.deepEqual(names.sort(), ["calendar", "chevron.right", "gearshape", "house", "link", "magnifyingglass", "note.text", "number", "photo", "xmark"].map(symbol => `Lucide-${symbol}.imageset`).sort());
    for (const name of names) {
      const path = join(directory, assets, name);
      assert.match(await readFile(join(path, "icon.svg"), "utf8"), /<svg[^>]*viewBox="0 0 24 24"[^>]*stroke="#000000"/);
      assert.deepEqual(JSON.parse(await readFile(join(path, "Contents.json"), "utf8")), {
        images: [{ filename: "icon.svg", idiom: "universal" }],
        info: { author: "xcode", version: 1 },
        properties: { "preserves-vector-representation": true, "template-rendering-intent": "template" },
      });
    }
    await buildSidebarIcons({ outputRoot: directory, check: true });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("check mode reports missing SVGs and metadata without creating directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-icons-test-"));
  try {
    await assert.rejects(buildSidebarIcons({ outputRoot: directory, check: true }), error => {
      assert.match(error.message, /Lucide-house.imageset\/icon.svg/);
      assert.match(error.message, /Lucide-house.imageset\/Contents.json/);
      assert.match(error.message, /Run pnpm icons:build/);
      return true;
    });
    assert.deepEqual(await readdir(directory), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("check mode preserves drifted SVGs and metadata; build repairs their contents", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-icons-test-"));
  try {
    const options = { outputRoot: directory };
    await buildSidebarIcons(options);
    const paths = ["icon.svg", "Contents.json"].map(filename => join(directory, assets, "Lucide-house.imageset", filename));
    const expected = await Promise.all(paths.map(path => readFile(path, "utf8")));
    for (const path of paths) await writeFile(path, "manual change");
    const oldTime = new Date("2001-01-01T00:00:00Z");
    await Promise.all(paths.map(path => utimes(path, oldTime, oldTime)));
    const mtimes = await Promise.all(paths.map(async path => (await stat(path)).mtimeMs));
    await assert.rejects(buildSidebarIcons({ ...options, check: true }), error => {
      for (const path of ["icon.svg", "Contents.json"]) assert.ok(error.message.includes(`Lucide-house.imageset/${path}`));
      return true;
    });
    assert.deepEqual(await Promise.all(paths.map(path => readFile(path, "utf8"))), ["manual change", "manual change"]);
    assert.deepEqual(await Promise.all(paths.map(async path => (await stat(path)).mtimeMs)), mtimes);
    await buildSidebarIcons(options);
    assert.deepEqual(await Promise.all(paths.map(path => readFile(path, "utf8"))), expected);
    for (let index = 0; index < paths.length; index++) assert.notEqual((await stat(paths[index])).mtimeMs, mtimes[index]);
    await buildSidebarIcons({ ...options, check: true });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unchanged builds preserve every asset's mtime", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-icons-test-"));
  try {
    const options = { outputRoot: directory };
    await buildSidebarIcons(options);
    const names = await readdir(join(directory, assets));
    const paths = names.flatMap(name => ["icon.svg", "Contents.json"].map(filename => join(directory, assets, name, filename)));
    const oldTime = new Date("2001-01-01T00:00:00Z");
    await Promise.all(paths.map(path => utimes(path, oldTime, oldTime)));
    const mtimes = await Promise.all(paths.map(async path => (await stat(path)).mtimeMs));
    await buildSidebarIcons(options);
    await buildSidebarIcons({ ...options, check: true });
    assert.deepEqual(await Promise.all(paths.map(async path => (await stat(path)).mtimeMs)), mtimes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("CLI rejects unsupported and repeated arguments", () => {
  const script = fileURLToPath(new URL("./generate-sidebar-icons.mjs", import.meta.url));
  for (const args of [["--unknown"], ["--check=true"], ["--check", "--check"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage: node scripts\/generate-sidebar-icons.mjs \[--check\]/);
    assert.equal(result.stdout, "");
  }
});
