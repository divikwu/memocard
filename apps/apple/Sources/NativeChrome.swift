#if os(iOS)
import SwiftUI
import UIKit

struct NativeAction: Decodable, Identifiable, Equatable {
    let id: String
    var title: String
    var icon: String?
    var path: String?
    var emoji: String?
    var badge: Int?
    var subtitle: String?
    var imagePath: String?
    var color: String?
    var disabled: Bool?
    var destructive: Bool?
    var selected: Bool?
}

struct NativeField: Decodable, Identifiable, Equatable {
    let id: String
    let title: String
    let value: String
    var kind: String?
    var disabled: Bool?
}

struct NativeSection: Decodable, Identifiable, Equatable {
    let id: String
    var title: String?
    var message: String?
    var actions: [NativeAction]?
    var fields: [NativeField]?
}

struct NativeSurface: Decodable, Identifiable, Equatable {
    let id: String
    let instance: String
    let kind: String
    let title: String
    var presented: Bool?
    var busy: Bool?
    var loading: Bool?
    var message: String?
    var error: String?
    var resetKey: String?
    var rowRadius: Double?
    var theme: String?
    var summary: String?
    var palette: [String: [Double]]?
    var sections: [NativeSection]?
    var primary: NativeAction?
    var leading: NativeAction?
    var pin: NativeAction?
    var menu: [NativeAction]?
    var titleMenu: [NativeAction]?
    var bottom: [NativeAction]?
}

struct NativeChrome: View {
    let host: NativeHost
    @ObservedObject private var appearance: NativeSurfaceAppearanceState

    init(host: NativeHost) {
        self.host = host
        appearance = host.nativeSurfaceStore.appearance
    }

    var body: some View {
        NativeSidebarContainer(host: host)
            .ignoresSafeArea()
            .preferredColorScheme(appearance.value.theme == "dark" ? .dark : appearance.value.theme == "light" ? .light : nil)
    }
}

private struct NativeSidebarContainer: UIViewControllerRepresentable {
    @Environment(\.colorScheme) private var colorScheme
    let host: NativeHost
    @ObservedObject private var presentation: NativeSurfacePresentationState
    @ObservedObject private var appearance: NativeSurfaceAppearanceState

    init(host: NativeHost) {
        self.host = host
        presentation = host.nativeSurfaceStore.presentation
        appearance = host.nativeSurfaceStore.appearance
    }

    func makeUIViewController(context: Context) -> SidebarController { SidebarController(host: host) }
    func updateUIViewController(_ controller: SidebarController, context: Context) {
        controller.update(open: presentation.value.navigationOpen,
                          canOpen: presentation.value.canOpenNavigation,
                          background: appearance.value.palette?["sidebar"],
                          shadow: NativeElevation.drawer(dark: colorScheme == .dark))
    }

    final class SidebarController: UIViewController, UIGestureRecognizerDelegate {
        private let host: NativeHost
        private let sidebar: UIHostingController<NativeNavigationSidebar>
        private let main: UIHostingController<NativeMainChrome>
        private let card = UIView()
        private let cardContent = UIView()
        private let dismissArea = UIButton(type: .custom)
        private lazy var edgePan = UIPanGestureRecognizer(target: self, action: #selector(pan(_:)))
        private lazy var closePan = UIPanGestureRecognizer(target: self, action: #selector(pan(_:)))
        private var animator: UIViewPropertyAnimator?
        private var progress: CGFloat = 0
        private var dragStart: CGFloat = 0
        private var dragging = false
        private var modelOpen = false
        private var canOpen = false
        private var drawerShadow = NativeElevation.drawer(dark: false)
        private var drawerWidth: CGFloat {
            // Use the stable container margins; a translated child can lose its offscreen trailing margin.
            // Align the two native 44-point toolbar button centers.
            let margins = systemMinimumLayoutMargins
            return max(0, view.bounds.width - view.safeAreaInsets.left - view.safeAreaInsets.right - margins.leading - margins.trailing - 44)
        }

        init(host: NativeHost) {
            self.host = host
            sidebar = UIHostingController(rootView: NativeNavigationSidebar(host: host))
            main = UIHostingController(rootView: NativeMainChrome(host: host))
            super.init(nibName: nil, bundle: nil)
        }
        required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

        override func viewDidLoad() {
            super.viewDidLoad()
            view.backgroundColor = .secondarySystemBackground
            view.clipsToBounds = true
            addChild(sidebar)
            view.addSubview(sidebar.view)
            sidebar.didMove(toParent: self)
            view.addSubview(card)
            card.layer.shadowColor = UIColor.black.cgColor
            card.addSubview(cardContent)
            cardContent.clipsToBounds = true
            cardContent.layer.cornerCurve = .continuous
            addChild(main)
            cardContent.addSubview(main.view)
            main.didMove(toParent: self)
            dismissArea.accessibilityLabel = "收起导航"
            dismissArea.addTarget(self, action: #selector(close), for: .touchUpInside)
            cardContent.addSubview(dismissArea)
            edgePan.delegate = self
            closePan.delegate = self
            closePan.require(toFail: edgePan)
            view.addGestureRecognizer(edgePan)
            view.addGestureRecognizer(closePan)
            applyProgress(0)
        }

        override func viewDidLayoutSubviews() {
            super.viewDidLayoutSubviews()
            let trailingInset = systemMinimumLayoutMargins.trailing
            if sidebar.rootView.trailingInset != trailingInset { sidebar.rootView.trailingInset = trailingInset }
            sidebar.view.frame = CGRect(x: 0, y: 0, width: drawerWidth, height: view.bounds.height)
            // Keep the main viewport full width. Only its enclosing card moves.
            card.bounds = view.bounds
            card.center = CGPoint(x: view.bounds.midX, y: view.bounds.midY)
            cardContent.frame = card.bounds
            main.view.frame = card.bounds
            dismissArea.frame = card.bounds
            card.layer.shadowPath = UIBezierPath(roundedRect: card.bounds, cornerRadius: 32).cgPath
            applyProgress(progress)
        }

        func update(open: Bool, canOpen: Bool, background: [Double]?, shadow: NativeElevation.Shadow) {
            loadViewIfNeeded()
            drawerShadow = shadow
            card.layer.shadowOffset = CGSize(width: shadow.x, height: shadow.y)
            card.layer.shadowRadius = shadow.radius
            card.layer.shadowOpacity = Float(shadow.opacity * progress)
            if let rgba = background, rgba.count == 4 {
                view.backgroundColor = UIColor(red: rgba[0] / 255, green: rgba[1] / 255, blue: rgba[2] / 255, alpha: rgba[3] / 255)
            }
            self.canOpen = canOpen
            if modelOpen != open {
                modelOpen = open
                if !dragging { settle(open: open) }
            }
            updateInteraction()
        }

        private func updateInteraction() {
            // Do not disable a recognizer while it is tracking a finger.
            if !dragging {
                edgePan.isEnabled = canOpen && !modelOpen
                closePan.isEnabled = progress > 0
            }
            dismissArea.isHidden = progress == 0
            sidebar.view.accessibilityElementsHidden = progress == 0
            main.view.accessibilityElementsHidden = progress > 0
        }

        private func applyProgress(_ value: CGFloat) {
            progress = min(1, max(0, value))
            card.transform = CGAffineTransform(translationX: drawerWidth * progress, y: 0)
            cardContent.layer.cornerRadius = 32 * progress
            card.layer.shadowOpacity = Float(drawerShadow.opacity * progress)
            dismissArea.backgroundColor = UIColor.black.withAlphaComponent(0.04 * progress)
            updateInteraction()
        }

        private func stopAnimation() {
            guard let animator else { return }
            let visible = (card.layer.presentation()?.affineTransform().tx ?? card.transform.tx) / max(1, drawerWidth)
            animator.stopAnimation(true)
            self.animator = nil
            applyProgress(visible)
        }

        private func settle(open: Bool) {
            stopAnimation()
            let target: CGFloat = open ? 1 : 0
            guard !UIAccessibility.isReduceMotionEnabled else { applyProgress(target); return }
            let animation = UIViewPropertyAnimator(duration: 0.3, dampingRatio: 1) { self.applyProgress(target) }
            animator = animation
            animation.addCompletion { [weak self] _ in
                self?.animator = nil
                self?.updateInteraction()
            }
            animation.startAnimation()
        }

        private func requestOpen() {
            if let chrome = host.nativeSurfaces["chrome"], chrome.leading?.id == "navigation" { host.nativeAction(chrome, "navigation") }
        }
        @objc private func close() {
            if let surface = host.nativeSurfaces["navigation"] { host.nativeAction(surface, "close") }
            settle(open: false)
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            return gestureRecognizer !== edgePan || touch.location(in: view).x <= 24
        }
        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return true }
            let velocity = pan.velocity(in: view)
            guard abs(velocity.x) > abs(velocity.y) else { return false }
            return gestureRecognizer === edgePan ? canOpen && progress == 0 && velocity.x > 0 : progress > 0
        }

        @objc private func pan(_ gesture: UIPanGestureRecognizer) {
            switch gesture.state {
            case .began:
                dragging = true
                stopAnimation()
                dragStart = progress
                if gesture === edgePan { requestOpen() }
            case .changed:
                applyProgress(dragStart + gesture.translation(in: view).x / max(1, drawerWidth))
            case .ended, .cancelled:
                let projected = progress + gesture.velocity(in: view).x / max(1, drawerWidth) * 0.15
                let open = gesture.state == .cancelled ? dragStart > 0.5 : projected > 0.5
                dragging = false
                if open { settle(open: true) } else { close() }
            default: break
            }
        }
    }
}

private struct NativeMainChrome: View {
    @ObservedObject var host: NativeHost
    @ObservedObject private var chromeState: NativeSurfaceState
    @ObservedObject private var presentation: NativeSurfacePresentationState
    #if DEBUG
    private var previewContent: (() -> AnyView)?
    #endif

    init(host: NativeHost) {
        self.host = host
        chromeState = host.nativeSurfaceStore.state(for: "chrome")
        presentation = host.nativeSurfaceStore.presentation
    }

    #if DEBUG
    init(host: NativeHost, previewContent: @escaping () -> AnyView) {
        self.init(host: host)
        self.previewContent = previewContent
    }
    #endif

    @ViewBuilder private func documentContent(scrollInsets: EdgeInsets) -> some View {
        #if DEBUG
        if host.isPreview { previewContent?() ?? AnyView(Color.clear) }
        else { WebView(host: host, scrollInsets: scrollInsets) }
        #else
        WebView(host: host, scrollInsets: scrollInsets)
        #endif
    }

    private var chrome: NativeSurface? { chromeState.surface }
    private var extendsUnderBars: Bool { chrome?.leading?.id == "navigation" }
    private var sheet: NativeSurface? {
        presentation.value.sheet.flatMap { host.nativeSurfaces[$0.id] }
    }
    private var search: NativeSurface? { host.nativeSurfaces["search"].flatMap { $0.presented == true ? $0 : nil } }
    private var capture: NativeSurface? { host.nativeSurfaces["capture"].flatMap { $0.presented == true ? $0 : nil } }
    private var alert: NativeSurface? {
        presentation.value.alert
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                documentContent(scrollInsets: extendsUnderBars ? geometry.safeAreaInsets : EdgeInsets())
                    .modifier(NativeScrollEdges(enabled: extendsUnderBars))
            }
                .navigationTitle(chrome?.title ?? "记忆卡")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    if let chrome {
                        if let leading = chrome.leading {
                            ToolbarItem(placement: .topBarLeading) { action(leading, in: chrome, iconOnly: true) }
                        }
                        if let menu = chrome.titleMenu, !menu.isEmpty {
                            ToolbarItem(placement: .principal) {
                                Menu {
                                    ForEach(menu) { item in action(item, in: chrome) }
                                } label: {
                                    HStack(spacing: 5) { Text(chrome.title).font(.headline).lineLimit(1); Image(systemName: "chevron.down").font(.caption2) }
                                }
                                .accessibilityLabel("视图选项 \(chrome.title)")
                            }
                        }
                        if let pin = chrome.pin {
                            ToolbarItem(placement: .topBarTrailing) { action(pin, in: chrome, iconOnly: true) }
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Menu {
                                ForEach(chrome.menu ?? []) { item in action(item, in: chrome) }
                            } label: { Label("页面操作", systemImage: "ellipsis") }
                            .accessibilityLabel("页面操作")
                        }
                    }
                }
                .modifier(NativeBottomBar {
                    if let chrome, let bottom = chrome.bottom, !bottom.isEmpty {
                        HStack(spacing: 12) {
                            ForEach(bottom) { item in
                                bottomAction(item, in: chrome)
                                    .frame(width: item.id == "search" ? 48 : nil)
                                    .frame(maxWidth: item.id == "capture" ? .infinity : nil)
                            }
                        }
                        .controlSize(.large)
                        .foregroundStyle(.primary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    }
                })
        }
        .accessibilityHidden(search != nil || capture != nil || presentation.value.navigationOpen)
        .preferredColorScheme(chrome?.theme == "dark" ? .dark : chrome?.theme == "light" ? .light : nil)
        .overlay { NativeEdgeSearchOverlay(host: host, surface: search) }
        .overlay { NativeFloatingCaptureOverlay(host: host, surface: capture) }
        .sheet(item: Binding(get: { sheet }, set: { value in
            if value == nil, let sheet { host.nativeAction(sheet, "close") }
        })) { surface in
            NativePanel(host: host, id: surface.id, instance: surface.instance)
        }
        .alert(alert?.title ?? "", isPresented: Binding(get: { alert != nil && sheet == nil }, set: { if !$0, let alert { host.nativeAction(alert, "close") } })) {
            if let alert { alertButtons(alert) }
        } message: { Text(alert?.error ?? alert?.message ?? "") }
        .fileImporter(isPresented: Binding(get: { host.showPicker && sheet == nil && capture == nil }, set: { host.showPicker = $0 }), allowedContentTypes: host.pickerTypes) { host.finishPicker($0) }
    }

    private func action(_ item: NativeAction, in surface: NativeSurface, iconOnly: Bool = false) -> some View {
        var control = item
        if item.id == "capture", let summary = host.nativeSurfaces["capture"]?.summary { control.title = summary }
        return NativeActionButton(action: control, iconOnly: iconOnly, fillsWidth: item.id == "capture") { host.nativeAction(surface, item.id) }.lineLimit(1)
    }
    @ViewBuilder private func bottomAction(_ item: NativeAction, in surface: NativeSurface) -> some View {
        if #available(iOS 26.0, *) {
            action(item, in: surface, iconOnly: item.id == "search")
                .buttonStyle(.glass)
                .buttonBorderShape(item.id == "search" ? .circle : .capsule)
        } else {
            action(item, in: surface, iconOnly: item.id == "search")
                .buttonStyle(.bordered)
                .buttonBorderShape(item.id == "search" ? .circle : .capsule)
        }
    }
    @ViewBuilder private func alertButtons(_ surface: NativeSurface) -> some View {
        ForEach(surface.sections?.flatMap { $0.actions ?? [] } ?? []) { item in action(item, in: surface) }
        Button("取消", role: .cancel) { host.nativeAction(surface, "close") }
    }
}

private struct NativeScrollEdges: ViewModifier {
    let enabled: Bool
    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.ignoresSafeArea(.container, edges: enabled ? .vertical : [])
                .scrollEdgeEffectStyle(.soft, for: [.top, .bottom])
        } else { content }
    }
}

private struct NativeBottomBar<Bar: View>: ViewModifier {
    @ViewBuilder let bar: () -> Bar
    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.safeAreaBar(edge: .bottom, spacing: 0, content: bar)
        } else { content.safeAreaInset(edge: .bottom, spacing: 0, content: bar) }
    }
}

private struct NativeEdgeSearchOverlay: View {
    let host: NativeHost
    let surface: NativeSurface?

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .bottom) {
                if let surface {
                    Color.black.opacity(0.3).ignoresSafeArea()
                        .onTapGesture { host.nativeAction(surface, "close") }
                        .accessibilityHidden(true)
                        .transition(.opacity)
                    NativeDesignedPanel(host: host, id: surface.id, instance: surface.instance)
                        .frame(maxWidth: .infinity)
                        .frame(height: min((geometry.size.height + geometry.safeAreaInsets.top + geometry.safeAreaInsets.bottom) * 0.9, geometry.size.height))
                        .accessibilityAddTraits(.isModal)
                        .transition(.move(edge: .bottom))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
        .ignoresSafeArea(.container, edges: [.horizontal, .bottom])
        .allowsHitTesting(surface != nil)
        .animation(.easeOut(duration: 0.22), value: surface?.instance)
    }
}

private struct NativeFloatingCaptureOverlay: View {
    let host: NativeHost
    let surface: NativeSurface?

    var body: some View {
        ZStack {
            if let surface {
                Rectangle().fill(.regularMaterial).ignoresSafeArea()
                    .onTapGesture { if surface.busy != true { host.nativeAction(surface, "close") } }
                    .accessibilityHidden(true).transition(.opacity)
                NativeDesignedPanel(host: host, id: surface.id, instance: surface.instance)
                    .padding(.horizontal, 12).padding(.vertical, 12)
                    .accessibilityAddTraits(.isModal)
                    .transition(.move(edge: .bottom))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .allowsHitTesting(surface != nil)
        .animation(.easeOut(duration: 0.22), value: surface?.instance)
    }
}

struct NativeCloseButton: View {
    let label: String
    var size: CGFloat = 36
    var disabled = false
    let action: () -> Void

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                button.glassEffect(.regular.interactive(), in: Circle())
            } else {
                button.background(.regularMaterial, in: Circle())
            }
        }
        .disabled(disabled)
        .accessibilityLabel(label)
    }

    private var button: some View {
        Button(action: action) {
            Image(systemName: "xmark").font(.system(size: size == 44 ? 20 : 16))
                .frame(width: size, height: size).contentShape(Circle())
        }
        .buttonStyle(.plain)
    }
}

private struct NativeActionButton: View {
    let action: NativeAction
    var iconOnly = false
    var fillsWidth = false
    let perform: () -> Void
    var body: some View {
        Button(role: action.destructive == true ? .destructive : nil, action: perform) {
            if iconOnly {
                Label(action.title, systemImage: action.icon ?? "circle").labelStyle(.iconOnly)
            } else {
                HStack {
                    if let icon = action.icon { Image(systemName: icon) }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(action.title)
                        if let subtitle = action.subtitle { Text(subtitle).font(.caption).foregroundStyle(.secondary).lineLimit(2) }
                    }
                    if action.selected == true { Spacer(); Image(systemName: "checkmark") }
                }
                .frame(maxWidth: fillsWidth ? .infinity : nil, alignment: .leading)
            }
        }
        .disabled(action.disabled == true)
        .accessibilityLabel(action.title)
    }
}

private struct NativePanel: View {
    @ObservedObject var host: NativeHost
    @ObservedObject private var surfaceState: NativeSurfaceState
    @ObservedObject private var presentation: NativeSurfacePresentationState
    let id: String
    let instance: String
    @State private var values: [String: String] = [:]
    @FocusState private var focusedField: String?
    private var surface: NativeSurface? { surfaceState.surface.flatMap { $0.instance == instance ? $0 : nil } }
    private var alert: NativeSurface? { presentation.value.alert }

    init(host: NativeHost, id: String, instance: String) {
        self.host = host; self.id = id; self.instance = instance
        surfaceState = host.nativeSurfaceStore.state(for: id)
        presentation = host.nativeSurfaceStore.presentation
    }

    var body: some View {
        NavigationStack {
            if let surface {
                panelList(surface)
                    .navigationTitle(surface.title)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("关闭", systemImage: "xmark") { host.nativeAction(surface, "close") }.labelStyle(.iconOnly).disabled(surface.busy == true)
                        }
                        if let primary = surface.primary {
                            ToolbarItem(placement: .confirmationAction) { NativeActionButton(action: primary) { host.nativeAction(surface, primary.id) } }
                        }
                        ToolbarItemGroup(placement: .keyboard) {
                            Spacer()
                            Button("完成") { focusedField = nil }
                        }
                    }
                    .interactiveDismissDisabled(surface.busy == true)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .fileImporter(isPresented: $host.showPicker, allowedContentTypes: host.pickerTypes) { host.finishPicker($0) }
        .alert(alert?.title ?? "", isPresented: Binding(get: { alert != nil }, set: { if !$0, let alert { host.nativeAction(alert, "close") } })) {
            if let alert {
                ForEach(alert.sections?.flatMap { $0.actions ?? [] } ?? []) { item in
                    NativeActionButton(action: item) { host.nativeAction(alert, item.id) }
                }
                Button("取消", role: .cancel) { host.nativeAction(alert, "close") }
            }
        } message: { Text(alert?.error ?? alert?.message ?? "") }
    }

    private func panelList(_ surface: NativeSurface) -> some View {
        List {
            if surface.busy == true || surface.loading == true { ProgressView("处理中…") }
            if let message = surface.message, !message.isEmpty { Text(message).font(.subheadline).foregroundStyle(.secondary) }
            if let error = surface.error, !error.isEmpty { Text(error).foregroundStyle(.red).accessibilityAddTraits(.updatesFrequently) }
            ForEach(surface.sections ?? []) { section in
                Section {
                    ForEach(section.fields ?? []) { field in
                        if field.kind == "multiline" {
                            TextEditor(text: binding(field, in: surface))
                                .frame(minHeight: 150)
                                .overlay(alignment: .topLeading) {
                                    if binding(field, in: surface).wrappedValue.isEmpty {
                                        Text(field.title).foregroundStyle(.tertiary).padding(.top, 8).padding(.leading, 5).allowsHitTesting(false)
                                    }
                                }
                                .focused($focusedField, equals: field.id)
                                .accessibilityLabel(field.title)
                                .disabled(field.disabled == true)
                        } else {
                            TextField(field.title, text: binding(field, in: surface)).focused($focusedField, equals: field.id).disabled(field.disabled == true).accessibilityLabel(field.title)
                        }
                    }
                    ForEach(section.actions ?? []) { item in
                        NativeActionButton(action: item) { host.nativeAction(surface, item.id) }
                            .tint(item.destructive == true ? .red : .primary)
                        .id(item.id)
                    }
                    if let message = section.message, !message.isEmpty { Text(message).font(.footnote).foregroundStyle(.secondary).textSelection(.enabled) }
                } header: { if let title = section.title { Text(title) } }
            }
        }
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .onChange(of: surface.instance, initial: true) { values = [:] }
        .onChange(of: surface.resetKey) { values = [:] }
        .onChange(of: surface.sections?.flatMap { $0.fields ?? [] }.map { $0.value }) { _, _ in
            // Preserve immediate native typing until Web state acknowledges it.
            for field in surface.sections?.flatMap({ $0.fields ?? [] }) ?? [] where values[field.id] == field.value { values.removeValue(forKey: field.id) }
        }
    }

    private func binding(_ field: NativeField, in surface: NativeSurface) -> Binding<String> {
        Binding(get: { values[field.id] ?? field.value }, set: { value in
            values[field.id] = value
            host.nativeAction(surface, field.id, value: value)
        })
    }
}

#if DEBUG
struct NativeMainChromePreviewCanvas: View {
    @ObservedObject var model: NativeMainChromePreviewModel
    var showControls = true

    var body: some View {
        VStack(spacing: 0) {
            if showControls {
                VStack(alignment: .leading, spacing: 8) {
                    Picker("原生外壳场景", selection: Binding(get: { model.scenario }, set: { model.select($0) })) {
                        ForEach(NativeMainChromePreviewModel.Scenario.allCases) { Text($0.rawValue).tag($0) }
                    }.pickerStyle(.segmented)
                    Text("仅预览原生导航与菜单；标题、正文和保存请在 Editor Storybook／实际 App 中验证。")
                        .font(.caption).foregroundStyle(.secondary)
                    Text(model.feedback).font(.caption).accessibilityLabel("原生外壳预览反馈")
                }.padding(12)
                Divider()
            }
            NativeMainChrome(host: model.host) { AnyView(document) }
        }
    }

    private var document: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(model.isDetail ? "侧栏布局笔记" : "示例笔记集合").font(.title2.bold())
                Text("隔离示例：不会打开笔记库，也不会加载 WebView。")
                    .font(.caption).foregroundStyle(.secondary)
                if model.isDetail {
                    Text("这里是只读占位正文，用于检查原生返回、固定、页面操作及禁用态。")
                    Text(model.isPinned ? "已固定到主页" : "尚未固定到主页").font(.caption)
                } else {
                    Text("当前布局：\(model.layout == "cards" ? "卡片" : "列表")").font(.caption)
                    Button("打开示例笔记") { model.openNote() }.buttonStyle(.bordered)
                }
            }.frame(maxWidth: .infinity, alignment: .leading).padding()
        }
    }
}

private struct NativeMainChromeInteractivePreview: View {
    @StateObject private var model: NativeMainChromePreviewModel
    let dark: Bool
    init(_ scenario: NativeMainChromePreviewModel.Scenario, dark: Bool = false) {
        self.dark = dark
        _model = StateObject(wrappedValue: NativeMainChromePreviewModel(scenario: scenario, dark: dark))
    }
    var body: some View {
        NativeMainChromePreviewCanvas(model: model).preferredColorScheme(dark ? .dark : .light)
            .dynamicTypeSize(dark ? .accessibility3 : .large)
    }
}

#Preview("Main Chrome · Collection") { NativeMainChromeInteractivePreview(.collection) }
#Preview("Main Chrome · Detail") { NativeMainChromeInteractivePreview(.detail) }
#Preview("Main Chrome · Busy") { NativeMainChromeInteractivePreview(.busy) }
#Preview("Main Chrome · Dark Large") { NativeMainChromeInteractivePreview(.detail, dark: true) }

struct NativeSurfacePreviewCanvas: View {
    @ObservedObject var model: NativeSurfacePreviewModel
    @ObservedObject private var surfaceState: NativeSurfaceState
    var showControls = true

    init(model: NativeSurfacePreviewModel, showControls: Bool = true) {
        self.model = model; self.showControls = showControls
        surfaceState = model.host.nativeSurfaceStore.state(for: model.kind.rawValue)
    }
    var body: some View {
        VStack(spacing: 0) {
            if showControls {
                VStack(alignment: .leading, spacing: 8) {
                    Picker("预览场景", selection: Binding(get: { model.scenario }, set: { model.select($0) })) {
                        ForEach(model.scenarios) { Text($0.rawValue).tag($0) }
                    }
                    HStack {
                        Button("重新打开") { model.reopen() }
                        Button("重置场景") { model.select(model.scenario) }
                        if model.kind == .capture { Toggle("下次保存失败", isOn: $model.failNextSave) }
                    }.font(.caption)
                    Text(model.feedback).font(.caption).accessibilityLabel("预览操作反馈")
                }.padding(12)
                Divider()
            }
            ZStack {
                Color(uiColor: .systemBackground)
                let surface = surfaceState.surface.flatMap { $0.presented == true ? $0 : nil }
                if model.kind == .search { NativeEdgeSearchOverlay(host: model.host, surface: surface) }
                else { NativeFloatingCaptureOverlay(host: model.host, surface: surface) }
            }
        }
        .onAppear { model.resume() }
        .onDisappear { model.dispose() }
    }
}

private struct NativeSurfaceInteractivePreview: View {
    @StateObject private var model: NativeSurfacePreviewModel
    let dark: Bool
    init(_ kind: NativeSurfacePreviewModel.Kind, scenario: NativeSurfacePreviewModel.Scenario? = nil, dark: Bool = false) {
        self.dark = dark
        _model = StateObject(wrappedValue: NativeSurfacePreviewModel(kind: kind, scenario: scenario, dark: dark))
    }
    var body: some View {
        NativeSurfacePreviewCanvas(model: model).preferredColorScheme(dark ? .dark : .light)
            .dynamicTypeSize(dark ? .accessibility3 : .large)
    }
}

#Preview("Search · Recent") { NativeSurfaceInteractivePreview(.search) }
#Preview("Search · Results · Dark Large") { NativeSurfaceInteractivePreview(.search, scenario: .results, dark: true) }
#Preview("Capture · Default") { NativeSurfaceInteractivePreview(.capture) }
#Preview("Capture · Populated · Dark Large") { NativeSurfaceInteractivePreview(.capture, scenario: .populated, dark: true) }
#endif

#endif
