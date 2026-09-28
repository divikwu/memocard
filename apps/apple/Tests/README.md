# Native local read-server regression tests

On macOS with Xcode command-line tools and Node 24, run from the repository root:

```sh
node --test apps/apple/Tests/local-read-server.test.mjs
```

The test compiles the production `Sources/LocalReadServer.swift` with a small deterministic in-memory handler. Compilation enables complete Swift concurrency checking and treats warnings as errors. The host is a real native process using `Network.framework`; Node drives its IPv4 loopback TCP socket.

Coverage includes half-closed streams containing multiple frames, split multibyte UTF-8, request/response IDs, exactly 8 MiB frames and oversized frames, token/instance/vault authentication, read-only operation enforcement, simultaneous clients, incomplete EOF, and oversized replies. The exact-size frame regression failed before the limit fix and passes afterward.

Configuration is exchanged via a temporary `0600` file. The harness prints only `READY`, never credentials or request content; test directories and processes are cleaned up afterward.

These tests verify the production native TCP server with an in-memory handler. They do not verify the Mac app's sandbox, picker, vault storage, WebView bridge, iCloud, or iPhone. Use the application MCP smoke separately for the real vault read path.

## Local Web HTTP

Run `pnpm test:local-web`. A separate native harness compiles the production `LocalWebServer.swift`, serves a temporary production-shaped HTML fixture, and exercises the real loopback listener. Coverage includes exact Host/Origin checks, authentication/replay, forbidden operations, Unicode fragmentation, header/body limits, unauthorized image reads, path/symlink escape, served-only CSP replacement including Vite's encoded quotes, repeated launch session reuse, and stop/restart invalidation. The handler is synthetic; real Swift file operations and the browser UI are verified separately. `pnpm test:native` additionally covers binding invalidation between cloned vaults with identical vault IDs.
