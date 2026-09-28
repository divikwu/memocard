import Foundation

// Test-only process: uses the production network server with a deterministic in-memory handler.
@main
struct LocalReadServerHarness {
    static func main() async throws {
        guard CommandLine.arguments.count == 2 else { exit(2) }
        let configurationURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let server = LocalReadServer(vaultId: "native-network-test") { operation, params in
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
        let bytes = try JSONSerialization.data(withJSONObject: configuration)
        guard FileManager.default.createFile(atPath: configurationURL.path, contents: bytes, attributes: [.posixPermissions: 0o600]) else { exit(3) }
        FileHandle.standardOutput.write(Data("READY\n".utf8))
        while true { try await Task.sleep(for: .seconds(60)) }
    }
}
