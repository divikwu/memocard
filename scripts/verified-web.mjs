import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function inventory(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
    const path = prefix + entry.name;
    if (entry.isDirectory()) return inventory(join(directory, entry.name), path + '/');
    assert.ok(entry.isFile(), `Web artifact contains a non-regular file: ${path}`);
    return [{ path, sha256: createHash('sha256').update(readFileSync(join(directory, entry.name))).digest('hex') }];
  });
}

function manifest(directory, commit) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  assert.ok(readFileSync(join(directory, 'index.html')).length, 'Web build requires a nonempty index.html');
  return { commit, files: inventory(directory) };
}

export function createArtifact(source, artifact, commit) {
  const expected = manifest(source, commit);
  mkdirSync(artifact, { recursive: true });
  cpSync(source, join(artifact, 'dist'), { recursive: true });
  assert.deepEqual(manifest(join(artifact, 'dist'), commit), expected);
  writeFileSync(join(artifact, 'manifest.json'), JSON.stringify(expected, null, 2) + '\n');
}

export function restoreArtifact(artifact, destination, commit) {
  const expected = JSON.parse(readFileSync(join(artifact, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest(join(artifact, 'dist'), commit), expected, 'Web artifact revision or file hashes do not match');
  rmSync(destination, { recursive: true, force: true });
  cpSync(join(artifact, 'dist'), destination, { recursive: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [operation, source, destination] = process.argv.slice(2);
  assert.ok(['create', 'restore'].includes(operation) && source && destination, 'Usage: verified-web.mjs create|restore source destination');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 30_000 }).trim();
  if (process.env.GITHUB_SHA) assert.equal(commit, process.env.GITHUB_SHA, 'Checkout does not match workflow revision');
  (operation === 'create' ? createArtifact : restoreArtifact)(resolve(source), resolve(destination), commit);
  console.log(`Verified Web artifact ${operation}: ${commit}`);
}
