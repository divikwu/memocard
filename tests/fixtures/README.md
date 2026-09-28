# Shared M0 bridge fixture

`bridge-v1.json` is the single shared JSON response example for the Swift core, UI bridge, and MCP tests. Each `note`, `status`, and `error` property is a native bridge reply envelope. MCP adds a matching `requestId` on its native TCP hop and emits the successful `data` as a tool result.

`vault/` is a minimal on-disk vault with one real UTF-8 Markdown note. Its raw source SHA-256 matches `note.data.contentHash`; the native parser and MCP fixture-integrity test must enforce that equality. This is artificial test data, never application seed content or evidence that a real user vault/iCloud sync has been verified.

The recorded `status.data.coverage.indexedAt` is a fixed example time. Native tests should compare the actual generated timestamp's shape, not require a live scan to equal that fixture time. Copy the vault into a temporary directory before any tests that can write; keep these source fixtures unchanged.
