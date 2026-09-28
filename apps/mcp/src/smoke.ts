import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--connection-file' || !isAbsolute(args[1])) {
  process.stderr.write('Usage: pnpm --filter @memocard/mcp smoke --connection-file /absolute/path/connection.json\n');
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
  const data = (result: CallToolResult): Record<string, unknown> => {
    if (result.isError || !result.structuredContent) throw new Error('Tool failed');
    return result.structuredContent;
  };
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map(tool => tool.name).sort();
    if (names.join(',') !== 'get_note,get_status,list_tags,search_notes') throw new Error('Unexpected tools');
    const status = data(await client.callTool({ name: 'get_status', arguments: {} }) as CallToolResult);
    if (!status.connected) throw new Error('No connected vault');
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
      sameNoteVerified: true, tagCount: (tags.tags as unknown[]).length,
    }) + '\n');
  } catch {
    process.stderr.write('Native MCP smoke failed. Keep the Mac app open, select a vault with one saved note, enable MCP, and use its latest exported connection file.\n');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
