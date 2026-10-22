import Foundation

// Test-only controller for the production service transport; no user vaults are opened.
@MainActor
final class ServiceMCPTestController {
    let defaults: UserDefaults
    let server: ServiceMCPServer
    let directory: URL
    let vaultURL: URL
    let suiteName = "dev.memocard.service-mcp-test.\(UUID().uuidString)"
    var vaultID = "service-vault-a"
    var pending: CheckedContinuation<Void, Never>?

    init(directory: URL, vaultURL: URL) {
        self.directory = directory; self.vaultURL = vaultURL
        defaults = UserDefaults(suiteName: suiteName)!
        defaults.set(true, forKey: "mcpEnabled")
        server = ServiceMCPServer(defaults: defaults)
    }

    func signal(_ event: String, error: String? = nil) {
        var value: [String: Any] = ["event": event, "running": server.running,
                                  "writes": server.writesEnabled, "consent": MCPAuthorization.allowsWrites(in: defaults)]
        if let error { value["error"] = error }
        FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: value) + Data([10]))
    }

    func start(authorize: Bool, directory: URL? = nil) async throws {
        let selected = vaultID
        try await server.start(vaultID: selected, vaultURL: vaultURL, directory: directory ?? self.directory,
                               authorizeWrites: authorize) { [weak self] operation, params in
            guard let self else { return ["ok": false] }
            if params["wait"] as? Bool == true {
                await withCheckedContinuation { continuation in
                    self.pending = continuation
                    self.signal("waiting")
                }
            }
            var data: [String: Any] = ["vaultId": selected, "operation": operation, "echo": params["echo"] ?? ""]
            if params["deleted"] as? String == "fixture" { data["deletedAt"] = "2026-01-01T00:00:00Z" }
            return ["ok": true, "data": data]
        }
    }
}

@main
struct ServiceMCPServerHarness {
    @MainActor
    static func main() async throws {
        guard CommandLine.arguments.count == 3 else { exit(2) }
        let controller = ServiceMCPTestController(directory: URL(fileURLWithPath: CommandLine.arguments[1]),
                                                 vaultURL: URL(fileURLWithPath: CommandLine.arguments[2]))
        defer { controller.defaults.removePersistentDomain(forName: controller.suiteName) }
        try await controller.start(authorize: false)
        controller.signal("ready")
        for try await line in FileHandle.standardInput.bytes.lines {
            guard let bytes = line.data(using: .utf8),
                  let command = try JSONSerialization.jsonObject(with: bytes) as? [String: String] else { exit(3) }
            do {
                switch command["action"] {
                case "enable":
                    controller.defaults.set(true, forKey: "mcpEnabled")
                    try await controller.start(authorize: true, directory: command["directory"].map { URL(fileURLWithPath: $0) })
                case "restart":
                    if let vault = command["vaultID"] { controller.vaultID = vault }
                    try await controller.start(authorize: false)
                case "disable":
                    controller.defaults.set(false, forKey: "mcpEnabled")
                    MCPAuthorization.revokeWrites(in: controller.defaults)
                    controller.server.stop()
                case "legacy":
                    controller.defaults.set(true, forKey: "mcpEnabled")
                    try await controller.start(authorize: false)
                case "release":
                    controller.pending?.resume(); controller.pending = nil
                default: exit(4)
                }
                controller.signal("done")
            } catch { controller.signal("done", error: (error as NSError).domain) }
        }
        controller.server.stop()
    }
}
