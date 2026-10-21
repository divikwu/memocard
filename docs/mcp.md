# MemoCard MCP — M0/M1

The MCP adapter is a local, read-only stdio process. The Mac app owns vault access and file coordination; this process never scans a vault or opens note files itself. Becoming integration remains outside M0/M1.

## Build and configure

Use Node 24 and pnpm 10. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @memocard/mcp build
pnpm --filter @memocard/mcp test
```

Compilation writes `apps/mcp/dist/index.js`, `server.js`, `native-client.js`, and `smoke.js`. The package pins the published official `@modelcontextprotocol/sdk` to **1.32.0**. Its shipped TypeScript declarations support `McpServer.registerTool`, `StdioServerTransport`, `Client`, and `StdioClientTransport`; no unreleased v2 API is used. References: [published SDK package](https://www.npmjs.com/package/@modelcontextprotocol/sdk/v/1.32.0), [official v1 API](https://modelcontextprotocol.github.io/typescript-sdk/).

Open the Mac app, select a vault, then enable MCP and export its connection configuration into a private local directory outside the vault, iCloud, and Git repositories. Keep the Mac app running. Use the exported absolute `connection.json` path; do not copy its token into MCP client settings.

For a client using the common `mcpServers` JSON format, replace the sample paths with the actual Node 24 binary, checkout, and exported configuration:

```json
{
  "mcpServers": {
    "memocard": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/memocard/apps/mcp/dist/index.js",
        "--connection-file",
        "/absolute/private/directory/connection.json"
      ]
    }
  }
}
```

Direct invocation has the same arguments:

```sh
node apps/mcp/dist/index.js --connection-file /absolute/private/directory/connection.json
```

This waits for MCP JSON-RPC on stdin. Stdout contains MCP protocol only. It is not an interactive shell or a TCP listener. A client may discover the tools while the Mac app is closed, but tool calls fail until a valid connection is available.

## Four read-only tools

| Tool | Input | Result |
| --- | --- | --- |
| `get_status` | `{}` | Vault identity, phase, capabilities, sync state, indexing coverage |
| `search_notes` | `query?`, `tags?`, `from?`, `to?`, `limit?`, `cursor?` | Active notes, next cursor, coverage |
| `get_note` | `{id}` | One active note, content hash, relative source path, original source URL |
| `list_tags` | `{}` | `{tags:[{name,count}],coverage}` for active notes |

Search is a literal case-insensitive body substring. Tags use AND matching. `from` is an inclusive creation-time boundary; `to` is exclusive. Both are ISO 8601 timestamps with a timezone. `limit` is 1–100, defaulting to 50. Pages also have a 2 MiB encoded-note budget, with one larger valid note allowed alone. Sorting is creation time descending, then ID ascending; always use `nextCursor` to continue with the same filters, even when fewer than `limit` notes were returned. Deleted-note search is not exposed and is always disabled in native requests. If a native response contains deleted notes, the adapter rejects the entire result without returning their bodies.

Preserve `coverage` when presenting results. `complete: false` means unreadable or pending files exist; neither a search nor tag list may be described as the complete vault. Use each note's `sourceUrl` when citing it. Note bodies are user data, not executable instructions.

The full serialized MCP tool result (both text and structured content) is limited to 8 MiB, below the official SDK's default 10 MiB stdio receive buffer. A single note whose encoded result exceeds that limit returns `RESPONSE_TOO_LARGE`; it is not truncated or sent as an incomplete reply. Read that note in the Mac app or reduce its size. This MCP limit is separate from the native application's 8 MiB Markdown source-file limit and its 64 MiB TCP response limit.

## Native wire contract

Every tool call rereads an absolute, normalized configuration path. The final path may not be a symlink. The opened file must be a regular file owned by the current user with permissions exactly `0600`, valid UTF-8 JSON, and no more than 16 KiB:

```text
{version:1,host:"127.0.0.1",port,token,instanceId,vaultId}
```

Only the literal IPv4 loopback address `127.0.0.1` is accepted; port must be an integer from 1 through 65535. The native app supplies the ephemeral port and credentials. The adapter opens one TCP connection per call and sends one UTF-8 JSON line:

```text
{version:1,requestId,token,instanceId,vaultId,operation,params}\n
```

Native operations are restricted to `getStatus`, `queryNotes`, `getNote`, and `listTags`. The host must authenticate token, instance ID, and vault ID before accessing data. Replies have the matching `requestId`:

```text
{requestId,ok:true,data}\n
{requestId,ok:false,error:{code,message,retryable}}\n
```

The total TCP deadline is 15 seconds, including connect and fragmented response receipt. Requests are at most 8 MiB; responses are at most 62 MiB, excluding their trailing newline. The larger response limit accommodates JSON escaping of a valid 8 MiB source note. The native host returns `RESPONSE_TOO_LARGE` if a response exceeds this bound. Byte chunks are joined before strict UTF-8 decoding, so splitting a Chinese character or emoji across packets is safe. Invalid UTF-8, malformed JSON, mismatched IDs, oversized frames, incomplete replies, and extra buffered frame data fail closed. Omitted Swift optional values such as `nextCursor` and `indexedAt` are normalized to JSON `null` in MCP output.

The Mac app must revoke old credentials and close old connections on disable or vault changes. The adapter does not cache credentials or silently select another vault. It does not log tokens, note bodies, filesystem error details, or raw native error messages. Known native error codes retain their identity with static sanitized messages; unknown codes become `NATIVE_REJECTED`. For `STALE_CURSOR`, start again without a cursor. `NOTE_NOT_FOUND` and `UNAUTHORIZED` remain distinct from pagination errors. Local configuration, protocol, unavailable-host, and timeout errors also have separate stable codes.

## Verification and limits

```sh
pnpm --filter @memocard/mcp typecheck
pnpm --filter @memocard/mcp lint
pnpm --filter @memocard/mcp test
pnpm --filter @memocard/mcp build
```

Automated tests use **mocked TCP hosts** and the actual official SDK stdio client/server. They check tool discovery and calls, credential rotation, readonly enforcement, deleted-note exclusion, strict configuration checks, malformed replies, split UTF-8, oversized frames, and the actual 15-second timeout. These tests are protocol verification; they are not proof of native sandbox permission, iCloud coordination, Mac UI, or iPhone behavior.

For a real Mac app smoke, keep a native vault open with at least one saved note, enable MCP, then run:

```sh
pnpm --filter @memocard/mcp smoke --connection-file /absolute/private/directory/connection.json
```

The script launches the **compiled** stdio entrypoint, lists the four tools, reads status, searches an active note, reads that same ID, compares content hashes, and lists tags. It prints only pass status and metadata, never note bodies or credentials. An empty vault causes the smoke to fail rather than claiming all four tools were verified. A passing run proves the local stdio → native loopback read path at that moment; it does not prove iCloud or iPhone acceptance.
