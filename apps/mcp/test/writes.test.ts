import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fixture, reply, note } from './fixture.ts';

test('write tools require versions, return compact receipts, and preserve conflict errors', async t => {
  let conflict = false;
  const f = await fixture(t, (request, socket) => {
    if (conflict) {
      socket.end(JSON.stringify({ requestId: request.requestId, ok: false,
        error: { code: 'HASH_CONFLICT', message: 'private content', retryable: false } }) + '\n');
    } else reply(socket, request, { ...note, body: 'x'.repeat(5 * 1024 * 1024) });
  });
  const client = new Client({ name: 'memocard-write-test', version: '0.1.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--connection-file', f.path], stderr: 'pipe' }));
  const tools = (await client.listTools()).tools;
  for (const name of ['create_note', 'update_note']) {
    assert.equal(tools.find(tool => tool.name === name)?.annotations?.readOnlyHint, false);
    assert.equal(tools.find(tool => tool.name === name)?.annotations?.idempotentHint, false);
  }
  const binding = { vaultId: f.config.vaultId, instanceId: f.config.instanceId };
  const created = await client.callTool({ name: 'create_note', arguments: { binding, id: note.id, title: 'New', body: '中文 #work' } }) as CallToolResult;
  assert.equal(created.isError, undefined);
  assert.equal(created.structuredContent?.id, note.id);
  assert.equal(created.structuredContent?.body, undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(created)) < 4096);
  assert.equal(f.requests.at(-1)?.operation, 'createNote');
  assert.equal(f.requests.at(-1)?.params.baseHash, undefined);
  const updated = await client.callTool({ name: 'update_note', arguments: { binding, id: note.id, body: '', baseHash: note.contentHash } }) as CallToolResult;
  assert.equal(updated.isError, undefined);
  assert.equal(f.requests.at(-1)?.operation, 'updateNote');
  assert.equal(f.requests.at(-1)?.params.baseHash, note.contentHash);
  const count = f.requests.length;
  for (const [name, args] of [
    ['update_note', { id: note.id, body: 'missing version' }],
    ['update_note', { id: note.id, body: 'empty version', baseHash: '' }],
    ['create_note', { body: 'no overwrite', baseHash: note.contentHash }],
    ['create_note', { id: '../outside', body: 'bad path' }],
    ['create_note', { body: 'no path injection', relativePath: '../outside.md' }],
  ] as const) assert.equal((await client.callTool({ name, arguments: { ...args, binding } }) as CallToolResult).isError, true);
  assert.equal(f.requests.length, count);
  conflict = true;
  const failed = await client.callTool({ name: 'update_note', arguments: { binding, id: note.id, body: 'stale', baseHash: note.contentHash } }) as CallToolResult;
  assert.equal(failed.isError, true);
  assert.match(JSON.stringify(failed), /HASH_CONFLICT/);
  assert.doesNotMatch(JSON.stringify(failed), /private content/);
});

test('writes stay bound to the read instance across vault switches and same-vault restarts', async t => {
  const f = await fixture(t, (request, socket) => reply(socket, request, note));
  const client = new Client({ name: 'memocard-binding-regression', version: '0.1.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--connection-file', f.path], stderr: 'pipe' }));
  let previous = await client.callTool({ name: 'get_note', arguments: { id: note.id } }) as CallToolResult;
  assert.deepEqual(previous.structuredContent?.binding, { vaultId: f.config.vaultId, instanceId: f.config.instanceId });
  for (const config of [
    { ...f.config, vaultId: 'other-vault', instanceId: 'other-vault-instance' },
    { ...f.config, vaultId: 'other-vault', instanceId: 'restarted-other-vault' },
    { ...f.config, instanceId: 'returned-to-original-vault' },
  ]) {
    await f.write(config);
    const count = f.requests.length;
    for (const name of ['create_note', 'update_note']) {
      const args = { id: note.id, body: 'must not write to the new instance', binding: previous.structuredContent?.binding,
        ...(name === 'update_note' ? { baseHash: note.contentHash } : {}) };
      const rejected = await client.callTool({ name, arguments: args }) as CallToolResult;
      assert.equal(rejected.isError, true);
      assert.match(JSON.stringify(rejected), /VAULT_CHANGED/);
    }
    assert.equal(f.requests.length, count, 'Stale write must fail before connecting, even with a copied ID/hash.');
    previous = await client.callTool({ name: 'get_note', arguments: { id: note.id } }) as CallToolResult;
    assert.deepEqual(previous.structuredContent?.binding, { vaultId: config.vaultId, instanceId: config.instanceId });
    const updated = await client.callTool({ name: 'update_note', arguments: {
      id: note.id, body: 'freshly read instance', baseHash: note.contentHash, binding: previous.structuredContent?.binding,
    } }) as CallToolResult;
    assert.equal(updated.isError, undefined);
    assert.deepEqual(updated.structuredContent?.binding, previous.structuredContent?.binding);
  }
  const count = f.requests.length;
  for (const name of ['create_note', 'update_note']) {
    const rejected = await client.callTool({ name, arguments: { id: note.id, body: 'missing binding',
      ...(name === 'update_note' ? { baseHash: note.contentHash } : {}) } }) as CallToolResult;
    assert.equal(rejected.isError, true);
  }
  assert.equal(f.requests.length, count);
});
