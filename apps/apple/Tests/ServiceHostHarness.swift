import Foundation
import MemoCardCore
import MemoCardLocalWeb

// The production host and store run unchanged; only the native picker and a timing
// checkpoint are controlled. Every bookmark, preference and note belongs to root.
@MainActor
final class ServiceHostController {
    let root: URL
    let directory: URL
    let defaults: UserDefaults
    let suite: String
    var host: ServiceHost!
    var holdPicker = false
    var picker: CheckedContinuation<URL, Error>?
    var start: CheckedContinuation<Void, Never>?

    init(root: URL) async throws {
        self.root = root
        directory = root.appendingPathComponent("config")
        suite = "dev.memocard.service-host-test." + root.lastPathComponent
        defaults = UserDefaults(suiteName: suite)!
        let local = root.appendingPathComponent("local")
        if !FileManager.default.fileExists(atPath: root.appendingPathComponent("seeded").path) {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            var records: [StoredVaultRecord] = []
            for name in ["Vault A", "Vault B"] {
                let url = root.appendingPathComponent(name)
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
                let store = try VaultStore(localDataURL: local)
                try await store.open(url: url, create: true)
                let data = try await store.perform(operation: "getStatus", params: Data("{}".utf8))
                let status = try JSONSerialization.jsonObject(with: data) as! [String: Any]
                records.append(StoredVaultRecord(id: status["vaultId"] as! String, name: name,
                    bookmark: try url.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil)))
                await store.close()
            }
            defaults.set(try JSONEncoder().encode(records), forKey: "vaultBookmarks")
            defaults.set(records[0].id, forKey: "activeVaultID")
            defaults.set(true, forKey: "mcpEnabled") // Deliberately legacy, read-only consent.
            defaults.set(try directory.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil), forKey: "mcpDirectoryBookmark")
            defaults.synchronize()
            try Data().write(to: root.appendingPathComponent("seeded"))
        }
        host = try ServiceHost(defaults: defaults, localDataURL: local, mcpDirectoryPicker: { [unowned self] in
            if self.holdPicker {
                return try await withCheckedThrowingContinuation { continuation in
                    self.picker = continuation
                    self.signal("picker")
                }
            }
            return self.directory
        })
        await host.waitUntilRestored()
    }

    func signal(_ event: String, requestID: String? = nil, error: Error? = nil) {
        var result: [String: Any] = ["event": event, "pid": ProcessInfo.processInfo.processIdentifier,
            "running": host.mcpRunning, "writes": host.mcpWritesEnabled, "enabled": host.mcpEnabled,
            "consent": MCPAuthorization.allowsWrites(in: defaults), "vaultName": host.currentVaultName]
        if let requestID { result["requestID"] = requestID }
        if let error { result["error"] = (error as? VaultError)?.code ?? (error as NSError).domain }
        FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: result) + Data([10]))
    }

    func command(_ command: [String: String]) async {
        do {
            switch command["action"] {
            case "enable": try await host.enableMCP()
            case "switch":
                guard let vault = host.registeredVaults.first(where: { $0.name == command["name"] }) else { throw NSError(domain: "BAD_FIXTURE", code: 1) }
                try await host.chooseRegisteredVault(id: vault.id)
            case "hold-picker": holdPicker = true
            case "release-picker":
                let pending = picker; picker = nil; holdPicker = false
                if command["result"] == "cancel" { pending?.resume(throwing: NSError(domain: "CANCELLED", code: 1)) }
                else { pending?.resume(returning: directory) }
            case "hold-start":
                host.mcpStartCheckpoint = { [unowned self] in
                    self.host.mcpStartCheckpoint = nil
                    await withCheckedContinuation { continuation in
                        self.start = continuation
                        self.signal("held")
                    }
                }
            case "release-start": start?.resume(); start = nil
            case "disable": host.disableMCP()
            case "cleanup": defaults.removePersistentDomain(forName: suite)
            default: throw NSError(domain: "BAD_COMMAND", code: 1)
            }
            defaults.synchronize()
            signal("done", requestID: command["requestID"])
        } catch { signal("done", requestID: command["requestID"], error: error) }
    }
}

@main
struct ServiceHostHarness {
    @MainActor
    static func main() async throws {
        guard CommandLine.arguments.count == 2 else { exit(2) }
        let controller = try await ServiceHostController(root: URL(fileURLWithPath: CommandLine.arguments[1]))
        controller.signal("ready")
        for try await line in FileHandle.standardInput.bytes.lines {
            let command = try JSONSerialization.jsonObject(with: Data(line.utf8)) as! [String: String]
            Task { await controller.command(command) }
        }
        controller.picker?.resume(throwing: NSError(domain: "CANCELLED", code: 1))
        controller.start?.resume()
        controller.host.shutdown()
        controller.defaults.synchronize()
    }
}
