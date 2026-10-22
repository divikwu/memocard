import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { fixture, reply, status, coverage, note, sharedFixture } from './fixture.ts';

test('official SDK stdio client discovers six read tools and four write tools against mocked TCP host', async t => {
  let includeDeleted = false;
  let returnError = false;
  const f = await fixture(t, (request, socket) => {
    assert.equal(request.token, f.config.token);
    assert.equal(request.instanceId, f.config.instanceId);
    assert.equal(request.vaultId, f.config.vaultId);
    if (returnError) {
      socket.end(JSON.stringify({ requestId: request.requestId, ...sharedFixture.error }) + '\n');
      return;
    }
    const returnedNote = includeDeleted ? { ...note, deletedAt: '2026-09-28T06:00:00Z', body: 'DELETED-PRIVATE-CONTENT' } : note;
    const data = {
      getStatus: status,
      queryNotes: { notes: [returnedNote], coverage },
      getNote: returnedNote,
      listTags: { tags: [{ name: '日常', count: 1 }], coverage },
    }[request.operation];
    reply(socket, request, data);
  });
  const client = new Client({ name: 'memocard-protocol-test', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--connection-file', f.path],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', bytes => { stderr += bytes.toString(); });
  t.after(() => client.close());
  await client.connect(transport);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ['create_note', 'delete_note', 'get_note', 'get_status', 'get_trashed_note', 'list_tags', 'list_trash', 'restore_note', 'search_notes', 'update_note']);
  for (const tool of tools.tools) {
    assert.equal(tool.annotations?.readOnlyHint, !['create_note', 'update_note', 'delete_note', 'restore_note'].includes(tool.name));
    assert.equal(tool.annotations?.destructiveHint, ['update_note', 'delete_note'].includes(tool.name));
  }
  const searchProperties = tools.tools.find(tool => tool.name === 'search_notes')?.inputSchema.properties;
  assert.match(JSON.stringify(searchProperties?.from), /Inclusive creation time/);
  assert.match(JSON.stringify(searchProperties?.to), /Exclusive creation time/);
  const binding = { vaultId: f.config.vaultId, instanceId: f.config.instanceId };
  const call = async (name: string, args = {}): Promise<CallToolResult> => await client.callTool({ name, arguments: args }) as CallToolResult;
  assert.deepEqual((await call('get_status')).structuredContent, { ...status, binding });
  const page = await call('search_notes', { query: '中文', tags: ['日常'], limit: 10 });
  assert.deepEqual(page.structuredContent, { notes: [note], nextCursor: null, coverage, binding });
  assert.equal(f.requests.at(-1)?.params.deleted, false);
  assert.deepEqual((await call('get_note', { id: note.id })).structuredContent, { ...note, binding });
  assert.deepEqual((await call('list_tags')).structuredContent, { tags: [{ name: '日常', count: 1 }], coverage, binding });
  const requestCount = f.requests.length;
  for (const args of [{ deleted: true }, { limit: 0 }, { from: '2026-09-29T00:00:00Z', to: '2026-09-28T00:00:00Z' }]) {
    assert.equal((await call('search_notes', args)).isError, true);
  }
  assert.equal((await call('save_note', { body: 'forbidden' })).isError, true);
  assert.equal(f.requests.length, requestCount);
  includeDeleted = true;
  for (const [name, args] of [['get_note', { id: note.id }], ['search_notes', {}]] as const) {
    const result = await call(name, args);
    assert.equal(result.isError, true);
    assert.doesNotMatch(JSON.stringify(result), /DELETED-PRIVATE-CONTENT/);
  }
  returnError = true;
  const failed = await call('get_note', { id: note.id });
  assert.equal(failed.isError, true);
  assert.match(JSON.stringify(failed), /NOTE_NOT_FOUND/);
  assert.doesNotMatch(JSON.stringify(failed), /找不到此笔记/);
  await client.close();
  assert.equal(stderr, '');
});

test('official SDK preserves recovery codes without exposing native messages or unknown codes', async t => {
  let code = 'STALE_CURSOR';
  let retryable = true;
  const f = await fixture(t, (request, socket) => socket.end(JSON.stringify({
    requestId: request.requestId, ok: false,
    error: { code, message: 'private-note-body /Users/private/file.md secret-token', retryable },
  }) + '\n'));
  const client = new Client({ name: 'memocard-recovery-test', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--connection-file', f.path],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', bytes => { stderr += bytes.toString(); });
  t.after(() => client.close());
  await client.connect(transport);
  for (const [nativeCode, canRetry] of [
    ['STALE_CURSOR', true], ['CURSOR_QUERY_MISMATCH', false], ['INVALID_CURSOR', false],
    ['NOTE_NOT_FOUND', false], ['UNAUTHORIZED', false], ['WRITE_DISABLED', false], ['VAULT_CHANGED', false], ['FILE_PENDING', true],
    ['SOURCE_CONFLICT', false], ['SCAN_INCOMPLETE', true], ['RESPONSE_TOO_LARGE', false],
    ['UNKNOWN-private-note-body', true], ['constructor', false],
  ] as const) {
    code = nativeCode;
    retryable = canRetry;
    const result = await client.callTool({ name: 'get_note', arguments: { id: note.id } }) as CallToolResult;
    assert.equal(result.isError, true);
    assert.equal(result.content[0]?.type, 'text');
    if (result.content[0]?.type !== 'text') assert.fail('Expected a structured JSON error in text content.');
    const failure = JSON.parse(result.content[0].text).error;
    assert.equal(failure.code, nativeCode.startsWith('UNKNOWN') || nativeCode === 'constructor' ? 'NATIVE_REJECTED' : nativeCode);
    assert.equal(failure.retryable, canRetry);
    assert.doesNotMatch(JSON.stringify(result), /private-note-body|\/Users\/private|secret-token/);
  }
  await client.close();
  assert.equal(stderr, '');
});

test('default SDK client receives large-result errors and bounded escaped results without disconnecting', async t => {
  let body = 'x'.repeat(8 * 1024 * 1024 - 1024);
  const f = await fixture(t, (request, socket) => {
    const data = request.operation === 'getStatus' ? status : { ...note, body };
    reply(socket, request, data);
  });
  const client = new Client({ name: 'memocard-result-budget-test', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/index.ts', import.meta.url)), '--connection-file', f.path],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', bytes => { stderr += bytes.toString(); });
  t.after(() => client.close());
  await client.connect(transport);
  const oversized = await client.callTool({ name: 'get_note', arguments: { id: note.id } }) as CallToolResult;
  assert.equal(oversized.isError, true);
  assert.match(JSON.stringify(oversized), /RESPONSE_TOO_LARGE/);
  assert.ok(Buffer.byteLength(JSON.stringify(oversized)) < 1024);
  assert.deepEqual((await client.callTool({ name: 'get_status', arguments: {} })).structuredContent, { ...status, binding: { vaultId: f.config.vaultId, instanceId: f.config.instanceId } });

  // Control characters use six bytes each in native JSON and are escaped again in text content.
  body = '\u0001'.repeat(Math.floor((2 * 1024 * 1024 - 1024) / 6));
  const bounded = await client.callTool({ name: 'get_note', arguments: { id: note.id } }) as CallToolResult;
  assert.equal(bounded.isError, undefined);
  assert.equal(bounded.structuredContent?.body, body);
  assert.ok(Buffer.byteLength(JSON.stringify(bounded)) < 8 * 1024 * 1024);
  await client.close();
  assert.equal(stderr, '');
});
