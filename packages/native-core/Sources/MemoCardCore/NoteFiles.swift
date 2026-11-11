import Foundation

func fileTitle(_ path: String) -> String { (path as NSString).lastPathComponent.replacingOccurrences(of: #"\.md$"#, with: "", options: [.regularExpression, .caseInsensitive]) }

private let legacyTitlePrefix = "# memocard:title="
private let bodyTitleLine = try! NSRegularExpression(pattern: #"^((?:[ \t]*\r?\n)*)<!-- memocard:title=([^ \r\n]+) -->(?:\r?\n|$)"#)

private func legacyNoteTitle(_ header: String) -> String? {
    guard let opening = header.firstIndex(where: \.isNewline) else { return nil }
    let rest = header[header.index(after: opening)...]
    guard rest.hasPrefix(legacyTitlePrefix), let end = rest.firstIndex(where: \.isNewline) else { return nil }
    let encoded = String(rest[..<end].dropFirst(legacyTitlePrefix.count))
    return encoded.isEmpty ? nil : encoded.removingPercentEncoding
}

func noteContent(_ body: String, path: String, header: String) -> (title: String, body: String) {
    if let match = bodyTitleLine.firstMatch(in: body, range: NSRange(body.startIndex..., in: body)),
       let line = Range(match.range, in: body), let blanks = Range(match.range(at: 1), in: body),
       let encoded = Range(match.range(at: 2), in: body), let title = body[encoded].removingPercentEncoding {
        return (title, String(body[blanks]) + body[line.upperBound...])
    }
    return (legacyNoteTitle(header) ?? fileTitle(path), body)
}

func noteTitleOverride(_ title: String?, original: ParsedNote?, path: String) -> String? {
    guard let title = title ?? original?.note.title else { return nil }
    return title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || title.utf8.elementsEqual(fileTitle(path).utf8) ? nil : title
}

func withoutLegacyNoteTitle(_ header: String) -> String {
    guard let opening = header.firstIndex(where: \.isNewline) else { return header }
    let rest = header[header.index(after: opening)...]
    guard rest.hasPrefix(legacyTitlePrefix), let end = rest.firstIndex(where: \.isNewline) else { return header }
    let content = rest[rest.index(after: end)...]
    if content == "---" || content == "---\n" || content == "---\r\n" {
        return header.hasPrefix("\u{FEFF}") ? "\u{FEFF}" : ""
    }
    return String(header[...opening]) + content
}

func bodyWithNoteTitle(_ body: String, title: String?, newline: String) -> String {
    guard let title else { return body }
    // Keep title metadata outside YAML so an external property edit can rewrite the header.
    let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
    return "<!-- memocard:title=" + title.addingPercentEncoding(withAllowedCharacters: allowed)! + " -->" + newline + body
}

func safeNoteTitle(_ title: String) -> String {
    var value = title.precomposedStringWithCanonicalMapping.replacingOccurrences(of: #"[\\/:*?"<>|#^\[\]\x00-\x1f\x7f]"#, with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: ". "))
    if value.range(of: #"^(con|prn|aux|nul|(?:com|lpt)[1-9¹²³])(?:\.|$)"#, options: [.regularExpression, .caseInsensitive]) != nil { value = "_" + value }
    while value.utf8.count > 200 { value.removeLast() }
    return value.isEmpty ? "新内容" : value
}

func namedNotePath(_ path: String, title: String, paths: [String]) -> String {
    let directory = path.split(separator: "/").dropLast().joined(separator: "/")
    let prefix = directory.isEmpty ? "" : directory + "/", base = safeNoteTitle(title)
    let occupied = Set(paths.filter { $0 != path }.map { $0.precomposedStringWithCanonicalMapping.lowercased() })
    var next = prefix + base + ".md", count = 2
    while occupied.contains(next.precomposedStringWithCanonicalMapping.lowercased()) { next = prefix + base + " (\(count)).md"; count += 1 }
    return next
}

func noteLinkCandidates(_ target: String, sourcePath: String, paths: [String], wiki: Bool) -> [String] {
    guard let decoded = wiki ? target : target.removingPercentEncoding, !decoded.isEmpty, !decoded.contains("\\"), !decoded.contains(":"), !decoded.unicodeScalars.contains(where: { $0.value < 32 }) else { return [] }
    func normalized(_ value: String) -> String? {
        var parts: [String] = []
        for part in value.split(separator: "/", omittingEmptySubsequences: false) {
            if part == "." || part.isEmpty { continue }
            if part == ".." { guard !parts.isEmpty else { return nil }; parts.removeLast() }
            else { guard !part.hasPrefix(".") else { return nil }; parts.append(String(part)) }
        }
        return parts.joined(separator: "/")
    }
    let directory = sourcePath.split(separator: "/").dropLast().joined(separator: "/")
    let relative = directory.isEmpty ? decoded : directory + "/" + decoded
    for candidate in wiki ? [decoded, relative] : [relative, decoded] {
        if let path = normalized(candidate) {
            let exact = paths.filter { $0 == path }
            if !exact.isEmpty { return exact }
            let markdown = paths.filter { $0 == path + ".md" }
            if !markdown.isEmpty { return markdown }
        }
    }
    if wiki && !decoded.hasPrefix("/") && !decoded.split(separator: "/").contains(where: { $0.hasPrefix(".") }) {
        let exact = paths.filter { $0.hasSuffix("/" + decoded) }
        return exact.isEmpty ? paths.filter { $0.hasSuffix("/" + decoded + ".md") } : exact
    }
    return []
}

func rewriteNoteLinks(_ source: String, sourcePath: String, paths: [String], renames: [String: String]) -> String {
    let text = source as NSString, full = NSRange(location: 0, length: text.length)
    let literals = try! NSRegularExpression(pattern: #"(?m)^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*(?:\n|$)|(?![\s\S]))|`+[^`\n]*`+|^ {4}[^\n]*|<!--[\s\S]*?-->"#)
    var protected = literals.matches(in: source, range: full).map(\.range)
    let header = try! NSRegularExpression(pattern: #"^(?:\uFEFF)?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)"#)
    if let match = header.firstMatch(in: source, range: full) { protected.append(match.range) }
    func destination(_ target: String, wiki: Bool) -> String {
        let components = target.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)
        let raw = String(components[0]), fragment = components.count > 1 ? "#" + components[1] : ""
        let matches = noteLinkCandidates(raw, sourcePath: sourcePath, paths: paths, wiki: wiki)
        guard matches.count == 1, var next = renames[matches[0]] else { return target }
        if !raw.lowercased().hasSuffix(".md") && !fileTitle(next).lowercased().hasSuffix(".md") { next = String(next.dropLast(3)) }
        if !wiki {
            var directory = sourcePath.split(separator: "/").dropLast().map(String.init), parts = next.split(separator: "/").map(String.init)
            while !directory.isEmpty && !parts.isEmpty && directory[0] == parts[0] { directory.removeFirst(); parts.removeFirst() }
            let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
            next = (Array(repeating: "..", count: directory.count) + parts).map { $0.addingPercentEncoding(withAllowedCharacters: allowed)! }.joined(separator: "/")
        }
        return next + fragment
    }
    let pattern = try! NSRegularExpression(pattern: #"(?m)!?\[\[([^\]\n]+)\]\]|!?\[(?:\\.|[^\]\\\n])*\]\([ \t]*(<[^>\n]+>|(?:\\.|[^\s()\\]|\([^()\n]*\))+)(?=[\s)])|^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]+>|[^\s\n]+)"#)
    let result = NSMutableString(string: source)
    for match in pattern.matches(in: source, range: full).reversed() {
        if protected.contains(where: { NSLocationInRange(match.range.location, $0) }) { continue }
        if match.range(at: 1).location != NSNotFound {
            let range = match.range(at: 1), value = text.substring(with: range)
            let parts = value.split(separator: "|", maxSplits: 1, omittingEmptySubsequences: false)
            result.replaceCharacters(in: range, with: destination(String(parts[0]), wiki: true) + (parts.count > 1 ? "|" + parts[1] : ""))
        } else {
            let range = match.range(at: match.range(at: 2).location == NSNotFound ? 3 : 2), value = text.substring(with: range), angle = value.hasPrefix("<")
            let target = angle ? String(value.dropFirst().dropLast()) : value, next = destination(target, wiki: false)
            result.replaceCharacters(in: range, with: angle ? "<" + next + ">" : next)
        }
    }
    return result as String
}
