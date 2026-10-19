import { before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, stat, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sampleSidebarPreviewPalette, writeSidebarPreviewPalette } from "./generate-sidebar-preview-palette.mjs";

let swift;
before(async () => { swift = await sampleSidebarPreviewPalette(); });

test("production default appearance generates the committed light and dark Preview palettes", async () => {
  assert.equal(swift, await readFile(new URL("../apps/apple/Sources/SidebarPreviewPalette.generated.swift", import.meta.url), "utf8"));
});

test("palette builds preserve unchanged mtimes and check mode never repairs missing or stale files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-palette-test-"));
  const outputPath = join(directory, "PreviewPalette.swift");
  try {
    await assert.rejects(writeSidebarPreviewPalette(swift, { outputPath, check: true }), /stale/);
    await assert.rejects(stat(outputPath), { code: "ENOENT" });
    await writeSidebarPreviewPalette(swift, { outputPath });
    const oldTime = new Date("2001-01-01T00:00:00Z");
    await utimes(outputPath, oldTime, oldTime);
    const unchangedMtime = (await stat(outputPath)).mtimeMs;
    await writeSidebarPreviewPalette(swift, { outputPath });
    await writeSidebarPreviewPalette(swift, { outputPath, check: true });
    assert.equal((await stat(outputPath)).mtimeMs, unchangedMtime);
    assert.equal(await readFile(outputPath, "utf8"), swift);

    await writeFile(outputPath, "stale palette");
    await utimes(outputPath, oldTime, oldTime);
    await assert.rejects(writeSidebarPreviewPalette(swift, { outputPath, check: true }), /stale/);
    assert.equal(await readFile(outputPath, "utf8"), "stale palette");
    assert.equal((await stat(outputPath)).mtimeMs, unchangedMtime);
    await writeSidebarPreviewPalette(swift, { outputPath });
    assert.equal(await readFile(outputPath, "utf8"), swift);
    assert.notEqual((await stat(outputPath)).mtimeMs, unchangedMtime);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
