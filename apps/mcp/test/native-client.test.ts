import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, readFile, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { BridgeFailure, REQUEST_TIMEOUT_MS, readConnectionFile, requestNative } from '../src/native-client.ts';
import { fixture, reply, note, status, sharedFixture } from './fixture.ts';

test('shared bridge fixture matches the real Markdown source bytes and vault identity', async () => {
  const source = await readFile(new URL('../../../tests/fixtures/vault/' + note.relativePath, import.meta.url));
  const metadata = JSON.parse(await readFile(new URL('../../../tests/fixtures/vault/.memocard/vault.json', import.meta.url), 'utf8'));
  assert.equal(sharedFixture.formatVersion, 1);
  assert.equal(createHash('sha256').update(source).digest('hex'), note.contentHash);
  assert.equal(source.toString('utf8').split('\n---\n')[1], note.body);
  assert.equal(metadata.vaultId, status.vaultId);
  assert.equal(note.sourceUrl, `memocard://note/${note.id}?vault=${metadata.vaultId}`);
});

test('uses loopback and re-reads rotated credentials per call; query always excludes deleted', async t => {
  const f = await fixture(t, (request, socket) => reply(socket, request, { accepted: true }));
  await requestNative(f.path, 'queryNotes', { deleted: true, query: '中文' });
  const config = { ...f.config, token: 'rotated-token', instanceId: 'rotated-instance', vaultId: 'rotated-vault' };
  await f.write(config);
  await requestNative(f.path, 'getNote', { id: note.id });
  assert.equal(f.requests[0].params.deleted, false);
  assert.equal(f.requests[0].token, f.config.token);
  assert.equal(f.requests[0].vaultId, f.config.vaultId);
  assert.equal(f.requests[1].token, config.token);
  assert.equal(f.requests[1].instanceId, config.instanceId);
  assert.equal(f.requests[1].vaultId, config.vaultId);
  assert.notEqual(f.requests[0].requestId, f.requests[1].requestId);
  await assert.rejects(requestNative(f.path, 'saveNote'), { code: 'OPERATION_DENIED' });
  assert.equal(f.requests.length, 2);
});

test('rejects unsafe configuration paths, permissions, JSON, and hosts before connecting', async t => {
  const f = await fixture(t, () => assert.fail('Unsafe config must not connect'));
  await assert.rejects(readConnectionFile('relative.json'), { code: 'CONFIG_INVALID' });
  await assert.rejects(readConnectionFile(join(f.dir, 'x') + '/../connection.json'), { code: 'CONFIG_INVALID' });
  await chmod(f.path, 0o644);
  await assert.rejects(readConnectionFile(f.path), { code: 'CONFIG_INVALID' });
  await chmod(f.path, 0o600);
  const link = join(f.dir, 'link.json');
  await symlink(f.path, link);
  await assert.rejects(readConnectionFile(link), { code: 'CONFIG_UNAVAILABLE' });
  for (const host of ['localhost', '::1', '0.0.0.0', '192.168.0.1']) {
    await f.write({ ...f.config, host });
    await assert.rejects(requestNative(f.path, 'getStatus'), { code: 'CONFIG_INVALID' });
  }
  for (const port of [0, 65536, 3.14, '1234']) {
    await f.write({ ...f.config, port });
    await assert.rejects(readConnectionFile(f.path), { code: 'CONFIG_INVALID' });
  }
  await writeFile(f.path, '{bad JSON');
  await assert.rejects(readConnectionFile(f.path), { code: 'CONFIG_INVALID' });
  await writeFile(f.path, Buffer.from([0xff]));
  await assert.rejects(readConnectionFile(f.path), { code: 'CONFIG_INVALID' });
  await writeFile(f.path, 'x'.repeat(16 * 1024 + 1));
  await assert.rejects(readConnectionFile(f.path), { code: 'CONFIG_INVALID' });
});

test('preserves UTF-8 split in the middle of multibyte characters', async t => {
  const f = await fixture(t, (request, socket) => {
    const bytes = Buffer.from(JSON.stringify({ requestId: request.requestId, ok: true, data: note }) + '\n');
    const split = bytes.indexOf(Buffer.from('测')) + 1;
    socket.write(bytes.subarray(0, split));
    setTimeout(() => socket.end(bytes.subarray(split)), 10);
  });
  assert.deepEqual(await requestNative(f.path, 'getNote', { id: note.id }), note);
});

test('rejects mismatched IDs, invalid UTF-8, missing newline, and trailing frames', async t => {
  for (const kind of ['id', 'utf8', 'newline', 'trailing']) {
    await t.test(kind, async sub => {
      const f = await fixture(sub, (request, socket) => {
        const line = JSON.stringify({ requestId: kind === 'id' ? 'wrong' : request.requestId, ok: true, data: {} });
        socket.end(kind === 'utf8' ? Buffer.from([0xff, 0x0a]) : line + (kind === 'newline' ? '' : '\n') + (kind === 'trailing' ? '{}\n' : ''));
      });
      await assert.rejects(requestNative(f.path, 'getNote'), { code: 'PROTOCOL_ERROR' });
    });
  }
});

test('accepts responses above 8 MiB but bounds requests at 8 MiB and responses at 64 MiB', async t => {
  const body = 'x'.repeat(8 * 1024 * 1024);
  const valid = await fixture(t, (request, socket) => reply(socket, request, { body }));
  assert.deepEqual(await requestNative(valid.path, 'getNote'), { body });
  await assert.rejects(requestNative(valid.path, 'queryNotes', { query: body }), { code: 'FRAME_TOO_LARGE' });
  assert.equal(valid.requests.length, 1, 'Oversized requests must be rejected before connecting.');
  const large = await fixture(t, (_, socket) => socket.end(Buffer.alloc(64 * 1024 * 1024 + 1, 0x20)));
  await assert.rejects(requestNative(large.path, 'getNote'), { code: 'FRAME_TOO_LARGE' });
});

test('sanitizes unknown native codes and messages', async t => {
  const error = await fixture(t, (request, socket) => socket.end(JSON.stringify({
    requestId: request.requestId, ok: false,
    error: { code: 'AUTH_FAILED', message: 'secret-token and private note text', retryable: true },
  }) + '\n'));
  await assert.rejects(requestNative(error.path, 'getNote'), (failure: unknown) => {
    assert.ok(failure instanceof BridgeFailure);
    assert.equal(failure.code, 'NATIVE_REJECTED');
    assert.equal(failure.retryable, true);
    assert.doesNotMatch(failure.message, /secret-token|private note/);
    return true;
  });
});

test('rejects a different vault returned by getStatus', async t => {
  const f = await fixture(t, (request, socket) => reply(socket, request, { vaultId: 'another-vault' }));
  await assert.rejects(requestNative(f.path, 'getStatus'), { code: 'VAULT_CHANGED' });
});

test('enforces a total 15 second deadline even while bytes arrive', { timeout: 18_000 }, async t => {
  assert.equal(REQUEST_TIMEOUT_MS, 15_000);
  const f = await fixture(t, (_, socket) => {
    const timer = setInterval(() => socket.write(' '), 100);
    socket.once('close', () => clearInterval(timer));
  });
  const started = Date.now();
  await assert.rejects(requestNative(f.path, 'getNote'), { code: 'TIMEOUT' });
  assert.ok(Date.now() - started >= 14_900);
  await delay(10);
});
