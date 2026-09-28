import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { isAbsolute, normalize } from 'node:path';
import { createMemoCardServer } from './server.ts';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--connection-file' || !isAbsolute(args[1]) || normalize(args[1]) !== args[1]) {
  process.stderr.write('Usage: node dist/index.js --connection-file /absolute/path/connection.json\n');
  process.exitCode = 1;
} else {
  try {
    await createMemoCardServer(args[1]).connect(new StdioServerTransport());
  } catch {
    process.stderr.write('MemoCard MCP could not start.\n');
    process.exitCode = 1;
  }
}
