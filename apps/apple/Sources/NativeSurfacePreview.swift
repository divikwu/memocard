#if DEBUG && os(iOS)
import SwiftUI
import UIKit

/// A bounded, in-memory producer for the real native surfaces. No vault or WebView.
@MainActor
final class NativeSurfacePreviewModel: ObservableObject {
    enum Kind: String { case search, capture }
    enum Scenario: String, CaseIterable, Identifiable {
        case recent = "Recent", results = "Results", loading = "Loading", empty = "Empty", errorRetry = "ErrorRetry", pagination = "Pagination"
        case defaultState = "Default", populated = "Populated", busy = "Busy", draftRestored = "DraftRestored", attachments = "Attachments"
        var id: String { rawValue }
    }
    let kind: Kind
    let host: NativeHost
    @Published private(set) var scenario: Scenario
    @Published private(set) var feedback = "隔离示例：不会修改笔记库"
    @Published var failNextSave = false
    private var query = ""
    private var text = ""
    private var tagQuery = ""
    private var tags: [String] = []
    private var createdTags: [String] = []
    private var images: [String] = []
    private var pageSize = 1
    private var selected = 0
    private var generation = 0
    private var reset = 0
    private var task: Task<Void, Never>?
    var pendingWork: Task<Void, Never>? { task }
    private var disposed = false
    private let notes = [("guide", "产品侧栏使用指南"), ("plan", "产品计划与标签整理：一个用于检查换行和截断的较长标题")]
    private let knownTags = ["产品", "体验/使用指南", "工作/一个较长的标签名称"]
    private(set) var acceptedActions = 0
    var scenarios: [Scenario] {
        kind == .search ? [.recent, .results, .loading, .empty, .errorRetry, .pagination] : [.defaultState, .populated, .busy, .errorRetry, .draftRestored, .attachments]
    }
    var surface: NativeSurface { host.nativeSurfaces[kind.rawValue]! }

    init(kind: Kind, scenario: Scenario? = nil, dark: Bool = false) {
        self.kind = kind; self.scenario = scenario ?? (kind == .search ? .recent : .defaultState)
        host = NativeHost(previewSurfaces: ["chrome": NativeSurface(id: "chrome", instance: "preview-theme", kind: "chrome", title: "Preview", theme: dark ? "dark" : "light", palette: dark ? SidebarPreviewPalette.dark : SidebarPreviewPalette.light)])
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let image = UIGraphicsImageRenderer(size: CGSize(width: 128, height: 96), format: format).image { context in
            UIColor.systemTeal.setFill(); context.fill(CGRect(x: 0, y: 0, width: 128, height: 96))
            UIImage(systemName: "note.text")?.withTintColor(.white, renderingMode: .alwaysOriginal).draw(in: CGRect(x: 44, y: 28, width: 40, height: 40))
        }
        host.previewAssets["preview-note.png"] = image.pngData()
        host.previewAction = { [weak self] surface, action, value in self?.receive(surface, action, value) }
        select(self.scenario)
    }

    func select(_ scenario: Scenario) {
        task?.cancel(); generation += 1; reset += 1
        disposed = false
        self.scenario = scenario
        query = kind == .search && scenario != .recent ? (scenario == .empty ? "未匹配的词" : "产品") : ""
        text = kind == .capture && scenario != .defaultState ? "记录一个关于产品侧栏的想法。" : ""
        tagQuery = ""; createdTags = []; tags = [.populated, .draftRestored].contains(scenario) ? [knownTags[1], knownTags[2]] : []
        images = scenario == .attachments ? ["preview-note.png"] : []
        pageSize = scenario == .pagination ? 1 : notes.count; selected = 0; failNextSave = false
        feedback = scenario == .draftRestored ? "已恢复示例草稿（内存）" : "场景：\(scenario.rawValue)"
        publish(presented: true, loading: scenario == .loading, busy: scenario == .busy,
                error: scenario == .errorRetry ? "示例请求失败，请重试。" : nil)
    }

    func dispose() { task?.cancel(); task = nil; generation += 1; disposed = true }
    func resume() { if disposed { select(scenario) } }

    func reopen() {
        task?.cancel(); task = nil; generation += 1
        disposed = false
        reset += 1; feedback = "已重新打开"
        publish(presented: true)
    }

    private func publish(presented: Bool? = nil, loading: Bool = false, busy: Bool = false, error: String? = nil) {
        let open = presented ?? host.nativeSurfaces[kind.rawValue]?.presented ?? true
        var surface = NativeSurface(id: kind.rawValue, instance: "preview-\(kind.rawValue)-\(generation)", kind: kind.rawValue,
                                    title: kind == .search ? "搜索笔记" : "快速记录", presented: open, busy: busy, loading: loading,
                                    error: error, resetKey: "preview-reset-\(reset)")
        if kind == .search {
            let matches = notes.filter { query.isEmpty || $0.1.localizedCaseInsensitiveContains(query) }
            let visible = Array(matches.prefix(pageSize))
            let canMove = !loading && error == nil && !visible.isEmpty
            surface.message = loading ? "正在搜索笔记…" : visible.isEmpty ? (query.isEmpty ? "输入关键词搜索示例笔记" : "没有找到相关笔记") : nil
            surface.sections = [NativeSection(id: "query", fields: [NativeField(id: "query", title: "在预览笔记库中搜索…", value: query)]),
                NativeSection(id: "results", title: query.isEmpty ? "最近笔记" : "笔记", actions: loading || error != nil ? [] : visible.enumerated().map { index, note in
                    NativeAction(id: "note:\(note.0)", title: note.1, selected: index == selected)
                }),
                NativeSection(id: "more", actions: (error != nil ? [NativeAction(id: "retry", title: "重试")] : pageSize < matches.count ? [NativeAction(id: "more", title: loading ? "正在加载…" : "加载更多结果", disabled: loading)] : []) + [
                    NativeAction(id: "up", title: "上一条", disabled: !canMove),
                    NativeAction(id: "down", title: "下一条", disabled: !canMove)])]
        } else {
            let availableTags = knownTags + createdTags
            surface.summary = text.isEmpty && images.isEmpty ? nil : "继续未完成的记录…"
            surface.primary = NativeAction(id: "record", title: busy ? "处理中" : "记录", disabled: busy || (text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && images.isEmpty))
            surface.sections = [NativeSection(id: "text", fields: [NativeField(id: "text", title: "记下此刻的想法…", value: text, kind: "multiline", disabled: busy)]),
                NativeSection(id: "selected-tags", actions: tags.map { NativeAction(id: "tag:\($0)", title: $0, color: "blue", disabled: busy) }),
                NativeSection(id: "tags", actions: availableTags.filter { tagQuery.isEmpty || $0.localizedCaseInsensitiveContains(tagQuery) }.map {
                    NativeAction(id: "tag:\($0)", title: $0, disabled: busy, selected: tags.contains($0))
                } + (!tagQuery.isEmpty && !availableTags.contains(tagQuery) ? [NativeAction(id: "new-tag", title: "新建标签 \(tagQuery)", disabled: busy)] : []),
                    fields: [NativeField(id: "tag-query", title: "搜索或新建标签", value: tagQuery, disabled: busy)]),
                NativeSection(id: "images", actions: [NativeAction(id: "image", title: "添加图片", disabled: busy)] + images.enumerated().map {
                    NativeAction(id: "remove-image:\($0.element)", title: "移除图片 \($0.offset + 1)", imagePath: $0.element, disabled: busy)
                }),
                NativeSection(id: "more", actions: [])]
        }
        host.nativeSurfaceStore.update(surface)
    }

    private func receive(_ surface: NativeSurface, _ action: String, _ value: String?) {
        guard !disposed else { return }
        acceptedActions += 1
        if kind == .capture && surface.busy == true { return }
        if action == "close" {
            task?.cancel(); feedback = "已关闭\(surface.title)"; publish(presented: false); return
        }
        if kind == .search {
            switch action {
            case "query":
                guard (value ?? "") != query else { return }
                query = value ?? ""; selected = 0; pageSize = scenario == .pagination ? 1 : notes.count; loadSearch()
            case "retry": loadSearch()
            case "more": pageSize = notes.count; loadSearch()
            case "up", "down":
                let count = min(pageSize, notes.filter { query.isEmpty || $0.1.localizedCaseInsensitiveContains(query) }.count)
                selected = min(max(0, selected + (action == "up" ? -1 : 1)), max(0, count - 1)); publish()
            default:
                if action.hasPrefix("note:") { feedback = "已选择：\(surface.sections?.flatMap { $0.actions ?? [] }.first { $0.id == action }?.title ?? action)"; publish(presented: false) }
            }
        } else {
            switch action {
            case "text": guard (value ?? "") != text else { return }; text = value ?? ""; publish()
            case "tag-query": guard (value ?? "") != tagQuery else { return }; tagQuery = value ?? ""; publish()
            case "new-tag":
                if !tagQuery.isEmpty { createdTags.append(tagQuery); tags.append(tagQuery); tagQuery = "" }
                publish()
            case "image": images = ["preview-note.png"]; publish()
            case "record": saveCapture()
            default:
                if action.hasPrefix("tag:") {
                    let tag = String(action.dropFirst(4))
                    if tags.contains(tag) { tags.removeAll { $0 == tag } } else { tags.append(tag) }
                } else if action.hasPrefix("remove-image:") { images.removeAll { $0 == String(action.dropFirst(13)) } }
                publish()
            }
        }
    }

    private func loadSearch() {
        task?.cancel(); publish(loading: !query.isEmpty)
        let generation = generation
        task = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(200)) } catch { return }
            guard let self, self.generation == generation else { return }
            self.feedback = self.query.isEmpty ? "搜索已清空" : "搜索已更新"
            self.publish()
        }
    }

    private func saveCapture() {
        task?.cancel(); let shouldFail = failNextSave; failNextSave = false
        publish(busy: true); feedback = "正在保存示例…"
        let generation = generation
        task = Task { [weak self] in
            do { try await Task.sleep(for: .milliseconds(300)) } catch { return }
            guard let self, self.generation == generation else { return }
            if shouldFail { self.feedback = "保存失败，内容已保留"; self.publish(error: "示例保存失败，请重试。") }
            else {
                self.text = ""; self.tagQuery = ""; self.tags = []; self.images = []; self.reset += 1
                self.feedback = "记录成功（仅预览）"; self.publish(presented: false)
            }
        }
    }
}
#endif
