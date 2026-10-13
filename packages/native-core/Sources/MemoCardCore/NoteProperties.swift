import Foundation
import Yams

struct PropertyChange: Codable {
    let id: String
    let baseHash: String
    let name: String
    let type: String?
    let value: PropertyValue?
    let remove: Bool?
    var create: Bool?
    var options: [PropertyOption]? = nil
    var renameTo: String? = nil
    var definition: Bool? = nil
    var definitionHash: String? = nil
    var optionRename: OptionRename? = nil
    var copyFrom: String? = nil
}
enum PropertyValue: Codable {
    case text(String), list([String]), checkbox(Bool)
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Bool.self) { self = .checkbox(value) }
        else if let value = try? container.decode([String].self) { self = .list(value) }
        else { self = .text(try container.decode(String.self)) }
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self { case .text(let value): try container.encode(value); case .list(let value): try container.encode(value); case .checkbox(let value): try container.encode(value) }
    }
}
struct PropertyOption: Codable {
    let name: String
    let color: String
}
private struct ChoiceMetadata: Codable {
    let type: String
    let options: [PropertyOption]
}
func validOptions(_ options: [PropertyOption]) -> Bool {
    let colors: Set<String> = ["default", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]
    return options.count <= 200 && Set(options.map(\.name)).count == options.count && options.allSatisfy { !$0.name.isEmpty && $0.name.count <= 100 && $0.name == $0.name.trimmingCharacters(in: .whitespacesAndNewlines) && !$0.name.unicodeScalars.contains(where: { $0.value < 32 }) && colors.contains($0.color) }
}
struct NoteProperty: Encodable {
    let name: String
    let type: String
    let value: PropertyValue
    let editable: Bool
    var options: [PropertyOption]? = nil
}
struct NoteProperties: Encodable {
    let properties: [NoteProperty]
    let tagProperty: NoteProperty
    let contentHash: String
    let writable: Bool
    var definitionHash: String? = nil
}
struct PropertyUpdateResult: Encodable {
    let note: Note
    let propertyData: NoteProperties
    private enum CodingKeys: String, CodingKey { case propertyData }
    func encode(to encoder: Encoder) throws {
        try note.encode(to: encoder)
        var values = encoder.container(keyedBy: CodingKeys.self)
        try values.encode(propertyData, forKey: .propertyData)
    }
}
private let reservedProperties: Set<String> = ["id", "createdAt", "updatedAt", "deletedAt", "tags"]
private func propertyError(_ message: String) -> VaultError { VaultError(code: "INVALID_PROPERTY", message: message) }
func validPropertyImage(_ value: String) -> Bool {
    if value.isEmpty { return true }
    guard !value.hasPrefix("/"), value.range(of: #"[\\:?#\x00-\x1f\x7f]"#, options: .regularExpression) == nil else { return false }
    let parts = value.components(separatedBy: "/")
    guard parts.allSatisfy({ encoded in
        guard let part = encoded.removingPercentEncoding, !part.isEmpty, part.range(of: #"[\\/:?#\x00-\x1f\x7f]"#, options: .regularExpression) == nil else { return false }
        return part == "." || part == ".." ? part == encoded : !part.hasPrefix(".")
    }), let last = parts.last?.removingPercentEncoding else { return false }
    return last.range(of: #"\.(png|jpe?g|webp|gif|heic|heif)$"#, options: [.regularExpression, .caseInsensitive]) != nil
}
func propertyNumber(_ value: String) -> Bool {
    value.range(of: #"^[+-]?(?:(?:0|[1-9]\d*)(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$"#, options: .regularExpression) != nil && Double(value)?.isFinite == true
}
func propertyDate(_ value: String) -> Bool {
    guard value.range(of: #"^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2}))?$"#, options: .regularExpression) != nil, !value.hasPrefix("0000") else { return false }
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0); formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
    let day = String(value.prefix(10))
    guard formatter.date(from: day).map({ formatter.string(from: $0) == day }) == true else { return false }
    if value.count == 10 { return true }
    let time = String(value.dropFirst(11))
    guard let hour = Int(time.prefix(2)), hour < 24, let minute = Int(time.dropFirst(3).prefix(2)), minute < 60 else { return false }
    if time.dropFirst(5).hasPrefix(":"), let second = Int(time.dropFirst(6).prefix(2)), second >= 60 { return false }
    if !time.hasSuffix("Z") {
        let zone = String(time.suffix(6))
        guard let hours = Int(zone.dropFirst().prefix(2)), hours < 24, let minutes = Int(zone.suffix(2)), minutes < 60 else { return false }
    }
    return true
}
private func propertyComment(_ line: String) -> String? {
    let characters = Array(line)
    var quote: Character? = nil
    var escaped = false
    var index = 0
    while index < characters.count {
        let character = characters[index]
        if quote == "\"" {
            if escaped { escaped = false }
            else if character == "\\" { escaped = true }
            else if character == "\"" { quote = nil }
        } else if quote == "'" {
            if character == "'" {
                if index + 1 < characters.count && characters[index + 1] == "'" { index += 1 }
                else { quote = nil }
            }
        } else if character == "\"" || character == "'" { quote = character }
        else if character == "#" && (index == 0 || characters[index - 1].isWhitespace) {
            let comment = String(characters[index...])
            return String(comment.dropFirst()).trimmingCharacters(in: .whitespaces)
        }
        index += 1
    }
    return nil
}
private struct PropertySource {
    var lines: [String]
    let header: String
    let bom: String
    let newline: String
    let writable: Bool
    let entries: [(property: NoteProperty, start: Int, end: Int)]
}
private func propertySource(_ source: String) throws -> PropertySource {
    let regex = try NSRegularExpression(pattern: #"^(\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)"#)
    let match = regex.firstMatch(in: source, range: NSRange(source.startIndex..., in: source))
    let header = match.flatMap { Range($0.range, in: source).map { String(source[$0]) } } ?? (source.hasPrefix("\u{FEFF}") ? "\u{FEFF}" : "")
    let yaml = match.flatMap { Range($0.range(at: 2), in: source).map { String(source[$0]) } } ?? ""
    let root: Node
    do { root = try Yams.compose(yaml: yaml) ?? Node([(Node, Node)]()) }
    catch { throw propertyError("无法安全读取 YAML 属性。") }
    guard root.null != nil || root.mapping != nil else { throw propertyError("YAML 属性必须是键值对象。") }
    let pairs = Array(root.mapping ?? Node.Mapping([]))
    var names = Set<String>()
    for pair in pairs {
        guard pair.key.tag == Tag(.str), let name = pair.key.scalar?.string, names.insert(name).inserted else { throw propertyError("属性名重复或不是字符串。") }
    }
    let lines = yaml.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
    let syntax = yaml.replacingOccurrences(of: #""(?:\\.|[^"\\])*"|'(?:''|[^'])*'"#, with: "\"\"", options: .regularExpression)
    let advanced = syntax.range(of: #"(?:^|[\s:\[,{])[&*!][^\s]+"#, options: .regularExpression) != nil
    let writable = !advanced && root.mapping?.style != .flow && pairs.allSatisfy { $0.key.mark?.column == 1 }
    let entries = pairs.enumerated().map { index, pair in
        let name = pair.key.scalar!.string
        let node = pair.value
        let start = (pair.key.mark?.line ?? 1) - 1
        let blockScalar = node.scalar?.style == .literal || node.scalar?.style == .folded
        var type = "unsupported"
        var value = PropertyValue.text(node.scalar?.string ?? "复杂 YAML 值")
        if node.null != nil && lines[start].range(of: #":\s*null\s+#\s*memocard:type=date\s*$"#, options: .regularExpression) != nil { type = "date"; value = .text("") }
        else if node.null != nil && propertyComment(lines[start]) == "memocard:type=number" { type = "number"; value = .text("") }
        else if !blockScalar && node.tag == Tag(.bool), let boolean = node.bool { type = "checkbox"; value = .checkbox(boolean) }
        else if !blockScalar && (node.tag == Tag(.int) || node.tag == Tag(.float)), let text = node.scalar?.string, propertyNumber(text) { type = "number"; value = .text(text) }
        else if !blockScalar && node.tag == Tag(.str), let text = node.scalar?.string { type = propertyDate(text) && propertyComment(lines[start]) != "memocard:type=text" ? "date" : "text"; value = .text(text) }
        else if !blockScalar && node.tag == Tag(.timestamp), let text = node.scalar?.string, propertyDate(text) { type = "date"; value = .text(text) }
        else if let sequence = node.sequence, sequence.allSatisfy({ $0.tag == Tag(.str) }) { type = "list"; value = .list(sequence.map { $0.scalar!.string }) }
        var options: [PropertyOption]? = nil
        if propertyComment(lines[start]) == "memocard:type=number", type != "number" {
            if type == "text", case .text(let number) = value, propertyNumber(number) { type = "number" }
            else { type = "unsupported" }
        }
        if propertyComment(lines[start]) == "memocard:type=image" {
            if type == "text", case .text(let path) = value, validPropertyImage(path) { type = "image" }
            else { type = "unsupported" }
        }
        if let comment = propertyComment(lines[start]), comment.hasPrefix("memocard:choice=") {
            let metadata = try? JSONDecoder().decode(ChoiceMetadata.self, from: Data(comment.dropFirst("memocard:choice=".count).utf8))
            let values: [String]
            switch value { case .text(let text): values = text.isEmpty ? [] : [text]; case .list(let list): values = list; default: values = [] }
            if let metadata, validOptions(metadata.options), (metadata.type == "select" ? ["text", "date"].contains(type) : metadata.type == "multiSelect" && type == "list"), (metadata.type == "multiSelect" || values.allSatisfy({ selected in metadata.options.contains { $0.name == selected } })) {
                type = metadata.type; options = metadata.options
            } else { type = "unsupported" }
        }
        var end = index + 1 < pairs.count ? (pairs[index + 1].key.mark?.line ?? 1) - 1 : lines.count
        while end > start + 1 && lines[end - 1].range(of: #"^(?:\s*#.*|\s*)$"#, options: .regularExpression) != nil { end -= 1 }
        return (NoteProperty(name: name, type: type, value: value, editable: writable && type != "unsupported" && !reservedProperties.contains(name), options: options), start, end)
    }
    return PropertySource(lines: lines, header: header, bom: source.hasPrefix("\u{FEFF}") ? "\u{FEFF}" : "", newline: source.contains("\r\n") ? "\r\n" : "\n", writable: writable, entries: entries)
}
private func tagProperty(_ parsed: PropertySource) -> NoteProperty {
    let existing = parsed.entries.first { $0.property.name == "tags" }?.property
    let values: [String]
    switch existing?.value {
    case .list(let list): values = list
    case .text(let text): values = [text]
    default: values = []
    }
    let valid = existing == nil || (["text", "list"].contains(existing!.type) && values.allSatisfy { normalizedPropertyTag($0) != nil })
    var seen = Set<String>()
    return NoteProperty(name: "tags", type: valid ? "list" : "unsupported", value: valid ? .list(values.compactMap(normalizedPropertyTag).filter { seen.insert($0).inserted }) : existing!.value, editable: parsed.writable && valid)
}
func readNoteProperties(_ data: Data) throws -> NoteProperties {
    guard String(data: data, encoding: .utf8) != nil else { throw propertyError("笔记必须为 UTF-8。") }
    let source = String(decoding: data, as: UTF8.self)
    let parsed = try propertySource(source)
    return NoteProperties(properties: parsed.entries.filter { !reservedProperties.contains($0.property.name) }.map(\.property), tagProperty: tagProperty(parsed), contentHash: sha256(data), writable: parsed.writable)
}
func patchNoteProperty(_ data: Data, change: PropertyChange, updatedAt: String? = nil, retainedValues: [String]? = nil) throws -> Data {
    guard String(data: data, encoding: .utf8) != nil else { throw propertyError("笔记必须为 UTF-8。") }
    let source = String(decoding: data, as: UTF8.self)
    var parsed = try propertySource(source)
    let name = change.name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty, name.count <= 100, !name.unicodeScalars.contains(where: { $0.value < 32 }), !reservedProperties.contains(name) || name == "tags" else { throw propertyError("属性名为空、过长或属于系统保留字段。") }
    guard parsed.writable else { throw propertyError("此 YAML 使用高级语法，请在源文件中编辑。") }
    let existing = parsed.entries.first { $0.property.name == name }
    if change.create == true && existing != nil { throw propertyError("属性已存在。") }
    if change.create != true && existing == nil && name != "tags" { throw propertyError("属性已被移除，请重新加载。") }
    if name == "tags" ? !tagProperty(parsed).editable : existing?.property.editable == false { throw propertyError("此属性只能在源文件中编辑。") }
    let copied = parsed.entries.first { $0.property.name == change.copyFrom }
    if let copyFrom = change.copyFrom {
        guard change.create == true, change.remove != true, change.renameTo == nil, change.definition != true, !reservedProperties.contains(name), !reservedProperties.contains(copyFrom), copied?.property.editable == true else { throw propertyError("只能复制当前笔记中可编辑的自定义属性。") }
    }
    let original = copied?.property ?? existing?.property
    let encoder = JSONEncoder(); encoder.outputFormatting = [.withoutEscapingSlashes]
    var replacement: [String] = []
    if let renameTo = change.renameTo {
        guard let existing, !reservedProperties.contains(name), change.create != true, change.remove != true, change.type == nil, change.value == nil, change.options == nil else { throw propertyError("重命名只能修改自定义属性名称。") }
        let target = renameTo.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !target.isEmpty, target.count <= 100, !target.unicodeScalars.contains(where: { $0.value < 32 }), !reservedProperties.contains(target) else { throw propertyError("属性名为空、过长或属于系统保留字段。") }
        guard target == name || !parsed.entries.contains(where: { $0.property.name == target }) else { throw propertyError("属性已存在。") }
        let line = parsed.lines[existing.start]
        let regex = try NSRegularExpression(pattern: #"^(?:"(?:\\.|[^"\\])*"|'(?:''|[^'])*'|.+?)([ \t]*:(?:[ \t].*|$))$"#)
        guard let match = regex.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)), let suffix = Range(match.range(at: 1), in: line) else { throw propertyError("此属性名请在源文件中编辑。") }
        replacement = Array(parsed.lines[existing.start..<existing.end])
        replacement[0] = String(data: try encoder.encode(target), encoding: .utf8)! + line[suffix]
    } else if change.remove != true {
        guard var value = change.value else { throw propertyError("属性值与类型不匹配。") }
        if name == "tags" {
            guard change.type == "list", case .list(let tags) = value, tags.allSatisfy({ normalizedPropertyTag($0) != nil }) else { throw propertyError("标签需为有效名称列表，不能包含空格、空值或纯数字。") }
            var seen = Set<String>()
            value = .list(tags.compactMap(normalizedPropertyTag).filter { seen.insert($0).inserted })
        }
        if change.type == "list" && name != "tags" { throw propertyError("文本列表已合并为多选。") }
        switch (change.type, value) {
        case ("text", .text), ("list", .list), ("checkbox", .checkbox), ("select", .text), ("multiSelect", .list): break
        case ("image", .text(let path)): guard validPropertyImage(path) else { throw propertyError("图片属性需为笔记库中的图片路径。") }
        case ("number", .text(let number)): guard number.isEmpty || propertyNumber(number) else { throw propertyError("请输入有效数字。") }
        case ("date", .text(let date)): guard date.isEmpty || propertyDate(date) else { throw propertyError("请输入有效日期。") }
        default: throw propertyError("属性值与类型不匹配。")
        }
        let encoded = try encoder.encode(value)
        guard encoded.count <= 65536 else { throw propertyError("属性值过长。") }
        let encodedName = String(data: try encoder.encode(name), encoding: .utf8)!
        let encodedValue: String
        if change.type == "date", case .text(let date) = value { encodedValue = date.isEmpty ? "null # memocard:type=date" : String(data: encoded, encoding: .utf8)! }
        else if change.type == "number", case .text(let number) = value { encodedValue = number.isEmpty ? "null # memocard:type=number" : number + " # memocard:type=number" }
        else { encodedValue = String(data: encoded, encoding: .utf8)! }
        var suffix = ""
        if change.type == "select" || change.type == "multiSelect" {
            let options = change.options ?? original.map { listAsMultiSelect($0).options ?? [] } ?? listAsMultiSelect(NoteProperty(name: name, type: "list", value: value, editable: true)).options ?? []
            let values: [String]
            switch value { case .text(let text): values = text.isEmpty ? [] : [text]; case .list(let list): values = list; default: values = [] }
            var previous: [String] = []
            if let retainedValues { previous = retainedValues }
            else if case .list(let items)? = original?.value { previous = items }
            let retained = change.type == "multiSelect" && (retainedValues != nil || ["list", "multiSelect"].contains(original?.type ?? ""))
            var seen = Set<String>()
            guard validOptions(options), values.allSatisfy({ selected in
                if retained, let index = previous.firstIndex(of: selected) { previous.remove(at: index); seen.insert(selected); return true }
                return seen.insert(selected).inserted && options.contains { $0.name == selected }
            }) else { throw propertyError("选项无效、重复或尚未创建。") }
            let metadata = try encoder.encode(ChoiceMetadata(type: change.type!, options: options))
            guard metadata.count <= 65536 else { throw propertyError("属性值过长。") }
            suffix = " # memocard:choice=" + String(data: metadata, encoding: .utf8)!
        } else if change.type == "image" {
            suffix = " # memocard:type=image"
        } else if change.type == "text", case .text(let text) = value, propertyDate(text) {
            suffix = " # memocard:type=text"
        }
        replacement = ["\(encodedName): \(encodedValue)\(suffix)"]
    }
    if let existing { parsed.lines.replaceSubrange(existing.start..<existing.end, with: replacement) }
    else if parsed.lines == [""] { parsed.lines = replacement } else { parsed.lines += replacement }
    var yaml = parsed.lines.joined(separator: parsed.newline)
    if let updatedAt {
        var current = try propertySource("---\(parsed.newline)\(yaml)\(parsed.newline)---\(parsed.newline)")
        if let timestamp = current.entries.first(where: { $0.property.name == "updatedAt" }) {
            current.lines.replaceSubrange(timestamp.start..<timestamp.end, with: ["updatedAt: \(String(data: try encoder.encode(updatedAt), encoding: .utf8)!)"])
            yaml = current.lines.joined(separator: parsed.newline)
        }
    }
    let result = parsed.bom + "---" + parsed.newline + yaml + parsed.newline + "---" + parsed.newline + String(source.dropFirst(parsed.header.count))
    _ = try propertySource(result)
    let bytes = Data(result.utf8)
    guard bytes.count <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "单条 Markdown 最大支持 8 MiB。") }
    return bytes
}

// Legacy body saves serialize YAML, so restore property metadata comments that Yams discards.
func preservingPropertyTypes(_ yaml: String, originalHeader: String?) throws -> String {
    guard let originalHeader else { return yaml }
    let original = try propertySource(originalHeader)
    let typed = original.entries.filter { entry in
        if entry.property.type == "image" { return true }
        if ["select", "multiSelect"].contains(entry.property.type) { return true }
        if ["date", "number"].contains(entry.property.type) { return true }
        if entry.property.type == "text", case .text(let text) = entry.property.value { return propertyDate(text) }
        return false
    }
    guard !typed.isEmpty else { return yaml }
    var serialized = try propertySource("---\n" + yaml + "---\n")
    for entry in serialized.entries.reversed() {
        guard let before = typed.first(where: { $0.property.name == entry.property.name }) else { continue }
        serialized.lines.replaceSubrange(entry.start..<entry.end, with: original.lines[before.start..<before.end])
    }
    return serialized.lines.joined(separator: "\n") + (yaml.hasSuffix("\n") ? "\n" : "")
}


struct OptionRename: Codable { let from: String; let to: String }
struct PropertyDefinition: Codable {
    let type: String
    var options: [PropertyOption]? = nil
}
let propertyDefinitionPath = ".memocard/property-definitions.json"
func validPropertyDefinition(_ value: PropertyDefinition) -> Bool {
    guard ["text", "list", "number", "date", "checkbox", "select", "multiSelect", "image"].contains(value.type) else { return false }
    if value.type == "select" || value.type == "multiSelect" { return value.options.map(validOptions) ?? false }
    return value.options == nil
}
func mergedPropertyOptions(_ properties: [NoteProperty]) -> [PropertyOption] {
    var options: [PropertyOption] = []
    for property in properties { for option in property.options ?? [] where !options.contains(where: { $0.name == option.name }) { options.append(option) } }
    // Bound inferred menu choices, never the selected values stored in YAML.
    return Array(options.prefix(200))
}
private func propertyValues(_ property: NoteProperty, rename: OptionRename? = nil) -> [String] {
    let values: [String]
    switch property.value {
    case .text(let text): values = text.isEmpty ? [] : [text]
    case .list(let items): values = items
    case .checkbox(let checked): values = [checked ? "true" : "false"]
    }
    return values.map { $0 == rename?.from ? rename!.to : $0 }
}
private func normalizedOptionValues(_ values: [String]) -> [String] {
    var seen = Set<String>()
    return values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty && $0.count <= 100 && !$0.unicodeScalars.contains(where: { $0.value < 32 }) && seen.insert($0).inserted }
}
func losslessPropertyConversion(_ original: NoteProperty, _ converted: NoteProperty) -> Bool {
    let values = propertyValues(original)
    if converted.type == "text", case .text(let text) = converted.value { return text == values.joined(separator: "\n") }
    return values.isEmpty || values == propertyValues(converted)
}
// Legacy YAML lists share the multi-select editor without normalizing their values.
func listAsMultiSelect(_ property: NoteProperty) -> NoteProperty {
    guard property.type == "list" else { return property }
    let options = Array(propertyValues(property).filter { !$0.isEmpty && $0.count <= 100 && $0 == $0.trimmingCharacters(in: .whitespacesAndNewlines) && !$0.unicodeScalars.contains(where: { $0.value < 32 }) }.reduce(into: [PropertyOption]()) { result, name in
        if !result.contains(where: { $0.name == name }) { result.append(PropertyOption(name: name, color: "default")) }
    }.prefix(200))
    return NoteProperty(name: property.name, type: "multiSelect", value: property.value, editable: property.editable, options: options)
}
func resolvedPropertyDefinition(_ definition: PropertyDefinition, properties: [NoteProperty]) -> PropertyDefinition {
    definition.type == "list" ? newPropertyDefinition(properties.map(listAsMultiSelect), type: "multiSelect", options: nil, includeValues: false) : definition
}
func convertedProperty(_ property: NoteProperty, definition: PropertyDefinition, rename: OptionRename? = nil, pruneOptions: Bool = false) -> NoteProperty {
    let property = listAsMultiSelect(property)
    let definition = resolvedPropertyDefinition(definition, properties: [property])
    let values = propertyValues(property, rename: rename)
    if property.type == "multiSelect" && definition.type == "multiSelect" {
        let removed = pruneOptions ? (property.options ?? []).filter { option in option.name != rename?.from && !(definition.options ?? []).contains { $0.name == option.name } }.map(\.name) : []
        return NoteProperty(name: property.name, type: "multiSelect", value: .list(values.filter { !removed.contains($0) }), editable: property.editable, options: definition.options)
    }
    let value: PropertyValue
    switch definition.type {
    case "text": value = .text(values.joined(separator: "\n"))
    case "number": value = .text(values.count == 1 && propertyNumber(values[0]) ? values[0] : "")
    case "image": value = .text(values.count == 1 && validPropertyImage(values[0]) ? values[0] : "")
    case "list": value = .list(values)
    case "date": value = .text(values.count == 1 && propertyDate(values[0]) ? values[0] : "")
    case "checkbox": value = .checkbox(values.count == 1 && values[0] == "true")
    default:
        let selected = normalizedOptionValues(values).filter { name in definition.options?.contains { $0.name == name } == true }
        value = definition.type == "select" ? .text(selected.first ?? "") : .list(selected)
    }
    return NoteProperty(name: property.name, type: definition.type, value: value, editable: property.editable, options: definition.options)
}
func newPropertyDefinition(_ properties: [NoteProperty], type: String, options: [PropertyOption]?, includeValues: Bool) -> PropertyDefinition {
    guard type == "select" || type == "multiSelect" else { return PropertyDefinition(type: type) }
    var next = options ?? mergedPropertyOptions(properties)
    if includeValues {
        for property in properties {
            for option in property.options ?? [] where !next.contains(where: { $0.name == option.name }) { next.append(option) }
            for value in normalizedOptionValues(propertyValues(property)) where !next.contains(where: { $0.name == value }) { next.append(PropertyOption(name: value, color: "default")) }
        }
    }
    return PropertyDefinition(type: type, options: next)
}

// Preview and first save share the same library schema, never another note's values.
func inheritedProperties(_ properties: [NoteProperty], stored: [String: PropertyDefinition]) throws -> [NoteProperty] {
    let properties = properties.map(listAsMultiSelect)
    var definitions = stored
    for (name, definition) in stored { definitions[name] = resolvedPropertyDefinition(definition, properties: properties.filter { $0.name == name }) }
    for property in properties where property.editable && property.type != "unsupported" && definitions[property.name] == nil {
        definitions[property.name] = newPropertyDefinition(properties.filter { $0.name == property.name }, type: property.type, options: nil, includeValues: false)
    }
    return try definitions.keys.sorted().map { name in
        let definition = definitions[name]!
        guard validPropertyDefinition(definition) else { throw propertyError("属性定义无效，最多支持 200 个选项。") }
        let value: PropertyValue = definition.type == "checkbox" ? .checkbox(false) : ["list", "multiSelect"].contains(definition.type) ? .list([]) : .text("")
        return NoteProperty(name: name, type: definition.type, value: value, editable: true, options: definition.options)
    }
}
