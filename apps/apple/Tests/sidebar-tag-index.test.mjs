import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
let buildDirectory;
let executable;

before(async () => {
  assert.equal(process.platform, 'darwin', 'These tests compile the production Swift sidebar index.');
  buildDirectory = await mkdtemp(join(tmpdir(), 'memocard-sidebar-tags-'));
  executable = join(buildDirectory, 'SidebarTagIndexHarness');
  await run('xcrun', ['swiftc', '-O', '-swift-version', '5', '-strict-concurrency=complete', '-warnings-as-errors',
    fileURLToPath(new URL('../Sources/NativeSidebar.swift', import.meta.url)),
    fileURLToPath(new URL('./SidebarTagIndexHarness.swift', import.meta.url)), '-o', executable]);
});
after(async () => { if (buildDirectory) await rm(buildDirectory, { recursive: true, force: true }); });

for (const [name, scenario] of [
  ['roots retain input order and optional or empty paths', 'roots'],
  ['children include only direct descendants in input order', 'children'],
  ['orphans, pinned paths, duplicate paths and empty parents retain behavior', 'orphans-and-duplicates'],
  ['Unicode paths retain Swift String canonical and grapheme behavior', 'unicode'],
  ['reordered, removed and replaced actions always use current-array positions', 'replacement'],
  ['1340 varied paths match the previous native hierarchy filter', 'equivalence'],
]) {
  test(name, async () => {
    const result = await run(executable, [scenario]);
    assert.equal(result.stdout, 'PASS\n');
    assert.equal(result.stderr, '');
  });
}
