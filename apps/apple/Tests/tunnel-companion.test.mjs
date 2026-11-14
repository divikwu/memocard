import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
let root, executable;
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'memocard-tunnel-tests-'));
  executable = join(root, 'harness');
  const main = join(root, 'main.swift');
  await writeFile(main, `import Foundation
let app = URL(fileURLWithPath: CommandLine.arguments[1])
let companion = TunnelCompanion(appURL: app, isServiceRunning: { _ in
    FileManager.default.fileExists(atPath: app.appendingPathComponent("service-running").path)
})
companion.start()
RunLoop.main.run()
`);
  await exec('swiftc', [fileURLToPath(new URL('../Tunnel/TunnelCompanion.swift', import.meta.url)), main, '-o', executable], { timeout: 60_000 });
});
after(async () => { if (root) await rm(root, { recursive: true, force: true }); });

const alive = pid => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
async function until(check, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail('Timed out waiting for tunnel lifecycle transition');
}
async function fixture(t, stubborn = false) {
  const app = await mkdtemp(join(root, 'app-'));
  const resources = join(app, 'Contents/Resources');
  await mkdir(resources, { recursive: true });
  const pidFile = join(app, 'tunnel.pid');
  const flag = join(app, 'service-running');
  await writeFile(join(resources, 'run-tunnel.sh'), `#!/bin/sh
${stubborn ? "trap '' TERM" : ''}
echo $$ > "$TEST_TUNNEL_PID"
${stubborn ? 'while :; do sleep 1; done' : 'exec /bin/sleep 300'}
`);
  const child = spawn(executable, [app], {
    detached: true, env: { ...process.env, TEST_TUNNEL_PID: pidFile }, stdio: 'ignore',
  });
  t.after(async () => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    await until(() => child.exitCode !== null || child.signalCode !== null);
  });
  const pid = () => readFile(pidFile, 'utf8').then(Number).catch(() => null);
  const start = async () => {
    const previous = await pid();
    await writeFile(flag, 'running');
    await until(async () => (await pid()) !== previous && alive(await pid()));
    return pid();
  };
  return { child, pid, start, stop: () => rm(flag), pidFile };
}

test('tunnel follows service state, recovers from a crash and inherits the supervisor process group', { timeout: 45_000 }, async t => {
  const f = await fixture(t);
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(await f.pid(), null, 'must not connect while MemoCard is stopped');
  const first = await f.start();
  const group = Number((await exec('ps', ['-o', 'pgid=', '-p', String(first)])).stdout.trim());
  assert.equal(group, f.child.pid, 'launchd must own the tunnel group even if the helper crashes');
  process.kill(first, 'SIGKILL');
  await until(async () => (await f.pid()) !== first && alive(await f.pid()));
  const second = await f.pid();
  await f.stop();
  await until(() => !alive(second));
  assert.equal(await f.pid(), second);
  const third = await f.start();
  process.kill(f.child.pid, 'SIGTERM');
  await until(() => f.child.exitCode !== null);
  assert.equal(f.child.exitCode, 0);
  assert.equal(alive(third), false, 'shutdown must reap the child, not leave a running tunnel');
});

test('service shutdown forcibly stops a tunnel that ignores SIGTERM', { timeout: 30_000 }, async t => {
  const f = await fixture(t, true);
  const pid = await f.start();
  await f.stop();
  await until(() => !alive(pid));
  assert.equal(alive(f.child.pid), true, 'the companion remains ready for MemoCard to reopen');
});
