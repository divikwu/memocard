import AppKit
import Foundation
import MemoCardCore
import MemoCardLocalWeb

@MainActor
final class ServiceHost {
    private let defaults = UserDefaults.standard
    private let localDataURL: URL
    private var store: VaultStore
    private var vaultURL: URL?
    private var vaultID: String?
    private var vaultGeneration = UUID()
    private var presenter: ServiceVaultPresenter?
    private var webServer: LocalWebServer?
    private var startingWebServer: LocalWebServer?
    private var webAuthorizationEpoch = 0
    private var selectingVault = false
    private var restoreTask: Task<Void, Never>?
    private var vaultRegistry: VaultRegistry
    var stateChanged: (() -> Void)?

    init() throws {
        localDataURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MemoCard", isDirectory: true)
        store = try VaultStore(localDataURL: localDataURL)
        let records = (defaults.data(forKey: "vaultBookmarks").flatMap { try? JSONDecoder().decode([StoredVaultRecord].self, from: $0) }) ?? []
        vaultRegistry = VaultRegistry(records: records, activeID: defaults.string(forKey: "activeVaultID"))
        restoreTask = Task { [weak self] in await self?.restoreVault() }
    }

    var currentVaultName: String { vaultURL?.lastPathComponent ?? "未选择笔记库" }
    var webRunning: Bool { webServer != nil }
    var registeredVaults: [(id: String, name: String, active: Bool)] { vaultRegistry.listed }

    func waitUntilRestored() async { await restoreTask?.value }

    func openWeb() async throws {
        let url = try await launchURL()
        guard NSWorkspace.shared.open(url) else { throw fault("STORE_UNAVAILABLE", "无法打开浏览器，请重试") }
        stateChanged?()
    }

    func copyWebLink() async throws {
        let url = try await launchURL()
        NSPasteboard.general.clearContents()
        guard NSPasteboard.general.setString(url.absoluteString, forType: .string) else {
            throw fault("STORE_UNAVAILABLE", "无法复制访问链接，请重试")
        }
        stateChanged?()
    }

    func stopWeb() {
        webAuthorizationEpoch &+= 1
        webServer?.stop()
        startingWebServer?.stop()
        webServer = nil
        startingWebServer = nil
        stateChanged?()
    }

    func shutdown() {
        stopWeb()
        if let presenter { NSFileCoordinator.removeFilePresenter(presenter) }
        presenter = nil
        Task { await store.close() }
        vaultURL?.stopAccessingSecurityScopedResource()
        vaultURL = nil
    }

    func chooseVault(create: Bool) async throws {
        _ = try await selectVault(create: create, reconnect: false)
    }

    func chooseRegisteredVault(id: String) async throws {
        _ = try await activateVault(id: id, reconnect: false)
    }

    private func restoreVault() async {
        let record = vaultRegistry.activeID.flatMap { vaultRegistry.record(id: $0) }
        let bookmark = record?.bookmark ?? defaults.data(forKey: "vaultBookmark")
        guard let bookmark else { return }
        var restored: URL?
        do {
            let url = try restore(bookmark)
            restored = url
            let candidate = try VaultStore(localDataURL: localDataURL)
            let generation = UUID()
            try await candidate.open(url: url, create: false, binding: generation)
            let status = try await status(of: candidate, binding: generation)
            guard let id = status["vaultId"] as? String else { throw fault("STORE_UNAVAILABLE", "笔记库身份不可用") }
            let previous = store
            store = candidate
            vaultGeneration = generation
            vaultURL = url
            vaultID = id
            rememberVault(id: id, name: url.lastPathComponent, bookmark: bookmark)
            restored = nil
            watch(url)
            await previous.close()
            stateChanged?()
        } catch {
            restored?.stopAccessingSecurityScopedResource()
            defaults.removeObject(forKey: "vaultBookmark")
            defaults.removeObject(forKey: "activeVaultID")
            vaultRegistry.clearActive()
            stateChanged?()
        }
    }

    private func launchURL() async throws -> URL {
        await waitUntilRestored()
        if webServer == nil {
            guard startingWebServer == nil else { throw fault("BUSY", "正在启动本机 Web，请稍后重试") }
            guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web", isDirectory: true) else {
                throw fault("STORE_UNAVAILABLE", "应用内的网页资源不可用，请重新安装")
            }
            let candidate = LocalWebServer(resourceRoot: root, authorizationEpoch: webAuthorizationEpoch, handler: { [weak self] request in
                guard let self else { return Self.failure(Self.fault("APP_NOT_RUNNING", "菜单栏服务已退出")) }
                return await self.webRequest(request)
            }, assetHandler: { [weak self] path in
                guard let self else { throw Self.fault("APP_NOT_RUNNING", "菜单栏服务已退出") }
                return try await self.webAsset(path)
            })
            startingWebServer = candidate
            do {
                _ = try await candidate.start()
                webServer = candidate
                startingWebServer = nil
            } catch {
                candidate.stop()
                if startingWebServer === candidate { startingWebServer = nil }
                throw error
            }
        }
        guard let webServer else { throw fault("STORE_UNAVAILABLE", "本机 Web 尚未启动") }
        return try await webServer.makeLaunchURL()
    }

    private let webOperations: Set<String> = [
        "getEnvironment", "getStatus", "selectVault", "listVaults", "activateVault", "queryNotes", "getNote", "listTags", "listFolders",
        "resolveLink", "getDrafts", "saveDraft", "saveNote", "getNoteProperties", "updateNoteProperty", "getPropertyLabels", "renamePropertyLabel", "importAttachment",
    ]

    private func webRequest(_ request: [String: Any]) async -> [String: Any] {
        do {
            guard request["version"] as? Int == 1, request["requestId"] as? String != nil,
                  let operation = request["operation"] as? String, webOperations.contains(operation),
                  let params = request["params"] as? [String: Any],
                  let requestEpoch = request["_authorizationEpoch"] as? Int else {
                throw fault("INVALID_ARGUMENT", "本机 Web 不支持此操作")
            }
            guard requestEpoch == webAuthorizationEpoch else { throw fault("UNAUTHORIZED", "本机 Web 授权已失效，请重新连接") }
            if operation == "selectVault" {
                let create = params["create"] as? Bool ?? false
                return ["ok": true, "data": try await selectVault(create: create, reconnect: true)]
            }
            if operation == "listVaults" {
                return ["ok": true, "data": ["vaults": registeredVaults.map { ["vaultId": $0.id, "name": $0.name, "active": $0.active] }]]
            }
            if operation == "activateVault" {
                guard let id = params["vaultId"] as? String else { throw fault("INVALID_ARGUMENT", "请选择笔记库") }
                return ["ok": true, "data": try await activateVault(id: id, reconnect: true)]
            }
            if operation == "getEnvironment" {
                return ["ok": true, "data": [
                    "platform": "web", "phase": "M1", "storage": "local-web", "mcpEnabled": false,
                    "webEnabled": true, "capabilities": ["selectVault", "createVault", "listVaults", "activateVault", "pickImage", "openExternal"],
                ]]
            }
            let selectedStore = store
            let generation = vaultGeneration
            let data: Any
            if operation == "getStatus" {
                var value = try await status(of: selectedStore, binding: vaultURL == nil ? nil : generation)
                value["capabilities"] = (value["capabilities"] as? [String] ?? []).filter { webOperations.contains($0) }
                    + ["selectVault", "createVault", "listVaults", "activateVault", "pickImage", "openExternal"]
                data = value
            } else {
                let encoded = try JSONSerialization.data(withJSONObject: params)
                data = try JSONSerialization.jsonObject(with: await selectedStore.perform(operation: operation, params: encoded, expectedBinding: vaultURL == nil ? nil : generation))
            }
            guard selectedStore === store, generation == vaultGeneration else {
                throw fault("UNAUTHORIZED", "笔记库已切换，请重新连接")
            }
            return ["ok": true, "data": data]
        } catch { return Self.failure(error) }
    }

    private func webAsset(_ path: String) async throws -> Data {
        let selectedStore = store
        let generation = vaultGeneration
        let data = try await selectedStore.asset(relativePath: path, expectedBinding: vaultURL == nil ? nil : generation)
        guard selectedStore === store, generation == vaultGeneration else {
            throw fault("UNAUTHORIZED", "笔记库已切换，请重新连接")
        }
        return data
    }

    private func selectVault(create: Bool, reconnect: Bool) async throws -> [String: Any] {
        guard !selectingVault else { throw fault("BUSY", "请先完成当前笔记库选择") }
        selectingVault = true
        defer { selectingVault = false }

        let selected: URL
        do { selected = try await pickVault(create: create) }
        catch let error as NSError where error.domain == "CANCELLED" { return ["cancelled": true] }

        let bookmark = try authorize(selected)
        let candidate: VaultStore
        do { candidate = try VaultStore(localDataURL: localDataURL) }
        catch {
            selected.stopAccessingSecurityScopedResource()
            throw error
        }
        let candidateGeneration = UUID()
        do {
            try await candidate.open(url: selected, create: create, binding: candidateGeneration)
            let candidateStatus = try await status(of: candidate, binding: candidateGeneration)
            guard let id = candidateStatus["vaultId"] as? String else { throw fault("STORE_UNAVAILABLE", "笔记库身份不可用") }

            let reconnectURL = try await rotateAuthorization(reconnect: reconnect)
            let previousStore = store
            let previousURL = vaultURL
            store = candidate
            vaultGeneration = candidateGeneration
            vaultURL = selected
            vaultID = id
            rememberVault(id: id, name: selected.lastPathComponent, bookmark: bookmark)
            watch(selected)
            await previousStore.close()
            previousURL?.stopAccessingSecurityScopedResource()
            stateChanged?()
            if let reconnectURL { return ["reconnectUrl": reconnectURL.absoluteString] }
            return ["vaultId": id]
        } catch {
            await candidate.close()
            selected.stopAccessingSecurityScopedResource()
            throw error
        }
    }

    private func activateVault(id: String, reconnect: Bool) async throws -> [String: Any] {
        guard id != vaultID else { return ["vaultId": id] }
        guard !selectingVault else { throw fault("BUSY", "请先完成当前笔记库选择") }
        guard let record = vaultRegistry.record(id: id) else { throw fault("NOT_FOUND", "找不到这个笔记库") }
        selectingVault = true
        defer { selectingVault = false }

        let selected = try restore(record.bookmark)
        let candidate: VaultStore
        do { candidate = try VaultStore(localDataURL: localDataURL) }
        catch { selected.stopAccessingSecurityScopedResource(); throw error }
        let candidateGeneration = UUID()
        do {
            try await candidate.open(url: selected, create: false, binding: candidateGeneration)
            let candidateStatus = try await status(of: candidate, binding: candidateGeneration)
            guard candidateStatus["vaultId"] as? String == id else { throw fault("UNAUTHORIZED", "笔记库身份已经变化，请重新打开文件夹") }
            let reconnectURL = try await rotateAuthorization(reconnect: reconnect)
            let previousStore = store
            let previousURL = vaultURL
            store = candidate
            vaultGeneration = candidateGeneration
            vaultURL = selected
            vaultID = id
            _ = vaultRegistry.activate(id: id)
            defaults.set(id, forKey: "activeVaultID")
            watch(selected)
            await previousStore.close()
            previousURL?.stopAccessingSecurityScopedResource()
            stateChanged?()
            if let reconnectURL { return ["reconnectUrl": reconnectURL.absoluteString] }
            return ["vaultId": id]
        } catch {
            await candidate.close()
            selected.stopAccessingSecurityScopedResource()
            throw error
        }
    }

    private func rotateAuthorization(reconnect: Bool) async throws -> URL? {
        guard let webServer else { return nil }
        let reconnectURL: URL?
        if reconnect { reconnectURL = try await webServer.makeLaunchURL(revokingSessions: true) }
        else { await webServer.revokeSessions(); reconnectURL = nil }
        webAuthorizationEpoch &+= 1
        return reconnectURL
    }

    private func rememberVault(id: String, name: String, bookmark: Data) {
        vaultRegistry.remember(StoredVaultRecord(id: id, name: name, bookmark: bookmark))
        if let data = try? JSONEncoder().encode(vaultRegistry.records) { defaults.set(data, forKey: "vaultBookmarks") }
        defaults.set(id, forKey: "activeVaultID")
        defaults.removeObject(forKey: "vaultBookmark")
    }

    private func pickVault(create: Bool) async throws -> URL {
        NSApp.activate(ignoringOtherApps: true)
        return try await withCheckedThrowingContinuation { continuation in
            let panel = NSOpenPanel()
            panel.title = create ? "选择用于创建笔记库的空文件夹" : "选择 MemoCard 笔记库"
            panel.canChooseDirectories = true
            panel.canChooseFiles = false
            panel.canCreateDirectories = create
            panel.allowsMultipleSelection = false
            panel.begin { response in
                if response == .OK, let url = panel.url { continuation.resume(returning: url) }
                else { continuation.resume(throwing: Self.fault("CANCELLED", "已取消选择")) }
            }
        }
    }

    private func authorize(_ url: URL) throws -> Data {
        guard url.startAccessingSecurityScopedResource() else { throw fault("UNAUTHORIZED", "无法访问所选文件夹，请重新授权") }
        do { return try url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil) }
        catch { url.stopAccessingSecurityScopedResource(); throw error }
    }

    private func restore(_ bookmark: Data) throws -> URL {
        var stale = false
        let url = try URL(resolvingBookmarkData: bookmark, options: [.withSecurityScope, .withoutUI], relativeTo: nil, bookmarkDataIsStale: &stale)
        guard !stale, url.startAccessingSecurityScopedResource() else { throw fault("UNAUTHORIZED", "文件夹授权已失效") }
        return url
    }

    private func status(of store: VaultStore, binding: UUID?) async throws -> [String: Any] {
        let data = try await store.perform(operation: "getStatus", params: Data("{}".utf8), expectedBinding: binding)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    private func watch(_ url: URL) {
        if let presenter { NSFileCoordinator.removeFilePresenter(presenter) }
        let next = ServiceVaultPresenter(url: url) { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                await self.store.invalidateSnapshot()
                self.stateChanged?()
            }
        }
        presenter = next
        NSFileCoordinator.addFilePresenter(next)
    }

    private func fault(_ code: String, _ message: String) -> NSError { Self.fault(code, message) }
    nonisolated private static func fault(_ code: String, _ message: String) -> NSError {
        NSError(domain: code, code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    nonisolated private static func failure(_ error: Error) -> [String: Any] {
        if let value = error as? VaultError {
            return ["ok": false, "error": ["code": value.code, "message": value.message, "retryable": value.retryable]]
        }
        let value = error as NSError
        let known = ["INVALID_ARGUMENT", "UNAUTHORIZED", "NOT_FOUND", "CANCELLED", "BUSY", "STORE_UNAVAILABLE", "APP_NOT_RUNNING"]
        let code = known.contains(value.domain) ? value.domain : "STORE_UNAVAILABLE"
        return ["ok": false, "error": ["code": code, "message": value.localizedDescription, "retryable": code == "STORE_UNAVAILABLE" || code == "BUSY"]]
    }
}

final class ServiceVaultPresenter: NSObject, NSFilePresenter {
    let presentedItemURL: URL?
    let presentedItemOperationQueue = OperationQueue()
    private let changed: () -> Void
    init(url: URL, changed: @escaping () -> Void) {
        presentedItemURL = url
        self.changed = changed
        super.init()
        presentedItemOperationQueue.maxConcurrentOperationCount = 1
    }
    func presentedItemDidChange() { changed() }
    func presentedSubitemDidAppear(at url: URL) { changed() }
    func presentedSubitemDidChange(at url: URL) { changed() }
    func presentedSubitem(at oldURL: URL, didMoveTo newURL: URL) { changed() }
    func accommodatePresentedSubitemDeletion(at url: URL, completionHandler: @escaping (Error?) -> Void) {
        changed()
        completionHandler(nil)
    }
}
