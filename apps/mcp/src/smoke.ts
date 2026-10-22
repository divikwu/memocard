import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { bindingSchema, type ConnectionBinding } from './native-client.ts';

const writeEnabled = process.argv.includes('--write');
const args = process.argv.slice(2).filter(arg => arg !== '--write');
if (args.length !== 2 || args[0] !== '--connection-file' || !isAbsolute(args[1])) {
  process.stderr.write('Usage: pnpm --filter @memocard/mcp smoke --connection-file /absolute/path/connection.json [--write]\n');
  process.exitCode = 1;
} else {
  const client = new Client({ name: 'memocard-native-smoke', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../dist/index.js', import.meta.url)), '--connection-file', args[1]],
    stderr: 'pipe',
  });
  let stderrSeen = false;
  transport.stderr?.on('data', () => { stderrSeen = true; });
  let expectedBinding: ConnectionBinding | undefined;
  const data = (result: CallToolResult): Record<string, unknown> => {
    if (result.isError || !result.structuredContent) throw new Error('Tool failed');
    const binding = bindingSchema.parse(result.structuredContent.binding);
    if (expectedBinding && (binding.vaultId !== expectedBinding.vaultId || binding.instanceId !== expectedBinding.instanceId)) {
      throw new Error('Vault instance changed during verification');
    }
    expectedBinding ??= binding;
    return result.structuredContent;
  };
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map(tool => tool.name).sort();
    if (names.join(',') !== 'create_note,delete_note,get_note,get_status,get_trashed_note,list_tags,list_trash,restore_note,search_notes,update_note') throw new Error('Unexpected tools');
    const status = data(await client.callTool({ name: 'get_status', arguments: {} }) as CallToolResult);
    if (!status.connected) throw new Error('No connected vault');
    let writtenNote: Record<string, unknown> | undefined;
    if (writeEnabled) {
      const id = randomUUID();
      const created = data(await client.callTool({ name: 'create_note', arguments: {
        binding: status.binding, id, title: 'MCP 接入验证 ' + new Date().toISOString().slice(0, 10), body: 'MCP 新建验证 #mcp/verification',
      } }) as CallToolResult);
      const loaded = data(await client.callTool({ name: 'get_note', arguments: { id } }) as CallToolResult);
      if (loaded.body !== 'MCP 新建验证 #mcp/verification' || loaded.contentHash !== created.contentHash) throw new Error('Create verification failed');
      writtenNote = data(await client.callTool({ name: 'update_note', arguments: {
        binding: loaded.binding, id, baseHash: loaded.contentHash, body: 'MCP 新建、读取、修改与版本冲突保护已验证。 #mcp/verification',
      } }) as CallToolResult);
      const stale = await client.callTool({ name: 'update_note', arguments: { binding: loaded.binding, id, baseHash: loaded.contentHash, body: 'must not overwrite' } }) as CallToolResult;
      if (!stale.isError || !JSON.stringify(stale).includes('HASH_CONFLICT')) throw new Error('Missing version protection');
      const verified = data(await client.callTool({ name: 'get_note', arguments: { id } }) as CallToolResult);
      if (verified.contentHash !== writtenNote.contentHash || verified.body !== 'MCP 新建、读取、修改与版本冲突保护已验证。 #mcp/verification') throw new Error('Update verification failed');
    }
    const page = data(await client.callTool({ name: 'search_notes', arguments: { limit: 1 } }) as CallToolResult);
    const notes = page.notes as Array<{ id: string; contentHash: string }>;
    if (notes.length === 0) throw new Error('Create one note in the native app before running this smoke');
    const note = data(await client.callTool({ name: 'get_note', arguments: { id: notes[0].id } }) as CallToolResult);
    if (note.id !== notes[0].id || note.contentHash !== notes[0].contentHash) throw new Error('Note changed during verification');
    const tags = data(await client.callTool({ name: 'list_tags', arguments: {} }) as CallToolResult);
    if (stderrSeen) throw new Error('Unexpected stderr');
    process.stdout.write(JSON.stringify({
      passed: true, transport: 'stdio-to-native-loopback', tools: names,
      connected: status.connected, phase: status.phase, coverage: status.coverage,
      sameNoteVerified: true, writeVerified: writeEnabled, writtenNoteId: writtenNote?.id, writtenNoteUrl: writtenNote?.sourceUrl, tagCount: (tags.tags as unknown[]).length,
    }) + '\n');
  } catch {
    process.stderr.write('Native MCP smoke failed. Keep the configured service or Mac app running, select a vault with one saved note, enable MCP, and use its latest exported connection file.\n');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
