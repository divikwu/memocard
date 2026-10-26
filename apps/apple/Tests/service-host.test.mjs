import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, mkdir, writeFile, copyFile, stat, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { requestNativeWithBinding } from '../../mcp/src/native-client.ts';

const requireMCP = createRequire(new URL('../../mcp/package.json', import.meta.url));
const { Client } = requireMCP('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = requireMCP('@modelcontextprotocol/sdk/client/stdio.js');
const repository = fileURLToPath(new URL('../../../', import.meta.url));
let buildDirectory;
let executable;
before(async () => {
  assert.equal(process.platform, 'darwin');
  buildDirectory = await mkdtemp(join(tmpdir(), 'memocard-service-host-build-'));
  const sources = join(buildDirectory, 'Sources/ServiceHostHarness');
  await mkdir(sources, { recursive: true });
  for (const source of ['Service/ServiceHost.swift', 'Service/ServiceMCPServer.swift',
    'Sources/LocalReadServer.swift', 'Sources/MCPAuthorization.swift', 'Sources/NativeHost.swift', 'Tests/ServiceHostHarness.swift']) {
    await copyFile(new URL('../' + source, import.meta.url), join(sources, source.split('/').at(-1)));
  }
  // Expose the real dispatch only in the isolated harness; production visibility stays private.
  await appendFile(join(sources, 'ServiceHost.swift'), `
extension ServiceHost {
  func regressionWebStatus() async throws -> [String: Any] {
    guard let vaultURL else { throw fault("BAD_FIXTURE", "No test vault") }
    try await store.open(url: vaultURL, create: false, binding: vaultGeneration)
    return await webRequest(["version": 1, "requestId": "regression", "operation": "getStatus",
      "params": ["background": true], "_authorizationEpoch": webAuthorizationEpoch])
  }
}
`);
  await writeFile(join(buildDirectory, 'Package.swift'), `// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "ServiceHostRegression", platforms: [.macOS(.v14)], dependencies: [
  .package(path: ${JSON.stringify(join(repository, 'packages/native-core'))}),
  .package(path: ${JSON.stringify(join(repository, 'packages/local-service'))}),
], targets: [.executableTarget(name: "ServiceHostHarness", dependencies: [
  .product(name: "MemoCardCore", package: "native-core"),
  .product(name: "MemoCardLocalWeb", package: "local-service"),
])], swiftLanguageVersions: [.v5])
`);
  const scratch = join(repository, 'build/service-host-tests');
  await promisify(execFile)('swift', ['build', '--package-path', buildDirectory, '--scratch-path', scratch],
    { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
  executable = join(scratch, 'debug/ServiceHostHarness');
});
after(async () => { if (buildDirectory) await rm(buildDirectory, { recursive: true, force: true }); });

async function launch(root) {
  const child = spawn(executable, [root], { stdio: ['pipe', 'pipe', 'pipe'] });
  const events = []; const waiters = [];
  let stderr = ''; let sequence = 0;
  child.stderr.on('data', bytes => { stderr += bytes; });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    const value = JSON.parse(line);
    const index = waiters.findIndex(waiter => waiter.matches(value));
    if (index < 0) events.push(value); else waiters.splice(index, 1)[0].resolve(value);
  });
  const wait = (event, requestID) => {
    const matches = value => value.event === event && (requestID === undefined || value.requestID === requestID);
    const index = events.findIndex(matches);
    if (index >= 0) return Promise.resolve(events.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Host event timeout: ${event}; ${stderr}`)), 10_000);
      waiters.push({ matches, resolve: value => { clearTimeout(timer); resolve(value); } });
    });
  };
  const host = { child, wait,
    async command(action, args = {}) {
      const requestID = String(++sequence); const pending = wait('done', requestID);
      child.stdin.write(JSON.stringify({ action, requestID, ...args }) + '\n'); return pending;
    },
    async stop() {
      if (child.exitCode === null) {
        const exit = new Promise(resolve => child.once('exit', resolve));
        child.stdin.end(); const timeout = setTimeout(() => child.kill('SIGTERM'), 2000);
        await exit; clearTimeout(timeout);
        assert.equal(child.exitCode, 0, stderr);
      }
      lines.close();
      assert.equal(stderr, '', 'Host must not log vault content or credentials');
    },
  };
  host.ready = await wait('ready');
  return host;
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'memocard-service-host-'));
  const path = join(root, 'config/service-connection.json');
  let current = await launch(root);
  t.after(async () => { await current.command('cleanup'); await current.stop(); await rm(root, { recursive: true, force: true }); });
  return { root, path, get host() { return current; },
    config: () => readFile(path, 'utf8').then(JSON.parse),
    call: (operation, params = {}) => requestNativeWithBinding(path, operation, params),
    async restart() { await current.stop(); current = await launch(root); return current.ready; },
  };
}

test('cancelling write authorization preserves the existing read-only connection and binding', async t => {
  const f = await fixture(t);
  const before = await f.call('getStatus'); const config = await f.config();
  assert.equal(f.host.ready.writes, false);
  await f.host.command('hold-picker');
  const opened = f.host.wait('picker'); const enable = f.host.command('enable'); await opened;
  await f.host.command('release-picker', { result: 'cancel' });
  const result = await enable;
  assert.equal(result.error, 'CANCELLED'); assert.equal(result.running, true);
  assert.equal(result.enabled, true); assert.equal(result.consent, false);
  assert.deepEqual((await f.call('getStatus')).binding, before.binding);
  assert.deepEqual(await f.config(), config);
  await assert.rejects(f.call('createNote', { binding: before.binding, body: 'must not write' }), { code: 'WRITE_DISABLED' });
});

for (const outcome of ['success', 'failure']) {
  test(`late startup restore ${outcome} preserves the explicitly selected vault and registry`, async t => {
    const f = await fixture(t);
    const held = f.host.wait('restore-held');
    const restoring = f.host.command('hold-restore');
    await held;
    assert.equal((await f.host.command('switch', { name: 'Vault B' })).vaultName, 'Vault B');
    await f.host.command('release-restore', { result: outcome });
    const finished = await restoring;
    assert.equal(finished.vaultName, 'Vault B');
    assert.equal(finished.data.connected, false, 'The superseded candidate must be closed');
    assert.equal((await f.restart()).vaultName, 'Vault B');
  });
}

test('shutdown invalidates a pending startup restore', async t => {
  const f = await fixture(t);
  const held = f.host.wait('restore-held');
  const restoring = f.host.command('hold-restore');
  await held;
  await f.host.command('shutdown');
  await f.host.command('release-restore', { result: 'success' });
  const finished = await restoring;
  assert.equal(finished.vaultName, '未选择笔记库');
  assert.equal(finished.data.connected, false, 'Shutdown must close the pending candidate');
});

test('a selection made before the startup task runs owns its restore attempt', async t => {
  const f = await fixture(t);
  assert.equal((await f.host.command('switch-before-restore')).vaultName, 'Vault B');
  assert.equal((await f.restart()).vaultName, 'Vault B');
});

for (const adapter of ['native', 'web']) {
  test(`${adapter} host dispatch preserves background indexing requests`, async t => {
    const f = await fixture(t);
    const status = f.host.wait(`${adapter}-status`);
    await f.host.command(`${adapter}-background`);
    const response = (await status).data;
    assert.equal(response.ok, true);
    assert.equal(response.data.indexing?.phase, 'reading');
    assert.equal(response.data.coverage.indexed, 0);
    assert.equal(response.data.coverage.complete, false);
  });
  test(`${adapter} startup publishes identity without a synchronous source scan`, async t => {
    const f = await fixture(t);
    const status = f.host.wait(`${adapter}-startup-status`);
    await f.host.command(`${adapter}-startup`);
    const response = (await status).data;
    assert.equal(response.ok, true);
    assert.equal(response.data.indexing?.phase, 'reading');
    assert.equal(response.data.coverage.complete, false);
    assert.equal(response.sourceReads, 0);
  });
}

test('disabling a pending confirmed start prevents late consent and persists the disabled state', async t => {
  const f = await fixture(t); await f.host.command('hold-start');
  const held = f.host.wait('held'); const enable = f.host.command('enable'); await held;
  await f.host.command('disable'); await f.host.command('release-start');
  const cancelled = await enable;
  assert.equal(cancelled.error, 'UNAUTHORIZED'); assert.equal(cancelled.running, false);
  assert.equal(cancelled.consent, false); assert.equal(cancelled.enabled, false);
  const restarted = await f.restart();
  assert.equal(restarted.running, false); assert.equal(restarted.enabled, false); assert.equal(restarted.consent, false);
});

test('a failed first write enable keeps MCP disabled and never persists a grant', async t => {
  const f = await fixture(t); await f.host.command('disable');
  await rm(f.path); await mkdir(f.path);
  const failed = await f.host.command('enable');
  assert.equal(failed.error, 'INVALID_ARGUMENT'); assert.equal(failed.enabled, false);
  assert.equal(failed.running, false); assert.equal(failed.consent, false);
  assert.equal((await f.restart()).enabled, false);
});

test('two failed overlapping enables preserve disabled state across a fresh process and allow a later explicit enable', async t => {
  const f = await fixture(t); await f.host.command('disable');
  await f.host.command('hold-start');
  const held = f.host.wait('held'); const first = f.host.command('enable'); const pending = await held;
  // Both attempts use a valid directory, but publication cannot replace a directory.
  await rm(f.path); await mkdir(f.path);
  let second; let earlier;
  try { second = await f.host.command('enable'); }
  finally { await f.host.command('release-start'); earlier = await first; }
  assert.equal(second.error, 'INVALID_ARGUMENT'); assert.equal(earlier.error, 'UNAUTHORIZED');
  // Remove the export fault before restarting, so only persisted consent can
  // prevent restoration; an invalid path must not hide an accidental re-enable.
  await rm(f.path, { recursive: true });
  const previousPID = f.host.child.pid;
  const restarted = await f.restart();
  assert.notEqual(f.host.child.pid, previousPID);
  for (const result of [pending, second, earlier, restarted]) {
    assert.equal(result.enabled, false); assert.equal(result.running, false);
    assert.equal(result.consent, false); assert.equal(result.writes, false);
  }
  await assert.rejects(stat(f.path), { code: 'ENOENT' });
  await assert.rejects(f.call('getStatus'), { code: 'CONFIG_UNAVAILABLE' });
  const enabled = await f.host.command('enable');
  assert.equal(enabled.error, undefined); assert.equal(enabled.enabled, true);
  assert.equal(enabled.writes, true); assert.equal(enabled.consent, true);
  const status = await f.call('getStatus');
  const created = await f.call('createNote', { binding: status.binding, id: randomUUID(), body: 'explicitly enabled after failed attempts' });
  const loaded = await f.call('getNote', { id: created.data.id });
  assert.equal(loaded.data.body, 'explicitly enabled after failed attempts');
  assert.equal(loaded.data.contentHash, created.data.contentHash);
});

test('a superseded automatic restore cannot replace or stop a newer manual write connection', async t => {
  const f = await fixture(t);
  await f.host.command('hold-start');
  const held = f.host.wait('held');
  const switching = f.host.command('switch', { name: 'Vault B' }); await held;
  let selected;
  try {
    const enabled = await f.host.command('enable');
    assert.equal(enabled.error, undefined); assert.equal(enabled.writes, true);
    selected = await f.call('getStatus');
  } finally { await f.host.command('release-start'); await switching; }
  const current = await f.call('getStatus');
  assert.deepEqual(current.binding, selected.binding, 'Late cleanup must preserve the newer connection');
  assert.equal(current.data.vaultName, 'Vault B');
  assert.ok(current.data.capabilities.includes('updateNote'));
  const created = await f.call('createNote', { binding: current.binding, id: randomUUID(), body: 'new connection' });
  const loaded = await f.call('getNote', { id: created.data.id });
  assert.equal(loaded.data.body, 'new connection');
  const updated = await f.call('updateNote', { binding: loaded.binding, id: loaded.data.id,
    baseHash: loaded.data.contentHash, body: loaded.data.body + '\nappend' });
  const verified = await f.call('getNote', { id: loaded.data.id });
  assert.equal(verified.data.body, 'new connection\nappend');
  assert.equal(verified.data.contentHash, updated.data.contentHash);
});

test('cancelling reconfiguration leaves a writable connection usable while the picker is open and after cancellation', async t => {
  const f = await fixture(t); await f.host.command('enable');
  const before = await f.call('getStatus'); const config = await f.config();
  await f.host.command('hold-picker');
  const opened = f.host.wait('picker'); const enable = f.host.command('enable'); await opened;
  let during;
  try { during = await f.call('getStatus'); }
  finally { await f.host.command('release-picker', { result: 'cancel' }); await enable; }
  assert.deepEqual(during.binding, before.binding);
  assert.deepEqual(await f.config(), config);
  assert.deepEqual((await f.call('getStatus')).binding, before.binding);
  const created = await f.call('createNote', { binding: before.binding, id: randomUUID(), body: 'still writable' });
  assert.equal((await f.call('getNote', { id: created.data.id })).data.body, 'still writable');
});

test('a late manual enable cannot stop a newer automatic restore or grant it write consent', async t => {
  const f = await fixture(t); await f.host.command('hold-start');
  const held = f.host.wait('held'); const enable = f.host.command('enable'); await held;
  let selected;
  try {
    assert.equal((await f.host.command('switch', { name: 'Vault B' })).running, true);
    selected = await f.call('getStatus');
  } finally { await f.host.command('release-start'); }
  const result = await enable;
  assert.equal(result.error, 'UNAUTHORIZED'); assert.equal(result.running, true);
  assert.equal(result.consent, false); assert.equal(result.enabled, true);
  assert.deepEqual((await f.call('getStatus')).binding, selected.binding);
  await assert.rejects(f.call('createNote', { binding: selected.binding, body: 'must not grant' }), { code: 'WRITE_DISABLED' });
});

for (const change of ['disable', 'switch']) {
  test(`confirming an old picker after ${change} cannot re-enable writes`, async t => {
    const f = await fixture(t); await f.host.command('hold-picker');
    const opened = f.host.wait('picker'); const enable = f.host.command('enable'); await opened;
    await f.host.command(change, change === 'switch' ? { name: 'Vault B' } : {});
    await f.host.command('release-picker');
    const result = await enable;
    assert.equal(result.error, 'CANCELLED'); assert.equal(result.consent, false);
    if (change === 'disable') { assert.equal(result.running, false); assert.equal(result.enabled, false); }
    else {
      assert.equal(result.vaultName, 'Vault B'); assert.equal(result.running, true);
      assert.ok(!(await f.call('getStatus')).data.capabilities.includes('createNote'));
    }
  });
}

test('a new process restores the selected vault, bookmarks and explicit consent, rotates credentials and continues version-checked writes', async t => {
  const f = await fixture(t);
  // Legacy consent is also restored by a completely new process without upgrading it.
  const legacyPID = f.host.child.pid;
  assert.equal((await f.restart()).writes, false); assert.notEqual(f.host.child.pid, legacyPID);
  await f.host.command('enable'); await f.host.command('switch', { name: 'Vault B' });
  const before = await f.call('getStatus'); const old = await f.config();
  const created = await f.call('createNote', { binding: before.binding, id: randomUUID(), body: 'before process restart' });
  const first = await f.call('getNote', { id: created.data.id });
  const previousPID = f.host.child.pid;
  const restored = await f.restart();
  assert.notEqual(f.host.child.pid, previousPID); assert.equal(restored.writes, true);
  assert.equal(restored.vaultName, 'Vault B'); assert.equal(restored.consent, true);
  const status = await f.call('getStatus'); const next = await f.config();
  assert.equal(status.binding.vaultId, before.binding.vaultId);
  assert.notEqual(status.binding.instanceId, before.binding.instanceId);
  assert.notEqual(next.token, old.token); assert.equal((await stat(f.path)).mode & 0o777, 0o600);
  const stale = join(f.root, 'old-credentials.json');
  await writeFile(stale, JSON.stringify({ ...old, port: next.port }), { mode: 0o600 });
  await assert.rejects(requestNativeWithBinding(stale, 'getStatus'), { code: 'UNAUTHORIZED' });
  await assert.rejects(f.call('updateNote', { binding: first.binding, id: first.data.id,
    baseHash: first.data.contentHash, body: 'stale instance must not write' }), { code: 'VAULT_CHANGED' });
  const fresh = await f.call('getNote', { id: first.data.id });
  assert.equal(fresh.data.body, first.data.body); assert.equal(fresh.data.contentHash, first.data.contentHash);
  const updated = await f.call('updateNote', { binding: fresh.binding, id: fresh.data.id,
    baseHash: fresh.data.contentHash, body: fresh.data.body + '\nafter process restart' });
  await assert.rejects(f.call('updateNote', { binding: fresh.binding, id: fresh.data.id,
    baseHash: fresh.data.contentHash, body: 'stale hash must not write' }), { code: 'HASH_CONFLICT' });
  const verified = await f.call('getNote', { id: fresh.data.id });
  assert.equal(verified.data.body, 'before process restart\nafter process restart');
  assert.equal(verified.data.contentHash, updated.data.contentHash);
  await f.host.command('disable');
  const disabled = await f.restart();
  assert.equal(disabled.running, false); assert.equal(disabled.consent, false); assert.equal(disabled.enabled, false);
});

test('real MCP delete/restore preserves hashes and unrelated notes across vault switches and a fresh host process', async t => {
  const f = await fixture(t);
  const client = new Client({ name: 'service-trash-regression', version: '0.1.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [join(repository, 'apps/mcp/src/index.ts'), '--connection-file', f.path], stderr: 'pipe' }));
  const call = (name, args = {}) => client.callTool({ name, arguments: args });
  const data = async (name, args = {}) => {
    const result = await call(name, args);
    assert.equal(result.isError, undefined, JSON.stringify(result));
    return result.structuredContent;
  };
  const rejected = async (name, args, code) => {
    const result = await call(name, args);
    assert.equal(result.isError, true);
    if (code) assert.equal(JSON.parse(result.content[0].text).error.code, code);
  };
  let status = await data('get_status');
  assert.deepEqual((await data('list_trash')).notes, []);
  for (const [name, args] of [
    ['delete_note', { id: randomUUID() }], ['restore_note', { trashKey: randomUUID() + '/notes/test.md' }],
  ]) await rejected(name, { ...args, binding: status.binding, baseHash: 'a'.repeat(64) }, 'WRITE_DISABLED');
  await f.host.command('enable'); status = await data('get_status');
  const keep = await data('create_note', { binding: status.binding, id: randomUUID(), body: 'untouched sentinel #keep' });
  const id = randomUUID();
  await data('create_note', { binding: status.binding, id, title: '临时测试 · MCP 删除与恢复 · ' + id.slice(0, 8), body: 'temporary #trash-regression' });
  const initial = await data('get_note', { id });
  await data('update_note', { binding: initial.binding, id, baseHash: initial.contentHash, body: initial.body + '\nlatest content' });
  await rejected('delete_note', { binding: initial.binding, id, baseHash: initial.contentHash }, 'HASH_CONFLICT');
  const fresh = await data('get_note', { id });
  const removed = await data('delete_note', { binding: fresh.binding, id, baseHash: fresh.contentHash });
  assert.deepEqual(removed.binding, fresh.binding);
  assert.equal(removed.contentHash, fresh.contentHash);
  assert.equal((await data('list_trash')).notes[0].trashKey, removed.trashKey);
  await rejected('get_note', { id }, 'NOTE_NOT_FOUND');
  assert.ok(!(await data('search_notes')).notes.some(note => note.id === id));
  assert.ok(!(await data('list_tags')).tags.some(tag => tag.name === 'trash-regression'));
  const archived = await data('get_trashed_note', { trashKey: removed.trashKey });
  assert.equal(archived.note.body, fresh.body); assert.equal(archived.note.contentHash, fresh.contentHash);
  await rejected('restore_note', { binding: archived.binding, trashKey: archived.trashKey, baseHash: initial.contentHash }, 'HASH_CONFLICT');
  await f.host.command('switch', { name: 'Vault B' });
  status = await data('get_status');
  await data('create_note', { binding: status.binding, id, body: fresh.body });
  const clone = await data('get_note', { id });
  for (const [name, args] of [['delete_note', { id }], ['restore_note', { trashKey: archived.trashKey }]]) {
    await rejected(name, { ...args, binding: fresh.binding, baseHash: fresh.contentHash }, 'VAULT_CHANGED');
  }
  assert.equal((await data('get_note', { id })).contentHash, clone.contentHash);
  await f.host.command('switch', { name: 'Vault A' });
  const beforeRestart = await data('get_trashed_note', { trashKey: archived.trashKey });
  const oldPID = f.host.child.pid;
  assert.equal((await f.restart()).writes, true);
  assert.notEqual(f.host.child.pid, oldPID);
  status = await data('get_status');
  assert.equal(status.binding.vaultId, fresh.binding.vaultId);
  assert.notEqual(status.binding.instanceId, beforeRestart.binding.instanceId);
  for (const [name, args] of [['delete_note', { id }], ['restore_note', { trashKey: archived.trashKey }]]) {
    await rejected(name, { ...args, binding: beforeRestart.binding, baseHash: fresh.contentHash }, 'VAULT_CHANGED');
  }
  const reread = await data('get_trashed_note', { trashKey: archived.trashKey });
  assert.deepEqual(reread.binding, status.binding);
  const restored = await data('restore_note', { binding: reread.binding, trashKey: reread.trashKey, baseHash: reread.note.contentHash });
  assert.equal(restored.id, id); assert.equal(restored.body, undefined);
  const loaded = await data('get_note', { id });
  assert.deepEqual(loaded.binding, status.binding);
  assert.equal(loaded.body, fresh.body); assert.equal(loaded.contentHash, restored.contentHash);
  assert.equal(loaded.contentHash, fresh.contentHash);
  assert.deepEqual((await data('list_trash')).notes, []);
  await rejected('get_trashed_note', { trashKey: reread.trashKey });
  const updated = await data('update_note', { binding: loaded.binding, id, baseHash: loaded.contentHash, body: loaded.body + '\nrestored and editable' });
  assert.equal((await data('get_note', { id })).contentHash, updated.contentHash);
  assert.equal((await data('get_note', { id: keep.id })).contentHash, keep.contentHash);
  for (const name of ['permanently_delete_note', 'empty_trash']) await rejected(name, {});
});

test('MCP restore rereads changed archives, rejects unsafe keys and cannot overwrite a newer active identity', async t => {
  const f = await fixture(t); await f.host.command('enable');
  const status = await f.call('getStatus');
  const original = await f.call('createNote', { binding: status.binding, id: randomUUID(), body: 'archived content' });
  const removed = await f.call('deleteNote', { binding: original.binding, id: original.data.id, baseHash: original.data.contentHash });
  const args = { binding: removed.binding, trashKey: removed.data.trashKey, baseHash: original.data.contentHash };
  const path = join(f.root, 'Vault A', '.memocard/trash', removed.data.trashKey);
  await writeFile(path, (await readFile(path, 'utf8')) + '\nexternal archive edit');
  await assert.rejects(f.call('restoreNote', args), { code: 'HASH_CONFLICT' });
  const archived = await f.call('getTrashedNote', { trashKey: args.trashKey });
  assert.notEqual(archived.data.note.contentHash, args.baseHash);
  for (const trashKey of [randomUUID() + '/../outside.md', randomUUID() + '/notes/../../outside.md']) {
    await assert.rejects(f.call('getTrashedNote', { trashKey }), { code: 'PATH_NOT_ALLOWED' });
    await assert.rejects(f.call('restoreNote', { ...args, trashKey }), { code: 'PATH_NOT_ALLOWED' });
  }
  const active = await f.call('createNote', { binding: archived.binding, id: original.data.id, body: 'new active identity must survive' });
  await assert.rejects(f.call('restoreNote', { ...args, baseHash: archived.data.note.contentHash }), { code: 'DUPLICATE_ID' });
  assert.equal((await f.call('getNote', { id: active.data.id })).data.contentHash, active.data.contentHash);
  assert.equal((await f.call('getTrashedNote', { trashKey: args.trashKey })).data.note.contentHash, archived.data.note.contentHash);
  await assert.rejects(f.call('permanentlyDeleteNote', args), { code: 'OPERATION_DENIED' });
});
