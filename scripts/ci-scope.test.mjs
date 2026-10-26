import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { classifyDiff, gatePasses, scopeForEvent } from './ci-scope.mjs';

const entry = (path, status = 'M', from = '100644', to = '100644') => `:${from} ${to} ${'a'.repeat(40)} ${'b'.repeat(40)} ${status}\0${path}\0`;

for (const path of ['README.md', 'docs/LOCAL_WEB.md', 'docs/example image.png', 'design/component-inventory.md', 'design/token-consumption.md', 'apps/ui/.storybook-next/preview.tsx', 'apps/ui/.storybook-next/preview.css', 'apps/ui/ui-next/stories/button-docs.tsx', 'apps/ui/ui-next/stories/button.stories.tsx']) {
  test(`documentation-only: ${path}`, () => assert.equal(classifyDiff(entry(path)).full, false));
}
for (const path of ['apps/ui/src/components/ui/button.tsx', 'apps/apple/Sources/NativeChrome.swift', 'design/tokens/sidebar.tokens.json', 'design/TOKENS.generated.md', 'apps/ui/src/generated/tokens.css', 'package.json', 'pnpm-lock.yaml', 'apps/ui/package.json', 'scripts/build-apple.sh', 'apps/ui/vite.storybook-next.config.ts', '.github/workflows/verify.yml', 'docs/ui-reference/button.json', 'apps/ui/public/logo.png', 'new-unknown-file.md', 'apps/ui/ui-next/stories/../src/app.tsx']) {
  test(`full validation: ${path}`, () => assert.equal(classifyDiff(entry('README.md') + entry(path)).full, true));
}
test('empty, malformed, truncated, symlink and unsupported status fail closed', () => {
  for (const raw of ['', 'broken\0', entry('README.md').slice(0, -1), entry('README.md', 'T'), entry('README.md', 'M', '120000', '120000')]) assert.equal(classifyDiff(raw).full, true);
});
test('additions and deletions support NUL-delimited paths', () => {
  assert.equal(classifyDiff(entry('docs/first\nsecond.md', 'A', '000000') + entry('docs/old.md', 'D', '100644', '000000')).full, false);
});
test('gate requires real successful applicable checks and rejects missing/cancelled/failed routing', () => {
  const needs = { changes: { result: 'success', outputs: { full: 'false' } }, design: { result: 'success' }, 'release-web': { result: 'skipped' }, 'release-native': { result: 'skipped' }, 'native-surfaces': { result: 'skipped' }, 'native-build': { result: 'skipped' } };
  assert.equal(gatePasses(needs), true);
  for (const job of ['release-web', 'release-native', 'native-surfaces', 'native-build']) {
    const changed = structuredClone(needs);
    changed[job].result = 'success';
    assert.equal(gatePasses(changed), false);
    delete changed[job];
    assert.equal(gatePasses(changed), false);
  }
  needs.changes.outputs.full = 'true';
  assert.equal(gatePasses(needs), false);
  needs['release-native'].result = 'success';
  assert.equal(gatePasses(needs), false);
  needs['release-web'].result = 'success';
  assert.equal(gatePasses(needs), false);
  needs['native-build'].result = 'success';
  assert.equal(gatePasses(needs), false);
  needs['native-surfaces'].result = 'success';
  assert.equal(gatePasses(needs), true);
  for (const job of Object.keys(needs)) {
    for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
      const changed = structuredClone(needs);
      changed[job].result = result;
      assert.equal(gatePasses(changed), false);
    }
  }
  for (const full of ['', undefined, 'invalid']) {
    needs.changes.outputs.full = full;
    assert.equal(gatePasses(needs), false);
  }
});
test('real PR ranges include history and renames; main pushes cannot skip superseded production checks', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'memocard-ci-scope-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (path, body) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), body);
    git('add', '--', path);
    git('commit', '-qm', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'CI test');
  const base = commit('README.md', 'base');
  const docs = commit('docs/guide.md', 'docs');
  const pr = (base, head) => ({ pull_request: { base: { sha: base }, head: { sha: head } } });
  assert.equal(scopeForEvent('pull_request', pr(base, docs), cwd).full, false);
  assert.equal(scopeForEvent('push', { before: base, after: docs }, cwd).full, true);
  const eventPath = join(cwd, 'event.json'), outputPath = join(cwd, 'output');
  writeFileSync(eventPath, JSON.stringify(pr(base, docs)));
  const script = fileURLToPath(new URL('./ci-scope.mjs', import.meta.url));
  execFileSync(process.execPath, [script], { cwd, env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: join(cwd, 'summary') } });
  assert.equal(readFileSync(outputPath, 'utf8'), 'full=false\n');
  assert.match(readFileSync(join(cwd, 'summary'), 'utf8'), /fast path/);
  const gate = { changes: { result: 'success', outputs: { full: 'false' } }, design: { result: 'success' }, 'release-web': { result: 'skipped' }, 'release-native': { result: 'skipped' }, 'native-surfaces': { result: 'skipped' }, 'native-build': { result: 'skipped' } };
  execFileSync(process.execPath, [script, '--gate'], { env: { ...process.env, CI_NEEDS: JSON.stringify(gate) } });
  gate.design.result = 'failure';
  assert.throws(() => execFileSync(process.execPath, [script, '--gate'], { env: { ...process.env, CI_NEEDS: JSON.stringify(gate) }, stdio: 'pipe' }), error => error.status === 1);
  const production = commit('apps/ui/src/app.tsx', 'production');
  const latestDocs = commit('README.md', 'latest docs');
  assert.equal(scopeForEvent('pull_request', pr(base, latestDocs), cwd).full, true);
  assert.equal(scopeForEvent('push', { before: production, after: latestDocs }, cwd).full, true);
  git('mv', 'apps/ui/src/app.tsx', 'docs/renamed.md');
  git('commit', '-qm', 'rename');
  const rename = git('rev-parse', 'HEAD');
  assert.equal(scopeForEvent('pull_request', pr(latestDocs, rename), cwd).full, true);
  assert.equal(scopeForEvent('pull_request', pr(base, 'c'.repeat(40)), cwd).full, true);
  assert.equal(scopeForEvent('push', { before: '0'.repeat(40), after: rename }, cwd).full, true);
  assert.equal(scopeForEvent('other', {}, cwd).full, true);
  assert.equal(scopeForEvent('pull_request', pr(base, base), cwd).full, true);
});
