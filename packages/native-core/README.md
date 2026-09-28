# MemoCardCore — M1 file foundation

Swift tools 5.9, Swift language mode 5, macOS 14 / iOS 17. Yams 5.1.3 is exact-pinned in `Package.swift` and `Package.resolved`. This package owns file parsing, coordinated access and device-only drafts. It does not own the directory picker, security-scoped bookmark lifetime, UI, networking or MCP authentication.

## Host API

```swift
import MemoCardCore

let store = try VaultStore(localDataURL: applicationSupportURL)
try await store.open(url: userSelectedDirectory, create: true)
let data = try await store.perform(operation: "getStatus", params: Data("{}".utf8))
let image = try await store.asset(relativePath: "assets/<uuid>.png")
await store.close()
```

`VaultStore` is a public actor. `open(url:create:)` returns `Void`; `perform(operation:params:)` returns the operation's JSON **data**, not a bridge envelope. The host holds directory authorization throughout use and wraps `VaultError.code`, `.message`, `.retryable`. Other I/O failures from `perform` become `IO_ERROR`. `open`/`asset` can also throw Foundation I/O errors for the host to wrap. Failed opening clears the previous vault. `asset` permits only regular files under `assets/`, with coordinated reads and no symbolic links.

| Operation | Result |
| --- | --- |
| `getStatus` | Contract status, `phase: "M1"`, advertised capability operation names |
| `queryNotes` | `{notes,nextCursor,coverage}`; `nextCursor` is explicitly null at the end |
| `getNote` / `saveNote` | Contract `Note` |
| `listTags` | `{tags:[{name,count}],coverage}`; excludes deleted notes |
| `saveDraft` | `{id,body,tags,baseHash,updatedAt}`; nullable `baseHash` is explicit |
| `getDrafts` | `{drafts:[...]}` for the selected vault only |
| `importAttachment` | `{relativePath:"assets/<uuid>.<ext>",markdownPath:"../assets/<uuid>.<ext>"}` |

Queries use literal case-insensitive body substring, exact tag AND, inclusive `from` and exclusive `to` over `createdAt`. Dates must include time and timezone in ISO 8601 format. Sorting is creation date descending, then UUID ascending. Limit defaults to 50 and is bounded to 1…100. Opaque cursors bind the query (including limit) and source snapshot; changed queries return `CURSOR_QUERY_MISMATCH`, changed source bytes/path/coverage return retryable `STALE_CURSOR`. Restart pagination rather than reusing either cursor.

## File behavior

- Creating requires an empty selected directory (apart from `.DS_Store`). It writes `.memocard/vault.json` with format version 1 and a UUID, plus `notes/` and `assets/`.
- Recursively scan non-hidden Markdown files inside `notes/`. UUID in frontmatter is identity; filename can change externally. `createdAt` and `updatedAt` must be valid ISO timestamps. Optional `tags` must contain strings. Optional `deletedAt` excludes the note from default queries. M1 has no deletion or restoration command.
- Hashes are SHA256 of exact source bytes, including CRLF. Parsing accepts LF/CRLF and a closing frontmatter delimiter at EOF. Saving emits LF and may reformat YAML; unknown YAML keys and values survive, but YAML comments and original whitespace are not guaranteed to survive an edit.
- Every formal save rescans the vault, coordinates access, rereads the current file and verifies `baseHash`. Existing files require the current hash; a new UUID requires null. Deleted/missing originals are never recreated from an old hash. Writes use Foundation atomic replacement inside file coordination. Single Markdown files are capped at 8 MiB, both read and write.
- Duplicate UUIDs, malformed files, unresolved `NSFileVersion` conflicts and read failures are excluded from successful records and counted as issues. All originals and system conflict versions remain untouched. Pending iCloud download metadata is counted separately and a download is requested.
- **M1 deliberately refuses formal saves when a scan is incomplete.** Local draft saving remains available after a vault has opened, including when its directory subsequently becomes unavailable. Full offline capture, repair/triage UI and conflict-resolution UI remain gated work.
- Draft JSON lives under `localDataURL/drafts/<vaultId>/`; localDataURL must be separate from the vault. After a successful source commit, only a draft matching the saved ID/body/tags/baseHash is removed. Changed drafts and drafts whose cleanup fails remain recoverable. Failed formal saves never clear drafts.
- Import accepts ImageIO-recognized image data only and generates the extension from image type. Incoming filename cannot contain directories. Attachment writes finish before the result is returned, so a note can subsequently reference a complete local attachment. No automatic orphan cleanup or multi-file transaction is claimed.
- Paths are checked before and inside coordination. Relative-path generation handles Foundation's `/var` versus `/private/var` aliases. Vault descendants cannot be symbolic links. The vault manifest is checked on every cloud/file operation to avoid silently serving a replaced vault.

`syncState: "localReadComplete"` means the current scan could read its sources. It is **not** an iCloud upload receipt, a remote-device acknowledgment or a globally atomic snapshot. An incomplete scan returns `complete:false`; an unavailable root returns an error. There is no SQLite index, backup/restore, automatic conflict merging or iCloud synchronization engine in this M1 package.

## Verification

Run `swift test` from this directory. Tests create isolated temporary on-disk vaults and exercise real Foundation file coordination and atomic writes; they do not simulate a successful cloud sync. Tests cover reopen, metadata/unknown YAML preservation, external rename and deletion, stale-hash rejection, malformed ID/date, duplicate IDs, query boundaries/pagination invalidation, device-only drafts, image import, path/symlink rejection and unsupported operations.

Pending real-device gates: free signing + installation on the physical iPhone; selecting the same iCloud Drive folder on both devices; bookmark restoration; actual pending-download metadata; two-device offline conflict versions; forced termination during attachment and Markdown writes; system permission/account changes. Local XCTest success does not pass these gates. Interrupted initial vault creation may require selecting a new empty folder; M1 never deletes a partial directory automatically.
