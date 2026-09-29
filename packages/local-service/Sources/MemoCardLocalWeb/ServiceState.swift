import Foundation
import ServiceManagement

public struct StoredVaultRecord: Codable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let bookmark: Data

    public init(id: String, name: String, bookmark: Data) {
        self.id = id
        self.name = name
        self.bookmark = bookmark
    }
}

public struct VaultRegistry: Equatable, Sendable {
    public private(set) var records: [StoredVaultRecord]
    public private(set) var activeID: String?

    public init(records: [StoredVaultRecord] = [], activeID: String? = nil) {
        self.records = records
        self.activeID = records.contains { $0.id == activeID } ? activeID : nil
    }

    public var listed: [(id: String, name: String, active: Bool)] {
        records.map { ($0.id, $0.name, $0.id == activeID) }
    }

    public func record(id: String) -> StoredVaultRecord? { records.first { $0.id == id } }

    public mutating func remember(_ record: StoredVaultRecord) {
        if let index = records.firstIndex(where: { $0.id == record.id }) {
            records[index] = record
        } else {
            records.append(record)
        }
        activeID = record.id
    }

    @discardableResult
    public mutating func activate(id: String) -> Bool {
        guard records.contains(where: { $0.id == id }) else { return false }
        activeID = id
        return true
    }

    public mutating func clearActive() { activeID = nil }
}

public enum LoginItemDecision: Equatable, Sendable {
    case register
    case unregister
    case openApprovalSettings
    case missingApplication
}

public func loginItemDecision(for status: SMAppService.Status) -> LoginItemDecision {
    switch status {
    case .enabled: .unregister
    case .notRegistered: .register
    case .requiresApproval: .openApprovalSettings
    case .notFound: .missingApplication
    @unknown default: .missingApplication
    }
}
