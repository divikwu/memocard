#if os(iOS)
import Combine
import CoreGraphics

// Platform adaptations of the shared capture / floating-navigation roles.
// Light opacity follows the softer 75% treatment; native geometry stays in points.
enum NativeElevation {
    struct Shadow: Equatable {
        let opacity: Double
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }

    static func capture(dark: Bool) -> Shadow {
        Shadow(opacity: dark ? 0.12 : 0.09, radius: 24, x: 0, y: 8)
    }

    static func drawer(dark: Bool) -> Shadow {
        Shadow(opacity: dark ? 0.15 : 0.1125, radius: 20, x: -8, y: 0)
    }
}

@MainActor
final class NativeSurfaceState: ObservableObject {
    @Published fileprivate(set) var surface: NativeSurface?
    init(_ surface: NativeSurface?) { self.surface = surface }
}

struct NativeSurfaceAppearance: Equatable {
    let theme: String?
    let palette: [String: [Double]]?

    init(_ chrome: NativeSurface?) {
        theme = chrome?.theme
        palette = chrome?.palette
    }
}

@MainActor
final class NativeSurfaceAppearanceState: ObservableObject {
    @Published fileprivate(set) var value: NativeSurfaceAppearance
    init(_ value: NativeSurfaceAppearance) { self.value = value }
}

// Only presentation identity and the fields read outside an individual surface's
// view belong here. Search results and sheet fields publish through their slot.
struct NativeSurfacePresentation: Equatable {
    struct Identity: Equatable {
        let id: String
        let instance: String
        init(_ surface: NativeSurface) { id = surface.id; instance = surface.instance }
    }

    let navigationOpen: Bool
    let canOpenNavigation: Bool
    let sheet: Identity?
    let search: Identity?
    let capture: Identity?
    let alert: NativeSurface?
    let captureBusy: Bool?
    let captureSummary: String?

    init(_ surfaces: [String: NativeSurface]) {
        navigationOpen = surfaces["navigation"]?.presented == true
        canOpenNavigation = surfaces["chrome"]?.leading?.id == "navigation"
            && !surfaces.values.contains { $0.presented == true && $0.id != "navigation" }
        sheet = surfaces.values.filter {
            $0.presented == true && $0.id != "navigation" && $0.kind != "alert"
                && $0.kind != "chrome" && $0.kind != "search" && $0.kind != "capture"
        }.sorted { $0.id < $1.id }.first.map(Identity.init)
        search = surfaces["search"].flatMap { $0.presented == true ? Identity($0) : nil }
        capture = surfaces["capture"].flatMap { $0.presented == true ? Identity($0) : nil }
        alert = surfaces.values.first { $0.presented == true && $0.kind == "alert" }
        captureBusy = capture == nil ? nil : surfaces["capture"]?.busy
        captureSummary = surfaces["capture"]?.summary
    }
}

@MainActor
final class NativeSurfacePresentationState: ObservableObject {
    @Published fileprivate(set) var value: NativeSurfacePresentation
    init(_ value: NativeSurfacePresentation) { self.value = value }
}

@MainActor
final class NativeSurfaceStore {
    private(set) var values: [String: NativeSurface]
    private var states: [String: NativeSurfaceState] = [:]
    let appearance: NativeSurfaceAppearanceState
    let presentation: NativeSurfacePresentationState

    init(_ surfaces: [String: NativeSurface] = [:]) {
        values = surfaces
        appearance = NativeSurfaceAppearanceState(NativeSurfaceAppearance(surfaces["chrome"]))
        presentation = NativeSurfacePresentationState(NativeSurfacePresentation(surfaces))
    }

    func state(for id: String) -> NativeSurfaceState {
        if let state = states[id] { return state }
        let state = NativeSurfaceState(values[id])
        states[id] = state
        return state
    }

    func update(_ surface: NativeSurface) {
        guard values[surface.id] != surface else { return }
        values[surface.id] = surface
        states[surface.id]?.surface = surface
        refreshPresentation()
    }

    @discardableResult
    func remove(id: String, instance: String) -> NativeSurface? {
        guard let surface = values[id], surface.instance == instance else { return nil }
        values.removeValue(forKey: id)
        states[id]?.surface = nil
        refreshPresentation()
        return surface
    }

    func removeAll() {
        guard !values.isEmpty else { return }
        let ids = values.keys
        values = [:]
        for id in ids { states[id]?.surface = nil }
        refreshPresentation()
    }

    private func refreshPresentation() {
        let nextAppearance = NativeSurfaceAppearance(values["chrome"])
        if appearance.value != nextAppearance { appearance.value = nextAppearance }
        let nextPresentation = NativeSurfacePresentation(values)
        if presentation.value != nextPresentation { presentation.value = nextPresentation }
    }
}
#endif
