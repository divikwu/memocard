import Foundation

// Owns the background service's MCP transport and consent, independently of the UI app.
@MainActor
final class ServiceMCPServer {
    typealias Handler = @MainActor (String, [String: Any]) async -> [String: Any]
    static let fileName = "service-connection.json"
    private static let operations: Set<String> = ["getStatus", "queryNotes", "getNote", "listTags", "getTrash", "getTrashedNote", "createNote", "updateNote", "deleteNote", "restoreNote"]
    private let defaults: UserDefaults
    private var server: LocalReadServer?
    private var starting: LocalReadServer?
    private var generation = UUID()
    private var configuration: LocalReadConfiguration?
    private var writeListener = false
    var running: Bool { server != nil && configuration != nil }
    var writesEnabled: Bool { running && writeListener && MCPAuthorization.allowsWrites(in: defaults) }

    init(defaults: UserDefaults) { self.defaults = defaults }

    func stop() {
        generation = UUID()
        configuration = nil
        writeListener = false
        server?.stop(); server = nil
        starting?.stop(); starting = nil
    }

    func start(vaultID: String, vaultURL: URL, directory: URL, authorizeWrites: Bool = false,
               handler: @escaping Handler) async throws {
        stop()
        let attempt = generation
        let allowsWrites = authorizeWrites || MCPAuthorization.allowsWrites(in: defaults)
        let candidate = LocalReadServer(vaultId: vaultID, allowsWrites: allowsWrites) { [weak self] operation, params in
            guard let self else { return Self.failure("APP_NOT_RUNNING", "后台服务已退出") }
            return await self.respond(operation, params, generation: attempt, handler: handler)
        }
        starting = candidate
        do {
            try requireAttempt(attempt, authorizeWrites: authorizeWrites)
            let root = try Self.validatedDirectory(directory, vaultURL: vaultURL)
            let config = try await candidate.start()
            try requireAttempt(attempt, authorizeWrites: authorizeWrites)
            let verifiedRoot = try Self.validatedDirectory(directory, vaultURL: vaultURL)
            guard root == verifiedRoot else { throw Self.fault("INVALID_ARGUMENT", "配置目录已变化") }
            try Self.publish(config, directory: root)
            // Pending enables must not change persisted state. Publish consent
            // only with this successful private-file export, without suspension.
            if authorizeWrites {
                defaults.set(true, forKey: "mcpEnabled")
                MCPAuthorization.grantWrites(in: defaults)
            }
            configuration = config
            writeListener = allowsWrites
            server = candidate
            starting = nil
        } catch {
            candidate.stop()
            if starting === candidate { starting = nil }
            throw error
        }
    }

    private func requireAttempt(_ attempt: UUID, authorizeWrites: Bool) throws {
        guard generation == attempt, authorizeWrites || defaults.bool(forKey: "mcpEnabled") else {
            throw Self.fault("CANCELLED", "MCP 启用已取消")
        }
    }

    private func respond(_ operation: String, _ params: [String: Any], generation expected: UUID,
                         handler: Handler) async -> [String: Any] {
        guard generation == expected, running, defaults.bool(forKey: "mcpEnabled"),
              let config = configuration else { return Self.failure("UNAUTHORIZED", "MCP 实例已失效") }
        guard Self.operations.contains(operation), params["deleted"] as? Bool != true else {
            return Self.failure("UNAUTHORIZED", "不允许此 MCP 操作")
        }
        if ["createNote", "updateNote", "deleteNote", "restoreNote"].contains(operation) {
            guard writesEnabled else { return Self.failure("WRITE_DISABLED", "请明确启用后台服务 MCP 写入") }
            guard let binding = params["binding"] as? [String: Any],
                  binding["vaultId"] as? String == config.vaultId,
                  binding["instanceId"] as? String == config.instanceId else {
                return Self.failure("VAULT_CHANGED", "请重新读取当前笔记库实例")
            }
        }
        var reply = await handler(operation, params)
        guard generation == expected, running, defaults.bool(forKey: "mcpEnabled") else {
            return Self.failure("UNAUTHORIZED", "MCP 实例已变化")
        }
        if operation == "getNote", let note = reply["data"] as? [String: Any],
           let deleted = note["deletedAt"], !(deleted is NSNull) {
            return Self.failure("NOT_FOUND", "笔记已删除")
        }
        if operation == "getStatus", var status = reply["data"] as? [String: Any] {
            status["capabilities"] = Self.operations.filter { writesEnabled || !["createNote", "updateNote", "deleteNote", "restoreNote"].contains($0) }.sorted()
            reply["data"] = status
        }
        return reply
    }

    static func validatedDirectory(_ directory: URL, vaultURL: URL) throws -> URL {
        let root = directory.resolvingSymlinksInPath().standardizedFileURL
        let vault = vaultURL.resolvingSymlinksInPath().standardizedFileURL
        guard root.path != vault.path, !root.path.hasPrefix(vault.path + "/") else {
            throw fault("INVALID_ARGUMENT", "MCP 配置必须放在笔记库之外")
        }
        let values = try root.resourceValues(forKeys: [.isDirectoryKey, .isUbiquitousItemKey])
        guard values.isDirectory == true, values.isUbiquitousItem != true,
              !FileManager.default.isUbiquitousItem(at: root), !root.path.contains("/Library/Mobile Documents/") else {
            throw fault("INVALID_ARGUMENT", "请选择 iCloud 之外的本机配置目录")
        }
        var ancestor = root
        while ancestor.path != "/" {
            guard !FileManager.default.fileExists(atPath: ancestor.appendingPathComponent(".git").path) else {
                throw fault("INVALID_ARGUMENT", "MCP 配置不能放在 Git 仓库内")
            }
            ancestor.deleteLastPathComponent()
        }
        return root
    }

    private static func publish(_ configuration: LocalReadConfiguration, directory: URL) throws {
        let file = directory.appendingPathComponent(fileName)
        let temporary = directory.appendingPathComponent(".service-connection-\(UUID().uuidString).tmp")
        defer { try? FileManager.default.removeItem(at: temporary) }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let bytes = try encoder.encode(configuration)
        guard FileManager.default.createFile(atPath: temporary.path, contents: bytes, attributes: [.posixPermissions: 0o600]) else {
            throw fault("STORE_UNAVAILABLE", "无法写入 MCP 配置")
        }
        if FileManager.default.fileExists(atPath: file.path) {
            let values = try file.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey])
            guard values.isSymbolicLink == false, values.isRegularFile == true else {
                throw fault("INVALID_ARGUMENT", "MCP 配置必须是普通文件，不能使用符号链接")
            }
            _ = try FileManager.default.replaceItemAt(file, withItemAt: temporary, options: .usingNewMetadataOnly)
        } else { try FileManager.default.moveItem(at: temporary, to: file) }
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
    }

    private static func fault(_ code: String, _ message: String) -> NSError {
        NSError(domain: code, code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    nonisolated private static func failure(_ code: String, _ message: String) -> [String: Any] {
        ["ok": false, "error": ["code": code, "message": message, "retryable": false]]
    }
}
