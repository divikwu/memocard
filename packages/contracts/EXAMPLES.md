# Bridge v1 JSON examples

The canonical JSON examples are maintained once in [`tests/fixtures/bridge-v1.json`](../../tests/fixtures/bridge-v1.json). They contain successful note/status replies and a failed note lookup reply. The corresponding Markdown source is in [`tests/fixtures/vault`](../../tests/fixtures/vault).

UI and core replies use `{ok:true,data}` or `{ok:false,error:{code,message,retryable}}`. Native MCP TCP replies add `requestId` at the top level. A `queryNotes` success wraps an array of these note payloads with `nextCursor: string|null` and the status example's `coverage` shape. `listTags` returns `{tags:[{name,count}],coverage}`. Runtime timestamps vary; source-byte hashes do not.

Examples are shared fixtures for contract tests, not a second schema implementation or sample data loaded into the app.
