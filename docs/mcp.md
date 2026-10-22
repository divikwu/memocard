# MemoCard MCP

The MCP adapter is a local stdio process supporting reads, note creation, version-checked updates, recoverable deletion, and restoration. The configured native host owns vault access and file coordination; this process never scans a vault or opens note files itself. Use the existing MemoCardService menu-bar service to keep MCP available when the main Mac app quits. The Mac app's original MCP endpoint remains supported as a separate connection. Becoming integration remains outside M0/M1.

The optional [MemoCard skill](../skills/memocard/SKILL.md) defines content workflows, fixed-vault binding, conflict handling and readback verification. Copy `skills/memocard` into your Codex skills directory (normally `~/.codex/skills/`) after configuring the MCP server. It does not configure or grant native access. Run `pnpm test:memocard-skill` for the recorded simulated decisions and checker regressions; these are separate from live MCP acceptance.

## Build and configure

Use Node 24 and pnpm 10. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @memocard/mcp build
pnpm --filter @memocard/mcp test
```

Compilation writes `apps/mcp/dist/index.js`, `server.js`, `native-client.js`, and `smoke.js`. The package pins the published official `@modelcontextprotocol/sdk` to **1.32.0**. Its shipped TypeScript declarations support `McpServer.registerTool`, `StdioServerTransport`, `Client`, and `StdioClientTransport`; no unreleased v2 API is used. References: [published SDK package](https://www.npmjs.com/package/@modelcontextprotocol/sdk/v/1.32.0), [official v1 API](https://modelcontextprotocol.github.io/typescript-sdk/).

Build and install the service with `pnpm build:service` and `pnpm install:service`, then start `MemoCardService.app`. In its menu, select the intended vault, choose **启用 MCP 读写…**, and export to a private local directory outside the vault, iCloud, and Git repositories. Use **复制 MCP 配置路径** to get the absolute `service-connection.json` path. Keep the menu-bar service running; the main Mac app and browser can both be closed. **停用 MCP** revokes the service's write consent. The service's existing **登录时启动** setting is optional and is not changed automatically.

Service and Mac-app permissions are independent: enabling Web access or the main app's MCP does not authorize service MCP writes. The service restores only its own versioned write grant after a restart. Legacy read consent remains read-only. The service exports `service-connection.json`; the main app exports `connection.json`, so starting both hosts does not replace the other's configuration. Register one intended host's file in Codex. For the legacy Mac-app connection, enable MCP in Mac settings and keep that app running instead.

`memocard-service://configure-mcp` opens the same native configuration-folder picker as the menu action; it does not accept a path or token from the URL and does not grant writes without completing that picker.

Opening or cancelling that picker preserves the existing MCP connection. A confirmed configuration starts a new, independently owned attempt; a superseded automatic restore or manual enable cannot stop its successor. Disabling MCP or switching vaults invalidates any outstanding picker before it can grant writes.

The enabled state and write grant are persisted only after successful private-file export. Pending or failed enables, including overlapping failures, cannot change a previously disabled state or cause it to restore after a process restart.

For a client using the common `mcpServers` JSON format, replace the sample paths with the actual Node 24 binary, checkout, and exported configuration:

```json
{
  "mcpServers": {
    "memocard": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/memocard/apps/mcp/dist/index.js",
        "--connection-file",
        "/absolute/private/directory/service-connection.json"
      ]
    }
  }
}
```

Direct invocation has the same arguments:

```sh
node apps/mcp/dist/index.js --connection-file /absolute/private/directory/service-connection.json
```

This waits for MCP JSON-RPC on stdin. Stdout contains MCP protocol only. It is not an interactive shell or a TCP listener. A client may discover tools while its native host is stopped, but tool calls fail until that configured host is running and MCP is enabled.

## Tools

| Tool | Input | Result |
| --- | --- | --- |
| `get_status` | `{}` | Vault identity, phase, capabilities, sync state, indexing coverage |
| `search_notes` | `query?`, `tags?`, `from?`, `to?`, `limit?`, `cursor?` | Active notes, next cursor, coverage |
| `get_note` | `{id}` | One active note, content hash, relative source path, original source URL |
| `list_tags` | `{}` | `{tags:[{name,count}],coverage}` for active notes |
| `create_note` | `binding`, `body`, `title?`, `id?` (new UUID) | Compact saved-note receipt |
| `update_note` | `binding`, `id`, `body`, `baseHash`, `title?` | Compact saved-note receipt |
| `list_trash` | `{}` | Recoverable entries and unreadable-entry issues |
| `get_trashed_note` | `{trashKey}` | Exact archived note, deletion date and binding |
| `delete_note` | `binding`, `id`, `baseHash` | Recoverable deletion receipt with `trashKey` and `contentHash` |
| `restore_note` | `binding`, `trashKey`, `baseHash` | Compact restored-note receipt |

All tool results include a top-level `binding: {vaultId, instanceId}` captured from the exact connection used for that call. Create, update and restore receipts contain this binding plus `id`, optional `title`, `createdAt`, `updatedAt`, `contentHash`, `relativePath`, and `sourceUrl`. Delete receipts contain `binding`, `id`, `relativePath`, `trashKey`, and `contentHash`. Receipts omit the body so a successful mutation cannot exceed the MCP result budget just by echoing a large body. Read saved notes with `get_note` and archives with `get_trashed_note` when verifying.

Bodies are full Markdown replacements, including inline `#tags`. Existing frontmatter and custom properties are preserved during updates; omitting `title` preserves the current filename. A supplied title uses the existing coordinated rename and link-update behavior. Arbitrary paths, property changes, permanent deletion, empty-trash, and attachments are not exposed by these tools.

Delete is always a recoverable move into `.memocard/trash/`; it preserves source bytes and attachments. Read the active note first and pass its binding and `contentHash` as `baseHash`. Verify the receipt's exact `trashKey` with `get_trashed_note`, compare the archived body/hash, and confirm the active note is absent. Trash reads are explicit tools: normal searches and `get_note` continue excluding deleted notes. Nonempty `list_trash.issues` means some entries could not be read, so the list is incomplete.

Restore requires a fresh `get_trashed_note` and uses its top-level binding plus `note.contentHash` as `baseHash`. It publishes the reviewed bytes as a fresh visible active file before removing the archive, preserving Markdown bytes and original identity without carrying provider-hidden archive metadata into the active index. The durable journal rolls back a failed archive removal without rewriting unchanged archived bytes. An occupied filename gets a collision suffix; an already-active ID is rejected, never overwritten. Verify the returned receipt with `get_note` and confirm the exact archive key is no longer listed. On timeout, reconcile the active note and exact archive in the verified original vault before retrying; absence from an unverified vault cannot prove success.

Read `get_status` before `create_note` and pass its `binding`. Read `get_note` before `update_note` or `delete_note` and pass both its `binding` and `contentHash` (as `baseHash`). Read `get_trashed_note` before `restore_note` and use its binding and `note.contentHash`. Every write requires both the vault ID and server instance ID to still match; `VAULT_CHANGED` is rejected before connecting by the adapter and independently before dispatch by the native listener. This also prevents writes to a copied vault with identical IDs/hashes. Switching vaults, restarting the app, or toggling MCP invalidates old bindings. Verify the intended vault before rereading and retrying; never automatically retarget a stale write. `HASH_CONFLICT` means another client changed the source: read again and reconcile before retrying. Creation never overwrites an existing note. Prefer supplying a fresh UUID to `create_note`; after a timeout or connection failure, read that ID (or search if no ID was supplied) before retrying, because the source may already have committed. There is no automatic retry for writes.

The Mac app setting is **MCP 本机读写**. Explicitly enabling it authorizes the six reads and these four writes for the selected vault. Legacy `mcpEnabled=true` restores read-only access, with the write switch unchecked and an option to close legacy reading. A separate versioned write grant is persisted only after an explicit enable succeeds; missing or unknown versions never grant writes. Disabling MCP revokes that grant. A read-only listener returns `WRITE_DISABLED` for write attempts and advertises only read capabilities. Switching vaults or disabling MCP revokes the old server. The lower-level listener remains read-only by default unless the app explicitly opts into writes.

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

Native operations are restricted to `getStatus`, `queryNotes`, `getNote`, `listTags`, `getTrash`, `getTrashedNote`, `createNote`, `updateNote`, `deleteNote`, and `restoreNote`. The raw `saveNote`, permanent deletion, and property operations remain unavailable. Writes delegate to the same Swift save logic as the app and carry the current vault binding through actor dispatch. The host must authenticate token, instance ID, and vault ID before accessing data. Replies have the matching `requestId`:

```text
{requestId,ok:true,data}\n
{requestId,ok:false,error:{code,message,retryable}}\n
```

The total TCP deadline is 15 seconds, including connect and fragmented response receipt. Requests are at most 8 MiB; responses are at most 64 MiB, excluding their trailing newline. The larger response limit accommodates JSON escaping of a valid 8 MiB source note. The native host returns `RESPONSE_TOO_LARGE` if a response exceeds this bound. Byte chunks are joined before strict UTF-8 decoding, so splitting a Chinese character or emoji across packets is safe. Invalid UTF-8, malformed JSON, mismatched IDs, oversized frames, incomplete replies, and extra buffered frame data fail closed. Omitted Swift optional values such as `nextCursor` and `indexedAt` are normalized to JSON `null` in MCP output.

The configured native host must revoke old credentials and close old connections on disable or vault changes. The adapter does not cache credentials or silently select another vault. It does not log tokens, note bodies, filesystem error details, or raw native error messages. Known native error codes retain their identity with static sanitized messages; unknown codes become `NATIVE_REJECTED`. For `STALE_CURSOR`, start again without a cursor. `NOTE_NOT_FOUND` and `UNAUTHORIZED` remain distinct from pagination errors. Local configuration, protocol, unavailable-host, and timeout errors also have separate stable codes.

## Verification and limits

```sh
pnpm --filter @memocard/mcp typecheck
pnpm --filter @memocard/mcp lint
pnpm --filter @memocard/mcp test
pnpm --filter @memocard/mcp build
pnpm test:service-mcp
pnpm test:service-host
```

Automated tests use **mocked TCP hosts** and the actual official SDK stdio client/server. They check tool discovery and calls, credential rotation, operation allow lists and write opt-in, deleted-note exclusion, strict configuration checks, malformed replies, split UTF-8, oversized frames, and the actual 15-second timeout. These tests are protocol verification; they are not proof of native sandbox permission, iCloud coordination, Mac UI, or iPhone behavior.

`test:service-host` additionally exercises the complete production service host and real `VaultStore` in isolated temporary vaults. It controls picker decisions and start scheduling, covers concurrent restore/enable and cancellation, and exits/relaunches native processes to verify persisted bookmarks, selected-vault recovery, independent write consent, credential rotation and subsequent writes. The SDK also exercises reversible deletion/restoration across vault changes and a fresh host process, stale active/archive hashes, duplicate identities, unsafe archive keys and preservation of unrelated notes. It is part of `test:service`; installed-app sandbox and native picker acceptance remain separate checks.

For a real native-host smoke, keep MemoCardService running with the intended vault and at least one saved note, enable MCP, then run:

```sh
pnpm --filter @memocard/mcp smoke --connection-file /absolute/private/directory/service-connection.json
```

The script launches the **compiled** stdio entrypoint, lists the ten tools, reads status, searches an active note, reads that same ID, compares content hashes, and lists tags. It prints only pass status and metadata, never note bodies or credentials. An empty vault causes the smoke to fail rather than claiming the four read tools were verified. A passing run proves the local stdio → native loopback read path at that moment; it does not prove iCloud or iPhone acceptance.


To also verify creation, read-back, update, and stale-version rejection against the configured native host, run:

```sh
pnpm --filter @memocard/mcp smoke --connection-file /absolute/private/directory/service-connection.json --write
```

This leaves one clearly labeled `MCP 接入验证 YYYY-MM-DD` note in the selected vault and prints its ID and source URL. It does not change other notes. The normal smoke remains read-only.

## Codex setup

Build the adapter, keep MemoCardService running with the intended vault and MCP enabled, then register its exported configuration using absolute paths:

```sh
codex mcp add memocard -- /absolute/path/to/node /absolute/path/to/memocard/apps/mcp/dist/index.js --connection-file /absolute/private/directory/service-connection.json
```

This creates `[mcp_servers.memocard]` in `~/.codex/config.toml`. Only the connection file path is registered; credentials stay in the app-exported `0600` file and rotate when the server restarts. Start a new Codex chat after changing MCP configuration so its tool catalog includes the ten MemoCard tools. See [official OpenAI MCP documentation](https://developers.openai.com/codex/mcp/).
