import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { requestNative } from '../../mcp/src/native-client.ts';

const MAX_FRAME = 8 * 1024 * 1024;
let buildDirectory;
let executable;

before(async () => {
  assert.equal(process.platform, 'darwin', 'These tests exercise the real macOS Network framework.');
  buildDirectory = await mkdtemp(join(tmpdir(), 'memocard-native-network-'));
  executable = join(buildDirectory, 'LocalReadServerHarness');
  await promisify(execFile)('xcrun', ['swiftc', '-swift-version', '5', '-strict-concurrency=complete', '-warnings-as-errors',
    fileURLToPath(new URL('../Sources/LocalReadServer.swift', import.meta.url)),
    fileURLToPath(new URL('../Sources/MCPAuthorization.swift', import.meta.url)),
    fileURLToPath(new URL('./LocalReadServerHarness.swift', import.meta.url)), '-o', executable]);
});
after(async () => { if (buildDirectory) await rm(buildDirectory, { recursive: true, force: true }); });

async function nativeHost(t, allowsWrites = false) {
  const directory = await mkdtemp(join(tmpdir(), 'memocard-native-connection-'));
  const configurationFile = join(directory, 'connection.json');
  const host = spawn(executable, [configurationFile, ...(allowsWrites ? ['--allow-writes'] : [])], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  host.stderr.on('data', bytes => { stderr += bytes.toString(); });
  t.after(async () => {
    if (host.exitCode === null) {
      const exited = new Promise(resolve => host.once('exit', resolve));
      host.kill('SIGTERM');
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
    assert.equal(stderr, '', 'Native test host must not log credentials or request content.');
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Native test host did not start')), 5000);
    host.once('exit', () => { clearTimeout(timeout); reject(new Error('Native test host exited before readiness')); });
    host.stdout.once('data', bytes => {
      clearTimeout(timeout);
      if (bytes.toString() === 'READY\n') resolve(); else reject(new Error('Unexpected test host output'));
    });
  });
  const config = JSON.parse(await readFile(configurationFile, 'utf8'));
  assert.equal(config.host, '127.0.0.1');
  assert.ok(config.port > 0 && config.port <= 65535);
  const request = (params = {}, overrides = {}) => ({
    version: 1, requestId: randomUUID(), token: config.token, instanceId: config.instanceId,
    vaultId: config.vaultId, operation: 'getNote', params, ...overrides,
  });
  return { config, request, configurationFile };
}

function exchange(config, pieces, { halfClose = true, expectedReplies = 1, timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: config.host, port: config.port, family: 4 });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Native reply timeout')); }, timeoutMs);
    let buffer = Buffer.alloc(0);
    const replies = [];
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve(replies);
    };
    socket.on('data', bytes => {
      buffer = Buffer.concat([buffer, bytes]);
      let newline;
      while ((newline = buffer.indexOf(10)) >= 0) {
        try { replies.push(JSON.parse(buffer.subarray(0, newline).toString('utf8'))); }
        catch { finish(new Error('Invalid native JSON reply')); return; }
        buffer = buffer.subarray(newline + 1);
      }
      if (replies.length === expectedReplies && !halfClose) finish();
    });
    socket.once('connect', async () => {
      for (const piece of pieces) {
        socket.write(piece);
        if (pieces.length > 1) await new Promise(resolve => setTimeout(resolve, 5));
      }
      if (halfClose) socket.end();
    });
    socket.once('error', error => error.code === 'ECONNRESET' ? finish() : finish(error));
    socket.once('close', () => finish());
  });
}
const line = value => Buffer.from(JSON.stringify(value) + '\n');

test('half-closed TCP request stream preserves every buffered frame and response ID', async t => {
  const host = await nativeHost(t);
  const requests = Array.from({ length: 3 }, (_, i) => host.request({ echo: `frame-${i}`, delayMilliseconds: 15 }));
  const replies = await exchange(host.config, [Buffer.concat(requests.map(line))], { expectedReplies: 3 });
  assert.deepEqual(replies.map(reply => reply.requestId), requests.map(request => request.requestId));
  assert.deepEqual(replies.map(reply => reply.data.echo), ['frame-0', 'frame-1', 'frame-2']);
});

test('fragmented Unicode and coalesced requests preserve boundaries without write-side EOF', async t => {
  const host = await nativeHost(t);
  const first = host.request({ echo: '中文 🌱' });
  const second = host.request({ echo: 'next' });
  const bytes = Buffer.concat([line(first), line(second)]);
  const split = bytes.indexOf(Buffer.from('中')) + 1;
  const replies = await exchange(host.config, [bytes.subarray(0, split), bytes.subarray(split)], { halfClose: false, expectedReplies: 2 });
  assert.deepEqual(replies.map(reply => reply.data.echo), ['中文 🌱', 'next']);
});

test('exactly 8 MiB JSON frames are accepted and oversized frames are rejected', async t => {
  const host = await nativeHost(t);
  const request = host.request({ padding: '' });
  const initialSize = Buffer.byteLength(JSON.stringify(request));
  request.params.padding = 'x'.repeat(MAX_FRAME - initialSize);
  const exact = line(request);
  assert.equal(exact.length, MAX_FRAME + 1);
  const replies = await exchange(host.config, [exact], { timeoutMs: 10000 });
  assert.equal(replies.length, 1);
  assert.equal(replies[0].ok, true);
  request.params.padding += 'x';
  assert.deepEqual(await exchange(host.config, [line(request)], { timeoutMs: 10000 }), []);
});

test('authenticates token, instance and vault before read-only dispatch', async t => {
  const host = await nativeHost(t);
  for (const field of ['token', 'instanceId', 'vaultId']) {
    const replies = await exchange(host.config, [line(host.request({}, { [field]: 'wrong' }))]);
    assert.equal(replies[0]?.ok, false);
    assert.equal(replies[0]?.error.code, 'UNAUTHORIZED');
  }
  const writes = await exchange(host.config, [line(host.request({}, { operation: 'saveNote' }))]);
  assert.equal(writes[0]?.ok, false);
  assert.equal(writes[0]?.error.code, 'INVALID_ARGUMENT');
});

test('simultaneous clients remain independent', async t => {
  const host = await nativeHost(t);
  const requests = Array.from({ length: 8 }, (_, i) => host.request({ echo: i, delayMilliseconds: 30 }));
  const replies = await Promise.all(requests.map(request => exchange(host.config, [line(request)])));
  assert.deepEqual(replies.map(result => result[0]?.data.echo), requests.map(request => request.params.echo));
});

test('incomplete EOF closes without leaking partial data', async t => {
  const host = await nativeHost(t);
  const request = line(host.request());
  assert.deepEqual(await exchange(host.config, [request.subarray(0, request.length - 1)]), []);
});

test('production Node client receives an 8 MiB body expanded by JSON escaping', async t => {
  const host = await nativeHost(t);
  const data = await requestNative(host.configurationFile, 'getNote', { responseBytes: MAX_FRAME, escapedResponse: true });
  assert.equal(data.body.length, MAX_FRAME);
  assert.equal(data.body, '\u0001'.repeat(MAX_FRAME));
});

test('overlarge native response returns a structured error and subsequent reads still work', async t => {
  const host = await nativeHost(t);
  const request = host.request({ responseBytes: 64 * 1024 * 1024 });
  const replies = await exchange(host.config, [line(request)], { timeoutMs: 10000 });
  assert.deepEqual(replies, [{
    requestId: request.requestId, ok: false,
    error: { code: 'RESPONSE_TOO_LARGE', message: 'Native response exceeds the 64 MiB frame limit', retryable: false },
  }]);
  const next = await requestNative(host.configurationFile, 'getNote', { echo: 'still available' });
  assert.equal(next.echo, 'still available');
});


test('write dispatch requires opt-in and authenticates before forwarding create, update, delete or restore', async t => {
  const readHost = await nativeHost(t);
  const writeHost = await nativeHost(t, true);
  for (const operation of ['createNote', 'updateNote', 'deleteNote', 'restoreNote']) {
    const rejected = await exchange(readHost.config, [line(readHost.request({}, { operation }))]);
    assert.equal(rejected[0]?.error.code, 'WRITE_DISABLED');
    for (const field of ['token', 'instanceId', 'vaultId']) {
      const replies = await exchange(writeHost.config, [line(writeHost.request({}, { operation, [field]: 'wrong' }))]);
      assert.equal(replies[0]?.error.code, 'UNAUTHORIZED');
    }
    const binding = { vaultId: writeHost.config.vaultId, instanceId: writeHost.config.instanceId };
    const accepted = await requestNative(writeHost.configurationFile, operation, { binding, echo: '中文 write' });
    assert.equal(accepted.operation, operation);
    assert.equal(accepted.echo, '中文 write');
  }
  for (const operation of ['saveNote', 'permanentlyDeleteNote', 'updateNoteProperty']) {
    const rejected = await exchange(writeHost.config, [line(writeHost.request({}, { operation }))]);
    assert.equal(rejected[0]?.error.code, 'INVALID_ARGUMENT');
  }
});


test('legacy read consent stays read-only until explicit write authorization and survives revocation', async () => {
  const { stdout, stderr } = await promisify(execFile)(executable, ['--authorization-test']);
  assert.equal(stdout, 'AUTHORIZATION PASSED\n');
  assert.equal(stderr, '');
});

test('native dispatch rejects stale bindings even when the current token and copied vault ID match', async t => {
  const first = await nativeHost(t, true);
  const second = await nativeHost(t, true);
  assert.equal(first.config.vaultId, second.config.vaultId, 'Copied vault identity must not bypass the instance check.');
  for (const operation of ['createNote', 'updateNote', 'deleteNote', 'restoreNote']) {
    for (const binding of [undefined,
      { vaultId: first.config.vaultId, instanceId: first.config.instanceId },
      { vaultId: 'different-vault', instanceId: second.config.instanceId },
    ]) {
      const rejected = await exchange(second.config, [line(second.request({ binding }, { operation }))]);
      assert.equal(rejected[0]?.ok, false);
      assert.equal(rejected[0]?.error.code, 'VAULT_CHANGED');
      assert.equal(rejected[0]?.data, undefined, 'The handler must never be called.');
    }
  }
});
