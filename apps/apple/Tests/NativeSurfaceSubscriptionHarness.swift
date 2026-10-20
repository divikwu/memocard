import Combine
import Darwin
import SwiftUI
import UIKit
import WebKit

// This entry point is built with the production app sources in a temporary project.
// The preview initializer prevents vault access and services; updates still enter
// through NativeHost.handle, the same bridge seam used by WebView.
@main
struct NativeSurfaceSubscriptionHarness: App {
    init() {
        setbuf(stdout, nil)
        print("NATIVE_SURFACE_PROBE_STAGE app-init")
    }

    var body: some Scene {
        WindowGroup {
            Color.clear.task {
                let started = ProcessInfo.processInfo.systemUptime
                print("NATIVE_SURFACE_PROBE_STAGE app-task-start")
                let passed = await NativeSurfaceSubscriptionProbe.run()
                print("NATIVE_SURFACE_PROBE_TIMING assertionSeconds=\(ProcessInfo.processInfo.systemUptime - started)")
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
        let previewGuards = await verifyPreviewGuardsAndCancellation()
        guard let previewResults = await verifyInteractivePreviews() else { return false }
        let (previewInteractions, previewKeystrokes) = previewResults
        guard let chromePreviewChecks = await verifyChromePreviews() else { return false }
        #else
        let fieldChanges = 0
        let inputInteractions = 0
        let previewGuards = 0
        let previewInteractions = 0
        let previewKeystrokes = 0
        let chromePreviewChecks = 0
        #endif
        let data = try! JSONSerialization.data(withJSONObject: ["measurement": "native-surface-subscriptions", "results": results, "fieldChangesVerified": fieldChanges, "inputInteractionsVerified": inputInteractions, "previewGuardChecksVerified": previewGuards, "previewInteractionsVerified": previewInteractions, "previewKeystrokesVerified": previewKeystrokes, "chromePreviewChecksVerified": chromePreviewChecks], options: [.sortedKeys])
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

    private static func verifyPreviewGuardsAndCancellation() async -> Int {
        print("NATIVE_SURFACE_PROBE_STAGE preview-guards-start")
        var surface = NativeSurface(id: "guard", instance: "guard-1", kind: "search", title: "Guards", presented: true,
            sections: [NativeSection(id: "controls", actions: [NativeAction(id: "enabled", title: "Enabled"), NativeAction(id: "disabled", title: "Disabled", disabled: true)],
                fields: [NativeField(id: "field", title: "Field", value: ""), NativeField(id: "disabled-field", title: "Disabled", value: "", disabled: true)])])
        let host = NativeHost(previewSurfaces: [surface.id: surface])
        var actions: [String] = []
        host.previewAction = { _, action, _ in actions.append(action) }
        host.nativeAction(surface, "unknown")
        host.nativeAction(surface, "unknown-field", value: "A")
        host.nativeAction(surface, "disabled")
        host.nativeAction(surface, "disabled-field", value: "A")
        host.nativeAction(NativeSurface(id: "guard", instance: "stale", kind: "search", title: "Stale"), "close")
        host.nativeAction(NativeSurface(id: "missing", instance: "missing", kind: "search", title: "Missing"), "close")
        surface.presented = false; host.nativeSurfaceStore.update(surface)
        host.nativeAction(surface, "enabled")
        host.nativeAction(surface, "field", value: "A")
        precondition(actions.isEmpty, "Preview callback bypassed a production nativeAction guard")
        host.nativeAction(surface, "close")
        surface.presented = true; host.nativeSurfaceStore.update(surface)
        host.nativeAction(surface, "field", value: "中文")
        host.nativeAction(surface, "enabled")
        precondition(actions == ["close", "field", "enabled"], "Valid preview actions did not reach the guarded feedback path")

        let capture = NativeSurfacePreviewModel(kind: .capture, scenario: .populated)
        capture.host.nativeAction(capture.surface, "record")
        let beforeReset = capture.pendingWork
        capture.select(.defaultState)
        await beforeReset?.value
        precondition(capture.surface.presented == true && capture.surface.busy == false && capture.surface.primary?.disabled == true,
                     "A pending save overwrote the reset preview")
        capture.select(.populated)
        capture.host.nativeAction(capture.surface, "record")
        let beforeDispose = capture.pendingWork, frozen = capture.surface, feedback = capture.feedback
        capture.dispose()
        await beforeDispose?.value
        precondition(capture.surface == frozen && capture.feedback == feedback, "Disposed preview received a stale save completion")
        capture.select(.populated)
        capture.host.nativeAction(capture.surface, "record")
        let beforeReopen = capture.pendingWork
        capture.reopen()
        let reopened = capture.surface
        await beforeReopen?.value
        precondition(capture.surface == reopened && capture.surface.presented == true && capture.surface.busy == false,
                     "Pending save closed the reopened preview")
        capture.host.nativeAction(capture.surface, "tag-query", value: "新标签")
        capture.host.nativeAction(capture.surface, "new-tag")
        capture.host.nativeAction(capture.surface, "tag-query", value: "新标签")
        let beforeDuplicate = capture.acceptedActions
        capture.host.nativeAction(capture.surface, "new-tag")
        precondition(capture.acceptedActions == beforeDuplicate && capture.surface.sections?.first(where: { $0.id == "selected-tags" })?.actions?.filter { $0.title == "新标签" }.count == 1,
                     "The preview offered duplicate new-tag actions")

        let search = NativeSurfacePreviewModel(kind: .search)
        search.host.nativeAction(search.surface, "query", value: "产品")
        let beforeSearchReset = search.pendingWork
        search.select(.recent)
        await beforeSearchReset?.value
        precondition(search.surface.loading == false && search.surface.sections?.first?.fields?.first?.value == "",
                     "Cancelled search overwrote the current scenario")
        search.select(.errorRetry)
        let beforeErrorNavigation = search.acceptedActions, searchError = search.surface.error
        search.host.nativeAction(search.surface, "down")
        precondition(search.acceptedActions == beforeErrorNavigation && search.surface.error == searchError,
                     "ErrorRetry exposed keyboard result navigation without displayed results")
        precondition(host.isPreview && capture.host.previewAssets["unknown.png"] == nil)
        precondition(capture.host.previewAssets["preview-note.png"].flatMap { UIImage(data: $0) }?.size == CGSize(width: 128, height: 96))
        print("NATIVE_SURFACE_PROBE_STAGE preview-guards-complete count=15")
        return 15
    }

    private static func verifyInteractivePreviews() async -> (Int, Int)? {
        var keystrokes = 0
        guard let root = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController else { return nil }
        for kind in [NativeSurfacePreviewModel.Kind.search, .capture] {
            print("NATIVE_SURFACE_PROBE_STAGE preview-ui-start kind=\(kind.rawValue)")
            let model = NativeSurfacePreviewModel(kind: kind, scenario: kind == .search ? .results : .defaultState)
            let controller = UIHostingController(rootView: NativeSurfacePreviewCanvas(model: model, showControls: false))
            root.addChild(controller); controller.view.frame = root.view.bounds
            controller.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            root.view.addSubview(controller.view); controller.didMove(toParent: root)
            defer {
                print("NATIVE_SURFACE_PROBE_STAGE preview-ui-cleanup-start kind=\(kind.rawValue)")
                controller.view.endEditing(true); controller.willMove(toParent: nil)
                controller.view.removeFromSuperview(); controller.removeFromParent(); model.dispose()
                print("NATIVE_SURFACE_PROBE_STAGE preview-ui-cleanup-complete kind=\(kind.rawValue)")
            }
            if kind == .search {
                var field: UITextField?
                guard await waitForUI("preview search field ready", until: {
                    controller.view.layoutIfNeeded(); field = textField(in: controller.view)
                    return field?.text == "产品" && field?.isFirstResponder == true
                }), let field, let delegate = field.delegate else { return nil }
                field.text = "侧栏"; field.sendActions(for: .editingChanged)
                await model.pendingWork?.value
                guard await waitForUI("preview search setter acknowledgement", until: {
                    field.text == "侧栏" && model.surface.sections?.first?.fields?.first?.value == "侧栏" && model.surface.loading == false
                }) else { return nil }
                guard delegate.textFieldShouldClear?(field) == true else { return nil }
                await model.pendingWork?.value
                guard await waitForUI("preview search clear acknowledgement", until: {
                    field.text == "" && model.surface.sections?.first?.fields?.first?.value == ""
                }) else { return nil }
                guard let down = field.keyCommands?.last(where: { $0.input == UIKeyCommand.inputDownArrow }), let action = down.action else { return nil }
                _ = UIApplication.shared.sendAction(action, to: field, from: down, for: nil)
                guard await waitForUI("preview second result selected", until: {
                    model.surface.sections?.flatMap { $0.actions ?? [] }.first(where: { $0.selected == true })?.id == "note:plan"
                }) else { return nil }
                guard delegate.textFieldShouldReturn?(field) != nil else { return nil }
                guard await waitForUI("preview selected note closes actual overlay", until: {
                    model.surface.presented == false && textField(in: controller.view) == nil && model.feedback.contains("产品计划与标签整理")
                }) else {
                    print("NATIVE_PREVIEW_CLOSE_ACTUAL presented=\(model.surface.presented ?? false) field=\(textField(in: controller.view)?.text ?? "nil") feedback=\(model.feedback)")
                    return nil
                }
                model.reopen()
                guard await waitForUI("preview search reopens", until: { textField(in: controller.view)?.text == "" }) else { return nil }
                model.select(.errorRetry)
                model.host.nativeAction(model.surface, "retry")
                await model.pendingWork?.value
                guard await waitForUI("preview search retry reaches actual field", until: {
                    model.surface.error == nil && textField(in: controller.view)?.text == "产品"
                }) else { return nil }
                model.select(.pagination)
                precondition(model.surface.sections?.first(where: { $0.id == "results" })?.actions?.count == 1)
                model.host.nativeAction(model.surface, "more")
                await model.pendingWork?.value
                precondition(model.surface.sections?.first(where: { $0.id == "results" })?.actions?.count == 2)
                model.select(.empty)
                guard await waitForUI("preview empty query reaches actual field", until: {
                    textField(in: controller.view)?.text == "未匹配的词" && model.surface.message == "没有找到相关笔记"
                }) else { return nil }
            } else {
                var editor: UITextView?
                guard await waitForUI("preview capture editor ready", until: {
                    controller.view.layoutIfNeeded(); editor = textView(in: controller.view)
                    return editor?.isFirstResponder == true && editor?.text.isEmpty == true
                }), let editor, let delegate = editor.delegate else { return nil }
                print("NATIVE_SURFACE_PROBE_STAGE capture-editor-ready")
                var expected = ""
                for character in "preview" {
                    expected.append(character)
                    editor.insertText(String(character))
                    var stableChecks = 0
                    guard await waitForUI("capture insertText \(expected)", until: {
                        controller.view.setNeedsLayout(); controller.view.layoutIfNeeded()
                        let matches = editor.text == expected && model.surface.sections?.first?.fields?.first?.value == expected
                            && editor.selectedRange == NSRange(location: expected.utf16.count, length: 0)
                        // Recheck after another main-loop poll; the synchronous setter's
                        // immediate value alone does not prove the SwiftUI ACK settled.
                        stableChecks = matches ? stableChecks + 1 : 0
                        return stableChecks >= 2
                    }) else {
                        print("NATIVE_PREVIEW_KEY_INPUT_FAILED expected=\(expected) actual=\(editor.text ?? "nil") ack=\(model.surface.sections?.first?.fields?.first?.value ?? "nil") selection=\(editor.selectedRange)")
                        return nil
                    }
                    keystrokes += 1
                    print("NATIVE_PREVIEW_KEY_INPUT_PASSED text=\(expected) selection=\(editor.selectedRange.location)")
                }
                print("NATIVE_SURFACE_PROBE_STAGE capture-setter-start")
                editor.text = "中文记录"; delegate.textViewDidChange?(editor)
                print("NATIVE_SURFACE_PROBE_STAGE capture-setter-sent")
                guard await waitForUI("preview capture setter acknowledgement", until: {
                    model.surface.sections?.first?.fields?.first?.value == "中文记录" && model.surface.primary?.disabled == false
                }) else { return nil }
                print("NATIVE_SURFACE_PROBE_STAGE capture-setter-acknowledged")
                model.host.nativeAction(model.surface, "tag-query", value: "预览标签")
                print("NATIVE_SURFACE_PROBE_STAGE capture-tag-query-sent")
                model.host.nativeAction(model.surface, "new-tag")
                print("NATIVE_SURFACE_PROBE_STAGE capture-new-tag-sent")
                model.host.nativeAction(model.surface, "image")
                print("NATIVE_SURFACE_PROBE_STAGE capture-image-sent")
                precondition(model.surface.sections?.first(where: { $0.id == "selected-tags" })?.actions?.first?.title == "预览标签")
                precondition(model.surface.sections?.first(where: { $0.id == "images" })?.actions?.count == 2)
                model.failNextSave = true
                model.host.nativeAction(model.surface, "record")
                print("NATIVE_SURFACE_PROBE_STAGE capture-failed-save-start")
                model.host.nativeAction(model.surface, "close")
                precondition(model.surface.presented == true && model.surface.busy == true)
                await model.pendingWork?.value
                print("NATIVE_SURFACE_PROBE_STAGE capture-failed-save-complete")
                guard await waitForUI("preview failed save preserves capture and enables actual editor", until: {
                    model.surface.error != nil && editor.text == "中文记录" && editor.isEditable
                }) else { return nil }
                print("NATIVE_SURFACE_PROBE_STAGE capture-failed-save-preserved")
                let oldReset = model.surface.resetKey
                model.host.nativeAction(model.surface, "record")
                print("NATIVE_SURFACE_PROBE_STAGE capture-retry-save-start")
                await model.pendingWork?.value
                print("NATIVE_SURFACE_PROBE_STAGE capture-retry-save-complete")
                guard await waitForUI("preview successful save closes actual overlay", until: {
                    model.surface.presented == false && textView(in: controller.view) == nil && model.feedback == "记录成功（仅预览）"
                }) else { return nil }
                print("NATIVE_SURFACE_PROBE_STAGE capture-retry-save-closed")
                precondition(model.surface.resetKey != oldReset)
                model.reopen()
                print("NATIVE_SURFACE_PROBE_STAGE capture-reopen-sent")
                guard await waitForUI("preview success resets actual editor", until: {
                    textView(in: controller.view)?.text.isEmpty == true && model.surface.primary?.disabled == true
                }) else { return nil }
                print("NATIVE_SURFACE_PROBE_STAGE capture-reopen-empty")
            }
            print("NATIVE_SURFACE_PROBE_STAGE preview-ui-complete kind=\(kind.rawValue)")
        }
        return (2, keystrokes)
    }

    private static func verifyChromePreviews() async -> Int? {
        var checks = 0
        let model = NativeMainChromePreviewModel()
        precondition(model.surface.titleMenu?.first(where: { $0.selected == true })?.id == "list")
        model.host.nativeAction(model.surface, "cards")
        precondition(model.layout == "cards" && model.surface.titleMenu?.first(where: { $0.selected == true })?.id == "cards")
        checks += 1
        model.openNote()
        precondition(model.isDetail && model.surface.leading?.id == "back" && model.surface.titleMenu == nil && model.layout == "cards")
        checks += 1
        model.host.nativeAction(model.surface, "pin")
        precondition(model.isPinned && model.surface.pin?.title == "取消固定")
        model.host.nativeAction(model.surface, "pin")
        precondition(!model.isPinned && model.surface.pin?.title == "固定到主页")
        checks += 1
        let detailActions = model.acceptedActions
        for action in ["vault", "drafts", "unknown"] { model.host.nativeAction(model.surface, action) }
        precondition(model.acceptedActions == detailActions, "Detail preview bypassed disabled/unknown native chrome actions")
        checks += 1
        model.host.nativeAction(model.surface, "back")
        precondition(!model.isDetail && model.surface.leading?.id == "navigation" && model.layout == "cards")
        checks += 1
        let beforeMenu = model.acceptedActions
        for action in ["refresh", "settings", "search", "capture", "new"] { model.host.nativeAction(model.surface, action) }
        precondition(model.acceptedActions == beforeMenu + 5 && !model.isDetail && model.surface.pin == nil && model.surface.menu?.contains(where: { $0.id == "delete" }) == false,
                     "A callback-only preview menu action fabricated an unsaved editor state")
        checks += 1
        let stale = model.surface
        model.select(.busy)
        let beforeBlocked = model.acceptedActions
        model.host.nativeAction(stale, "pin")
        for action in ["pin", "new", "refresh", "vault", "drafts", "delete"] { model.host.nativeAction(model.surface, action) }
        precondition(model.acceptedActions == beforeBlocked && model.surface.busy == true, "Busy/stale preview actions reached the callback")
        checks += 1
        model.host.nativeAction(model.surface, "back")
        precondition(!model.isDetail && model.surface.busy == false, "Busy preview changed the production back action contract")
        checks += 1

        guard let root = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController else { return nil }
        // The default preview-host path must also remain isolated without injected content.
        for scenario in [NativeMainChromePreviewModel.Scenario.collection, .detail, .busy, nil] {
            let fixture = NativeMainChromePreviewModel(scenario: scenario ?? .collection)
            let view = scenario == nil ? AnyView(NativeChrome(host: fixture.host)) : AnyView(NativeMainChromePreviewCanvas(model: fixture, showControls: false))
            let controller = UIHostingController(rootView: view)
            root.addChild(controller); controller.view.frame = root.view.bounds
            root.view.addSubview(controller.view); controller.didMove(toParent: root)
            defer {
                controller.willMove(toParent: nil); controller.view.removeFromSuperview(); controller.removeFromParent()
            }
            guard await waitForUI("native chrome preview navigation", until: {
                controller.view.layoutIfNeeded()
                return containsView(UINavigationBar.self, in: controller.view)
            }) else { return nil }
            precondition(fixture.host.isPreview && fixture.host.webView == nil && !containsView(WKWebView.self, in: controller.view),
                         "Native chrome preview constructed the production WebView")
            checks += 1
        }
        print("NATIVE_SURFACE_PROBE_STAGE chrome-previews-complete count=\(checks)")
        return checks
    }

    private static func containsView<T: UIView>(_ type: T.Type, in view: UIView) -> Bool {
        view is T || view.subviews.contains { containsView(type, in: $0) }
    }

    private static func textView(in view: UIView) -> UITextView? {
        if let editor = view as? UITextView { return editor }
        return view.subviews.lazy.compactMap { textView(in: $0) }.first
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
