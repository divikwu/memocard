import Foundation

// Test-only process: uses the production network server with a deterministic in-memory handler.
@main
struct LocalReadServerHarness {
    static func main() async throws {
        if CommandLine.arguments.last == "--authorization-test" {
            let suite = "dev.memocard.mcp-authorization-test.\(UUID().uuidString)"
            let defaults = UserDefaults(suiteName: suite)!
            defer { defaults.removePersistentDomain(forName: suite) }
            defaults.set(true, forKey: "mcpEnabled")
            precondition(!MCPAuthorization.allowsWrites(in: defaults), "Legacy read consent must not grant writes")
            defaults.set(999, forKey: MCPAuthorization.writeVersionKey)
            precondition(!MCPAuthorization.allowsWrites(in: defaults), "Unknown consent versions must fail closed")
            MCPAuthorization.grantWrites(in: defaults)
            precondition(MCPAuthorization.allowsWrites(in: defaults))
            precondition(MCPAuthorization.allowsWrites(in: UserDefaults(suiteName: suite)!))
            defaults.set(false, forKey: "mcpEnabled")
            precondition(!MCPAuthorization.allowsWrites(in: defaults))
            MCPAuthorization.revokeWrites(in: defaults)
            defaults.set(true, forKey: "mcpEnabled")
            precondition(!MCPAuthorization.allowsWrites(in: defaults), "Revoked consent must not return on re-enable")
            FileHandle.standardOutput.write(Data("AUTHORIZATION PASSED\n".utf8))
            return
        }
        guard (2...3).contains(CommandLine.arguments.count) else { exit(2) }
        let configurationURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let suite = "dev.memocard.mcp-network-test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.set(true, forKey: "mcpEnabled")
        if CommandLine.arguments.last == "--allow-writes" { MCPAuthorization.grantWrites(in: defaults) }
        let allowsWrites = MCPAuthorization.allowsWrites(in: defaults)
        defaults.removePersistentDomain(forName: suite)
        let server = LocalReadServer(vaultId: "native-network-test", allowsWrites: allowsWrites) { operation, params in
            if let delay = params["delayMilliseconds"] as? Int {
                try? await Task.sleep(for: .milliseconds(delay))
            }
            if let count = params["responseBytes"] as? Int {
                let character = params["escapedResponse"] as? Bool == true ? "\u{0001}" : "x"
                return ["ok": true, "data": ["body": String(repeating: character, count: count)]]
            }
            return ["ok": true, "data": ["operation": operation, "echo": params["echo"] ?? ""]]
        }
        let configuration = try await server.start()
        let bytes = try JSONEncoder().encode(configuration)
        guard FileManager.default.createFile(atPath: configurationURL.path, contents: bytes, attributes: [.posixPermissions: 0o600]) else { exit(3) }
        FileHandle.standardOutput.write(Data("READY\n".utf8))
        while true { try await Task.sleep(for: .seconds(60)) }
    }
}
