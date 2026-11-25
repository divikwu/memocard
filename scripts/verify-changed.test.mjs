import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { classifyDiff } from './ci-scope.mjs';
import { localChecks } from './verify-changed.mjs';

const planFor = (...paths) => classifyDiff(paths.map(path => ':100644 100644 a b M\0' + path + '\0').join(''));
const cli = fileURLToPath(new URL('./verify-changed.mjs', import.meta.url));

test('unit tests and smoke tests build the necessary Web assets once and skip native builds', () => {
  const checks = localChecks(planFor('apps/ui/ui/web/WebApp.test.tsx', 'scripts/test-default-ui.mjs'));
  assert.deepEqual(checks, ['--filter @memocard/ui typecheck', '--filter @memocard/ui lint', '--filter @memocard/ui test',
    '--filter @memocard/ui build', 'check:bundle', 'test:default-ui']);
  assert.deepEqual(localChecks(planFor('apps/ui/ui/web/WebApp.test.tsx')), checks.slice(0, 3));
  assert.deepEqual(localChecks(planFor('apps/apple/Service/ServiceHost.swift')), [
    '--filter @memocard/ui build', 'check:bundle', 'verify:native:all', 'build:service',
  ]);
});

test('production includes its consumers; fixture-only changes keep their browser and unit suites', () => {
  const checks = localChecks(planFor('apps/ui/ui/business/NoteSearchDialog.tsx', 'apps/ui/test-support/ui-quality.browser.tsx'));
  assert.deepEqual(checks, ['verify:design', 'verify:ui:preview', 'verify:web', 'build:mac', 'build:ios', 'build:service']);
  assert.deepEqual(localChecks(planFor('apps/ui/ui-state-fixtures/catalog.ts')), [
    'verify:design', 'verify:ui:preview', '--filter @memocard/ui typecheck', '--filter @memocard/ui lint', '--filter @memocard/ui test',
  ]);
  assert.deepEqual(localChecks(planFor('pnpm-lock.yaml')), [...checks.slice(0, 3),
    'verify:native:all', 'check:apple-project', 'test:native-surfaces', ...checks.slice(3)]);
});

test('CLI selects staged paths, previews without execution, and propagates the first failed check', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'memocard-staged-checks-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd });
  git('init', '-q');
  mkdirSync(join(cwd, 'bin'));
  writeFileSync(join(cwd, 'bin/pnpm'), '#!/bin/sh\necho "execute $*"\nexit "${TEST_EXIT:-0}"\n', { mode: 0o755 });
  const env = { ...process.env, PATH: join(cwd, 'bin') + delimiter + process.env.PATH };
  const run = (args, extra = {}) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', env: { ...env, ...extra } });
  writeFileSync(join(cwd, 'other.swift'), 'unstaged');
  const empty = run([]);
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /没有暂存改动/);
  writeFileSync(join(cwd, 'README.md'), 'staged');
  git('add', '--', 'README.md');
  const preview = run(['--plan']);
  assert.equal(preview.status, 0);
  assert.match(preview.stdout, /pnpm check:design-inventory/);
  assert.doesNotMatch(preview.stdout, /execute |verify:native/);
  const success = run([]);
  assert.equal(success.status, 0);
  assert.match(success.stdout, /execute test:design-inventory/);
  const failed = run([], { TEST_EXIT: '7' });
  assert.equal(failed.status, 7);
  assert.doesNotMatch(failed.stdout, /execute test:design-inventory/);
});
