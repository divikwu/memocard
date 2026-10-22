import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, mkdir, stat, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { requestNativeWithBinding } from '../../mcp/src/native-client.ts';

let buildDirectory;
let executable;
before(async () => {
  assert.equal(process.platform, 'darwin');
  buildDirectory = await mkdtemp(join(tmpdir(), 'memocard-service-mcp-build-'));
  executable = join(buildDirectory, 'ServiceMCPServerHarness');
  await promisify(execFile)('xcrun', ['swiftc', '-swift-version', '5', '-strict-concurrency=complete', '-warnings-as-errors',
    ...['../Sources/LocalReadServer.swift', '../Sources/MCPAuthorization.swift', '../Service/ServiceMCPServer.swift',
      './ServiceMCPServerHarness.swift'].map(path => fileURLToPath(new URL(path, import.meta.url))), '-o', executable]);
});
after(async () => { if (buildDirectory) await rm(buildDirectory, { recursive: true, force: true }); });

async function service(t) {
  const root = await mkdtemp(join(tmpdir(), 'memocard-service-mcp-'));
  const directory = join(root, 'config');
  const vault = join(root, 'vault');
  await mkdir(directory); await mkdir(vault);
  const mainConfig = join(directory, 'connection.json');
  await writeFile(mainConfig, 'main-app-sentinel');
  const child = spawn(executable, [directory, vault], { stdio: ['pipe', 'pipe', 'pipe'] });
  const events = []; const waiters = [];
  let stderr = '';
  child.stderr.on('data', bytes => { stderr += bytes; });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    const value = JSON.parse(line);
    const index = waiters.findIndex(waiter => waiter.event === value.event);
    if (index < 0) events.push(value); else waiters.splice(index, 1)[0].resolve(value);
  });
  const wait = event => {
    const index = events.findIndex(value => value.event === event);
    if (index >= 0) return Promise.resolve(events.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Service event timeout: ${event}; ${stderr}`)), 5000);
      waiters.push({ event, resolve: value => { clearTimeout(timer); resolve(value); } });
    });
  };
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.stdin.end();
      const timeout = setTimeout(() => child.kill('SIGTERM'), 1000);
      await exited; clearTimeout(timeout);
    }
    lines.close();
    await rm(root, { recursive: true, force: true });
    assert.equal(stderr, '', 'Service must not log credentials or note data');
  });
  await wait('ready');
  const path = join(directory, 'service-connection.json');
  return { root, directory, vault, path, mainConfig, wait,
    config: () => readFile(path, 'utf8').then(JSON.parse),
    call: (operation, params = {}) => requestNativeWithBinding(path, operation, params),
    async command(action, args = {}) {
      const pending = wait('done'); child.stdin.write(JSON.stringify({ action, ...args }) + '\n'); return pending;
    },
  };
}

test('service has a private independent config and legacy read consent never grants writes', async t => {
  const host = await service(t);
  const config = await host.config();
  assert.equal(config.host, '127.0.0.1');
  assert.equal((await stat(host.path)).mode & 0o777, 0o600);
  assert.equal(await readFile(host.mainConfig, 'utf8'), 'main-app-sentinel');
  const status = await host.call('getStatus');
  for (const operation of ['createNote', 'updateNote', 'deleteNote', 'restoreNote']) {
    assert.ok(!status.data.capabilities.includes(operation));
    await assert.rejects(host.call(operation, { binding: status.binding }), { code: 'WRITE_DISABLED' });
  }
  assert.ok(status.data.capabilities.includes('getTrash'));
  assert.ok(status.data.capabilities.includes('getTrashedNote'));
  assert.deepEqual(status.binding, { vaultId: config.vaultId, instanceId: config.instanceId });
  await assert.rejects(host.call('createNote', { binding: status.binding, body: 'denied' }), { code: 'WRITE_DISABLED' });
  await assert.rejects(host.call('saveNote'), { code: 'OPERATION_DENIED' });
});

test('explicit consent survives service restart while old binding and credentials expire', async t => {
  const host = await service(t);
  assert.equal((await host.command('enable')).writes, true);
  const before = await host.call('getStatus'); const old = await host.config();
  assert.equal((await host.command('restart')).writes, true);
  const current = await host.call('getStatus'); const next = await host.config();
  assert.notEqual(old.instanceId, next.instanceId); assert.notEqual(old.token, next.token);
  const stalePath = join(host.root, 'old-credentials.json');
  await writeFile(stalePath, JSON.stringify({ ...old, port: next.port }), { mode: 0o600 });
  await assert.rejects(requestNativeWithBinding(stalePath, 'getStatus'), { code: 'UNAUTHORIZED' });
  for (const operation of ['createNote', 'updateNote', 'deleteNote', 'restoreNote']) {
    await assert.rejects(host.call(operation, { binding: before.binding, body: 'stale' }), { code: 'VAULT_CHANGED' });
    assert.equal((await host.call(operation, { binding: current.binding, echo: 'fresh' })).data.echo, 'fresh');
  }
});

test('switching the service vault rotates the exported binding even for a copied note ID', async t => {
  const host = await service(t); await host.command('enable');
  const before = await host.call('getStatus');
  await host.command('restart', { vaultID: 'service-vault-b' });
  const current = await host.call('getStatus');
  assert.equal(current.binding.vaultId, 'service-vault-b');
  await assert.rejects(host.call('updateNote', { binding: before.binding, id: 'same-note', baseHash: 'same-hash' }), { code: 'VAULT_CHANGED' });
  for (const operation of ['deleteNote', 'restoreNote']) {
    await assert.rejects(host.call(operation, { binding: before.binding, id: 'same-note', trashKey: 'same-key', baseHash: 'same-hash' }), { code: 'VAULT_CHANGED' });
  }
  assert.equal((await host.call('getNote')).data.vaultId, 'service-vault-b');
});

test('disabling service MCP revokes consent and re-enabling legacy reads remains read-only', async t => {
  const host = await service(t); await host.command('enable');
  const disabled = await host.command('disable');
  assert.equal(disabled.running, false); assert.equal(disabled.consent, false);
  await assert.rejects(host.call('getStatus'), error => ['HOST_UNAVAILABLE', 'UNAUTHORIZED'].includes(error.code));
  assert.equal((await host.command('legacy')).writes, false);
  const current = await host.call('getStatus');
  await assert.rejects(host.call('updateNote', { binding: current.binding }), { code: 'WRITE_DISABLED' });
});

test('in-flight reads cannot return data after the service instance is revoked', async t => {
  const host = await service(t);
  const waiting = host.wait('waiting');
  const read = host.call('getNote', { wait: true, echo: 'private-response' }).then(
    () => { throw new Error('Revoked request returned data'); },
    error => assert.ok(['HOST_UNAVAILABLE', 'UNAUTHORIZED', 'PROTOCOL_ERROR'].includes(error.code)),
  );
  await waiting; await host.command('restart'); await host.command('release'); await read;
  assert.equal((await host.call('getStatus')).data.vaultId, 'service-vault-a');
});

test('failed config publication cannot persist write consent or leave a live write listener', async t => {
  const host = await service(t);
  const directory = join(host.root, 'failed-export'); await mkdir(directory);
  await mkdir(join(directory, 'service-connection.json'));
  const state = await host.command('enable', { directory });
  assert.equal(state.error, 'INVALID_ARGUMENT'); assert.equal(state.consent, false); assert.equal(state.running, false);
});

test('service export rejects symlinks without touching the destination or granting writes', async t => {
  const host = await service(t);
  const directory = join(host.root, 'symlink-export'); await mkdir(directory);
  const target = join(host.root, 'sentinel'); await writeFile(target, 'unchanged');
  await symlink(target, join(directory, 'service-connection.json'));
  const state = await host.command('enable', { directory });
  assert.equal(state.error, 'INVALID_ARGUMENT'); assert.equal(state.consent, false);
  assert.equal(await readFile(target, 'utf8'), 'unchanged');
});

test('service export rejects vault, Git and iCloud directories', async t => {
  const host = await service(t);
  const repo = join(host.root, 'repo'); await mkdir(join(repo, '.git'), { recursive: true });
  const config = join(repo, 'config'); await mkdir(config);
  const cloud = join(host.root, 'Library/Mobile Documents/test'); await mkdir(cloud, { recursive: true });
  for (const directory of [host.vault, config, cloud]) {
    const state = await host.command('enable', { directory });
    assert.equal(state.error, 'INVALID_ARGUMENT'); assert.equal(state.consent, false); assert.equal(state.running, false);
  }
});

test('service MCP does not expose a deleted note', async t => {
  const host = await service(t);
  await assert.rejects(host.call('getNote', { deleted: 'fixture' }), { code: 'NOT_FOUND' });
});
