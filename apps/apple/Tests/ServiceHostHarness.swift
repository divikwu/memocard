import Foundation
@testable import MemoCardCore
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
    var restoration: CheckedContinuation<Void, Error>?

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

    func signal(_ event: String, requestID: String? = nil, error: Error? = nil, data: [String: Any]? = nil) {
        var result: [String: Any] = ["event": event, "pid": ProcessInfo.processInfo.processIdentifier,
            "running": host.mcpRunning, "writes": host.mcpWritesEnabled, "enabled": host.mcpEnabled,
            "consent": MCPAuthorization.allowsWrites(in: defaults), "vaultName": host.currentVaultName]
        if let requestID { result["requestID"] = requestID }
        if let error { result["error"] = (error as? VaultError)?.code ?? (error as NSError).domain }
        if let data { result["data"] = data }
        FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: result) + Data([10]))
    }

    func command(_ command: [String: String]) async {
        var data: [String: Any]?
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
            case "hold-restore":
                host.shutdown()
                defaults.set(false, forKey: "mcpEnabled")
                let first = host.registeredVaults.first { $0.name == "Vault A" }!
                defaults.set(first.id, forKey: "activeVaultID")
                var candidate: VaultStore?
                host = try ServiceHost(defaults: defaults, localDataURL: root.appendingPathComponent("local"))
                host.vaultRestoreCheckpoint = { [unowned self] pending in
                    candidate = pending
                    try await withCheckedThrowingContinuation { continuation in
                        self.restoration = continuation
                        self.signal("restore-held")
                    }
                }
                await host.waitUntilRestored()
                if let candidate {
                    let status = try await candidate.perform(operation: "getStatus", params: Data("{}".utf8))
                    data = try JSONSerialization.jsonObject(with: status) as? [String: Any]
                }
            case "release-restore":
                let pending = restoration; restoration = nil
                if command["result"] == "failure" { pending?.resume(throwing: NSError(domain: "RESTORE_FAILED", code: 1)) }
                else { pending?.resume() }
            case "switch-before-restore":
                host.shutdown()
                defaults.set(false, forKey: "mcpEnabled")
                let records = host.registeredVaults
                defaults.set(records.first { $0.name == "Vault A" }!.id, forKey: "activeVaultID")
                let gate = HostIndexingGate()
                host = try ServiceHost(defaults: defaults, localDataURL: root.appendingPathComponent("local"))
                host.vaultRestoreCheckpoint = { _ in await gate.wait() }
                try await host.chooseRegisteredVault(id: records.first { $0.name == "Vault B" }!.id)
                await gate.release()
                await host.waitUntilRestored()
            case "shutdown": host.shutdown()
            case "web-background": signal("web-status", data: try await host.regressionWebStatus())
            case "web-startup":
                host.shutdown()
                defaults.set(false, forKey: "mcpEnabled")
                try Data("Not read before startup returns".utf8).write(to: root.appendingPathComponent("Vault A/Startup.md"))
                let gate = HostIndexingGate()
                var restored: VaultStore?
                host = try ServiceHost(defaults: defaults, localDataURL: root.appendingPathComponent("local"))
                host.vaultRestoreCheckpoint = { candidate in
                    restored = candidate
                    await candidate.setIndexingCheckpoint { phase in if phase == "reading" { await gate.wait() } }
                }
                await host.waitUntilRestored()
                let core = restored!
                let data = try await core.perform(operation: "getStatus", params: Data("{\"background\":true}".utf8))
                signal("web-startup-status", data: ["ok": true, "data": try JSONSerialization.jsonObject(with: data), "sourceReads": await core.sourceReadCount])
                await gate.release()
            case "native-background":
                let isolated = UserDefaults(suiteName: suite + ".native")!
                isolated.removePersistentDomain(forName: suite + ".native")
                let native = NativeHost(defaults: isolated, localDataURL: root.appendingPathComponent("native-local"))
                _ = await native.handle(["version": 1, "requestId": "start", "operation": "getEnvironment", "params": [:]])
                try await native.store.open(url: root.appendingPathComponent("Vault A"), create: false)
                signal("native-status", data: await native.handle(["version": 1, "requestId": "status", "operation": "getStatus", "params": ["background": true]]))
                try await native.store.close()
                isolated.removePersistentDomain(forName: suite + ".native")
            case "native-startup":
                let isolated = UserDefaults(suiteName: suite + ".native-startup")!
                isolated.removePersistentDomain(forName: suite + ".native-startup")
                let vault = root.appendingPathComponent("Vault A")
                try Data("Not read before startup returns".utf8).write(to: vault.appendingPathComponent("Startup.md"))
                isolated.set(try vault.bookmarkData(options: .withSecurityScope, includingResourceValuesForKeys: nil, relativeTo: nil), forKey: "vaultBookmark")
                let gate = HostIndexingGate()
                let native = NativeHost(defaults: isolated, localDataURL: root.appendingPathComponent("native-startup-local"))
                native.vaultOpenCheckpoint = { core in
                    await core.setIndexingCheckpoint { phase in if phase == "reading" { await gate.wait() } }
                }
                _ = await native.handle(["version": 1, "requestId": "start", "operation": "getEnvironment", "params": [:]])
                let response = await native.handle(["version": 1, "requestId": "status", "operation": "getStatus", "params": ["background": true]])
                let core = try native.store
                signal("native-startup-status", data: response.merging(["sourceReads": await core.sourceReadCount]) { _, next in next })
                await gate.release()
                await core.close()
                isolated.removePersistentDomain(forName: suite + ".native-startup")
            case "disable": host.disableMCP()
            case "cleanup": defaults.removePersistentDomain(forName: suite)
            default: throw NSError(domain: "BAD_COMMAND", code: 1)
            }
            defaults.synchronize()
            signal("done", requestID: command["requestID"], data: data)
        } catch { signal("done", requestID: command["requestID"], error: error) }
    }
}

private actor HostIndexingGate {
    private var released = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if released { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func release() {
        released = true
        for waiter in waiters { waiter.resume() }
        waiters.removeAll()
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
        controller.restoration?.resume(throwing: NSError(domain: "CANCELLED", code: 1))
        controller.host.shutdown()
        controller.defaults.synchronize()
    }
}
