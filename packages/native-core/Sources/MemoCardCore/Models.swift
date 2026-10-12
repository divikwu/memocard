import Foundation
import CryptoKit
import Yams

public struct VaultError: Error, LocalizedError, Codable, Sendable {
    public let code: String
    public let message: String
    public let retryable: Bool

    public init(code: String, message: String, retryable: Bool = false) {
        self.code = code
        self.message = message
        self.retryable = retryable
    }

    public var errorDescription: String? { message }
}

struct Note: Encodable {
    let title: String?
    let id: String
    let body: String
    let tags: [String]
    let createdAt: String
    let updatedAt: String
    let deletedAt: String?
    let contentHash: String
    let relativePath: String
    let sourceUrl: String
}

struct IndexingProgress: Encodable {
    var phase: String
    var processed: Int
    var total: Int?
    private enum CodingKeys: String, CodingKey { case phase, processed, total }
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(phase, forKey: .phase)
        try values.encode(processed, forKey: .processed)
        try values.encode(total, forKey: .total)
    }
}

struct Coverage: Encodable {
    var complete: Bool
    var indexed: Int
    var pending: Int
    var issues: Int
    var indexedAt: String?

    private enum CodingKeys: String, CodingKey { case complete, indexed, pending, issues, indexedAt }
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(complete, forKey: .complete)
        try values.encode(indexed, forKey: .indexed)
        try values.encode(pending, forKey: .pending)
        try values.encode(issues, forKey: .issues)
        try values.encode(indexedAt, forKey: .indexedAt)
    }
}

struct VaultMetadata: Codable {
    let formatVersion: Int
    let vaultId: String
}

struct SaveRequest: Codable {
    let title: String?
    let id: String
    let body: String
    let tags: [String]
    let inheritedTags: [String]?
    let baseHash: String?
    let relativePath: String?
    var pendingProperties: [PropertyChange]? = nil
    var draftKey: String? = nil
    var recoveredFrom: RecoverySource? = nil
}

struct RecoverySource: Codable {
    let draftKey: String
    let revision: String
    var unscoped: Bool? = nil
    var scope: String? = nil
}

struct Draft: Codable {
    let title: String?
    let id: String
    let body: String
    let tags: [String]
    let inheritedTags: [String]?
    let baseHash: String?
    let relativePath: String?
    let updatedAt: String
    var pendingProperties: [PropertyChange]? = nil
    var draftKey: String? = nil
    var revision: String? = nil
    var unscoped: Bool? = nil
    var recoveryScope: String? = nil
    var reminderDismissed: Bool? = nil

    private enum CodingKeys: String, CodingKey { case title, id, body, tags, inheritedTags, pendingProperties, baseHash, relativePath, updatedAt, draftKey, revision, unscoped, recoveryScope, reminderDismissed }
    func encode(to encoder: Encoder) throws {
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encodeIfPresent(title, forKey: .title)
        try values.encode(id, forKey: .id)
        try values.encode(body, forKey: .body)
        try values.encode(tags, forKey: .tags)
        try values.encodeIfPresent(inheritedTags, forKey: .inheritedTags)
        try values.encodeIfPresent(pendingProperties, forKey: .pendingProperties)
        try values.encode(baseHash, forKey: .baseHash)
        try values.encodeIfPresent(relativePath, forKey: .relativePath)
        try values.encode(updatedAt, forKey: .updatedAt)
        try values.encodeIfPresent(draftKey, forKey: .draftKey)
        try values.encodeIfPresent(revision, forKey: .revision)
        try values.encodeIfPresent(unscoped, forKey: .unscoped)
        try values.encodeIfPresent(recoveryScope, forKey: .recoveryScope)
        try values.encodeIfPresent(reminderDismissed, forKey: .reminderDismissed)
    }
}

struct Query: Codable {
    var folder: String?
    var query: String?
    var tags: [String]?
    var quickFilter: NoteQuickFilter?
    var from: String?
    var to: String?
    var limit: Int?
    var cursor: String?
    var deleted: Bool?
}

struct PageCursor: Codable {
    let createdAt: String
    let id: String
    let queryHash: String
    let snapshotHash: String
}

struct ParsedNote {
    let note: Note
    var frontmatter: Node
    let createdDate: Date
    var originalHeader: String? = nil
}

func sha256(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}

func canonicalID(_ value: String) throws -> String {
    guard let id = UUID(uuidString: value), id.uuidString.lowercased() == value.lowercased() else {
        throw VaultError(code: "INVALID_ID", message: "笔记或笔记库 ID 必须是标准 UUID。")
    }
    return id.uuidString.lowercased()
}

// ISO formatter construction is expensive during an initial library scan. Keep the
// two immutable formats shared, and serialize access across independent vault actors.
private final class VaultDateFormats: @unchecked Sendable {
    static let shared = VaultDateFormats()
    private let lock = NSLock()
    private let fractional = ISO8601DateFormatter()
    private let whole = ISO8601DateFormatter()
    private init() {
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        whole.formatOptions = [.withInternetDateTime]
    }
    func string(_ date: Date) -> String {
        lock.lock(); defer { lock.unlock() }
        return fractional.string(from: date)
    }
    func date(_ value: String) -> Date? {
        lock.lock(); defer { lock.unlock() }
        return fractional.date(from: value) ?? whole.date(from: value)
    }
}

func timestamp(_ date: Date = Date()) -> String {
    VaultDateFormats.shared.string(date)
}

func parseDate(_ value: String) throws -> Date {
    let pattern = #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$"#
    guard value.range(of: pattern, options: .regularExpression) != nil else {
        throw VaultError(code: "INVALID_DATE", message: "日期必须是包含时区的 ISO 8601 时间。")
    }
    let parts = value.prefix(10).split(separator: "-").compactMap { Int($0) }
    let clock = value.dropFirst(11).prefix(8).split(separator: ":").compactMap { Int($0) }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    let first = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: 1))
    guard (1...12).contains(parts[1]), (0...23).contains(clock[0]),
          (0...59).contains(clock[1]), (0...59).contains(clock[2]), let first,
          let days = calendar.range(of: .day, in: .month, for: first), days.contains(parts[2]) else {
        throw VaultError(code: "INVALID_DATE", message: "日期无效。")
    }
    guard let date = VaultDateFormats.shared.date(value) else {
        throw VaultError(code: "INVALID_DATE", message: "日期无效。")
    }
    return date
}

func validatedTags(_ tags: [String]) throws -> [String] {
    guard tags.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !$0.contains("\n") }) else {
        throw VaultError(code: "INVALID_TAGS", message: "标签不能为空或包含换行。")
    }
    var seen = Set<String>()
    return tags.map(tagKey).filter { seen.insert($0).inserted }
}

func parseNote(_ data: Data, relativePath: String, vaultID: String) throws -> ParsedNote {
    guard let source = String(data: data, encoding: .utf8) else {
        throw VaultError(code: "INVALID_NOTE", message: "笔记必须为 UTF-8 Markdown 文件。")
    }
    // Normalize line endings only for parsing; hashes always cover the original bytes.
    let text = source.replacingOccurrences(of: "\r\n", with: "\n")
    guard text.hasPrefix("---\n"), let end = text.range(of: #"\n---(?:\n|$)"#, options: .regularExpression,
        range: text.index(text.startIndex, offsetBy: 4)..<text.endIndex) else {
        throw VaultError(code: "INVALID_FRONTMATTER", message: "笔记需要完整的 YAML frontmatter。")
    }
    let yaml = String(text[text.index(text.startIndex, offsetBy: 4)..<end.lowerBound])
    let root: Node
    do {
        guard let parsed = try Yams.compose(yaml: yaml), let mapping = parsed.mapping else {
            throw VaultError(code: "INVALID_FRONTMATTER", message: "Frontmatter 必须是键值对象。")
        }
        var keys = Set<String>()
        for pair in mapping {
            guard let key = pair.key.scalar?.string, keys.insert(key).inserted else {
                throw VaultError(code: "INVALID_FRONTMATTER", message: "Frontmatter 包含重复或非字符串键。")
            }
        }
        root = parsed
    } catch let error as VaultError { throw error }
    catch { throw VaultError(code: "INVALID_FRONTMATTER", message: "无法解析 YAML frontmatter。") }
    guard let rawID = root["id"]?.scalar?.string,
          let created = root["createdAt"]?.scalar?.string,
          let updated = root["updatedAt"]?.scalar?.string else {
        throw VaultError(code: "INVALID_FRONTMATTER", message: "笔记缺少 id、createdAt 或 updatedAt。")
    }
    let id = try canonicalID(rawID)
    let createdDate = try parseDate(created)
    _ = try parseDate(updated)
    var deleted: String?
    if let value = root["deletedAt"], value.null == nil {
        guard let date = value.scalar?.string else {
            throw VaultError(code: "INVALID_DATE", message: "deletedAt 必须为时间字符串。")
        }
        _ = try parseDate(date)
        deleted = date
    }
    let body = String(text[end.upperBound...])
    let tags = try validatedTags(propertyTags(root["tags"]) + inlineTags(body))
    return ParsedNote(note: Note(
        title: fileTitle(relativePath), id: id, body: body, tags: tags, createdAt: created, updatedAt: updated,
        deletedAt: deleted, contentHash: sha256(data), relativePath: relativePath,
        sourceUrl: "memocard://note/\(id)?vault=\(vaultID)"
    ), frontmatter: root, createdDate: createdDate, originalHeader: String(text[..<end.upperBound]))
}

func encodedNote(frontmatter: Node, body: String, originalHeader: String? = nil) throws -> Data {
    let yaml = try preservingPropertyTypes(Yams.serialize(node: frontmatter, allowUnicode: true), originalHeader: originalHeader)
    return Data(("---\n" + yaml + "---\n" + body).utf8)
}

func encode<T: Encodable>(_ value: T) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return try encoder.encode(value)
}

func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
    do { return try JSONDecoder().decode(type, from: data) }
    catch { throw VaultError(code: "INVALID_PARAMS", message: "请求参数不符合操作约定。") }
}
