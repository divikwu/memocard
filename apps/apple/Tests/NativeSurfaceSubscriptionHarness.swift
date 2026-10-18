import Combine
import SwiftUI

// This entry point is built with the production app sources in a temporary project.
// The preview initializer prevents vault access and services; updates still enter
// through NativeHost.handle, the same bridge seam used by WebView.
@main
struct NativeSurfaceSubscriptionHarness: App {
    var body: some Scene {
        WindowGroup {
            Color.clear.task {
                await NativeSurfaceSubscriptionProbe.run()
                exit(0)
            }
        }
    }
}

@MainActor
enum NativeSurfaceSubscriptionProbe {
    static func run() async {
        var results: [[String: Any]] = []
        for scenario in ["navigation-replay", "navigation-large-replay", "search-update", "chrome-update", "stale-remove", "valid-remove"] {
            var initial: [[String: Any]] = [
                ["id": "chrome", "instance": "chrome-1", "kind": "chrome", "title": "Home"],
                ["id": "navigation", "instance": "navigation-1", "kind": "list", "title": "Navigation", "presented": true],
                ["id": "sheet", "instance": "sheet-1", "kind": "list", "title": "Settings", "presented": true],
                ["id": "search", "instance": "search-1", "kind": "search", "title": "Search", "presented": true],
            ]
            let tagCount = scenario == "navigation-large-replay" ? 1000 : 0
            if tagCount > 0 {
                initial[1]["sections"] = [["id": "tags", "actions": (0..<tagCount).map { index in
                    ["id": "tag:\(index)", "title": "Tag \(index)", "path": "Group \(index / 10)/Tag \(index)", "badge": index % 5] as [String: Any]
                }]]
            }
            let surfaces = initial.map { try! JSONDecoder().decode(NativeSurface.self, from: JSONSerialization.data(withJSONObject: $0)) }
            let host = NativeHost(previewSurfaces: Dictionary(uniqueKeysWithValues: surfaces.map { ($0.id, $0) }))
            var counts = ["navigation": 0, "chrome": 0, "sheet": 0, "search": 0, "host": 0]
            var subscriptions: [AnyCancellable] = []
            subscriptions.append(host.objectWillChange.sink { counts["host", default: 0] += 1 })
            for scope in ["navigation", "chrome", "sheet", "search"] {
                #if SURFACE_SUBSCRIPTION_BASELINE
                subscriptions.append(host.objectWillChange.sink { counts[scope, default: 0] += 1 })
                #else
                subscriptions.append(host.nativeSurfaceStore.state(for: scope).objectWillChange.sink { counts[scope, default: 0] += 1 })
                #endif
            }
            #if !SURFACE_SUBSCRIPTION_BASELINE
            counts["presentation"] = 0; counts["appearance"] = 0
            subscriptions.append(host.nativeSurfaceStore.presentation.objectWillChange.sink { counts["presentation", default: 0] += 1 })
            subscriptions.append(host.nativeSurfaceStore.appearance.objectWillChange.sink { counts["appearance", default: 0] += 1 })
            #endif
            let updates = scenario.hasSuffix("remove") ? 1 : tagCount > 0 ? 20 : 100
            let started = ContinuousClock.now
            for index in 0..<updates {
                var params: [String: Any]
                switch scenario {
                case "navigation-replay", "navigation-large-replay": params = initial[1]
                case "search-update":
                    params = initial[3]
                    params["title"] = "Search \(index)"
                case "chrome-update":
                    params = initial[0]
                    params["title"] = "Home \(index)"
                default:
                    params = ["id": "navigation", "instance": scenario == "stale-remove" ? "stale" : "navigation-1", "remove": true]
                }
                await update(host, params)
            }
            let elapsed = started.duration(to: .now)
            withExtendedLifetime(subscriptions) {}
            #if !SURFACE_SUBSCRIPTION_BASELINE
            let expected: [String: Int]
            switch scenario {
            case "search-update": expected = ["search": 100]
            case "chrome-update": expected = ["chrome": 100]
            case "valid-remove": expected = ["navigation": 1, "presentation": 1]
            default: expected = [:]
            }
            for (scope, count) in counts { precondition(count == expected[scope, default: 0], "Unexpected \(scenario) \(scope) notification count: \(count)") }
            #endif
            results.append(["scenario": scenario, "updates": updates, "tagCount": tagCount, "notifications": counts,
                            "elapsedMilliseconds": Double(elapsed.components.seconds) * 1000 + Double(elapsed.components.attoseconds) / 1e15,
                            "navigationPresent": host.nativeSurfaces["navigation"] != nil])
        }
        #if !SURFACE_SUBSCRIPTION_BASELINE
        let fieldChanges = await verifyFieldsAndLifecycle()
        await verifyPresentation()
        #else
        let fieldChanges = 0
        #endif
        let data = try! JSONSerialization.data(withJSONObject: ["measurement": "native-surface-subscriptions", "results": results, "fieldChangesVerified": fieldChanges], options: [.sortedKeys])
        print("SURFACE_SUBSCRIPTION_RESULT " + String(decoding: data, as: UTF8.self))
    }

    private static func update(_ host: NativeHost, _ params: [String: Any]) async {
        let result = await host.handle(["version": 1, "requestId": "probe", "operation": "updateNativeSurface", "params": params])
        precondition(result["ok"] as? Bool == true, "Production bridge rejected probe update")
    }

    #if !SURFACE_SUBSCRIPTION_BASELINE
    private static func verifyFieldsAndLifecycle() async -> Int {
        let host = NativeHost(previewSurfaces: [:])
        let slot = host.nativeSurfaceStore.state(for: "probe")
        var notifications = 0
        let subscription = slot.objectWillChange.sink { notifications += 1 }
        let base: [String: Any] = ["id": "probe", "instance": "probe-1", "kind": "list", "title": "Probe"]
        let action: [String: Any] = ["id": "action", "title": "Action"]
        let field: [String: Any] = ["id": "field", "title": "Field", "value": "Value"]
        var mutations: [(before: [String: Any], after: [String: Any])] = []
        for (key, value) in [
            "instance": "probe-2", "kind": "search", "title": "Changed", "presented": true,
            "busy": true, "loading": true, "message": "Message", "error": "Error", "resetKey": "reset",
            "rowRadius": 12.0, "theme": "dark", "summary": "Summary", "palette": ["sidebar": [1.0, 2.0, 3.0, 255.0]],
            "sections": [["id": "section", "title": "Section"]], "primary": action, "leading": action,
            "pin": action, "menu": [action], "titleMenu": [action], "bottom": [action],
        ] as [String: Any] {
            var changed = base; changed[key] = value; mutations.append((base, changed))
        }
        for (key, value) in [
            "id": "action-2", "title": "Changed", "icon": "house", "path": "tag/child", "emoji": "📘",
            "badge": 2, "subtitle": "Subtitle", "imagePath": "image.png", "color": "red", "disabled": true,
            "destructive": true, "selected": true,
        ] as [String: Any] {
            var changedAction = action; changedAction[key] = value
            var before = base; before["primary"] = action
            var changed = base; changed["primary"] = changedAction; mutations.append((before, changed))
        }
        for (key, value) in ["id": "field-2", "title": "Changed", "value": "Typed", "kind": "multiline", "disabled": true] as [String: Any] {
            var changedField = field; changedField[key] = value
            var before = base; before["sections"] = [["id": "section", "fields": [field]]]
            var changed = base; changed["sections"] = [["id": "section", "fields": [changedField]]]; mutations.append((before, changed))
        }
        for (key, value) in ["id": "section-2", "title": "Changed", "message": "Message", "actions": [action], "fields": [field]] as [String: Any] {
            var section: [String: Any] = ["id": "section"]; section[key] = value
            var before = base; before["sections"] = [["id": "section"]]
            var changed = base; changed["sections"] = [section]; mutations.append((before, changed))
        }
        // Each optional field is compared against the same surface with that field absent,
        // so a missing Equatable field cannot hide behind another changed property.
        for (before, changed) in mutations {
            await update(host, before)
            let previous = notifications
            await update(host, changed)
            precondition(notifications == previous + 1, "Changed bridge field did not publish")
            await update(host, changed)
            precondition(notifications == previous + 1, "Identical bridge field replay published")
        }

        await update(host, base)
        var distinctID = base; distinctID["id"] = "another"
        let previousForID = notifications
        await update(host, distinctID)
        precondition(host.nativeSurfaces["another"] != nil && notifications == previousForID)
        host.nativeSearchPosition["probe-1"] = "saved"
        let previous = notifications
        await update(host, ["id": "probe", "instance": "stale", "remove": true])
        precondition(notifications == previous && host.nativeSearchPosition["probe-1"] == "saved")
        var replacement = base; replacement["instance"] = "probe-2"
        await update(host, replacement)
        precondition(host.nativeSurfaceStore.state(for: "probe") === slot && slot.surface?.instance == "probe-2")
        await update(host, ["id": "probe", "instance": "probe-1", "remove": true])
        precondition(slot.surface?.instance == "probe-2")
        host.nativeSearchPosition["probe-2"] = "latest"
        await update(host, ["id": "probe", "instance": "probe-2", "remove": true])
        precondition(slot.surface == nil && host.nativeSearchPosition["probe-2"] == nil)
        await update(host, base)
        host.webContentWillLoad()
        precondition(host.nativeSurfaces.isEmpty && slot.surface == nil && host.nativeSearchPosition.isEmpty)
        precondition(host.nativeSurfaceStore.state(for: "probe") === slot)
        await update(host, base)
        precondition(slot.surface?.instance == "probe-1")

        var pickerNotifications = 0
        let pickerSubscription = host.objectWillChange.sink { pickerNotifications += 1 }
        host.showPicker = true
        host.finishPicker(.failure(CocoaError(.userCancelled)))
        precondition(pickerNotifications == 2 && !host.showPicker, "Host picker observation was lost")
        withExtendedLifetime([subscription, pickerSubscription]) {}
        return mutations.count
    }

    private static func verifyPresentation() async {
        let host = NativeHost(previewSurfaces: [:])
        let state = host.nativeSurfaceStore.presentation
        let appearance = host.nativeSurfaceStore.appearance
        let chrome: [String: Any] = ["id": "chrome", "instance": "chrome-1", "kind": "chrome", "title": "Home", "leading": ["id": "navigation", "title": "Navigation"]]
        await update(host, chrome)
        precondition(state.value.canOpenNavigation && !state.value.navigationOpen)
        var themed = chrome; themed["theme"] = "dark"; themed["palette"] = ["sidebar": [1.0, 2.0, 3.0, 255.0]]
        await update(host, themed)
        precondition(appearance.value.theme == "dark" && appearance.value.palette?["sidebar"] == [1, 2, 3, 255])
        await update(host, ["id": "navigation", "instance": "nav-1", "kind": "list", "title": "Navigation", "presented": true])
        precondition(state.value.navigationOpen && state.value.canOpenNavigation)
        var search: [String: Any] = ["id": "search", "instance": "search-1", "kind": "search", "title": "Search", "presented": true]
        await update(host, search)
        precondition(!state.value.canOpenNavigation && state.value.search?.instance == "search-1")
        let searchPresentation = state.value
        search["title"] = "Results"; search["loading"] = true
        await update(host, search)
        precondition(state.value == searchPresentation, "Search content invalidated the presentation projection")
        search["instance"] = "search-2"
        await update(host, search)
        precondition(state.value.search?.instance == "search-2")
        search["presented"] = false
        await update(host, search)
        precondition(state.value.search == nil && state.value.canOpenNavigation)

        var capture: [String: Any] = ["id": "capture", "instance": "capture-1", "kind": "capture", "title": "Capture", "presented": true, "busy": true, "summary": "Draft"]
        await update(host, capture)
        precondition(state.value.capture?.instance == "capture-1" && state.value.captureBusy == true && state.value.captureSummary == "Draft")
        capture["busy"] = false; capture["summary"] = "Saved"
        await update(host, capture)
        precondition(state.value.captureBusy == false && state.value.captureSummary == "Saved")
        await update(host, ["id": "z-sheet", "instance": "z-1", "kind": "form", "title": "Z", "presented": true])
        await update(host, ["id": "a-sheet", "instance": "a-1", "kind": "form", "title": "A", "presented": true])
        precondition(state.value.sheet?.id == "a-sheet", "Sheet selection order changed")
        let sheetPresentation = state.value
        await update(host, ["id": "a-sheet", "instance": "a-1", "kind": "form", "title": "Changed", "presented": true])
        precondition(state.value == sheetPresentation, "Sheet content invalidated the presentation projection")
        await update(host, ["id": "a-sheet", "instance": "a-2", "kind": "form", "title": "Changed", "presented": true])
        precondition(state.value.sheet?.instance == "a-2")
        var alert: [String: Any] = ["id": "alert", "instance": "alert-1", "kind": "alert", "title": "Warning", "presented": true]
        await update(host, alert)
        alert["message"] = "Changed warning"
        await update(host, alert)
        precondition(state.value.alert?.message == "Changed warning")
        host.webContentWillLoad()
        precondition(state.value == NativeSurfacePresentation([:]) && appearance.value == NativeSurfaceAppearance(nil))
    }
    #endif
}
