#if os(iOS)
import SwiftUI
import ImageIO
import UIKit

/// Native presentation with the same content hierarchy as the shared mobile components.
struct NativeDesignedPanel: View {
    @ObservedObject var host: NativeHost
    @ObservedObject private var surfaceState: NativeSurfaceState
    @ObservedObject private var appearance: NativeSurfaceAppearanceState
    let id: String
    let instance: String
    @State private var snapshot: NativeSurface?
    @State private var values: [String: String] = [:]
    @State private var tagsOpen = false
    @State private var preview: NativeAction?
    @State private var searchPosition: String?
    @State private var searchFocused = false
    @State private var tagSearchFocused = false
    @State private var captureHeight: CGFloat = 224
    @State private var captureExpanded = false
    @FocusState private var focus: String?
    @GestureState private var dragOffset: CGFloat = 0
    @GestureState private var captureDrag: CGFloat = 0

    init(host: NativeHost, id: String, instance: String) {
        self.host = host; self.id = id; self.instance = instance
        surfaceState = host.nativeSurfaceStore.state(for: id)
        appearance = host.nativeSurfaceStore.appearance
        _snapshot = State(initialValue: host.nativeSurfaces[id])
        _searchPosition = State(initialValue: host.nativeSearchPosition[instance])
    }
    private var surface: NativeSurface? {
        if let current = surfaceState.surface, current.instance == instance, current.presented == true { return current }
        return snapshot
    }
    private func section(_ id: String) -> NativeSection? { surface?.sections?.first { $0.id == id } }
    private func color(_ key: String) -> Color {
        if let rgba = appearance.value.palette?[key], rgba.count == 4 {
            return Color(.sRGB, red: rgba[0] / 255, green: rgba[1] / 255, blue: rgba[2] / 255, opacity: rgba[3] / 255)
        }
        switch key {
        case "background": return Color(uiColor: .systemBackground)
        case "primary-foreground": return Color(uiColor: .systemBackground)
        case "muted-foreground", "tag-default-fg": return .secondary
        case "border": return Color(uiColor: .separator).opacity(0.3)
        case "muted", "accent", "tag-default-bg": return Color(uiColor: .secondarySystemBackground)
        default: return .primary
        }
    }
    private func send(_ action: String, _ value: String? = nil) {
        guard let surface else { return }
        host.nativeAction(surface, action, value: value)
    }
    private func binding(_ field: NativeField) -> Binding<String> {
        Binding(get: { values[field.id] ?? field.value }, set: { value in
            // Return and end-editing can resend text whose local override was already acknowledged.
            if value != (values[field.id] ?? field.value) { values[field.id] = value }
            send(field.id, value)
        })
    }
    private var query: String { section("query")?.fields?.first.map { binding($0).wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines) } ?? "" }
    private func content(extraTextHeight: CGFloat = 0) -> some View {
        VStack(spacing: 16) {
            if id == "search" {
                searchContent
            } else { captureContent(extraTextHeight: extraTextHeight) }
        }
        .foregroundStyle(color("foreground"))
        .background(color("background"))
    }

    var body: some View {
        Group {
            if id == "search" {
                content()
                    .safeAreaPadding(.bottom, host.webView?.window?.safeAreaInsets.bottom ?? 0)
                    .background(color("background"))
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 24))
                    .background {
                        UnevenRoundedRectangle(topLeadingRadius: 24, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 24)
                            .fill(color("background")).ignoresSafeArea(.keyboard, edges: .bottom)
                    }
                    .overlay(alignment: .top) {
                        Button { if searchFocused { searchFocused = false } else { send("close") } } label: {
                            Capsule().fill(.secondary.opacity(0.4)).frame(width: 36, height: 5)
                                .frame(maxWidth: .infinity).frame(height: 20).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain).accessibilityLabel(searchFocused ? "收起键盘" : "关闭搜索")
                        .simultaneousGesture(DragGesture().updating($dragOffset) { value, state, _ in state = max(0, value.translation.height) }
                            .onEnded { value in if value.translation.height > 80 || value.predictedEndTranslation.height > 160 { send("close") } })
                    }
                    .offset(y: dragOffset)
                    .animation(.easeOut(duration: 0.2), value: dragOffset == 0)
                    .accessibilityAction(.escape) { send("close") }
            } else {
                GeometryReader { geometry in
                    let compactHeight = min(captureHeight, geometry.size.height)
                    let restingHeight = captureExpanded ? geometry.size.height : compactHeight
                    let displayedHeight = min(geometry.size.height, max(compactHeight, restingHeight - captureDrag))
                    content(extraTextHeight: displayedHeight - compactHeight)
                        .frame(height: displayedHeight)
                        .clipShape(RoundedRectangle(cornerRadius: 24))
                        .overlay(RoundedRectangle(cornerRadius: 24).stroke(color("border"), lineWidth: 1))
                        .shadow(color: .black.opacity(0.12), radius: 24, y: 8)
                        .overlay(alignment: .top) {
                            Button { withAnimation(.easeOut(duration: 0.22)) { captureExpanded.toggle() } } label: {
                                Capsule().fill(.secondary.opacity(0.3)).frame(width: 36, height: 5)
                                    .frame(maxWidth: .infinity).frame(height: 20).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain).disabled(surface?.busy == true)
                            .accessibilityLabel(captureExpanded ? "收起快速记录" : "展开快速记录")
                            .accessibilityValue(captureExpanded ? "已展开" : "紧凑")
                            .accessibilityHint("轻点切换大小，向上拖动展开，向下拖动收起或关闭")
                            .accessibilityAdjustableAction { direction in
                                guard surface?.busy != true else { return }
                                withAnimation(.easeOut(duration: 0.22)) {
                                    if direction == .increment { captureExpanded = true }
                                    else if direction == .decrement { captureExpanded = false }
                                }
                            }
                            .simultaneousGesture(DragGesture().updating($captureDrag) { value, state, _ in
                                if surface?.busy != true { state = value.translation.height }
                            }.onEnded { value in
                                guard surface?.busy != true else { return }
                                withAnimation(.easeOut(duration: 0.22)) {
                                    if captureExpanded {
                                        if value.translation.height > geometry.size.height - compactHeight + 80 { send("close") }
                                        else if value.translation.height > 60 || value.predictedEndTranslation.height > 120 { captureExpanded = false }
                                    } else if value.translation.height < -60 || value.predictedEndTranslation.height < -120 {
                                        captureExpanded = true
                                    } else if value.translation.height > 80 || value.predictedEndTranslation.height > 160 { send("close") }
                                }
                            })
                        }
                        .offset(y: max(0, captureDrag - (restingHeight - compactHeight)))
                        .animation(.easeOut(duration: 0.22), value: captureDrag == 0)
                        .animation(.easeOut(duration: 0.22), value: captureExpanded)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                }
                .accessibilityAction(.escape) { if surface?.busy != true { send("close") } }
            }
        }
        .fileImporter(isPresented: $host.showPicker, allowedContentTypes: host.pickerTypes) { host.finishPicker($0) }
        .fullScreenCover(item: $preview) { item in
            if let path = item.imagePath {
                GeometryReader { geometry in
                    ZStack {
                        Color.clear.contentShape(Rectangle()).onTapGesture { preview = nil }
                        NativeAssetImage(host: host, path: path, maxPixels: 2048).scaledToFit()
                            .frame(width: geometry.size.width * 0.85, height: geometry.size.height * 0.8).onTapGesture {}
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay(alignment: .topTrailing) {
                        NativeCloseButton(label: "关闭图片", size: 44) { preview = nil }.padding(16)
                    }
                }
                .presentationBackground(.ultraThinMaterial)
            }
        }
        .onAppear { if id == "search" { searchFocused = true } else { focus = "text" } }
        .onReceive(surfaceState.$surface) { surface in
            guard let current = surface, current.instance == instance, current.presented == true else { return }
            snapshot = current
            for field in current.sections?.flatMap({ $0.fields ?? [] }) ?? [] where values[field.id] == field.value { values.removeValue(forKey: field.id) }
        }
        .onChange(of: surface?.resetKey) { values = [:] }
        .onChange(of: searchPosition) { _, value in host.nativeSearchPosition[instance] = value }
    }

    private var searchContent: some View {
        VStack(spacing: 16) {
            if let field = section("query")?.fields?.first {
                HStack(spacing: 12) {
                    NativeSearchInput(text: binding(field), prompt: field.title, accessibilityName: "搜索笔记", enabled: field.disabled != true,
                        focused: $searchFocused,
                        submit: { if let selected = surface?.sections?.flatMap({ $0.actions ?? [] }).first(where: { $0.selected == true && $0.id.hasPrefix("note:") }) { send(selected.id) } },
                        move: { send($0 < 0 ? "up" : "down") })
                        .frame(height: 44)
                    NativeCloseButton(label: "退出搜索", size: 44) { send("close") }
                }
                .padding(.horizontal, 16).padding(.top, 24)
            }
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        Color.clear.frame(height: 0).id("top")
                        if let message = surface?.message {
                            VStack(spacing: 12) {
                                if surface?.loading == true { ProgressView() }
                                Text(message).font(.system(size: 14)).foregroundStyle(color("muted-foreground"))
                                if !query.isEmpty && surface?.loading != true { Text("试试其他关键词，搜索标题或正文。").font(.system(size: 12)).foregroundStyle(color("muted-foreground")) }
                            }.frame(maxWidth: .infinity).padding(.vertical, 40)
                        }
                        ForEach(Array((surface?.sections ?? []).filter { $0.id != "query" && $0.id != "more" }.enumerated()), id: \.element.id) { index, group in
                            if let title = group.title { Text(title).font(.system(size: 12, weight: .medium)).foregroundStyle(color("muted-foreground")).frame(height: 16).padding(.horizontal, 12).padding(.top, index == 0 ? 12 : 20).padding(.bottom, 8) }
                            ForEach(group.actions ?? []) { item in
                                Button { send(item.id) } label: {
                                    highlighted(item.title).font(.system(size: 14, weight: .medium)).lineLimit(1)
                                        .frame(height: 20)
                                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 12).padding(.vertical, 10)
                                        .background(item.selected == true ? color("accent") : .clear, in: RoundedRectangle(cornerRadius: 8))
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain).disabled(item.disabled == true).id(item.id)
                                .accessibilityLabel(item.title).accessibilityAddTraits(item.selected == true ? .isSelected : [])
                            }
                        }
                        if let error = surface?.error, !error.isEmpty {
                            Text(error).font(.system(size: 14)).foregroundStyle(.red).padding(12)
                        }
                        ForEach((section("more")?.actions ?? []).filter { $0.id == "more" || $0.id == "retry" }) { item in
                            Button(item.title) { send(item.id) }.disabled(item.disabled == true)
                                .font(.system(size: 14)).frame(maxWidth: .infinity).padding(12)
                        }
                        if let message = section("more")?.message { Text(message).font(.system(size: 12)).foregroundStyle(color("muted-foreground")).padding(12) }
                    }
                    .scrollTargetLayout().padding(.vertical, 8)
                }
                .scrollPosition(id: $searchPosition, anchor: .top)
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: query) { searchPosition = nil; proxy.scrollTo("top", anchor: .top) }
                .onChange(of: surface?.sections?.flatMap { $0.actions ?? [] }.first { $0.selected == true && $0.id.hasPrefix("note:") }?.id) { previous, selected in
                    if previous != nil, let selected { proxy.scrollTo(selected, anchor: .center) }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func highlighted(_ title: String) -> Text {
        var text = AttributedString(title)
        if !query.isEmpty, let range = text.range(of: query, options: .caseInsensitive) { text[range].backgroundColor = color("primary").opacity(0.15) }
        return Text(text)
    }

    private func captureContent(extraTextHeight: CGFloat) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    if let field = section("text")?.fields?.first {
                        TextEditor(text: binding(field)).font(.system(size: 16)).lineSpacing(6)
                            .scrollContentBackground(.hidden).padding(.horizontal, 11).padding(.vertical, 8).frame(height: 160 + extraTextHeight)
                            .overlay(alignment: .topLeading) {
                                if binding(field).wrappedValue.isEmpty { Text(field.title).font(.system(size: 16)).foregroundStyle(color("muted-foreground")).padding(16).allowsHitTesting(false) }
                            }
                            .focused($focus, equals: "text").disabled(field.disabled == true).accessibilityLabel("快速输入内容")
                            .padding(.top, 12)
                    }
                    if let images = section("images")?.actions?.filter({ $0.imagePath != nil }), !images.isEmpty {
                        NativeTagFlow(spacing: 8) {
                            ForEach(images) { item in
                                if let path = item.imagePath {
                                    Button { focus = nil; preview = item } label: {
                                        NativeAssetImage(host: host, path: path, maxPixels: 240).scaledToFill().frame(width: 80, height: 80)
                                            .clipped().clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                    .buttonStyle(.plain).accessibilityLabel(item.title.replacingOccurrences(of: "移除", with: "预览"))
                                    .overlay(alignment: .topTrailing) {
                                        Button { send(item.id) } label: {
                                            Image(systemName: "xmark").font(.system(size: 12)).frame(width: 24, height: 24)
                                                .background(color("muted"), in: RoundedRectangle(cornerRadius: 6))
                                        }
                                        .buttonStyle(.plain).accessibilityLabel(item.title).disabled(item.disabled == true).padding(3)
                                    }
                                }
                            }
                        }.padding(.horizontal, 16).padding(.bottom, 12)
                    }
                    if let tags = section("selected-tags")?.actions, !tags.isEmpty {
                        NativeTagFlow(spacing: 6) {
                            ForEach(tags) { item in
                                Button { send(item.id) } label: {
                                    HStack(spacing: 4) { Text(item.title); Image(systemName: "xmark").font(.system(size: 10)) }
                                        .font(.system(size: 14)).padding(.horizontal, 6).frame(minHeight: 20)
                                        .foregroundStyle(color("tag-\(item.color ?? "default")-fg"))
                                        .background(color("tag-\(item.color ?? "default")-bg"), in: Capsule())
                                }.buttonStyle(.plain).disabled(item.disabled == true).accessibilityLabel("移除标签 \(item.title)")
                            }
                        }.padding(.horizontal, 16).padding(.bottom, 12)
                    }
                    HStack(spacing: 4) {
                        Button { focus = nil; tagsOpen = true } label: { Image(systemName: "number").font(.system(size: 20)).frame(width: 44, height: 44).contentShape(Rectangle()) }
                            .accessibilityLabel("选择标签").disabled(section("tags")?.fields?.first?.disabled == true)
                            .popover(isPresented: $tagsOpen, arrowEdge: .bottom) { tagPicker.presentationCompactAdaptation(.popover) }
                        if let add = section("images")?.actions?.first(where: { $0.id == "image" }) {
                            Button { focus = nil; send(add.id) } label: { Image(systemName: "photo.badge.plus").font(.system(size: 20)).frame(width: 44, height: 44).contentShape(Rectangle()) }
                                .accessibilityLabel(add.title).disabled(add.disabled == true)
                        }
                        if let actions = section("more")?.actions, !actions.isEmpty {
                            Menu {
                                ForEach(actions) { item in
                                    Button { focus = nil; send(item.id) } label: {
                                        Label(item.title, systemImage: item.id == "continue" ? "arrow.up.right" : item.id == "drafts" ? "folder" : "arrow.clockwise")
                                    }.disabled(item.disabled == true)
                                }
                            } label: { Image(systemName: "ellipsis").font(.system(size: 20)).frame(width: 44, height: 44) }
                            .accessibilityLabel("更多记录操作").disabled(surface?.busy == true)
                        }
                        Spacer(minLength: 4)
                        if let record = surface?.primary {
                            Button { send(record.id) } label: {
                                HStack(spacing: 4) {
                                    if surface?.busy == true { ProgressView().tint(color("primary-foreground")) } else { Image(systemName: "arrow.up") }
                                    Text(record.title)
                                }
                                .font(.system(size: 14, weight: .medium)).padding(.horizontal, 12).frame(height: 32)
                                .foregroundStyle(color("primary-foreground")).background(color("primary"), in: Capsule())
                                .opacity(record.disabled == true ? 0.4 : 1)
                            }.disabled(record.disabled == true).accessibilityLabel(record.title)
                                .keyboardShortcut(.return, modifiers: .command)
                        }
                    }
                    .buttonStyle(.plain).foregroundStyle(color("muted-foreground")).padding(.horizontal, 8)
                }
                if let error = surface?.error, !error.isEmpty { Text(error).font(.system(size: 13)).foregroundStyle(.red).padding(.horizontal, 8) }
            }
            .padding(.bottom, 8)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                let compactHeight = height - extraTextHeight
                if compactHeight > 0 && abs(captureHeight - compactHeight) > 0.5 { captureHeight = compactHeight }
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var tagPicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let field = section("tags")?.fields?.first {
                NativeSearchInput(text: binding(field), prompt: field.title, accessibilityName: field.title, enabled: field.disabled != true,
                    focused: $tagSearchFocused, submit: {}, move: { _ in })
                    .frame(height: 44).padding([.top, .horizontal], 6)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(section("tags")?.actions ?? []) { item in
                        Button { send(item.id) } label: {
                            HStack {
                                if item.id != "new-tag" { Image(systemName: "number") }
                                Text(item.title).frame(maxWidth: .infinity, alignment: .leading)
                                if item.selected == true { Image(systemName: "checkmark") }
                            }.font(.system(size: 14)).padding(8).contentShape(Rectangle())
                        }.buttonStyle(.plain).disabled(item.disabled == true).accessibilityAddTraits(item.selected == true ? .isSelected : [])
                    }
                    if let message = section("tags")?.message { Text(message).font(.system(size: 12)).foregroundStyle(color("muted-foreground")).padding(8) }
                }
            }.frame(maxHeight: 240)
        }
        .foregroundStyle(color("foreground")).padding(6).frame(width: 220)
        .onAppear { tagSearchFocused = true }
        .onDisappear { tagSearchFocused = false }
    }
}

private struct NativeSearchInput: UIViewRepresentable {
    @Binding var text: String
    let prompt: String
    let accessibilityName: String
    let enabled: Bool
    @Binding var focused: Bool
    let submit: () -> Void
    let move: (Int) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }
    func makeUIView(context: Context) -> SearchField {
        let field = SearchField()
        field.delegate = context.coordinator
        field.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .editingChanged)
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.returnKeyType = .search
        field.clearButtonMode = .whileEditing
        field.accessibilityLabel = accessibilityName
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        return field
    }
    func updateUIView(_ field: SearchField, context: Context) {
        context.coordinator.parent = self
        if field.markedTextRange == nil, field.text != text { field.text = text }
        field.placeholder = prompt
        field.isEnabled = enabled
        field.move = move
        field.wantsFocus = focused && enabled
        if field.window != nil {
            if field.wantsFocus && !field.isFirstResponder { field.requestFocus() }
            else if !field.wantsFocus && field.isFirstResponder { field.resignFirstResponder() }
        }
    }
    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: NativeSearchInput
        init(_ parent: NativeSearchInput) { self.parent = parent }
        @objc func changed(_ field: UITextField) {
            if field.markedTextRange == nil { parent.text = field.text ?? "" }
        }
        func textFieldShouldClear(_ textField: UITextField) -> Bool { parent.text = ""; return true }
        func textFieldShouldReturn(_ textField: UITextField) -> Bool { changed(textField); parent.submit(); return false }
        func textFieldDidBeginEditing(_ textField: UITextField) { if !parent.focused { parent.focused = true } }
        func textFieldDidEndEditing(_ textField: UITextField) { changed(textField); if parent.focused { parent.focused = false } }
    }
    final class SearchField: UISearchTextField {
        var wantsFocus = false
        var move: ((Int) -> Void)?
        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window != nil && wantsFocus { requestFocus() }
        }
        func requestFocus() {
            DispatchQueue.main.async { [weak self] in
                guard let self, self.window != nil, self.wantsFocus, !self.isFirstResponder else { return }
                self.becomeFirstResponder()
            }
        }
        override var keyCommands: [UIKeyCommand]? {
            (super.keyCommands ?? []) + [
                UIKeyCommand(input: UIKeyCommand.inputUpArrow, modifierFlags: [], action: #selector(previousResult)),
                UIKeyCommand(input: UIKeyCommand.inputDownArrow, modifierFlags: [], action: #selector(nextResult)),
            ]
        }
        @objc private func previousResult() { if markedTextRange == nil { move?(-1) } }
        @objc private func nextResult() { if markedTextRange == nil { move?(1) } }
    }
}

/// Wraps selected tag pills and attachments at their intrinsic widths, as in the shared UI.
private struct NativeTagFlow: Layout {
    var spacing: CGFloat
    private func positions(_ width: CGFloat, _ subviews: Subviews) -> ([CGPoint], CGSize) {
        var points: [CGPoint] = [], x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(ProposedViewSize(width: width, height: nil))
            if x > 0 && x + size.width > width { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            points.append(CGPoint(x: x, y: y)); x += size.width + spacing; rowHeight = max(rowHeight, size.height)
        }
        return (points, CGSize(width: width, height: y + rowHeight))
    }
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize { positions(proposal.width ?? 300, subviews).1 }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let points = positions(bounds.width, subviews).0
        for (index, view) in subviews.enumerated() { view.place(at: CGPoint(x: bounds.minX + points[index].x, y: bounds.minY + points[index].y), proposal: ProposedViewSize(width: bounds.width, height: nil)) }
    }
}

private struct NativeAssetImage: View {
    let host: NativeHost
    let path: String
    let maxPixels: Int
    @State private var thumbnail: UIImage?
    var body: some View {
        Group {
            if let thumbnail { Image(uiImage: thumbnail).resizable() }
            else { Image(systemName: "photo").resizable().scaledToFit().foregroundStyle(.secondary) }
        }
        .task(id: path) {
            thumbnail = nil
            #if DEBUG
            var bytes = host.previewAssets[path]
            if bytes == nil && !host.isPreview { bytes = try? await host.store.asset(relativePath: path) }
            guard let data = bytes else { return }
            #else
            guard let data = try? await host.store.asset(relativePath: path) else { return }
            #endif
            let pixels = maxPixels
            let cgImage = await Task.detached(priority: .userInitiated) {
                guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil as CGImage? }
                return CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: pixels, kCGImageSourceCreateThumbnailWithTransform: true] as CFDictionary)
            }.value
            if !Task.isCancelled, let cgImage { thumbnail = UIImage(cgImage: cgImage) }
        }
    }
}
#endif
