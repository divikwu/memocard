import Foundation

private actor RequestCounter {
    private var count = 0
    func next() -> Int { count += 1; return count }
}

@main
struct LocalWebServerHarness {
    static func main() async throws {
        guard CommandLine.arguments.count == 3 else { exit(2) }
        let configurationURL = URL(fileURLWithPath: CommandLine.arguments[1])
        let resources = URL(fileURLWithPath: CommandLine.arguments[2])
        let counter = RequestCounter()
        let server = LocalWebServer(resourceRoot: resources, handler: { message in
            let params = message["params"] as? [String: Any] ?? [:]
            if let delay = params["delayMilliseconds"] as? Int { try? await Task.sleep(for: .milliseconds(delay)) }
            return ["ok": true, "data": ["operation": message["operation"] ?? "", "echo": params["echo"] ?? "", "count": await counter.next()]]
        }, assetHandler: { path in
            guard ["assets/image.png", "assets/photo%test.png"].contains(path) else { throw NSError(domain: "NOT_FOUND", code: 1) }
            return Data([137, 80, 78, 71])
        })
        func publish() async throws {
            let launch = try await server.makeLaunchURL()
            let config: [String: Any] = ["baseURL": launch.absoluteString.components(separatedBy: "#")[0], "launchURL": launch.absoluteString]
            let bytes = try JSONSerialization.data(withJSONObject: config)
            guard FileManager.default.createFile(atPath: configurationURL.path, contents: bytes, attributes: [.posixPermissions: 0o600]) else { exit(3) }
        }
        _ = try await server.start()
        try await publish()
        FileHandle.standardOutput.write(Data("READY\n".utf8))
        while let command = await Task.detached(operation: { readLine() }).value {
            if command == "stop" {
                server.stop()
                do { _ = try await server.makeLaunchURL(); exit(4) } catch { }
                FileHandle.standardOutput.write(Data("STOPPED\n".utf8))
            } else if command == "restart" {
                _ = try await server.start()
                try await publish()
                FileHandle.standardOutput.write(Data("RESTARTED\n".utf8))
            } else if command == "launch" {
                try await publish()
                FileHandle.standardOutput.write(Data("LAUNCH\n".utf8))
            } else if command == "rotate" {
                let launch = try await server.makeLaunchURL(revokingSessions: true)
                let config: [String: Any] = ["baseURL": launch.absoluteString.components(separatedBy: "#")[0], "launchURL": launch.absoluteString]
                let bytes = try JSONSerialization.data(withJSONObject: config)
                try bytes.write(to: configurationURL, options: .atomic)
                FileHandle.standardOutput.write(Data("ROTATE\n".utf8))
            }
        }
        server.stop()
    }
}
