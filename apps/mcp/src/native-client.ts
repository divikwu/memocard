import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute, normalize } from 'node:path';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { ConnectionConfig } from '@memocard/contracts';
import { z } from 'zod';

export const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
// A valid 8 MiB Markdown note can expand sixfold when JSON escapes control characters.
export const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 15_000;
const MAX_CONFIG_BYTES = 16 * 1024;
const operations = new Set(['getStatus', 'queryNotes', 'getNote', 'listTags', 'getTrash', 'getTrashedNote', 'createNote', 'updateNote', 'deleteNote', 'restoreNote']);
const nativeErrorMessages: Record<string, string> = {
  WRITE_DISABLED: 'MCP write access is disabled. Enable it explicitly in the configured MemoCard host.',
  HASH_CONFLICT: 'The note or archive changed since it was read. Read it again and reconcile before writing.',
  INVALID_TRASH: 'The trash entry is invalid or unavailable. Read the current trash list in the configured MemoCard host.',
  INDEXING: 'The vault is indexing. Wait for indexing to finish before writing.',
  INVALID_ARGUMENT: 'The native request is invalid.',
  INVALID_PARAMS: 'The native request parameters are invalid.',
  INVALID_ID: 'Use a valid note UUID.',
  INVALID_DATE: 'Use an ISO 8601 date with a timezone.',
  INVALID_TAGS: 'Use valid note tags.',
  INVALID_CURSOR: 'The pagination cursor is invalid. Start from the first page.',
  CURSOR_QUERY_MISMATCH: 'Search filters changed. Start from the first page.',
  STALE_CURSOR: 'The vault changed. Start from the first page.',
  UNAUTHORIZED: 'Connection authorization expired. Check the configured MemoCard host and export fresh connection settings.',
  NOT_FOUND: 'The requested note is unavailable.',
  NOTE_NOT_FOUND: 'The requested note was not found.',
  NOTE_UNAVAILABLE: 'The requested note is unavailable. Check indexing coverage in the configured MemoCard host.',
  NOTE_DELETED: 'The requested note is deleted.',
  NOTE_TOO_LARGE: 'The note exceeds the supported Markdown size.',
  FILE_PENDING: 'Content is not downloaded yet. Start the configured MemoCard host and wait for iCloud Drive.',
  SOURCE_CONFLICT: 'The note has unresolved file versions. Resolve the conflict in the configured MemoCard host.',
  DUPLICATE_ID: 'Multiple note files use this ID. Resolve the duplicate files in the configured MemoCard host.',
  SCAN_INCOMPLETE: 'Indexing coverage is incomplete. Check pending content in the configured MemoCard host.',
  SCAN_FAILED: 'The vault could not be scanned. Check folder access in the configured MemoCard host.',
  VAULT_NOT_OPEN: 'Select a vault in the configured MemoCard host.',
  VAULT_NOT_FOUND: 'The selected vault was not found. Select it again in the configured MemoCard host.',
  VAULT_UNAVAILABLE: 'The vault is unavailable. Check folder access in the configured MemoCard host.',
  VAULT_CHANGED: 'The vault changed. Export fresh connection settings from the configured MemoCard host.',
  INVALID_VAULT: 'The vault format is invalid. Check it in the configured MemoCard host.',
  UNSUPPORTED_FORMAT: 'The vault format is unsupported by this app version.',
  STORE_UNAVAILABLE: 'The native store is unavailable. Check vault authorization in the configured MemoCard host.',
  COORDINATION_FAILED: 'Coordinated file access failed. Retry after checking the configured MemoCard host.',
  IO_ERROR: 'File access failed. Check folder access and file availability in the configured MemoCard host.',
  PATH_NOT_ALLOWED: 'The requested file is outside the allowed vault paths.',
  SYMLINK_NOT_ALLOWED: 'Symbolic links are not allowed in the vault.',
  INVALID_NOTE: 'The note is not valid UTF-8 Markdown.',
  INVALID_FRONTMATTER: 'The note metadata is invalid. Check the source file in the configured MemoCard host.',
  BUSY: 'The configured MemoCard host is busy. Retry after the current operation finishes.',
  CANCELLED: 'The native operation was cancelled. Check the selected vault before retrying.',
  RESPONSE_TOO_LARGE: 'The native response exceeds 64 MiB. Narrow the search or read an individual note.',
};

export class BridgeFailure extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'BridgeFailure';
    this.code = code;
    this.retryable = retryable;
  }
}

export const bindingSchema = z.strictObject({ vaultId: z.string().min(1).max(256), instanceId: z.string().min(1).max(256) });
export type ConnectionBinding = z.infer<typeof bindingSchema>;

const connectionSchema = z.strictObject({
  version: z.literal(1),
  host: z.literal('127.0.0.1'),
  port: z.number().int().min(1).max(65535),
  token: z.string().min(1).max(1024),
  instanceId: z.string().min(1).max(256),
  vaultId: z.string().min(1).max(256),
});

export async function readConnectionFile(path: string): Promise<ConnectionConfig> {
  if (!isAbsolute(path) || normalize(path) !== path) {
    throw new BridgeFailure('CONFIG_INVALID', 'Connection file must use an absolute, normalized path.');
  }
  // Open without following a final symlink, then inspect the opened inode.
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK).catch(() => {
    throw new BridgeFailure('CONFIG_UNAVAILABLE', 'Cannot open the connection file. Export it from the configured MemoCard host.');
  });
  try {
    const stat = await file.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 ||
        stat.uid !== process.getuid?.() || stat.size > MAX_CONFIG_BYTES) {
      throw new BridgeFailure('CONFIG_INVALID', 'Connection file must be an owned regular file with mode 0600.');
    }
    const bytes = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    if (bytesRead > MAX_CONFIG_BYTES) {
      throw new BridgeFailure('CONFIG_INVALID', 'Connection file is too large.');
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytesRead)));
    } catch {
      throw new BridgeFailure('CONFIG_INVALID', 'Connection file is not valid UTF-8 JSON.');
    }
    const parsed = connectionSchema.safeParse(value);
    if (!parsed.success) {
      throw new BridgeFailure('CONFIG_INVALID', 'Connection file does not match the local bridge contract.');
    }
    return parsed.data;
  } finally {
    await file.close();
  }
}

const replySchema = z.discriminatedUnion('ok', [
  z.object({ requestId: z.string(), ok: z.literal(true), data: z.unknown() }),
  z.object({
    requestId: z.string(), ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }),
  }),
]);

function parseReply(bytes: Buffer, requestId: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new BridgeFailure('PROTOCOL_ERROR', 'Native host returned invalid UTF-8 JSON.');
  }
  const parsed = replySchema.safeParse(value);
  if (!parsed.success || parsed.data.requestId !== requestId) {
    throw new BridgeFailure('PROTOCOL_ERROR', 'Native host returned an invalid or mismatched response.');
  }
  if (!parsed.data.ok) {
    // Native error messages may contain file names or user content. Do not relay them.
    const nativeError = parsed.data.error;
    const known = Object.hasOwn(nativeErrorMessages, nativeError.code);
    throw new BridgeFailure(
      known ? nativeError.code : 'NATIVE_REJECTED',
      known ? nativeErrorMessages[nativeError.code] : 'Native host rejected the request. Check the configured MemoCard host vault and MCP status.',
      nativeError.retryable,
    );
  }
  return parsed.data.data;
}

export async function requestNative(
  connectionFile: string,
  operation: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  return (await requestNativeWithBinding(connectionFile, operation, params)).data;
}

export async function requestNativeWithBinding(
  connectionFile: string,
  operation: string,
  params: Record<string, unknown> = {},
): Promise<{ data: unknown; binding: ConnectionBinding }> {
  if (!operations.has(operation)) {
    throw new BridgeFailure('OPERATION_DENIED', 'This native operation is not available through MCP.');
  }
  const config = await readConnectionFile(connectionFile);
  const binding = { vaultId: config.vaultId, instanceId: config.instanceId };
  if (['createNote', 'updateNote', 'deleteNote', 'restoreNote'].includes(operation)) {
    const expected = bindingSchema.safeParse(params.binding);
    if (!expected.success || expected.data.vaultId !== binding.vaultId || expected.data.instanceId !== binding.instanceId) {
      throw new BridgeFailure('VAULT_CHANGED', 'The vault instance changed. Read get_status or get_note again before writing.');
    }
  }
  const requestId = randomUUID();
  const safeParams = operation === 'queryNotes' ? { ...params, deleted: false } : params;
  const request = Buffer.from(JSON.stringify({
    version: 1, requestId, token: config.token, instanceId: config.instanceId, vaultId: config.vaultId,
    operation, params: safeParams,
  }) + '\n');
  if (request.length - 1 > MAX_REQUEST_BYTES) {
    throw new BridgeFailure('FRAME_TOO_LARGE', 'Native request exceeds the 8 MiB frame limit.');
  }

  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: config.host, port: config.port, family: 4 });
    let settled = false;
    let size = 0;
    const chunks: Buffer[] = [];
    const finish = (error?: BridgeFailure, data?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve({ data, binding });
    };
    const timer = setTimeout(() => {
      finish(new BridgeFailure('TIMEOUT', 'Native host did not reply within 15 seconds.', true));
    }, REQUEST_TIMEOUT_MS);
    socket.once('connect', () => socket.write(request));
    socket.on('data', (chunk: Buffer) => {
      if (settled) return;
      const newline = chunk.indexOf(0x0a);
      const part = newline < 0 ? chunk : chunk.subarray(0, newline);
      size += part.length;
      if (size > MAX_RESPONSE_BYTES) {
        finish(new BridgeFailure('FRAME_TOO_LARGE', 'Native response exceeds the 64 MiB frame limit.'));
        return;
      }
      chunks.push(part);
      if (newline < 0) return;
      // The bridge has one reply per connection; additional frames are invalid.
      if (newline !== chunk.length - 1) {
        finish(new BridgeFailure('PROTOCOL_ERROR', 'Native host returned unexpected trailing data.'));
        return;
      }
      try {
        const data = parseReply(Buffer.concat(chunks, size), requestId);
        if (operation === 'getStatus' && typeof data === 'object' && data !== null &&
            'vaultId' in data && data.vaultId !== config.vaultId) {
          finish(new BridgeFailure('VAULT_CHANGED', 'Vault changed. Export a fresh connection file from the configured MemoCard host.'));
          return;
        }
        finish(undefined, data);
      } catch (error) {
        finish(error instanceof BridgeFailure ? error : new BridgeFailure('PROTOCOL_ERROR', 'Invalid native response.'));
      }
    });
    socket.once('error', () => finish(new BridgeFailure('HOST_UNAVAILABLE', 'Cannot connect to MemoCard. Start the configured background service or Mac app and enable MCP.', true)));
    socket.once('end', () => finish(new BridgeFailure('PROTOCOL_ERROR', 'Native connection ended before a complete reply.')));
    socket.once('close', () => finish(new BridgeFailure('HOST_UNAVAILABLE', 'Native connection closed before a complete reply.', true)));
  });
}
