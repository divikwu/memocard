import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { fixture, reply, note, status, coverage } from './fixture.ts';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));

before(async () => {
  // The smoke invokes the same compiled stdio entry used by installed clients.
  await run(process.execPath, [root + 'node_modules/typescript/bin/tsc', '-p', root + 'tsconfig.json']);
});

for (const change of ['none', 'other-vault', 'same-vault-restart']) {
  test(`write smoke keeps its original target across ${change}`, async t => {
    let saved = { ...note, body: 'MCP 新建验证 #mcp/verification' };
    let updated = false;
    const f = await fixture(t, async (request, socket) => {
      switch (request.operation) {
        case 'getStatus': reply(socket, request, status); break;
        case 'createNote':
          saved = { ...saved, id: request.params.id as string };
          if (change !== 'none') {
            await f.write({ ...f.config,
              vaultId: change === 'other-vault' ? 'copied-vault' : f.config.vaultId,
              instanceId: 'new-instance',
            });
          }
          reply(socket, request, saved);
          break;
        case 'getNote': reply(socket, request, saved); break;
        case 'updateNote':
          if (updated) {
            socket.end(JSON.stringify({ requestId: request.requestId, ok: false,
              error: { code: 'HASH_CONFLICT', message: 'changed', retryable: false } }) + '\n');
          } else {
            updated = true;
            saved = { ...saved, body: request.params.body as string, contentHash: 'b'.repeat(64) };
            reply(socket, request, saved);
          }
          break;
        case 'queryNotes': reply(socket, request, { notes: [saved], coverage }); break;
        case 'listTags': reply(socket, request, { tags: [], coverage }); break;
        default: assert.fail('Unexpected operation: ' + request.operation);
      }
    });
    const invoke = () => run(process.execPath, [root + 'src/smoke.ts', '--connection-file', f.path, '--write'], { timeout: 15_000 });
    if (change === 'none') {
      const result = await invoke();
      assert.equal(result.stderr, '');
      assert.equal(JSON.parse(result.stdout).writeVerified, true);
      assert.equal(updated, true);
    } else {
      await assert.rejects(invoke(), (error: Error & { code?: number; stdout?: string }) => {
        assert.equal(error.code, 1);
        assert.equal(error.stdout, '', 'A changed target must never be reported verified');
        return true;
      });
      assert.equal(updated, false, 'Copied IDs, bodies and hashes must not authorize an update in another instance');
      assert.deepEqual(f.requests.map(request => request.operation), ['getStatus', 'createNote', 'getNote']);
    }
  });
}
