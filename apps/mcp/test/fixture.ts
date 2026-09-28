import { createServer, type Socket } from 'node:net';
import { mkdtemp, readFile, writeFile, chmod, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import type { BridgeResponse, Note, VaultStatus } from '@memocard/contracts';

export const sharedFixture = JSON.parse(await readFile(new URL('../../../tests/fixtures/bridge-v1.json', import.meta.url), 'utf8')) as {
  formatVersion: 1;
  note: Extract<BridgeResponse<Note>, { ok: true }>;
  status: Extract<BridgeResponse<VaultStatus>, { ok: true }>;
  error: Extract<BridgeResponse, { ok: false }>;
};
export const note = sharedFixture.note.data;
export const status = sharedFixture.status.data;
export const coverage = status.coverage;
export type Request = {
  version: number; requestId: string; operation: string; params: Record<string, unknown>;
  token: string; instanceId: string; vaultId: string;
};

export async function fixture(t: TestContext, respond: (request: Request, socket: Socket) => void) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'memocard-mcp-test-')));
  const path = join(dir, 'connection.json');
  const requests: Request[] = [];
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let input = '';
    socket.setEncoding('utf8');
    socket.on('data', part => {
      input += part;
      if (!input.includes('\n')) return;
      const request = JSON.parse(input.slice(0, input.indexOf('\n'))) as Request;
      requests.push(request);
      respond(request, socket);
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test address');
  const config = { version: 1, host: '127.0.0.1', port: address.port, token: randomUUID(), instanceId: randomUUID(), vaultId: status.vaultId };
  const write = async (value: unknown = config) => {
    await writeFile(path, JSON.stringify(value), { mode: 0o600 });
    await chmod(path, 0o600);
  };
  await write();
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  return { dir, path, config, write, requests };
}

export function reply(socket: Socket, request: Request, data: unknown) {
  socket.end(JSON.stringify({ requestId: request.requestId, ok: true, data }) + '\n');
}
