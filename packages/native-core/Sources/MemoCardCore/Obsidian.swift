import Foundation
import Yams

struct FileIdentity: Codable {
    var id: String
    var path: String
    var hash: String
    var createdAt: String
}

func inlineTags(_ body: String) -> [String] {
    let text = body.replacingOccurrences(of: #"(?m)^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[^\n]*$"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"`+[^`\n]*`+"#, with: "", options: .regularExpression)
    let regex = try! NSRegularExpression(pattern: #"(?:^|[\s(])#([\p{L}\p{N}_/-]+)"#)
    return regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap { match in
        guard let range = Range(match.range(at: 1), in: text) else { return nil }
        let tag = String(text[range])
        return tag.range(of: #"[\p{L}_/-]"#, options: .regularExpression) == nil ? nil : tag
    }
}

func parseObsidianNote(_ data: Data, relativePath: String, vaultID: String, identity: FileIdentity, modified: Date) throws -> ParsedNote {
    guard let source = String(data: data, encoding: .utf8) else { throw VaultError(code: "INVALID_NOTE", message: "笔记必须为 UTF-8 Markdown 文件。") }
    let regex = try! NSRegularExpression(pattern: #"^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)"#)
    let match = regex.firstMatch(in: source, range: NSRange(source.startIndex..., in: source))
    var header = source.hasPrefix("\u{FEFF}") ? "\u{FEFF}" : ""
    var root = Node([(Node, Node)]())
    if let match, let whole = Range(match.range, in: source), let yaml = Range(match.range(at: 1), in: source) {
        header = String(source[whole])
        do {
            if let node = try Yams.compose(yaml: String(source[yaml])), node.null == nil {
                guard let mapping = node.mapping else { throw VaultError(code: "INVALID_FRONTMATTER", message: "YAML 属性必须是键值对象。") }
                var keys = Set<String>()
                for pair in mapping {
                    guard let key = pair.key.scalar?.string, keys.insert(key).inserted else { throw VaultError(code: "INVALID_FRONTMATTER", message: "YAML 属性包含重复或非字符串键。") }
                }
                root = node
            }
        } catch { throw VaultError(code: "INVALID_FRONTMATTER", message: "无法安全读取 YAML 属性。") }
    }
    let body = String(source.dropFirst(header.count))
    let propertyTags: [String]
    if let sequence = root["tags"]?.sequence { propertyTags = sequence.compactMap { $0.scalar?.string } }
    else { propertyTags = root["tags"]?.scalar?.string.components(separatedBy: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: ","))).filter { !$0.isEmpty } ?? [] }
    let tags = try validatedTags(propertyTags + inlineTags(body))
    return ParsedNote(note: Note(id: identity.id, body: body, tags: tags, createdAt: identity.createdAt,
        updatedAt: timestamp(modified), deletedAt: nil, contentHash: sha256(data), relativePath: relativePath,
        sourceUrl: "memocard://note/\(identity.id)?vault=\(vaultID)"), frontmatter: root, originalHeader: header)
}

func encodedObsidianNote(_ parsed: ParsedNote?, body: String, tags: [String]) throws -> Data {
    var header = parsed?.originalHeader ?? ""
    if tags != (parsed?.note.tags ?? []) {
        let properties = tags.filter { !inlineTags(body).contains($0) }
        let newline = header.contains("\r\n") ? "\r\n" : "\n"
        let json = String(data: try JSONEncoder().encode(properties), encoding: .utf8)!
        let replacement = "tags: \(json)\(newline)"
        if header.isEmpty || header == "\u{FEFF}" { header += "---\(newline)\(replacement)---\(newline)" }
        else if parsed?.frontmatter["tags"] != nil {
            let pattern = #"(?m)^tags:[^\r\n]*(?:\r?\n(?:[ \t]+[^\r\n]*|-[ \t]+[^\r\n]*))*\r?\n?"#
            let regex = try NSRegularExpression(pattern: pattern)
            guard let match = regex.firstMatch(in: header, range: NSRange(header.startIndex..., in: header)) else { throw VaultError(code: "INVALID_TAGS", message: "请在源文件中编辑此标签属性。") }
            header = (header as NSString).replacingCharacters(in: match.range, with: replacement)
        } else if let closing = header.range(of: "---", options: .backwards) { header.insert(contentsOf: replacement, at: closing.lowerBound) }
    }
    return Data((header + body).utf8)
}
