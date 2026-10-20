import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createArtifact, restoreArtifact } from './verified-web.mjs';

const commit = 'a'.repeat(40);
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'memocard-web-artifact-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'source'), artifact = join(root, 'artifact'), destination = join(root, 'destination');
  mkdirSync(join(source, 'assets'), { recursive: true });
  mkdirSync(join(source, '.vite'));
  writeFileSync(join(source, '.vite/manifest.json'), '{"entry": "assets/app.js"}');
  writeFileSync(join(source, 'index.html'), '<script src="assets/app.js"></script>');
  writeFileSync(join(source, 'assets/app.js'), 'verified app');
  mkdirSync(destination);
  writeFileSync(join(destination, 'old.js'), 'stale build');
  return { root, source, artifact, destination };
}

test('restores a complete verified build and removes stale destination files', t => {
  const f = fixture(t);
  createArtifact(f.source, f.artifact, commit);
  restoreArtifact(f.artifact, f.destination, commit);
  assert.equal(readFileSync(join(f.destination, 'assets/app.js'), 'utf8'), 'verified app');
  assert.equal(readFileSync(join(f.destination, '.vite/manifest.json'), 'utf8'), '{"entry": "assets/app.js"}');
  assert.throws(() => readFileSync(join(f.destination, 'old.js')), { code: 'ENOENT' });
});

for (const corruption of ['commit', 'content', 'missing', 'hidden-file', 'extra', 'manifest', 'symlink']) {
  test(`rejects ${corruption} before touching the previous destination`, t => {
    const f = fixture(t);
    createArtifact(f.source, f.artifact, commit);
    const asset = join(f.artifact, 'dist/assets/app.js');
    if (corruption === 'content') writeFileSync(asset, 'changed');
    if (corruption === 'missing') rmSync(asset);
    if (corruption === 'hidden-file') rmSync(join(f.artifact, 'dist/.vite/manifest.json'));
    if (corruption === 'extra') writeFileSync(join(f.artifact, 'dist/extra.js'), 'unexpected');
    if (corruption === 'manifest') rmSync(join(f.artifact, 'manifest.json'));
    if (corruption === 'symlink') {
      rmSync(asset);
      symlinkSync(join(f.source, 'assets/app.js'), asset);
    }
    assert.throws(() => restoreArtifact(f.artifact, f.destination, corruption === 'commit' ? 'b'.repeat(40) : commit));
    assert.equal(readFileSync(join(f.destination, 'old.js'), 'utf8'), 'stale build');
  });
}

test('rejects empty entry points and symlinks when publishing', t => {
  const f = fixture(t);
  writeFileSync(join(f.source, 'index.html'), '');
  assert.throws(() => createArtifact(f.source, f.artifact, commit), /nonempty/);
  writeFileSync(join(f.source, 'index.html'), 'entry');
  symlinkSync(join(f.source, 'assets/app.js'), join(f.source, 'linked.js'));
  assert.throws(() => createArtifact(f.source, f.artifact, commit), /non-regular/);
});
