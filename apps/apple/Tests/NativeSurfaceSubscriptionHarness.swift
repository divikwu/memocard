import Combine
import Darwin
import SwiftUI
import UIKit

// This entry point is built with the production app sources in a temporary project.
// The preview initializer prevents vault access and services; updates still enter
// through NativeHost.handle, the same bridge seam used by WebView.
@main
struct NativeSurfaceSubscriptionHarness: App {
    var body: some Scene {
        WindowGroup {
            Color.clear.task {
                setbuf(stdout, nil)
                print("NATIVE_SURFACE_PROBE_STAGE app-task-start")
                let passed = await NativeSurfaceSubscriptionProbe.run()
                print("NATIVE_SURFACE_PROBE_STAGE app-task-complete passed=\(passed)")
                exit(passed ? 0 : 1)
            }
        }
    }
}

@MainActor
enum NativeSurfaceSubscriptionProbe {
    static func run() async -> Bool {
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
        print("NATIVE_SURFACE_PROBE_STAGE publishers-complete")
        #if !SURFACE_SUBSCRIPTION_BASELINE
        let fieldChanges = await verifyFieldsAndLifecycle()
        print("NATIVE_SURFACE_PROBE_STAGE fields-complete count=\(fieldChanges)")
        await verifyPresentation()
        print("NATIVE_SURFACE_PROBE_STAGE presentation-complete")
        guard let inputInteractions = await verifyNativeInputAcknowledgement() else { return false }
        #else
        let fieldChanges = 0
        let inputInteractions = 0
        #endif
        let data = try! JSONSerialization.data(withJSONObject: ["measurement": "native-surface-subscriptions", "results": results, "fieldChangesVerified": fieldChanges, "inputInteractionsVerified": inputInteractions], options: [.sortedKeys])
        print("SURFACE_SUBSCRIPTION_RESULT " + String(decoding: data, as: UTF8.self))
        return true
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

    private static func verifyNativeInputAcknowledgement() async -> Int? {
        print("NATIVE_SURFACE_PROBE_STAGE window-wait-start")
        var root: UIViewController?
        guard await waitForUI("probe window", until: {
            root = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController
            return root?.view.window != nil
        }), let root else { return nil }
        print("NATIVE_SURFACE_PROBE_STAGE window-ready")
        for event in ["return", "end-editing", "pending-edit"] {
            print("NATIVE_SURFACE_PROBE_STAGE ui-case-start event=\(event)")
            let host = NativeHost(previewSurfaces: [:])
            func model(_ value: String, title: String = "Tag query") -> [String: Any] {
                ["id": "search", "instance": "input-\(event)", "kind": "search", "title": "Search", "presented": true,
                 "resetKey": "unchanged-reset", "sections": [["id": "query", "fields": [["id": "tag-query", "title": title, "value": value]]]]]
            }
            await update(host, model("A"))
            // This production search branch and the capture tag popover share the
            // actual NativeSearchInput coordinator and NativeDesignedPanel binding.
            let controller = UIHostingController(rootView: NativeDesignedPanel(host: host, id: "search", instance: "input-\(event)"))
            root.addChild(controller)
            controller.view.frame = root.view.bounds
            controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            root.view.addSubview(controller.view)
            controller.didMove(toParent: root)
            print("NATIVE_SURFACE_PROBE_STAGE ui-case-hosted event=\(event)")
            defer {
                print("NATIVE_SURFACE_PROBE_STAGE ui-case-cleanup-start event=\(event)")
                controller.view.endEditing(true)
                controller.willMove(toParent: nil)
                controller.view.removeFromSuperview()
                controller.removeFromParent()
                print("NATIVE_SURFACE_PROBE_STAGE ui-case-cleanup-complete event=\(event)")
            }
            var field: UITextField?
            guard await waitForUI("\(event) initial field", until: {
                controller.view.layoutIfNeeded()
                field = textField(in: controller.view)
                return field?.window != nil && field?.text == "A" && field?.isFirstResponder == true
            }), let field, let delegate = field.delegate else { return nil }
            print("NATIVE_SURFACE_PROBE_STAGE ui-case-ready event=\(event)")

            print("NATIVE_SURFACE_PROBE_STAGE ui-case-action-start event=\(event)")
            if event == "pending-edit" {
                field.text = "B"
                field.sendActions(for: .editingChanged)
            } else if event == "return" {
                guard delegate.textFieldShouldReturn?(field) != nil else { return nil }
            } else {
                delegate.textFieldDidEndEditing?(field)
            }
            print("NATIVE_SURFACE_PROBE_STAGE ui-case-action-complete event=\(event)")
            await update(host, ["id": "navigation", "instance": "nav-\(event)", "kind": "list", "title": "Unrelated update", "presented": false])
            print("NATIVE_SURFACE_PROBE_STAGE navigation-update-complete event=\(event)")
            if event == "pending-edit" {
                // A changed placeholder proves the SwiftUI update reached the real
                // UIKit field; checking B immediately after assigning it would not.
                await update(host, model("A", title: "Unacknowledged A"))
                print("NATIVE_SURFACE_PROBE_STAGE old-echo-update-complete event=\(event)")
                guard await waitForUI("pending value survives unrelated update and old echo", until: {
                    controller.view.layoutIfNeeded()
                    return field.placeholder == "Unacknowledged A" && field.text == "B"
                }) else { return nil }
                print("NATIVE_SURFACE_PROBE_STAGE pending-value-preserved event=\(event)")
                await update(host, model("B", title: "Acknowledged B"))
                print("NATIVE_SURFACE_PROBE_STAGE acknowledgement-update-complete event=\(event)")
                guard await waitForUI("native input acknowledgement", until: {
                    controller.view.layoutIfNeeded()
                    return field.placeholder == "Acknowledged B" && field.text == "B"
                }) else { return nil }
                print("NATIVE_SURFACE_PROBE_STAGE acknowledgement-visible event=\(event)")
                await update(host, model("C", title: "External C"))
                print("NATIVE_SURFACE_PROBE_STAGE external-update-complete event=\(event)")
                guard await waitForUI("acknowledgement releases the native override", until: {
                    controller.view.layoutIfNeeded()
                    return field.placeholder == "External C" && field.text == "C"
                }) else { return nil }
            } else {
                await update(host, model("", title: "Cleared query"))
                print("NATIVE_SURFACE_PROBE_STAGE clear-query-update-complete event=\(event)")
                guard await waitForUI("\(event) unchanged input accepts same-instance reset", until: {
                    controller.view.layoutIfNeeded()
                    return field.placeholder == "Cleared query" && field.text == ""
                }) else {
                    print("NATIVE_INPUT_INTERACTION_ACTUAL event=\(event) text=\(field.text ?? "nil") placeholder=\(field.placeholder ?? "nil")")
                    return nil
                }
            }
            print("NATIVE_INPUT_INTERACTION_PASSED \(event)")
        }
        return 3
    }

    private static func textField(in view: UIView) -> UITextField? {
        if let field = view as? UITextField, field.accessibilityLabel == "搜索笔记" { return field }
        return view.subviews.lazy.compactMap { textField(in: $0) }.first
    }

    private static func waitForUI(_ description: String, until condition: () -> Bool) async -> Bool {
        let deadline = ContinuousClock.now + .seconds(5)
        while ContinuousClock.now < deadline {
            if condition() { return true }
            try? await Task.sleep(for: .milliseconds(10))
        }
        print("NATIVE_INPUT_INTERACTION_FAILED \(description)")
        return false
    }
    #endif
}
