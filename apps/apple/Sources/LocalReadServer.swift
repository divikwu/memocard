import Foundation
import Network
import Security

// Mutable network state is confined to queue after start; credential fields are immutable.
final class LocalReadServer: @unchecked Sendable {
    typealias Handler = (String, [String: Any]) async -> [String: Any]
    private let vaultId: String
    private let instanceId = UUID().uuidString
    private let token: String
    private let handler: Handler
    private let queue = DispatchQueue(label: "dev.memocard.local-read")
    private var listener: NWListener?
    private var startResumed = false
    private var peers: [UUID: NWConnection] = [:]
    private let maxRequestBytes = 8 * 1024 * 1024
    // JSON escaping can expand a supported 8 MiB Markdown note up to sixfold.
    private let maxResponseBytes = 64 * 1024 * 1024

    init(vaultId: String, handler: @escaping Handler) {
        self.vaultId = vaultId; self.handler = handler
        var random = [UInt8](repeating: 0, count: 32)
        precondition(SecRandomCopyBytes(kSecRandomDefault, random.count, &random) == errSecSuccess)
        token = random.map { String(format: "%02x", $0) }.joined()
    }
    func start() async throws -> [String: Any] {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
        let service = try NWListener(using: parameters)
        listener = service
        return try await withCheckedThrowingContinuation { continuation in
            service.stateUpdateHandler = { [weak self] state in
                guard let self else { return }
                switch state {
                case .ready:
                    guard !startResumed, let port = service.port else { return }; startResumed = true
                    continuation.resume(returning: ["version": 1, "host": "127.0.0.1", "port": Int(port.rawValue), "token": token, "instanceId": instanceId, "vaultId": vaultId])
                case .failed(let error):
                    if !startResumed { startResumed = true; continuation.resume(throwing: error) }
                    service.cancel()
                case .cancelled:
                    if !startResumed { startResumed = true; continuation.resume(throwing: NSError(domain: "APP_NOT_RUNNING", code: 1)) }
                default: break
                }
            }
            service.newConnectionHandler = { [weak self] connection in self?.accept(connection) }
            service.start(queue: queue)
        }
    }
    func stop() {
        queue.async { [self] in
            listener?.cancel(); listener = nil
            peers.values.forEach { $0.cancel() }; peers.removeAll()
        }
    }
    private func accept(_ connection: NWConnection) {
        guard peers.count < 16 else { connection.cancel(); return }
        let id = UUID(); peers[id] = connection
        connection.stateUpdateHandler = { [weak self] state in
            if case .failed = state { self?.peers.removeValue(forKey: id); connection.cancel() }
            if case .cancelled = state { self?.peers.removeValue(forKey: id) }
        }
        connection.start(queue: queue)
        queue.asyncAfter(deadline: .now() + 15) { [weak self] in self?.peers[id]?.cancel(); self?.peers.removeValue(forKey: id) }
        receive(connection, buffer: Data(), count: 0)
    }
    private func receive(_ connection: NWConnection, buffer: Data, count: Int) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] bytes, _, complete, error in
            guard let self, error == nil else { connection.cancel(); return }
            var accumulated = buffer
            if let bytes { accumulated.append(bytes) }
            drain(connection, buffer: accumulated, count: count, complete: complete)
        }
    }
    private func drain(_ connection: NWConnection, buffer: Data, count: Int, complete: Bool) {
        // EOF ends input, not already buffered requests. Limit each JSON frame, excluding its newline.
        if let newline = buffer.firstIndex(of: 10) {
            guard count < 32, buffer.distance(from: buffer.startIndex, to: newline) <= maxRequestBytes else { connection.cancel(); return }
            let line = Data(buffer[..<newline]), tail = Data(buffer[buffer.index(after: newline)...])
            Task { [self] in
                let reply = await respond(line)
                guard var data = try? JSONSerialization.data(withJSONObject: reply) else { connection.cancel(); return }
                if data.count > maxResponseBytes {
                    let failure = error("RESPONSE_TOO_LARGE", "Native response exceeds the 64 MiB frame limit", id: reply["requestId"] as? String ?? "")
                    guard let encoded = try? JSONSerialization.data(withJSONObject: failure) else { connection.cancel(); return }
                    data = encoded
                }
                connection.send(content: data + Data([10]), completion: .contentProcessed { [weak self] error in
                    if error != nil { connection.cancel() } else { self?.drain(connection, buffer: tail, count: count + 1, complete: complete) }
                })
            }
        } else if complete || buffer.count > maxRequestBytes { connection.cancel() }
        else { receive(connection, buffer: buffer, count: count) }
    }
    private func respond(_ data: Data) async -> [String: Any] {
        guard let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let requestId = request["requestId"] as? String else { return error("INVALID_ARGUMENT", "Invalid request", id: "") }
        guard request["version"] as? Int == 1,
              secureEquals(request["token"] as? String ?? "", token),
              request["instanceId"] as? String == instanceId,
              request["vaultId"] as? String == vaultId else { return error("UNAUTHORIZED", "Connection authorization expired", id: requestId) }
        guard let operation = request["operation"] as? String, ["getStatus", "queryNotes", "getNote", "listTags"].contains(operation),
              let params = request["params"] as? [String: Any] else { return error("INVALID_ARGUMENT", "Read-only operation required", id: requestId) }
        var reply = await handler(operation, params); reply["requestId"] = requestId; return reply
    }
    private func error(_ code: String, _ message: String, id: String) -> [String: Any] {
        ["requestId": id, "ok": false, "error": ["code": code, "message": message, "retryable": false]]
    }
    private func secureEquals(_ left: String, _ right: String) -> Bool {
        let a = Array(left.utf8), b = Array(right.utf8)
        guard a.count == b.count else { return false }
        return zip(a, b).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }
}
