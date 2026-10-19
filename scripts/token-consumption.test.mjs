import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTokenConsumption } from "./check-token-consumption.mjs";

test("the production consumption map covers all portable tokens and source links", async () => {
  assert.equal(await checkTokenConsumption(), 27);
});

test("consumption checks reject missing, duplicate, unknown and undocumented platform entries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memocard-token-map-"));
  try {
    const tokenPath = join(directory, "tokens.json"), mappingPath = join(directory, "map.md");
    await writeFile(tokenPath, JSON.stringify({ sidebar: { iconSize: { $value: { value: 16, unit: "px" } } } }));
    const row = "| `sidebar.iconSize` | active | CSS icon | Swift icon |\n";
    for (const [content, error] of [["", /Unmapped tokens/], [row + row, /Duplicate/], [row.replace("iconSize", "unknown"), /Unknown mapped/], [row.replace("active", "complete"), /Unknown consumption status/], [row.replace("Swift icon", ""), /Missing platform/], ["| `sidebar.iconSize` | active | CSS icon\n", /Missing platform/]]) {
      await writeFile(mappingPath, content);
      await assert.rejects(checkTokenConsumption({ tokenPath, mappingPath }), error);
    }
    await writeFile(mappingPath, row);
    assert.equal(await checkTokenConsumption({ tokenPath, mappingPath }), 1);
    await writeFile(mappingPath, row + "[missing](./missing.md)\n");
    await assert.rejects(checkTokenConsumption({ tokenPath, mappingPath }), /ENOENT/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
