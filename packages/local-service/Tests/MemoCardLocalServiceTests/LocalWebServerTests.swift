import Foundation
import ServiceManagement
import XCTest
@testable import MemoCardLocalWeb

final class LocalWebServerTests: XCTestCase {
    func testVaultRegistryDeduplicatesAndChangesActiveVaultOnlyForKnownIDs() throws {
        let first = StoredVaultRecord(id: "one", name: "First", bookmark: Data([1]))
        let second = StoredVaultRecord(id: "two", name: "Second", bookmark: Data([2]))
        var registry = VaultRegistry(records: [first, second], activeID: first.id)
        XCTAssertEqual(registry.listed.map { $0.active }, [true, false])
        XCTAssertFalse(registry.activate(id: "missing"))
        XCTAssertEqual(registry.activeID, first.id)
        XCTAssertTrue(registry.activate(id: second.id))

        registry.remember(StoredVaultRecord(id: first.id, name: "Renamed", bookmark: Data([3])))
        XCTAssertEqual(registry.records.map(\.id), [first.id, second.id])
        XCTAssertEqual(registry.record(id: first.id)?.name, "Renamed")
        XCTAssertEqual(registry.activeID, first.id)
        let restored = try JSONDecoder().decode([StoredVaultRecord].self, from: JSONEncoder().encode(registry.records))
        XCTAssertEqual(restored, registry.records)
    }

    func testLoginItemStatusMapsToTheExpectedUserAction() {
        XCTAssertEqual(loginItemDecision(for: .enabled), .unregister)
        XCTAssertEqual(loginItemDecision(for: .notRegistered), .register)
        XCTAssertEqual(loginItemDecision(for: .requiresApproval), .openApprovalSettings)
        XCTAssertEqual(loginItemDecision(for: .notFound), .missingApplication)
    }

    func testLaunchSessionBridgeAndRevocation() async throws {
        let resources = try resources(with: "<html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'\"></head><body>MemoCard</body></html>")
        defer { try? FileManager.default.removeItem(at: resources) }
        let server = LocalWebServer(resourceRoot: resources, authorizationEpoch: 7, handler: { message in
            ["ok": true, "result": [
                "operation": message["operation"] as? String ?? "",
                "epoch": message["_authorizationEpoch"] as? Int ?? -1,
            ]]
        }, assetHandler: { _ in throw CocoaError(.fileNoSuchFile) })
        let origin = try await server.start()
        defer { server.stop() }

        let (page, pageResponse) = try await URLSession.shared.data(from: origin)
        XCTAssertEqual((pageResponse as? HTTPURLResponse)?.statusCode, 200)
        let html = try XCTUnwrap(String(data: page, encoding: .utf8))
        XCTAssertTrue(html.contains("memocard-local-web"))
        XCTAssertFalse(html.localizedCaseInsensitiveContains("http-equiv=\"Content-Security-Policy\""))

        let launchURL = try await server.makeLaunchURL()
        let token = try launchToken(from: launchURL)
        let session = try await post(origin.appendingPathComponent("api/session"), origin: origin, body: ["token": token])
        XCTAssertEqual(session.response.statusCode, 200)
        let cookie = try XCTUnwrap(session.response.value(forHTTPHeaderField: "Set-Cookie"))
            .split(separator: ";", maxSplits: 1).first.map(String.init)

        let bridge = try await post(origin.appendingPathComponent("api/bridge"), origin: origin, cookie: cookie, body: [
            "version": 1, "requestId": "request-1", "operation": "getStatus", "params": [:],
        ])
        XCTAssertEqual(bridge.response.statusCode, 200)
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: bridge.data) as? [String: Any])
        XCTAssertEqual(payload["requestId"] as? String, "request-1")
        let result = try XCTUnwrap(payload["result"] as? [String: Any])
        XCTAssertEqual(result["operation"] as? String, "getStatus")
        XCTAssertEqual(result["epoch"] as? Int, 7)

        await server.revokeSessions()
        let revoked = try await post(origin.appendingPathComponent("api/bridge"), origin: origin, cookie: cookie, body: [
            "version": 1, "requestId": "request-2", "operation": "getStatus", "params": [:],
        ])
        XCTAssertEqual(revoked.response.statusCode, 401)
    }

    func testLaunchTokenIsSingleUse() async throws {
        let resources = try resources(with: "<html><head></head></html>")
        defer { try? FileManager.default.removeItem(at: resources) }
        let server = LocalWebServer(resourceRoot: resources, handler: { _ in [:] }, assetHandler: { _ in Data() })
        let origin = try await server.start()
        defer { server.stop() }

        let token = try launchToken(from: await server.makeLaunchURL())
        let first = try await post(origin.appendingPathComponent("api/session"), origin: origin, body: ["token": token])
        let second = try await post(origin.appendingPathComponent("api/session"), origin: origin, body: ["token": token])
        XCTAssertEqual(first.response.statusCode, 200)
        XCTAssertEqual(second.response.statusCode, 401)
    }

    func testRestartRejectsThePreviousServerSession() async throws {
        let resources = try resources(with: "<html><head></head></html>")
        defer { try? FileManager.default.removeItem(at: resources) }
        let first = LocalWebServer(resourceRoot: resources, handler: { _ in [:] }, assetHandler: { _ in Data() })
        let firstOrigin = try await first.start()
        let token = try launchToken(from: await first.makeLaunchURL())
        let session = try await post(firstOrigin.appendingPathComponent("api/session"), origin: firstOrigin, body: ["token": token])
        let cookie = try XCTUnwrap(session.response.value(forHTTPHeaderField: "Set-Cookie"))
            .split(separator: ";", maxSplits: 1).first.map(String.init)
        first.stop()

        let second = LocalWebServer(resourceRoot: resources, handler: { _ in [:] }, assetHandler: { _ in Data() })
        let secondOrigin = try await second.start()
        defer { second.stop() }
        let rejected = try await post(secondOrigin.appendingPathComponent("api/bridge"), origin: secondOrigin, cookie: cookie, body: [
            "version": 1, "requestId": "old-session", "operation": "getStatus", "params": [:],
        ])
        XCTAssertEqual(rejected.response.statusCode, 401)
    }

    func testSessionLimitKeepsExistingSessionsAndRejectsTheNextOne() async throws {
        let resources = try resources(with: "<html><head></head></html>")
        defer { try? FileManager.default.removeItem(at: resources) }
        let server = LocalWebServer(resourceRoot: resources, handler: { _ in [:] }, assetHandler: { _ in Data() })
        let origin = try await server.start()
        defer { server.stop() }

        for index in 0..<LocalWebServer.maximumSessions {
            let token = try launchToken(from: await server.makeLaunchURL())
            let result = try await post(origin.appendingPathComponent("api/session"), origin: origin, body: ["token": token])
            XCTAssertEqual(result.response.statusCode, 200, "session \(index + 1)")
        }
        let extraToken = try launchToken(from: await server.makeLaunchURL())
        let extra = try await post(origin.appendingPathComponent("api/session"), origin: origin, body: ["token": extraToken])
        XCTAssertEqual(extra.response.statusCode, 429)
    }

    func testBridgeRejectsUnknownOperationsBeforeDispatch() async throws {
        let resources = try resources(with: "<html><head></head></html>")
        defer { try? FileManager.default.removeItem(at: resources) }
        let dispatches = DispatchCounter()
        let server = LocalWebServer(resourceRoot: resources, handler: { message in
            dispatches.increment()
            return ["ok": true, "operation": message["operation"] as? String ?? ""]
        }, assetHandler: { _ in Data() })
        let origin = try await server.start()
        defer { server.stop() }
        let token = try launchToken(from: await server.makeLaunchURL())
        let session = try await post(origin.appendingPathComponent("api/session"), origin: origin, body: ["token": token])
        let cookie = try XCTUnwrap(session.response.value(forHTTPHeaderField: "Set-Cookie"))
            .split(separator: ";", maxSplits: 1).first.map(String.init)

        let result = try await post(origin.appendingPathComponent("api/bridge"), origin: origin, cookie: cookie, body: [
            "version": 1, "requestId": "unknown", "operation": "quit", "params": [:],
        ])
        XCTAssertEqual(result.response.statusCode, 400)
        XCTAssertEqual(dispatches.value, 0)
    }

    func testCachesOnlyHashedBundledAssetsAndKeepsTheEntryFresh() async throws {
        let resources = try resources(with: "<html><head></head></html>")
        defer { try? FileManager.default.removeItem(at: resources) }
        let assets = resources.appendingPathComponent("assets")
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        for name in ["entry-Ab12_cdE.js", "entry.js"] { try Data("export {};".utf8).write(to: assets.appendingPathComponent(name)) }
        let server = LocalWebServer(resourceRoot: resources, authorizationEpoch: 1, handler: { _ in [:] }, assetHandler: { _ in throw CocoaError(.fileNoSuchFile) })
        let origin = try await server.start()
        defer { server.stop() }
        for (path, expected) in [("assets/entry-Ab12_cdE.js", "private, max-age=31536000, immutable"), ("assets/entry.js", "no-store, private"), ("index.html", "no-store, private")] {
            let (_, response) = try await URLSession.shared.data(from: origin.appendingPathComponent(path))
            XCTAssertEqual((response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Cache-Control"), expected)
        }
    }

    private func resources(with html: String) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("memocard-local-web-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        try Data(html.utf8).write(to: url.appendingPathComponent("index.html"))
        return url
    }

    private func launchToken(from url: URL) throws -> String {
        let fragment = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false)?.fragment)
        return try XCTUnwrap(fragment.split(separator: "token=", maxSplits: 1).last.map(String.init))
    }

    private func post(_ url: URL, origin: URL, cookie: String? = nil, body: [String: Any]) async throws -> (data: Data, response: HTTPURLResponse) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(String(origin.absoluteString.dropLast()), forHTTPHeaderField: "Origin")
        request.setValue("same-origin", forHTTPHeaderField: "Sec-Fetch-Site")
        if let cookie { request.setValue(cookie, forHTTPHeaderField: "Cookie") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        let (data, response) = try await URLSession(configuration: configuration).data(for: request)
        return (data, try XCTUnwrap(response as? HTTPURLResponse))
    }
}

private final class DispatchCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0
    func increment() { lock.withLock { count += 1 } }
    var value: Int { lock.withLock { count } }
}
