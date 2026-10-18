// Positions refer to the current actions, so selection, icons and badges never use cached values.
struct NativeSidebarTagIndex {
    let roots: [Int]
    private let childrenByPath: [String: [Int]]

    init(paths: [String?]) {
        var roots: [Int] = []
        var children: [String: [Int]] = [:]
        for (index, path) in paths.enumerated() {
            guard let path else { roots.append(index); continue }
            if let slash = path.lastIndex(of: "/") {
                children[String(path[..<slash]), default: []].append(index)
            } else {
                roots.append(index)
            }
        }
        self.roots = roots
        childrenByPath = children
    }

    func children(of path: String?) -> [Int] {
        guard let path else { return [] }
        return childrenByPath[path] ?? []
    }
}

#if os(iOS)
import SwiftUI
import UIKit

struct NativeNavigationSidebar: View {
    let host: NativeHost
    @ObservedObject private var surfaceState: NativeSurfaceState
    @ObservedObject private var appearance: NativeSurfaceAppearanceState
    var trailingInset: CGFloat = 16
    @State private var snapshot: NativeSurface?
    @State private var filtersOpen = false
    @State private var pinnedOpen = true
    @State private var tagsOpen = true
    @State private var searchOpen = false
    @State private var query = ""
    @FocusState private var searchFocused: Bool
    @ScaledMetric(relativeTo: .body) private var bodyFontSize = SidebarTokens.mobileFontSize
    @ScaledMetric(relativeTo: .subheadline) private var brandFontSize = SidebarTokens.brandFontSize
    @ScaledMetric(relativeTo: .caption) private var captionFontSize = SidebarTokens.captionFontSize
    private static let logo = Bundle.main.resourceURL.flatMap { UIImage(contentsOfFile: $0.appendingPathComponent("Web/favicon.png").path) }
    init(host: NativeHost, trailingInset: CGFloat = 16) {
        self.host = host
        self.trailingInset = trailingInset
        surfaceState = host.nativeSurfaceStore.state(for: "navigation")
        appearance = host.nativeSurfaceStore.appearance
    }
    private var surface: NativeSurface? {
        surfaceState.surface.flatMap { $0.presented == true ? $0 : nil } ?? snapshot
    }
    private var radius: CGFloat { CGFloat(surface?.rowRadius ?? Double(DesignRadius.lg)) }
    private var tags: [NativeAction] { actions("tags") }
    private func actions(_ id: String) -> [NativeAction] { surface?.sections?.first { $0.id == id }?.actions ?? [] }
    private func color(_ key: String) -> Color {
        if let rgba = appearance.value.palette?[key], rgba.count == 4 {
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
        .font(.system(size: bodyFontSize)).foregroundStyle(color("sidebar-foreground"))
        .background(color("sidebar").ignoresSafeArea())
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape) { send("close") }
        .onReceive(surfaceState.$surface) { surface in
            if let current = surface, current.presented == true {
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
        HStack(spacing: SidebarTokens.contentGap) {
            Button { send("home") } label: {
                HStack(spacing: SidebarTokens.contentGap) {
                    if let logo = Self.logo { Image(uiImage: logo).resizable().scaledToFit().frame(width: SidebarTokens.logoSize, height: SidebarTokens.logoSize) }
                    Text("MemoCard").font(.system(size: brandFontSize, weight: .semibold)).lineLimit(1)
                    Spacer(minLength: 0)
                }.padding(.horizontal, 6).frame(minHeight: 40).contentShape(Rectangle())
            }
            .buttonStyle(NativeSidebarButtonStyle(selected: false, color: color("sidebar-accent"), radius: radius))
            .accessibilityLabel("MemoCard，返回主页")
            settingsButton
        }
        .padding(.leading, SidebarTokens.horizontalPadding).padding(.trailing, trailingInset).padding(.bottom, 16)
    }
    private var scrollContent: some View {
        let tags = self.tags
        let tagIndex = NativeSidebarTagIndex(paths: tags.map(\.path))
        return ScrollView {
            VStack(spacing: 8) {
                VStack(spacing: 8) {
                    if let message = surface?.sections?.first(where: { $0.id == "library" })?.message, !message.isEmpty {
                        Text(message).font(.system(size: captionFontSize)).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, SidebarTokens.horizontalPadding)
                    }
                    VStack(spacing: SidebarTokens.rowGap) {
                        ForEach(actions("pages")) { item in
                            VStack(spacing: 0) {
                                NativeSidebarItem(item: item, selection: color("sidebar-accent"), radius: radius,
                                                  expanded: item.id == "notes" ? $filtersOpen : nil,
                                                  expansionLabel: "展开或收起快捷筛选") { send(item.id) }
                                if item.id == "notes", filtersOpen {
                                    VStack(spacing: SidebarTokens.rowGap) {
                                        ForEach(actions("filters")) { filter in
                                            NativeSidebarItem(item: filter, selection: color("sidebar-accent"), radius: radius) { send(filter.id) }
                                        }
                                    }.padding(.vertical, 2).padding(.leading, SidebarTokens.indent)
                                        .overlay(alignment: .leading) { Rectangle().fill(color("sidebar-border")).frame(width: 1).padding(.leading, 14) }
                                }
                            }
                        }
                    }
                }.padding(.horizontal, SidebarTokens.horizontalPadding).padding(.bottom, 8)
                if !actions("pinned-tags").isEmpty {
                    VStack(spacing: 0) {
                        groupHeader("置顶标签", open: $pinnedOpen)
                        if pinnedOpen {
                            VStack(spacing: SidebarTokens.rowGap) {
                                ForEach(actions("pinned-tags")) { item in branch(item, tags: tags, tagIndex: tagIndex, fullPath: true) }
                            }
                        }
                    }.padding(8)
                }
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        groupHeader("标签", open: $tagsOpen)
                        Button {
                            searchOpen.toggle(); query = ""; tagsOpen = true; searchFocused = searchOpen
                        } label: { NativeSidebarIcon(searchOpen ? "xmark" : "magnifyingglass").frame(width: SidebarTokens.touchTargetSize, height: SidebarTokens.touchTargetSize).contentShape(Rectangle()) }
                        .buttonStyle(.plain)
                        .accessibilityLabel(searchOpen ? "关闭标签搜索" : "搜索标签")
                    }
                    if searchOpen {
                        TextField("搜索标签…", text: $query).textFieldStyle(.plain)
                            .font(.system(size: bodyFontSize)).padding(.horizontal, 12).frame(minHeight: 32)
                            .background(color("sidebar"), in: RoundedRectangle(cornerRadius: 8))
                            .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(color("sidebar-border")) }
                            .padding(.bottom, 8).focused($searchFocused).accessibilityLabel("搜索标签")
                    }
                    if tagsOpen {
                        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
                        let normalizedTerm = term.lowercased()
                        let matches = term.isEmpty ? tagIndex.roots.map { tags[$0] } : tags.filter { ($0.path ?? "").lowercased().contains(normalizedTerm) }
                        VStack(spacing: SidebarTokens.rowGap) {
                            ForEach(matches) { item in branch(item, tags: tags, tagIndex: tagIndex, fullPath: !term.isEmpty, flat: !term.isEmpty) }
                        }
                        if surface?.loading == true { ProgressView("正在加载标签").font(.system(size: captionFontSize)).padding(8) }
                        else if matches.isEmpty { Text(term.isEmpty ? "添加标签后，会显示在这里。" : "没有匹配的标签").font(.system(size: captionFontSize)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading).padding(8) }
                    }
                    if let error = surface?.error, !error.isEmpty { Text(error).font(.system(size: captionFontSize)).foregroundStyle(.red).padding(8) }
                }.padding(8)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .id(surface?.resetKey)
    }
    private var settingsButton: some View {
        let button = Button { send("vault") } label: {
            NativeSidebarIcon("gearshape", size: 18)
                .frame(width: SidebarTokens.touchTargetSize, height: SidebarTokens.touchTargetSize).contentShape(Circle())
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
                Text(title).font(.system(size: captionFontSize, weight: .medium))
                NativeSidebarIcon("chevron.right", size: 10).rotationEffect(.degrees(open.wrappedValue ? 90 : 0))
                Spacer(minLength: 0)
            }.padding(.horizontal, SidebarTokens.horizontalPadding).frame(minHeight: SidebarTokens.touchTargetSize).contentShape(Rectangle())
        }.foregroundStyle(color("sidebar-foreground").opacity(0.7)).buttonStyle(.plain)
            .accessibilityLabel("展开或收起\(title)").accessibilityValue(open.wrappedValue ? "已展开" : "已收起")
    }
    // Explicit calling closures preserve Canvas source selection in Xcode 27.1.
    private func branch(_ item: NativeAction, tags: [NativeAction], tagIndex: NativeSidebarTagIndex, fullPath: Bool = false, flat: Bool = false) -> some View {
        NativeSidebarTagBranch(item: item, tags: tags, tagIndex: tagIndex, fullPath: fullPath, flat: flat,
                               selection: color("sidebar-accent"), border: color("sidebar-border"), radius: radius, send: { send($0) })
    }
}

private struct NativeSidebarTagBranch: View {
    let item: NativeAction
    let tags: [NativeAction]
    let tagIndex: NativeSidebarTagIndex
    var fullPath = false
    var flat = false
    let selection: Color
    let border: Color
    let radius: CGFloat
    let send: (String) -> Void
    @State private var expanded = true
    private var children: [NativeAction] {
        guard !flat else { return [] }
        return tagIndex.children(of: item.path).map { tags[$0] }
    }
    var body: some View {
        VStack(spacing: 0) {
            NativeSidebarItem(item: item, title: fullPath ? item.path : nil, selection: selection, radius: radius,
                              expanded: children.isEmpty ? nil : $expanded,
                              expansionLabel: "展开或收起标签 \(item.path ?? item.title)") { send(item.id) }
            if expanded, !children.isEmpty {
                VStack(spacing: SidebarTokens.rowGap) {
                    ForEach(children) { child in
                        NativeSidebarTagBranch(item: child, tags: tags, tagIndex: tagIndex, selection: selection, border: border, radius: radius, send: { send($0) })
                    }
                }.padding(.vertical, 2).padding(.leading, SidebarTokens.indent)
                    .overlay(alignment: .leading) { Rectangle().fill(border).frame(width: 1).padding(.leading, 14) }
            }
        }
    }
}

private struct NativeSidebarIcon: View {
    let symbol: String
    @ScaledMetric(relativeTo: .body) private var size = SidebarTokens.iconSize
    init(_ symbol: String, size: CGFloat = SidebarTokens.iconSize) {
        self.symbol = symbol
        _size = ScaledMetric(wrappedValue: size, relativeTo: .body)
    }
    var body: some View {
        Image("Lucide-\(symbol)").renderingMode(.template).resizable().scaledToFit()
            .frame(width: min(size, SidebarTokens.touchTargetSize - SidebarTokens.horizontalPadding),
                   height: min(size, SidebarTokens.touchTargetSize - SidebarTokens.horizontalPadding)).accessibilityHidden(true)
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
    @ScaledMetric(relativeTo: .body) private var bodyFontSize = SidebarTokens.mobileFontSize
    @ScaledMetric(relativeTo: .body) private var iconSize = SidebarTokens.iconSize
    @ScaledMetric(relativeTo: .caption) private var captionFontSize = SidebarTokens.captionFontSize
    private var expansionWidth: CGFloat { SidebarTokens.toggleVisualSize + SidebarTokens.horizontalPadding }
    private var visualIconSize: CGFloat { min(iconSize, SidebarTokens.touchTargetSize - SidebarTokens.horizontalPadding) }
    var body: some View {
        ZStack(alignment: .trailing) {
            Button { action() } label: {
                HStack(spacing: SidebarTokens.contentGap) {
                    if let emoji = item.emoji, !emoji.isEmpty { Text(emoji).font(.system(size: visualIconSize)).frame(width: visualIconSize, height: visualIconSize) }
                    else if let icon = item.icon { NativeSidebarIcon(icon) }
                    Text(title ?? item.title).lineLimit(1).fontWeight(item.selected == true ? .medium : .regular)
                    Spacer(minLength: 0)
                    if let badge = item.badge { Text("\(badge)").font(.system(size: captionFontSize)).foregroundStyle(.secondary) }
                }.padding(.leading, SidebarTokens.horizontalPadding).padding(.trailing, expanded == nil ? SidebarTokens.horizontalPadding : expansionWidth)
                    .frame(minHeight: SidebarTokens.mobileRowMinHeight).contentShape(Rectangle())
            }
            .buttonStyle(NativeSidebarButtonStyle(selected: item.selected == true, color: selection, radius: radius))
            .disabled(item.disabled == true)
            .opacity(item.disabled == true && item.id != "calendar" ? 0.5 : 1)
            .accessibilityLabel(item.path ?? item.title)
            .accessibilityAddTraits(item.selected == true ? .isSelected : [])
            if let expanded {
                Button { expanded.wrappedValue.toggle() } label: {
                    NativeSidebarIcon("chevron.right").rotationEffect(.degrees(expanded.wrappedValue ? 90 : 0))
                        .frame(width: SidebarTokens.toggleVisualSize, height: SidebarTokens.toggleVisualSize)
                        .frame(width: SidebarTokens.touchTargetSize, height: SidebarTokens.touchTargetSize).contentShape(Rectangle())
                }.buttonStyle(.plain).padding(.trailing, (expansionWidth - SidebarTokens.touchTargetSize) / 2)
                    .accessibilityLabel(expansionLabel).accessibilityValue(expanded.wrappedValue ? "已展开" : "已收起")
            }
        }
        .font(.system(size: bodyFontSize))
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

#if DEBUG
private enum NativeSidebarPreviewData {
    enum State: String, CaseIterable, Hashable {
        case populated = "示例", loading = "加载", empty = "空态", error = "错误"
    }
    static func color(_ key: String, palette: [String: [Double]]) -> Color {
        let rgba = palette[key]!
        return Color(.sRGB, red: rgba[0] / 255, green: rgba[1] / 255, blue: rgba[2] / 255, opacity: rgba[3] / 255)
    }
    static func surfaces(palette: [String: [Double]], state: State = .populated) -> [String: NativeSurface] {
        let paths: [String] = ["产品", "产品/计划", "体验", "体验/使用指南", "体验/文本", "体验/离线",
                     "学习", "学习/swiftui", "学习/英语", "工作", "工作/复盘", "工作/记录",
                     "设计", "设计/交互", "设计/交互/侧栏", "设计/界面", "设计/一个很长的标签名称，用于验证文字截断"]
        let tags: [NativeAction] = paths.map { path in
            let title: String = path.components(separatedBy: "/").last ?? path
            let emoji: String? = path == "体验/使用指南" ? "📘" : nil
            return NativeAction(id: "tag:\(path)", title: title, icon: "number", path: path,
                                emoji: emoji, selected: path == "产品")
        }
        return ["chrome": NativeSurface(id: "chrome", instance: "sidebar-preview-chrome", kind: "chrome", title: "预览主题", palette: palette),
                "navigation": NativeSurface(
            id: "navigation", instance: "sidebar-preview", kind: "list", title: "MemoCard", presented: true,
            loading: state == .loading, error: state == .error ? "标签加载失败，请稍后重试。" : nil,
            resetKey: "sidebar-preview-\(state.rawValue)", rowRadius: Double(DesignRadius.lg),
            sections: [
                NativeSection(id: "pages", actions: [
                    NativeAction(id: "home", title: "主页", icon: "house"),
                    NativeAction(id: "notes", title: "所有笔记", icon: "note.text"),
                    NativeAction(id: "calendar", title: "日历", icon: "calendar", disabled: true),
                ]),
                NativeSection(id: "filters", actions: [
                    NativeAction(id: "filter:untagged", title: "无标签", icon: "number", badge: 6),
                    NativeAction(id: "filter:images", title: "有图片", icon: "photo", badge: 12),
                    NativeAction(id: "filter:links", title: "有链接", icon: "link", badge: 3),
                ]),
                NativeSection(id: "pinned-tags", actions: state == .populated ? tags.filter { $0.path == "体验/使用指南" } : []),
                NativeSection(id: "tags", title: "标签", actions: state == .populated ? tags : []),
                NativeSection(id: "library", actions: [NativeAction(id: "vault", title: "侧栏布局示例")]),
            ]
        )]
    }
}

#Preview("侧栏布局", traits: .fixedLayout(width: 326, height: 874)) {
    NativeNavigationSidebar(host: NativeHost(previewSurfaces: NativeSidebarPreviewData.surfaces(palette: SidebarPreviewPalette.light)))
        .preferredColorScheme(.light)
}

#Preview("侧栏 · 深色大字", traits: .fixedLayout(width: 326, height: 874)) {
    NativeNavigationSidebar(host: NativeHost(previewSurfaces: NativeSidebarPreviewData.surfaces(palette: SidebarPreviewPalette.dark)))
        .preferredColorScheme(.dark)
        .dynamicTypeSize(.accessibility5)
}

#Preview("侧栏行", traits: .fixedLayout(width: 326, height: 340)) {
    let palette = SidebarPreviewPalette.light
    let selection = NativeSidebarPreviewData.color("sidebar-accent", palette: palette)
    VStack(spacing: SidebarTokens.rowGap) {
        NativeSidebarItem(item: NativeAction(id: "home", title: "主页", icon: "house"),
                          selection: selection, radius: DesignRadius.lg) {}
        NativeSidebarItem(item: NativeAction(id: "tag:product", title: "产品", icon: "number", selected: true),
                          selection: selection, radius: DesignRadius.lg,
                          expanded: .constant(true), expansionLabel: "展开或收起产品") {}
        NativeSidebarItem(item: NativeAction(id: "tag:guide", title: "使用指南", emoji: "📘"),
                          selection: selection, radius: DesignRadius.lg) {}
        NativeSidebarItem(item: NativeAction(id: "calendar", title: "日历", icon: "calendar", disabled: true),
                          selection: selection, radius: DesignRadius.lg) {}
        NativeSidebarItem(item: NativeAction(id: "filter:images", title: "有图片", icon: "photo", badge: 12),
                          selection: selection, radius: DesignRadius.lg) {}
        NativeSidebarItem(item: NativeAction(id: "tag:long", title: "一个很长的标签名称，用于验证文字截断", icon: "number"),
                          selection: selection, radius: DesignRadius.lg,
                          expanded: .constant(false), expansionLabel: "展开或收起长标签") {}
    }
    .foregroundStyle(NativeSidebarPreviewData.color("sidebar-foreground", palette: palette))
    .padding(8)
    .background(NativeSidebarPreviewData.color("sidebar", palette: palette))
    .preferredColorScheme(.light)
}

#Preview("侧栏 · 数据状态", traits: .fixedLayout(width: 326, height: 874)) {
    @Previewable @State var state = NativeSidebarPreviewData.State.loading
    VStack(spacing: 0) {
        Picker("数据状态", selection: $state) {
            ForEach(NativeSidebarPreviewData.State.allCases, id: \.self) { state in
                Text(state.rawValue).tag(state)
            }
        }.pickerStyle(.segmented).padding(8)
        NativeNavigationSidebar(host: NativeHost(previewSurfaces: NativeSidebarPreviewData.surfaces(palette: SidebarPreviewPalette.light, state: state)))
            .id(state)
    }
    .preferredColorScheme(.light)
}

#endif

#endif
