import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { classifyDiff, gatePasses, scopeForEvent } from './ci-scope.mjs';

const entry = (path, status = 'M', from = '100644', to = '100644') => `:${from} ${to} ${'a'.repeat(40)} ${'b'.repeat(40)} ${status}\0${path}\0`;

const platforms = ['mac', 'ios', 'service'];
const docsOnly = { design: 'docs', web: false, unit: false, smoke: false, native: false, surfaces: false, platforms: [] };
const full = { design: 'ui', web: true, unit: false, smoke: false, native: true, surfaces: true, platforms };
const core = { ...full, design: 'none', web: false };
const ui = { ...docsOnly, design: 'ui', web: true, platforms };
const nativeTests = { ...docsOnly, design: 'none', native: true };
const unit = { ...docsOnly, design: 'none', unit: true };
const smoke = { ...docsOnly, design: 'none', smoke: true };
const service = { ...nativeTests, platforms: ['service'] };

for (const path of ['README.md', 'docs/LOCAL_WEB.md', 'docs/example image.png', 'design/component-inventory.md', 'design/token-consumption.md']) {
  test(`documentation-only: ${path}`, () => assert.deepEqual(classifyDiff(entry(path)), docsOnly));
}
for (const path of ['apps/ui/.storybook/preview.tsx', 'apps/ui/.storybook/preview.css', 'apps/ui/ui/stories/button-docs.tsx', 'apps/ui/ui/stories/button.stories.tsx']) {
  test(`storybook: ${path}`, () => assert.deepEqual(classifyDiff(entry(path) + entry('README.md')), { ...docsOnly, design: 'ui' }));
}
for (const path of ['apps/apple/Sources/NativeChrome.swift', 'design/tokens/sidebar.tokens.json', 'design/TOKENS.generated.md', 'apps/ui/src/generated/tokens.css', 'package.json', 'pnpm-lock.yaml', 'apps/ui/package.json', 'scripts/build-apple.sh', 'apps/ui/vite.storybook.config.ts', '.github/workflows/verify.yml', 'docs/ui-reference/button.json', 'apps/ui/public/logo.png', 'new-unknown-file.md', 'apps/ui/ui/stories/../src/app.tsx']) {
  test(`full validation: ${path}`, () => assert.deepEqual(classifyDiff(entry('README.md') + entry(path)), full));
}
test('schedule source consumers and combine both sides of a rename or mixed change', () => {
  for (const [path, expected] of [
    ['apps/apple/Service/ServiceHost.swift', service], ['packages/local-service/Sources/memocard/main.swift', service],
    ['apps/apple/Tunnel/run-tunnel.sh', service], ['apps/apple/Tests/ServiceHostHarness.swift', nativeTests],
    ['packages/native-core/Tests/VaultStoreTests.swift', nativeTests], ['packages/native-core/Sources/MemoCardCore/VaultStore.swift', core],
    ['apps/ui/src/components/ui/button.tsx', ui], ['apps/ui/src/App.test.tsx', unit],
    ['apps/ui/ui/web/WebApp.test.tsx', unit], ['apps/ui/ui/business/NoteSearchDialog.tsx', ui],
    ['apps/ui/ui/web/layouts/rail.css', ui], ['scripts/test-default-ui.mjs', smoke],
    ['apps/ui/test-support/ui-quality.browser.tsx', { ...unit, design: 'ui' }],
    ['apps/ui/ui-state-fixtures/mock.test.ts', unit], ['apps/ui/ui/web/workspace-fixture.ts', { ...unit, design: 'ui' }],
  ]) assert.deepEqual(classifyDiff(entry(path)), expected, path);
  for (const pair of [['scripts/test-default-ui.mjs', 'apps/ui/ui/web/WebApp.test.tsx'],
    ['apps/ui/ui/web/WebApp.test.tsx', 'scripts/test-default-ui.mjs']]) {
    assert.deepEqual(classifyDiff(pair.map(path => entry(path)).join('')), { ...unit, smoke: true });
  }
  assert.deepEqual(classifyDiff(entry('apps/ui/test-support/ui-quality.browser.tsx') + entry('apps/ui/ui/business/NoteSearchDialog.tsx')), ui);
  assert.deepEqual(classifyDiff(entry('README.md') + entry('apps/apple/Service/ServiceHost.swift')), { ...service, design: 'docs' });
  assert.deepEqual(classifyDiff(entry('packages/native-core/Sources/Core.swift', 'D', '100644', '000000')
    + entry('apps/ui/src/app.tsx', 'A', '000000')), full);
});
test('empty, malformed, truncated, symlink and unsupported status fail closed', () => {
  for (const raw of ['', 'broken\0', entry('README.md').slice(0, -1), entry('README.md', 'T'), entry('README.md', 'M', '120000', '120000')]) assert.deepEqual(classifyDiff(raw), full);
});
test('additions and deletions support NUL-delimited paths', () => {
  assert.deepEqual(classifyDiff(entry('docs/first\nsecond.md', 'A', '000000') + entry('docs/old.md', 'D', '100644', '000000')), docsOnly);
});

function jobResults(plan, successful) {
  const needs = { changes: { result: 'success', outputs: { plan: JSON.stringify(plan) } } };
  for (const name of ['design', 'release-web', 'release-native', 'native-surfaces', 'native-build']) {
    needs[name] = { result: successful.includes(name) ? 'success' : 'skipped' };
  }
  return needs;
}

test('gate requires successes and skips for exactly the jobs selected', () => {
  for (const [plan, jobs] of [
    [docsOnly, ['design']], [unit, ['release-web']], [smoke, ['release-web']], [ui, ['design', 'release-web', 'native-build']],
    [nativeTests, ['release-native']], [service, ['release-native', 'release-web', 'native-build']],
    [core, ['release-native', 'release-web', 'native-build', 'native-surfaces']],
    [full, ['design', 'release-web', 'release-native', 'native-surfaces', 'native-build']],
  ]) {
    const needs = jobResults(plan, jobs);
    assert.ok(gatePasses(needs));
    for (const [job, { result }] of Object.entries(needs)) {
      for (const bad of ['success', 'failure', 'cancelled', 'skipped', undefined].filter(value => value !== result)) {
        assert.equal(gatePasses({ ...needs, [job]: { ...needs[job], result: bad } }), false);
      }
      const missing = { ...needs };
      delete missing[job];
      assert.equal(gatePasses(missing), false);
    }
  }
  const needs = jobResults(docsOnly, ['design']);
  for (const plan of [null, {}, { ...docsOnly, web: 'false' }, { ...docsOnly, platforms: ['unknown'] }]) {
    needs.changes.outputs.plan = JSON.stringify(plan);
    assert.equal(gatePasses(needs), false);
  }
  delete needs.changes.outputs.plan;
  assert.equal(gatePasses(needs), false);
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
  const push = (before, after) => ({ ref: 'refs/heads/main', before, after });
  assert.deepEqual(scopeForEvent('pull_request', pr(base, docs), cwd), docsOnly);
  assert.deepEqual(scopeForEvent('push', push(base, docs), cwd), full);
  assert.deepEqual(scopeForEvent('push', push(base, docs), cwd, base), docsOnly);
  const eventPath = join(cwd, 'event.json'), outputPath = join(cwd, 'output');
  writeFileSync(eventPath, JSON.stringify(pr(base, docs)));
  const script = fileURLToPath(new URL('./ci-scope.mjs', import.meta.url));
  execFileSync(process.execPath, [script], { cwd, env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: join(cwd, 'summary') } });
  assert.deepEqual(JSON.parse(readFileSync(outputPath, 'utf8').replace(/^plan=/, '')), docsOnly);
  assert.match(readFileSync(join(cwd, 'summary'), 'utf8'), /Verification scope/);
  const gate = jobResults(docsOnly, ['design']);
  execFileSync(process.execPath, [script, '--gate'], { env: { ...process.env, CI_NEEDS: JSON.stringify(gate) } });
  gate.design.result = 'failure';
  assert.throws(() => execFileSync(process.execPath, [script, '--gate'], { env: { ...process.env, CI_NEEDS: JSON.stringify(gate) }, stdio: 'pipe' }), error => error.status === 1);
  const production = commit('apps/ui/src/app.tsx', 'production');
  const latestDocs = commit('README.md', 'latest docs');
  assert.deepEqual(scopeForEvent('pull_request', pr(base, latestDocs), cwd), ui);
  assert.deepEqual(scopeForEvent('push', push(docs, latestDocs), cwd, docs), ui);
  assert.deepEqual(scopeForEvent('push', push(production, latestDocs), cwd, docs), full);
  assert.deepEqual(scopeForEvent('push', push(base, docs), cwd, base), full, 'checkout differs from the pushed revision');
  git('mv', 'apps/ui/src/app.tsx', 'docs/renamed.md');
  git('commit', '-qm', 'rename');
  const rename = git('rev-parse', 'HEAD');
  assert.deepEqual(scopeForEvent('pull_request', pr(latestDocs, rename), cwd), ui);
  assert.deepEqual(scopeForEvent('pull_request', pr(base, 'c'.repeat(40)), cwd), full);
  assert.deepEqual(scopeForEvent('push', push('0'.repeat(40), rename), cwd, '0'.repeat(40)), full);
  git('checkout', '-q', base);
  assert.deepEqual(scopeForEvent('push', push(rename, base), cwd, rename), full, 'force push to an older commit');
  assert.deepEqual(scopeForEvent('other', {}, cwd), full);
  assert.deepEqual(scopeForEvent('pull_request', pr(base, base), cwd), full);
});
