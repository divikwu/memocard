import Foundation
import Network
import Security

// Listener, peers, bootstrap tokens and sessions are confined to queue.
public final class LocalWebServer: @unchecked Sendable {
    public typealias Handler = ([String: Any]) async -> [String: Any]
    public typealias AssetHandler = (String) async throws -> Data
    private let resourceRoot: URL
    private let handler: Handler
    private let assetHandler: AssetHandler
    private let queue = DispatchQueue(label: "dev.memocard.local-web")
    private let cookieName = "memocard_" + UUID().uuidString.replacingOccurrences(of: "-", with: "")
    private var listener: NWListener?
    private var origin: String?
    private var peers: [UUID: NWConnection] = [:]
    private var bootstraps: [String: Date] = [:]
    private var sessions: Set<String> = []
    private var authorizationEpoch: Int
    private var interactivePeers: Set<UUID> = []
    public static let maximumSessions = 16
    private let maximumBodyBytes = 32 * 1024 * 1024
    private let maximumResponseBytes = 64 * 1024 * 1024
    private let maximumHeaderBytes = 16 * 1024
    private final class StartState: @unchecked Sendable { var resumed = false }
    private static let operations: Set<String> = ["getEnvironment", "getStatus", "selectVault", "listVaults", "activateVault", "queryNotes", "getNote", "getNoteProperties", "updateNoteProperty", "getPropertyLabels", "renamePropertyLabel", "listTags", "listFolders", "resolveLink", "getDrafts", "saveDraft", "dismissDraftReminder", "saveNote", "importAttachment"]

    public init(resourceRoot: URL, authorizationEpoch: Int = 0, handler: @escaping Handler, assetHandler: @escaping AssetHandler) {
        self.resourceRoot = resourceRoot.standardizedFileURL.resolvingSymlinksInPath()
        self.authorizationEpoch = authorizationEpoch
        self.handler = handler
        self.assetHandler = assetHandler
    }

    public func start() async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            queue.async { [self] in
                guard listener == nil else { continuation.resume(throwing: failure("ALREADY_RUNNING")); return }
                do {
                    let parameters = NWParameters.tcp
                    parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
                    let service = try NWListener(using: parameters)
                    listener = service
                    let startState = StartState()
                    service.stateUpdateHandler = { [weak self] state in
                        guard let self else { return }
                        switch state {
                        case .ready:
                            guard !startState.resumed, let port = service.port else { return }
                            guard self.listener === service else { startState.resumed = true; continuation.resume(throwing: self.failure("APP_NOT_RUNNING")); return }
                            startState.resumed = true
                            let address = "http://127.0.0.1:\(port.rawValue)"
                            self.origin = address
                            continuation.resume(returning: URL(string: address + "/")!)
                        case .failed(let error):
                            if !startState.resumed { startState.resumed = true; continuation.resume(throwing: error) }
                            self.invalidate(service)
                        case .cancelled:
                            if !startState.resumed { startState.resumed = true; continuation.resume(throwing: self.failure("APP_NOT_RUNNING")) }
                            self.invalidate(service)
                        default: break
                        }
                    }
                    service.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
                    service.start(queue: queue)
                } catch { continuation.resume(throwing: error) }
            }
        }
    }

    public func makeLaunchURL(revokingSessions: Bool = false) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            queue.async { [self] in
                guard let origin, listener != nil else { continuation.resume(throwing: failure("APP_NOT_RUNNING")); return }
                bootstraps = bootstraps.filter { $0.value > Date() }
                // A newly requested launch supersedes unused launch links.
                bootstraps.removeAll()
                if revokingSessions {
                    sessions.removeAll()
                    authorizationEpoch &+= 1
                }
                let token = Self.randomToken()
                bootstraps[token] = Date().addingTimeInterval(120)
                continuation.resume(returning: URL(string: origin + "/#/connect?token=" + token)!)
            }
        }
    }

    public func revokeSessions() async {
        await withCheckedContinuation { continuation in
            queue.async { [self] in
                bootstraps.removeAll()
                sessions.removeAll()
                authorizationEpoch &+= 1
                continuation.resume()
            }
        }
    }

    public func stop() {
        queue.async { [self] in
            let service = listener
            listener = nil; origin = nil
            bootstraps.removeAll(); sessions.removeAll()
            interactivePeers.removeAll()
            peers.values.forEach { $0.cancel() }; peers.removeAll()
            service?.cancel()
        }
    }

    private func invalidate(_ service: NWListener) {
        guard listener === service else { return }
        listener = nil; origin = nil
        bootstraps.removeAll(); sessions.removeAll()
        interactivePeers.removeAll()
        peers.values.forEach { $0.cancel() }; peers.removeAll()
        service.cancel()
    }

    private func accept(_ connection: NWConnection) {
        guard origin != nil, peers.count < 24 else { connection.cancel(); return }
        let id = UUID()
        peers[id] = connection
        connection.stateUpdateHandler = { [weak self] state in
            if case .failed = state { self?.peers.removeValue(forKey: id); connection.cancel() }
            if case .cancelled = state { self?.peers.removeValue(forKey: id) }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 30) { [weak self] in
            guard let self, !self.interactivePeers.contains(id) else { return }
            self.peers.removeValue(forKey: id)?.cancel()
        }
        receive(id, buffer: Data())
    }

    private struct Request {
        let method: String
        let path: String
        let headers: [String: String]
        let body: Data
    }
    private enum ParseResult {
        case incomplete
        case invalid(Int)
        case ready(Request)
    }

    private func receive(_ id: UUID, buffer: Data) {
        guard let connection = peers[id] else { return }
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] bytes, _, complete, error in
            guard let self, self.peers[id] != nil else { return }
            guard error == nil else { self.peers.removeValue(forKey: id)?.cancel(); return }
            var accumulated = buffer
            if let bytes { accumulated.append(bytes) }
            switch self.parse(accumulated) {
            case .invalid(let status): self.reply(id, status: status)
            case .incomplete:
                if complete { self.reply(id, status: 400) }
                else { self.receive(id, buffer: accumulated) }
            case .ready(let request): self.route(request, id: id)
            }
        }
    }

    private func parse(_ data: Data) -> ParseResult {
        guard let separator = data.range(of: Data("\r\n\r\n".utf8)) else {
            return data.count > maximumHeaderBytes ? .invalid(431) : .incomplete
        }
        guard separator.lowerBound <= maximumHeaderBytes,
              let head = String(data: data[..<separator.lowerBound], encoding: .ascii) else { return .invalid(400) }
        let lines = head.components(separatedBy: "\r\n")
        guard lines.count <= 65, let first = lines.first else { return .invalid(400) }
        let fields = first.split(separator: " ", omittingEmptySubsequences: false)
        guard fields.count == 3, fields[2] == "HTTP/1.1", fields[1].hasPrefix("/"), !fields[1].hasPrefix("//") else { return .invalid(400) }
        var headers: [String: String] = [:]
        for line in lines.dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { return .invalid(400) }
            let name = String(line[..<colon]).lowercased()
            guard !name.isEmpty, name.utf8.allSatisfy({ (97...122).contains($0) || (48...57).contains($0) || $0 == 45 }), headers[name] == nil else { return .invalid(400) }
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            guard value.utf8.allSatisfy({ $0 >= 32 && $0 < 127 }) else { return .invalid(400) }
            headers[name] = value
        }
        guard headers["transfer-encoding"] == nil, headers["expect"] == nil else { return .invalid(400) }
        guard let origin, headers["host"] == String(origin.dropFirst("http://".count)) else { return .invalid(403) }
        let method = String(fields[0])
        guard method == "GET" || method == "POST" else { return .invalid(405) }
        let length: Int
        if let declared = headers["content-length"] {
            guard !declared.isEmpty, declared.utf8.allSatisfy({ (48...57).contains($0) }), let value = Int(declared) else { return .invalid(400) }
            guard value <= maximumBodyBytes else { return .invalid(413) }
            length = value
        } else {
            guard method == "GET" else { return .invalid(411) }
            length = 0
        }
        guard method != "GET" || length == 0 else { return .invalid(400) }
        if method == "POST" {
            guard headers["origin"] == origin, sameOriginFetch(headers), headers["content-type"]?.split(separator: ";").first?.trimmingCharacters(in: .whitespaces).lowercased() == "application/json" else { return .invalid(403) }
        }
        let actual = data.count - separator.upperBound
        guard actual <= length else { return .invalid(400) }
        guard actual == length else { return .incomplete }
        let rawPath = String(fields[1])
        guard !rawPath.contains("?"), !rawPath.contains("#"), let path = rawPath.removingPercentEncoding,
              !path.contains("\\"), !path.contains("\0"),
              path.split(separator: "/", omittingEmptySubsequences: false).dropFirst().allSatisfy({ !$0.isEmpty || path == "/" }) else { return .invalid(400) }
        let segments = path.split(separator: "/")
        guard !segments.contains("."), !segments.contains(".."), !path.hasPrefix("//") else { return .invalid(400) }
        return .ready(Request(method: method, path: path, headers: headers, body: Data(data[separator.upperBound...])))
    }

    private func route(_ request: Request, id: UUID) {
        if request.method == "POST", request.path == "/api/session" {
            guard let params = try? JSONSerialization.jsonObject(with: request.body) as? [String: Any], let token = params["token"] as? String,
                  let expires = bootstraps.removeValue(forKey: token), expires > Date() else { reply(id, status: 401); return }
            // Bound independently authorized browser sessions; existing sessions stay valid.
            let existingSession = authenticatedSession(request.headers)
            guard existingSession != nil || sessions.count < Self.maximumSessions else { reply(id, status: 429); return }
            let session = existingSession ?? Self.randomToken(); sessions.insert(session)
            replyJSON(id, value: ["ok": true], headers: ["Set-Cookie": "\(cookieName)=\(session); Path=/; HttpOnly; SameSite=Strict"])
            return
        }
        if request.path.hasPrefix("/api/") {
            guard authorized(request.headers), sameOriginFetch(request.headers) else { reply(id, status: 401); return }
            if request.method == "POST", request.path == "/api/bridge" {
                guard let message = try? JSONSerialization.jsonObject(with: request.body) as? [String: Any],
                      message["version"] as? Int == 1, let requestID = message["requestId"] as? String, !requestID.isEmpty, requestID.count <= 256,
                      let operation = message["operation"] as? String, Self.operations.contains(operation), message["params"] is [String: Any] else {
                    replyJSON(id, status: 400, value: ["ok": false, "error": ["code": "INVALID_ARGUMENT", "message": "Unsupported browser operation", "retryable": false]])
                    return
                }
                var dispatched = message
                dispatched["_authorizationEpoch"] = authorizationEpoch
                if operation == "selectVault" { interactivePeers.insert(id) }
                Task { [self] in
                    var response = await handler(dispatched)
                    response["requestId"] = requestID
                    let bytes = try? JSONSerialization.data(withJSONObject: response)
                    queue.async { [self] in
                        guard let bytes, bytes.count <= maximumResponseBytes else { reply(id, status: 413); return }
                        reply(id, status: 200, body: bytes, mime: "application/json; charset=utf-8")
                    }
                }
                return
            }
            if request.method == "GET", request.path.hasPrefix("/api/assets/") {
                let path = String(request.path.dropFirst("/api/assets/".count))
                guard let mime = Self.imageMIME(URL(fileURLWithPath: path).pathExtension) else { reply(id, status: 404); return }
                Task { [self] in
                    do {
                        let bytes = try await assetHandler(path)
                        queue.async { [self] in
                            guard bytes.count <= maximumResponseBytes else { reply(id, status: 413); return }
                            reply(id, status: 200, body: bytes, mime: mime)
                        }
                    } catch { queue.async { [self] in reply(id, status: 404) } }
                }
                return
            }
            reply(id, status: 404); return
        }
        guard request.method == "GET" else { reply(id, status: 404); return }
        let relative = request.path == "/" ? "index.html" : String(request.path.dropFirst())
        let url = resourceRoot.appendingPathComponent(relative).standardizedFileURL.resolvingSymlinksInPath()
        guard url.path.hasPrefix(resourceRoot.path + "/"),
              let mime = Self.resourceMIME(url.pathExtension), url.pathExtension.lowercased() != "html" || relative == "index.html" else { reply(id, status: 404); return }
        Task { [self] in
            var bytes = try? Data(contentsOf: url, options: .mappedIfSafe)
            if relative == "index.html", let data = bytes, var html = String(data: data, encoding: .utf8) {
                // Vite HTML-escapes CSP values. Remove the native-only meta policy;
                // the HTTP response supplies the complete browser policy instead.
                html = html.replacingOccurrences(of: #"(?i)<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']content-security-policy["'])[^>]*>"#, with: "", options: .regularExpression)
                html = html.replacingOccurrences(of: "<head>", with: "<head><meta name=\"memocard-local-web\" content=\"1\">")
                bytes = Data(html.utf8)
            }
            let payload = bytes
            queue.async { [self] in
                guard let payload, payload.count <= maximumResponseBytes else { reply(id, status: 404); return }
                let hashedAsset = relative.hasPrefix("assets/") && relative.range(of: #"-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|svg|png|jpe?g)$"#, options: .regularExpression) != nil
                reply(id, status: 200, body: payload, mime: mime, headers: hashedAsset ? ["Cache-Control": "private, max-age=31536000, immutable"] : [:])
            }
        }
    }

    private func authorized(_ headers: [String: String]) -> Bool { authenticatedSession(headers) != nil }
    private func authenticatedSession(_ headers: [String: String]) -> String? {
        guard let cookie = headers["cookie"] else { return nil }
        let values = cookie.split(separator: ";").compactMap { field -> String? in
            let pair = field.trimmingCharacters(in: .whitespaces).split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            return pair.count == 2 && pair[0] == cookieName ? String(pair[1]) : nil
        }
        return values.count == 1 && sessions.contains(values[0]) ? values[0] : nil
    }
    private func sameOriginFetch(_ headers: [String: String]) -> Bool {
        headers["sec-fetch-site"] == nil || headers["sec-fetch-site"] == "same-origin"
    }
    private func replyJSON(_ id: UUID, status: Int = 200, value: [String: Any], headers: [String: String] = [:]) {
        reply(id, status: status, body: (try? JSONSerialization.data(withJSONObject: value)) ?? Data(), mime: "application/json; charset=utf-8", headers: headers)
    }
    private func reply(_ id: UUID, status: Int, body: Data = Data(), mime: String = "text/plain; charset=utf-8", headers: [String: String] = [:]) {
        guard let connection = peers[id], origin != nil else { return }
        let reason = [200: "OK", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed", 411: "Length Required", 413: "Content Too Large", 429: "Too Many Requests", 431: "Request Header Fields Too Large"][status] ?? "Error"
        var fields = [
            "Content-Type": mime, "Content-Length": String(body.count), "Connection": "close",
            "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        ]
        fields.merge(headers) { _, new in new }
        let head = "HTTP/1.1 \(status) \(reason)\r\n" + fields.sorted { $0.key < $1.key }.map { "\($0.key): \($0.value)\r\n" }.joined() + "\r\n"
        connection.send(content: Data(head.utf8) + body, completion: .contentProcessed { [weak self] _ in
            self?.interactivePeers.remove(id)
            self?.peers.removeValue(forKey: id)?.cancel()
        })
    }
    private static func imageMIME(_ suffix: String) -> String? {
        ["png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp", "gif": "image/gif", "heic": "image/heic", "heif": "image/heif"][suffix.lowercased()]
    }
    private static func resourceMIME(_ suffix: String) -> String? {
        ["html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "woff": "font/woff", "woff2": "font/woff2", "svg": "image/svg+xml"][suffix.lowercased()] ?? imageMIME(suffix)
    }
    private static func randomToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        precondition(SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }
    private func failure(_ code: String) -> Error { NSError(domain: code, code: 1) }
}
