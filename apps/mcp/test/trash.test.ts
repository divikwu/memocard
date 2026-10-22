import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fixture, reply, note } from './fixture.ts';

const trashKey = 'c08554ec-191c-44d7-895d-194eb67365b4/' + note.relativePath;
const deletedAt = '2026-10-22T04:00:00Z';

test('trash tools expose reversible deletion, reviewed restoration and compact bound receipts', async t => {
  let conflict = false;
  const item = { trashKey, id: note.id, title: note.title, relativePath: note.relativePath,
    deletedAt, contentHash: note.contentHash, preview: note.body.slice(0, 200) };
  const f = await fixture(t, (request, socket) => {
    if (conflict) {
      socket.end(JSON.stringify({ requestId: request.requestId, ok: false,
        error: { code: 'HASH_CONFLICT', message: 'private archive content', retryable: false } }) + '\n');
      return;
    }
    const responses = {
      getTrash: { notes: [item], issues: [] },
      getTrashedNote: { trashKey, deletedAt, note },
      deleteNote: { id: note.id, relativePath: note.relativePath, trashKey,
        trashPath: '.memocard/trash/' + trashKey, contentHash: note.contentHash },
      restoreNote: { ...note, body: 'x'.repeat(5 * 1024 * 1024) },
    };
    reply(socket, request, responses[request.operation as keyof typeof responses]);
  });
  const client = new Client({ name: 'memocard-trash-test', version: '0.1.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--connection-file', f.path], stderr: 'pipe' }));
  const call = async (name: string, args = {}) => await client.callTool({ name, arguments: args }) as CallToolResult;
  const tools = (await client.listTools()).tools;
  assert.ok(!tools.some(tool => /permanent|purge|empty_trash/.test(tool.name)));
  for (const name of ['delete_note', 'restore_note']) {
    const tool = tools.find(tool => tool.name === name);
    assert.ok(tool, name + ' must be registered');
    assert.equal(tool.annotations?.readOnlyHint, false);
    assert.equal(tool.annotations?.idempotentHint, false);
  }
  assert.equal(tools.find(tool => tool.name === 'delete_note')?.annotations?.destructiveHint, true);
  const binding = { vaultId: f.config.vaultId, instanceId: f.config.instanceId };
  assert.deepEqual((await call('list_trash')).structuredContent, { notes: [item], issues: [], binding });
  assert.deepEqual((await call('get_trashed_note', { trashKey })).structuredContent, { trashKey, deletedAt, note, binding });
  const removed = await call('delete_note', { binding, id: note.id, baseHash: note.contentHash });
  assert.equal(removed.isError, undefined);
  assert.deepEqual(removed.structuredContent, { binding, id: note.id, relativePath: note.relativePath, trashKey, contentHash: note.contentHash });
  const restored = await call('restore_note', { binding, trashKey, baseHash: note.contentHash });
  assert.equal(restored.isError, undefined);
  assert.equal(restored.structuredContent?.body, undefined);
  assert.deepEqual(restored.structuredContent?.binding, binding);
  assert.ok(Buffer.byteLength(JSON.stringify(restored)) < 4096);
  const count = f.requests.length;
  for (const [name, args] of [
    ['delete_note', { id: note.id }], ['restore_note', { trashKey }],
    ['delete_note', { id: note.id, baseHash: '' }],
    ['restore_note', { trashKey, baseHash: note.contentHash, permanently: true }],
    ['delete_note', { id: '../outside', baseHash: note.contentHash }],
  ] as const) assert.equal((await call(name, { binding, ...args })).isError, true);
  assert.equal(f.requests.length, count, 'Invalid writes must fail before native dispatch');
  conflict = true;
  for (const [name, args] of [
    ['delete_note', { id: note.id }], ['restore_note', { trashKey }],
  ] as const) {
    const result = await call(name, { binding, ...args, baseHash: note.contentHash });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), /HASH_CONFLICT/);
    assert.doesNotMatch(JSON.stringify(result), /private archive content/);
  }
});

test('delete and restore reject old bindings before connecting after switches and same-vault restarts', async t => {
  const f = await fixture(t, (request, socket) => reply(socket, request, { trashKey, deletedAt, note }));
  const client = new Client({ name: 'memocard-trash-binding-test', version: '0.1.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--connection-file', f.path], stderr: 'pipe' }));
  const call = async (name: string, args = {}) => await client.callTool({ name, arguments: args }) as CallToolResult;
  const read = await call('get_trashed_note', { trashKey });
  assert.equal(read.isError, undefined);
  const binding = read.structuredContent?.binding;
  for (const config of [
    { ...f.config, vaultId: 'copied-vault', instanceId: 'other-instance' },
    { ...f.config, instanceId: 'original-vault-restarted' },
  ]) {
    await f.write(config);
    const count = f.requests.length;
    for (const [name, args] of [
      ['delete_note', { id: note.id }], ['restore_note', { trashKey }],
    ] as const) {
      for (const expected of [binding, undefined]) {
        const result = await call(name, { ...args, binding: expected, baseHash: note.contentHash });
        assert.equal(result.isError, true);
        if (expected) assert.match(JSON.stringify(result), /VAULT_CHANGED/);
      }
    }
    assert.equal(f.requests.length, count);
  }
});
