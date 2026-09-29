import Foundation
import SwiftUI
import WebKit
import UniformTypeIdentifiers
import MemoCardCore
#if os(macOS)
import AppKit
#else
import UIKit
#endif

@MainActor
final class NativeHost: ObservableObject {
    @Published var showPicker = false
    var pickerTypes: [UTType] = [.folder]
    private var pickerContinuation: CheckedContinuation<URL, Error>?
    private let core: Result<VaultStore, Error>
    var store: VaultStore { get throws { try core.get() } }
    weak var webView: WKWebView?
    private var vaultURL: URL?
    private var configURL: URL?
    private var server: LocalReadServer?
    private var startingServer: LocalReadServer?
    private var activeMCP: MCPBinding?
    private var mcpGeneration = UUID()
    private var vaultGeneration = UUID()
    private var vaultID: String?
    private var openingVault = false
    private var selectingVault = false
    private var uiReady = false
    private var pendingNoteURL: URL?
    private var presenter: VaultPresenter?
    private var startTask: Task<Void, Never>?
    private var startupError: Error?
    private let defaults = UserDefaults.standard
    private let readOperations: Set<String> = ["getStatus", "queryNotes", "getNote", "listTags"]
    private struct MCPBinding: Equatable {
        let generation: UUID
        let vaultGeneration: UUID
        let vaultID: String
        let instanceID: String
    }

    init() {
        let local = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("MemoCard", isDirectory: true)
        core = Result { try VaultStore(localDataURL: local) }
        startTask = Task { [weak self] in
            guard let self, let bookmark = defaults.data(forKey: "vaultBookmark") else { return }
            let generation = beginVaultOpen()
            var restored: URL?
            do {
                let url = try restore(bookmark)
                restored = url
                try await store.open(url: url, create: false, binding: generation)
                let info = try await coreStatus()
                guard vaultGeneration == generation else { throw fault("CANCELLED", "笔记库选择已变化") }
                guard let id = info["vaultId"] as? String else { throw fault("STORE_UNAVAILABLE", "笔记库身份不可用") }
                vaultURL = url; vaultID = id; openingVault = false
                restored = nil
                watch(url)
                #if os(macOS)
                if defaults.bool(forKey: "mcpEnabled") { try? await enableServer(allowPicker: false) }
                #endif
            } catch {
                restored?.stopAccessingSecurityScopedResource()
                if vaultGeneration == generation { startupError = error; openingVault = false }
            }
        }
    }

    var platform: String {
        #if os(macOS)
        return "mac"
        #else
        return "ios"
        #endif
    }
    var hostCapabilities: [String] {
        var operations = ["selectVault", "pickImage", "openExternal", "uiReady"]
        #if os(macOS)
        operations += ["setMCPEnabled", "openWeb"]
        #endif
        return operations
    }

    func handle(_ request: [String: Any]) async -> [String: Any] {
        do {
            guard request["version"] as? Int == 1, request["requestId"] as? String != nil,
                  let operation = request["operation"] as? String,
                  let params = request["params"] as? [String: Any] else { throw fault("INVALID_ARGUMENT", "请求格式不正确") }
            await startTask?.value
            let data: Any
            switch operation {
            case "getEnvironment": data = ["platform": platform, "phase": "M1", "storage": "native", "mcpEnabled": server != nil, "capabilities": hostCapabilities]
            case "uiReady":
                uiReady = true
                await deliverPendingNote()
                data = ["ready": true]
            case "selectVault":
                guard !selectingVault else { throw fault("BUSY", "请先完成当前笔记库选择") }
                selectingVault = true
                defer { selectingVault = false }
                let create = params["create"] as? Bool ?? false
                guard !create || platform == "mac" else { throw fault("INVALID_ARGUMENT", "请先在 Mac 创建笔记库") }
                let url = try await pick(types: [.folder], title: create ? "选择用于创建测试笔记库的空文件夹" : "选择 MemoCard 笔记库", createDirectories: create)
                let bookmark = try authorize(url)
                let generation = beginVaultOpen()
                defaults.removeObject(forKey: "vaultBookmark")
                do {
                    try await store.open(url: url, create: create, binding: generation)
                    let info = try await coreStatus()
                    guard vaultGeneration == generation else { throw fault("CANCELLED", "笔记库选择已变化") }
                    guard let id = info["vaultId"] as? String else { throw fault("STORE_UNAVAILABLE", "笔记库身份不可用") }
                    vaultURL = url; vaultID = id; openingVault = false
                } catch {
                    url.stopAccessingSecurityScopedResource()
                    if vaultGeneration == generation { startupError = error; openingVault = false }
                    throw error
                }
                defaults.set(bookmark, forKey: "vaultBookmark")
                startupError = nil
                watch(url)
                #if os(macOS)
                if defaults.bool(forKey: "mcpEnabled") { try? await enableServer(allowPicker: false) }
                #endif
                data = try await status()
                await deliverPendingNote()
                notify("statusChanged")
            case "getStatus": data = try await status()
            case "pickImage":
                guard vaultURL != nil, !openingVault else { throw fault("STORE_UNAVAILABLE", "请先选择笔记库") }
                let generation = vaultGeneration
                let url = try await pick(types: [.png, .jpeg, .gif, .webP, .heic, .heif], title: "选择图片")
                guard generation == vaultGeneration, !openingVault else { throw fault("CANCELLED", "笔记库已变化，请重新选择图片") }
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                let imageData = try await Self.readImage(url)
                guard generation == vaultGeneration, !openingVault else { throw fault("CANCELLED", "笔记库已变化，请重新选择图片") }
                var attachment: [String: Any] = ["name": url.lastPathComponent, "base64": imageData.base64EncodedString()]
                if let noteID = params["noteId"] { attachment["noteId"] = noteID }
                if let notePath = params["notePath"] { attachment["notePath"] = notePath }
                data = try await invoke("importAttachment", attachment)
            case "setMCPEnabled":
                #if os(macOS)
                let enabled = params["enabled"] as? Bool == true
                defaults.set(enabled, forKey: "mcpEnabled")
                if enabled { try await enableServer(allowPicker: true) } else { stopServer() }
                data = ["enabled": server != nil]
                notify("statusChanged")
                #else
                throw fault("INVALID_ARGUMENT", "MCP 只在 Mac 上提供")
                #endif
            case "openWeb":
                #if os(macOS)
                try await openLocalWebService()
                data = ["opened": true]
                #else
                throw fault("INVALID_ARGUMENT", "本机 Web 只在 Mac 上提供")
                #endif
            case "openExternal":
                guard let raw = params["url"] as? String, let url = URL(string: raw), ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") else { throw fault("INVALID_ARGUMENT", "不支持此链接") }
                #if os(macOS)
                NSWorkspace.shared.open(url)
                #else
                await UIApplication.shared.open(url)
                #endif
                data = ["opened": true]
            default:
                data = try await invoke(operation, params)
                if ["saveNote", "importAttachment"].contains(operation) { notify("notesChanged") }
            }
            return ["ok": true, "data": data]
        } catch { return failure(error) }
    }

    func invoke(_ operation: String, _ params: [String: Any], expectedBinding: UUID? = nil) async throws -> Any {
        guard !openingVault else { throw fault("BUSY", "正在打开笔记库，请稍后重试") }
        if let startupError { throw fault("STORE_UNAVAILABLE", "笔记库授权无法恢复，请重新选择。\(startupError.localizedDescription)") }
        let encoded = try JSONSerialization.data(withJSONObject: params)
        return try JSONSerialization.jsonObject(with: await store.perform(operation: operation, params: encoded, expectedBinding: expectedBinding))
    }
    private func coreStatus() async throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: await store.perform(operation: "getStatus", params: Data("{}".utf8))) as? [String: Any] ?? [:]
    }
    private func beginVaultOpen() -> UUID {
        // Revoke the network capability synchronously, before yielding to the core actor.
        vaultGeneration = UUID()
        openingVault = true
        vaultID = nil
        startupError = nil
        stopServer()
        if let presenter { NSFileCoordinator.removeFilePresenter(presenter); self.presenter = nil }
        vaultURL?.stopAccessingSecurityScopedResource()
        vaultURL = nil
        return vaultGeneration
    }
    func status() async throws -> [String: Any] {
        var value = (try await invoke("getStatus", [:])) as? [String: Any] ?? [:]
        value["capabilities"] = (value["capabilities"] as? [String] ?? []) + hostCapabilities
        value["mcpEnabled"] = server != nil
        return value
    }
    func failure(_ error: Error) -> [String: Any] {
        if let e = error as? VaultError { return ["ok": false, "error": ["code": e.code, "message": e.message, "retryable": e.retryable]] }
        let e = error as NSError
        if ["INVALID_ARGUMENT", "UNAUTHORIZED", "NOT_FOUND", "CANCELLED", "BUSY", "STORE_UNAVAILABLE"].contains(e.domain) {
            return ["ok": false, "error": ["code": e.domain, "message": e.localizedDescription, "retryable": e.domain == "STORE_UNAVAILABLE" || e.domain == "BUSY"]]
        }
        return ["ok": false, "error": ["code": "STORE_UNAVAILABLE", "message": error.localizedDescription, "retryable": true]]
    }
    func fault(_ code: String, _ message: String) -> NSError { NSError(domain: code, code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

    func notify(_ type: String) {
        webView?.callAsyncJavaScript("window.dispatchEvent(new CustomEvent('memocard:event', {detail: detail}))", arguments: ["detail": ["type": type]], in: nil, in: .page, completionHandler: nil)
    }
    func openNote(_ url: URL) {
        #if os(macOS)
        if url.scheme == "memocard", url.host == "web", url.path.isEmpty || url.path == "/" {
            Task {
                await startTask?.value
                do { try await openLocalWebService() }
                catch {
                    NSApp.activate(ignoringOtherApps: true)
                    let alert = NSAlert()
                    alert.messageText = "暂时无法打开本机 Web"
                    alert.informativeText = error.localizedDescription
                    alert.addButton(withTitle: "好")
                    alert.runModal()
                }
            }
            return
        }
        #endif
        guard url.scheme == "memocard", url.host == "note", let id = url.pathComponents.last, UUID(uuidString: id) != nil else { return }
        pendingNoteURL = url
        Task {
            await startTask?.value
            await deliverPendingNote()
        }
    }
    func webContentWillLoad() { uiReady = false }
    private func deliverPendingNote() async {
        guard uiReady, !openingVault, let url = pendingNoteURL, let webView else { return }
        let generation = vaultGeneration
        let linkedVault = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "vault" })?.value
        guard let current = try? await status(), let currentID = current["vaultId"] as? String,
              currentID == linkedVault, uiReady, !openingVault, generation == vaultGeneration,
              pendingNoteURL == url, let id = url.pathComponents.last else { return }
        webView.callAsyncJavaScript("window.dispatchEvent(new CustomEvent('memocard:open-note', {detail: {id}}))", arguments: ["id": id], in: nil, in: .page) { [weak self] result in
            guard case .success = result, let self, self.pendingNoteURL == url,
                  self.vaultGeneration == generation, self.uiReady else { return }
            self.pendingNoteURL = nil
        }
    }
    private func watch(_ url: URL) {
        if let presenter { NSFileCoordinator.removeFilePresenter(presenter) }
        let watcher = VaultPresenter(url: url) { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                if let store = try? self.store { await store.invalidateSnapshot() }
                self.notify("notesChanged")
            }
        }
        presenter = watcher
        NSFileCoordinator.addFilePresenter(watcher)
    }

    #if os(macOS)
    private func openLocalWebService() async throws {
        let command = URL(string: "memocard-service://open-web")!
        guard NSWorkspace.shared.open(command) else {
            throw fault("STORE_UNAVAILABLE", "无法打开 MemoCard 本机服务，请确认已完成安装")
        }
    }
    #endif
    private func authorize(_ url: URL) throws -> Data {
        guard url.startAccessingSecurityScopedResource() else { throw fault("UNAUTHORIZED", "无法访问所选文件夹，请重新授权") }
        do {
            #if os(macOS)
            return try url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil)
            #else
            return try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
            #endif
        } catch { url.stopAccessingSecurityScopedResource(); throw error }
    }
    private func restore(_ bookmark: Data) throws -> URL {
        var stale = false
        #if os(macOS)
        let url = try URL(resolvingBookmarkData: bookmark, options: [.withSecurityScope, .withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale)
        #else
        let url = try URL(resolvingBookmarkData: bookmark, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &stale)
        #endif
        guard !stale, url.startAccessingSecurityScopedResource() else { throw fault("UNAUTHORIZED", "文件夹授权已失效") }
        return url
    }
    private func pick(types: [UTType], title: String, createDirectories: Bool = false) async throws -> URL {
        #if os(macOS)
        return try await withCheckedThrowingContinuation { continuation in
            let panel = NSOpenPanel()
            panel.title = title; panel.canChooseDirectories = types.contains(.folder); panel.canChooseFiles = !panel.canChooseDirectories
            panel.canCreateDirectories = createDirectories; panel.allowsMultipleSelection = false
            if !panel.canChooseDirectories { panel.allowedContentTypes = types }
            panel.begin { response in
                if response == .OK, let url = panel.url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: NSError(domain: "CANCELLED", code: 0, userInfo: [NSLocalizedDescriptionKey: "已取消选择"])) }
            }
        }
        #else
        guard pickerContinuation == nil else { throw fault("BUSY", "请先完成当前选择") }
        return try await withCheckedThrowingContinuation { continuation in
            pickerTypes = types; pickerContinuation = continuation; showPicker = true
        }
        #endif
    }
    func finishPicker(_ result: Result<URL, Error>) { pickerContinuation?.resume(with: result); pickerContinuation = nil }

    private func stopServer() {
        mcpGeneration = UUID()
        activeMCP = nil
        server?.stop(); server = nil
        startingServer?.stop(); startingServer = nil
        configURL?.stopAccessingSecurityScopedResource(); configURL = nil
    }
    private func requireEnableAttempt(_ generation: UUID, vaultGeneration: UUID) throws {
        guard generation == mcpGeneration, vaultGeneration == self.vaultGeneration,
              defaults.bool(forKey: "mcpEnabled"), !openingVault, vaultURL != nil else {
            throw fault("CANCELLED", "MCP 启用请求已取消或笔记库已变化")
        }
    }
    private func validatedMCPDirectory(_ directory: URL, vaultURL: URL) throws -> URL {
        let root = directory.resolvingSymlinksInPath().standardizedFileURL
        let vaultRoot = vaultURL.resolvingSymlinksInPath().standardizedFileURL
        guard root.path != vaultRoot.path, !root.path.hasPrefix(vaultRoot.path + "/") else {
            throw fault("INVALID_ARGUMENT", "连接配置必须保存在笔记库之外")
        }
        let metadata: URLResourceValues
        do { metadata = try root.resourceValues(forKeys: [.isDirectoryKey, .isUbiquitousItemKey]) }
        catch { throw fault("INVALID_ARGUMENT", "无法验证配置目录，请重新选择本机文件夹") }
        // Foundation omits this resource value for ordinary local directories.
        // Resource lookup errors still throw; the dedicated iCloud query supplies the local fallback.
        guard metadata.isDirectory == true, metadata.isUbiquitousItem != true,
              !FileManager.default.isUbiquitousItem(at: root),
              !root.path.contains("/Library/Mobile Documents/") else {
            throw fault("INVALID_ARGUMENT", "无法确认所选目录是本机目录，请选择 iCloud 之外的本机文件夹")
        }
        var ancestor = root
        while ancestor.path != "/" {
            if FileManager.default.fileExists(atPath: ancestor.appendingPathComponent(".git").path) {
                throw fault("INVALID_ARGUMENT", "连接配置不能放在 Git 仓库中")
            }
            ancestor.deleteLastPathComponent()
        }
        return root
    }
    private func restoredMCPDirectory(vaultURL: URL) -> URL? {
        guard let bookmark = defaults.data(forKey: "mcpDirectoryBookmark") else { return nil }
        var directory: URL?
        do {
            let restored = try restore(bookmark)
            directory = restored
            _ = try validatedMCPDirectory(restored, vaultURL: vaultURL)
            return restored
        } catch {
            directory?.stopAccessingSecurityScopedResource()
            defaults.removeObject(forKey: "mcpDirectoryBookmark")
            return nil
        }
    }
    private func enableServer(allowPicker: Bool) async throws {
        guard !openingVault, let vaultURL, let selectedID = vaultID else {
            throw fault("STORE_UNAVAILABLE", "请先完成笔记库选择")
        }
        stopServer()
        let generation = mcpGeneration, selectedGeneration = vaultGeneration
        try requireEnableAttempt(generation, vaultGeneration: selectedGeneration)
        let info = try await coreStatus()
        try requireEnableAttempt(generation, vaultGeneration: selectedGeneration)
        guard info["vaultId"] as? String == selectedID else { throw fault("UNAUTHORIZED", "笔记库身份已变化") }
        let directory: URL
        var newBookmark: Data?
        if let restored = restoredMCPDirectory(vaultURL: vaultURL) { directory = restored }
        else {
            guard allowPicker else { throw fault("UNAUTHORIZED", "请在 MCP 设置中重新选择本机配置目录") }
            directory = try await pick(types: [.folder], title: "选择 MCP 配置目录（笔记库和代码仓库之外）", createDirectories: true)
            try requireEnableAttempt(generation, vaultGeneration: selectedGeneration)
            newBookmark = try authorize(directory)
        }
        var service: LocalReadServer?
        do {
            try requireEnableAttempt(generation, vaultGeneration: selectedGeneration)
            _ = try validatedMCPDirectory(directory, vaultURL: vaultURL)
            let candidate = LocalReadServer(vaultId: selectedID) { [weak self] operation, params in
                guard let self else { return ["ok": false, "error": ["code": "APP_NOT_RUNNING", "message": "应用已退出", "retryable": true]] }
                return await self.readRequest(operation, params, generation: generation, vaultGeneration: selectedGeneration, vaultID: selectedID)
            }
            service = candidate; startingServer = candidate
            let configuration = try await candidate.start()
            try requireEnableAttempt(generation, vaultGeneration: selectedGeneration)
            guard let instanceID = configuration["instanceId"] as? String,
                  configuration["vaultId"] as? String == selectedID else { throw fault("UNAUTHORIZED", "连接配置身份无效") }
            let root = try validatedMCPDirectory(directory, vaultURL: vaultURL)
            let file = root.appendingPathComponent("connection.json")
            let temporary = root.appendingPathComponent(".connection-\(UUID().uuidString).tmp")
            do {
                let data = try JSONSerialization.data(withJSONObject: configuration, options: [.sortedKeys])
                guard FileManager.default.createFile(atPath: temporary.path, contents: data, attributes: [.posixPermissions: 0o600]) else { throw fault("STORE_UNAVAILABLE", "无法写入连接配置") }
                if FileManager.default.fileExists(atPath: file.path) {
                    guard try file.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink == false else {
                        throw fault("INVALID_ARGUMENT", "连接配置不能使用符号链接")
                    }
                    _ = try FileManager.default.replaceItemAt(file, withItemAt: temporary, options: .usingNewMetadataOnly)
                } else { try FileManager.default.moveItem(at: temporary, to: file) }
                try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
            } catch {
                try? FileManager.default.removeItem(at: temporary)
                if generation == mcpGeneration { defaults.removeObject(forKey: "mcpDirectoryBookmark") }
                throw error
            }
            // No suspension between persistence and publication of this exact server binding.
            if let newBookmark { defaults.set(newBookmark, forKey: "mcpDirectoryBookmark") }
            server = candidate; startingServer = nil; configURL = directory
            activeMCP = MCPBinding(generation: generation, vaultGeneration: selectedGeneration, vaultID: selectedID, instanceID: instanceID)
        } catch {
            service?.stop()
            if startingServer === service { startingServer = nil }
            directory.stopAccessingSecurityScopedResource()
            // Do not leave a rejected directory bookmark trapping the next explicit enable attempt.
            if (error as NSError).domain == "INVALID_ARGUMENT" { defaults.removeObject(forKey: "mcpDirectoryBookmark") }
            throw error
        }
    }
    private func requireActiveMCP(generation: UUID, vaultGeneration: UUID, vaultID: String) throws -> MCPBinding {
        guard let binding = activeMCP, server != nil, !openingVault,
              binding.generation == generation, generation == mcpGeneration,
              binding.vaultGeneration == vaultGeneration, vaultGeneration == self.vaultGeneration,
              binding.vaultID == vaultID, self.vaultID == vaultID,
              defaults.bool(forKey: "mcpEnabled") else { throw fault("UNAUTHORIZED", "MCP 连接授权已失效") }
        return binding
    }
    private func readRequest(_ operation: String, _ params: [String: Any], generation: UUID, vaultGeneration: UUID, vaultID: String) async -> [String: Any] {
        guard readOperations.contains(operation), params["deleted"] as? Bool != true else { return failure(fault("UNAUTHORIZED", "只允许读取有效笔记")) }
        do {
            let binding = try requireActiveMCP(generation: generation, vaultGeneration: vaultGeneration, vaultID: vaultID)
            let data = try await invoke(operation, params)
            let current = try requireActiveMCP(generation: generation, vaultGeneration: vaultGeneration, vaultID: vaultID)
            guard current == binding else { throw fault("UNAUTHORIZED", "MCP 实例已变化，请重新连接") }
            if operation == "getNote", let note = data as? [String: Any], note["deletedAt"] != nil && !(note["deletedAt"] is NSNull) { throw fault("NOT_FOUND", "笔记已删除") }
            return ["ok": true, "data": data]
        } catch { return failure(error) }
    }
    private nonisolated static func readImage(_ url: URL) async throws -> Data {
        try await Task.detached(priority: .userInitiated) {
            let maximum = 20 * 1024 * 1024
            func invalidImage() -> NSError {
                NSError(domain: "INVALID_ARGUMENT", code: 1, userInfo: [NSLocalizedDescriptionKey: "请选择 20 MB 以内的普通图片文件"])
            }
            var result: Result<Data, Error>?
            var coordinationError: NSError?
            NSFileCoordinator().coordinate(readingItemAt: url, error: &coordinationError) { coordinated in
                result = Result {
                    let metadata = try coordinated.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
                    guard metadata.isRegularFile == true, let size = metadata.fileSize, size > 0, size <= maximum else { throw invalidImage() }
                    let handle = try FileHandle(forReadingFrom: coordinated)
                    defer { try? handle.close() }
                    var bytes = Data()
                    // Bound the read itself, even if another writer grows the file after metadata inspection.
                    while bytes.count <= maximum {
                        let chunk = try handle.read(upToCount: min(64 * 1024, maximum + 1 - bytes.count)) ?? Data()
                        if chunk.isEmpty { break }
                        bytes.append(chunk)
                    }
                    guard !bytes.isEmpty, bytes.count <= maximum else { throw invalidImage() }
                    return bytes
                }
            }
            if let coordinationError { throw coordinationError }
            guard let result else { throw invalidImage() }
            return try result.get()
        }.value
    }
}

final class VaultPresenter: NSObject, NSFilePresenter {
    let presentedItemURL: URL?
    let presentedItemOperationQueue = OperationQueue()
    let changed: () -> Void
    init(url: URL, changed: @escaping () -> Void) { presentedItemURL = url; self.changed = changed; super.init(); presentedItemOperationQueue.maxConcurrentOperationCount = 1 }
    func presentedItemDidChange() { changed() }
    func presentedSubitemDidAppear(at url: URL) { changed() }
    func presentedSubitemDidChange(at url: URL) { changed() }
    func presentedSubitem(at oldURL: URL, didMoveTo newURL: URL) { changed() }
    func accommodatePresentedSubitemDeletion(at url: URL, completionHandler: @escaping (Error?) -> Void) { changed(); completionHandler(nil) }
}
