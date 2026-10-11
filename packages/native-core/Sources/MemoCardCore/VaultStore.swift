import Foundation
import Darwin
import ImageIO
import UniformTypeIdentifiers
import Yams

/// File-backed M1 foundation. The host retains the picker security scope while this store is open.
public actor VaultStore {
    private let localDataURL: URL
    private let fm = FileManager.default
    private var root: URL?
    private var metadata: VaultMetadata?
    private var binding = UUID()
    private var compatible: Bool { metadata?.formatVersion == 2 }
    private var identities: [FileIdentity] = []
    private var refreshSnapshot: Snapshot?
    private var refreshSnapshotConsumers = Set<String>()
    private struct SourceStamp: Equatable {
        let device: dev_t
        let inode: ino_t
        let size: off_t
        let mode: mode_t
        let modifiedSeconds: Int
        let modifiedNanos: Int
        let changedSeconds: Int
        let changedNanos: Int

        init?(_ url: URL) throws {
            var volume = statfs()
            guard statfs(url.path, &volume) == 0 else { return nil }
            let filesystem = withUnsafeBytes(of: volume.f_fstypename) { String(cString: $0.bindMemory(to: CChar.self).baseAddress!) }
            // Other filesystems may have coarse clocks or cache remote attributes.
            guard filesystem == "apfs", volume.f_flags & UInt32(MNT_LOCAL) != 0 else { return nil }
            var value = stat()
            guard lstat(url.path, &value) == 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
            device = value.st_dev; inode = value.st_ino; size = value.st_size; mode = value.st_mode
            modifiedSeconds = value.st_mtimespec.tv_sec; modifiedNanos = value.st_mtimespec.tv_nsec
            changedSeconds = value.st_ctimespec.tv_sec; changedNanos = value.st_ctimespec.tv_nsec
        }
    }
    private struct ParsedCacheEntry {
        let hash: String
        let vaultID: String
        let identityID: String?
        let createdAt: String?
        let modified: Date?
        let parsed: ParsedNote
        var sourceStamp: SourceStamp?
        var properties: [NoteProperty]?
        var quickFilters: Set<NoteQuickFilter>?
    }
    private var parsedCache: [String: ParsedCacheEntry] = [:]
    var parseMissCount = 0
    var sourceReadCount = 0
    var scanCount = 0
    var propertyParseMissCount = 0

    public init(localDataURL: URL) throws {
        guard localDataURL.isFileURL else {
            throw VaultError(code: "INVALID_PATH", message: "本机数据目录必须是文件 URL。")
        }
        try FileManager.default.createDirectory(at: localDataURL, withIntermediateDirectories: true)
        self.localDataURL = localDataURL.standardizedFileURL.resolvingSymlinksInPath()
    }

    public func close() {
        invalidateSnapshot()
        parsedCache.removeAll()
        parseMissCount = 0
        sourceReadCount = 0; scanCount = 0; propertyParseMissCount = 0
        binding = UUID()
        root = nil
        metadata = nil
    }

    public func invalidateSnapshot() {
        refreshSnapshot = nil
        refreshSnapshotConsumers.removeAll()
    }

    /// The host can serve attachments without exposing a general filesystem read operation.
    public func asset(relativePath: String, expectedBinding: UUID? = nil) throws -> Data {
        try requireBinding(expectedBinding)
        let (root, _) = try active()
        let components = relativePath.split(separator: "/", omittingEmptySubsequences: false)
        guard !components.isEmpty, (compatible || (components.count >= 2 && components.first == "assets")),
              components.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }),
              !relativePath.contains("\\"), !relativePath.contains("\0"),
              !components.contains(where: { $0.hasPrefix(".") }),
              ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"].contains((relativePath as NSString).pathExtension.lowercased()) else {
            throw VaultError(code: "PATH_NOT_ALLOWED", message: "只允许读取 assets 目录中的附件。")
        }
        let target = root.appendingPathComponent(relativePath)
        return try coordinateRead(target, inside: root) { url in
            guard try self.fileType(url) == .typeRegular else {
                throw VaultError(code: "PATH_NOT_ALLOWED", message: "附件必须是普通文件。")
            }
            guard try self.isAvailable(url) else {
                throw VaultError(code: "FILE_PENDING", message: "附件尚未下载。", retryable: true)
            }
            return try Data(contentsOf: url)
        }
    }

    public func open(url: URL, create: Bool, binding: UUID = UUID()) throws {
        invalidateSnapshot()
        parsedCache.removeAll()
        parseMissCount = 0
        sourceReadCount = 0; scanCount = 0; propertyParseMissCount = 0
        self.binding = binding
        // A failed selection must not silently continue serving a previously selected vault.
        root = nil
        metadata = nil
        guard url.isFileURL else { throw VaultError(code: "INVALID_PATH", message: "请选择本机文件目录。") }
        let selected = url.standardizedFileURL
        guard try fileType(selected) == .typeDirectory else {
            throw VaultError(code: "INVALID_PATH", message: "笔记库必须是实际目录，不能是符号链接。")
        }
        let candidate = selected.resolvingSymlinksInPath()
        let manifest = candidate.appendingPathComponent(".memocard/vault.json")
        try validate(manifest, inside: candidate)
        if !fm.fileExists(atPath: manifest.path) {

            try coordinateWrite(candidate, inside: candidate) { coordinated in
                let contents = try self.fm.contentsOfDirectory(atPath: coordinated.path).filter { $0 != ".DS_Store" }
                guard !create || contents.isEmpty else {
                    throw VaultError(code: "VAULT_NOT_EMPTY", message: "请在空目录中创建笔记库。")
                }
                for name in [".memocard"] {
                    try self.fm.createDirectory(at: coordinated.appendingPathComponent(name), withIntermediateDirectories: true)
                }
                let value = VaultMetadata(formatVersion: 2, vaultId: UUID().uuidString.lowercased())
                try encode(value).write(to: coordinated.appendingPathComponent(".memocard/vault.json"), options: .atomic)
            }
        }
        let value = try readMetadata(at: candidate)
        for directory in value.formatVersion == 1 ? ["notes", "assets"] : [] {
            let path = candidate.appendingPathComponent(directory)
            try validate(path, inside: candidate)
            guard try fileType(path) == .typeDirectory else {
                throw VaultError(code: "INVALID_VAULT", message: "笔记库缺少 notes 或 assets 目录。")
            }
        }
        // Device-only data must never be placed inside the synchronized vault.
        guard !isInside(localDataURL, candidate), !isInside(candidate, localDataURL) else {
            throw VaultError(code: "INVALID_LOCAL_DATA", message: "本机草稿目录必须与同步笔记库分开。")
        }
        root = candidate
        metadata = value
        identities = []
        try recoverRename()
        if compatible, fm.fileExists(atPath: identityURL.path) {
            do { identities = try JSONDecoder().decode([FileIdentity].self, from: Data(contentsOf: identityURL)) }
            catch { root = nil; metadata = nil; throw VaultError(code: "INVALID_LOCAL_DATA", message: "本机笔记身份记录无法读取，请保留草稿后恢复本机记录。") }
        }
    }

    public func perform(operation: String, params: Data, expectedBinding: UUID? = nil) throws -> Data {
        do {
            try requireBinding(expectedBinding)
            try recoverRename()
            switch operation {
            case "getStatus": return try getStatus()
            case "queryNotes": return try queryNotes(try decode(Query.self, params))
            case "getNote":
                struct Request: Decodable { let id: String }
                return try encode(getNote(id: try decode(Request.self, params).id))
            case "saveNote":
                invalidateSnapshot()
                return try encode(saveNote(try decode(SaveRequest.self, params)))
            case "getNoteProperties":
                struct Request: Decodable { let id: String? }
                let (root, _) = try active()
                guard let id = try decode(Request.self, params).id else {
                    let config = try readPropertyDefinitions(root)
                    let properties = try inheritedProperties(libraryProperties(scan()), stored: config.values)
                    return try encode(NoteProperties(properties: properties, tagProperty: NoteProperty(name: "tags", type: "list", value: .list([]), editable: false), contentHash: "", writable: false, definitionHash: config.hash))
                }
                let snapshot = try scan()
                let note = try getNote(id: id, snapshot: snapshot)
                let data = try coordinateRead(root.appendingPathComponent(note.relativePath), inside: root) { try self.readSource($0) }
                return try encode(effectiveNoteProperties(data, snapshot: snapshot, root: root))
            case "getPropertyLabels": return try encode(readPropertyLabels())
            case "renamePropertyLabel":
                struct Request: Decodable { let key: String; let label: String; let baseHash: String }
                let request = try decode(Request.self, params)
                return try encode(renamePropertyLabel(key: request.key, label: request.label, baseHash: request.baseHash))
            case "updateNoteProperty":
                invalidateSnapshot()
                return try encode(updateNoteProperty(try decode(PropertyChange.self, params)))
            case "resolveLink":
                struct LinkRequest: Decodable { let target: String; let sourcePath: String; let wiki: Bool? }
                let link = try decode(LinkRequest.self, params)
                return try resolveLink(link.target, sourcePath: link.sourcePath, wiki: link.wiki == true)
            case "listFolders":
                let snapshot = try snapshot(for: "listFolders")
                struct Folders: Encodable { let folders: [String]; let coverage: Coverage }
                return try encode(Folders(folders: snapshot.folders.sorted(), coverage: snapshot.coverage))
            case "listTags": return try listTags()
            case "saveDraft": return try saveDraft(try decode(SaveRequest.self, params))
            case "getDrafts": return try getDrafts()
            case "importAttachment":
                invalidateSnapshot()
                struct Request: Decodable { let name: String; let base64: String; let noteId: String?; let notePath: String? }
                let request = try decode(Request.self, params)
                return try importAttachment(name: request.name, base64: request.base64, noteID: request.noteId, requestedPath: request.notePath)
            default: throw VaultError(code: "UNSUPPORTED_OPERATION", message: "M1 尚未实现此操作。")
            }
        } catch let error as VaultError { throw error }
        catch { throw VaultError(code: "IO_ERROR", message: "文件操作未完成，请检查目录权限和文件可用性。", retryable: true) }
    }

    // Validate inside the same actor turn as the operation: a queued request must not
    // write into a replacement vault, including restored directories with the same ID.
    private func requireBinding(_ expectedBinding: UUID?) throws {
        guard expectedBinding == nil || expectedBinding == binding else {
            throw VaultError(code: "UNAUTHORIZED", message: "笔记库授权已变化，请重新连接。")
        }
    }

    private struct Snapshot {
        var folders: [String] = ["notes"]
        var notes: [ParsedNote] = []
        var duplicateIDs = Set<String>()
        var coverage = Coverage(complete: true, indexed: 0, pending: 0, issues: 0, indexedAt: nil)
    }

    private func seedRefreshSnapshot(_ snapshot: Snapshot) {
        refreshSnapshot = snapshot
        refreshSnapshotConsumers = ["queryNotes", "listTags", "listFolders"]
    }

    private func snapshot(for consumer: String) throws -> Snapshot {
        guard let snapshot = refreshSnapshot, refreshSnapshotConsumers.remove(consumer) != nil else {
            return try scan()
        }
        _ = try active()
        if refreshSnapshotConsumers.isEmpty { invalidateSnapshot() }
        return snapshot
    }

    private func active() throws -> (URL, VaultMetadata) {
        guard let root, let metadata else {
            throw VaultError(code: "VAULT_NOT_OPEN", message: "请先选择笔记库。")
        }
        guard try readMetadata(at: root).vaultId == metadata.vaultId else {
            throw VaultError(code: "VAULT_CHANGED", message: "所选目录的笔记库已变化，请重新选择。")
        }
        return (root, metadata)
    }

    private func readMetadata(at root: URL) throws -> VaultMetadata {
        let path = root.appendingPathComponent(".memocard/vault.json")
        let data = try coordinateRead(path, inside: root) { try Data(contentsOf: $0) }
        let metadata: VaultMetadata
        do { metadata = try JSONDecoder().decode(VaultMetadata.self, from: data) }
        catch { throw VaultError(code: "INVALID_VAULT", message: "无法解析笔记库元文件。") }
        guard metadata.formatVersion == 1 || metadata.formatVersion == 2 else {
            throw VaultError(code: "UNSUPPORTED_FORMAT", message: "当前应用不支持此笔记库格式。")
        }
        _ = try canonicalID(metadata.vaultId)
        return metadata
    }

    private func scan() throws -> Snapshot {
        scanCount += 1
        let (root, metadata) = try active()
        let notesURL = compatible ? root : root.appendingPathComponent("notes")
        try validate(notesURL, inside: root)
        guard try fileType(notesURL) == .typeDirectory else {
            throw VaultError(code: "VAULT_UNAVAILABLE", message: "笔记目录不可用。", retryable: true)
        }
        var result = Snapshot()
        if compatible { result.folders = [""] }
        var sources: [(path: String, data: Data?, modified: Date, hash: String, stamp: SourceStamp?)] = []
        var scannedPaths = Set<String>()
        var enumerationFailed = false
        guard let enumerator = fm.enumerator(at: notesURL, includingPropertiesForKeys: nil,
                                             options: [.skipsHiddenFiles], errorHandler: { _, _ in
            enumerationFailed = true
            return true
        }) else { throw VaultError(code: "SCAN_FAILED", message: "无法读取笔记目录。", retryable: true) }
        for case let url as URL in enumerator {
            do {
                try validate(url, inside: root)
                let type = try fileType(url)
                if type == .typeDirectory { result.folders.append(self.relative(url, root: root)); continue }
                guard type == .typeRegular else { result.coverage.issues += 1; continue }
                guard url.pathExtension.lowercased() == "md" else { continue }
                guard try isAvailable(url) else { result.coverage.pending += 1; continue }
                let path = relative(url, root: root)
                // Cloud versions still use coordination; local files must match identity and both clocks.
                let isCloud = try url.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem == true
                let stamp = isCloud ? nil : try SourceStamp(url)
                if let stamp, let cached = parsedCache[path], cached.vaultID == metadata.vaultId, cached.sourceStamp == stamp {
                    try requireNoConflict(url)
                    scannedPaths.insert(path)
                    if compatible, let modified = cached.modified {
                        sources.append((path, nil, modified, cached.hash, stamp))
                    } else { result.notes.append(cached.parsed) }
                    continue
                }
                let parsed: ParsedNote? = try coordinateRead(url, inside: root) { coordinated in
                    try self.requireNoConflict(coordinated)
                    let data = try self.readSource(coordinated)
                    let path = self.relative(coordinated, root: root)
                    let hash = sha256(data)
                    let verifiedStamp = stamp != nil && stamp == (try? SourceStamp(coordinated)) ? stamp : nil
                    scannedPaths.insert(path)
                    if self.compatible {
                        let modified = try coordinated.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? Date(timeIntervalSince1970: 0)
                        sources.append((path, data, modified, hash, verifiedStamp))
                        return nil
                    }
                    if let cached = self.parsedCache[path], cached.hash == hash, cached.vaultID == metadata.vaultId,
                       cached.identityID == nil, cached.createdAt == nil, cached.modified == nil {
                        self.parsedCache[path]?.sourceStamp = verifiedStamp
                        return cached.parsed
                    }
                    let value = try parseNote(data, relativePath: path, vaultID: metadata.vaultId)
                    self.parseMissCount += 1
                    self.parsedCache[path] = ParsedCacheEntry(hash: hash, vaultID: metadata.vaultId,
                        identityID: nil, createdAt: nil, modified: nil, parsed: value, sourceStamp: verifiedStamp)
                    return value
                }
                if let parsed { result.notes.append(parsed) }
            } catch let error as VaultError where error.code == "FILE_PENDING" {
                result.coverage.pending += 1
            } catch {
                result.coverage.issues += 1
            }
        }
        if enumerationFailed { result.coverage.issues += 1 }
        if compatible {
            var next: [FileIdentity] = []
            let paths = Set(sources.map { $0.path })
            let existingByPath = identities.reduce(into: [String: FileIdentity]()) { $0[$1.path] = $1 }
            let missingByHash = Dictionary(grouping: identities.filter { !paths.contains($0.path) }, by: \.hash)
            let newByHash = Dictionary(grouping: sources.filter { existingByPath[$0.path] == nil }, by: \.hash)
            for source in sources {
                let hash = source.hash
                let moved = missingByHash[hash] ?? []
                let candidates = newByHash[hash] ?? []
                let previous = existingByPath[source.path] ?? (moved.count == 1 && candidates.count == 1 ? moved.first : nil)
                let identity = FileIdentity(id: previous?.id ?? UUID().uuidString.lowercased(), path: source.path, hash: hash, createdAt: previous?.createdAt ?? timestamp(source.modified))
                next.append(identity)
                do {
                    if let cached = parsedCache[source.path], cached.hash == hash, cached.vaultID == metadata.vaultId,
                       cached.identityID == identity.id, cached.createdAt == identity.createdAt, cached.modified == source.modified {
                        parsedCache[source.path]?.sourceStamp = source.stamp
                        result.notes.append(cached.parsed)
                    } else {
                        let data = try source.data ?? coordinateRead(root.appendingPathComponent(source.path), inside: root) { try self.readSource($0) }
                        let value = try parseObsidianNote(data, relativePath: source.path, vaultID: metadata.vaultId, identity: identity, modified: source.modified)
                        parseMissCount += 1
                        parsedCache[source.path] = ParsedCacheEntry(hash: hash, vaultID: metadata.vaultId,
                            identityID: identity.id, createdAt: identity.createdAt, modified: source.modified, parsed: value, sourceStamp: source.stamp)
                        result.notes.append(value)
                    }
                }
                catch { result.coverage.issues += 1 }
            }
            if !enumerationFailed && result.coverage.issues == 0 && result.coverage.pending == 0 {
                try persistIdentities(next)
            }
        }
        parsedCache = parsedCache.filter { scannedPaths.contains($0.key) }
        let groups = Dictionary(grouping: result.notes, by: { $0.note.id })
        for (id, notes) in groups where notes.count > 1 {
            result.duplicateIDs.insert(id)
            result.coverage.issues += notes.count
        }
        result.notes.removeAll { result.duplicateIDs.contains($0.note.id) }
        result.notes.sort {
            let left = $0.createdDate, right = $1.createdDate
            return left == right ? $0.note.id < $1.note.id : left > right
        }
        result.coverage.indexed = result.notes.count
        result.coverage.complete = result.coverage.pending == 0 && result.coverage.issues == 0
        result.coverage.indexedAt = timestamp()
        return result
    }

    private func getStatus() throws -> Data {
        struct Status: Encodable {
            let connected: Bool
            let vaultId: String?
            let vaultName: String?
            let coverage: Coverage
            let phase: String
            let syncState: String
            let capabilities: [String]
            private enum CodingKeys: String, CodingKey { case connected, vaultId, vaultName, coverage, phase, syncState, capabilities }
            func encode(to encoder: Encoder) throws {
                var values = encoder.container(keyedBy: CodingKeys.self)
                try values.encode(connected, forKey: .connected)
                try values.encode(vaultId, forKey: .vaultId)
                try values.encode(vaultName, forKey: .vaultName)
                try values.encode(coverage, forKey: .coverage)
                try values.encode(phase, forKey: .phase)
                try values.encode(syncState, forKey: .syncState)
                try values.encode(capabilities, forKey: .capabilities)
            }
        }
        let capabilities = ["getStatus", "queryNotes", "getNote", "saveNote", "getNoteProperties", "updateNoteProperty", "getPropertyLabels", "renamePropertyLabel", "listTags", "listFolders", "resolveLink", "saveDraft", "getDrafts", "importAttachment"]
        guard let root, let metadata else {
            return try encode(Status(connected: false, vaultId: nil, vaultName: nil,
                coverage: Coverage(complete: false, indexed: 0, pending: 0, issues: 0, indexedAt: nil),
                phase: "M1", syncState: "notConnected", capabilities: capabilities))
        }
        let snapshot = try scan()
        seedRefreshSnapshot(snapshot)
        let coverage = snapshot.coverage
        return try encode(Status(connected: true, vaultId: metadata.vaultId, vaultName: root.lastPathComponent,
            coverage: coverage, phase: "M1", syncState: coverage.complete ? "localReadComplete" : "incomplete",
            capabilities: capabilities))
    }

    private func queryNotes(_ query: Query) throws -> Data {
        let snapshot = try snapshot(for: "queryNotes")
        if let folder = query.folder, !folder.isEmpty {
            let parts = folder.split(separator: "/", omittingEmptySubsequences: false)
            guard (compatible || parts.first == "notes"), !parts.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." }), !folder.contains("\\"), !folder.contains("\0") else {
                throw VaultError(code: "INVALID_PARAMS", message: "目录路径无效。")
            }
        }
        let from = try query.from.map(parseDate)
        let to = try query.to.map(parseDate)
        if let from, let to, from > to { throw VaultError(code: "INVALID_PARAMS", message: "开始时间不能晚于结束时间。") }
        let limit = query.limit ?? 50
        guard (1...100).contains(limit) else { throw VaultError(code: "INVALID_PARAMS", message: "limit 必须为 1 至 100。") }
        var fingerprintQuery = query
        fingerprintQuery.cursor = nil
        let queryHash = sha256(try encode(fingerprintQuery))
        // indexedAt changes on every scan and must not invalidate an unchanged snapshot.
        // Source hashes cover the whole Markdown; do not encode every body again to fingerprint a page.
        struct Fingerprint: Encodable { let id: String; let hash: String; let path: String; let source: String }
        let fingerprints = snapshot.notes.map {
            Fingerprint(id: $0.note.id, hash: $0.note.contentHash, path: $0.note.relativePath, source: $0.note.sourceUrl)
        }
        let snapshotHash = sha256(try encode(fingerprints) + Data("\(snapshot.coverage.pending):\(snapshot.coverage.issues)".utf8))
        var cursor: PageCursor?
        if let raw = query.cursor {
            guard let data = Data(base64Encoded: raw) else { throw VaultError(code: "INVALID_CURSOR", message: "分页游标无效。") }
            do { cursor = try JSONDecoder().decode(PageCursor.self, from: data) }
            catch { throw VaultError(code: "INVALID_CURSOR", message: "分页游标无效。") }
            _ = try parseDate(cursor!.createdAt)
            _ = try canonicalID(cursor!.id)
            guard cursor!.queryHash == queryHash else {
                throw VaultError(code: "CURSOR_QUERY_MISMATCH", message: "筛选条件已变化，请从第一页重新读取。")
            }
            guard cursor!.snapshotHash == snapshotHash else {
                throw VaultError(code: "STALE_CURSOR", message: "笔记库已变化，请从第一页重新读取。", retryable: true)
            }
        }
        let cursorDate = try cursor.map { try parseDate($0.createdAt) }
        let filters = Dictionary(uniqueKeysWithValues: snapshot.notes.map { parsed in
            let note = parsed.note
            let filters = parsedCache[note.relativePath]?.quickFilters ?? noteQuickFilters(note)
            parsedCache[note.relativePath]?.quickFilters = filters
            return (note.id, filters)
        })
        var filterCounts = ["untagged": 0, "images": 0, "links": 0]
        for parsed in snapshot.notes where parsed.note.deletedAt == nil {
            for filter in filters[parsed.note.id]! { filterCounts[filter.rawValue, default: 0] += 1 }
        }
        let matches = snapshot.notes.filter { parsed in
            let note = parsed.note, date = parsed.createdDate
            if let folder = query.folder, !folder.isEmpty, !note.relativePath.hasPrefix(folder + "/") { return false }
            if (note.deletedAt != nil) != (query.deleted ?? false) { return false }
            if let filter = query.quickFilter, !filters[note.id]!.contains(filter) { return false }
            if let text = query.query, ((note.title ?? "") + "\n" + note.body).range(of: text, options: [.caseInsensitive, .literal]) == nil && !text.isEmpty { return false }
            if let tags = query.tags, !tags.allSatisfy({ value in let tag = tagKey(value); return note.tags.contains { $0 == tag || $0.hasPrefix(tag + "/") } }) { return false }
            if let from, date < from { return false }
            if let to, date >= to { return false }
            if let cursor, let cursorDate, !(date < cursorDate || (date == cursorDate && note.id > cursor.id)) { return false }
            return true
        }.map(\.note)
        // Limit actual JSON bytes as well as count. A single large legal note must still advance the cursor.
        let byteBudget = 2 * 1024 * 1024
        var notesData = Data("[".utf8)
        var page: [Note] = []
        for note in matches.prefix(limit) {
            let encoded = try encode(note)
            let separatorSize = page.isEmpty ? 0 : 1
            if !page.isEmpty, notesData.count + separatorSize + encoded.count + 1 > byteBudget { break }
            if !page.isEmpty { notesData.append(contentsOf: ",".utf8) }
            notesData.append(encoded)
            page.append(note)
            if notesData.count + 1 >= byteBudget { break }
        }
        notesData.append(contentsOf: "]".utf8)
        let next = matches.count > page.count ? try page.last.map {
            try encode(PageCursor(createdAt: $0.createdAt, id: $0.id, queryHash: queryHash, snapshotHash: snapshotHash)).base64EncodedString()
        } : nil
        // Reuse encoded notes instead of serializing potentially multi-megabyte bodies twice.
        var result = Data("{\"coverage\":".utf8)
        result.append(try encode(snapshot.coverage))
        result.append(contentsOf: ",\"filterCounts\":".utf8)
        result.append(try encode(filterCounts))
        result.append(contentsOf: ",\"nextCursor\":".utf8)
        result.append(try encode(next))
        result.append(contentsOf: ",\"notes\":".utf8)
        result.append(notesData)
        result.append(contentsOf: "}".utf8)
        return result
    }

    private func getNote(id: String) throws -> Note {
        try getNote(id: id, snapshot: scan())
    }

    private func getNote(id: String, snapshot: Snapshot) throws -> Note {
        let id = try canonicalID(id)
        if snapshot.duplicateIDs.contains(id) { throw VaultError(code: "DUPLICATE_ID", message: "多份文件使用同一个 ID，请先处理重复文件。") }
        guard let note = snapshot.notes.first(where: { $0.note.id == id })?.note else {
            throw VaultError(code: snapshot.coverage.complete ? "NOTE_NOT_FOUND" : "NOTE_UNAVAILABLE",
                             message: snapshot.coverage.complete ? "找不到此笔记。" : "部分文件尚不可读取，暂时无法确认此笔记。",
                             retryable: !snapshot.coverage.complete)
        }
        return note
    }

    private func newNotePath(_ value: String?, id: String, root: URL) throws -> String {
        let path = value ?? "\(compatible ? "" : "notes/")\(id).md"
        let parts = path.split(separator: "/", omittingEmptySubsequences: false)
        guard !parts.isEmpty, (compatible || (parts.count >= 2 && parts.first == "notes")), path.hasSuffix(".md"),
              parts.allSatisfy({ !$0.isEmpty && !$0.hasPrefix(".") }),
              !path.contains("\\"), !path.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else {
            throw VaultError(code: "PATH_NOT_ALLOWED", message: "请选择笔记目录中的 Markdown 文件。")
        }
        let parent = root.appendingPathComponent(path).deletingLastPathComponent()
        try validate(parent, inside: root)
        guard fm.fileExists(atPath: parent.path), try fileType(parent) == .typeDirectory else {
            throw VaultError(code: "FOLDER_NOT_FOUND", message: "保存目录已移除，请保留草稿并重新选择目录。")
        }
        return path
    }

    private func saveNote(_ request: SaveRequest) throws -> Note {
        let id = try canonicalID(request.id)
        let tags = try validatedTags(inlineTags(request.body))
        let (root, metadata) = try active()
        let snapshot = try scan()
        if snapshot.duplicateIDs.contains(id) { throw VaultError(code: "DUPLICATE_ID", message: "笔记 ID 重复，无法覆盖保存。") }
        guard snapshot.coverage.complete else {
            throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库包含待下载、冲突或格式异常文件，可以先保存本机草稿，处理后再提交。", retryable: true)
        }
        let existing = snapshot.notes.first { $0.note.id == id }
        if existing?.note.deletedAt != nil { throw VaultError(code: "NOTE_DELETED", message: "此笔记已删除，无法编辑。") }
        var requestedPath = request.relativePath
        if existing == nil && request.baseHash == nil && (requestedPath == nil || requestedPath!.hasSuffix(id + ".md")) {
            let line = request.body.components(separatedBy: .newlines).first { !$0.trimmingCharacters(in: .whitespaces).isEmpty } ?? "未命名"
            let title = request.title?.trimmingCharacters(in: .whitespacesAndNewlines)
            requestedPath = namedNotePath(requestedPath ?? "\(compatible ? "" : "notes/")\(id).md", title: title?.isEmpty == false ? title! : line.replacingOccurrences(of: #"^[#\s]+"#, with: "", options: .regularExpression), paths: snapshot.notes.map { $0.note.relativePath })
        }
        if let existing, let title = request.title, safeNoteTitle(title) != fileTitle(existing.note.relativePath) {
            let path = namedNotePath(existing.note.relativePath, title: title, paths: snapshot.notes.map { $0.note.relativePath })
            if path != existing.note.relativePath { return try renameNote(request, existing: existing, snapshot: snapshot, to: path, root: root, metadata: metadata) }
        }
        let target = try root.appendingPathComponent(existing?.note.relativePath ?? newNotePath(requestedPath, id: id, root: root))
        let config = existing == nil ? try readPropertyDefinitions(root) : nil
        let inherited = try config.map { try inheritedProperties(libraryProperties(snapshot), stored: $0.values) } ?? []
        let saved = try coordinateWrite(target, inside: root) { coordinated in
            try self.requireNoConflict(coordinated)
            var frontmatter = Node([(Node, Node)]())
            var original: ParsedNote?
            if self.fm.fileExists(atPath: coordinated.path) {
                let data = try self.readSource(coordinated)
                guard request.baseHash == sha256(data) else {
                    throw VaultError(code: "HASH_CONFLICT", message: "文件已在其他位置修改，原文未被覆盖。请保留草稿并重新读取。")
                }
                let parsed = try self.compatible ? parseObsidianNote(data, relativePath: self.relative(coordinated, root: root), vaultID: metadata.vaultId,
                    identity: FileIdentity(id: existing?.note.id ?? id, path: self.relative(coordinated, root: root), hash: sha256(data), createdAt: existing?.note.createdAt ?? timestamp()), modified: Date()) : parseNote(data, relativePath: self.relative(coordinated, root: root), vaultID: metadata.vaultId)
                original = parsed
                guard parsed.note.id == id else { throw VaultError(code: "HASH_CONFLICT", message: "目标文件身份已改变。") }
                guard parsed.note.deletedAt == nil else { throw VaultError(code: "NOTE_DELETED", message: "此笔记已删除，M1 不提供恢复编辑。") }
                frontmatter = parsed.frontmatter
            } else {
                guard request.baseHash == nil, existing == nil else {
                    throw VaultError(code: "NOTE_NOT_FOUND", message: "原文件已移除，不能从旧缓存恢复。")
                }
                frontmatter["id"] = Node(id, Tag(.str), .doubleQuoted)
                frontmatter["createdAt"] = Node(timestamp(), Tag(.str), .doubleQuoted)
            }
            frontmatter["updatedAt"] = Node(timestamp(), Tag(.str), .doubleQuoted)
            var data = try self.compatible ? encodedObsidianNote(original, body: request.body, title: request.title) : encodedNote(frontmatter: frontmatter, body: request.body, originalHeader: original?.originalHeader)
            for property in inherited {
                data = try patchNoteProperty(data, change: PropertyChange(id: id, baseHash: "", name: property.name, type: property.type, value: property.value, remove: nil, create: true, options: property.options))
            }
            if let config, try self.readPropertyDefinitions(root).hash != config.hash { throw VaultError(code: "HASH_CONFLICT", message: "属性定义已修改，请重新保存。") }
            guard data.count <= 8 * 1024 * 1024 else {
                throw VaultError(code: "NOTE_TOO_LARGE", message: "M1 单条 Markdown 最大支持 8 MiB。")
            }
            try data.write(to: coordinated, options: .atomic)
            if self.compatible {
                let identity = FileIdentity(id: id, path: self.relative(coordinated, root: root), hash: sha256(data), createdAt: existing?.note.createdAt ?? timestamp())
                try self.persistIdentities(self.identities.filter { $0.id != id } + [identity])
                return try parseObsidianNote(data, relativePath: identity.path, vaultID: metadata.vaultId, identity: identity, modified: Date()).note
            }
            return try parseNote(data, relativePath: self.relative(coordinated, root: root), vaultID: metadata.vaultId).note
        }
        // Committing the source succeeds independently of best-effort draft cleanup.
        // A changed or unreadable draft must survive, never be discarded as "already saved".
        try? removeCommittedDraft(request, id: id, tags: tags)
        return saved
    }

    private struct PropertyLabels: Encodable { let labels: [String: String]; let contentHash: String }
    private let systemPropertyLabels = ["system:tags": "标签", "system:updatedAt": "更新时间", "system:createdAt": "创建时间", "system:filename": "文件名"]
    private func defaultPropertyLabel(_ key: String) -> String { systemPropertyLabels[key] ?? String(key.dropFirst("property:".count)) }
    private func validPropertyLabel(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 100 && value == value.trimmingCharacters(in: .whitespacesAndNewlines) && !value.unicodeScalars.contains { $0.value < 32 }
    }
    private func propertyLabelBytes(_ url: URL) throws -> Data {
        guard fm.fileExists(atPath: url.path) else { return Data() }
        return try readSource(url)
    }
    private func decodedPropertyLabels(_ data: Data) throws -> PropertyLabels {
        let labels: [String: String]
        do { labels = data.isEmpty ? [:] : try JSONDecoder().decode([String: String].self, from: data) }
        catch { throw VaultError(code: "INVALID_PROPERTY", message: "属性名称配置无法读取，请检查 .memocard/property-labels.json。") }
        guard labels.allSatisfy({ (systemPropertyLabels[$0.key] != nil || $0.key.hasPrefix("property:") && $0.key.count > 9) && validPropertyLabel($0.value) }) else {
            throw VaultError(code: "INVALID_PROPERTY", message: "属性名称配置无法读取，请检查 .memocard/property-labels.json。")
        }
        return PropertyLabels(labels: labels, contentHash: sha256(data))
    }
    private func readPropertyLabels() throws -> PropertyLabels {
        let (root, _) = try active()
        let path = root.appendingPathComponent(".memocard/property-labels.json")
        try validate(path, inside: root)
        if !fm.fileExists(atPath: path.path) { return try decodedPropertyLabels(Data()) }
        return try coordinateRead(path, inside: root) { try self.decodedPropertyLabels(self.propertyLabelBytes($0)) }
    }
    private func renamePropertyLabel(key: String, label: String, baseHash: String) throws -> PropertyLabels {
        let label = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard validPropertyLabel(label) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性名不能为空、超过 100 字或包含控制字符。") }
        let snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完整读取，无法安全修改属性名称。") }
        let (root, _) = try active()
        var keys = Set(systemPropertyLabels.keys)
        for item in snapshot.notes {
            let data = try coordinateRead(root.appendingPathComponent(item.note.relativePath), inside: root) { try self.readSource($0) }
            for property in try readNoteProperties(data).properties { keys.insert("property:" + property.name) }
        }
        guard keys.contains(key) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性已被移除，请重新加载。") }
        let path = root.appendingPathComponent(".memocard/property-labels.json")
        return try coordinateWrite(path, inside: root) { url in
            try self.requireNoConflict(url)
            let current = try self.decodedPropertyLabels(self.propertyLabelBytes(url))
            guard current.contentHash == baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "属性名称已在其他位置修改，请重新打开后重试。") }
            guard !keys.union(current.labels.keys).contains(where: { $0 != key && (current.labels[$0] ?? self.defaultPropertyLabel($0)) == label }) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性名称已存在。") }
            var labels = current.labels
            if label == self.defaultPropertyLabel(key) { labels.removeValue(forKey: key) } else { labels[key] = label }
            let data = try encode(labels)
            try data.write(to: url, options: .atomic)
            return PropertyLabels(labels: labels, contentHash: sha256(data))
        }
    }

    private func readPropertyDefinitions(_ root: URL) throws -> (before: Data?, values: [String: PropertyDefinition], hash: String) {
        let path = root.appendingPathComponent(propertyDefinitionPath)
        try validate(path, inside: root)
        let data = fm.fileExists(atPath: path.path) ? try coordinateRead(path, inside: root) { try self.readSource($0) } : nil
        let values: [String: PropertyDefinition]
        do { values = data == nil || data!.isEmpty ? [:] : try JSONDecoder().decode([String: PropertyDefinition].self, from: data!) }
        catch { throw VaultError(code: "INVALID_PROPERTY", message: "属性定义配置无法读取，请检查 .memocard/property-definitions.json。") }
        guard values.allSatisfy({ !$0.key.isEmpty && !["id", "createdAt", "updatedAt", "deletedAt", "tags"].contains($0.key) && validPropertyDefinition($0.value) }) else {
            throw VaultError(code: "INVALID_PROPERTY", message: "属性定义配置无法读取，请检查 .memocard/property-definitions.json。")
        }
        return (data, values, sha256(data ?? Data()))
    }
    private func libraryProperties(_ snapshot: Snapshot) throws -> [NoteProperty] {
        try snapshot.notes.filter { $0.note.deletedAt == nil }.sorted { $0.note.relativePath < $1.note.relativePath }.flatMap { item in
            if let properties = parsedCache[item.note.relativePath]?.properties { return properties }
            // The snapshot already verified the source hash. Only YAML is needed for library options.
            let properties = try readNoteProperties(Data((item.originalHeader ?? "").utf8)).properties
            propertyParseMissCount += 1
            parsedCache[item.note.relativePath]?.properties = properties
            return properties
        }
    }
    private func effectiveNoteProperties(_ data: Data, snapshot: Snapshot, root: URL) throws -> NoteProperties {
        let config = try readPropertyDefinitions(root)
        let raw = try readNoteProperties(data)
        let needsOptions = raw.properties.contains { $0.type != "unsupported" && $0.options != nil && config.values[$0.name] == nil }
        let all = needsOptions ? try libraryProperties(snapshot) : []
        let properties = raw.properties.map { property -> NoteProperty in
            guard property.type != "unsupported" else { return property }
            if let definition = config.values[property.name] { return convertedProperty(property, definition: definition) }
            guard property.options != nil else { return property }
            return NoteProperty(name: property.name, type: property.type, value: property.value, editable: property.editable, options: mergedPropertyOptions(all.filter { $0.name == property.name }))
        }
        return NoteProperties(properties: properties, tagProperty: raw.tagProperty, contentHash: raw.contentHash, writable: raw.writable, definitionHash: config.hash)
    }
    private func updatePropertyDefinition(_ change: PropertyChange, snapshot: Snapshot, existing: ParsedNote, root: URL, metadata: VaultMetadata) throws -> Note {
        let config = try readPropertyDefinitions(root)
        guard change.definitionHash == nil || change.definitionHash == config.hash else { throw VaultError(code: "HASH_CONFLICT", message: "属性定义已在其他位置修改，请重新打开后重试。") }
        let original = try readSource(root.appendingPathComponent(existing.note.relativePath))
        guard sha256(original) == change.baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "笔记已在其他位置修改，库级属性未更新。") }
        guard let current = try readNoteProperties(original).properties.first(where: { $0.name == change.name }), current.editable, change.create != true, change.remove != true, change.renameTo == nil, let type = change.type else { throw VaultError(code: "INVALID_PROPERTY", message: "只有可编辑的自定义属性支持修改库级定义。") }
        let properties = try libraryProperties(snapshot).filter { $0.name == change.name }
        let typeChanged = (config.values[change.name]?.type ?? current.type) != type
        let definition = newPropertyDefinition(properties, type: type, options: change.options, includeValues: typeChanged)
        guard validPropertyDefinition(definition) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性类型或选项定义无效，最多支持 200 个选项。") }
        if let rename = change.optionRename {
            let previous = config.values[change.name]?.options ?? mergedPropertyOptions(properties)
            guard !typeChanged, previous.contains(where: { $0.name == rename.from }), !previous.contains(where: { $0.name == rename.to }), definition.options?.contains(where: { $0.name == rename.to }) == true, definition.options?.contains(where: { $0.name == rename.from }) == false else { throw VaultError(code: "INVALID_PROPERTY", message: "选项重命名无效。") }
        }
        var changes: [RenameChange] = []
        var saved: Note?
        for item in snapshot.notes where item.note.deletedAt == nil {
            let before = try coordinateRead(root.appendingPathComponent(item.note.relativePath), inside: root) { try self.readSource($0) }
            guard sha256(before) == item.note.contentHash else { throw VaultError(code: "HASH_CONFLICT", message: "笔记已在其他位置修改，库级属性未更新。") }
            guard let property = try readNoteProperties(before).properties.first(where: { $0.name == change.name }) else { continue }
            guard property.editable else { throw VaultError(code: "INVALID_PROPERTY", message: "「\(item.note.relativePath)」的此属性只读，库级修改未保存。") }
            let converted = convertedProperty(property, definition: definition, rename: change.optionRename)
            let value = item.note.id == existing.note.id && !typeChanged ? change.value ?? converted.value : converted.value
            let update = PropertyChange(id: item.note.id, baseHash: item.note.contentHash, name: change.name, type: definition.type, value: value, remove: nil, create: nil, options: definition.options)
            let after = try patchNoteProperty(before, change: update, updatedAt: compatible ? nil : timestamp())
            guard after.count <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "单条 Markdown 最大支持 8 MiB。") }
            let identity = FileIdentity(id: item.note.id, path: item.note.relativePath, hash: sha256(after), createdAt: item.note.createdAt)
            let parsed = try compatible ? parseObsidianNote(after, relativePath: identity.path, vaultID: metadata.vaultId, identity: identity, modified: Date()) : parseNote(after, relativePath: identity.path, vaultID: metadata.vaultId)
            changes.append(RenameChange(path: identity.path, before: before, after: after))
            if item.note.id == existing.note.id { saved = parsed.note }
        }
        var definitions = config.values
        definitions[change.name] = definition
        changes.append(RenameChange(path: propertyDefinitionPath, before: config.before, after: try encode(definitions)))
        let journal = RenameJournal(root: root.path, changes: changes, identities: identities)
        do {
            try coordinateWrite(root, inside: root, options: .forMerging) { _ in
                try encode(journal).write(to: self.renameJournalURL, options: .atomic)
                for change in changes {
                    guard try self.renameBytes(change.path, root: root) == change.before else { throw VaultError(code: "HASH_CONFLICT", message: "批量修改期间文件已改变，备份已保留。") }
                    let url = root.appendingPathComponent(change.path)
                    try self.requireNoConflict(url)
                    try change.after!.write(to: url, options: change.before == nil ? .withoutOverwriting : .atomic)
                }
                if self.compatible {
                    try self.persistIdentities(self.identities.map { item in
                        FileIdentity(id: item.id, path: item.path, hash: changes.first { $0.path == item.path }.map { sha256($0.after!) } ?? item.hash, createdAt: item.createdAt)
                    })
                }
                try self.fm.removeItem(at: self.renameJournalURL)
            }
        } catch { try recoverRename(); throw error }
        parsedCache.removeAll(); invalidateSnapshot()
        return saved!
    }
    private func updateNoteProperty(_ change: PropertyChange) throws -> Note {
        let id = try canonicalID(change.id)
        let snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完整读取，无法安全修改属性。") }
        guard let existing = snapshot.notes.first(where: { $0.note.id == id }), existing.note.deletedAt == nil else { throw VaultError(code: "NOTE_NOT_FOUND", message: "找不到可编辑的笔记。") }
        let (root, metadata) = try active()
        if change.definition == true { return try updatePropertyDefinition(change, snapshot: snapshot, existing: existing, root: root, metadata: metadata) }
        let config = try readPropertyDefinitions(root)
        guard change.definitionHash == nil || change.definitionHash == config.hash else { throw VaultError(code: "HASH_CONFLICT", message: "属性定义已在其他位置修改，请重新打开后重试。") }
        var adjusted = change
        if let definition = config.values[change.name], change.remove != true, change.renameTo == nil {
            guard change.type == definition.type else { throw VaultError(code: "INVALID_PROPERTY", message: "属性类型已变化，请重新打开后编辑。") }
            if let options = change.options, !(change.create == true && options.isEmpty) {
                guard options.count == definition.options?.count, zip(options, definition.options ?? []).allSatisfy({ $0.name == $1.name && $0.color == $1.color }) else { throw VaultError(code: "INVALID_PROPERTY", message: "选项已变化，请重新打开后编辑。") }
            }
            adjusted.options = definition.options
        }
        return try coordinateWrite(root.appendingPathComponent(existing.note.relativePath), inside: root) { url in
            try self.requireNoConflict(url)
            let before = try self.readSource(url)
            guard sha256(before) == change.baseHash, try self.readPropertyDefinitions(root).before == config.before else { throw VaultError(code: "HASH_CONFLICT", message: "文件或属性定义已修改，请重新加载。") }
            let data = try patchNoteProperty(before, change: adjusted, updatedAt: self.compatible ? nil : timestamp())
            let identity = FileIdentity(id: id, path: existing.note.relativePath, hash: sha256(data), createdAt: existing.note.createdAt)
            let parsed = try self.compatible ? parseObsidianNote(data, relativePath: identity.path, vaultID: metadata.vaultId, identity: identity, modified: Date()) : parseNote(data, relativePath: identity.path, vaultID: metadata.vaultId)
            try data.write(to: url, options: .atomic)
            if self.compatible { try self.persistIdentities(self.identities.filter { $0.id != id } + [identity]) }
            return parsed.note
        }
    }

    private struct RenameChange: Codable { let path: String; let before: Data?; let after: Data? }
    private struct RenameJournal: Codable { let root: String; let changes: [RenameChange]; let identities: [FileIdentity] }
    private var renameJournalURL: URL { identityURL.appendingPathExtension("rename.json") }

    private func renameBytes(_ path: String, root: URL) throws -> Data? {
        if path != propertyDefinitionPath { _ = try newNotePath(path, id: "", root: root) }
        let url = root.appendingPathComponent(path)
        try validate(url, inside: root)
        return fm.fileExists(atPath: url.path) ? try readSource(url) : nil
    }

    private func recoverRename() throws {
        guard let root, metadata != nil, fm.fileExists(atPath: renameJournalURL.path) else { return }
        let journal = try JSONDecoder().decode(RenameJournal.self, from: Data(contentsOf: renameJournalURL))
        guard journal.root == root.path else { throw VaultError(code: "RENAME_RECOVERY_REQUIRED", message: "重命名恢复记录不属于当前笔记库。") }
        try coordinateWrite(root, inside: root, options: .forMerging) { _ in
            // Never roll back over an external edit. The durable journal remains available.
            for change in journal.changes {
                let current = try self.renameBytes(change.path, root: root)
                guard current == change.before || current == change.after else { throw VaultError(code: "RENAME_RECOVERY_REQUIRED", message: "重命名期间文件被外部修改，备份和草稿已保留，请先恢复重命名记录。") }
            }
            for change in journal.changes.reversed() {
                let url = root.appendingPathComponent(change.path)
                if let data = change.before { try data.write(to: url, options: .atomic) }
                else if self.fm.fileExists(atPath: url.path) { try self.fm.removeItem(at: url) }
            }
            if self.compatible { try self.persistIdentities(journal.identities) }
            try self.fm.removeItem(at: self.renameJournalURL)
        }
        invalidateSnapshot(); parsedCache.removeAll()
    }

    private func renameNote(_ request: SaveRequest, existing: ParsedNote, snapshot: Snapshot, to path: String, root: URL, metadata: VaultMetadata) throws -> Note {
        let old = existing.note.relativePath, renames = [old: path], paths = snapshot.notes.map { $0.note.relativePath }
        let original = try readSource(root.appendingPathComponent(old))
        guard sha256(original) == request.baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "文件已在其他位置修改，原文未被覆盖。") }
        guard try renameBytes(path, root: root) == nil else { throw VaultError(code: "HASH_CONFLICT", message: "重命名目标已存在，原文未被覆盖。") }
        let parsed = try compatible ? parseObsidianNote(original, relativePath: old, vaultID: metadata.vaultId, identity: FileIdentity(id: existing.note.id, path: old, hash: sha256(original), createdAt: existing.note.createdAt), modified: Date()) : parseNote(original, relativePath: old, vaultID: metadata.vaultId)
        var frontmatter = parsed.frontmatter
        if !compatible { frontmatter["updatedAt"] = Node(timestamp(), Tag(.str), .doubleQuoted) }
        let encoded = try compatible ? encodedObsidianNote(parsed, body: request.body) : encodedNote(frontmatter: frontmatter, body: request.body, originalHeader: parsed.originalHeader)
        let data = Data(rewriteNoteLinks(String(decoding: encoded, as: UTF8.self), sourcePath: old, paths: paths, renames: renames).utf8)
        guard data.count <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "单条 Markdown 最大支持 8 MiB。") }
        var changes = [RenameChange(path: path, before: nil, after: data)]
        for note in snapshot.notes where note.note.relativePath != old {
            let source = try readSource(root.appendingPathComponent(note.note.relativePath))
            let next = Data(rewriteNoteLinks(String(decoding: source, as: UTF8.self), sourcePath: note.note.relativePath, paths: paths, renames: renames).utf8)
            if next != source {
                guard next.count <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "引用文件超出大小限制，重命名未提交。") }
                guard sha256(source) == note.note.contentHash else { throw VaultError(code: "HASH_CONFLICT", message: "引用笔记已被外部修改，重命名未提交。") }
                changes.append(RenameChange(path: note.note.relativePath, before: source, after: next))
            }
        }
        changes.append(RenameChange(path: old, before: original, after: nil))
        let journal = RenameJournal(root: root.path, changes: changes, identities: identities)
        let backup = localDataURL.appendingPathComponent("renames/\(UUID().uuidString.lowercased()).json")
        try fm.createDirectory(at: backup.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encode(journal).write(to: backup, options: .atomic)
        try encode(journal).write(to: renameJournalURL, options: .atomic)
        do {
            try coordinateWrite(root, inside: root, options: .forMerging) { _ in
                for change in changes {
                    guard try self.renameBytes(change.path, root: root) == change.before else { throw VaultError(code: "HASH_CONFLICT", message: "重命名期间文件被外部修改，原文与草稿已保留。") }
                    let url = root.appendingPathComponent(change.path)
                    if let bytes = change.after { try bytes.write(to: url, options: change.before == nil ? .withoutOverwriting : .atomic) }
                    else { try self.fm.removeItem(at: url) }
                }
                if self.compatible {
                    let next = self.identities.map { item -> FileIdentity in
                        let nextPath = item.path == old ? path : item.path
                        let hash = changes.first { $0.path == nextPath && $0.after != nil }.map { sha256($0.after!) } ?? item.hash
                        return FileIdentity(id: item.id, path: nextPath, hash: hash, createdAt: item.createdAt)
                    }
                    try self.persistIdentities(next)
                }
                try self.fm.removeItem(at: self.renameJournalURL)
            }
        } catch { try recoverRename(); throw error }
        parsedCache.removeAll(); invalidateSnapshot()
        try? removeCommittedDraft(request, id: existing.note.id, tags: validatedTags(inlineTags(request.body)))
        return try compatible ? parseObsidianNote(data, relativePath: path, vaultID: metadata.vaultId, identity: FileIdentity(id: existing.note.id, path: path, hash: sha256(data), createdAt: existing.note.createdAt), modified: Date()).note : parseNote(data, relativePath: path, vaultID: metadata.vaultId).note
    }

    private func removeCommittedDraft(_ request: SaveRequest, id: String, tags: [String]) throws {
        guard let metadata else { return }
        let path = localDataURL.appendingPathComponent("drafts/\(metadata.vaultId)/\(id).json")
        try validate(path, inside: localDataURL)
        guard fm.fileExists(atPath: path.path) else { return }
        try coordinateWrite(path, inside: localDataURL, options: .forDeleting) { coordinated in
            let draft = try JSONDecoder().decode(Draft.self, from: Data(contentsOf: coordinated))
            guard draft.id == id, draft.title == request.title, draft.body == request.body, draft.tags == tags, draft.baseHash == request.baseHash else { return }
            try self.fm.removeItem(at: coordinated)
        }
    }

    private func listTags() throws -> Data {
        let snapshot = try snapshot(for: "listTags")
        var counts: [String: Int] = [:]
        for parsed in snapshot.notes where parsed.note.deletedAt == nil {
            let names = Set(parsed.note.tags.flatMap { tag -> [String] in
                let parts = tag.components(separatedBy: "/")
                return parts.indices.map { parts[...$0].joined(separator: "/") }
            })
            for tag in names { counts[tag, default: 0] += 1 }
        }
        struct TagCount: Encodable { let name: String; let count: Int }
        struct Result: Encodable { let tags: [TagCount]; let coverage: Coverage }
        return try encode(Result(tags: counts.keys.sorted().map { TagCount(name: $0, count: counts[$0]!) }, coverage: snapshot.coverage))
    }

    private func draftDirectory() throws -> URL {
        // Once a vault has been opened, local drafts remain writable even if its provider goes offline.
        guard let metadata else { throw VaultError(code: "VAULT_NOT_OPEN", message: "请先选择笔记库。") }
        let directory = localDataURL.appendingPathComponent("drafts/\(metadata.vaultId)")
        try validate(directory, inside: localDataURL)
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func saveDraft(_ request: SaveRequest) throws -> Data {
        let id = try canonicalID(request.id)
        let tags = try validatedTags(inlineTags(request.body))
        let directory = try draftDirectory()
        let target = directory.appendingPathComponent("\(id).json")
        let draft = Draft(title: request.title, id: id, body: request.body, tags: tags, baseHash: request.baseHash,
                          relativePath: request.relativePath, updatedAt: timestamp())
        try coordinateWrite(target, inside: localDataURL) { try encode(draft).write(to: $0, options: .atomic) }
        return try encode(draft)
    }

    private func getDrafts() throws -> Data {
        let directory = try draftDirectory()
        let paths = try fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        var drafts: [Draft] = []
        for path in paths where path.pathExtension == "json" {
            let draft = try coordinateRead(path, inside: localDataURL) { try JSONDecoder().decode(Draft.self, from: Data(contentsOf: $0)) }
            _ = try canonicalID(draft.id)
            _ = try parseDate(draft.updatedAt)
            drafts.append(draft)
        }
        drafts.sort { $0.updatedAt > $1.updatedAt }
        struct Result: Encodable { let drafts: [Draft] }
        return try encode(Result(drafts: drafts))
    }

    private func importAttachment(name: String, base64: String, noteID: String?, requestedPath: String?) throws -> Data {
        let (root, _) = try active()
        guard !name.isEmpty, name == (name as NSString).lastPathComponent, !name.contains("\\"),
              let data = Data(base64Encoded: base64), !data.isEmpty,
              let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) > 0,
              let type = CGImageSourceGetType(source), let uniformType = UTType(type as String),
              uniformType.conforms(to: .image), let ext = uniformType.preferredFilenameExtension else {
            throw VaultError(code: "INVALID_ATTACHMENT", message: "附件必须是可识别的图片，文件名不能包含目录。")
        }
        let supportedTypes: Set<String> = [UTType.png.identifier, UTType.jpeg.identifier, UTType.gif.identifier,
                                           UTType.webP.identifier, UTType.heic.identifier, UTType.heif.identifier]
        guard supportedTypes.contains(uniformType.identifier) else {
            throw VaultError(code: "UNSUPPORTED_ATTACHMENT", message: "暂不支持此图片格式，请先转换为 PNG、JPEG、GIF、WebP、HEIC 或 HEIF。")
        }
        var notePath = compatible ? "new.md" : "notes/new.md"
        if let noteID {
            let id = try canonicalID(noteID)
            let snapshot = try scan()
            guard !snapshot.duplicateIDs.contains(id) else {
                throw VaultError(code: "DUPLICATE_ID", message: "笔记 ID 重复，无法确定图片引用位置。")
            }
            guard snapshot.coverage.complete else {
                throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库包含待下载、冲突或格式异常文件，暂时无法确定图片引用位置。", retryable: true)
            }
            if let note = snapshot.notes.first(where: { $0.note.id == id })?.note {
                guard note.deletedAt == nil else { throw VaultError(code: "NOTE_DELETED", message: "此笔记已删除，无法导入图片。") }
                notePath = note.relativePath
            } else {
                notePath = try newNotePath(requestedPath, id: id, root: root)
            }
        }
        let path = "assets/\(UUID().uuidString.lowercased()).\(ext)"
        let target = root.appendingPathComponent(path)
        try validate(target, inside: root)
        try fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        try coordinateWrite(target, inside: root) { url in
            guard !self.fm.fileExists(atPath: url.path) else { throw VaultError(code: "FILE_EXISTS", message: "附件文件已存在。") }
            try data.write(to: url, options: .atomic)
        }
        struct Result: Encodable { let relativePath: String; let markdownPath: String; let notePath: String }
        let directoryDepth = notePath.split(separator: "/").count - 1
        return try encode(Result(relativePath: path, markdownPath: String(repeating: "../", count: directoryDepth) + path,
                                 notePath: notePath))
    }

    private func resolveLink(_ target: String, sourcePath: String, wiki: Bool) throws -> Data {
        let (root, _) = try active()
        let snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完整读取，无法安全解析链接。") }
        let raw = String(target.split(separator: "#", omittingEmptySubsequences: false).first ?? "")
        guard let decoded = wiki ? raw : raw.removingPercentEncoding, !decoded.isEmpty,
              !decoded.contains("\\"), !decoded.contains(":"), !decoded.unicodeScalars.contains(where: { $0.value < 32 }) else {
            throw VaultError(code: "LINK_NOT_FOUND", message: "链接路径无效。")
        }
        var paths = snapshot.notes.map { $0.note.relativePath }
        if let enumerator = fm.enumerator(at: root, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]) {
            for case let url as URL in enumerator {
                try validate(url, inside: root)
                if ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif"].contains(url.pathExtension.lowercased()), try fileType(url) == .typeRegular {
                    paths.append(relative(url, root: root))
                }
            }
        }
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
        let relativeTarget = directory.isEmpty ? decoded : directory + "/" + decoded
        var matches: [String] = []
        for candidate in wiki ? [decoded, relativeTarget] : [relativeTarget, decoded] {
            if let path = normalized(candidate) {
                matches = paths.filter { $0 == path || $0 == path + ".md" }
                if !matches.isEmpty { break }
            }
        }
        if matches.isEmpty && wiki && !decoded.hasPrefix("/") && !decoded.split(separator: "/").contains(where: { $0.hasPrefix(".") }) {
            matches = paths.filter { $0.hasSuffix("/" + decoded) || $0.hasSuffix("/" + decoded + ".md") }
        }
        guard matches.count == 1 else { throw VaultError(code: matches.isEmpty ? "LINK_NOT_FOUND" : "AMBIGUOUS_LINK", message: matches.isEmpty ? "找不到链接目标。" : "链接匹配多份文件，请使用完整路径。") }
        struct Link: Encodable { let kind: String; let id: String?; let path: String }
        let note = snapshot.notes.first { $0.note.relativePath == matches[0] }?.note
        return try encode(Link(kind: note == nil ? "image" : "note", id: note?.id, path: matches[0]))
    }

    private var identityURL: URL {
        let scope = sha256(Data((root!.path + ":" + metadata!.vaultId).utf8))
        return localDataURL.appendingPathComponent("identities-\(scope).json")
    }

    private func persistIdentities(_ values: [FileIdentity]) throws {
        if values.map({ "\($0.id):\($0.path):\($0.hash)" }) != identities.map({ "\($0.id):\($0.path):\($0.hash)" }) {
            try encode(values).write(to: identityURL, options: .atomic)
        }
        identities = values
    }

    private func readSource(_ url: URL) throws -> Data {
        guard try isAvailable(url) else { throw VaultError(code: "FILE_PENDING", message: "文件尚未下载。", retryable: true) }
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "M1 单条 Markdown 最大支持 8 MiB。") }
        sourceReadCount += 1
        return try Data(contentsOf: url)
    }

    private func isAvailable(_ url: URL) throws -> Bool {
        let values = try url.resourceValues(forKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey])
        guard values.isUbiquitousItem == true else { return true }
        if values.ubiquitousItemDownloadingStatus == .current { return true }
        try? fm.startDownloadingUbiquitousItem(at: url)
        return false
    }

    private func requireNoConflict(_ url: URL) throws {
        guard (NSFileVersion.unresolvedConflictVersionsOfItem(at: url) ?? []).isEmpty else {
            throw VaultError(code: "SOURCE_CONFLICT", message: "文件存在未解决的 iCloud 版本冲突，原版本均已保留。")
        }
    }

    private func fileType(_ url: URL) throws -> FileAttributeType? {
        try fm.attributesOfItem(atPath: url.path)[.type] as? FileAttributeType
    }

    private func isInside(_ candidate: URL, _ root: URL) -> Bool {
        candidate.path == root.path || candidate.path.hasPrefix(root.path + "/")
    }

    private func relative(_ url: URL, root: URL) -> String {
        // File coordination may return /private/var while the selected URL uses /var.
        String(url.standardizedFileURL.path.dropFirst(root.path.count + 1))
    }

    private func validate(_ url: URL, inside root: URL) throws {
        let candidate = url.standardizedFileURL
        guard isInside(candidate, root), try fileType(root) == .typeDirectory,
              root.resolvingSymlinksInPath().path == root.path else {
            throw VaultError(code: "PATH_NOT_ALLOWED", message: "文件路径超出授权目录或授权目录已改变。")
        }
        var current = root
        let suffix = candidate.pathComponents.dropFirst(root.pathComponents.count)
        for part in suffix {
            current.appendPathComponent(part)
            do {
                if try fileType(current) == .typeSymbolicLink {
                    throw VaultError(code: "SYMLINK_NOT_ALLOWED", message: "笔记库不允许符号链接。")
                }
            } catch let error as VaultError { throw error }
            catch let error as CocoaError where error.code == .fileReadNoSuchFile { break }
        }
    }

    private func coordinateRead<T>(_ url: URL, inside root: URL, _ body: (URL) throws -> T) throws -> T {
        try validate(url, inside: root)
        var coordinationError: NSError?
        var result: Result<T, Error>?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinated in
            result = Result { try self.validate(coordinated, inside: root); return try body(coordinated) }
        }
        if let coordinationError { throw coordinationError }
        guard let result else { throw VaultError(code: "COORDINATION_FAILED", message: "未能获得文件读取权限。", retryable: true) }
        return try result.get()
    }

    private func coordinateWrite<T>(_ url: URL, inside root: URL, options: NSFileCoordinator.WritingOptions = .forReplacing, _ body: (URL) throws -> T) throws -> T {
        try validate(url, inside: root)
        var coordinationError: NSError?
        var result: Result<T, Error>?
        NSFileCoordinator().coordinate(writingItemAt: url, options: options, error: &coordinationError) { coordinated in
            result = Result { try self.validate(coordinated, inside: root); return try body(coordinated) }
        }
        if let coordinationError { throw coordinationError }
        guard let result else { throw VaultError(code: "COORDINATION_FAILED", message: "未能获得文件写入权限。", retryable: true) }
        return try result.get()
    }
}
