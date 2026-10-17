#if os(iOS)
import SwiftUI
import UIKit

struct NativeAction: Decodable, Identifiable {
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

struct NativeField: Decodable, Identifiable {
    let id: String
    let title: String
    let value: String
    var kind: String?
    var disabled: Bool?
}

struct NativeSection: Decodable, Identifiable {
    let id: String
    var title: String?
    var message: String?
    var actions: [NativeAction]?
    var fields: [NativeField]?
}

struct NativeSurface: Decodable, Identifiable {
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
    @ObservedObject var host: NativeHost
    var body: some View {
        NativeSidebarContainer(host: host)
            .ignoresSafeArea()
            .preferredColorScheme(host.nativeSurfaces["chrome"]?.theme == "dark" ? .dark : host.nativeSurfaces["chrome"]?.theme == "light" ? .light : nil)
    }
}

private struct NativeSidebarContainer: UIViewControllerRepresentable {
    @ObservedObject var host: NativeHost

    func makeUIViewController(context: Context) -> SidebarController { SidebarController(host: host) }
    func updateUIViewController(_ controller: SidebarController, context: Context) {
        controller.update(open: host.nativeSurfaces["navigation"]?.presented == true,
                          canOpen: host.nativeSurfaces["chrome"]?.leading?.id == "navigation"
                            && !host.nativeSurfaces.values.contains { $0.presented == true && $0.id != "navigation" })
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
            card.layer.shadowOffset = CGSize(width: -8, height: 0)
            card.layer.shadowRadius = 20
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

        func update(open: Bool, canOpen: Bool) {
            loadViewIfNeeded()
            if let rgba = host.nativeSurfaces["chrome"]?.palette?["sidebar"], rgba.count == 4 {
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
            card.layer.shadowOpacity = Float(0.15 * progress)
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

private struct NativeNavigationSidebar: View {
    @ObservedObject var host: NativeHost
    var trailingInset: CGFloat = 16
    @State private var snapshot: NativeSurface?
    @State private var filtersOpen = false
    @State private var pinnedOpen = true
    @State private var tagsOpen = true
    @State private var searchOpen = false
    @State private var query = ""
    @FocusState private var searchFocused: Bool
    private static let logo = Bundle.main.resourceURL.flatMap { UIImage(contentsOfFile: $0.appendingPathComponent("Web/favicon.png").path) }
    private var surface: NativeSurface? {
        host.nativeSurfaces["navigation"].flatMap { $0.presented == true ? $0 : nil } ?? snapshot
    }
    private var radius: CGFloat { CGFloat(surface?.rowRadius ?? 10) }
    private var tags: [NativeAction] { actions("tags") }
    private func actions(_ id: String) -> [NativeAction] { surface?.sections?.first { $0.id == id }?.actions ?? [] }
    private func color(_ key: String) -> Color {
        if let rgba = host.nativeSurfaces["chrome"]?.palette?[key], rgba.count == 4 {
            return Color(.sRGB, red: rgba[0] / 255, green: rgba[1] / 255, blue: rgba[2] / 255, opacity: rgba[3] / 255)
        }
        return key == "sidebar" || key == "sidebar-accent" ? Color(uiColor: .secondarySystemBackground) : key == "sidebar-border" ? Color(uiColor: .separator) : .primary
    }
    private func send(_ id: String) { if let surface { host.nativeAction(surface, id) } }
    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                scrollContent
                    .safeAreaBar(edge: .top, spacing: 0) { header }
                    .safeAreaBar(edge: .bottom, spacing: 0) {
                        // A transparent label anchors the native edge effect without painting an opaque strip.
                        Text(" ").frame(maxWidth: .infinity).frame(height: 8).foregroundStyle(.clear).accessibilityHidden(true)
                    }
                    .scrollEdgeEffectStyle(.soft, for: [.top, .bottom])
            } else {
                VStack(spacing: 0) { header; scrollContent }
            }
        }
        .font(.system(size: 16)).foregroundStyle(color("sidebar-foreground"))
        .background(color("sidebar").ignoresSafeArea())
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape) { send("close") }
        .onReceive(host.$nativeSurfaces) { surfaces in
            if let current = surfaces["navigation"], current.presented == true {
                if snapshot?.resetKey != current.resetKey {
                    filtersOpen = false; pinnedOpen = true; tagsOpen = true; searchOpen = false; query = ""
                }
                snapshot = current
            } else {
                searchFocused = false
            }
        }
    }
    private var header: some View {
        HStack(spacing: 8) {
            Button { send("home") } label: {
                HStack(spacing: 8) {
                    if let logo = Self.logo { Image(uiImage: logo).resizable().scaledToFit().frame(width: 28, height: 28) }
                    Text("MemoCard").font(.system(size: 14, weight: .semibold))
                    Spacer(minLength: 0)
                }.padding(.horizontal, 6).frame(height: 40).contentShape(Rectangle())
            }
            .buttonStyle(NativeSidebarButtonStyle(selected: false, color: color("sidebar-accent"), radius: radius))
            .accessibilityLabel("MemoCard，返回主页")
            settingsButton
        }
        .padding(.leading, 8).padding(.trailing, trailingInset).padding(.bottom, 16)
    }
    private var scrollContent: some View {
        ScrollView {
            VStack(spacing: 8) {
                VStack(spacing: 8) {
                    if let message = surface?.sections?.first(where: { $0.id == "library" })?.message, !message.isEmpty {
                        Text(message).font(.system(size: 12)).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 8)
                    }
                    VStack(spacing: 4) {
                        ForEach(actions("pages")) { item in
                            VStack(spacing: 0) {
                                NativeSidebarItem(item: item, selection: color("sidebar-accent"), radius: radius,
                                                  expanded: item.id == "notes" ? $filtersOpen : nil,
                                                  expansionLabel: "展开或收起快捷筛选") { send(item.id) }
                                if item.id == "notes", filtersOpen {
                                    VStack(spacing: 4) {
                                        ForEach(actions("filters")) { filter in
                                            NativeSidebarItem(item: filter, selection: color("sidebar-accent"), radius: radius) { send(filter.id) }
                                        }
                                    }.padding(.vertical, 2).padding(.leading, 24)
                                        .overlay(alignment: .leading) { Rectangle().fill(color("sidebar-border")).frame(width: 1).padding(.leading, 14) }
                                }
                            }
                        }
                    }
                }.padding(.horizontal, 8).padding(.bottom, 8)
                if !actions("pinned-tags").isEmpty {
                    VStack(spacing: 0) {
                        groupHeader("置顶标签", open: $pinnedOpen)
                        if pinnedOpen {
                            VStack(spacing: 4) {
                                ForEach(actions("pinned-tags")) { item in branch(item, fullPath: true) }
                            }
                        }
                    }.padding(8)
                }
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        groupHeader("标签", open: $tagsOpen)
                        Button {
                            searchOpen.toggle(); query = ""; tagsOpen = true; searchFocused = searchOpen
                        } label: { Image(systemName: searchOpen ? "xmark" : "magnifyingglass").frame(width: 44, height: 44).contentShape(Rectangle()) }
                        .buttonStyle(.plain)
                        .accessibilityLabel(searchOpen ? "关闭标签搜索" : "搜索标签")
                    }
                    if searchOpen {
                        TextField("搜索标签…", text: $query).textFieldStyle(.plain)
                            .font(.system(size: 16)).padding(.horizontal, 12).frame(height: 32)
                            .background(color("sidebar"), in: RoundedRectangle(cornerRadius: 8))
                            .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(color("sidebar-border")) }
                            .padding(.bottom, 8).focused($searchFocused).accessibilityLabel("搜索标签")
                    }
                    if tagsOpen {
                        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
                        let matches = term.isEmpty ? tags.filter { !($0.path ?? "").contains("/") } : tags.filter { ($0.path ?? "").lowercased().contains(term.lowercased()) }
                        VStack(spacing: 4) {
                            ForEach(matches) { item in branch(item, fullPath: !term.isEmpty, flat: !term.isEmpty) }
                        }
                        if surface?.loading == true { ProgressView("正在加载标签").font(.system(size: 12)).padding(8) }
                        else if matches.isEmpty { Text(term.isEmpty ? "添加标签后，会显示在这里。" : "没有匹配的标签").font(.system(size: 12)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading).padding(8) }
                    }
                    if let error = surface?.error, !error.isEmpty { Text(error).font(.system(size: 12)).foregroundStyle(.red).padding(8) }
                }.padding(8)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .id(surface?.resetKey)
    }
    private var settingsButton: some View {
        let button = Button { send("vault") } label: {
            Image(systemName: "gearshape").font(.system(size: 18))
                .frame(width: 44, height: 44).contentShape(Circle())
        }.buttonStyle(.plain)
        return Group {
            if #available(iOS 26.0, *) { button.glassEffect(.regular.interactive(), in: Circle()) }
            else { button.background(.regularMaterial, in: Circle()) }
        }
        .disabled(actions("library").first?.disabled == true)
        .accessibilityLabel("设置与笔记库")
        .accessibilityHint("当前笔记库：\(actions("library").first?.title ?? "未连接")")
    }
    private func groupHeader(_ title: String, open: Binding<Bool>) -> some View {
        Button { open.wrappedValue.toggle() } label: {
            HStack(spacing: 4) {
                Text(title).font(.system(size: 12, weight: .medium))
                Image(systemName: "chevron.right").font(.system(size: 10)).rotationEffect(.degrees(open.wrappedValue ? 90 : 0))
                Spacer(minLength: 0)
            }.padding(.horizontal, 8).frame(height: 44).contentShape(Rectangle())
        }.foregroundStyle(color("sidebar-foreground").opacity(0.7)).buttonStyle(.plain)
            .accessibilityLabel("展开或收起\(title)").accessibilityValue(open.wrappedValue ? "已展开" : "已收起")
    }
    private func branch(_ item: NativeAction, fullPath: Bool = false, flat: Bool = false) -> some View {
        NativeSidebarTagBranch(item: item, tags: tags, fullPath: fullPath, flat: flat,
                               selection: color("sidebar-accent"), border: color("sidebar-border"), radius: radius, send: send)
    }
}

private struct NativeSidebarTagBranch: View {
    let item: NativeAction
    let tags: [NativeAction]
    var fullPath = false
    var flat = false
    let selection: Color
    let border: Color
    let radius: CGFloat
    let send: (String) -> Void
    @State private var expanded = true
    private var children: [NativeAction] {
        guard !flat, let path = item.path else { return [] }
        return tags.filter { ($0.path ?? "").hasPrefix(path + "/") && !String(($0.path ?? "").dropFirst(path.count + 1)).contains("/") }
    }
    var body: some View {
        VStack(spacing: 0) {
            NativeSidebarItem(item: item, title: fullPath ? item.path : nil, selection: selection, radius: radius,
                              expanded: children.isEmpty ? nil : $expanded,
                              expansionLabel: "展开或收起标签 \(item.path ?? item.title)") { send(item.id) }
            if expanded, !children.isEmpty {
                VStack(spacing: 4) {
                    ForEach(children) { child in
                        NativeSidebarTagBranch(item: child, tags: tags, selection: selection, border: border, radius: radius, send: send)
                    }
                }.padding(.vertical, 2).padding(.leading, 24)
                    .overlay(alignment: .leading) { Rectangle().fill(border).frame(width: 1).padding(.leading, 14) }
            }
        }
    }
}

private struct NativeSidebarItem: View {
    let item: NativeAction
    var title: String?
    let selection: Color
    let radius: CGFloat
    var expanded: Binding<Bool>?
    var expansionLabel = ""
    let action: () -> Void
    var body: some View {
        ZStack(alignment: .trailing) {
            Button(action: action) {
                HStack(spacing: 8) {
                    if let emoji = item.emoji, !emoji.isEmpty { Text(emoji).frame(width: 16, height: 16) }
                    else if let icon = item.icon { Image(systemName: icon).font(.system(size: 16)).frame(width: 16, height: 16) }
                    Text(title ?? item.title).lineLimit(1).fontWeight(item.selected == true ? .medium : .regular)
                    Spacer(minLength: 0)
                    if let badge = item.badge { Text("\(badge)").font(.system(size: 12)).foregroundStyle(.secondary) }
                }.padding(.leading, 8).padding(.trailing, expanded == nil ? 8 : 48)
                    .frame(minHeight: 48).contentShape(Rectangle())
            }
            .buttonStyle(NativeSidebarButtonStyle(selected: item.selected == true, color: selection, radius: radius))
            .disabled(item.disabled == true)
            .opacity(item.disabled == true && item.id != "calendar" ? 0.5 : 1)
            .accessibilityLabel(item.path ?? item.title)
            .accessibilityAddTraits(item.selected == true ? .isSelected : [])
            if let expanded {
                Button { expanded.wrappedValue.toggle() } label: {
                    Image(systemName: "chevron.right").font(.system(size: 16)).rotationEffect(.degrees(expanded.wrappedValue ? 90 : 0))
                        .frame(width: 40, height: 40).contentShape(Rectangle())
                }.buttonStyle(.plain).padding(.trailing, 4)
                    .accessibilityLabel(expansionLabel).accessibilityValue(expanded.wrappedValue ? "已展开" : "已收起")
            }
        }
    }
}

private struct NativeSidebarButtonStyle: ButtonStyle {
    let selected: Bool
    let color: Color
    let radius: CGFloat
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.background(selected || configuration.isPressed ? color : .clear, in: RoundedRectangle(cornerRadius: radius))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

private struct NativeMainChrome: View {
    @ObservedObject var host: NativeHost
    private var chrome: NativeSurface? { host.nativeSurfaces["chrome"] }
    private var extendsUnderBars: Bool { chrome?.leading?.id == "navigation" }
    private var sheet: NativeSurface? {
        host.nativeSurfaces.values.filter { $0.presented == true && $0.id != "navigation" && $0.kind != "alert" && $0.kind != "chrome" && $0.kind != "search" && $0.kind != "capture" }.sorted { $0.id < $1.id }.first
    }
    private var search: NativeSurface? { host.nativeSurfaces["search"].flatMap { $0.presented == true ? $0 : nil } }
    private var capture: NativeSurface? { host.nativeSurfaces["capture"].flatMap { $0.presented == true ? $0 : nil } }
    private var alert: NativeSurface? {
        host.nativeSurfaces.values.first { $0.presented == true && $0.kind == "alert" }
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                WebView(host: host, scrollInsets: extendsUnderBars ? geometry.safeAreaInsets : EdgeInsets())
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
        .accessibilityHidden(search != nil || capture != nil || host.nativeSurfaces["navigation"]?.presented == true)
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
    @ObservedObject var host: NativeHost
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
    @ObservedObject var host: NativeHost
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
    let id: String
    let instance: String
    @State private var values: [String: String] = [:]
    @FocusState private var focusedField: String?
    private var surface: NativeSurface? { host.nativeSurfaces[id].flatMap { $0.instance == instance ? $0 : nil } }
    private var alert: NativeSurface? { host.nativeSurfaces.values.first { $0.presented == true && $0.kind == "alert" } }

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

#endif
