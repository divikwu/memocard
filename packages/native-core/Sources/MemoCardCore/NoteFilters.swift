import Foundation

enum NoteQuickFilter: String, Codable { case untagged, images, links }

// Keep the same grammar in apps/ui/src/note-filters.ts.
func noteQuickFilters(_ note: Note) -> Set<NoteQuickFilter> {
    var text = note.body
        .replacingOccurrences(of: #"<!--[\s\S]*?-->"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"(?m)^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*(?:\n|$)|(?![\s\S]))"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"(?m)^(?: {4}|\t).*$"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"(`+)[\s\S]*?\1"#, with: "", options: .regularExpression)
    let definitions = try! NSRegularExpression(pattern: #"(?m)^ {0,3}\[(?!\^)([^\]\n]+)\]:\s*(\S+).*$"#)
    var references: [String: String] = [:]
    for match in definitions.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
        let label = (text as NSString).substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespaces).lowercased()
        references[label] = (text as NSString).substring(with: match.range(at: 2))
    }
    text = definitions.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: "")
    let uses = try! NSRegularExpression(pattern: #"(!?)\[([^\]\n]+)\](?:\[([^\]\n]*)\])?(?!\(|\[)"#)
    for match in uses.matches(in: text, range: NSRange(text.startIndex..., in: text)).reversed() {
        let source = text as NSString
        let label = source.substring(with: match.range(at: 2))
        let reference = match.range(at: 3).location == NSNotFound ? "" : source.substring(with: match.range(at: 3))
        if let target = references[(reference.isEmpty ? label : reference).trimmingCharacters(in: .whitespaces).lowercased()] {
            text = source.replacingCharacters(in: match.range, with: "\(source.substring(with: match.range(at: 1)))[\(label)](\(target))")
        }
    }
    let images = #"(?i)!\[[^\]\n]*\]\([^)\n]+\)|!\[\[[^\]\n]+\.(?:png|jpe?g|webp|gif|heic|heif)(?:\|[^\]\n]*)?\]\]|<img\b[^>]*>"#
    let links = text.replacingOccurrences(of: images, with: "", options: .regularExpression)
    var filters = Set<NoteQuickFilter>()
    if note.tags.isEmpty { filters.insert(.untagged) }
    if text.range(of: images, options: .regularExpression) != nil { filters.insert(.images) }
    if links.range(of: #"(?i)\[[^\]\n]+\]\([^)\n]+\)|\[\[[^\]\n]+\]\]|(?:https?://|www\.)[^\s<>]+|<a\b[^>]*\bhref\s*="#, options: .regularExpression) != nil { filters.insert(.links) }
    return filters
}
