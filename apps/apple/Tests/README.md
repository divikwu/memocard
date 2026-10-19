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

## iOS sidebar performance

The shared `MemoCardiOS` scheme runs `UITests/SidebarPerformanceTests.swift` in **Release**, with five measured iterations after XCTest's warm-up. Use a dedicated Simulator connected to a disposable QA vault with enough nested tags to scroll. The tests only launch, open/close navigation, and swipe; they do not edit notes.

```sh
xcodebuild -project apps/apple/MemoCard.xcodeproj -scheme MemoCardiOS \
  -destination 'platform=iOS Simulator,id=YOUR_SIMULATOR_UUID' \
  -derivedDataPath /tmp/memocard-ios-performance-build \
  -resultBundlePath /tmp/memocard-ios-performance-$(date +%Y%m%d-%H%M%S).xcresult \
  -parallel-testing-enabled NO test
```

2026-10-17 preliminary local baseline: Xcode 27.1 (27A9275), iPhone 18 Pro / iOS 27.0 Simulator, SDK 27.1, existing `MemoCard iOS QA` vault. All three tests passed. Some measurements ran alongside Xcode Preview; pause Preview and keep the host workload and vault unchanged before comparing changes.

| Metric | Mean (5 samples) | Relative standard deviation | Meaning |
| --- | ---: | ---: | --- |
| ApplicationFirstFramePresentationResponsive | 3.049 s | 1.695% | Native first frame responsive; does not assert that WebView note content has finished loading |
| Clock Monotonic Time | 3.738 s | 0.506% | Open and close sidebar, including XCTest tap, idle and element-query overhead; not animation duration |
| Scroll_DraggingAndDeceleration | 2.581 s | 0.258% | Two fast swipes per iteration; duration alone is not FPS or hitch rate |

Raw results: `/tmp/memocard-ios-performance-baseline.xcresult`; build/test log: `/tmp/memocard-ios-performance-baseline.log`. These temporary files are local evidence and are not committed. No performance threshold or improvement is claimed from this first baseline. Scrolling is skipped if the required QA data is absent.

A separate 10-second Release launch Time Profiler capture sampled 2,917 ms of CPU time across app threads (1,971 ms on the main thread). Leaf samples included 674 ms in Swift protocol conformance lookup and substantial simulator dyld loading. Inclusive app stacks included 137 ms under `VaultStore.scan` and 56 ms under `WebView.makeUIView`. Inclusive timings overlap and are not wall-clock launch time. This capture does not include WebContent-process CPU and does not establish a sidebar bottleneck; do not change production layout or caching based on it alone. Local trace: `/tmp/memocard-ios-release-launch-profile.trace`.

The scrolling test additionally requires the last nested tag to extend beyond the visible sidebar. That precondition and the measured scrolling scenario passed again in `/tmp/memocard-ios-sidebar-scroll-regression.xcresult` (1 test, 0 failures, no skip). Xcode emitted simulator build-version parsing warnings (`invalidDigitCount`) and the separate profiler reported an instrument input-source warning; results should be treated as local simulator baselines, not device-level acceptance.

2026-10-18 after the Canvas closure compatibility change, the Release presentation and scrolling scenarios passed again (2 tests, 0 failures, no skips): `/tmp/memocard-ios-sidebar-selection-regression.xcresult`. Means were 3.757 s for open/close including XCTest overhead and 2.577 s for two swipes. These local reruns verify the scenarios; they do not demonstrate a performance improvement.

## Sidebar design-token pilot

`Sources/NativeSidebar.swift` uses the generated `SidebarTokens` and `DesignRadius` for the pilot's shared values. System chrome, materials, safe areas, navigation actions and drawer gestures retain their native implementation. Fonts scale with Dynamic Type without a product-specific cap; row heights remain minimum heights. Decorative Lucide icons and Emoji scale up to 36 points to fit their control frames. At the default text size, the pilot preserves the existing 48-point rows, 16-point icons, 8-point content gap, 24-point indent and 36-point logo.

The Canvas previews render the production components with an isolated `NativeHost(previewSurfaces:)`, without opening a real vault. `SidebarPreviewPalette.generated.swift` supplies browser-sampled default light/dark palette values only in Debug. Preview coverage includes the complete light sidebar, a dark sidebar at AX5 (the largest Dynamic Type size), individual rows (selected, disabled, Emoji, badge, long text and expanded/collapsed affordances), and a data-state picker for populated/loading/empty/error scenarios. Keep explicit `action()` and `send($0)` closures: Canvas source selection depends on them in Xcode 27.1.

The non-performance `testSidebarExpansionAndRowActionsRemainIndependent` scenario checks the 44-point expansion target, taps both newly enlarged edges, verifies that expansion does not navigate, and then verifies that the two narrow padding edges outside the expansion target still perform the primary row action. Run it with the same scheme/destination command above and add:

```sh
-only-testing:MemoCardiOSUITests/SidebarPerformanceTests/testSidebarExpansionAndRowActionsRemainIndependent
```

The target's visual center remains unchanged: its 40-point visual frame is centered inside a 44-point hit target. The original full-width primary button remains beneath the independently tappable expansion button; its selected/pressed feedback and surrounding padding remain responsive. This interaction check is required in addition to screenshots, Preview compilation and the existing presentation/scrolling scenarios.

`testSidebarEdgeGesturesOpenAndCloseNavigation` starts from a closed sidebar, drags from 12 points inside the left edge to open it, and drags the translated main card left to close it. It asserts both presentation and dismissal without using the navigation buttons. The fixed starting inset stays inside the production 24-point gesture region on wide iPad layouts too. Run it with the same command and `-only-testing:MemoCardiOSUITests/SidebarPerformanceTests/testSidebarEdgeGesturesOpenAndCloseNavigation`.

## Sidebar index and surface subscriptions

Run `pnpm test:sidebar-native` on macOS to compile the production `NativeSidebarTagIndex` with complete concurrency checking and warnings as errors. Six scenarios cover input order, missing parents, optional/empty/duplicate paths, Unicode semantics and replacing the current action array. The 1,340-path differential test compares against the former direct-child predicate.

`pnpm test:native-surfaces` builds an isolated Simulator app from the real Apple sources, replaces only the entry point, and sends updates through `NativeHost.handle`. The preview initializer prevents vault access. It checks notification counts, all 42 modeled field changes, equal replays, instance replacement/removal, reload, stable subscription objects, picker notifications, theme/palette and presentation selection. This is a bridge/publisher regression, not a SwiftUI render-time or FPS measurement. Both commands are part of the macOS `verify:release` CI path.

The same probe mounts the production `NativeDesignedPanel` and drives its real `UITextField` coordinator. Three input scenarios cover unchanged Return/end-editing callbacks and pending edits surviving an old echo until acknowledgement, followed by a new external value. They run before the final success marker; readiness and results are condition-checked. A frozen unpatched input setter fails with text `A` even after the `Cleared query` placeholder reaches UIKit; the patched setter passes with the same harness. Baseline timing mode excludes these later UI regressions.

The probe automatically finds an available iPhone Simulator, creating one only when needed. Missing runtimes fail explicitly. It uninstalls its own probe bundle and deletes only a device it created. Default temporary projects are cleaned up on success or failure. To retain source hashes, the app and results, specify a new evidence directory:

```sh
python3 apps/apple/Tests/run-surface-subscriptions.py --device auto --output-dir /tmp/memocard-surface-evidence
```

The runner prints the selected runtime and each phase's outcome and elapsed time. An installation timeout remains a failure at 180 seconds, with no retry; bounded process sampling and targeted Simulator installation logs run only after that deadline to diagnose the failure.

Before booting, the runner prepares the selected runtime's dyld shared cache once with `simctl runtime dyld_shared_cache update <runtime identifier>`. This explicit environment-preparation phase has its own 600-second bound and fails the test if preparation fails; it does not force cache regeneration or prepare unrelated runtimes. [Apple's Xcode 26.1.1 notes](https://developer.apple.com/documentation/Xcode-Release-Notes/xcode-26_1-release-notes) document cache preparation before first Simulator boot. This preparation was added after CI completed boot but installation and diagnostic commands stalled. Those logs do not establish a cache or jetsam defect as the cause.

Installation and uninstallation each have a 180-second operation budget. These are environment-operation deadlines, not application performance thresholds: the [cold CI run](https://github.com/divikwu/memocard/actions/runs/39135053390) used 40.574 seconds to install and 51.872 seconds to uninstall, leaving little scheduling margin under the original 60-second limit. The earlier installation timeouts remain recorded; their underlying mechanism is unconfirmed. All application assertions and the launch limit remain unchanged.

CI pins macOS 26 and Xcode 26.6, available on the [runner image](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md). This tests the newer Simulator environment after a later Xcode 26.3 run installed successfully but exceeded the 60-second launch limit. [Xcode 26.4's release notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-26_4-release-notes) include Simulator lifecycle fixes; the observed timeout does not establish that those defects caused it. The probe flushes stdout and logs execution stages, and the runner prints partial captured output on timeout so subsequent failures can be localized without relaxing the launch limit or UI assertions.

`pnpm bench:sidebar:native` compares the known pre-index `a53fb0a` implementation with the current production index, including index construction and full traversal. `pnpm bench:sidebar:web` measures the real React tree calculations through SSR with presentation primitives mocked. Neither benchmark runs as a timing threshold in CI. Methods, hardware, raw measurements, Release Simulator comparisons and limitations are recorded in [design/performance.md](../../../design/performance.md).

## Search and quick capture previews

Open `Sources/NativeChrome.swift` in the `MemoCardiOS` Canvas. Its four Search / Capture previews reuse the production overlays and panel. The external scenario picker, reopen/reset controls and fail-next-save toggle drive only `NativeSurfacePreviewModel` memory; no vault, WebView, server or picker is opened. Existing light/dark palette fixtures remain the source of preview colors. See `design/components/search-capture.md` for the state loops and coverage boundaries.

The surface probe additionally checks preview action rejection, task cancellation/reset/reopen and fixture semantics, then mounts the actual overlays and drives UIKit search / text editor input through acknowledgement, selection, clear, retry, pagination, failed save and successful reset. The JSON success marker retains the earlier fields and adds preview guard / interaction counts. This verifies native consumption and the isolated producer; it is separate from React producer tests and visible Canvas / Simulator acceptance.
