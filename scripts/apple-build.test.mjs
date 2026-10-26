import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, delimiter } from 'node:path';

async function fixture(t, script) {
  const root = await mkdtemp(join(tmpdir(), 'memocard-apple-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await mkdir(join(root, 'scripts'));
  await copyFile(new URL(script, import.meta.url), join(root, 'scripts', script));
  const trace = join(root, 'commands.log');
  for (const command of ['pnpm', 'rsync', 'python3', 'xcodebuild', 'swift']) {
    await writeFile(join(bin, command), `#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
const command = ${JSON.stringify(command)};
appendFileSync(process.env.TEST_BUILD_TRACE, command + '\\n');
appendFileSync(process.env.TEST_BUILD_TRACE + '.jsonl', JSON.stringify({ command, args: process.argv.slice(2) }) + '\\n');
if (command === 'pnpm') {
  mkdirSync('apps/ui/dist', { recursive: true });
  writeFileSync('apps/ui/dist/index.html', 'fresh Web bundle');
}
if (command === 'rsync') {
  const args = process.argv.slice(2);
  cpSync(args.at(-2), args.at(-1), { recursive: true });
}
if (command === 'xcodebuild') {
  mkdirSync('build/service-apple/Build/Products/Release/MemoCardService.app', { recursive: true });
}
if (command === 'swift') {
  mkdirSync('build/service-cli/release', { recursive: true });
  writeFileSync('build/service-cli/release/memocard', 'test CLI');
}
`, { mode: 0o755 });
  }
  const env = { ...process.env, PATH: bin + delimiter + process.env.PATH, TEST_BUILD_TRACE: trace };
  delete env.MEMOCARD_USE_PREBUILT_UI;
  return {
    root,
    async bundle(text) {
      const path = join(root, 'apps/ui/dist/index.html');
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, text);
    },
    run(args, prebuilt = false) {
      return spawnSync('bash', [join(root, 'scripts', script), ...args], {
        cwd: root, env: prebuilt ? { ...env, MEMOCARD_USE_PREBUILT_UI: '1' } : env, encoding: 'utf8', timeout: 10_000,
      });
    },
    commands: () => readFile(trace, 'utf8').then(text => text.trim().split('\n')),
    invocations: () => readFile(trace + '.jsonl', 'utf8').then(text => text.trim().split('\n').map(line => JSON.parse(line))),
    staged: () => readFile(join(root, 'apps/apple/Resources/Web/index.html'), 'utf8'),
  };
}

test('service Release signing excludes injected debug entitlements without overriding its permissions', async t => {
  const f = await fixture(t, 'build-service.sh');
  await f.bundle('verified Web bundle');
  const result = f.run([], true);
  assert.equal(result.status, 0, result.stderr);
  const { args } = (await f.invocations()).find(invocation => invocation.command === 'xcodebuild');
  assert.equal(args[args.indexOf('-configuration') + 1], 'Release');
  assert.ok(args.includes('CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO'));
  assert.ok(!args.some(arg => arg.startsWith('CODE_SIGN_ENTITLEMENTS=')));
  assert.ok(!args.includes('CODE_SIGNING_ALLOWED=NO'));
});

for (const [name, script, args] of [
  ['macOS', 'build-apple.sh', ['mac']],
  ['iOS', 'build-apple.sh', ['ios']],
  ['service', 'build-service.sh', []],
]) {
  test(`${name} builds fresh Web resources by default`, async t => {
    const f = await fixture(t, script);
    await f.bundle('stale Web bundle');
    const result = f.run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await f.staged(), 'fresh Web bundle');
    assert.deepEqual((await f.commands()).slice(0, 4), ['pnpm', 'rsync', 'python3', 'xcodebuild']);
  });

  test(`${name} packages the existing bundle without compiling it again`, async t => {
    const f = await fixture(t, script);
    await f.bundle('verified Web bundle');
    const result = f.run(args, true);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await f.staged(), 'verified Web bundle');
    assert.deepEqual((await f.commands()).slice(0, 3), ['rsync', 'python3', 'xcodebuild']);
    assert.ok(!(await f.commands()).includes('pnpm'));
  });

  test(`${name} rejects missing or empty prebuilt resources before native work`, async t => {
    const f = await fixture(t, script);
    for (const empty of [false, true]) {
      if (empty) await f.bundle('');
      const result = f.run(args, true);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /requires a successful Web build/);
      await assert.rejects(f.commands(), { code: 'ENOENT' });
    }
  });
}
